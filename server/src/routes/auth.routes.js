import { Router } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { createAdminToken } from '../middleware/adminAuth.js'
import Admin from '../models/Admin.js'
import { env } from '../config/env.js'
import { sendOtpEmail } from '../services/mailer.js'

const router = Router()
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: 'Enter a valid email address.',
      })
    }

    let user = await User.findOne({
      $or: [{ email }, { mobileNumber }],
    }).select('+otpHash +otpExpiresAt')

    if (user && (user.email !== email || user.mobileNumber !== mobileNumber)) {
      return res.status(409).json({
        message: 'That email or mobile number is already associated with another account.',
      })
    }

    if (!user) {
      user = new User({ name, mobileNumber, email })
    }

    const otp = String(crypto.randomInt(100000, 1000000))
    user.otpHash = hashOtp(otp)
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await user.save()

    await sendOtpEmail(email, name, otp)

    res.json({
      message: 'Verification code sent to your email.',
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'That email or mobile number is already associated with another account.',
      })
    }

    const code = error?.code
    const responseCode = error?.responseCode
    console.error('Failed to send account verification code:', {
      code,
      responseCode,
      command: error?.command,
      message: error?.message,
    })

    const isConfigurationError =
      error?.message?.startsWith('SMTP_') ||
      error?.message?.startsWith('MAIL_FROM')
    const isAuthenticationError =
      code === 'EAUTH' || responseCode === 535
    const isDnsError = code === 'ENOTFOUND'
    const isConnectionError =
      code === 'ECONNECTION' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT'
    const errorMessage = isConfigurationError
      ? `Email configuration error: ${error.message}`
      : isAuthenticationError
        ? 'Gmail rejected SMTP authentication. Check that 2-Step Verification is enabled and SMTP_PASSWORD is a current Google App Password.'
        : isDnsError
          ? 'Could not resolve the SMTP server hostname. Check SMTP_HOST and your internet/DNS connection.'
          : isConnectionError
            ? 'Could not connect to the SMTP server. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE and whether your network allows SMTP connections.'
            : `Email delivery failed${code ? ` (${code})` : ''}. Check the server logs and SMTP provider settings.`

    res.status(isConfigurationError ? 503 : 502).json({
      message: errorMessage,
    })
  }
})

router.post('/verify-otp', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const otp = String(req.body.otp || '').trim()

    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: 'Enter the email address and 6-digit verification code.',
      })
    }

    const user = await User.findOne({ email })
      .select('+otpHash +otpExpiresAt')

    if (
      !user?.otpHash ||
      !user.otpExpiresAt ||
      user.otpExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({
        message: 'Invalid or expired verification code. Request a new code.',
      })
    }

    const submittedHash = Buffer.from(hashOtp(otp), 'hex')
    const storedHash = Buffer.from(user.otpHash, 'hex')

    if (
      submittedHash.length !== storedHash.length ||
      !crypto.timingSafeEqual(submittedHash, storedHash)
    ) {
      return res.status(400).json({
        message: 'Invalid or expired verification code. Request a new code.',
      })
    }

    user.verified = true
    user.otpHash = undefined
    user.otpExpiresAt = undefined
    await user.save()

    const token = jwt.sign(
      {
        id: String(user._id),
        userId: String(user._id),
        email: user.email,
      },
      env.jwtSecret,
      { expiresIn: '30d' }
    )

    res.json({
      token,
      expiresIn: 30 * 24 * 60 * 60 * 1000,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        verified: user.verified,
      },
    })
  } catch (error) {
    console.error('Failed to verify user account:', error)
    res.status(500).json({
      message: 'Unable to verify your account. Please try again.',
    })
  }
})

export default router
