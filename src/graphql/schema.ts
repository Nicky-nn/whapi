import { gql } from 'apollo-server-express'

const typeDefs = gql`
  enum UserRole {
    SUPER_ADMIN
    ADMIN
    USER
  }

  type User {
    id: ID!
    username: String!
    whatsappConnected: Boolean!
    nombres: String!
    apellidos: String!
    email: String!
    role: UserRole!
    isActive: Boolean!
    token: String
  }

  type AuthPayload {
    token: String
    user: User
  }

  type Query {
    me: User
    listaUsuarios(role: UserRole): [User!]!
    adminPendientes: [User!]!
    getUser(username: String!): User
    getQRCode(username: String!): String
    needsQRCode(username: String!): Boolean
  }

  type Mutation {
    """
    Inicia sesión en la aplicación.
    Devuelve un token de autenticación y el usuario asociado.
    """
    login(username: String!, password: String!): AuthPayload
    registerAdmin(
      nombreDeUsuario: String!
      email: String!
      password: String!
      nombres: String!
      apellidos: String!
    ): User

    registerSuperAdmin(
      nombreDeUsuario: String!
      email: String!
      password: String!
      nombres: String!
      apellidos: String!
    ): User

    toggleUserStatus(userId: ID!): User

    """
    Activa un usuario administrador.
    Devuelve el usuario activado.
    """
    activarAdmin(username: String!): User
    """
    Crea un nuevo usuario en la base de datos.
    El nombre de usuario será convertido a minúsculas y debe ser único.
    """
    createUser(
      nombreDeUsuario: String!
      email: String!
      nombres: String!
      apellidos: String!
      password: String!
    ): User
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
    """
    Regenera el token de autenticación de un usuario.
    Devuelve el nuevo token.
    """
    regenerateToken(userId: ID!): String
    deleteUser(userId: ID!): Boolean
  }
`

export default typeDefs
