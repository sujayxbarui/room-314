const db = require('../db');

const Product = {
  /**
   * Generate a unique SKU in the format R314-XXXX.
   */
  _generateSKU() {
    const row = db.prepare(`SELECT MAX(CAST(SUBSTR(sku, 6) AS INTEGER)) AS maxNum FROM products WHERE sku LIKE 'R314-%'`).get();
    const next = (row.maxNum || 0) + 1;
    return `R314-${String(next).padStart(4, '0')}`;
  },

  /**
   * Create a new product.
   * @param {object} data
   * @returns {object} Created product
   */
  create(data) {
    const sku = data.sku || Product._generateSKU();

    // Validate foreign keys so invalid category IDs never throw SQLite constraint errors
    let categoryId = null;
    if (data.category_id) {
      const exists = db.prepare('SELECT id FROM categories WHERE id = ?').get(parseInt(data.category_id, 10));
      if (exists) categoryId = exists.id;
    }

    let subcategoryId = null;
    if (data.subcategory_id) {
      const exists = db.prepare('SELECT id FROM categories WHERE id = ?').get(parseInt(data.subcategory_id, 10));
      if (exists) subcategoryId = exists.id;
    }

    const stmt = db.prepare(`
      INSERT INTO products (name, brand, category_id, subcategory_id, sku, mrp, selling_price, purchase_price, stock, unit, low_stock_threshold, supplier, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.name,
      data.brand || null,
      categoryId,
      subcategoryId,
      sku,
      data.mrp || null,
      data.selling_price !== undefined ? parseFloat(data.selling_price) : (data.mrp || 0),
      data.purchase_price || 0,
      data.stock || 0,
      data.unit || 'piece',
      data.low_stock_threshold != null ? data.low_stock_threshold : 5,
      data.supplier || null,
      data.image_url || null
    );
    return Product.findById(result.lastInsertRowid);
  },

  /**
   * Find product by ID with category names.
   * @param {number} id
   * @returns {object|undefined}
   */
  findById(id) {
    const stmt = db.prepare(`
      SELECT p.*,
        c.name AS category_name,
        sc.name AS subcategory_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      WHERE p.id = ?
    `);
    return stmt.get(id);
  },

  /**
   * Update a product.
   * @param {number} id
   * @param {object} data - Fields to update
   * @returns {object} Updated product
   */
  update(id, data) {
    const existing = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(id);
    if (!existing) {
      throw Object.assign(new Error(`Product ID ${id} not found`), { statusCode: 404 });
    }

    const allowedFields = [
      'name', 'brand', 'category_id', 'subcategory_id', 'sku', 'mrp',
      'selling_price', 'purchase_price', 'stock', 'unit',
      'low_stock_threshold', 'supplier', 'image_url'
    ];

    // Sanitize category_id so non-existent ID or empty string never violates foreign key constraint
    let categoryId = null;
    if (data.category_id !== undefined && data.category_id !== null && data.category_id !== '') {
      const parsedCat = parseInt(data.category_id, 10);
      if (!isNaN(parsedCat)) {
        const catExists = db.prepare('SELECT id FROM categories WHERE id = ?').get(parsedCat);
        if (catExists) categoryId = catExists.id;
      }
    }

    // Sanitize subcategory_id
    let subcategoryId = null;
    if (data.subcategory_id !== undefined && data.subcategory_id !== null && data.subcategory_id !== '') {
      const parsedSub = parseInt(data.subcategory_id, 10);
      if (!isNaN(parsedSub)) {
        const subExists = db.prepare('SELECT id FROM categories WHERE id = ?').get(parsedSub);
        if (subExists) subcategoryId = subExists.id;
      }
    }

    const updates = [];
    const values = [];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'category_id') {
          updates.push('category_id = ?');
          values.push(categoryId);
        } else if (field === 'subcategory_id') {
          updates.push('subcategory_id = ?');
          values.push(subcategoryId);
        } else if (field === 'stock') {
          const newStock = Math.max(0, parseInt(data.stock, 10) || 0);
          updates.push('stock = ?');
          values.push(newStock);

          // If stock changed, record in stock_ledger
          if (newStock !== existing.stock) {
            const diff = newStock - existing.stock;
            try {
              db.prepare(`
                INSERT INTO stock_ledger (product_id, change_type, quantity_before, quantity_change, quantity_after, reference_type, notes)
                VALUES (?, 'adjustment', ?, ?, ?, 'manual_edit', 'Product edit page update')
              `).run(id, existing.stock, diff, newStock);
            } catch (e) {}
          }
        } else if (field === 'selling_price' || field === 'purchase_price' || field === 'mrp') {
          updates.push(`${field} = ?`);
          values.push(parseFloat(data[field]) || 0);
        } else {
          updates.push(`${field} = ?`);
          values.push(data[field] === '' ? null : data[field]);
        }
      }
    }

    if (updates.length === 0) {
      return Product.findById(id);
    }

    updates.push(`updated_at = datetime('now')`);
    values.push(id);

    const sql = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);
    return Product.findById(id);
  },

  /**
   * Soft delete a product.
   * @param {number} id
   * @returns {object} Archived product
   */
  archive(id) {
    db.prepare(`UPDATE products SET is_archived = 1, updated_at = datetime('now') WHERE id = ?`).run(id);
    return Product.findById(id);
  },

  /**
   * Search products by name, brand, or SKU.
   * @param {string} query
   * @param {number} limit
   * @returns {Array}
   */
  search(query, limit = 20) {
    const searchTerm = `%${query}%`;
    const stmt = db.prepare(`
      SELECT p.*, c.name AS category_name, sc.name AS subcategory_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      WHERE p.is_archived = 0
        AND (p.name LIKE ? OR p.brand LIKE ? OR p.sku LIKE ?)
      ORDER BY p.name
      LIMIT ?
    `);
    return stmt.all(searchTerm, searchTerm, searchTerm, limit);
  },

  /**
   * List products with pagination and filters.
   * @param {object} filters
   * @returns {object} { products, total, page, limit, totalPages }
   */
  list(filters = {}) {
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const offset = (page - 1) * limit;

    let whereClauses = ['p.is_archived = 0'];
    let params = [];

    if (filters.category_id) {
      whereClauses.push('(p.category_id = ? OR p.subcategory_id = ?)');
      params.push(filters.category_id, filters.category_id);
    }

    if (filters.search) {
      whereClauses.push('(p.name LIKE ? OR p.brand LIKE ? OR p.sku LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    if (filters.stock_status === 'low') {
      whereClauses.push('p.stock > 0 AND p.stock <= p.low_stock_threshold');
    } else if (filters.stock_status === 'out') {
      whereClauses.push('p.stock = 0');
    }

    const whereSQL = whereClauses.join(' AND ');
    const sortBy = ['name', 'selling_price', 'stock', 'created_at', 'updated_at'].includes(filters.sort_by) ? filters.sort_by : 'name';
    const sortOrder = filters.sort_order === 'desc' ? 'DESC' : 'ASC';

    const countStmt = db.prepare(`SELECT COUNT(*) AS total FROM products p WHERE ${whereSQL}`);
    const { total } = countStmt.get(...params);

    const dataStmt = db.prepare(`
      SELECT p.*, c.name AS category_name, sc.name AS subcategory_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      WHERE ${whereSQL}
      ORDER BY p.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `);
    const products = dataStmt.all(...params, limit, offset);

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Update stock atomically with audit trail.
   * @param {number} id
   * @param {number} quantityChange - Positive or negative
   * @param {string} changeType - e.g., 'sale', 'purchase', 'adjustment', 'return'
   * @param {string} referenceType - e.g., 'sale', 'stock_purchase', 'return'
   * @param {number|null} referenceId
   * @param {number|null} userId
   * @param {string|null} notes
   */
  updateStock(id, quantityChange, changeType, referenceType, referenceId, userId, notes) {
    const product = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(id);
    if (!product) {
      const err = new Error(`Product with ID ${id} not found`);
      err.statusCode = 404;
      throw err;
    }

    const newStock = product.stock + quantityChange;
    if (newStock < 0) {
      const err = new Error(`Insufficient stock for product ID ${id}. Current: ${product.stock}, Requested change: ${quantityChange}`);
      err.statusCode = 400;
      throw err;
    }

    db.prepare(`UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?`).run(newStock, id);

    db.prepare(`
      INSERT INTO stock_ledger (product_id, change_type, quantity_before, quantity_change, quantity_after, reference_type, reference_id, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, changeType, product.stock, quantityChange, newStock, referenceType || null, referenceId || null, notes || null, userId || null);

    return { stock_before: product.stock, stock_after: newStock };
  },

  /**
   * Get products with low stock.
   * @param {number} threshold - Override threshold (optional)
   * @returns {Array}
   */
  getLowStock(threshold) {
    if (threshold != null) {
      return db.prepare(`
        SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_archived = 0 AND p.stock <= ? AND p.stock > 0
        ORDER BY p.stock ASC
      `).all(threshold);
    }
    return db.prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_archived = 0 AND p.stock <= p.low_stock_threshold AND p.stock > 0
      ORDER BY p.stock ASC
    `).all();
  },

  /**
   * Get out-of-stock products.
   * @returns {Array}
   */
  getOutOfStock() {
    return db.prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_archived = 0 AND p.stock = 0
      ORDER BY p.name
    `).all();
  },

  /**
   * Bulk create products in a transaction.
   * @param {Array} products
   * @returns {Array} Created products
   */
  bulkCreate(products) {
    const created = [];
    const insertMany = db.transaction((items) => {
      for (const data of items) {
        const product = Product.create(data);
        created.push(product);
      }
    });
    insertMany(products);
    return created;
  },

  /**
   * Check if a product with similar name and brand exists (case-insensitive).
   * @param {string} name
   * @param {string} brand
   * @returns {object|null} Matching product or null
   */
  checkDuplicate(name, brand) {
    let stmt;
    if (brand) {
      stmt = db.prepare(`
        SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE LOWER(p.name) = LOWER(?) AND LOWER(p.brand) = LOWER(?) AND p.is_archived = 0
      `);
      return stmt.get(name, brand) || null;
    }
    stmt = db.prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE LOWER(p.name) = LOWER(?) AND (p.brand IS NULL OR p.brand = '') AND p.is_archived = 0
    `);
    return stmt.get(name) || null;
  },
};

module.exports = Product;
