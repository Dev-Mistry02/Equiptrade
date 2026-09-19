import mongoose from 'mongoose'

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, select: false }
}, { timestamps: true })

export default mongoose.model('Admin', adminSchema)
