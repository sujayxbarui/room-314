const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Ensure working directory is always valid
try {
  process.chdir(__dirname);
} catch (e) {
  console.warn('Could not set cwd:', e.message);
}

// Global exception safety
process.on('uncaughtException', (err) => {
  console.error('[SERVER UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER UNHANDLED REJECTION]', reason);
});

const config = require('./config');
const db = require('./db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const returnRoutes = require('./routes/returns');
const reportRoutes = require('./routes/reports');
const aiRoutes = require('./routes/ai');
const settingsRoutes = require('./routes/settings');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve static uploads
app.use('/uploads', express.static(config.uploadDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    shop: config.shop.name,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler for unmatched API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Serve static frontend build
const candidateDistPaths = [
  path.resolve(__dirname, '..', 'client', 'dist'),
  path.resolve(__dirname, 'client', 'dist'),
  path.resolve(process.cwd(), 'client', 'dist'),
  path.resolve(process.cwd(), 'dist'),
];

let resolvedDistPath = candidateDistPaths.find((p) => fs.existsSync(p));

if (resolvedDistPath) {
  console.log(`📦 Serving frontend from: ${resolvedDistPath}`);
  app.use(express.static(resolvedDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(resolvedDistPath, 'index.html'));
  });
} else {
  console.warn('⚠️ No client build found in candidate paths. Frontend will not be served directly by Express.');
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Room-314 — Setup Required</title></head>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
          <div style="text-align: center; max-width: 500px; padding: 2rem; background: #1e293b; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
            <h2 style="color: #14b8a6; margin-top: 0;">Room-314 POS Backend Running</h2>
            <p style="color: #94a3b8; font-size: 14px;">The API is live, but the client frontend build was not found on this server.</p>
            <p style="font-size: 13px; background: #0f172a; padding: 12px; border-radius: 6px; font-family: monospace; color: #38bdf8;">
              npm run build
            </p>
            <p style="color: #64748b; font-size: 12px;">If running separately, open the Vite dev server at <strong>http://localhost:5173</strong></p>
          </div>
        </body>
      </html>
    `);
  });
}

// Global Error Handler
app.use(errorHandler);

// Graceful shutdown
function gracefulShutdown() {
  console.log('Shutting down server, flushing database WAL...');
  if (db && typeof db.close === 'function') {
    db.close();
  }
  process.exit(0);
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server only when run directly as the main process (not when required by Vercel serverless)
if (require.main === module && process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`===============================================`);
    console.log(`🏪 Room-314 POS Server running on port ${config.port}`);
    console.log(`📡 URL: http://localhost:${config.port}`);
    console.log(`📁 Database: ${config.dbPath}`);
    console.log(`===============================================`);
  });
}

module.exports = app;
