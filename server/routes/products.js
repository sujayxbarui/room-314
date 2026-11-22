const express = require('express');
const Product = require('../models/Product');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/products/search?q=term
router.get('/search', (req, res, next) => {
  try {
    const q = req.query.q || '';
    const limit = parseInt(req.query.limit, 10) || 20;
    const results = Product.search(q, limit);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/low-stock
router.get('/low-stock', (req, res, next) => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold, 10) : undefined;
    const items = Product.getLowStock(threshold);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/out-of-stock
router.get('/out-of-stock', (req, res, next) => {
  try {
    const items = Product.getOutOfStock();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/duplicate-check?name=&brand=
router.get('/duplicate-check', (req, res, next) => {
  try {
    const { name, brand } = req.query;
    if (!name) return res.json({ duplicate: false });
    const existing = Product.checkDuplicate(name, brand);
    res.json({ duplicate: !!existing, product: existing });
  } catch (err) {
    next(err);
  }
});

// GET /api/products
router.get('/', (req, res, next) => {
  try {
    const filters = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 50,
      category_id: req.query.category_id ? parseInt(req.query.category_id, 10) : undefined,
      stock_status: req.query.stock_status,
      search: req.query.search,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
      include_archived: req.query.include_archived === 'true'
    };
    const result = Product.list(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/:id', (req, res, next) => {
  try {
    const product = Product.findById(parseInt(req.params.id, 10));
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/products (Admin only)
router.post('/', requireAdmin, (req, res, next) => {
  try {
    const { name, selling_price } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Product name is required' });
    }

    let price = selling_price;
    if (price === undefined || price === null || price === '' || isNaN(Number(price))) {
      if (req.body.mrp !== undefined && req.body.mrp !== null && req.body.mrp !== '' && !isNaN(Number(req.body.mrp))) {
        price = parseFloat(req.body.mrp);
      } else {
        return res.status(400).json({ error: 'Valid selling price or MRP is required' });
      }
    }

    const mrp = req.body.mrp !== undefined && req.body.mrp !== '' ? parseFloat(req.body.mrp) : parseFloat(price);
    const purchasePrice = req.body.purchase_price !== undefined && req.body.purchase_price !== '' 
      ? parseFloat(req.body.purchase_price) 
      : Math.round(parseFloat(price) * 0.82 * 10) / 10;

    const product = Product.create({
      name: name.trim(),
      brand: req.body.brand ? req.body.brand.trim() : null,
      category_id: req.body.category_id ? parseInt(req.body.category_id, 10) : null,
      subcategory_id: req.body.subcategory_id ? parseInt(req.body.subcategory_id, 10) : null,
      sku: req.body.sku ? req.body.sku.trim() : null,
      mrp: mrp,
      selling_price: parseFloat(price),
      purchase_price: purchasePrice,
      stock: req.body.stock !== undefined && req.body.stock !== '' ? parseInt(req.body.stock, 10) : 10,
      unit: req.body.unit || 'packet',
      low_stock_threshold: req.body.low_stock_threshold ? parseInt(req.body.low_stock_threshold, 10) : 5,
      supplier: req.body.supplier ? req.body.supplier.trim() : null,
      image_url: req.body.image_url || null,
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/bulk (Admin only)
router.post('/bulk', requireAdmin, (req, res, next) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Array of products is required' });
    }

    const created = Product.bulkCreate(products);
    res.status(201).json({ count: created.length, products: created });
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id (Admin only)
router.put('/:id', requireAdmin, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = Product.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updated = Product.update(id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id (Archive - Admin only)
router.delete('/:id', requireAdmin, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const product = Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    Product.archive(id);
    res.json({ message: 'Product archived successfully', id });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id/permanent (Permanent delete - Admin only)
router.delete('/:id/permanent', requireAdmin, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = require('../db');
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ message: 'Product permanently removed', id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

