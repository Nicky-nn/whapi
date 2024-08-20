import { AuthenticationError } from 'apollo-server-express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import User from '../models/User'

import { Request } from 'express'

export const context = async ({ req }: { req: Request }) => {
  const authHeader = req.headers.authorization || ''
  if (!authHeader) {
    return { req }
  }

  try {
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as JwtPayload
    const user = await User.findById(decoded.userId)

    if (!user || !user.isActive) {
      throw new AuthenticationError('Usuario no encontrado o inactivo')
    }

    return { user, req }
  } catch (error) {
    throw new AuthenticationError('Token inválido')
  }
}
