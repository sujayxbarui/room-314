const express = require('express');
const db = require('../db');
const Inventory = require('../models/Inventory');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/inventory - Inventory overview with stock values and status
router.get('/', (req, res, next) => {
  try {
    const filters = {
      category_id: req.query.category_id ? parseInt(req.query.category_id, 10) : undefined,
      stock_status: req.query.stock_status,
      search: req.query.search,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 50,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
    };
    const overview = Inventory.getInventoryOverview(filters);
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/purchase - Record stock purchase (Admin only)
router.post('/purchase', requireAdmin, (req, res, next) => {
  try {
    const { supplier, purchase_date, invoice_number, notes, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required in the purchase' });
    }

    const purchase = Inventory.recordPurchase(
      {
        supplier: supplier ? supplier.trim() : null,
        purchase_date: purchase_date || new Date().toISOString().slice(0, 10),
        invoice_number: invoice_number ? invoice_number.trim() : null,
        notes: notes ? notes.trim() : null,
      },
      items,
      req.user.id
    );

    res.status(201).json(purchase);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/adjust - Stock adjustment (Admin only)
router.post('/adjust', requireAdmin, (req, res, next) => {
  try {
    const { product_id, quantity_change, reason, notes } = req.body;

    if (!product_id || quantity_change === undefined || !reason) {
      return res.status(400).json({ error: 'product_id, quantity_change, and reason are required' });
    }

    const change = parseInt(quantity_change, 10);
    if (isNaN(change) || change === 0) {
      return res.status(400).json({ error: 'quantity_change must be a non-zero integer' });
    }

    const result = Inventory.adjustStock(
      parseInt(product_id, 10),
      change,
      reason.trim(),
      notes ? notes.trim() : null,
      req.user.id
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/purchases - Purchase history
router.get('/purchases', (req, res, next) => {
  try {
    const filters = {
      from: req.query.from,
      to: req.query.to,
      supplier: req.query.supplier,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 50,
    };
    const purchases = Inventory.getPurchaseHistory(filters);
    res.json(purchases);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/ledger - Stock movement ledger
router.get('/ledger', (req, res, next) => {
  try {
    const productId = req.query.product_id ? parseInt(req.query.product_id, 10) : null;
    const ledger = Inventory.getStockLedger(productId, req.query.from, req.query.to);
    res.json(ledger);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/ledger/:productId
router.get('/ledger/:productId', (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const ledger = Inventory.getStockLedger(productId, req.query.from, req.query.to);
    res.json(ledger);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/quick-sync - Fast multi-product stock increase & sync
router.post('/quick-sync', (req, res, next) => {
  try {
    const { updates } = req.body;
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Updates list is required' });
    }

    const Product = require('../models/Product');
    const syncTransaction = db.transaction(() => {
      let updatedCount = 0;
      for (const item of updates) {
        const id = parseInt(item.product_id, 10);
        const addQty = parseInt(item.add_quantity, 10) || 0;
        if (addQty !== 0) {
          Product.updateStock(
            id,
            addQty,
            'purchase',
            'stock_quick_sync',
            null,
            req.user.id,
            `Quick Stock Sync (+${addQty})`
          );
          updatedCount++;
        }
        if (item.selling_price !== undefined && parseFloat(item.selling_price) > 0) {
          db.prepare('UPDATE products SET selling_price = ?, updated_at = datetime("now") WHERE id = ?')
            .run(parseFloat(item.selling_price), id);
        }
      }
      return updatedCount;
    });

    const count = syncTransaction();
    res.json({ success: true, count, message: `Successfully synced stock for ${count} product(s)!` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

