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
  res.json({
    ok: true,
    service: 'equiptrade-api',
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/admin', adminRoutes)

mongoose
  .connect(env.mongoUri)
  .then(() => {
    console.log('MongoDB connected')

    app.listen(env.port, () => {
      console.log(
        `EquipTrade API running on http://localhost:${env.port}`
      )
    })
  })
  .catch(error => {
    console.error(
      'MongoDB connection failed:',
      error.message
    )
  })