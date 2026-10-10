import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import {
  getRequestCookie,
  USER_SESSION_COOKIE,
} from './sessionCookies.js'

export function requireUser(req, res, next) {
  try {
    const authorization = req.headers.authorization || ''
    const token =
      (authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : '') || getRequestCookie(req, USER_SESSION_COOKIE)

    if (!token) {
      return res.status(401).json({
        message: 'Authentication required.',
      })
    }

    const decoded = jwt.verify(token, env.jwtSecret)

    req.user = decoded

    next()
  } catch {
    return res.status(401).json({
      message: 'Your session has expired. Please sign in again.',
    })
  }
}