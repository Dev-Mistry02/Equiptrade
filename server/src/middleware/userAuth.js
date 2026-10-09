import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function requireUser(req, res, next) {
  try {
    const authorization = req.headers.authorization || ''

    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required.',
      })
    }

    const token = authorization.slice(7)

    const decoded = jwt.verify(token, env.jwtSecret)

    req.user = decoded

    next()
  } catch {
    return res.status(401).json({
      message: 'Your session has expired. Please sign in again.',
    })
  }
}