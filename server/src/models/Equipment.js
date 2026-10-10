import mongoose from 'mongoose'

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  brand: String,
  model: String,
  year: Number,
  condition: String,
  listingType: {
    type: String,
    enum: ['sale', 'rental'],
    default: 'sale',
  },
  usage: String,
  price: Number,
  location: String,
  description: String,
  images: [{
    type: String,
    validate: {
      validator: value => /^https:\/\/res\.cloudinary\.com\/[^/\s]+\/image\/upload\/.+/.test(value),
      message: 'Images must be Cloudinary secure URLs.'
    }
  }],
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'under_review', 'approved', 'rejected', 'changes_required', 'published'], default: 'pending' },
  verificationStatus: { type: String, default: 'Pending Verification' }
}, { timestamps: true })

export default mongoose.model('Equipment', equipmentSchema)
