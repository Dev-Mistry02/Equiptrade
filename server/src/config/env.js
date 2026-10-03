import 'dotenv/config'

export const env = {
  port: process.env.PORT || 4000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  mongoUri:
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/equiptrade_india',

  postmarkServerToken: process.env.POSTMARK_SERVER_TOKEN,
  mailFrom: process.env.MAIL_FROM || '225beitg016@svitvasad.ac.in',
  mailMessageStream: process.env.MAIL_MESSAGE_STREAM || 'outbound',

  adminSessionSecret:
    process.env.ADMIN_SESSION_SECRET ||
    'change-this-admin-session-secret',

  jwtSecret:
    process.env.JWT_SECRET ||
    'change-this-user-jwt-secret',
}