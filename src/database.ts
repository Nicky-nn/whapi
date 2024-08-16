import mongoose from 'mongoose'

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
      console.log('Conexión establecida con MongoDB')
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
      console.log(
        `La base de datos "${dbName}" está disponible. Se creará automáticamente al insertar datos.`
      )
    } else {
      console.log(`La base de datos "${dbName}" ya existe.`)
    }
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error)
    process.exit(1)
  }
}

export default connectDB
