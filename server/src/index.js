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
      if (!origin) {
        return callback(null, true)
      }

      const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin)

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
  const databaseConnected =
    mongoose.connection.readyState === 1 && databaseReady

  res.status(databaseConnected ? 200 : 503).json({
    ok: databaseConnected,
    service: 'equiptrade-api',
    database: databaseConnected ? 'connected' : 'unavailable',
  })
})

app.use('/api', (_req, res, next) => {
  if (mongoose.connection.readyState !== 1 || !databaseReady) {
    return res.status(503).json({
      message: 'Database is unavailable. Check the MongoDB connection and try again.',
    })
  }

  next()
})

app.use('/api/auth', authRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/admin', adminRoutes)

async function ensureUserIndexes() {
  const collections = await mongoose.connection.db
    .listCollections({ name: User.collection.name }, { nameOnly: true })
    .toArray()
  const indexes = collections.length
    ? await User.collection.indexes()
    : []
  const mobileIndex = indexes.find(
    index =>
      Object.keys(index.key).length === 1 &&
      index.key.mobileNumber === 1
  )

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
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(env.mongoUri, {
          serverSelectionTimeoutMS: 10000,
        })
      }
      await ensureUserIndexes()
      databaseReady = true
      console.log('MongoDB connected')
      return
    } catch (error) {
      attempt += 1
      console.error(
        `MongoDB connection attempt ${attempt} failed: ${error.message}. ` +
        'Check MONGO_URI and ensure the database allows connections from this server.'
      )

      const retryDelay = Math.min(1000 * 2 ** Math.min(attempt, 5), 30000)
      await delay(retryDelay)
    }
  }
}

app.listen(env.port, () => {
  console.log(`EquipTrade API running on http://localhost:${env.port}`)
  connectToDatabase()
})