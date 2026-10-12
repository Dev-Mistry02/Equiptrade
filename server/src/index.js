
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

// Block database-dependent API requests if MongoDB is disconnected.
app.use('/api', (req, res, next) => {
  // Let unknown API endpoints reach the 404 handler below.
  next();
});

// Authentication, equipment, feedback, and admin routes.
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

// React SPA fallback for routes such as /verification and /home.
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

// Connect to MongoDB with retry logic.
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
      console.error(
        `MongoDB attempt ${attempt} failed:`,
        error.message
      );

      await mongoose.disconnect().catch(() => {});

      const wait = Math.min(
        2000 * 2 ** (attempt - 1),
        30000
      );

      console.log(`Retrying in ${wait / 1000} seconds...`);

      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

// MongoDB connection events.
mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected.');
});

mongoose.connection.on('error', error => {
  console.error('MongoDB error:', error.message);
});

// Start the server.
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
