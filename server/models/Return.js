const db = require('../db');
const Product = require('./Product');

const Return = {
  /**
   * Create a return with items.
   * @param {object} returnData - { original_sale_id?, refund_amount, refund_method, reason }
   * @param {Array} items - [{ product_id, product_name_snapshot, quantity, unit_price, restock? }]
   * @param {number} userId
   * @returns {object}
   */
  create(returnData, items, userId) {
    if (!items || items.length === 0) {
      throw Object.assign(new Error('Return must have at least one item'), { statusCode: 400 });
    }

    // If linked to a sale, validate it
    if (returnData.original_sale_id) {
      const sale = db.prepare('SELECT id, status FROM sales WHERE id = ?').get(returnData.original_sale_id);
      if (!sale) {
        throw Object.assign(new Error('Original sale not found'), { statusCode: 404 });
      }
      if (sale.status === 'cancelled') {
        throw Object.assign(new Error('Cannot return items from a cancelled sale'), { statusCode: 400 });
      }
    }

    const doReturn = db.transaction(() => {
      // Calculate refund amount if not provided
      let refundAmount = parseFloat(returnData.refund_amount) || 0;
      if (!refundAmount) {
        refundAmount = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      }

      const returnResult = db.prepare(`
        INSERT INTO returns (original_sale_id, refund_amount, refund_method, reason, user_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        returnData.original_sale_id || null,
        parseFloat(refundAmount.toFixed(2)),
        returnData.refund_method || 'cash',
        returnData.reason || null,
        userId
      );

      const returnId = returnResult.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO return_items (return_id, product_id, product_name_snapshot, quantity, unit_price, restock)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const shouldRestock = item.restock !== undefined ? (item.restock ? 1 : 0) : 1;

        // Get product name if not provided
        let productName = item.product_name_snapshot;
        if (!productName && item.product_id) {
          const product = db.prepare('SELECT name FROM products WHERE id = ?').get(item.product_id);
          productName = product ? product.name : 'Unknown Product';
        }

        insertItem.run(
          returnId,
          item.product_id || null,
          productName || 'Unknown Product',
          item.quantity,
          item.unit_price,
          shouldRestock
        );

        // Restock if needed
        if (shouldRestock && item.product_id) {
          Product.updateStock(
            item.product_id,
            item.quantity,
            'return',
            'return',
            returnId,
            userId,
            `Return #${returnId}${returnData.reason ? ': ' + returnData.reason : ''}`
          );
        }
      }

      return returnId;
    });

    const returnId = doReturn();
    return Return.findById(returnId);
  },

  /**
   * Find return by ID with items.
   * @param {number} id
   * @returns {object|undefined}
   */
  findById(id) {
    const ret = db.prepare(`
      SELECT r.*, u.name AS user_name, s.receipt_number AS original_receipt
      FROM returns r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN sales s ON r.original_sale_id = s.id
      WHERE r.id = ?
    `).get(id);

    if (!ret) return undefined;

    ret.items = db.prepare(`
      SELECT ri.*, p.name AS current_product_name, p.sku AS product_sku
      FROM return_items ri
      LEFT JOIN products p ON ri.product_id = p.id
      WHERE ri.return_id = ?
    `).all(id);

    return ret;
  },

  /**
   * List returns with pagination.
   * @param {object} filters - { from, to, page, limit }
   * @returns {object}
   */
  list(filters = {}) {
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const offset = (page - 1) * limit;

    let whereClauses = [];
    let params = [];

    if (filters.from) {
      whereClauses.push("DATE(r.return_date) >= DATE(?)");
      params.push(filters.from);
    }
    if (filters.to) {
      whereClauses.push("DATE(r.return_date) <= DATE(?)");
      params.push(filters.to);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM returns r ${whereSQL}`).get(...params);

    const returns = db.prepare(`
      SELECT r.*, u.name AS user_name, s.receipt_number AS original_receipt
      FROM returns r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN sales s ON r.original_sale_id = s.id
      ${whereSQL}
      ORDER BY r.return_date DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
      returns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },
};

module.exports = Return;
