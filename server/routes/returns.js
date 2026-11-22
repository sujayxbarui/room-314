const express = require('express');
const Return = require('../models/Return');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// POST /api/returns - Process a return
router.post('/', (req, res, next) => {
  try {
    const { original_sale_id, refund_amount, refund_method, reason, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required for a return' });
    }

    const ret = Return.create(
      {
        original_sale_id: original_sale_id ? parseInt(original_sale_id, 10) : null,
        refund_amount: refund_amount !== undefined ? parseFloat(refund_amount) : undefined,
        refund_method: refund_method || 'cash',
        reason: reason ? reason.trim() : null,
      },
      items,
      req.user.id
    );

    res.status(201).json(ret);
  } catch (err) {
    next(err);
  }
});

// GET /api/returns - List returns
router.get('/', (req, res, next) => {
  try {
    const filters = {
      from: req.query.from,
      to: req.query.to,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 50,
    };
    const returns = Return.list(filters);
    res.json(returns);
  } catch (err) {
    next(err);
  }
});

// GET /api/returns/:id
router.get('/:id', (req, res, next) => {
  try {
    const ret = Return.findById(parseInt(req.params.id, 10));
    if (!ret) {
      return res.status(404).json({ error: 'Return record not found' });
    }
    res.json(ret);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

