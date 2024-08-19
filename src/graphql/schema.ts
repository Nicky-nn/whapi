import { gql } from 'apollo-server-express'

const typeDefs = gql`
  type User {
    id: ID!
    username: String!
    whatsappConnected: Boolean!
  }

  type Query {
    getUser(username: String!): User
    getQRCode(username: String!): String
    needsQRCode(username: String!): Boolean
  }

  type Mutation {
    """
    Crea un nuevo usuario en la base de datos.
    El nombre de usuario será convertido a minúsculas y debe ser único.
    """
    createUser(username: String!): User
    """
    Elimina un usuario de la base de datos y desconecta de WhatsApp."
    """
    deleteAccount(username: String!): Boolean
    """
    Envía un mensaje a un contacto de WhatsApp.
    username: Nombre de usuario del remitente.
    to: Número de teléfono del destinatario.
    text: Texto del mensaje.
    mediaUrl: URL de la imagen o video a enviar.
    mediaType: Tipo de medio a enviar (image, video, documento o audio).
    """
    sendMessage(
      username: String!
      to: String!
      text: String!
      mediaUrl: String
      mediaType: String
      fileName: String
    ): Boolean
    logout(username: String!): Boolean
    """
    Fuerza el reinicio del bot de WhatsApp.
    Devuelve un mensaje indicando el éxito o el fallo de la operación.
    """
    forceReset(username: String!): String
  }
`

export default typeDefs
