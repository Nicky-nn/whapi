// resolvers.ts
import { MessageMedia } from 'whatsapp-web.js'
import User from '../models/User'
import WhatsAppSession from '../models/WhatsAppSession'
import WhatsAppBot from '../whatsapp/WhatsAppBot'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { AuthenticationError, ForbiddenError } from 'apollo-server-express'
import jwt from 'jsonwebtoken'

const bots: { [key: string]: WhatsAppBot } = {}

interface Login {
  username: string
  password: string
}

const resolvers = {
  Query: {
    me: async (_: any, __: any, context: { user: any }) => {
      if (!context.user) throw new AuthenticationError('No autenticado')
      const user = await User.findById(context.user._id)
      if (!user) throw new Error('Usuario no encontrado')
      return user
    },
    listaUsuarios: async (
      _: any,
      { role }: { role?: string },
      { user }: { user: any },
    ) => {
      try {
        if (!user) {
          throw new Error('Usuario no autenticado')
        }

        let filter = {}

        // Si se especifica un rol, filtrar por ese rol
        if (role) {
          filter = { role: role.toUpperCase() }
        }

        // Verificar si el usuario autenticado es SuperAdmin o Admin
        if (user.role === 'SUPER_ADMIN') {
          // SuperAdmin puede ver todos los usuarios, no es necesario modificar el filtro
        } else if (user.role === 'ADMIN') {
          // Admin solo puede ver a los usuarios que él mismo creó
          filter = { ...filter, creatorId: user.id }
        } else {
          throw new Error('No tienes permisos para ver esta información')
        }

        const users = await User.find(filter)
        if (users.length === 0) {
          console.log('No se encontraron usuarios')
        }
        return users
      } catch (error) {
        console.error('Error al buscar usuarios:', (error as Error).message)
        throw new Error('Error al buscar usuarios')
      }
    },

    adminPendientes: async (_: any, __: any, { user }: { user: any }) => {
      try {
        // Verificar si el usuario autenticado es SuperAdmin
        if (user.role !== 'SUPER_ADMIN') {
          throw new Error('No tienes permisos para ver esta información')
        }

        // Si es SuperAdmin, buscar los administradores pendientes
        return await User.find({ role: 'ADMIN', isActive: false })
      } catch (error) {
        console.error(
          'Error al buscar administradores pendientes:',
          (error as Error).message,
        )
        throw new Error('Error al buscar administradores pendientes')
      }
    },

    getUser: async (_: any, { username }: { username: string }) => {
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')
      const whatsAppSession = await WhatsAppSession.findOne({ userId: user._id })
      return {
        id: user._id.toString(),
        username: user.username,
        whatsappConnected: whatsAppSession?.isConnected || false,
        email: user.email,
        nombres: user.nombres,
        apellidos: user.apellidos,
        role: user.role,
        isActive: user.isActive,
        token: user.token,
      }
    },
    getQRCode: async (_: any, { username }: { username: string }) => {
      // Buscar el usuario por nombre de usuario
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')

      // Verificar si el usuario está activo
      if (!user.isActive) {
        throw new Error('No se puede obtener el código QR. El usuario está inactivo.')
      }

      // Buscar la sesión de WhatsApp para el usuario
      const userId = user._id.toString()
      const session = await WhatsAppSession.findOne({ userId })

      if (session && session.isConnected) {
        throw new Error('El usuario ya está logueado en WhatsApp')
      }

      // Inicializar el bot si no está ya inicializado
      if (!bots[userId]) {
        bots[userId] = new WhatsAppBot(userId)
        await bots[userId].initialize()
      }

      // Obtener el código QR
      return bots[userId].getQRCode()
    },
    needsQRCode: async (_: any, { username }: { username: string }) => {
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')
      const whatsAppSession = await WhatsAppSession.findOne({ userId: user._id })
      return !whatsAppSession || !whatsAppSession.isConnected
    },
  },
  Mutation: {
    login: async (_: any, { username, password }: Login) => {
      // Buscar al usuario en la base de datos
      const user = await User.findOne({ username })
      // Verificar si el usuario existe
      if (!user) throw new AuthenticationError('Credenciales inválidas')
      // Comparar la contraseña proporcionada con el hash almacenado
      const isValid = await bcrypt.compare(password, user.password)
      // Verificar si la contraseña es correcta
      if (!isValid) throw new AuthenticationError('Contraseña incorrecta')

      // Generar un token JWT
      const token = jwt.sign(
        { userId: user._id, username: user.username, role: user.role },
        process.env.JWT_SECRET || '',
        { expiresIn: '1d' },
      )

      // Devolver el token y los detalles del usuario
      return { token, user }
    },
    registerAdmin: async (
      _: any,
      {
        nombreDeUsuario,
        email,
        password,
        nombres,
        apellidos,
      }: {
        nombreDeUsuario: string
        email: string
        password: string
        nombres: string
        apellidos: string
      },
    ) => {
      const existingUser = await User.findOne({
        $or: [{ email }, { username: nombreDeUsuario }],
      })
      if (existingUser) throw new Error('El email o nombre de usuario ya está registrado')
      const newAdmin = new User({
        username: nombreDeUsuario,
        email,
        password,
        nombres,
        apellidos,
        role: 'ADMIN',
        isActive: false,
        token: uuidv4(),
      })
      await newAdmin.save()
      return newAdmin
    },

    registerSuperAdmin: async (
      _: any,
      {
        nombreDeUsuario,
        email,
        password,
        nombres,
        apellidos,
      }: {
        nombreDeUsuario: string
        email: string
        password: string
        nombres: string
        apellidos: string
      },
      context: { user: { role: string } },
    ) => {
      if (!context.user || context.user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenError('No autorizado')
      }

      const existingUser = await User.findOne({
        $or: [{ email }, { username: nombreDeUsuario }],
      })
      if (existingUser) throw new Error('El email o username ya está en uso')

      const newSuperAdmin = new User({
        username: nombreDeUsuario,
        email,
        password,
        nombres,
        apellidos,
        role: 'SUPER_ADMIN',
        isActive: true,
        token: uuidv4(),
      })

      await newSuperAdmin.save()
      return newSuperAdmin
    },

    toggleUserStatus: async (
      _: any,
      { userId }: { userId: mongoose.Types.ObjectId },
      context: { user: { role: string } },
    ) => {
      if (!context.user) throw new AuthenticationError('No autenticado')

      const userToToggle = await User.findById(userId)
      if (!userToToggle) throw new Error('Usuario no encontrado')

      if (context.user.role === 'SUPER_ADMIN') {
        if (userToToggle.role !== 'ADMIN' && userToToggle.role !== 'USER') {
          throw new ForbiddenError('No autorizado para cambiar el estado de este usuario')
        }
      } else if (context.user.role === 'ADMIN') {
        if (userToToggle.role !== 'USER') {
          throw new ForbiddenError('No autorizado para cambiar el estado de este usuario')
        }
      } else {
        throw new ForbiddenError('No autorizado')
      }

      userToToggle.isActive = !userToToggle.isActive
      await userToToggle.save()
      return userToToggle
    },

    createUser: async (
      _: any,
      {
        nombreDeUsuario,
        email,
        nombres,
        apellidos,
        password,
      }: {
        nombreDeUsuario: string
        email: string
        nombres: string
        apellidos: string
        password: string
      },
      context: { user: { role: string; id: any } },
    ) => {
      // Verificar si el usuario tiene permiso para crear nuevos usuarios
      if (!context.user || !['SUPER_ADMIN', 'ADMIN'].includes(context.user.role)) {
        throw new ForbiddenError('No autorizado')
      }

      // Verificar si el email o username ya están en uso
      const existingUser = await User.findOne({
        $or: [{ email }, { username: nombreDeUsuario }],
      })
      if (existingUser) throw new Error('El email o username ya está en uso')

      // Crear el nuevo usuario
      const newUser = new User({
        email,
        password,
        nombres,
        apellidos,
        username: nombreDeUsuario,
        role: 'USER',
        isActive: true,
        createdBy: context.user.id,
      })

      // Guardar el nuevo usuario en la base de datos
      await newUser.save()
      return newUser
    },

    deleteAccount: async (_: any, { username }: { username: string }) => {
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')

      const userId = user._id.toString()
      if (bots[userId]) {
        await bots[userId].logout()
        delete bots[userId]
      }

      await User.findOneAndDelete({ username: username.toLowerCase() })
      return true
    },

    sendMessage: async (
      _: any,
      {
        username,
        to,
        text,
        mediaUrl,
        mediaType,
        fileName,
      }: {
        username: string
        to: string
        text: string
        mediaUrl?: string
        mediaType?: 'image' | 'video' | 'audio'
        fileName?: string
      },
    ) => {
      // Buscar el usuario
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')

      // Verificar si el usuario está activo
      if (!user.isActive) {
        throw new Error('No se puede enviar el mensaje. El usuario está inactivo.')
      }

      // Buscar la sesión de WhatsApp para el usuario
      const userId = user._id.toString()
      const session = await WhatsAppSession.findOne({ userId: userId, isConnected: true })

      if (!session) {
        throw new Error('No se encontró una sesión activa de WhatsApp para este usuario')
      }

      // Inicializar el bot si no está ya inicializado
      if (!bots[userId]) {
        bots[userId] = new WhatsAppBot(userId)
        await bots[userId].initialize()
      }

      // Esperar a que el bot esté listo
      const isReady = await bots[userId].waitForReady(30000)
      if (!isReady) {
        await bots[userId].logout()
        delete bots[userId]
        throw new Error('Tiempo de espera agotado. El cliente de WhatsApp no está listo.')
      }

      try {
        let media: MessageMedia | undefined

        // Manejar el archivo multimedia si se proporciona
        if (mediaUrl && mediaType) {
          const response = await fetch(mediaUrl)
          const buffer = await response.arrayBuffer()
          const mimetype = response.headers.get('content-type') || ''

          let finalFileName = ''
          if (mediaType === 'image') {
            finalFileName = fileName || `Imagen_${Date.now()}.jpg`
          } else if (mediaType === 'video') {
            finalFileName = fileName || `Video_${Date.now()}.mp4`
          } else if (mediaType === 'audio') {
            finalFileName = fileName || `Audio_${Date.now()}.mp3`
          } else if (mediaType === 'document') {
            finalFileName = fileName || `Documento_${Date.now()}.pdf`
          }

          media = new MessageMedia(
            mimetype,
            Buffer.from(buffer).toString('base64'),
            finalFileName,
          )
        }

        const footer = '> Powered by INTEGRATE Soluciones Informáticas'
        await bots[userId].sendMessage(to, text, { media, footer })
        return true
      } catch (error) {
        console.error(`Error al enviar mensaje: ${(error as Error).message}`)
        throw new Error('No se pudo enviar el mensaje. Por favor, intente nuevamente.')
      }
    },
    logout: async (_: any, { username }: { username: string }) => {
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')

      const userId = user._id.toString()
      if (bots[userId]) {
        try {
          await bots[userId].logout()
          delete bots[userId]
        } catch (error) {
          console.error(`Error al cerrar sesión para el usuario ${userId}:`, error)
          // Intenta cerrar la sesión de manera forzada
          await bots[userId].forceLogout()
          delete bots[userId]
        }
      } else {
        // Si no se encontró la instancia del bot, busca la sesión de WhatsApp en la base de datos
        const session = await WhatsAppSession.findOne({ userId: userId })
        if (session) {
          // Cierra la sesión de WhatsApp en la base de datos
          await session.updateOne({ isConnected: false })
        }
      }

      return true
    },

    forceReset: async (_: any, { username }: { username: string }) => {
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')

      const userId = user._id.toString()
      if (!bots[userId]) {
        bots[userId] = new WhatsAppBot(userId)
      }

      try {
        // await bots[userId].forceReset()
        return true
      } catch (error) {
        console.error(
          `Error al reiniciar el bot para el usuario ${username}: ${(error as Error).message}`,
        )
        throw new Error('No se pudo reiniciar el bot. Por favor, intente nuevamente.')
      }
    },

    regenerateToken: async (
      _: any,
      { userId }: { userId: mongoose.Types.ObjectId },
      context: { user: { role: string } },
    ) => {
      if (!context.user || context.user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenError('No autorizado')
      }

      const user = await User.findById(userId)
      if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        throw new Error('Usuario no encontrado o no autorizado para tener token')
      }

      user.token = uuidv4()
      await user.save()
      return user.token
    },

    deleteUser: async (
      _: any,
      { userId }: { userId: mongoose.Types.ObjectId },
      context: { user: { role: string } },
    ) => {
      if (!context.user) throw new AuthenticationError('No autenticado')

      const userToDelete = await User.findById(userId)
      if (!userToDelete) throw new Error('Usuario no encontrado')

      if (context.user.role === 'SUPER_ADMIN') {
        if (userToDelete.role === 'SUPER_ADMIN') {
          throw new ForbiddenError('No se puede eliminar a otro SUPER_ADMIN')
        }
      } else if (context.user.role === 'ADMIN') {
        if (userToDelete.role !== 'USER') {
          throw new ForbiddenError('No autorizado para eliminar este usuario')
        }
      } else {
        throw new ForbiddenError('No autorizado')
      }

      await User.findByIdAndDelete(userId)
      return true
    },
  },
}

const checkInactivity = async () => {
  for (const userId in bots) {
    try {
      const isInactive = await bots[userId].checkInactivity()
      if (isInactive) {
        delete bots[userId]
      }
    } catch (error) {
      console.error(
        `Error al verificar inactividad para el usuario ${userId}: ${(error as Error).message}`,
      )
    }
  }
}

setInterval(checkInactivity, 60 * 60 * 1000)

export default resolvers
