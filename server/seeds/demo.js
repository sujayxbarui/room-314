const bcrypt = require('bcryptjs');
const db = require('../db');

console.log('Seeding Room-314 Demo Data...\n');

const run = db.transaction(() => {
  // 1. Users
  console.log('1. Creating demo users...');
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('admin123', salt);

  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  insertUser.run(1, 'Sujay (Owner)', 'owner@room314.com', passwordHash, 'admin');
  insertUser.run(2, 'Co-founder', 'partner@room314.com', passwordHash, 'admin');
  console.log('   ✅ 2 users created: owner@room314.com / admin123, partner@room314.com / admin123');

  // 2. Categories
  console.log('2. Creating categories & subcategories...');
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, parent_id, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  // Parent Categories
  insertCat.run(1, 'Snacks', null, 1);
  insertCat.run(2, 'Beverages', null, 2);
  insertCat.run(3, 'Dairy', null, 3);
  insertCat.run(4, 'Packaged Food', null, 4);
  insertCat.run(5, 'Personal Care', null, 5);
  insertCat.run(6, 'Household', null, 6);
  insertCat.run(7, 'Chocolates & Sweets', null, 7);
  insertCat.run(8, 'Bakery & Breads', null, 8);

  // Subcategories
  insertCat.run(9, 'Chips & Namkeen', 1, 1);
  insertCat.run(10, 'Biscuits & Cookies', 1, 2);
  insertCat.run(11, 'Soft Drinks', 2, 1);
  insertCat.run(12, 'Juices', 2, 2);
  insertCat.run(13, 'Tea & Coffee', 2, 3);
  insertCat.run(14, 'Water', 2, 4);
  insertCat.run(15, 'Milk', 3, 1);
  insertCat.run(16, 'Curd & Paneer', 3, 2);
  insertCat.run(17, 'Instant Noodles', 4, 1);
  insertCat.run(18, 'Rice & Atta', 4, 2);
  insertCat.run(19, 'Masala & Spices', 4, 3);
  insertCat.run(20, 'Oral Care', 5, 1);
  insertCat.run(21, 'Soaps & Shampoo', 5, 2);
  insertCat.run(22, 'Laundry & Cleaning', 6, 1);

  console.log('   ✅ Categories and subcategories seeded.');

  // 3. Category Mappings (for auto-categorization learning)
  console.log('3. Seeding category keyword mappings...');
  const insertMap = db.prepare(`
    INSERT OR IGNORE INTO category_mappings (keyword, category_id, confidence, source)
    VALUES (?, ?, ?, 'seed')
  `);
  insertMap.run('lays', 9, 1.0);
  insertMap.run('bingo', 9, 1.0);
  insertMap.run('kurkure', 9, 1.0);
  insertMap.run('haldiram', 9, 1.0);
  insertMap.run('parle-g', 10, 1.0);
  insertMap.run('good day', 10, 1.0);
  insertMap.run('oreo', 10, 1.0);
  insertMap.run('coca-cola', 11, 1.0);
  insertMap.run('thums up', 11, 1.0);
  insertMap.run('frooti', 12, 1.0);
  insertMap.run('amul milk', 15, 1.0);
  insertMap.run('maggi', 17, 1.0);
  insertMap.run('colgate', 20, 1.0);
  insertMap.run('surf excel', 22, 1.0);
  console.log('   ✅ Category mappings seeded.');

  // 4. Products
  console.log('4. Seeding packaged food products...');
  const insertProduct = db.prepare(`
    INSERT OR REPLACE INTO products (
      id, name, brand, category_id, subcategory_id, sku, mrp, selling_price, purchase_price, stock, unit, low_stock_threshold, supplier
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    // Snacks - Chips
    [1, 'Lay\'s Classic Salted Potato Chips 50g', 'Lay\'s', 1, 9, 'R314-0001', 20, 20, 16.5, 35, 'packet', 10, 'Blinkit Wholesaler'],
    [2, 'Lay\'s India\'s Magic Masala 50g', 'Lay\'s', 1, 9, 'R314-0002', 20, 20, 16.5, 28, 'packet', 10, 'Blinkit Wholesaler'],
    [3, 'Bingo Mad Angles Achaari Masti 66g', 'Bingo', 1, 9, 'R314-0003', 20, 20, 16.0, 18, 'packet', 8, 'Blinkit Wholesaler'],
    [4, 'Kurkure Masala Munch 82g', 'Kurkure', 1, 9, 'R314-0004', 20, 20, 16.5, 22, 'packet', 10, 'Blinkit Wholesaler'],
    [5, 'Haldiram\'s Aloo Bhujia 150g', 'Haldiram\'s', 1, 9, 'R314-0005', 55, 52, 42.0, 15, 'packet', 5, 'Blinkit Wholesaler'],
    // Snacks - Biscuits
    [6, 'Parle-G Gold Biscuits 1kg', 'Parle', 1, 10, 'R314-0006', 140, 135, 115.0, 12, 'packet', 5, 'Blinkit Wholesaler'],
    [7, 'Britannia Good Day Butter Cookies 200g', 'Britannia', 1, 10, 'R314-0007', 45, 42, 34.0, 25, 'packet', 8, 'Blinkit Wholesaler'],
    [8, 'Cadbury Oreo Original Vanilla Biscuits 120g', 'Cadbury', 1, 10, 'R314-0008', 35, 35, 28.5, 20, 'packet', 6, 'Blinkit Wholesaler'],
    [9, 'Sunfeast Dark Fantasy Choco Fills 300g', 'Sunfeast', 1, 10, 'R314-0009', 150, 140, 112.0, 4, 'box', 5, 'Blinkit Wholesaler'], // Low stock!
    // Beverages - Soft drinks
    [10, 'Coca-Cola Can 300ml', 'Coca-Cola', 2, 11, 'R314-0010', 40, 40, 31.0, 30, 'can', 10, 'Blinkit Wholesaler'],
    [11, 'Thums Up Can 300ml', 'Thums Up', 2, 11, 'R314-0011', 40, 40, 31.0, 24, 'can', 10, 'Blinkit Wholesaler'],
    [12, 'Sprite Bottle 750ml', 'Sprite', 2, 11, 'R314-0012', 40, 40, 32.5, 16, 'bottle', 6, 'Blinkit Wholesaler'],
    [13, 'Frooti Mango Drink 160ml Tetra Pack', 'Frooti', 2, 12, 'R314-0013', 10, 10, 8.0, 45, 'packet', 15, 'Blinkit Wholesaler'],
    [14, 'Real Fruit Power Mixed Fruit Juice 1L', 'Real', 2, 12, 'R314-0014', 130, 120, 98.0, 8, 'packet', 5, 'Blinkit Wholesaler'],
    [15, 'Bisleri Packaged Drinking Water 1L', 'Bisleri', 2, 14, 'R314-0015', 20, 20, 14.0, 40, 'bottle', 15, 'Blinkit Wholesaler'],
    [16, 'Red Bull Energy Drink 250ml', 'Red Bull', 2, 11, 'R314-0016', 125, 125, 102.0, 2, 'can', 5, 'Blinkit Wholesaler'], // Low stock!
    // Dairy
    [17, 'Amul Taaza Homogenised Toned Milk 1L', 'Amul', 3, 15, 'R314-0017', 74, 74, 66.0, 14, 'packet', 6, 'Blinkit Wholesaler'],
    [18, 'Amul Butter 100g', 'Amul', 3, 16, 'R314-0018', 60, 60, 52.0, 18, 'packet', 5, 'Blinkit Wholesaler'],
    [19, 'Amul Processed Cheese Cubes 200g', 'Amul', 3, 16, 'R314-0019', 145, 140, 120.0, 10, 'box', 4, 'Blinkit Wholesaler'],
    // Packaged Food - Noodles & Staples
    [20, 'Maggi 2-Minute Masala Instant Noodles 4x70g', 'Maggi', 4, 17, 'R314-0020', 56, 56, 46.5, 30, 'packet', 10, 'Blinkit Wholesaler'],
    [21, 'Maggi 2-Minute Masala Single Pack 70g', 'Maggi', 4, 17, 'R314-0021', 14, 14, 11.5, 50, 'packet', 15, 'Blinkit Wholesaler'],
    [22, 'Yippee Magic Masala Noodles 240g', 'Sunfeast', 4, 17, 'R314-0022', 50, 48, 40.0, 15, 'packet', 6, 'Blinkit Wholesaler'],
    [23, 'Knorr Soupy Noodles 4x70g', 'Knorr', 4, 17, 'R314-0023', 65, 60, 49.0, 0, 'packet', 5, 'Blinkit Wholesaler'], // Out of stock!
    [24, 'Fortune Sunlite Refined Sunflower Oil 1L Pouch', 'Fortune', 4, 19, 'R314-0024', 155, 148, 130.0, 12, 'pouch', 5, 'Blinkit Wholesaler'],
    [25, 'Tata Salt Vacuum Evaporated 1kg', 'Tata', 4, 19, 'R314-0025', 28, 28, 23.0, 25, 'packet', 8, 'Blinkit Wholesaler'],
    [26, 'MDH Deggi Mirch Powder 100g', 'MDH', 4, 19, 'R314-0026', 92, 88, 73.0, 9, 'box', 4, 'Blinkit Wholesaler'],
    // Chocolates
    [27, 'Cadbury Dairy Milk Silk Chocolate 60g', 'Cadbury', 7, null, 'R314-0027', 85, 80, 67.0, 22, 'packet', 8, 'Blinkit Wholesaler'],
    [28, 'Nestle KitKat 4 Finger 38.5g', 'Nestle', 7, null, 'R314-0028', 30, 30, 24.5, 35, 'packet', 10, 'Blinkit Wholesaler'],
    [29, 'Ferrero Rocher 4 Pieces Box 50g', 'Ferrero', 7, null, 'R314-0029', 190, 180, 148.0, 0, 'box', 3, 'Blinkit Wholesaler'], // Out of stock!
    // Household / Essentials
    [30, 'Surf Excel Quick Wash Detergent Powder 1kg', 'Surf Excel', 6, 22, 'R314-0030', 215, 205, 175.0, 10, 'packet', 4, 'Blinkit Wholesaler'],
    [31, 'Colgate MaxFresh Peppermint Ice Toothpaste 150g', 'Colgate', 5, 20, 'R314-0031', 125, 115, 96.0, 14, 'box', 5, 'Blinkit Wholesaler'],
  ];

  for (const p of products) {
    insertProduct.run(...p);
  }
  console.log(`   ✅ ${products.length} products seeded with stock and prices.`);

  // 5. Initial stock purchase record (for audit trail)
  console.log('5. Creating initial stock purchase record...');
  const insertPurchase = db.prepare(`
    INSERT OR REPLACE INTO stock_purchases (id, supplier, purchase_date, invoice_number, total_amount, notes, user_id)
    VALUES (1, 'Blinkit Wholesale', datetime('now', '-2 days'), 'BLINK-OCT2026-904', 18450.0, 'Initial shop opening inventory batch from Blinkit', 1)
  `);
  insertPurchase.run();

  // 6. A couple of demo sales from today to make the dashboard live
  console.log('6. Seeding initial demo sales for today...');
  const insertSale = db.prepare(`
    INSERT OR REPLACE INTO sales (
      id, receipt_number, sale_date, subtotal, discount, total, payment_method, amount_paid, change_due, customer_name, customer_phone, status, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 1)
  `);

  const insertSaleItem = db.prepare(`
    INSERT OR REPLACE INTO sale_items (
      id, sale_id, product_id, product_name_snapshot, quantity, unit_price, mrp_snapshot, purchase_price_snapshot, discount, line_total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Sale 1 - Cash
  insertSale.run(1, `R314-${todayStr.replace(/-/g, '')}-0001`, `${todayStr} 10:15:00`, 94, 0, 94, 'cash', 100, 6, 'Aman', '9876543210');
  insertSaleItem.run(1, 1, 1, 'Lay\'s Classic Salted Potato Chips 50g', 2, 20, 20, 16.5, 0, 40);
  insertSaleItem.run(2, 1, 20, 'Maggi 2-Minute Masala Instant Noodles 4x70g', 1, 56, 56, 46.5, 0, 56);

  // Sale 2 - UPI
  insertSale.run(2, `R314-${todayStr.replace(/-/g, '')}-0002`, `${todayStr} 11:42:00`, 160, 0, 160, 'upi', 160, 0, null, null);
  insertSaleItem.run(3, 2, 10, 'Coca-Cola Can 300ml', 2, 40, 40, 31.0, 0, 80);
  insertSaleItem.run(4, 2, 27, 'Cadbury Dairy Milk Silk Chocolate 60g', 1, 80, 85, 67.0, 0, 80);

  // Sale 3 - UPI with discount
  insertSale.run(3, `R314-${todayStr.replace(/-/g, '')}-0003`, `${todayStr} 14:20:00`, 219, 10, 209, 'upi', 209, 0, 'Pooja', '9812345678');
  insertSaleItem.run(5, 3, 7, 'Britannia Good Day Butter Cookies 200g', 2, 42, 45, 34.0, 0, 84);
  insertSaleItem.run(6, 3, 6, 'Parle-G Gold Biscuits 1kg', 1, 135, 140, 115.0, 10, 125);

  console.log('   ✅ 3 initial demo sales seeded for today.');

  // Settings
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES
    ('shop_name', 'Room-314'),
    ('shop_address', 'Counter 1, Block A, Room-314'),
    ('shop_phone', '+91 98765 43210')
  `).run();

  console.log('\n🎉 Demo data successfully loaded!');
  console.log('--------------------------------------------------');
  console.log('Credentials:');
  console.log('  Owner:      owner@room314.com / admin123');
  console.log('  Co-founder: partner@room314.com / admin123');
  console.log('--------------------------------------------------');
});

try {
  run();
} catch (err) {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
} finally {
  db.close();
}

