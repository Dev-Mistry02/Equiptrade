export const USER_SESSION_COOKIE = 'equiptrade_user_session'
export const ADMIN_SESSION_COOKIE = 'equiptrade_admin_session'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: SESSION_DURATION_MS,
}

export const clearSessionCookie = (res, name) => {
  res.clearCookie(name, {
    httpOnly: sessionCookieOptions.httpOnly,
    secure: sessionCookieOptions.secure,
    sameSite: sessionCookieOptions.sameSite,
    path: sessionCookieOptions.path,
  })
}

export function getRequestCookie(req, name) {
  const prefix = `${name}=`
  const value = (req.headers.cookie || '')
    .split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith(prefix))

  return value ? value.slice(prefix.length) : ''
}
