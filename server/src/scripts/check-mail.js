import { verifyMailConnection } from '../services/mailer.js'

try {
  await verifyMailConnection()
  console.log('SMTP connection and authentication succeeded.')
} catch (error) {
  console.error('SMTP connection check failed:', {
    code: error?.code,
    responseCode: error?.responseCode,
    command: error?.command,
    message: error?.message,
  })
  process.exitCode = 1
}
