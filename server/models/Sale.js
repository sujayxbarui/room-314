const db = require('../db');
const Product = require('./Product');

const Sale = {
  /**
   * Generate a receipt number in format R314-YYYYMMDD-XXXX.
   * @returns {string}
   */
  generateReceiptNumber() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    const prefix = `R314-${dateStr}-`;

    const row = db.prepare(`
      SELECT receipt_number FROM sales
      WHERE receipt_number LIKE ?
      ORDER BY receipt_number DESC
      LIMIT 1
    `).get(`${prefix}%`);

    let nextNum = 1;
    if (row) {
      const lastNum = parseInt(row.receipt_number.split('-').pop(), 10);
      nextNum = lastNum + 1;
    }

    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  },

  /**
   * Create a sale with items. Deducts stock atomically.
   * @param {object} saleData - { payment_method, discount, amount_paid, customer_name, customer_phone, notes }
   * @param {Array} items - [{ product_id, quantity, unit_price?, discount? }]
   * @param {number} userId
   * @returns {object} Complete sale with items
   */
  create(saleData, items, userId) {
    if (!items || items.length === 0) {
      const err = new Error('Sale must have at least one item');
      err.statusCode = 400;
      throw err;
    }

    const createSale = db.transaction(() => {
      const receiptNumber = Sale.generateReceiptNumber();

      // Validate stock and build sale items
      let subtotal = 0;
      const saleItems = [];

      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_archived = 0').get(item.product_id);
        if (!product) {
          throw Object.assign(new Error(`Product ID ${item.product_id} not found or archived`), { statusCode: 400 });
        }

        if (product.stock < item.quantity) {
          throw Object.assign(
            new Error(`Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`),
            { statusCode: 400 }
          );
        }

        const unitPrice = item.unit_price != null ? item.unit_price : product.selling_price;
        const lineDiscount = parseFloat(item.discount) || 0;
        const lineTotal = (unitPrice * item.quantity) - lineDiscount;

        saleItems.push({
          product_id: product.id,
          product_name_snapshot: product.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          mrp_snapshot: product.mrp,
          purchase_price_snapshot: product.purchase_price || 0,
          discount: lineDiscount,
          line_total: parseFloat(lineTotal.toFixed(2)),
        });

        subtotal += lineTotal;
      }

      subtotal = parseFloat(subtotal.toFixed(2));
      const saleDiscount = parseFloat(saleData.discount) || 0;
      const total = parseFloat((subtotal - saleDiscount).toFixed(2));
      const amountPaid = parseFloat(saleData.amount_paid) || total;
      const changeDue = parseFloat(Math.max(0, amountPaid - total).toFixed(2));

      // Insert sale
      const saleResult = db.prepare(`
        INSERT INTO sales (receipt_number, subtotal, discount, total, payment_method, amount_paid, change_due, customer_name, customer_phone, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        receiptNumber,
        subtotal,
        saleDiscount,
        total,
        saleData.payment_method || 'cash',
        amountPaid,
        changeDue,
        saleData.customer_name || null,
        saleData.customer_phone || null,
        saleData.notes || null,
        userId
      );

      const saleId = saleResult.lastInsertRowid;

      // Insert sale items and deduct stock
      const insertItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name_snapshot, quantity, unit_price, mrp_snapshot, purchase_price_snapshot, discount, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const si of saleItems) {
        insertItem.run(
          saleId, si.product_id, si.product_name_snapshot,
          si.quantity, si.unit_price, si.mrp_snapshot,
          si.purchase_price_snapshot, si.discount, si.line_total
        );

        // Deduct stock
        Product.updateStock(si.product_id, -si.quantity, 'sale', 'sale', saleId, userId, `Sale ${receiptNumber}`);
      }

      return saleId;
    });

    const saleId = createSale();
    return Sale.findById(saleId);
  },

  /**
   * Find sale by ID with all items.
   * @param {number} id
   * @returns {object|undefined}
   */
  findById(id) {
    const sale = db.prepare(`
      SELECT s.*, u.name AS user_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(id);

    if (!sale) return undefined;

    sale.items = db.prepare(`
      SELECT si.*, p.name AS current_product_name, p.sku AS product_sku
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(id);

    return sale;
  },

  /**
   * List sales with filters.
   * @param {object} filters - { date, from, to, status, payment_method, page, limit }
   * @returns {object}
   */
  list(filters = {}) {
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const offset = (page - 1) * limit;

    let whereClauses = [];
    let params = [];

    if (filters.date) {
      whereClauses.push("DATE(s.sale_date, 'localtime') = DATE(?)");
      params.push(filters.date);
    }

    if (filters.from) {
      whereClauses.push("DATE(s.sale_date, 'localtime') >= DATE(?)");
      params.push(filters.from);
    }

    if (filters.to) {
      whereClauses.push("DATE(s.sale_date, 'localtime') <= DATE(?)");
      params.push(filters.to);
    }

    if (filters.status) {
      whereClauses.push("s.status = ?");
      params.push(filters.status);
    }

    if (filters.payment_method) {
      whereClauses.push("s.payment_method = ?");
      params.push(filters.payment_method);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM sales s ${whereSQL}`).get(...params);

    const sales = db.prepare(`
      SELECT s.*, u.name AS user_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      ${whereSQL}
      ORDER BY s.sale_date DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
      sales,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Cancel a sale and restore stock.
   * @param {number} id
   * @param {number} userId
   * @param {string} reason
   * @returns {object}
   */
  cancel(id, userId, reason) {
    const sale = Sale.findById(id);
    if (!sale) {
      throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
    }

    if (sale.status === 'cancelled') {
      throw Object.assign(new Error('Sale is already cancelled'), { statusCode: 400 });
    }

    const cancelSale = db.transaction(() => {
      // Mark sale as cancelled
      db.prepare(`
        UPDATE sales SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || ? WHERE id = ?
      `).run(`Cancelled: ${reason || 'No reason given'}`, id);

      // Restore stock for each item
      for (const item of sale.items) {
        if (item.product_id) {
          Product.updateStock(
            item.product_id,
            item.quantity,
            'sale_cancel',
            'sale',
            id,
            userId,
            `Sale ${sale.receipt_number} cancelled: ${reason || 'No reason'}`
          );
        }
      }
    });
    cancelSale();

    return Sale.findById(id);
  },

  /**
   * Get daily summary for a specific date.
   * @param {string} date - YYYY-MM-DD
   * @returns {object}
   */
  getDailySummary(date) {
    const summary = db.prepare(`
      SELECT
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total), 0) AS total_revenue,
        COALESCE(SUM(discount), 0) AS total_discount,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN total ELSE 0 END), 0) AS upi_total
      FROM sales
      WHERE DATE(sale_date, 'localtime') = DATE(?) AND status = 'completed'
    `).get(date);

    const profit = db.prepare(`
      SELECT COALESCE(SUM(si.line_total - (si.purchase_price_snapshot * si.quantity)), 0) AS estimated_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.sale_date, 'localtime') = DATE(?) AND s.status = 'completed'
    `).get(date);

    return {
      date,
      ...summary,
      total_revenue: parseFloat(summary.total_revenue.toFixed(2)),
      estimated_profit: parseFloat(profit.estimated_profit.toFixed(2)),
    };
  },
};

module.exports = Sale;
