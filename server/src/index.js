import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import equipmentRoutes from './routes/equipment.routes.js'
import adminRoutes from './routes/admin.routes.js'

const app = express()

app.use(
  cors({
    origin: env.clientUrl,
  })
)

app.use(express.json({ limit: '25mb' }))

app.get('/api/health', (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1

  res.status(databaseConnected ? 200 : 503).json({
    ok: databaseConnected,
    service: 'equiptrade-api',
    database: databaseConnected ? 'connected' : 'unavailable',
  })
})

app.use('/api', (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Database is unavailable. Check the MongoDB connection and try again.',
    })
  }

  next()
})

app.use('/api/auth', authRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/admin', adminRoutes)

app.listen(env.port, () => {
  console.log(`EquipTrade API running on http://localhost:${env.port}`)

  mongoose
    .connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 })
    .then(() => {
      console.log('MongoDB connected')
    })
    .catch(error => {
      console.error('MongoDB connection failed:', error.message)
    })
})