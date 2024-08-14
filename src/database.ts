import mongoose from 'mongoose'

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
    const admin = db.db.admin()
    const { databases } = await admin.listDatabases()

    const dbExists = databases.some((database) => database.name === dbName)
    if (!dbExists) {
      console.log(
        `La base de datos "${dbName}" no existe y se creará automáticamente al insertar documentos.`,
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
