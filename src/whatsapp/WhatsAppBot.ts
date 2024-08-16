import path from 'path'
import fs from 'fs'
import mongoose from 'mongoose'
import { Client, Message, MessageMedia, RemoteAuth } from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import { MongoStore } from 'wwebjs-mongo'
import WhatsAppSession from '../models/WhatsAppSession'

class WhatsAppBot {
  private client: Client
  private userId: string
  private qrCode: string | null = null
  private lastActivityTimestamp: number
  private isReady: boolean = false

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

    process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
      if (this.isReady) {
        await this.logout()
      }
    })
  }

  private setupEventListeners() {
    this.client.on('qr', (qr) => {
      this.qrCode = qr
      qrcode.generate(qr, { small: true })
      console.log(`Código QR generado para el usuario: ${this.userId}`)
    })

    this.client.on('ready', async () => {
      console.log(`Conexión exitosa para el usuario: ${this.userId}`)
      this.isReady = true
      await this.updateSessionStatus(true)
    })

    this.client.on('disconnected', async () => {
      console.log(`Cliente desconectado para el usuario: ${this.userId}`)
      this.isReady = false
      await this.updateSessionStatus(false)
    })

    this.client.on('message', (message) => {
      this.lastActivityTimestamp = Date.now()
      console.log(`Mensaje recibido para el usuario ${this.userId}: ${message.body}`)
      if (message.body === 'hola mundo') {
        this.client.sendMessage(
          message.from,
          'Hola soy un bot, mi creador está ocupado ayudando a Gohan a salvar la tierra',
        )
      }
    })

    this.client.on('auth_failure', async () => {
      console.error(`Error de autenticación para el usuario: ${this.userId}`)
      if (this.isReady) {
        await this.logout()
      }
    })
  }

  public async initialize() {
    try {
      const session = await WhatsAppSession.findOne({ userId: this.userId })

      if (session && session.isConnected) {
        console.log(`Sesión existente encontrada para el usuario: ${this.userId}`)
        await this.client.initialize()

        const isSessionValid = await this.verifySession()

        if (!isSessionValid) {
          console.log(`Sesión inválida detectada para el usuario: ${this.userId}`)
          await this.handleInvalidSession()
          return
        }
      } else {
        console.log(`Iniciando nueva sesión para el usuario: ${this.userId}`)
        await this.client.initialize()
      }
    } catch (error) {
      console.error(`Error al inicializar el cliente: ${(error as Error).message}`)
      await this.handleSessionError()
    }
  }

  private async verifySession(): Promise<boolean> {
    try {
      const state = await this.client.getState()
      return state === 'CONNECTED'
    } catch (error) {
      console.error(`Error al verificar la sesión: ${(error as Error).message}`)
      return false
    }
  }

  private async handleInvalidSession() {
    console.log(`Manejando sesión inválida para el usuario: ${this.userId}`)
    await this.logout()
    await this.clearSession()
    await this.client.initialize()
  }

  private async clearSession() {
    try {
      await WhatsAppSession.findOneAndDelete({ userId: this.userId })
      console.log(`Sesión eliminada para el usuario: ${this.userId}`)
    } catch (error) {
      console.error(`Error al eliminar la sesión: ${(error as Error).message}`)
    }
  }

  private async handleSessionError() {
    console.log(`Intentando eliminar la sesión y la cuenta del usuario: ${this.userId}`)
    try {
      await this.logout()
      await WhatsAppSession.findOneAndDelete({ userId: this.userId })
      console.log(`Sesión y cuenta eliminadas para el usuario: ${this.userId}`)
    } catch (error) {
      console.error(`Error al manejar el error de sesión: ${(error as Error).message}`)
    }
  }

  public async waitForReady(timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now()
    while (!this.isReady) {
      if (Date.now() - startTime > timeout) {
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

      return message
    } catch (error) {
      console.error(`Error al enviar mensaje: ${(error as Error).message}`)
      throw new Error('No se pudo enviar el mensaje. Por favor, intente nuevamente.')
    }
  }

  public async logout() {
    try {
      await this.client.logout()
      this.isReady = false
      await this.updateSessionStatus(false)
      await WhatsAppSession.findOneAndDelete({ userId: this.userId })
      console.log(`Sesión de WhatsApp cerrada para el usuario: ${this.userId}`)
    } catch (error: any) {
      console.error(`Error al cerrar sesión en WhatsApp: ${error?.message}`)
      throw new Error('No se pudo cerrar la sesión de WhatsApp correctamente.')
    }
  }

  private async updateSessionStatus(isConnected: boolean) {
    await WhatsAppSession.findOneAndUpdate(
      { userId: this.userId },
      {
        isConnected,
        sessionData: isConnected ? 'connected' : null,
      },
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
}

export default WhatsAppBot
