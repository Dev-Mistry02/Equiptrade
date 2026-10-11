
import 'dotenv/config'
import { verifyMailConnection } from '../services/mailer.js'

const testRecipient = process.env.RESEND_TEST_TO?.trim()

if (!testRecipient) {
  console.error(
    'Resend check failed: RESEND_TEST_TO is missing from server/.env'
  )
  process.exit(1)
}

try {
  const emailId = await verifyMailConnection(testRecipient)

  console.log('Resend accepted the test email.')
  console.log('Email ID:', emailId)
  console.log('Check the recipient inbox and spam folder.')
} catch (error) {
  console.error('Resend email check failed:', {
    status: error?.status ?? 'Connection/configuration error',
    message: error?.message,
    providerError: error?.providerError ?? undefined,
  })

  process.exitCode = 1
}
