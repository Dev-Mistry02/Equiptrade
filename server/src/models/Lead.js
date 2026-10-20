import mongoose from 'mongoose'
import { randomBytes } from 'node:crypto'

const leadSchema = new mongoose.Schema({
  leadId: {
    type: String,
    unique: true,
    default: () => `ETI-${randomBytes(6).toString('hex').toUpperCase()}`,
  },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  company: { type: String, trim: true, maxlength: 160, default: '' },
  equipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', index: true },
  equipmentName: { type: String, trim: true, maxlength: 200, default: '' },
  sellerEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  sellerMobileNumber: { type: String, trim: true, maxlength: 30, default: '' },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'In Progress', 'Converted', 'Closed'],
    default: 'New',
    index: true,
  },
  internalNotes: { type: String, trim: true, maxlength: 10000, default: '' },
  idempotencyKey: { type: String, unique: true, sparse: true },
}, { timestamps: true })

leadSchema.index({ createdAt: -1 })

export default mongoose.model('Lead', leadSchema)
