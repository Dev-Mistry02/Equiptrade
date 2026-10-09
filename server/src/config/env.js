import 'dotenv/config'

export const env = {
  port: process.env.PORT || 4000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  mongoUri:
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/equiptrade',

  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPassword:
    process.env.SMTP_HOST === 'smtp.gmail.com'
      ? process.env.SMTP_PASSWORD?.replace(/\s/g, '')
      : process.env.SMTP_PASSWORD,
  mailFrom: process.env.MAIL_FROM,

  adminSessionSecret:
    process.env.ADMIN_SESSION_SECRET ||
    'change-this-admin-session-secret',

  jwtSecret:
    process.env.JWT_SECRET ||
    'change-this-user-jwt-secret',
}