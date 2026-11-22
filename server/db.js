const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('./config');

// Ensure database directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

function initDatabase() {
  // If database file exists, verify integrity
  if (fs.existsSync(config.dbPath)) {
    try {
      const testDb = new Database(config.dbPath);
      const check = testDb.pragma('integrity_check');
      testDb.close();
      if (!check || check.length === 0 || check[0].integrity_check !== 'ok') {
        console.warn('⚠️ Existing database failed integrity check. Backing up and re-initializing...');
        fs.renameSync(config.dbPath, `${config.dbPath}.corrupt-${Date.now()}`);
      }
    } catch (err) {
      console.warn('⚠️ Database check error:', err.message, '- Creating clean database');
      try { fs.renameSync(config.dbPath, `${config.dbPath}.corrupt-${Date.now()}`); } catch (e) {}
    }
  }

  dbInstance = new Database(config.dbPath);

  // WAL mode for concurrency and speed
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('cache_size = -64000'); // 64MB cache

  // Run schema migration if tables don't exist
  ensureSchema(dbInstance);

  return dbInstance;
}

function ensureSchema(db) {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
      UNIQUE(name, parent_id)
    );

    CREATE TABLE IF NOT EXISTS category_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL COLLATE NOCASE,
      category_id INTEGER NOT NULL,
      confidence REAL DEFAULT 1.0,
      source TEXT DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_category_mappings_keyword ON category_mappings(keyword);

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT,
      category_id INTEGER,
      subcategory_id INTEGER,
      sku TEXT UNIQUE,
      mrp REAL,
      selling_price REAL NOT NULL,
      purchase_price REAL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'piece',
      low_stock_threshold INTEGER DEFAULT 5,
      supplier TEXT,
      image_url TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (subcategory_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_archived ON products(is_archived);

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      sale_date TEXT NOT NULL DEFAULT (datetime('now')),
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      amount_paid REAL NOT NULL DEFAULT 0,
      change_due REAL NOT NULL DEFAULT 0,
      customer_name TEXT,
      customer_phone TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      mrp_snapshot REAL,
      purchase_price_snapshot REAL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

    CREATE TABLE IF NOT EXISTS stock_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier TEXT,
      purchase_date TEXT NOT NULL DEFAULT (datetime('now')),
      invoice_number TEXT,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS stock_purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      purchase_price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (purchase_id) REFERENCES stock_purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity_change INTEGER NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      adjusted_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_sale_id INTEGER,
      return_date TEXT NOT NULL DEFAULT (datetime('now')),
      refund_amount REAL NOT NULL DEFAULT 0,
      refund_method TEXT DEFAULT 'cash',
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (original_sale_id) REFERENCES sales(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      restock INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS stock_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      quantity_before INTEGER NOT NULL,
      quantity_change INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_stock_ledger_product ON stock_ledger(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_ledger_type ON stock_ledger(change_type);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO schema_version (version) VALUES (1);
  `;

  db.exec(schemaSql);

  // If no users exist, seed default admin & staff accounts
  const userCount = db.prepare('SELECT count(*) as count FROM users').get();
  if (!userCount || userCount.count === 0) {
    console.log('Seeding default admin & staff accounts...');
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('admin123', salt);
    const staffHash = bcrypt.hashSync('staff123', salt);
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    insertUser.run(1, 'Sujay (Owner)', 'owner@room314.com', passwordHash, 'admin');
    insertUser.run(2, 'Co-founder', 'partner@room314.com', passwordHash, 'admin');
    insertUser.run(3, 'Store Cashier', 'staff@room314.com', staffHash, 'staff');
  }

  // Ensure staff user exists in existing database
  const staffUser = db.prepare('SELECT id FROM users WHERE email = ?').get('staff@room314.com');
  if (!staffUser) {
    console.log('Adding Store Cashier account (staff@room314.com)...');
    const salt = bcrypt.genSaltSync(10);
    const staffHash = bcrypt.hashSync('staff123', salt);
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, 'staff', 1)
    `).run('Store Cashier', 'staff@room314.com', staffHash);
  }

  // If no categories exist, seed core grocery categories
  const catCount = db.prepare('SELECT count(*) as count FROM categories').get();
  if (!catCount || catCount.count === 0) {
    console.log('Seeding default product categories...');
    const insertCat = db.prepare(`INSERT OR IGNORE INTO categories (id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)`);
    insertCat.run(1, 'Snacks', null, 1);
    insertCat.run(2, 'Beverages', null, 2);
    insertCat.run(3, 'Dairy', null, 3);
    insertCat.run(4, 'Packaged Food', null, 4);
    insertCat.run(5, 'Personal Care', null, 5);
    insertCat.run(6, 'Household', null, 6);
    insertCat.run(7, 'Chocolates & Sweets', null, 7);
    insertCat.run(8, 'Bakery & Breads', null, 8);
    insertCat.run(9, 'Chips & Namkeen', 1, 1);
    insertCat.run(10, 'Biscuits & Cookies', 1, 2);
    insertCat.run(11, 'Soft Drinks', 2, 1);
    insertCat.run(12, 'Juices', 2, 2);
    insertCat.run(13, 'Instant Noodles', 4, 1);
  }

  // Ensure default settings exist
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_name', 'Room-314')`).run();

  // If no products exist, seed initial catalog
  const prodCount = db.prepare('SELECT count(*) as count FROM products').get();
  if (!prodCount || prodCount.count === 0) {
    console.log('Seeding initial products catalog...');
    const insertProduct = db.prepare(`
      INSERT OR IGNORE INTO products (
        id, name, brand, category_id, subcategory_id, sku, mrp, selling_price, purchase_price, stock, unit, low_stock_threshold, supplier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedProducts = [
      [1, "Lay's Classic Salted Potato Chips 50g", "Lay's", 1, 9, 'R314-0001', 20, 20, 16.5, 35, 'packet', 10, 'Blinkit Wholesaler'],
      [2, "Lay's India's Magic Masala 50g", "Lay's", 1, 9, 'R314-0002', 20, 20, 16.5, 28, 'packet', 10, 'Blinkit Wholesaler'],
      [3, 'Bingo Mad Angles Achaari Masti 66g', 'Bingo', 1, 9, 'R314-0003', 20, 20, 16.0, 18, 'packet', 8, 'Blinkit Wholesaler'],
      [4, 'Kurkure Masala Munch 82g', 'Kurkure', 1, 9, 'R314-0004', 20, 20, 16.5, 22, 'packet', 10, 'Blinkit Wholesaler'],
      [5, "Haldiram's Aloo Bhujia 150g", "Haldiram's", 1, 9, 'R314-0005', 55, 52, 42.0, 15, 'packet', 5, 'Blinkit Wholesaler'],
      [6, 'Parle-G Gold Biscuits 1kg', 'Parle', 1, 10, 'R314-0006', 140, 135, 115.0, 12, 'packet', 5, 'Blinkit Wholesaler'],
      [7, 'Britannia Good Day Butter Cookies 200g', 'Britannia', 1, 10, 'R314-0007', 45, 42, 34.0, 25, 'packet', 8, 'Blinkit Wholesaler'],
      [8, 'Cadbury Oreo Original Vanilla Biscuits 120g', 'Cadbury', 1, 10, 'R314-0008', 35, 35, 28.5, 20, 'packet', 6, 'Blinkit Wholesaler'],
      [9, 'Sunfeast Dark Fantasy Choco Fills 300g', 'Sunfeast', 1, 10, 'R314-0009', 150, 140, 112.0, 4, 'box', 5, 'Blinkit Wholesaler'],
      [10, 'Coca-Cola Can 300ml', 'Coca-Cola', 2, 11, 'R314-0010', 40, 40, 31.0, 30, 'can', 10, 'Blinkit Wholesaler'],
      [11, 'Thums Up Can 300ml', 'Thums Up', 2, 11, 'R314-0011', 40, 40, 31.0, 24, 'can', 10, 'Blinkit Wholesaler'],
      [12, 'Sprite Bottle 750ml', 'Sprite', 2, 11, 'R314-0012', 40, 40, 32.5, 16, 'bottle', 6, 'Blinkit Wholesaler'],
      [13, 'Frooti Mango Drink 160ml Tetra Pack', 'Frooti', 2, 12, 'R314-0013', 10, 10, 8.0, 45, 'packet', 15, 'Blinkit Wholesaler'],
      [14, 'Real Fruit Power Mixed Fruit Juice 1L', 'Real', 2, 12, 'R314-0014', 130, 120, 98.0, 8, 'packet', 5, 'Blinkit Wholesaler'],
      [15, 'Bisleri Packaged Drinking Water 1L', 'Bisleri', 2, 14, 'R314-0015', 20, 20, 14.0, 40, 'bottle', 15, 'Blinkit Wholesaler'],
      [16, 'Red Bull Energy Drink 250ml', 'Red Bull', 2, 11, 'R314-0016', 125, 125, 102.0, 2, 'can', 5, 'Blinkit Wholesaler'],
      [17, 'Amul Taaza Homogenised Toned Milk 1L', 'Amul', 3, 15, 'R314-0017', 74, 74, 66.0, 14, 'packet', 6, 'Blinkit Wholesaler'],
      [18, 'Amul Butter 100g', 'Amul', 3, 16, 'R314-0018', 60, 60, 52.0, 18, 'packet', 5, 'Blinkit Wholesaler'],
      [19, 'Amul Processed Cheese Cubes 200g', 'Amul', 3, 16, 'R314-0019', 145, 140, 120.0, 10, 'box', 4, 'Blinkit Wholesaler'],
      [20, 'Maggi 2-Minute Masala Instant Noodles 4x70g', 'Maggi', 4, 17, 'R314-0020', 56, 56, 46.5, 30, 'packet', 10, 'Blinkit Wholesaler'],
      [21, 'Maggi 2-Minute Masala Single Pack 70g', 'Maggi', 4, 17, 'R314-0021', 14, 14, 11.5, 50, 'packet', 15, 'Blinkit Wholesaler'],
      [22, 'Yippee Magic Masala Noodles 240g', 'Sunfeast', 4, 17, 'R314-0022', 50, 48, 40.0, 15, 'packet', 6, 'Blinkit Wholesaler'],
      [23, 'Fortune Sunlite Refined Sunflower Oil 1L Pouch', 'Fortune', 4, 19, 'R314-0023', 155, 148, 130.0, 12, 'pouch', 5, 'Blinkit Wholesaler'],
      [24, 'Tata Salt Vacuum Evaporated 1kg', 'Tata', 4, 19, 'R314-0024', 28, 28, 23.0, 25, 'packet', 8, 'Blinkit Wholesaler'],
      [25, 'Cadbury Dairy Milk Silk Chocolate 60g', 'Cadbury', 7, null, 'R314-0025', 80, 80, 65.0, 25, 'bar', 8, 'Blinkit Wholesaler'],
    ];

    for (const p of seedProducts) {
      insertProduct.run(...p);
    }
  }
}

function reloadDatabase() {
  if (dbInstance) {
    try {
      dbInstance.pragma('wal_checkpoint(TRUNCATE)');
      dbInstance.close();
    } catch (e) {
      console.warn('Error closing database during reload:', e.message);
    }
  }
  return initDatabase();
}

// Initialize database on require
initDatabase();

// Export database proxy so all callers always get the active database instance
module.exports = new Proxy({}, {
  get(target, prop) {
    if (prop === 'reloadDatabase') return reloadDatabase;
    if (prop === 'close') {
      return () => {
        if (dbInstance) {
          try { dbInstance.pragma('wal_checkpoint(TRUNCATE)'); dbInstance.close(); } catch (e) {}
        }
      };
    }
    return dbInstance[prop];
  }
});
