// models/WhatsAppSession.ts
import mongoose from 'mongoose'

const whatsAppSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  sessionData: { type: String, default: null },
  isConnected: { type: Boolean, default: false },
})

const WhatsAppSession = mongoose.model('WhatsAppSession', whatsAppSessionSchema)

export default WhatsAppSession
