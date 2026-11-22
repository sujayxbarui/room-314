const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isVercel = Boolean(process.env.VERCEL);
const defaultDbPath = isVercel ? '/tmp/room314.db' : '../database/room314.db';
const defaultUploadDir = isVercel ? '/tmp/uploads' : '../uploads';

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-me',
  dbPath: path.resolve(__dirname, process.env.DB_PATH || defaultDbPath),
  uploadDir: path.resolve(__dirname, process.env.UPLOAD_DIR || defaultUploadDir),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  shop: {
    name: process.env.SHOP_NAME || 'Room-314',
    phone: process.env.SHOP_PHONE || '',
    address: process.env.SHOP_ADDRESS || '',
  },
};

