/**
 * Automated Verification Test Suite for Room-314 Kirana Store POS & Inventory
 */
const assert = require('assert');
const path = require('path');
const db = require('../db');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Return = require('../models/Return');
const Report = require('../models/Report');
const { suggestCategory } = require('../services/categorization');
const { generateReceiptText, generateShareLink } = require('../services/whatsapp');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

console.log('==================================================');
console.log('🧪 RUNNING ROOM-314 AUTOMATED VERIFICATION SUITE');
console.log('==================================================\n');

// 1. User & Auth
console.log('--- 1. Authentication & Users ---');
test('Find seeded user by email and verify password', () => {
  const user = User.findByEmail('owner@room314.com');
  assert(user, 'User should exist');
  assert(user.name.includes('Owner'), 'User name matches');
  const valid = User.verifyPassword('admin123', user.password_hash);
  assert(valid, 'Password matches');
});

// 2. Intelligent Categorization
console.log('\n--- 2. Smart Categorization Engine ---');
test('Suggest category for known brand (Lays)', () => {
  const res = suggestCategory("Lay's Sizzling Hot 50g");
  assert.strictEqual(res.category, 'Snacks');
  assert.strictEqual(res.subcategory, 'Chips & Namkeen');
});

test('Suggest category for noodles (Maggi)', () => {
  const res = suggestCategory('Maggi Special Masala Noodles 70g');
  assert.strictEqual(res.category, 'Packaged Food');
  assert.strictEqual(res.subcategory, 'Instant Noodles');
});

test('Suggest category for beverage (Coca-Cola)', () => {
  const res = suggestCategory('Coca-Cola Can 300ml');
  assert.strictEqual(res.category, 'Beverages');
});

test('Category correction learning persistence', () => {
  const keyword = 'specialmasalatea';
  // Insert custom mapping
  db.prepare(`
    INSERT OR REPLACE INTO category_mappings (keyword, category_id, confidence, source)
    VALUES (?, 2, 1.0, 'test')
  `).run(keyword);

  const matched = suggestCategory(`Buy ${keyword} pack`);
  assert.strictEqual(matched.category_id, 2);
  assert.strictEqual(matched.source, 'database_mapping');
});

// 3. Products & Stock
console.log('\n--- 3. Product Catalog & Inventory ---');
let createdProductId;
test('Create new product with auto-generated SKU', () => {
  const prod = Product.create({
    name: 'Act II Golden Crunch Popcorn 60g',
    brand: 'Act II',
    category_id: 1,
    selling_price: 35.0,
    mrp: 35.0,
    purchase_price: 27.5,
    stock: 20,
    unit: 'packet',
    low_stock_threshold: 5,
  });

  assert(prod.id, 'Product ID generated');
  assert(prod.sku && prod.sku.startsWith('R314-'), 'SKU generated with R314- prefix');
  assert.strictEqual(prod.stock, 20);
  createdProductId = prod.id;
});

test('Check duplicate product detection', () => {
  const dup = Product.checkDuplicate('Act II Golden Crunch Popcorn 60g', 'Act II');
  assert(dup, 'Duplicate found');
  assert(dup.name.toLowerCase().includes('popcorn'), 'Duplicate product detected by name and brand');
});

test('Record incoming stock purchase for product', () => {
  const purchase = Inventory.recordPurchase(
    {
      supplier: 'Blinkit Wholesaler',
      invoice_number: 'TEST-INV-100',
      purchase_date: '2026-10-30',
      notes: 'Test incoming purchase batch',
    },
    [
      {
        product_id: createdProductId,
        quantity: 15,
        purchase_price: 26.0,
        update_product_price: true,
      },
    ],
    1
  );

  assert(purchase.id, 'Purchase record created');
  const updatedProd = Product.findById(createdProductId);
  assert.strictEqual(updatedProd.stock, 35, 'Stock increased from 20 to 35 (20+15)');
  assert.strictEqual(updatedProd.purchase_price, 26.0, 'Updated purchase price');
});

// 4. POS Billing & Checkout Integrity
console.log('\n--- 4. POS Billing & Checkout Integrity ---');
let testSaleId;
let testReceiptNumber;

test('Complete multi-item checkout without customer details', () => {
  const stockBefore = Product.findById(createdProductId).stock;

  const sale = Sale.create(
    {
      payment_method: 'upi',
      amount_paid: 70.0,
      discount: 0,
      customer_name: null,
      customer_phone: null,
    },
    [
      {
        product_id: createdProductId,
        quantity: 2,
        unit_price: 35.0,
      },
    ],
    1
  );

  assert(sale.id, 'Sale created');
  assert(sale.receipt_number, 'Receipt number generated');
  assert.strictEqual(sale.total, 70.0);
  assert.strictEqual(sale.payment_method, 'upi');

  const stockAfter = Product.findById(createdProductId).stock;
  assert.strictEqual(stockAfter, stockBefore - 2, 'Stock deducted accurately by 2');

  testSaleId = sale.id;
  testReceiptNumber = sale.receipt_number;
});

