import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import equipmentRoutes from './routes/equipment.routes.js';
import adminRoutes from './routes/admin.routes.js';
import User from './models/User.js';

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = [
        env.clientUrl,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
      ].filter(Boolean);

      const isLocal =
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
          origin || ''
        );

      if (!origin || allowedOrigins.includes(origin) || isLocal) {
        return callback(null, true);
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    ok: connected,
    service: 'equiptrade-api',
    database: connected ? 'connected' : 'unavailable',
  });
});

// Block API requests when MongoDB is disconnected.
app.use('/api', (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Database unavailable. Please try again shortly.',
    });
  }

  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/admin', adminRoutes);

async function ensureUserIndexes() {
  // Preserve the ability to have multiple users without a mobile number.
  const indexes = await User.collection.indexes();

  const mobileIndex = indexes.find(
    index =>
      Object.keys(index.key).length === 1 &&
      index.key.mobileNumber === 1
  );

  if (mobileIndex?.unique) {
    await User.collection.dropIndex(mobileIndex.name);
  }

  if (!mobileIndex || mobileIndex.unique) {
    await User.collection.createIndex(
      { mobileNumber: 1 },
      { name: 'mobileNumber_1', sparse: true }
    );
  }

  await User.collection.createIndex(
    { email: 1 },
    { name: 'email_1', unique: true }
  );
}

async function connectToDatabase() {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI is missing from .env');
  }

  let attempt = 0;

  while (true) {
    try {
      attempt++;

      console.log(`Connecting to MongoDB (attempt ${attempt})...`);

      await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        maxPoolSize: 10,
        family: 4,
      });

      await ensureUserIndexes();

      console.log('MongoDB connected successfully.');
      return;
    } catch (error) {
      console.error(`MongoDB attempt ${attempt} failed:`, error.message);

      await mongoose.disconnect().catch(() => {});

      const wait = Math.min(2000 * 2 ** (attempt - 1), 30000);

      console.log(`Retrying in ${wait / 1000} seconds...`);

      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected.');
});

mongoose.connection.on('error', error => {
  console.error('MongoDB error:', error.message);
});

async function startServer() {
  try {
    await connectToDatabase();

    app.listen(env.port, () => {
      console.log(`EquipTrade API running on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();