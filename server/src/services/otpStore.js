import { createHmac } from 'node:crypto'
import { createClient } from 'redis'
import { env } from '../config/env.js'

const OTP_KEY_PREFIX = 'equiptrade:otp:v1:'
const VERIFICATION_LOCK_MS = 30 * 1000

const ISSUE_OTP_SCRIPT = `
local fields = {
  'currentOtpHash',
  'currentOtpExpiresAt',
  'previousOtpHash',
  'previousOtpExpiresAt',
  'lastSentAt',
  'attempts',
  'pendingName',
  'pendingMobileNumber',
  'userId',
  'verificationLockToken',
  'verificationLockExpiresAt'
}
local old = redis.call('HMGET', KEYS[1], unpack(fields))
local now = tonumber(ARGV[3])
local lastSentAt = tonumber(old[5] or '')
local cooldownMs = tonumber(ARGV[5])
local lockExpiresAt = tonumber(old[11] or '0')

if old[10] and lockExpiresAt > now then
  return {0, tostring(math.max(1, math.ceil((lockExpiresAt - now) / 1000)))}
end
if lastSentAt and now - lastSentAt < cooldownMs then
  return {0, tostring(math.max(1, math.ceil((lastSentAt + cooldownMs - now) / 1000)))}
end

local previousHash = false
local previousExpiresAt = false
if old[1] and tonumber(old[2] or '0') > now then
  previousHash = old[1]
  previousExpiresAt = old[2]
elseif old[3] and tonumber(old[4] or '0') > now then
  previousHash = old[3]
  previousExpiresAt = old[4]
end

local attempts = '0'
if previousHash then
  attempts = old[6] or '0'
end

redis.call(
  'HSET',
  KEYS[1],
  'userId', ARGV[1],
  'currentOtpHash', ARGV[2],
  'currentOtpExpiresAt', ARGV[4],
  'lastSentAt', ARGV[3],
  'attempts', attempts,
  'pendingName', ARGV[6],
  'pendingMobileNumber', ARGV[7]
)

if previousHash then
  redis.call(
    'HSET',
    KEYS[1],
    'previousOtpHash', previousHash,
    'previousOtpExpiresAt', previousExpiresAt
  )
else
  redis.call('HDEL', KEYS[1], 'previousOtpHash', 'previousOtpExpiresAt')
end

local expiresAt = tonumber(ARGV[4])
if previousExpiresAt and tonumber(previousExpiresAt) > expiresAt then
  expiresAt = tonumber(previousExpiresAt)
end
redis.call('PEXPIREAT', KEYS[1], expiresAt)

return {1, cjson.encode(old)}
`

const RESTORE_OTP_SCRIPT = `
if redis.call('HGET', KEYS[1], 'currentOtpHash') ~= ARGV[1] then
  return 0
end

local old = cjson.decode(ARGV[2])
redis.call('DEL', KEYS[1])

local fields = {
  'currentOtpHash',
  'currentOtpExpiresAt',
  'previousOtpHash',
  'previousOtpExpiresAt',
  'lastSentAt',
  'attempts',
  'pendingName',
  'pendingMobileNumber',
  'userId',
  'verificationLockToken',
  'verificationLockExpiresAt'
}
local now = tonumber(ARGV[3])
local expiresAt = 0

for i, field in ipairs(fields) do
  local value = old[i]
  if type(value) == 'string' then
    redis.call('HSET', KEYS[1], field, value)
    if (field == 'currentOtpExpiresAt' or field == 'previousOtpExpiresAt') and tonumber(value) > expiresAt then
      expiresAt = tonumber(value)
    end
  end
end

if expiresAt > now then
  redis.call('PEXPIREAT', KEYS[1], expiresAt)
  return 1
end

redis.call('DEL', KEYS[1])
return 1
`

