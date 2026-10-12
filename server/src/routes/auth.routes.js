
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
const OTP_RESEND_COOLDOWN_MS = 30 * 1000
const OTP_MAX_ATTEMPTS = 5

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

    let user = await User.findOne({ email }).select(
      '+otpLastSentAt +otpHash +otpExpiresAt +previousOtpHash +previousOtpExpiresAt +otpAttempts'
    )
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
        user = await User.findOne({ email }).select(
          '+otpLastSentAt +otpHash +otpExpiresAt +previousOtpHash +previousOtpExpiresAt +otpAttempts'
        )
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

    const otpHash = hashOtp(otp)
    const sentAt = new Date()
    const expiresAt = new Date(sentAt.getTime() + OTP_DURATION_MS)
    const previousOtp = user.otpHash &&
      user.otpExpiresAt?.getTime() > sentAt.getTime()
      ? { hash: user.otpHash, expiresAt: user.otpExpiresAt }
      : user.previousOtpHash &&
          user.previousOtpExpiresAt?.getTime() > sentAt.getTime()
        ? {
          hash: user.previousOtpHash,
          expiresAt: user.previousOtpExpiresAt,
        }
        : null
    const cooldownThreshold = new Date(
      sentAt.getTime() - OTP_RESEND_COOLDOWN_MS
    )
    const otpUpdate = {
      $set: {
        otpHash,
        otpExpiresAt: expiresAt,
        otpLastSentAt: sentAt,
        pendingName,
        pendingMobileNumber,
        otpAttempts: previousOtp ? user.otpAttempts || 0 : 0,
        ...(previousOtp
          ? {
            previousOtpHash: previousOtp.hash,
            previousOtpExpiresAt: previousOtp.expiresAt,
          }
          : {}),
      },
    }

    if (!previousOtp) {
      otpUpdate.$unset = {
        previousOtpHash: '',
        previousOtpExpiresAt: '',
      }
    }

    const reservedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        $or: [
          { otpLastSentAt: { $exists: false } },
          { otpLastSentAt: null },
          { otpLastSentAt: { $lte: cooldownThreshold } },
        ],
      },
      otpUpdate,
      { new: true }
    )

    if (!reservedUser) {
      const latestUser = await User.findById(user._id)
        .select('+otpLastSentAt')
      const retryAfterSeconds = latestUser?.otpLastSentAt
        ? Math.max(
          1,
          Math.ceil(
            (latestUser.otpLastSentAt.getTime() +
              OTP_RESEND_COOLDOWN_MS -
              Date.now()) / 1000
          )
        )
        : 1

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
        const recoveryUpdate = previousOtp
          ? {
            $set: {
              otpHash: previousOtp.hash,
              otpExpiresAt: previousOtp.expiresAt,
              otpAttempts: user.otpAttempts || 0,
            },
            $unset: {
              previousOtpHash: '',
              previousOtpExpiresAt: '',
              otpLastSentAt: '',
            },
          }
          : {
            $unset: {
              otpHash: '',
              otpExpiresAt: '',
              otpLastSentAt: '',
              pendingName: '',
              pendingMobileNumber: '',
            },
            $set: { otpAttempts: 0 },
          }

        await User.updateOne({ _id: reservedUser._id, otpHash }, recoveryUpdate)
      } catch (cleanupError) {
        console.error('Failed to clear undelivered OTP:', cleanupError.message)
      }

      throw mailError
    }

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

    const user = await User.findOne({ email })
      .select(
        '+otpHash +otpExpiresAt +previousOtpHash +previousOtpExpiresAt +pendingName +pendingMobileNumber +otpAttempts'
      )

    const now = new Date()
    const activeOtpHashes = [
      user?.otpHash && user.otpExpiresAt?.getTime() > now.getTime()
        ? {
          hash: user.otpHash,
          field: 'otpHash',
          expiryField: 'otpExpiresAt',
        }
        : null,
      user?.previousOtpHash &&
        user.previousOtpExpiresAt?.getTime() > now.getTime()
        ? {
          hash: user.previousOtpHash,
          expiresAt: user.previousOtpExpiresAt,
          field: 'previousOtpHash',
          expiryField: 'previousOtpExpiresAt',
        }
        : null,
    ].filter(Boolean)

    if (!activeOtpHashes.length) {
      return res.status(400).json({
        message:
          'Invalid or expired verification code. Request a new code.',
      })
    }
    const submittedHash = Buffer.from(hashOtp(otp), 'hex')
    const matchedOtp = activeOtpHashes.find(({ hash }) => {
      const storedHash = Buffer.from(hash, 'hex')
      return submittedHash.length === storedHash.length &&
        crypto.timingSafeEqual(submittedHash, storedHash)
    })

    const activeOtpConditions = activeOtpHashes.map(
      ({ hash, field, expiryField }) => ({
        [field]: hash,
        [expiryField]: { $gt: now },
      })
    )

    if (!matchedOtp) {
      const failedAttempt = await User.findOneAndUpdate(
        {
          _id: user._id,
          otpAttempts: { $lt: OTP_MAX_ATTEMPTS },
          $or: activeOtpConditions,
        },
        { $inc: { otpAttempts: 1 } },
        { new: true }
      ).select('+otpAttempts')

      if (!failedAttempt) {
        const latestUser = await User.findById(user._id)
          .select('+otpHash +previousOtpHash +otpAttempts')

        if (latestUser?.otpAttempts >= OTP_MAX_ATTEMPTS) {
          await User.updateOne(
            {
              _id: latestUser._id,
              $or: activeOtpHashes.map(({ hash, field }) => ({
                [field]: hash,
              })),
            },
            {
              $unset: {
                otpHash: '',
                previousOtpHash: '',
                previousOtpExpiresAt: '',
                otpExpiresAt: '',
                otpLastSentAt: '',
                pendingName: '',
                pendingMobileNumber: '',
              },
              $set: { otpAttempts: 0 },
            }
          )

          return res.status(400).json({
            message: 'Too many incorrect codes. Request a new verification code.',
          })
        }

        return res.status(400).json({
          message: 'Your verification code changed or expired. Request a new code and try again.',
        })
      }

      if (failedAttempt.otpAttempts >= OTP_MAX_ATTEMPTS) {
        await User.updateOne(
          {
            _id: failedAttempt._id,
            $or: activeOtpHashes.map(({ hash, field }) => ({
              [field]: hash,
            })),
          },
          {
            $unset: {
              otpHash: '',
              previousOtpHash: '',
              previousOtpExpiresAt: '',
              otpExpiresAt: '',
              otpLastSentAt: '',
              pendingName: '',
              pendingMobileNumber: '',
            },
            $set: { otpAttempts: 0 },
          }
        )

        return res.status(400).json({
          message: 'Too many incorrect codes. Request a new verification code.',
        })
      }

      return res.status(400).json({
        message: `Incorrect verification code. ${OTP_MAX_ATTEMPTS - failedAttempt.otpAttempts} attempt${OTP_MAX_ATTEMPTS - failedAttempt.otpAttempts === 1 ? '' : 's'} remaining.`,
      })
    }

    const secret = env.jwtSecret

    if (!secret) {
      console.error('JWT_SECRET is not configured.')

      return res.status(500).json({
        message: 'Authentication is not configured on the server.',
      })
    }

    // Consume the OTP after successful verification.
    const verifiedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        $or: activeOtpConditions.filter(condition => (
          Object.values(condition).some(value => value === matchedOtp.hash)
        )),
        otpExpiresAt: matchedOtp.field === 'otpHash'
          ? { $gt: new Date() }
          : { $exists: true },
        ...(matchedOtp.field === 'previousOtpHash'
          ? { previousOtpExpiresAt: { $gt: new Date() } }
          : {}),
      },
      {
        $set: {
          name: user.pendingName || user.name,
          mobileNumber: user.pendingMobileNumber || user.mobileNumber,
          verified: true,
          otpAttempts: 0,
        },
        $unset: {
          otpHash: '',
          previousOtpHash: '',
          previousOtpExpiresAt: '',
          otpExpiresAt: '',
          otpLastSentAt: '',
          pendingName: '',
          pendingMobileNumber: '',
        },
      },
      { new: true }
    )

    if (!verifiedUser) {
      return res.status(400).json({
        message: 'This verification code has expired or was already used. Request a new code.',
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

    return res.status(500).json({
      message: 'Unable to verify your account. Please try again.',
    })
  }
})

export default router
