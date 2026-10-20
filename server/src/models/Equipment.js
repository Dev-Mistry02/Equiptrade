import mongoose from 'mongoose'

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  brand: String,
  model: String,
  oemPartNumber: { type: String, trim: true },
  year: Number,
  condition: String,
  inventoryCondition: {
    type: String,
    enum: ['Surplus / Unused', 'Excess Inventory', 'Dead Stock', 'Used Equipment'],
  },
  listingType: {
    type: String,
    enum: ['sale', 'rental'],
    default: 'sale',
  },
  usage: String,
  price: Number,
  rentalTimeUnit: {
    type: String,
    enum: ['Hour', 'Day', 'Week', 'Month'],
    required: function () {
      return this.listingType === 'rental'
    },
  },
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
  isActive: { type: Boolean, default: true },
  isQualityHold: { type: Boolean, default: false },
  isQualityReviewed: { type: Boolean, default: false },
  qualityReviewReason: { type: String, trim: true },
  status: { type: String, enum: ['pending', 'under_review', 'approved', 'rejected', 'changes_required', 'published'], default: 'pending' },
  verificationStatus: { type: String, default: 'Pending Verification' }
}, { timestamps: true })

equipmentSchema.index({ status: 1, category: 1, createdAt: -1 })
equipmentSchema.index({ status: 1, inventoryCondition: 1, createdAt: -1 })
equipmentSchema.index({ status: 1, condition: 1, createdAt: -1 })
equipmentSchema.index({ status: 1, price: 1, createdAt: -1 })
equipmentSchema.index({ seller: 1, createdAt: -1 })
equipmentSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('Equipment', equipmentSchema)
