
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import equipmentRoutes from './routes/equipment.routes.js'
import adminRoutes from './routes/admin.routes.js'
import User from './models/User.js'

const app = express()

let databaseReady = false
let serverStarted = false

const delay = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds))

const allowedOrigins = [
  env.clientUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
].filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)

      const isLocalDevOrigin =
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin)

      if (allowedOrigins.includes(origin) || isLocalDevOrigin) {
        return callback(null, true)
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`))
    },
    credentials: true,
  })
)

app.use(express.json({ limit: '25mb' }))

app.get('/api/health', (_req, res) => {
  const connected =
    mongoose.connection.readyState === 1 && databaseReady

  res.status(connected ? 200 : 503).json({
    ok: connected,
    service: 'equiptrade-api',
    database: connected ? 'connected' : 'unavailable',
  })
})

app.use('/api', (_req, res, next) => {
  if (mongoose.connection.readyState !== 1 || !databaseReady) {
    return res.status(503).json({
      message: 'Database is unavailable. Please try again shortly.',
    })
  }

  next()
})

app.use('/api/auth', authRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/admin', adminRoutes)

async function ensureUserIndexes() {
  const db = mongoose.connection.db

  const collections = await db
    .listCollections(
      { name: User.collection.name },
      { nameOnly: true }
    )
    .toArray()

  const indexes = collections.length
    ? await User.collection.indexes()
    : []

  const mobileIndex = indexes.find(
    index =>
      Object.keys(index.key).length === 1 &&
      index.key.mobileNumber === 1
  )

  // Replace the existing mobile index if it is unique.
  // Multiple users may have no mobile number.
  if (mobileIndex?.unique) {
    await User.collection.dropIndex(mobileIndex.name)
  }

  if (!mobileIndex || mobileIndex.unique) {
    await User.collection.createIndex(
      { mobileNumber: 1 },
      { name: 'mobileNumber_1', sparse: true }
    )
  }

  await User.collection.createIndex(
    { email: 1 },
    { name: 'email_1', unique: true }
  )
}

async function connectToDatabase() {
  let attempt = 0

  while (!databaseReady) {
    try {
      if (!env.mongoUri) {
        throw new Error('MONGO_URI is missing from the environment')
      }

      console.log('Connecting to MongoDB...')

      await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
      })

      console.log('MongoDB connection established')

      await ensureUserIndexes()

      databaseReady = true
      console.log('MongoDB indexes verified')

      return
    } catch (error) {
      attempt += 1
      databaseReady = false

      console.error(
        `MongoDB startup attempt ${attempt} failed: ${error.message}`
      )

      // Close a partially established connection before retrying.
      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect()
        } catch (disconnectError) {
          console.error(
            'MongoDB disconnect warning:',
            disconnectError.message
          )
        }
      }

      const retryDelay = Math.min(
        1000 * 2 ** Math.min(attempt - 1, 5),
        30000
      )

      console.log(`Retrying MongoDB in ${retryDelay / 1000}s...`)
      await delay(retryDelay)
    }
  }
}

async function startServer() {
  try {
    await connectToDatabase()

    if (serverStarted) return
    serverStarted = true

    app.listen(env.port, () => {
      console.log(
        `EquipTrade API running on http://localhost:${env.port}`
      )
      console.log('Server ready — MongoDB is connected')
    })
  } catch (error) {
    console.error('Server startup failed:', error.message)
    process.exit(1)
  }
}

mongoose.connection.on('disconnected', () => {
  databaseReady = false
  console.error('MongoDB disconnected')
})

mongoose.connection.on('error', error => {
  console.error('MongoDB connection error:', error.message)
})

startServer()
