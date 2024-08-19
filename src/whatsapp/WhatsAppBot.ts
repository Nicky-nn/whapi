import { Client, Message, MessageMedia, RemoteAuth } from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import { MongoStore } from 'wwebjs-mongo'
import mongoose from 'mongoose'
import WhatsAppSession from '../models/WhatsAppSession'
import fs from 'fs/promises'
import path from 'path'

class WhatsAppBot {
  private client: Client
  private userId: string
  private qrCode: string | null = null
  private lastActivityTimestamp: number
  private isReady: boolean = false
  private initializationAttempts: number = 0
  private maxInitializationAttempts: number = 3
  private sessionClosedTimestamp: number | null = null
  private static readonly SESSION_COOLDOWN = 60000 // 1 minuto en milisegundos

  constructor(userId: string) {
    this.userId = userId
    this.lastActivityTimestamp = Date.now()
    console.log(`Inicializando WhatsAppBot para el usuario: ${userId}`)

    const store = new MongoStore({ mongoose: mongoose })

    this.client = new Client({
      authStrategy: new RemoteAuth({
        store: store,
        backupSyncIntervalMs: 300000,
        clientId: userId,
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    })

    this.setupEventListeners()
  }

  private setupEventListeners() {
    this.client.on('qr', (qr) => {
      if (!this.isReady) {
        this.qrCode = qr
        qrcode.generate(qr, { small: true })
        console.log(`Código QR generado para el usuario: ${this.userId}`)
      }
    })

    this.client.on('ready', () => {
      console.log(`Conexión exitosa para el usuario: ${this.userId}`)
      this.isReady = true
      this.updateSessionStatus(true)
    })

    this.client.on('disconnected', async (reason) => {
      console.log(
        `Cliente desconectado para el usuario: ${this.userId}. Razón: ${reason}`,
      )
      await this.handleSessionClosure()
    })

    this.client.on('auth_failure', async () => {
      console.log(`Fallo de autenticación detectado para el usuario: ${this.userId}`)
      await this.handleSessionClosure()
    })

    this.client.on('message', (message: Message) => {
      this.lastActivityTimestamp = Date.now()
      console.log(`Mensaje recibido para el usuario ${this.userId}: ${message.body}`)
      if (message.body === 'hola mundo') {
        this.client.sendMessage(
          message.from,
          'Hola soy un bot, mi creador está ocupado ayudando a Gohan a salvar la tierra',
        )
      }
    })
  }

  public async initialize() {
    if (!this.canRequestQR()) {
      console.log(
        `El usuario ${this.userId} debe esperar antes de inicializar una nueva sesión`,
      )
      return
    }

    while (this.initializationAttempts < this.maxInitializationAttempts) {
      try {
        console.log(
          `Intento de inicialización ${this.initializationAttempts + 1} para el usuario: ${this.userId}`,
        )
        await this.deleteSessionFiles() // Eliminar archivos de sesión antes de inicializar
        await this.removeSessionFromDB() // Eliminar sesión de la base de datos antes de inicializar
        await this.client.initialize()
        console.log(`Cliente inicializado con éxito para el usuario: ${this.userId}`)
        return
      } catch (error) {
        console.error(
          `Error al inicializar el cliente para el usuario ${this.userId}:`,
          error,
        )
        this.initializationAttempts++
        if (this.initializationAttempts >= this.maxInitializationAttempts) {
          throw new Error(
            `No se pudo inicializar el cliente después de ${this.maxInitializationAttempts} intentos`,
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 5000)) // Esperar 5 segundos antes de reintentar
      }
    }
  }

  public async waitForReady(timeout: number = 60000): Promise<boolean> {
    const startTime = Date.now()
    while (!this.isReady) {
      if (Date.now() - startTime > timeout) {
        console.log(`Tiempo de espera agotado para el usuario: ${this.userId}`)
        return false
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    return true
  }

  public getQRCode(): string | null {
    if (!this.canRequestQR()) {
      console.log(
        `El usuario ${this.userId} debe esperar antes de solicitar un nuevo código QR`,
      )
      return null
    }
    return this.qrCode
  }

  public async sendMessage(
    to: string,
    text: string,
    options?: {
      media?: MessageMedia
      footer?: string
    },
  ) {
    if (!this.isReady) {
      throw new Error('El cliente de WhatsApp no está listo. Por favor, espere.')
    }
    this.lastActivityTimestamp = Date.now()
    console.log(`Enviando mensaje para el usuario ${this.userId} a ${to}: ${text}`)

    try {
      let message

      if (options?.media) {
        const caption = options.footer ? `${text}\n\n${options.footer}` : text
        message = await this.client.sendMessage(`${to}@c.us`, options.media, { caption })
      } else if (options?.footer) {
        message = await this.client.sendMessage(
          `${to}@c.us`,
          `${text}\n\n${options.footer}`,
        )
      } else {
        message = await this.client.sendMessage(`${to}@c.us`, text)
      }

      console.log(`Mensaje enviado con éxito para el usuario ${this.userId}`)
      return message
    } catch (error) {
      console.error(`Error al enviar mensaje para el usuario ${this.userId}:`, error)
      throw new Error('No se pudo enviar el mensaje. Por favor, intente nuevamente.')
    }
  }

  public async logout() {
    await this.client.logout()
    await this.handleSessionClosure()
    console.log(`Sesión cerrada para el usuario: ${this.userId}`)
  }

  private async updateSessionStatus(isConnected: boolean) {
    await WhatsAppSession.findOneAndUpdate(
      { userId: this.userId },
      { isConnected },
      { upsert: true, new: true },
    )
  }

  public async checkInactivity() {
    const inactivityPeriod = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    if (Date.now() - this.lastActivityTimestamp > inactivityPeriod) {
      console.log(
        `Inactividad detectada para el usuario: ${this.userId}. Cerrando sesión.`,
      )
      await this.logout()
      return true
    }
    return false
  }

  private async handleSessionClosure() {
    console.log(`Manejando cierre de sesión para el usuario: ${this.userId}`)
    this.sessionClosedTimestamp = Date.now()
    this.isReady = false
    this.qrCode = null
    await this.deleteSessionFiles()
    await this.removeSessionFromDB()
    await this.updateSessionStatus(false)
  }

  private async deleteSessionFiles() {
    try {
      const sessionDir = path.join(process.cwd(), '.wwebjs_auth', this.userId)
      await fs.rm(sessionDir, { recursive: true, force: true })
      console.log(`Archivos de sesión eliminados para el usuario: ${this.userId}`)
    } catch (error) {
      console.error(
        `Error al eliminar archivos de sesión para el usuario ${this.userId}:`,
        error,
      )
    }
  }

  private async removeSessionFromDB() {
    try {
      await WhatsAppSession.findOneAndDelete({ userId: this.userId })
      console.log(`Sesión eliminada de la base de datos para el usuario: ${this.userId}`)
    } catch (error) {
      console.error(
        `Error al eliminar sesión de la base de datos para el usuario ${this.userId}:`,
        error,
      )
    }
  }

  public canRequestQR(): boolean {
    if (this.sessionClosedTimestamp === null) {
      return true
    }
    const timeSinceClosure = Date.now() - this.sessionClosedTimestamp
    return timeSinceClosure >= WhatsAppBot.SESSION_COOLDOWN
  }

  public async forceReset() {
    await this.handleSessionClosure()
    this.sessionClosedTimestamp = null // Permitir una nueva inicialización inmediata
    this.initializationAttempts = 0 // Reiniciar el contador de intentos
    await this.initialize()
  }
}

export default WhatsAppBot
