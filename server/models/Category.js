const db = require('../db');

const Category = {
  /**
   * Create a new category.
   * @param {string} name
   * @param {number|null} parentId
   * @returns {object}
   */
  create(name, parentId) {
    if (parentId) {
      const parent = db.prepare('SELECT id FROM categories WHERE id = ?').get(parentId);
      if (!parent) {
        const err = new Error('Parent category not found');
        err.statusCode = 404;
        throw err;
      }
    }

    const stmt = db.prepare(`
      INSERT INTO categories (name, parent_id)
      VALUES (?, ?)
    `);
    const result = stmt.run(name, parentId || null);
    return Category.findById(result.lastInsertRowid);
  },

  /**
   * Find category by ID with parent info.
   * @param {number} id
   * @returns {object|undefined}
   */
  findById(id) {
    const stmt = db.prepare(`
      SELECT c.*, p.name AS parent_name
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE c.id = ?
    `);
    return stmt.get(id);
  },

  /**
   * Rename a category.
   * @param {number} id
   * @param {string} name
   * @returns {object}
   */
  update(id, name) {
    db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
    return Category.findById(id);
  },

  /**
   * Delete a category if no products use it.
   * @param {number} id
   */
  delete(id) {
    const productCount = db.prepare(
      'SELECT COUNT(*) AS count FROM products WHERE (category_id = ? OR subcategory_id = ?) AND is_archived = 0'
    ).get(id, id);

    if (productCount.count > 0) {
      const err = new Error(`Cannot delete category: ${productCount.count} product(s) are using it. Reassign products first or use merge.`);
      err.statusCode = 400;
      throw err;
    }

    // Also delete child categories that have no products
    const children = db.prepare('SELECT id FROM categories WHERE parent_id = ?').all(id);
    for (const child of children) {
      const childProductCount = db.prepare(
        'SELECT COUNT(*) AS count FROM products WHERE (category_id = ? OR subcategory_id = ?) AND is_archived = 0'
      ).get(child.id, child.id);
      if (childProductCount.count > 0) {
        const err = new Error(`Cannot delete category: child category ID ${child.id} has products.`);
        err.statusCode = 400;
        throw err;
      }
    }

    const deleteTx = db.transaction(() => {
      // Reparent or delete children
      db.prepare('DELETE FROM categories WHERE parent_id = ?').run(id);
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    });
    deleteTx();

    return { message: 'Category deleted successfully' };
  },

  /**
   * Return all categories as a tree structure (parents with children).
   * @returns {Array}
   */
  list() {
    const all = db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all();

    // Build tree: group children under parents
    const parentCategories = all.filter(c => c.parent_id === null);
    const childCategories = all.filter(c => c.parent_id !== null);

    return parentCategories.map(parent => ({
      ...parent,
      children: childCategories.filter(c => c.parent_id === parent.id),
    }));
  },

  /**
   * Return flat list of categories with parent name.
   * @returns {Array}
   */
  listFlat() {
    const stmt = db.prepare(`
      SELECT c.*, p.name AS parent_name
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY COALESCE(p.name, c.name), c.parent_id IS NULL DESC, c.name
    `);
    return stmt.all();
  },

  /**
   * Merge source category into target: move all products, delete source.
   * @param {number} sourceId
   * @param {number} targetId
   * @returns {object}
   */
  merge(sourceId, targetId) {
    if (sourceId === targetId) {
      const err = new Error('Source and target categories must be different');
      err.statusCode = 400;
      throw err;
    }

    const source = Category.findById(sourceId);
    const target = Category.findById(targetId);

    if (!source) {
      const err = new Error('Source category not found');
      err.statusCode = 404;
      throw err;
    }
    if (!target) {
      const err = new Error('Target category not found');
      err.statusCode = 404;
      throw err;
    }

    const mergeTx = db.transaction(() => {
      // Move products from source to target
      db.prepare('UPDATE products SET category_id = ? WHERE category_id = ?').run(targetId, sourceId);
      db.prepare('UPDATE products SET subcategory_id = ? WHERE subcategory_id = ?').run(targetId, sourceId);

      // Move category_mappings
      db.prepare('UPDATE category_mappings SET category_id = ? WHERE category_id = ?').run(targetId, sourceId);

      // Reparent children
      db.prepare('UPDATE categories SET parent_id = ? WHERE parent_id = ?').run(targetId, sourceId);

      // Delete source
      db.prepare('DELETE FROM categories WHERE id = ?').run(sourceId);
    });
    mergeTx();

    return {
      message: `Category "${source.name}" merged into "${target.name}"`,
      target: Category.findById(targetId),
    };
  },
};

module.exports = Category;
