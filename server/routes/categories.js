const express = require('express');
const Category = require('../models/Category');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/categories (tree structure)
router.get('/', (req, res, next) => {
  try {
    const tree = Category.list();
    res.json(tree);
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/flat (flat list)
router.get('/flat', (req, res, next) => {
  try {
    const flat = Category.listFlat();
    res.json(flat);
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:id
router.get('/:id', (req, res, next) => {
  try {
    const cat = Category.findById(parseInt(req.params.id, 10));
    if (!cat) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(cat);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories (Admin only)
router.post('/', requireAdmin, (req, res, next) => {
  try {
    const { name, parent_id } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const cat = Category.create(name.trim(), parent_id ? parseInt(parent_id, 10) : null);
    res.status(201).json(cat);
  } catch (err) {
    next(err);
  }
});

// PUT /api/categories/:id (Admin only)
router.put('/:id', requireAdmin, (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const updated = Category.update(parseInt(req.params.id, 10), name.trim());
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categories/:id (Admin only)
router.delete('/:id', requireAdmin, (req, res, next) => {
  try {
    const result = Category.delete(parseInt(req.params.id, 10));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories/merge
router.post('/merge', (req, res, next) => {
  try {
    const { source_id, target_id } = req.body;
    if (!source_id || !target_id) {
      return res.status(400).json({ error: 'source_id and target_id are required' });
    }
    const result = Category.merge(parseInt(source_id, 10), parseInt(target_id, 10));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