test('Prevent sale when stock is insufficient (Transaction Atomicity)', () => {
  const currentStock = Product.findById(createdProductId).stock;
  let errorCaught = false;

  try {
    Sale.create(
      {
        payment_method: 'cash',
        amount_paid: 5000,
      },
      [
        {
          product_id: createdProductId,
          quantity: currentStock + 999, // Way more than stock!
          unit_price: 35.0,
        },
      ],
      1
    );
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('Insufficient stock'), 'Error mentions insufficient stock');
  }

  assert(errorCaught, 'Sale was blocked');
  const stockUnchanged = Product.findById(createdProductId).stock;
  assert.strictEqual(stockUnchanged, currentStock, 'Stock remains unchanged after failed sale');
});

// 5. WhatsApp Receipt Link
console.log('\n--- 5. WhatsApp Digital Receipt ---');
test('Generate clean WhatsApp receipt text and wa.me deep link', () => {
  const sale = Sale.findById(testSaleId);
  const text = generateReceiptText(sale, { name: 'Room-314', phone: '+91 98765 43210' });

  assert(text.includes('Room-314'), 'Receipt has shop name');
  assert(text.includes(testReceiptNumber), 'Receipt has receipt number');
  assert(text.includes('70.00'), 'Receipt has total amount');
  assert(text.includes('UPI'), 'Receipt has payment mode');

  const link = generateShareLink('9876543210', text);
  assert(link.startsWith('https://wa.me/919876543210'), 'wa.me deep link properly formatted with country code 91');
});

// 6. Returns & Stock Restocking
console.log('\n--- 6. Returns & Cancellations ---');
test('Process return of item with restocking into inventory', () => {
  const stockBeforeReturn = Product.findById(createdProductId).stock;

  const returnRecord = Return.create(
    {
      original_sale_id: testSaleId,
      refund_amount: 35.0,
      refund_method: 'cash',
      reason: 'Customer bought wrong flavor',
    },
    [
      {
        product_id: createdProductId,
        quantity: 1,
        unit_price: 35.0,
        restock: true,
      },
    ],
    1
  );

  assert(returnRecord.id, 'Return record created');
  const stockAfterReturn = Product.findById(createdProductId).stock;
  assert.strictEqual(stockAfterReturn, stockBeforeReturn + 1, 'Restocked 1 unit back into inventory');
});

// 7. Reports & Profit Calculation
console.log('\n--- 7. Reports & Gross Profit Calculations ---');
test('Verify daily sales report and gross margin calculations', () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const report = Report.dailySales(todayStr);

  assert(report.total_sales > 0, 'Total sales > 0');
  assert(report.transaction_count > 0, 'Transactions counted');
  assert(report.estimated_profit !== undefined, 'Gross profit calculated');
  assert(report.cogs !== undefined, 'COGS calculated');

  // Verify Gross Profit = Revenue - COGS
  const expectedProfit = report.total_sales - report.cogs;
  assert.strictEqual(
    Math.round(report.estimated_profit * 100) / 100,
    Math.round(expectedProfit * 100) / 100,
    'Gross profit matches revenue minus COGS'
  );
});

test('Verify best-sellers report', () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const best = Report.bestSellers(todayStr, todayStr, 5);
  assert(Array.isArray(best), 'Best sellers returns an array');
  assert(best.length > 0, 'At least one best seller found');
  assert(best[0].total_quantity >= 1, 'Quantity recorded');
});

test('Verify inventory valuation report', () => {
  const val = Report.inventoryValuation();
  assert(val.total_cost_value > 0, 'Total cost value > 0');
  assert(val.total_retail_value > 0, 'Total retail value > 0');
  assert(val.by_category.length > 0, 'Categorized breakdown present');
});

// 8. Backup Verification
console.log('\n--- 8. Backup System ---');
test('Database backup file generation', () => {
  const fs = require('fs');
  const backupScript = require('../../backups/backup.js');
  // Check backups dir has files
  const backupFiles = fs.readdirSync(path.resolve(__dirname, '../../backups'))
    .filter(f => f.endsWith('.db'));
  assert(backupFiles.length > 0, 'Backup database file was created');
});

console.log('\n==================================================');
console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('==================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL CRITICAL APPLICATION SCENARIOS VERIFIED 100% WORKING!\n');
}
