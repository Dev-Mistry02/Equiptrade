import 'dotenv/config'

export const env = {
  port: process.env.PORT || 4000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  mongoUri:
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/equiptrade_india',

  mailHost: process.env.MAIL_HOST,
  mailPort: Number(process.env.MAIL_PORT || 587),
  mailUser: process.env.MAIL_USER,
  mailPassword: process.env.MAIL_PASSWORD,
  mailFrom: process.env.MAIL_FROM || process.env.MAIL_USER,

  adminSessionSecret:
    process.env.ADMIN_SESSION_SECRET ||
    'change-this-admin-session-secret',

  jwtSecret:
    process.env.JWT_SECRET ||
    'change-this-user-jwt-secret',
}