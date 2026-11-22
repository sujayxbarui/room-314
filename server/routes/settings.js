const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const config = require('../config');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// POST /api/settings/reset-data - Clear demo sales or reset catalog to fresh shop (Admin only)
router.post('/reset-data', authenticate, requireAdmin, (req, res, next) => {
  try {
    const { action } = req.body; // 'clear_sales' | 'clear_all'

    if (action === 'clear_sales') {
      db.transaction(() => {
        db.prepare('DELETE FROM sale_items').run();
        db.prepare('DELETE FROM sales').run();
        db.prepare('DELETE FROM return_items').run();
        db.prepare('DELETE FROM returns').run();
        db.prepare("DELETE FROM stock_ledger WHERE change_type = 'sale' OR change_type = 'return'").run();
      })();

      return res.json({
        success: true,
        message: 'All demo sales and transactions cleared! Today\'s sales and profit are now ₹0.00.',
      });
    }

    if (action === 'clear_all') {
      db.transaction(() => {
        db.prepare('DELETE FROM sale_items').run();
        db.prepare('DELETE FROM sales').run();
        db.prepare('DELETE FROM return_items').run();
        db.prepare('DELETE FROM returns').run();
        db.prepare('DELETE FROM stock_purchase_items').run();
        db.prepare('DELETE FROM stock_purchases').run();
        db.prepare('DELETE FROM stock_adjustments').run();
        db.prepare('DELETE FROM stock_ledger').run();
        db.prepare('DELETE FROM products').run();
      })();

      return res.json({
        success: true,
        message: 'All sales and products cleared! Shop is now a completely clean slate.',
      });
    }

    res.status(400).json({ error: 'Invalid action. Choose clear_sales or clear_all.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/backup/download - Download complete shop database snapshot
router.get('/backup/download', authenticate, (req, res, next) => {
  try {
    // Checkpoint SQLite WAL so database file contains all recent transactions
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
      console.warn('WAL checkpoint warning:', e.message);
    }

    if (!fs.existsSync(config.dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const downloadFilename = `room314-shop-data-${todayStr}.db`;

    res.download(config.dbPath, downloadFilename);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/backup/restore - Restore/Import shop database from uploaded .db file (Admin only)
router.post('/backup/restore', authenticate, requireAdmin, upload.single('database_file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No database file provided' });
    }

    const uploadedPath = req.file.path;

    // Verify file header is a valid SQLite 3 database
    const fd = fs.openSync(uploadedPath, 'r');
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const header = buffer.toString('utf8');
    if (!header.startsWith('SQLite format 3')) {
      try { fs.unlinkSync(uploadedPath); } catch (e) {}
      return res.status(400).json({ error: 'The uploaded file is not a valid SQLite database.' });
    }

    // Safety backup of existing database before overwriting
    const backupDir = path.resolve(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const safetyBackupPath = path.join(backupDir, `pre-restore-${Date.now()}.db`);
    if (fs.existsSync(config.dbPath)) {
      try { fs.copyFileSync(config.dbPath, safetyBackupPath); } catch (e) {}
    }

    // 1. Close active database connection cleanly
    if (typeof db.close === 'function') {
      try { db.close(); } catch (e) {}
    }

    // 2. Remove old WAL and SHM journal files
    const walFile = config.dbPath + '-wal';
    const shmFile = config.dbPath + '-shm';
    if (fs.existsSync(walFile)) try { fs.unlinkSync(walFile); } catch (e) {}
    if (fs.existsSync(shmFile)) try { fs.unlinkSync(shmFile); } catch (e) {}

    // 3. Replace the database file with the uploaded one
    fs.copyFileSync(uploadedPath, config.dbPath);
    try { fs.unlinkSync(uploadedPath); } catch (e) {}

    // 4. Reload the database instance cleanly
    if (typeof db.reloadDatabase === 'function') {
      db.reloadDatabase();
    }

    res.json({
      success: true,
      message: 'Shop database restored successfully! All sales, products, and settings have been updated.',
    });
  } catch (err) {
    // If anything failed, attempt to reload database
    try { if (typeof db.reloadDatabase === 'function') db.reloadDatabase(); } catch (e) {}
    next(err);
  }
});

router.use(authenticate);

// GET /api/settings
router.get('/', (req, res, next) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings (Admin only)
router.put('/', requireAdmin, (req, res, next) => {
  try {
    const updates = req.body;
    const updateStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `);

    const updateMany = db.transaction((obj) => {
      for (const [key, val] of Object.entries(obj)) {
        updateStmt.run(key, String(val));
      }
    });

    updateMany(updates);
    res.json({ message: 'Settings updated successfully', settings: updates });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/users - list users
router.get('/users', (req, res, next) => {
  try {
    const users = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users').all();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

