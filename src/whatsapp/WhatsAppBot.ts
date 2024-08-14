// WhatsAppBot.ts
import path from 'path'
import fs from 'fs'
import mongoose from 'mongoose'
import {
  Client,
  Message,
  MessageMedia,
  MessageSendOptions,
  RemoteAuth,
} from 'whatsapp-web.js'
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
      },
    })

    this.setupEventListeners()
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
  }

  public async initialize() {
    const session = await WhatsAppSession.findOne({ userId: this.userId })
    if (session && session.isConnected) {
      console.log(`Sesión existente encontrada para el usuario: ${this.userId}`)
      await this.client.initialize()
      return
    }
    await this.client.initialize()
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
        // Si hay media, enviar como media con o sin footer.
        const caption = options.footer ? `${text}\n\n${options.footer}` : text
        message = await this.client.sendMessage(`${to}@c.us`, options.media, { caption })
      } else if (options?.footer) {
        // Si solo hay footer, enviar texto con footer.
        message = await this.client.sendMessage(
          `${to}@c.us`,
          `${text}\n\n${options.footer}`,
        )
      } else {
        // Si no hay media ni footer, enviar texto simple.
        message = await this.client.sendMessage(`${to}@c.us`, text)
      }

      return message
    } catch (error) {
      console.error(`Error al enviar mensaje: ${(error as Error).message}`)
      throw new Error('No se pudo enviar el mensaje. Por favor, intente nuevamente.')
    }
  }

  public async logout() {
    await this.client.logout()
    this.isReady = false
    await this.updateSessionStatus(false)
    await WhatsAppSession.findOneAndDelete({ userId: this.userId })
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
