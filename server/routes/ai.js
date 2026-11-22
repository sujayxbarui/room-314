const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { extractFromScreenshot, getApiKey } = require('../services/aiExtraction');
const { suggestCategory } = require('../services/categorization');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/ai/status - check if Gemini API key is configured
router.get('/status', (req, res) => {
  const key = getApiKey();
  res.json({
    has_api_key: Boolean(key && key.length > 5),
    preview: key ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : null,
  });
});

// POST /api/ai/set-key - save Gemini API key from UI
router.post('/set-key', (req, res, next) => {
  try {
    const { api_key } = req.body;
    if (!api_key || typeof api_key !== 'string' || !api_key.trim()) {
      return res.status(400).json({ error: 'Valid API key is required' });
    }

    const cleanKey = api_key.trim();

    // 1. Save in SQLite settings table
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('gemini_api_key', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run(cleanKey);

    // 2. Update config in-memory
    config.geminiApiKey = cleanKey;
    process.env.GEMINI_API_KEY = cleanKey;

    // 3. Update .env file
    try {
      const envPath = path.join(__dirname, '..', '..', '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('GEMINI_API_KEY=')) {
          envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${cleanKey}`);
        } else {
          envContent += `\nGEMINI_API_KEY=${cleanKey}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    } catch (envErr) {
      console.warn('Could not update .env file:', envErr.message);
    }

    res.json({
      success: true,
      message: 'Gemini API key saved successfully and activated!',
      preview: `${cleanKey.substring(0, 6)}...${cleanKey.substring(cleanKey.length - 4)}`,
    });
  } catch (err) {
    next(err);
  }
});

// Configure multer storage
const uploadDir = config.uploadDir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `screenshot-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, WEBP) are allowed'));
    }
  },
});

// POST /api/ai/extract-screenshot - upload screenshot and extract products
router.post('/extract-screenshot', upload.single('screenshot'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Screenshot image file is required' });
    }

    const imagePath = req.file.path;
    const mode = req.body.mode || req.query.mode || 'auto';

    try {
      const extractedProducts = await extractFromScreenshot(imagePath, mode);
      const source = (extractedProducts && extractedProducts[0] && extractedProducts[0]._source) || (mode === 'offline' ? 'local_ocr' : 'gemini');
      const notice = (extractedProducts && extractedProducts[0] && extractedProducts[0]._notice) || null;

      // Enhance each product with category suggestions using local engine
      const enrichedProducts = (extractedProducts || []).map((p) => {
        const catSuggestion = suggestCategory(p.name, p.brand);
        const mrp = parseFloat(p.mrp) || 0;
        const purchasePrice = p.purchase_price || (mrp > 0 ? Math.round(mrp * 0.82 * 100) / 100 : 0);
        const sellingPrice = p.selling_price || mrp;
        const quantity = parseInt(p.quantity, 10) || 1;

        return {
          name: p.name || 'Unnamed Product',
          brand: p.brand || '',
          mrp: mrp,
          purchase_price: purchasePrice,
          selling_price: sellingPrice,
          stock: quantity,
          quantity: quantity,
          unit: 'packet',
          category_id: catSuggestion.category_id || null,
          category_name: catSuggestion.category || '',
          subcategory_name: catSuggestion.subcategory || '',
          confidence: catSuggestion.confidence,
        };
      });

      // Cleanup uploaded file
      try {
        fs.unlinkSync(imagePath);
      } catch (e) {
        // Ignore unlink error
      }

      res.json({
        count: enrichedProducts.length,
        products: enrichedProducts,
        engine: source,
        notice,
      });
    } catch (extractErr) {
      // Cleanup uploaded file on error
      try {
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      } catch (e) {}

      // If it's a 503 or config error, pass clear message
      res.status(extractErr.statusCode || 500).json({
        error: extractErr.message || 'Failed to extract products from screenshot',
      });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/suggest-category - suggest category for product
router.post('/suggest-category', (req, res, next) => {
  try {
    const { product_name, brand } = req.body;
    if (!product_name || product_name.trim() === '') {
      return res.status(400).json({ error: 'product_name is required' });
    }

    const suggestion = suggestCategory(product_name.trim(), brand ? brand.trim() : null);
    res.json(suggestion);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/learn-category - learn from user correction
router.post('/learn-category', (req, res, next) => {
  try {
    const { keyword, category_id } = req.body;
    if (!keyword || !category_id) {
      return res.status(400).json({ error: 'keyword and category_id are required' });
    }

    const cleanKeyword = keyword.trim().toLowerCase();
    const catId = parseInt(category_id, 10);

    // Insert or update mapping
    const existing = db.prepare('SELECT id FROM category_mappings WHERE keyword = ?').get(cleanKeyword);
    if (existing) {
      db.prepare('UPDATE category_mappings SET category_id = ?, confidence = 1.0 WHERE id = ?').run(catId, existing.id);
    } else {
      db.prepare('INSERT INTO category_mappings (keyword, category_id, confidence, source) VALUES (?, ?, 1.0, "user")').run(cleanKeyword, catId);
    }

    res.json({ success: true, message: 'Category mapping saved' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

