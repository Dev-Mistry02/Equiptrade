
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
  hashOtpForStore,
  reserveOtp,
  restoreOtp,
  verifyAndConsumeOtp,
} from '../services/otpStore.js'
import {
  ADMIN_SESSION_COOKIE,
  clearSessionCookie,
  getRequestCookie,
  sessionCookieOptions,
  USER_SESSION_COOKIE,
} from '../middleware/sessionCookies.js'

const router = Router()

const OTP_DURATION_MS = 10 * 60 * 1000
const OTP_RESEND_COOLDOWN_MS = 30 * 1000
const OTP_MAX_ATTEMPTS = 5

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
  try {
    const name = String(req.body.name || '').trim()
    const mobileNumber = String(
      req.body.mobileNumber || ''
    ).trim()
    const email = normalizeEmail(req.body.email)

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        message: 'Enter a valid email address.',
      })
    }

    let user = await User.findOne({ email })
    if (!user) {
      if (!name || !mobileNumber) {
        return res.status(400).json({
          message: 'Enter your name and mobile number to create an account.',
        })
      }

      user = new User({ name, mobileNumber, email })
      try {
        await user.save()
      } catch (error) {
        if (error.code !== 11000) throw error
        user = await User.findOne({ email })
        if (!user) throw error
      }
    }

    const pendingName = user.verified
      ? user.name || ''
      : name || user.name || ''
    const pendingMobileNumber = user.verified
      ? user.mobileNumber || ''
      : mobileNumber || user.mobileNumber || ''

    const otp = String(
      crypto.randomInt(100000, 1000000)
    )

    const otpHash = hashOtpForStore(otp)
    const sentAt = new Date()
    const expiresAt = new Date(sentAt.getTime() + OTP_DURATION_MS)
    const reservation = await reserveOtp({
      email,
      userId: user._id,
      otpHash,
      now: sentAt.getTime(),
      expiresAt: expiresAt.getTime(),
      cooldownMs: OTP_RESEND_COOLDOWN_MS,
      name: pendingName,
      mobileNumber: pendingMobileNumber,
    })

    if (reservation.retryAfterSeconds) {
      const retryAfterSeconds = reservation.retryAfterSeconds
      res.set('Retry-After', String(retryAfterSeconds))
      return res.status(429).json({
        message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        retryAfterSeconds,
      })
    }

    try {
      await sendOtpEmail(email, user.verified ? user.name : pendingName, otp)
    } catch (mailError) {
      try {
        await restoreOtp(
          email,
          otpHash,
          reservation.snapshot,
          Date.now()
        )
      } catch (cleanupError) {
        console.error('Failed to restore OTP state after email failure:', cleanupError.message)
      }

      throw mailError
    }

    console.info('OTP email delivered', {
      accountPreviouslyVerified: Boolean(user.verified),
      otpExpiresAt: expiresAt.toISOString(),
      backendCommit: process.env.RENDER_GIT_COMMIT || 'unknown',
      backendInstance: process.env.RENDER_INSTANCE_ID || 'unknown',
    })

    return res.json({
      message: 'Verification code sent to your email.',
      email,
      expiresInSeconds: OTP_DURATION_MS / 1000,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    })
  } catch (error) {
    console.error('Failed to send account verification code:', {
      status: error?.status,
      message: error?.message,
      providerError: error?.providerError,
    })

    const isConfigurationError =
      error?.message?.startsWith('RESEND_API_KEY') ||
      error?.message?.startsWith('MAIL_FROM')

    const isAuthenticationError =
      error?.status === 401 || error?.status === 403
    const resendRecipientRestriction =
      error?.status === 403 &&
      /testing emails to your own email|verify a domain|verified domain/i.test(
        error.message || ''
      )
    const isEmailConfigurationError =
      isConfigurationError || isAuthenticationError

    let message =
      'Email delivery failed. Check the backend logs and email provider settings.'

    if (resendRecipientRestriction) {
      message =
        'Email provider is restricted to its account email. Verify a sending domain in Resend and set MAIL_FROM to an address on that domain.'
    } else if (isEmailConfigurationError) {
      message =
        'We could not send a verification code right now. Please try again later or contact support.'
    }

    if (error.code === 'OTP_STORE_UNAVAILABLE') {
      return res.status(503).json({
        message: 'Verification is temporarily unavailable. Please try again shortly.',
      })
    }

    return res.status(
      isEmailConfigurationError ? 503 : 502
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

    const secret = env.jwtSecret
    if (!secret) {
      console.error('JWT_SECRET is not configured.')
      return res.status(500).json({
        message: 'Authentication is not configured on the server.',
      })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({
        message:
          'Invalid or expired verification code. Request a new code.',
      })
    }
    const verification = await verifyAndConsumeOtp({
      email,
      userId: user._id,
      submittedHash: hashOtpForStore(otp),
      now: Date.now(),
      maxAttempts: OTP_MAX_ATTEMPTS,
    })
    const verificationStatus = Number(verification[0])

    if (verificationStatus === 0) {
      return res.status(400).json({
        message: 'Invalid or expired verification code. Request a new code.',
      })
    }

    if (verificationStatus === 2) {
      const attempts = Number(verification[1])
      const remaining = OTP_MAX_ATTEMPTS - attempts
      console.warn('OTP verification mismatch', {
        attempts,
        backendCommit: process.env.RENDER_GIT_COMMIT || 'unknown',
        backendInstance: process.env.RENDER_INSTANCE_ID || 'unknown',
      })
      return res.status(400).json({
        message: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      })
    }

    if (verificationStatus === 3) {
      return res.status(400).json({
        message: 'Too many incorrect codes. Request a new verification code.',
      })
    }

    const [, consumedUserId, pendingName, pendingMobileNumber] = verification
    const verifiedUser = await User.findOneAndUpdate(
      { _id: consumedUserId, email },
      {
        $set: {
          name: pendingName || user.name,
          mobileNumber: pendingMobileNumber || user.mobileNumber,
          verified: true,
        },
      },
      { new: true }
    )

    if (!verifiedUser) {
      return res.status(400).json({
        message: 'The account changed during verification. Request a new code.',
      })
    }

    const token = jwt.sign(
      {
        id: String(verifiedUser._id),
        userId: String(verifiedUser._id),
        email: verifiedUser.email,
      },
      secret,
      { expiresIn: '30d' }
    )
    res.cookie(USER_SESSION_COOKIE, token, sessionCookieOptions)
    return res.json({
      user: {
        id: String(verifiedUser._id),
        name: verifiedUser.name,
        email: verifiedUser.email,
        mobileNumber: verifiedUser.mobileNumber,
        verified: verifiedUser.verified,
      },
    })
  } catch (error) {
    console.error('Failed to verify user account:', error.message)

    return res.status(error.status || 500).json({
      message: error.code === 'OTP_STORE_UNAVAILABLE'
        ? 'Verification is temporarily unavailable. Please try again shortly.'
        : 'Unable to verify your account. Please try again.',
    })
  }
})

export default router
