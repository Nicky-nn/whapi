import 'dotenv/config'
import express from 'express'
import { ApolloServer } from 'apollo-server-express'
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core'
import connectDB from './database'
import typeDefs from './graphql/schema'
import resolvers from './graphql/resolvers'
import { context } from './middleware/auth'

// Función para imprimir arte ASCII con colores
const printWelcomeMessage = () => {
  const asciiArt = `
██╗    ██╗██╗  ██╗ █████╗ ██████╗ ██╗
██║    ██║██║  ██║██╔══██╗██╔══██╗██║
██║ █╗ ██║███████║███████║██████╔╝██║
██║███╗██║██╔══██║██╔══██║██╔═══╝ ██║
╚███╔███╔╝██║  ██║██║  ██║██║     ██║
 ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝

 by Nick Russell
  `

  // Códigos de color ANSI
  const blue = '\x1b[34m'
  const green = '\x1b[32m'
  const reset = '\x1b[0m'

  console.log(`${blue}${asciiArt}${reset}`)
  console.log(`${green}Servidor GraphQL corriendo...${reset}`)
}

const startServer = async (): Promise<void> => {
  const app = express()

  // Conectar a la base de datos y crear SuperAdmin
  await connectDB()

  // Crear el servidor Apollo
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context, // Pasar el contexto de autenticación al servidor Apollo
    introspection: true,
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
  })

  // Iniciar el servidor Apollo
  await server.start()
  server.applyMiddleware({ app, path: '/whapi' })

  const PORT = process.env.PORT || 4000
  app.listen(PORT, () => {
    printWelcomeMessage()
    console.log(`🚀 Servidor corriendo en puerto ${PORT}${server.graphqlPath}`)
  })
}

startServer()