const VERIFY_OTP_SCRIPT = `
if redis.call('HGET', KEYS[1], 'userId') ~= ARGV[1] then
  return {0}
end

local now = tonumber(ARGV[3])
local lockToken = redis.call('HGET', KEYS[1], 'verificationLockToken')
local lockExpiresAt = tonumber(redis.call('HGET', KEYS[1], 'verificationLockExpiresAt') or '0')
if lockToken and lockExpiresAt > now then
  return {4, tostring(math.max(1, math.ceil((lockExpiresAt - now) / 1000)))}
end
if lockToken then
  redis.call('HDEL', KEYS[1], 'verificationLockToken', 'verificationLockExpiresAt')
end

local currentHash = redis.call('HGET', KEYS[1], 'currentOtpHash')
local currentExpiresAt = tonumber(redis.call('HGET', KEYS[1], 'currentOtpExpiresAt') or '0')
local previousHash = redis.call('HGET', KEYS[1], 'previousOtpHash')
local previousExpiresAt = tonumber(redis.call('HGET', KEYS[1], 'previousOtpExpiresAt') or '0')
local currentActive = currentHash and currentExpiresAt > now
local previousActive = previousHash and previousExpiresAt > now

if not currentActive and not previousActive then
  return {0}
end

if (currentActive and currentHash == ARGV[2]) or (previousActive and previousHash == ARGV[2]) then
  local userId = redis.call('HGET', KEYS[1], 'userId')
  local name = redis.call('HGET', KEYS[1], 'pendingName') or ''
  local mobileNumber = redis.call('HGET', KEYS[1], 'pendingMobileNumber') or ''
  redis.call(
    'HSET',
    KEYS[1],
    'verificationLockToken', ARGV[5],
    'verificationLockExpiresAt', tostring(now + tonumber(ARGV[6]))
  )
  return {1, userId, name, mobileNumber, ARGV[5]}
end

local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if attempts >= tonumber(ARGV[4]) then
  redis.call('DEL', KEYS[1])
  return {3, tostring(attempts)}
end

return {2, tostring(attempts)}
`

const COMPLETE_VERIFICATION_SCRIPT = `
if redis.call('HGET', KEYS[1], 'verificationLockToken') ~= ARGV[1] then
  return 0
end

redis.call('DEL', KEYS[1])
return 1
`

const RELEASE_VERIFICATION_SCRIPT = `
if redis.call('HGET', KEYS[1], 'verificationLockToken') ~= ARGV[1] then
  return 0
end

redis.call('HDEL', KEYS[1], 'verificationLockToken', 'verificationLockExpiresAt')
return 1
`

const unavailableError = message => {
  const error = new Error(message)
  error.code = 'OTP_STORE_UNAVAILABLE'
  error.status = 503
  return error
}

let client
let connectPromise

function getClient() {
  if (!env.redisUrl) {
    throw unavailableError('Redis is not configured for OTP verification.')
  }

  if (!client) {
    try {
      client = createClient({ url: env.redisUrl })
      client.on('error', error => {
        console.error('OTP Redis client error:', error.code || error.name)
      })
    } catch {
      throw unavailableError('The configured OTP store URL is invalid.')
    }
  }

  return client
}

async function getConnectedClient() {
  const redis = getClient()
  if (!redis.isOpen) {
    connectPromise ??= redis.connect().finally(() => {
      connectPromise = undefined
    })

    try {
      await connectPromise
    } catch (error) {
      throw unavailableError(`Could not connect to the OTP store: ${error.code || error.name}`)
    }
  }

  if (!redis.isReady) {
    throw unavailableError('The OTP store is not ready.')
  }

  return redis
}

async function executeScript(script, email, arguments_) {
  const redis = await getConnectedClient()

  try {
    return await redis.eval(script, {
      keys: [getOtpKey(email)],
      arguments: arguments_,
    })
  } catch (error) {
    throw unavailableError(`OTP store operation failed: ${error.code || error.name}`)
  }
}

function getOtpKey(email) {
  const digest = createHmac('sha256', env.jwtSecret)
    .update(`otp-key:${email}`)
    .digest('hex')
  return `${OTP_KEY_PREFIX}${digest}`
}

export function hashOtpForStore(otp) {
  return createHmac('sha256', env.jwtSecret)
    .update(`otp-code:${otp}`)
    .digest('hex')
}

export async function reserveOtp({
  email,
  userId,
  otpHash,
  now,
  expiresAt,
  cooldownMs,
  name,
  mobileNumber,
}) {
  const result = await executeScript(ISSUE_OTP_SCRIPT, email, [
    String(userId),
    otpHash,
    String(now),
    String(expiresAt),
    String(cooldownMs),
    name,
    mobileNumber,
  ])

  if (Number(result[0]) === 0) {
    return { retryAfterSeconds: Number(result[1]) }
  }

  return { snapshot: result[1] }
}

export async function restoreOtp(email, otpHash, snapshot, now) {
  return executeScript(RESTORE_OTP_SCRIPT, email, [
    otpHash,
    snapshot,
    String(now),
  ])
}

export async function verifyAndConsumeOtp({
  email,
  userId,
  submittedHash,
  now,
  maxAttempts,
  lockToken,
}) {
  return executeScript(VERIFY_OTP_SCRIPT, email, [
    String(userId),
    submittedHash,
    String(now),
    String(maxAttempts),
    lockToken,
    String(VERIFICATION_LOCK_MS),
  ])
}

export async function completeOtpVerification(email, lockToken) {
  return executeScript(COMPLETE_VERIFICATION_SCRIPT, email, [lockToken])
}

export async function releaseOtpVerification(email, lockToken) {
  return executeScript(RELEASE_VERIFICATION_SCRIPT, email, [lockToken])
}
