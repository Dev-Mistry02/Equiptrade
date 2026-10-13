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
import User from './models/User.js';

const app = express();

// Resolve the production React build directory.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDistPath = path.resolve(
  __dirname,
  '../../client/dist'
);

// MongoDB connection configuration.
const MONGO_OPTIONS = {
  // Prefer IPv4 for compatibility with many networks.
  family: 4,

  // Fail faster when Atlas cannot be reached.
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,

  // Connection pool.
  maxPoolSize: 10,
  minPoolSize: 0,

  // Keep sockets alive and detect connection problems.
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
};

// CORS configuration.
app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = [
        env.clientUrl,
        'https://equiptradeindia.onrender.com',
        'http://localhost:5173',
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

// Health check.
app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    ok: connected,
    service: 'equiptrade-api',
    database: connected ? 'connected' : 'unavailable',
  });
});

// Database-dependent routes are mounted below.
// The server starts listening only after initial DB setup succeeds.
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);

// Return JSON for unknown API endpoints.
app.use('/api', (_req, res) => {
  res.status(404).json({
    message: 'API endpoint not found',
  });
});

// Serve static React frontend assets.
app.use(express.static(clientDistPath));

// React SPA fallback.
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

// Preserve user index configuration.
async function ensureUserIndexes() {
  const indexes = await User.collection.indexes();

  const mobileIndex = indexes.find(
    index =>
      Object.keys(index.key).length === 1 &&
      index.key.mobileNumber === 1
  );

  // Remove the old unique mobile index if present.
  if (mobileIndex?.unique) {
    await User.collection.dropIndex(mobileIndex.name);
  }

  // Create the non-unique sparse mobile index if needed.
  if (!mobileIndex || mobileIndex.unique) {
    await User.collection.createIndex(
      { mobileNumber: 1 },
      {
        name: 'mobileNumber_1',
        sparse: true,
      }
    );
  }

  // Keep email unique.
  await User.collection.createIndex(
    { email: 1 },
    {
      name: 'email_1',
      unique: true,
    }
  );
}

// Connect immediately, retry only if connection fails.
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

      // Start the connection immediately; no initial sleep.
      await mongoose.connect(env.mongoUri, MONGO_OPTIONS);

      console.log('MongoDB connected successfully.');

      // Do not report startup success until indexes are ready.
      await ensureUserIndexes();

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
