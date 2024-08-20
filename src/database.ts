import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import User from './models/User'

interface Database {
  name: string
}

const connectDB = async (): Promise<void> => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI as string)

    // Verificar la conexión
    const db = mongoose.connection
    db.once('open', () => {
      console.info('Conexión establecida con MongoDB')
    })

    // Verificar si la base de datos está disponible
    const dbName = (process.env.MONGODB_URI as string).split('/').pop()
    const admin = db.db?.admin()

    if (!admin) {
      throw new Error('No se pudo obtener el administrador de la base de datos.')
    }

    const { databases } = await admin.listDatabases()

    const dbExists = databases.some((database: Database) => database.name === dbName)
    if (!dbExists) {
      console.info(
        `La base de datos "${dbName}" está disponible. Se creará automáticamente al insertar datos.`,
      )
    } else {
      console.info(`La base de datos "${dbName}" ya existe.`)
    }

    // Crear SuperAdmin por defecto si no existe
    await createDefaultSuperAdmin()
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error)
    process.exit(1)
  }
}

const createDefaultSuperAdmin = async () => {
  try {
    const existingSuperAdmin = await User.findOne({ role: 'SUPER_ADMIN' })
    if (existingSuperAdmin) {
      console.info('Ya existe un SuperAdmin en la base de datos.')
      return
    }

    const defaultSuperAdmin = new User({
      username: 'superadmin',
      email: 'superadmin@example.com',
      password: "superadmin",
      nombres: 'Super',
      apellidos: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      whatsappConnected: false,
      token: uuidv4(),
    })

    await defaultSuperAdmin.save()
    console.info('SuperAdmin por defecto creado exitosamente.')
    console.info('Token:', defaultSuperAdmin.token)
  } catch (error) {
    console.error('Error al crear el SuperAdmin por defecto:', error)
  }
}

export default connectDB
