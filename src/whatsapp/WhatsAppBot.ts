import { Client, Message, MessageMedia, RemoteAuth } from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import { MongoStore } from 'wwebjs-mongo'
import mongoose from 'mongoose'
import WhatsAppSession from '../models/WhatsAppSession'

class WhatsAppBot {
  private client: Client
  private userId: string
  private qrCode: string | null = null
  private lastActivityTimestamp: number
  private isReady: boolean = false
  private initializationAttempts: number = 0
  private maxInitializationAttempts: number = 3

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

    this.client.on('disconnected', () => {
      console.log(`Cliente desconectado para el usuario: ${this.userId}`)
      this.isReady = false
      this.updateSessionStatus(false)
    })

    this.client.on('auth_failure', async () => {
      console.log(
        `Fallo de autenticación para el usuario: ${this.userId}. Cerrando sesión y eliminando datos.`,
      )
      await this.handleInvalidSession()
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
    while (this.initializationAttempts < this.maxInitializationAttempts) {
      try {
        console.log(
          `Intento de inicialización ${this.initializationAttempts + 1} para el usuario: ${this.userId}`,
        )
        const session = await WhatsAppSession.findOne({ userId: this.userId })
        if (session && session.isConnected) {
          console.log(`Sesión existente encontrada para el usuario: ${this.userId}`)
        } else {
          console.log(`No se encontró sesión válida para el usuario: ${this.userId}`)
        }
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
    this.isReady = false
    await this.updateSessionStatus(false)
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
        `Inactividad detectada para el usuario: ${this.userId}. Cerrando sesión y eliminando datos.`,
      )
      await this.logout()
      await this.deleteSessionData() // Eliminar los datos relacionados
      return true
    }
    return false
  }

  private async handleInvalidSession() {
    await this.logout()
    await this.deleteSessionData()
    // Aquí puedes añadir código adicional para eliminar datos locales si es necesario.
    console.log(
      `Sesión inválida para el usuario ${this.userId}. Todos los datos han sido eliminados.`,
    )
  }

  private async deleteSessionData() {
    // Elimina la sesión de la base de datos
    await WhatsAppSession.findOneAndDelete({ userId: this.userId })
    console.log(`Datos del usuario ${this.userId} eliminados de la base de datos.`)
    // Aquí puedes añadir código adicional para eliminar datos locales si es necesario.
  }
  // Agrega este método a la clase WhatsAppBot
  public async forceLogout() {
    try {
      await this.client.destroy()
    } catch (error) {
      console.error(
        `Error al cerrar sesión de forma forzada para el usuario ${this.userId}:`,
        error,
      )
    } finally {
      this.isReady = false
      await this.updateSessionStatus(false)
      console.log(`Sesión cerrada de forma forzada para el usuario: ${this.userId}`)
    }
  }
}

export default WhatsAppBot
