const db = require('../db');
const Product = require('./Product');

const Inventory = {
  /**
   * Record a stock purchase with items.
   * @param {object} purchaseData - { supplier, purchase_date, invoice_number, notes }
   * @param {Array} items - [{ product_id, quantity, purchase_price, update_product_price? }]
   * @param {number} userId
   * @returns {object}
   */
  recordPurchase(purchaseData, items, userId) {
    if (!items || items.length === 0) {
      throw Object.assign(new Error('Purchase must have at least one item'), { statusCode: 400 });
    }

    const doPurchase = db.transaction(() => {
      let totalAmount = 0;

      for (const item of items) {
        totalAmount += (item.purchase_price || 0) * item.quantity;
      }

      // Create stock_purchase record
      const purchaseResult = db.prepare(`
        INSERT INTO stock_purchases (supplier, purchase_date, invoice_number, total_amount, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        purchaseData.supplier || null,
        purchaseData.purchase_date || new Date().toISOString(),
        purchaseData.invoice_number || null,
        parseFloat(totalAmount.toFixed(2)),
        purchaseData.notes || null,
        userId
      );

      const purchaseId = purchaseResult.lastInsertRowid;

      // Insert items and update stock
      const insertItem = db.prepare(`
        INSERT INTO stock_purchase_items (purchase_id, product_id, quantity, purchase_price)
        VALUES (?, ?, ?, ?)
      `);

      for (const item of items) {
        const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(item.product_id);
        if (!product) {
          throw Object.assign(new Error(`Product ID ${item.product_id} not found`), { statusCode: 400 });
        }

        insertItem.run(purchaseId, item.product_id, item.quantity, item.purchase_price || 0);

        // Update product stock
        Product.updateStock(
          item.product_id,
          item.quantity,
          'purchase',
          'stock_purchase',
          purchaseId,
          userId,
          `Stock purchase${purchaseData.invoice_number ? ' #' + purchaseData.invoice_number : ''}`
        );

        // Optionally update purchase price on the product
        if (item.update_product_price && item.purchase_price) {
          db.prepare(`UPDATE products SET purchase_price = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(item.purchase_price, item.product_id);
        }
      }

      return purchaseId;
    });

    const purchaseId = doPurchase();

    // Return the purchase with items
    const purchase = db.prepare('SELECT * FROM stock_purchases WHERE id = ?').get(purchaseId);
    purchase.items = db.prepare(`
      SELECT spi.*, p.name AS product_name, p.sku AS product_sku
      FROM stock_purchase_items spi
      LEFT JOIN products p ON spi.product_id = p.id
      WHERE spi.purchase_id = ?
    `).all(purchaseId);

    return purchase;
  },

  /**
   * Adjust stock with audit trail.
   * @param {number} productId
   * @param {number} quantityChange
   * @param {string} reason
   * @param {string} notes
   * @param {number} userId
   * @returns {object}
   */
  adjustStock(productId, quantityChange, reason, notes, userId) {
    const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(productId);
    if (!product) {
      throw Object.assign(new Error('Product not found'), { statusCode: 404 });
    }

    const doAdjust = db.transaction(() => {
      // Create adjustment record
      db.prepare(`
        INSERT INTO stock_adjustments (product_id, quantity_change, reason, notes, adjusted_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(productId, quantityChange, reason, notes || null, userId);

      // Update stock via Product.updateStock
      Product.updateStock(productId, quantityChange, 'adjustment', 'stock_adjustment', null, userId, `${reason}: ${notes || ''}`);
    });
    doAdjust();

    const updated = Product.findById(productId);
    return {
      message: 'Stock adjusted successfully',
      product_name: updated.name,
      previous_stock: product.stock,
      change: quantityChange,
      new_stock: updated.stock,
    };
  },

  /**
   * Get purchase history with filters.
   * @param {object} filters - { from, to, supplier, page, limit }
   * @returns {object}
   */
  getPurchaseHistory(filters = {}) {
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const offset = (page - 1) * limit;

    let whereClauses = [];
    let params = [];

    if (filters.from) {
      whereClauses.push("DATE(sp.purchase_date) >= DATE(?)");
      params.push(filters.from);
    }
    if (filters.to) {
      whereClauses.push("DATE(sp.purchase_date) <= DATE(?)");
      params.push(filters.to);
    }
    if (filters.supplier) {
      whereClauses.push("sp.supplier LIKE ?");
      params.push(`%${filters.supplier}%`);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM stock_purchases sp ${whereSQL}`).get(...params);

    const purchases = db.prepare(`
      SELECT sp.*, u.name AS user_name
      FROM stock_purchases sp
      LEFT JOIN users u ON sp.user_id = u.id
      ${whereSQL}
      ORDER BY sp.purchase_date DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Attach items to each purchase
    const getItems = db.prepare(`
      SELECT spi.*, p.name AS product_name, p.sku AS product_sku
      FROM stock_purchase_items spi
      LEFT JOIN products p ON spi.product_id = p.id
      WHERE spi.purchase_id = ?
    `);

    for (const purchase of purchases) {
      purchase.items = getItems.all(purchase.id);
    }

    return {
      purchases,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get stock movement ledger.
   * @param {number|null} productId
   * @param {string|null} from
   * @param {string|null} to
   * @returns {Array}
   */
  getStockLedger(productId, from, to) {
    let whereClauses = [];
    let params = [];

    if (productId) {
      whereClauses.push('sl.product_id = ?');
      params.push(productId);
    }
    if (from) {
      whereClauses.push("DATE(sl.created_at) >= DATE(?)");
      params.push(from);
    }
    if (to) {
      whereClauses.push("DATE(sl.created_at) <= DATE(?)");
      params.push(to);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    return db.prepare(`
      SELECT sl.*, p.name AS product_name, p.sku AS product_sku, u.name AS user_name
      FROM stock_ledger sl
      LEFT JOIN products p ON sl.product_id = p.id
      LEFT JOIN users u ON sl.user_id = u.id
      ${whereSQL}
      ORDER BY sl.created_at DESC
      LIMIT 500
    `).all(...params);
  },

  /**
   * Get inventory overview with stock value.
   * @param {object} filters - { category_id, stock_status, search }
   * @returns {object}
   */
  getInventoryOverview(filters = {}) {
    let whereClauses = ['p.is_archived = 0'];
    let params = [];

    if (filters.category_id) {
      whereClauses.push('(p.category_id = ? OR p.subcategory_id = ?)');
      params.push(filters.category_id, filters.category_id);
    }

    if (filters.stock_status === 'low') {
      whereClauses.push('p.stock > 0 AND p.stock <= p.low_stock_threshold');
    } else if (filters.stock_status === 'out') {
      whereClauses.push('p.stock = 0');
    }

    if (filters.search) {
      whereClauses.push('(p.name LIKE ? OR p.brand LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const whereSQL = whereClauses.join(' AND ');

    const products = db.prepare(`
      SELECT p.id, p.name, p.brand, p.sku, p.stock, p.purchase_price, p.selling_price, p.mrp,
        p.low_stock_threshold, p.unit,
        c.name AS category_name,
        (p.stock * p.purchase_price) AS stock_value,
        CASE
          WHEN p.stock = 0 THEN 'out_of_stock'
          WHEN p.stock <= p.low_stock_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END AS stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereSQL}
      ORDER BY p.name
    `).all(...params);

    const totalStockValue = products.reduce((sum, p) => sum + (p.stock_value || 0), 0);
    const totalProducts = products.length;
    const outOfStock = products.filter(p => p.stock_status === 'out_of_stock').length;
    const lowStock = products.filter(p => p.stock_status === 'low_stock').length;

    return {
      products,
      items: products,
      summary: {
        total_products: totalProducts,
        total_stock_value: parseFloat(totalStockValue.toFixed(2)),
        out_of_stock: outOfStock,
        low_stock: lowStock,
        in_stock: totalProducts - outOfStock - lowStock,
      },
    };
  },
};

module.exports = Inventory;
