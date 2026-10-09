import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },

    mobileNumber: {
      type: String,
      sparse: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },

    pendingName: {
      type: String,
      select: false,
    },

    pendingMobileNumber: {
      type: String,
      select: false,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    otpHash: {
      type: String,
      select: false,
    },

    otpExpiresAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
)

userSchema.set('autoIndex', false)

export default mongoose.model('User', userSchema)