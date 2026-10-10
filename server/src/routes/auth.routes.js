
import { Router } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import {
  createAdminToken,
  isValidAdminToken,
} from '../middleware/adminAuth.js'
import Admin from '../models/Admin.js'
import { env } from '../config/env.js'
import { sendOtpEmail } from '../services/mailer.js'
import {
  ADMIN_SESSION_COOKIE,
  clearSessionCookie,
  getRequestCookie,
  sessionCookieOptions,
  USER_SESSION_COOKIE,
} from '../middleware/sessionCookies.js'

const router = Router()

const OTP_DURATION_MS = 10 * 60 * 1000

const hashOtp = otp =>
  crypto.createHash('sha256').update(otp).digest('hex')

const normalizeEmail = email =>
  String(email || '').trim().toLowerCase()

const isValidEmail = email =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// Admin login
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

    res.cookie(ADMIN_SESSION_COOKIE, createAdminToken(), sessionCookieOptions)
    return res.json({ authenticated: true })
  } catch (error) {
    console.error('Admin login failed:', error.message)

    return res.status(500).json({
      message: 'Unable to log in. Please try again.',
    })
  }
})

router.get('/session', async (req, res) => {
  try {
    let user = null
    const userToken = getRequestCookie(req, USER_SESSION_COOKIE)

    if (userToken) {
      try {
        const decoded = jwt.verify(userToken, env.jwtSecret)
        const account = await User.findById(decoded.id)

        if (account?.verified) {
          user = {
            id: String(account._id),
            name: account.name,
            email: account.email,
            mobileNumber: account.mobileNumber,
            verified: account.verified,
          }
        } else {
          clearSessionCookie(res, USER_SESSION_COOKIE)
        }
      } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
          clearSessionCookie(res, USER_SESSION_COOKIE)
        } else {
          throw error
        }
      }
    }

    const adminToken = getRequestCookie(req, ADMIN_SESSION_COOKIE)
    const adminAuthenticated = isValidAdminToken(adminToken)

    if (adminToken && !adminAuthenticated) {
      clearSessionCookie(res, ADMIN_SESSION_COOKIE)
    }

    return res.set('Cache-Control', 'no-store').json({
      user,
      adminAuthenticated,
    })
  } catch (error) {
    console.error('Failed to restore authentication session:', error.message)
    return res.status(500).json({
      message: 'Unable to restore your session. Please try again.',
    })
  }
})

router.post('/logout', (_req, res) => {
  clearSessionCookie(res, USER_SESSION_COOKIE)
  return res.status(204).end()
})

router.post('/admin-logout', (_req, res) => {
  clearSessionCookie(res, ADMIN_SESSION_COOKIE)
  return res.status(204).end()
})

