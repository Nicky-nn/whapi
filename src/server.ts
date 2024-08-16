import 'dotenv/config'
import express from 'express'
import { ApolloServer } from 'apollo-server-express'
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core'
import connectDB from './database'
import typeDefs from './graphql/schema'
import resolvers from './graphql/resolvers'

const startServer = async (): Promise<void> => {
  const app = express()

  // Conectar a la base de datos
  await connectDB()

  // Crear el servidor Apollo
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true, // Habilitar introspección para desarrollo
    plugins: [
      ApolloServerPluginLandingPageGraphQLPlayground(), // Esto reemplaza 'playground: true'
    ],
  })

  // Iniciar el servidor Apollo
  await server.start()

  // Aplicar el middleware de Apollo Server
  server.applyMiddleware({ app, path: '/whapi' })

  const PORT = process.env.PORT || 4000
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}${server.graphqlPath}`)
  })
}

// Ejecutar la función para iniciar el servidor
startServer()
