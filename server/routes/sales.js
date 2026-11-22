const express = require('express');
const Sale = require('../models/Sale');
const config = require('../config');
const { generateReceiptText, generateShareLink } = require('../services/whatsapp');
const { archiveDailySales } = require('../services/salesArchiver');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// POST /api/sales - Checkout / Create sale
router.post('/', (req, res, next) => {
  try {
    const { items, payment_method, amount_paid, discount, customer_name, customer_phone, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required in the cart' });
    }

    const sale = Sale.create(
      {
        payment_method: payment_method || 'cash',
        amount_paid: amount_paid !== undefined ? parseFloat(amount_paid) : undefined,
        discount: discount ? parseFloat(discount) : 0,
        customer_name: customer_name ? customer_name.trim() : null,
        customer_phone: customer_phone ? customer_phone.trim() : null,
        notes: notes ? notes.trim() : null,
      },
      items,
      req.user.id
    );

    // Auto-archive sales for today into sales_records folder
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      archiveDailySales(todayStr);
    } catch (e) {}

    // Generate WhatsApp text and share link if customer phone or requested
    const receiptText = generateReceiptText(sale, config.shop);
    const whatsappLink = customer_phone
      ? generateShareLink(customer_phone, receiptText)
      : generateShareLink('', receiptText);

    res.status(201).json({
      ...sale,
      receipt_text: receiptText,
      whatsapp_link: whatsappLink,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/daily/summary?date=YYYY-MM-DD
router.get('/daily/summary', (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const summary = Sale.getDailySummary(date);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/sales
router.get('/', (req, res, next) => {
  try {
    const filters = {
      date: req.query.date,
      from: req.query.from,
      to: req.query.to,
      status: req.query.status,
      payment_method: req.query.payment_method,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 50,
    };
    const result = Sale.list(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/:id
router.get('/:id', (req, res, next) => {
  try {
    const sale = Sale.findById(parseInt(req.params.id, 10));
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const receiptText = generateReceiptText(sale, config.shop);
    const whatsappLink = sale.customer_phone
      ? generateShareLink(sale.customer_phone, receiptText)
      : generateShareLink('', receiptText);

    res.json({
      ...sale,
      receipt_text: receiptText,
      whatsapp_link: whatsappLink,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sales/:id/cancel
router.post('/:id/cancel', (req, res, next) => {
  try {
    const { reason } = req.body;
    const cancelled = Sale.cancel(parseInt(req.params.id, 10), req.user.id, reason || 'Customer cancellation');
    res.json(cancelled);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

