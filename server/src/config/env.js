import 'dotenv/config'

export const env = {
  port: process.env.PORT || 4000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri:
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/equiptrade',
  resendApiKey: process.env.RESEND_API_KEY?.trim(),
  mailFrom: process.env.MAIL_FROM?.trim(),
  redisUrl: process.env.REDIS_URL?.trim(),
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET?.trim(),
  jwtSecret: process.env.JWT_SECRET?.trim(),
};

export function validateSecuritySecrets() {
  const invalidSecrets = [
    ['ADMIN_SESSION_SECRET', env.adminSessionSecret],
    ['JWT_SECRET', env.jwtSecret],
  ]
    .filter(([, secret]) => !secret || secret.length < 32)
    .map(([name]) => name);

  if (invalidSecrets.length) {
    throw new Error(
      `${invalidSecrets.join(' and ')} must be configured with unique random values of at least 32 characters.`
    );
  }

  if (env.adminSessionSecret === env.jwtSecret) {
    throw new Error(
      'ADMIN_SESSION_SECRET and JWT_SECRET must use different random values.'
    );
  }
}
