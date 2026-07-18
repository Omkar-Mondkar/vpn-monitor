require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./db');
const vpnsRouter = require('./routes/vpns');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.url}`);
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/vpns', vpnsRouter);

// Health check endpoint for the server itself
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 & Error handlers ────────────────────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Catch-all: serve index.html for any non-API route (SPA fallback)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`[Server] Unhandled error: ${err.message}`, { stack: err.stack, url: req.url });
  res.status(500).json({ error: 'Internal server error.', detail: err.message });
});

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  try {
    await initSchema();
    app.listen(PORT, () => {
      logger.info(`🛡️  VPN Monitor running at http://localhost:${PORT}`);
      logger.info(`   API: http://localhost:${PORT}/api/vpns`);
      logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error(`[Server] Failed to start: ${err.message}`);
    logger.error('🔴 Check your DATABASE_URL in .env and ensure PostgreSQL is running.');
    process.exit(1);
  }
}

start();
