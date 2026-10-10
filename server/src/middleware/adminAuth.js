import crypto from 'node:crypto'
import { env } from '../config/env.js'
import {
  ADMIN_SESSION_COOKIE,
  getRequestCookie,
} from './sessionCookies.js'

const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000

const sign = value => crypto.createHmac('sha256', env.adminSessionSecret).update(value).digest('base64url')

export const createAdminToken = () => {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export const isValidAdminToken = token => {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature) return false
  const expected = sign(payload)
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now()
  } catch {
    return false
  }
}

export const requireAdmin = (req, res, next) => {
  const authorization = req.headers.authorization || ''
  const token =
    authorization.replace(/^Bearer\s+/i, '') ||
    getRequestCookie(req, ADMIN_SESSION_COOKIE)

  if (!isValidAdminToken(token)) {
    return res.status(401).json({ message: 'Admin login required.' })
  }

  next()
}
