const express = require('express');
const Report = require('../models/Report');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const db = require('../db');
const { archiveDailySales, updateAllTimeArchive, getSalesFolderInfo, projectSalesDir } = require('../services/salesArchiver');
const { getLocalDateString } = require('../utils/date');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/reports/all-time - All-time total sales and list of sales by date
router.get('/all-time', (req, res, next) => {
  try {
    const summary = db.prepare(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total), 0) AS all_time_sales,
        COALESCE(SUM(discount), 0) AS total_discount,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN total ELSE 0 END), 0) AS total_upi
      FROM sales
      WHERE status = 'completed'
    `).get();

    const returnSummary = db.prepare(`
      SELECT
        COUNT(*) AS total_returns,
        COALESCE(SUM(refund_amount), 0) AS all_time_refunds,
        COALESCE(SUM(CASE WHEN refund_method = 'cash' THEN refund_amount ELSE 0 END), 0) AS refund_cash,
        COALESCE(SUM(CASE WHEN refund_method = 'upi' THEN refund_amount ELSE 0 END), 0) AS refund_upi
      FROM returns
      WHERE status = 'completed'
    `).get();

    const profitData = db.prepare(`
      SELECT COALESCE(SUM(si.line_total - (si.purchase_price_snapshot * si.quantity)), 0) AS total_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
    `).get();

    const returnProfitData = db.prepare(`
      SELECT COALESCE(SUM((ri.unit_price - COALESCE(p.purchase_price, 0)) * ri.quantity), 0) AS return_profit
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      LEFT JOIN products p ON ri.product_id = p.id
      WHERE r.status = 'completed'
    `).get();

    const netAllTimeSales = Math.max(0, (summary.all_time_sales || 0) - (returnSummary.all_time_refunds || 0));
    const netAllTimeProfit = Math.max(0, (profitData.total_profit || 0) - (returnProfitData.return_profit || 0));
    const netCash = Math.max(0, (summary.total_cash || 0) - (returnSummary.refund_cash || 0));
    const netUpi = Math.max(0, (summary.total_upi || 0) - (returnSummary.refund_upi || 0));

    // List of distinct dates with sales and returns, ordered newest to oldest
    const dateBreakdown = db.prepare(`
      SELECT
        dates.date,
        COALESCE(s.transaction_count, 0) AS transaction_count,
        COALESCE(r.return_count, 0) AS return_count,
        MAX(0, COALESCE(s.gross_sales, 0) - COALESCE(r.total_refunds, 0)) AS total_sales,
        COALESCE(s.gross_sales, 0) AS gross_sales,
        COALESCE(r.total_refunds, 0) AS total_refunds,
        MAX(0, COALESCE(s.cash_sales, 0) - COALESCE(r.cash_refunds, 0)) AS cash_sales,
        MAX(0, COALESCE(s.upi_sales, 0) - COALESCE(r.upi_refunds, 0)) AS upi_sales
      FROM (
        SELECT DATE(sale_date, 'localtime') AS date FROM sales WHERE status = 'completed'
        UNION
        SELECT DATE(return_date, 'localtime') AS date FROM returns WHERE status = 'completed'
      ) dates
      LEFT JOIN (
        SELECT
          DATE(sale_date, 'localtime') AS date,
          COUNT(*) AS transaction_count,
          SUM(total) AS gross_sales,
          SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) AS cash_sales,
          SUM(CASE WHEN payment_method = 'upi' THEN total ELSE 0 END) AS upi_sales
        FROM sales
        WHERE status = 'completed'
        GROUP BY DATE(sale_date, 'localtime')
      ) s ON dates.date = s.date
      LEFT JOIN (
        SELECT
          DATE(return_date, 'localtime') AS date,
          COUNT(*) AS return_count,
          SUM(refund_amount) AS total_refunds,
          SUM(CASE WHEN refund_method = 'cash' THEN refund_amount ELSE 0 END) AS cash_refunds,
          SUM(CASE WHEN refund_method = 'upi' THEN refund_amount ELSE 0 END) AS upi_refunds
        FROM returns
        WHERE status = 'completed'
        GROUP BY DATE(return_date, 'localtime')
      ) r ON dates.date = r.date
      ORDER BY dates.date DESC
    `).all();

    // Ensure sales records folder is synced
    try {
      updateAllTimeArchive();
    } catch (e) {}

    res.json({
      all_time_sales: parseFloat(netAllTimeSales.toFixed(2)),
      gross_sales: parseFloat((summary.all_time_sales || 0).toFixed(2)),
      total_refunds: parseFloat((returnSummary.all_time_refunds || 0).toFixed(2)),
      total_orders: summary.total_orders || 0,
      total_returns: returnSummary.total_returns || 0,
      total_profit: parseFloat(netAllTimeProfit.toFixed(2)),
      total_cash: parseFloat(netCash.toFixed(2)),
      total_upi: parseFloat(netUpi.toFixed(2)),
      dates: dateBreakdown.map(d => ({
        date: d.date,
        transaction_count: d.transaction_count,
        return_count: d.return_count,
        total_sales: parseFloat((d.total_sales || 0).toFixed(2)),
        gross_sales: parseFloat((d.gross_sales || 0).toFixed(2)),
        total_refunds: parseFloat((d.total_refunds || 0).toFixed(2)),
        cash_sales: parseFloat((d.cash_sales || 0).toFixed(2)),
        upi_sales: parseFloat((d.upi_sales || 0).toFixed(2)),
      })),
      sales_folder: getSalesFolderInfo().project_folder,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/folder-info - Path to daily sales files
router.get('/folder-info', (req, res) => {
  res.json(getSalesFolderInfo());
});

// POST /api/reports/reset-day?date=YYYY-MM-DD (Admin only)
// Allows manually resetting today's sales register from dashboard (safely archives to sales_records first)
router.post('/reset-day', requireAdmin, (req, res, next) => {
  try {
    const targetDate = req.body?.date || req.query.date || getLocalDateString();

    // 1. Ensure sales for this date are safely archived first
    try {
      archiveDailySales(targetDate);
    } catch (e) {}

    // 2. Find sales on this date
    const salesOnDate = db.prepare(`
      SELECT id FROM sales WHERE DATE(sale_date, 'localtime') = DATE(?)
    `).all(targetDate);

    if (salesOnDate.length > 0) {
      const saleIds = salesOnDate.map(s => s.id);
      const resetTx = db.transaction(() => {
        for (const sid of saleIds) {
          db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(sid);
          db.prepare('DELETE FROM sales WHERE id = ?').run(sid);
        }
      });
      resetTx();
    }

    // 3. Update all-time archive
    try {
      updateAllTimeArchive();
    } catch (e) {}

    res.json({
      success: true,
      message: `Sales for ${targetDate} have been safely archived to sales_records/ and the register is reset to ₹0.00!`,
      date: targetDate,
      cleared_orders: salesOnDate.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', (req, res, next) => {
  try {
    const date = req.query.date || getLocalDateString();
    const data = Report.dailySales(date);

    // Auto-save/archive daily sales file to sales_records/ folder
    try {
      archiveDailySales(date);
    } catch (e) {}

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/date-range?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/date-range', (req, res, next) => {
  try {
    const today = getLocalDateString();
    const from = req.query.from || today;
    const to = req.query.to || today;
    const summary = Report.dateRangeSummary(from, to);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/products?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/products', (req, res, next) => {
  try {
    const today = getLocalDateString();
    const from = req.query.from || today;
    const to = req.query.to || today;
    const items = Report.productWiseSales(from, to);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/categories?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/categories', (req, res, next) => {
  try {
    const today = getLocalDateString();
    const from = req.query.from || today;
    const to = req.query.to || today;
    const cats = Report.categoryWiseSales(from, to);
    res.json(cats);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/payments?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/payments', (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || today;
    const breakdown = Report.paymentBreakdown(from, to);
    res.json(breakdown);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/best-sellers?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10
router.get('/best-sellers', (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || today;
    const limit = parseInt(req.query.limit, 10) || 10;
    const best = Report.bestSellers(from, to, limit);
    res.json(best);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/low-stock
router.get('/low-stock', (req, res, next) => {
  try {
    const items = Report.lowStockReport();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/inventory-valuation
router.get('/inventory-valuation', (req, res, next) => {
  try {
    const valuation = Report.inventoryValuation();
    res.json(valuation);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/profit?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/profit', (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || today;
    const profit = Report.grossProfit(from, to);
    res.json(profit);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/export/csv?type=sales|products|inventory&from=&to=
router.get('/export/csv', (req, res, next) => {
  try {
    const type = req.query.type || 'sales';
    const today = new Date().toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || today;

    let csv = '';
    let filename = `room314-${type}-${from}-to-${to}.csv`;

    if (type === 'sales') {
      const sales = Sale.list({ from, to, limit: 10000 });
      csv = 'Receipt Number,Date,Payment Method,Subtotal,Discount,Total,Customer Name,Customer Phone,Status\n';
      for (const s of sales.sales) {
        csv += `"${s.receipt_number}","${s.sale_date}","${s.payment_method}",${s.subtotal},${s.discount},${s.total},"${s.customer_name || ''}","${s.customer_phone || ''}","${s.status}"\n`;
      }
    } else if (type === 'products') {
      const products = Product.list({ limit: 10000 });
      csv = 'SKU,Name,Brand,Category,MRP,Selling Price,Purchase Price,Stock,Unit,Status\n';
      for (const p of products.products) {
        csv += `"${p.sku || ''}","${p.name}","${p.brand || ''}","${p.category_name || ''}",${p.mrp || 0},${p.selling_price},${p.purchase_price || 0},${p.stock},"${p.unit}","${p.stock <= 0 ? 'Out of Stock' : p.stock <= p.low_stock_threshold ? 'Low Stock' : 'In Stock'}"\n`;
      }
    } else if (type === 'inventory') {
      const inv = Inventory.getInventoryOverview({ limit: 10000 });
      csv = 'Name,Category,Stock,Unit,Purchase Price,Selling Price,Stock Value,Status\n';
      for (const item of inv.items) {
        csv += `"${item.name}","${item.category_name || ''}",${item.stock},"${item.unit}",${item.purchase_price},${item.selling_price},${item.stock_value},"${item.status}"\n`;
      }
    } else {
      return res.status(400).json({ error: 'Invalid export type. Use sales, products, or inventory.' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

