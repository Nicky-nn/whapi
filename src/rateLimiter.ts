import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

const attempts = new Map<string, number>()
const banTimes = new Map<string, number>()

const getRateLimitResetTime = (attemptCount: number): number => {
  if (attemptCount <= 7) return 0
  if (attemptCount <= 15) return 5 * 60 * 1000 // 5 minutos
  if (attemptCount <= 23) return 15 * 60 * 1000 // 15 minutos
  return 30 * 60 * 1000 // 30 minutos
}

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 8, // límite de 8 intentos por ventana
  message: 'Demasiados intentos de inicio de sesión, por favor intente más tarde.',
  keyGenerator: (req: Request) => req.ip || '', // Asegurarse de que nunca sea undefined
  handler: (req: Request, res: Response) => {
    const ip = req.ip || '' // Asegurarse de que nunca sea undefined
    const currentAttempts = (attempts.get(ip) || 0) + 1
    attempts.set(ip, currentAttempts)

    const banTime = getRateLimitResetTime(currentAttempts)
    if (banTime > 0) {
      banTimes.set(ip, Date.now() + banTime)
      res.status(429).json({
        error: `Demasiados intentos. Por favor, espere ${banTime / 60000} minutos antes de intentar nuevamente.`,
      })
    } else {
      res.status(429).json({
        error: 'Demasiados intentos de inicio de sesión, por favor intente más tarde.',
      })
    }
  },
  skip: (req: Request) => {
    const ip = req.ip || '' // Asegurarse de que nunca sea undefined
    const banUntil = banTimes.get(ip)
    if (banUntil && Date.now() < banUntil) {
      return false
    }
    return true
  },
})