// Send email OTP
router.post('/send-otp', async (req, res) => {
  let user = null

  try {
    const name = String(req.body.name || '').trim()
    const mobileNumber = String(
      req.body.mobileNumber || ''
    ).trim()
    const email = normalizeEmail(req.body.email)

    if (!name || !mobileNumber || !email || !isValidEmail(email)) {
      return res.status(400).json({
        message: 'Enter your name, mobile number, and a valid email address.',
      })
    }

    user = await User.findOne({ email })
      .select('+otpHash +otpExpiresAt')

    if (!user) {
      user = new User({ name, mobileNumber, email })
    }

    const otp = String(
      crypto.randomInt(100000, 1000000)
    )

    const otpHash = hashOtp(otp)

    user.otpHash = otpHash
    user.otpExpiresAt = new Date(
      Date.now() + OTP_DURATION_MS
    )
    user.pendingName = name
    user.pendingMobileNumber = mobileNumber

    try {
      await user.save()
    } catch (error) {
      if (error.code !== 11000) {
        throw error
      }

      user = await User.findOne({ email })
        .select('+otpHash +otpExpiresAt')

      if (!user) {
        throw error
      }

      user.otpHash = otpHash
      user.otpExpiresAt = new Date(
        Date.now() + OTP_DURATION_MS
      )
      user.pendingName = name
      user.pendingMobileNumber = mobileNumber

      await user.save()
    }

    try {
      await sendOtpEmail(user.email, name, otp)
    } catch (mailError) {
      user.otpHash = undefined
      user.otpExpiresAt = undefined
      user.pendingName = undefined
      user.pendingMobileNumber = undefined
      try {
        await user.save()
      } catch (cleanupError) {
        console.error('Failed to clear undelivered OTP:', cleanupError.message)
      }

      throw mailError
    }

    return res.json({
      message: 'Verification code sent to your email.',
      email: user.email,
    })
  } catch (error) {
    console.error('Failed to send account verification code:', {
      code: error?.code,
      responseCode: error?.responseCode,
      command: error?.command,
      message: error?.message,
    })

    const code = error?.code
    const responseCode = error?.responseCode

    const isConfigurationError =
      error?.message?.startsWith('SMTP_') ||
      error?.message?.startsWith('MAIL_FROM')

    const isAuthenticationError =
      code === 'EAUTH' || responseCode === 535

    const isDnsError = code === 'ENOTFOUND'

    const isConnectionError = [
      'ECONNECTION',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ESOCKET',
    ].includes(code)

    let message =
      'Email delivery failed. Check the backend logs and email provider settings.'

    if (isConfigurationError) {
      message = `Email configuration error: ${error.message}`
    } else if (isAuthenticationError) {
      message =
        'Email provider rejected authentication. Check SMTP_USER and SMTP_PASSWORD.'
    } else if (isDnsError) {
      message =
        'Could not resolve the SMTP hostname. Check SMTP_HOST and the server network.'
    } else if (isConnectionError) {
      message =
        'Could not connect to the email server. Check SMTP_HOST, SMTP_PORT and SMTP_SECURE.'
    }

    return res.status(
      isConfigurationError ? 503 : 502
    ).json({ message })
  }
})

// Verify email OTP and create a 30-day session
router.post('/verify-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email)
    const otp = String(req.body.otp || '').trim()

    if (!email || !isValidEmail(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message:
          'Enter a valid email address and 6-digit verification code.',
      })
    }

    const user = await User.findOne({ email })
      .select('+otpHash +otpExpiresAt +pendingName +pendingMobileNumber')

    if (
      !user?.otpHash ||
      !user.otpExpiresAt ||
      user.otpExpiresAt.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        message:
          'Invalid or expired verification code. Request a new code.',
      })
    }

    const submittedHash = Buffer.from(hashOtp(otp), 'hex')
    const storedHash = Buffer.from(user.otpHash, 'hex')

    if (
      submittedHash.length !== storedHash.length ||
      !crypto.timingSafeEqual(submittedHash, storedHash)
    ) {
      return res.status(400).json({
        message:
          'Invalid or expired verification code. Request a new code.',
      })
    }

    // Consume the OTP after successful verification.
    user.name = user.pendingName || user.name
    user.mobileNumber =
      user.pendingMobileNumber || user.mobileNumber
    user.verified = true
    user.otpHash = undefined
    user.otpExpiresAt = undefined
    user.pendingName = undefined
    user.pendingMobileNumber = undefined

    await user.save()

    const secret = env.jwtSecret

    if (!secret) {
      console.error('JWT_SECRET is not configured.')

      return res.status(500).json({
        message: 'Authentication is not configured on the server.',
      })
    }

    const token = jwt.sign(
      {
        id: String(user._id),
        userId: String(user._id),
        email: user.email,
      },
      secret,
      { expiresIn: '30d' }
    )

    res.cookie(USER_SESSION_COOKIE, token, sessionCookieOptions)
    return res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        verified: user.verified,
      },
    })
  } catch (error) {
    console.error('Failed to verify user account:', error.message)

    return res.status(500).json({
      message: 'Unable to verify your account. Please try again.',
    })
  }
})

export default router
