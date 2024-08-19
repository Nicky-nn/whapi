// resolvers.ts
import { MessageMedia } from 'whatsapp-web.js'
import User from '../models/User'
import WhatsAppSession from '../models/WhatsAppSession'
import WhatsAppBot from '../whatsapp/WhatsAppBot'
import mongoose from 'mongoose'

const bots: { [key: string]: WhatsAppBot } = {}

const resolvers = {
  Query: {
    getUser: async (_: any, { username }: { username: string }) => {
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')
      const whatsAppSession = await WhatsAppSession.findOne({ userId: user._id })
      return {
        id: user._id.toString(),
        username: user.username,
        whatsappConnected: whatsAppSession?.isConnected || false,
      }
    },
    getQRCode: async (_: any, { username }: { username: string }) => {
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')

      const userId = user._id.toString()
      const session = await WhatsAppSession.findOne({ userId })

      if (session && session.isConnected) {
        throw new Error('El usuario ya está logueado en WhatsApp')
      }

      if (!bots[userId]) {
        bots[userId] = new WhatsAppBot(userId)
        await bots[userId].initialize()
      }
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
    createUser: async (_: any, { username }: { username: string }) => {
      const lowerUsername = username.toLowerCase()
      const existingUser = await User.findOne({ username: lowerUsername })
      if (existingUser) {
        throw new Error('El nombre de usuario ya está registrado.')
      }

      const user = new User({ username: lowerUsername })
      await user.save()

      return {
        id: user._id.toString(),
        username: user.username,
        whatsappConnected: false,
      }
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
        mediaType?: 'image' | 'video' | 'document'
        fileName?: string
      },
    ) => {
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) throw new Error('Usuario no encontrado')

      const userId = user._id.toString()
      const session = await WhatsAppSession.findOne({ userId: userId, isConnected: true })

      if (!session) {
        throw new Error('No se encontró una sesión activa de WhatsApp para este usuario')
      }

      if (!bots[userId]) {
        bots[userId] = new WhatsAppBot(userId)
        await bots[userId].initialize()
      }

      const isReady = await bots[userId].waitForReady(30000)
      if (!isReady) {
        await bots[userId].logout()
        delete bots[userId]
        throw new Error('Tiempo de espera agotado. El cliente de WhatsApp no está listo.')
      }

      try {
        let media: MessageMedia | undefined

        if (mediaUrl && mediaType) {
          const response = await fetch(mediaUrl)
          const buffer = await response.arrayBuffer()
          const mimetype = response.headers.get('content-type') || ''

          const finalFileName =
            mediaType === 'document'
              ? fileName || `Documento_${Date.now()}.pdf`
              : `${mediaType}_${Date.now()}`

          media = new MessageMedia(
            mimetype,
            Buffer.from(buffer).toString('base64'),
            finalFileName,
          )
        }

        const footer = '> Powered by Integrate Soluciones Informáticas'

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
        await bots[userId].logout()
        delete bots[userId]
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
        await bots[userId].forceReset()
        return true
      } catch (error) {
        console.error(
          `Error al reiniciar el bot para el usuario ${username}: ${(error as Error).message}`,
        )
        throw new Error('No se pudo reiniciar el bot. Por favor, intente nuevamente.')
      }
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
