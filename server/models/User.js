const bcrypt = require('bcryptjs');
const db = require('../db');

const SALT_ROUNDS = 10;

const User = {
  /**
   * Create a new user.
   * @param {string} name
   * @param {string} email
   * @param {string} password - Plain text password
   * @param {string} role - 'admin' | 'staff'
   * @returns {object} Created user (without password_hash)
   */
  create(name, email, password, role = 'staff') {
    const hash = bcrypt.hashSync(password, SALT_ROUNDS);
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name, email.toLowerCase().trim(), hash, role);
    return User.findById(result.lastInsertRowid);
  },

  /**
   * Find user by email (includes password_hash for login verification).
   * @param {string} email
   * @returns {object|undefined}
   */
  findByEmail(email) {
    const stmt = db.prepare(`
      SELECT id, name, email, password_hash, role, is_active, created_at, updated_at
      FROM users
      WHERE email = ? AND is_active = 1
    `);
    return stmt.get(email.toLowerCase().trim());
  },

  /**
   * Find user by ID (without password_hash).
   * @param {number} id
   * @returns {object|undefined}
   */
  findById(id) {
    const stmt = db.prepare(`
      SELECT id, name, email, role, is_active, created_at, updated_at
      FROM users
      WHERE id = ?
    `);
    return stmt.get(id);
  },

  /**
   * Verify a plaintext password against a hash.
   * @param {string} password
   * @param {string} hash
   * @returns {boolean}
   */
  verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
  },
};

module.exports = User;
