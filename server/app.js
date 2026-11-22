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

// Serve static frontend build if available
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
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

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`===============================================`);
    console.log(`🏪 Room-314 POS Server running on port ${config.port}`);
    console.log(`📡 URL: http://localhost:${config.port}`);
    console.log(`📁 Database: ${config.dbPath}`);
    console.log(`===============================================`);
  });
}

module.exports = app;
