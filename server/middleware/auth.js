const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Required authentication middleware.
 * Extracts and verifies JWT from Authorization header.
 * Attaches decoded user to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Require administrator role middleware.
 * Enforces that only users with role === 'admin' can perform write/edit mutations
 * on products, inventory stock, categories, and settings.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Permission Denied: Only administrators can modify products, inventory, prices, or store settings. Staff accounts have view, sell, and return permissions only.',
    });
  }

  next();
}

/**
 * Optional authentication middleware.
 * Attaches user if valid token is present, but doesn't fail if missing/invalid.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
  } catch (err) {
    // Token invalid, but that's ok — just continue without user
  }

  next();
}

module.exports = { authenticate, requireAdmin, optionalAuth };
