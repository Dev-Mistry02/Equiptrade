import { Router } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { sendOtpEmail } from '../services/mailer.js'
import { createAdminToken } from '../middleware/adminAuth.js'
import Admin from '../models/Admin.js'
import { env } from '../config/env.js'

const router = Router()
const otpStore = new Map()

const hashOtp = otp =>
  crypto.createHash('sha256').update(otp).digest('hex')

router.post('/admin-login', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const password = String(req.body.password || '')

  try {
    const admin = await Admin.findOne({ name }).select('+password')

    if (!admin || admin.password !== password) {
      return res.status(401).json({
        message: 'Invalid admin name or password.',
      })
    }

    res.json({
      token: createAdminToken(),
      expiresIn: 30 * 24 * 60 * 60 * 1000,
    })
  } catch (error) {
    res.status(500).json({
      message: error.message,
    })
  }
})

router.post('/send-otp', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const mobileNumber = String(req.body.mobileNumber || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()

    if (!name || !mobileNumber || !email) {
      return res.status(400).json({
        message: 'Name, mobile number and email are required.',
      })
    }

    const otp = String(
      crypto.randomInt(100000, 1000000)
    )

    const expiresAt = Date.now() + 10 * 60 * 1000

    otpStore.set(email, {
      otp,
      expiresAt,
      name,
      mobileNumber,
    })

    await User.findOneAndUpdate(
      { mobileNumber },
      {
        name,
        email,
        verified: false,
        otpHash: hashOtp(otp),
        otpExpiresAt: new Date(expiresAt),
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
      }
    )

    await sendOtpEmail(email, otp)

    res.json({
      message: 'OTP sent to your email.',
    })
  } catch (error) {
    res.status(500).json({
      message: error.message,
    })
  }
})

router.post('/verify-otp', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase()

    const otp = String(req.body.otp || '').trim()

    const memoryRecord = otpStore.get(email)

    const storedUser = await User.findOne({ email })
      .select('+otpHash +otpExpiresAt')

    const record =
      memoryRecord ||
      (storedUser?.otpHash
        ? {
            name: storedUser.name,
            mobileNumber: storedUser.mobileNumber,
            otpHash: storedUser.otpHash,
            expiresAt: storedUser.otpExpiresAt?.getTime(),
          }
        : null)

    const validOtp =
      record &&
      record.expiresAt >= Date.now() &&
      (
        record.otp
          ? record.otp === otp
          : record.otpHash === hashOtp(otp)
      )

    if (!validOtp) {
      return res.status(400).json({
        message: 'Invalid or expired OTP.',
      })
    }

    const user = await User.findOneAndUpdate(
      {
        mobileNumber: record.mobileNumber,
      },
      {
        name: record.name,
        email,
        verified: true,
        $unset: {
          otpHash: 1,
          otpExpiresAt: 1,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    )

    otpStore.delete(email)

    const token = jwt.sign(
      {
        id: String(user._id),
        userId: String(user._id),
        email: user.email,
      },
      env.jwtSecret,
      {
        expiresIn: '30d',
      }
    )

    const expiresIn = 30 * 24 * 60 * 60 * 1000

    res.json({
      token,
      expiresIn,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        verified: user.verified,
      },
    })
  } catch (error) {
    res.status(500).json({
      message: error.message,
    })
  }
})

export default router