import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env, validateSecuritySecrets } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import equipmentRoutes from './routes/equipment.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import adminRoutes from './routes/admin.routes.js';
import leadRoutes from './routes/lead.routes.js';
import User from './models/User.js';
import Equipment from './models/Equipment.js';

const app = express();

// Resolve the production React build directory.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDistPath = path.resolve(
  __dirname,
  '../../client/dist'
);

const MONGO_OPTIONS = {
  family: 4,

  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,

  maxPoolSize: 10,
  minPoolSize: 0,

  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
};

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = [
        env.clientUrl,
        'https://equiptradeindia.onrender.com',
        'http://localhost:5173',
        'https://www.equiptradeindia.com',
      ].filter(Boolean);

      const isLocal =
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
          origin || ''
        );

      if (!origin || allowedOrigins.includes(origin) || isLocal) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
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

app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leads', leadRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({
    message: 'API endpoint not found',
  });
});

app.use(express.static(clientDistPath));

app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      message: 'API endpoint not found',
    });
  }

  res.sendFile(
    path.join(clientDistPath, 'index.html'),
    error => {
      if (error) next(error);
    }
  );
});

async function ensureUserIndexes() {
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
      {
        name: 'mobileNumber_1',
        sparse: true,
      }
    );
  }

  await User.collection.createIndex(
    { email: 1 },
    {
      name: 'email_1',
      unique: true,
    }
  );
}

async function restoreListingsHeldByAutomaticQualityChecks() {
  const result = await Equipment.updateMany(
    {
      status: { $in: ['approved', 'published'] },
      isQualityHold: true,
      qualityReviewReason: {
        $in: [
          'Potential development or placeholder listing; review before republishing.',
          'Potential development or placeholder listing details; review before republishing.',
        ],
      },
    },
    {
      $set: {
        isQualityHold: false,
        isActive: true,
        qualityReviewReason: '',
      },
    }
  );

  if (result.modifiedCount > 0) {
    console.info(`Restored ${result.modifiedCount} approved listing(s) hidden by automatic quality checks.`);
  }
}

async function connectToDatabase() {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI is missing from environment variables.');
  }

  let attempt = 0;
  let delayMs = 2000;
  const maxDelayMs = 15000;

  while (true) {
    attempt++;

    try {
      console.log(
        `Connecting to MongoDB Atlas (attempt ${attempt})...`
      );

      await mongoose.connect(env.mongoUri, MONGO_OPTIONS);

      console.log('MongoDB connected successfully.');

      await ensureUserIndexes();
      await restoreListingsHeldByAutomaticQualityChecks();

      console.log('MongoDB indexes verified successfully.');

      return;
    } catch (error) {
      console.error(
        `MongoDB attempt ${attempt} failed: ${error.message}`
      );

      // Clean up a failed connection before retrying.
      try {
        await mongoose.disconnect();
      } catch {
        // Preserve the original connection error.
      }

      console.error(
        `MongoDB connection failed. Retrying in ${
          delayMs / 1000
        } seconds...`
      );

      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Exponential backoff with a maximum delay.
      delayMs = Math.min(delayMs * 2, maxDelayMs);
    }
  }
}

// MongoDB connection events.
mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established.');
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost.');
});

mongoose.connection.on('error', error => {
  console.error('MongoDB error:', error.message);
});

// Start the server only after successful DB initialization.
async function startServer() {
  try {
    validateSecuritySecrets();

    await connectToDatabase();

    const port = env.port || process.env.PORT || 4000;

    app.listen(port, '0.0.0.0', () => {
      console.log(`EquipTrade server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
