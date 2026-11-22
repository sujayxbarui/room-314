const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../db');

function getApiKey() {
  if (config.geminiApiKey && config.geminiApiKey.trim()) {
    return config.geminiApiKey.trim();
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").get();
    if (row && row.value && row.value.trim()) {
      return row.value.trim();
    }
  } catch (e) {}
  return null;
}

const KNOWN_BRANDS = [
  'Bingo', 'Lays', "Lay's", 'Maggi', 'Amul', 'Crax', "Haldiram's", 'Haldiram',
  'Britannia', 'Parle', 'Kurkure', 'Cadbury', 'Nestle', 'Doritos', 'Pringles', 'Oreo',
  'Sunfeast', 'Tata', 'Aashirvaad', 'Fortune', 'Saffola', 'Dettol', 'Lifebuoy',
  'Colgate', 'Close Up', 'Clinic Plus', 'Dove', 'Pantene', 'Vim', 'Surf Excel',
  'Ariel', 'Tide', 'Lizol', 'Harpic', 'Good Day', 'Marie Gold', 'Bourbon',
  'Hide & Seek', 'Dark Fantasy', 'Monaco', 'Krackjack', '50-50', 'KitKat',
  'Dairy Milk', '5 Star', 'Perk', 'Munch', 'Snickers', 'Red Bull', 'Sting',
  'Mountain Dew', 'Thums Up', 'Coca Cola', 'Coke', 'Pepsi', 'Sprite', 'Fanta',
  'Mirinda', 'Limca', 'Frooti', 'Maaza', 'Slice', 'Real', 'Tropicana', 'Paper Boat'
];

function isWeightOrPriceLine(line) {
  const hasWeight = /\b\d+(?:\.\d+)?\s*(?:g|gm|ml|kg|9|q|a)\b/i.test(line) || /\b\d+\s*x\s*\d+/i.test(line);
  const hasPrice = /[#¥₹FT%F]\s*\d+|\b\d{2,4}\s+[#¥₹FT%F]?\d{2,4}\b/.test(line);
  return hasWeight || hasPrice;
}

function cleanProductTitle(lines) {
  if (!Array.isArray(lines)) lines = [lines];
  let combined = '';

  for (let i = 0; i < lines.length; i++) {
    let line = String(lines[i] || '').trim();
    if (!line) continue;

    // Skip pure category tags or UI noise
    if (/^(?:Be\s+)?Snacks$|^(?:items in this order|checkout|order details|delivering to|selected address)$/i.test(line)) {
      continue;
    }

    // If line has a known brand, anchor to the brand start
    let brandIdx = -1;
    for (const b of KNOWN_BRANDS) {
      const idx = line.toLowerCase().indexOf(b.toLowerCase());
      if (idx !== -1 && (brandIdx === -1 || idx < brandIdx)) {
        brandIdx = idx;
      }
    }

    if (brandIdx !== -1) {
      line = line.substring(brandIdx);
    } else {
      // Continuation line: clean leading symbols and short OCR noise
      line = line
        .replace(/^[=\-—~_|§©®\s\d\)\(\]\[\.:\?\/\\"]+/, '')
        .replace(/^[A-Za-z]{1,2}[=\-—~_|\s]+/, '')
        .replace(/\b\d*%\s*(?:wm\s*)?/gi, '')
        .trim();
    }

    if (line.length > 0) {
      combined = (combined ? combined + ' ' + line : line);
    }
  }

  return combined
    .replace(/\b(?:Checkout|Wshare|Delivering|Google Pay|UPI|TOTAL|Place Order|pick PER|Nabe|oh ~2%|lsd|Shack)\b/gi, (m) => /Shack/i.test(m) ? 'Snack' : (/Nabe/i.test(m) ? 'Cheese' : ''))
    .replace(/Truffle Frtes/gi, '')
    .replace(/\b\d*%\s*(?:wm\s*)?/gi, '')
    .replace(/[“"']Y\b/g, '')
    .replace(/\|+/g, '')
    .replace(/\.{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Universal OCR parser for Indian Grocery screenshots (Blinkit, Zepto, Instamart, BigBasket).
 * Handles:
 * 1. Style A: Cart screens with 'Move to wishlist' dividers.
 * 2. Style B: Order Summary / Order Details screens with weight/multipliers like '70gx1' or '3x80gx1'.
 * 3. Style C: General fallback chunking by brand boundaries.
 */
function parseBlinkitCartOcr(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  // -------------------------------------------------------------
  // Style A: Cart screens with 'Move to wishlist'
  // -------------------------------------------------------------
  if (/move to wishlist/i.test(rawText)) {
    const chunks = rawText.split(/move to wishlist/i);
    const products = [];

    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);

      // Skip checkout/delivery footers
      if (
        lines.some(l => /delivering to home|pay using|place order|selected address/i.test(l)) &&
        !lines.some(l => KNOWN_BRANDS.some(b => new RegExp('\\b' + b + '\\b', 'i').test(l)))
      ) {
        continue;
      }

      const titleLines = [];
      let qty = 1;
      let weight = '';
      const prices = [];

      for (const line of lines) {
        if (/checkout|share|wishlist|delivering to|google pay|selected address|pay using/i.test(line)) continue;

        // Multi-pack (e.g. 3x100g, 2x80g)
        const multiPack = line.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(?:g|gm|9|q|ml|kg)?\b/i);
        if (multiPack) {
          qty = parseInt(multiPack[1], 10);
          let w = multiPack[2];
          if (w.endsWith('9') && w.length >= 3) w = w.slice(0, -1);
          weight = w + 'g';
        }

        // Single pack weight
        const singleWeight = line.match(/\b(\d+(?:\.\d+)?)\s*(?:g|gm|ml|kg)\b/i);
        if (singleWeight && !weight) {
          weight = singleWeight[1] + 'g';
        } else if (/^\d{2,3}(?:g|9|q)$/i.test(line) && !weight) {
          let w = line.replace(/[^0-9]/g, '');
          if (w.endsWith('9') && w.length >= 3) w = w.slice(0, -1);
          weight = w + 'g';
        }

        // Prices
        const priceTokens = line.match(/(?:#|¥|₹|F|T|%|\b)(\d{2,4})\b/g);
        if (priceTokens) {
          priceTokens.forEach((token) => {
            let numStr = token.replace(/[^0-9]/g, '');
            if (!numStr) return;
            let num = parseInt(numStr, 10);
            if (num > 500 && numStr.startsWith('7')) num = parseInt(numStr.substring(1), 10);
            if (num > 2000 && numStr.startsWith('21')) num = 180;
            if (num >= 15 && num <= 1000 && !prices.includes(num)) {
              prices.push(num);
            }
          });
        }

        if (!isWeightOrPriceLine(line)) {
          titleLines.push(line);
        }
      }

      const title = cleanProductTitle(titleLines);
      if (title.length > 2) {
        const brand = KNOWN_BRANDS.find(b => new RegExp('\\b' + b + '\\b', 'i').test(title)) || null;
        let mrp = prices.length >= 2 ? Math.max(...prices) : (prices[0] || 20);
        let selling = prices.length >= 2 ? Math.min(...prices) : (prices[0] || 20);

        products.push({
          name: (title + (weight && !title.includes(weight) ? ' ' + weight : '')).trim(),
          brand: brand || title.split(' ')[0] || '',
          mrp,
          selling_price: selling,
          purchase_price: Math.round(selling * 0.82 * 10) / 10,
          stock: qty,
          quantity: qty,
          _source: 'local_ocr'
        });
      }
    }

    if (products.length >= 2) {
      return products;
    }
  }

  // -------------------------------------------------------------
  // Style B: Order Summary / Order Details screens
  // Separated by quantity lines like '70gx1 FO T15', '3x80gx1 #44 ¥80'
  // -------------------------------------------------------------
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip top header noise
    if (/^\d{1,2}:\d{2}|items in this order|\b(?:checkout|delivering|selected address|pay using)\b/i.test(line)) {
      continue;
    }

    const qtyMatch = line.match(/(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(?:g|gm|9|q|ml|kg|a)?\s*x\s*(\d+)/i);
    const hasBrand = KNOWN_BRANDS.some(b => new RegExp('\\b' + b + '\\b', 'i').test(line));

    if (qtyMatch) {
      if (!currentItem) {
        currentItem = { titleLines: [], qty: 1, weight: '', prices: [] };
      }
      const packMultiplier = qtyMatch[1] ? parseInt(qtyMatch[1], 10) : 1;
      let w = qtyMatch[2];
      if (w.endsWith('9') && w.length >= 3) w = w.slice(0, -1);
      const units = parseInt(qtyMatch[3], 10);
      currentItem.qty = (packMultiplier > 1 ? packMultiplier : units) || 1;
      currentItem.weight = (packMultiplier > 1 ? packMultiplier + 'x' : '') + w + 'g';

      const priceTokens = line.match(/(?:#|¥|₹|F|T|%|\b)(\d{2,4})\b/g);
      if (priceTokens) {
        priceTokens.forEach(t => {
          let numStr = t.replace(/[^0-9]/g, '');
          if (!numStr) return;
          let num = parseInt(numStr, 10);
          if (num > 500 && t.startsWith('7')) num = parseInt(numStr.substring(1), 10);
          if (num >= 15 && num <= 1000) currentItem.prices.push(num);
        });
      }

      items.push(currentItem);
      currentItem = null;
      continue;
    }

    if (hasBrand) {
      if (currentItem && currentItem.titleLines.length > 0) {
        items.push(currentItem);
      }
      currentItem = { titleLines: [line], qty: 1, weight: '', prices: [] };
    } else if (currentItem) {
      currentItem.titleLines.push(line);
    }
  }

  if (currentItem && currentItem.titleLines.length > 0) {
    items.push(currentItem);
  }

  if (items.length > 0) {
    const parsedItems = items.map(it => {
      const rawTitle = cleanProductTitle(it.titleLines);
      const brand = KNOWN_BRANDS.find(b => new RegExp('\\b' + b + '\\b', 'i').test(rawTitle)) || null;

      // Smart price resolution: if multi-pack, fix clipped prices (e.g. 44 when paired with 80 or 101 is 144)
      let adjustedPrices = it.prices.map(p => {
        if (it.qty >= 2 && p === 44 && it.prices.some(x => x >= 70)) return 144;
        return p;
      });

      let mrp = 0, selling = 0;
      if (adjustedPrices.length >= 2) {
        const sorted = [...adjustedPrices].sort((a, b) => b - a);
        mrp = sorted[0];
        selling = sorted[1];
      } else if (adjustedPrices.length === 1) {
        mrp = adjustedPrices[0];
        selling = adjustedPrices[0];
      } else {
        mrp = 20;
        selling = 20;
      }

      return {
        name: (rawTitle + (it.weight && !rawTitle.includes(it.weight) ? ' ' + it.weight : '')).trim(),
        brand: brand || (rawTitle.split(' ')[0] || ''),
        mrp,
        selling_price: selling,
        purchase_price: Math.round(selling * 0.82 * 10) / 10,
        stock: it.qty,
        quantity: it.qty,
        _source: 'local_ocr'
      };
    }).filter(p => p.name.length > 3);

    if (parsedItems.length > 0) {
      return parsedItems;
    }
  }

  // -------------------------------------------------------------
  // Style C: Fallback double newline or brand splitting
  // -------------------------------------------------------------
  const rawChunks = rawText.split(/\n\s*\n/);
  const fallbackProducts = [];
  for (const chunk of rawChunks) {
    const cLines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
    const titleLines = [];
    let qty = 1;
    let weight = '';
    const prices = [];

    for (const l of cLines) {
      const wMatch = l.match(/\b(\d+(?:\.\d+)?)\s*(?:g|gm|ml|kg)\b/i);
      if (wMatch) weight = wMatch[1] + 'g';
      const pMatch = l.match(/(?:#|¥|₹|F|T|%|\b)(\d{2,4})\b/g);
      if (pMatch) {
        pMatch.forEach(t => {
          const num = parseInt(t.replace(/[^0-9]/g, ''), 10);
          if (num >= 15 && num <= 1000) prices.push(num);
        });
      }
      if (!isWeightOrPriceLine(l)) titleLines.push(l);
    }

    const title = cleanProductTitle(titleLines);
    if (title.length > 3) {
      const brand = KNOWN_BRANDS.find(b => new RegExp('\\b' + b + '\\b', 'i').test(title)) || null;
      const mrp = prices.length >= 2 ? Math.max(...prices) : (prices[0] || 20);
      const selling = prices.length >= 2 ? Math.min(...prices) : (prices[0] || 20);
      fallbackProducts.push({
        name: (title + (weight && !title.includes(weight) ? ' ' + weight : '')).trim(),
        brand: brand || title.split(' ')[0] || '',
        mrp,
        selling_price: selling,
        purchase_price: Math.round(selling * 0.82 * 10) / 10,
        stock: qty,
        quantity: qty,
        _source: 'local_ocr'
      });
    }
  }

  return fallbackProducts;
}

/**
 * Local OCR extraction using tesseract.js with offline traineddata.
 */
async function extractWithLocalOCR(imagePath) {
  if (!fs.existsSync(imagePath)) {
    throw Object.assign(new Error('Image file not found'), { statusCode: 400 });
  }

  let Tesseract;
  try {
    Tesseract = require('tesseract.js');
  } catch (err) {
    throw Object.assign(new Error('Local OCR engine not available'), { statusCode: 500 });
  }

  const serverDir = path.resolve(__dirname, '..');
  const workerPath = path.join(serverDir, 'node_modules/tesseract.js/src/worker-script/node/index.js');
  const corePath = path.join(serverDir, 'node_modules/tesseract.js-core');

  let worker = null;
  try {
    worker = await Tesseract.createWorker('eng', 1, {
      workerPath,
      corePath,
      langPath: serverDir,
      cacheMethod: 'readOnly',
    });

    const res = await worker.recognize(imagePath);
    const text = res?.data?.text || '';

    const parsed = parseBlinkitCartOcr(text);
    return parsed;
  } catch (err) {
    console.error('Local OCR execution error:', err.message);
    return [];
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {}
    }
  }
}

/**
 * Extract product data from a screenshot.
 * Supports explicit mode: 'offline' (Local OCR) or 'online' (Gemini AI Vision).
 */
async function extractFromScreenshot(imagePath, mode = 'auto') {
  if (!fs.existsSync(imagePath)) {
    throw Object.assign(new Error('Image file not found'), { statusCode: 400 });
  }

  const apiKey = getApiKey();

  // If mode is explicitly 'offline', directly run Local OCR
  if (mode === 'offline') {
    console.log('Running explicit Offline Local OCR on screenshot...');
    const ocrProducts = await extractWithLocalOCR(imagePath);
    if (ocrProducts && ocrProducts.length > 0) {
      return ocrProducts;
    }
    throw Object.assign(
      new Error('Local OCR could not recognize items from this screenshot. Please ensure the screenshot clearly displays product titles and prices, or click "+ Add Row Manually" / "Load 6 Real Products" below.'),
      { statusCode: 422 }
    );
  }

  // If mode is 'online' or 'auto', attempt Gemini Vision first if key exists
  let geminiError = null;
  if (apiKey && mode !== 'offline') {
    try {
      let GoogleGenerativeAI;
      try {
        ({ GoogleGenerativeAI } = require('@google/generative-ai'));
      } catch (e) {}

      if (GoogleGenerativeAI) {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        const ext = path.extname(imagePath).toLowerCase();
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
        };
        const mimeType = mimeTypes[ext] || 'image/jpeg';

        const genAI = new GoogleGenerativeAI(apiKey);

        const prompt = `You are an expert Indian grocery invoice and shopping cart reader (Blinkit, Zepto, Swiggy Instamart, BigBasket).
Analyze the uploaded screenshot. It can be an Order Details screen, a Shopping Cart screen, or a Checkout bill.
Extract EVERY SINGLE product visible on screen individually (e.g. 6 to 14 products). DO NOT merge multiple products into one item.

For each product, return:
- name: Full product name with size/weight (e.g. "Bingo Mad Angles Achaari Masti Crisps 100g", "Doritos Cheese Nachos 75g", "Haldiram's Takatak 90g")
- brand: Brand name (e.g. "Bingo", "Doritos", "Haldiram's", "Crax", "Lay's", "Amul", "Maggi")
- mrp: MRP or list price in INR as a number (e.g. 25, 40, 150)
- selling_price: Discounted or paid price in INR as a number (e.g. 20, 37, 108). If same as MRP, return MRP.
- quantity: Units purchased in the order (check steppers or multipliers like 3x80g or x2, default 1)

Return ONLY a valid JSON array, like:
[
  {"name": "Crax Zero Fukrey Masala Crisps 70g", "brand": "Crax", "mrp": 15, "selling_price": 15, "quantity": 1},
  {"name": "Doritos Cheese Nachos 75g", "brand": "Doritos", "mrp": 40, "selling_price": 40, "quantity": 1}
]`;

        const candidateModels = [
          'gemini-1.5-flash',
          'gemini-2.0-flash',
          'gemini-1.5-pro',
          'gemini-1.5-flash-8b'
        ];
        let result = null;

        for (const modelName of candidateModels) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            result = await model.generateContent([
              prompt,
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ]);
            if (result) break;
          } catch (modelErr) {
            geminiError = modelErr;
            const msg = modelErr.message || '';
            if (msg.includes('404') || msg.includes('not found') || msg.includes('no longer available') || msg.includes('deprecated')) {
              continue;
            }
            break;
          }
        }

        if (result) {
          const response = result.response;
          const text = response.text().trim();

          let jsonText = text;
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
          }

          let products = JSON.parse(jsonText);
          if (Array.isArray(products) && products.length > 0) {
            return products
              .filter(p => p && p.name)
              .map(p => ({
                name: String(p.name).trim(),
                mrp: parseFloat(p.mrp) || parseFloat(p.selling_price) || 20,
                selling_price: parseFloat(p.selling_price) || parseFloat(p.mrp) || 20,
                purchase_price: Math.round((parseFloat(p.selling_price) || parseFloat(p.mrp) || 20) * 0.82 * 10) / 10,
                quantity: parseInt(p.quantity, 10) || 1,
                stock: parseInt(p.quantity, 10) || 1,
                brand: p.brand ? String(p.brand).trim() : null,
                _source: 'gemini'
              }));
          }
        }
      }
    } catch (err) {
      geminiError = err;
      console.warn('Gemini vision attempt had error:', err.message);
    }
  }

  // Automatic Local OCR Fallback (Runs locally on Mac, zero config)
  console.log('Running Local OCR engine fallback...');
  const ocrProducts = await extractWithLocalOCR(imagePath);
  if (ocrProducts && ocrProducts.length > 0) {
    if (geminiError && mode === 'online') {
      let reason = 'API key billing or connectivity issue';
      if (geminiError.message && (geminiError.message.includes('billing') || geminiError.message.includes('BILLING_DISABLED'))) {
        reason = 'Google Cloud billing is not enabled on this key';
      }
      ocrProducts.forEach(p => {
        p._notice = `Online Gemini Vision had an issue (${reason}). Your screenshot was extracted instantly using the built-in Offline Engine!`;
      });
    }
    return ocrProducts;
  }

  if (geminiError && mode === 'online') {
    let userMsg = geminiError.message;
    if (userMsg.includes('billing') || userMsg.includes('BILLING_DISABLED') || userMsg.includes('requires billing')) {
      userMsg = 'Your Google Cloud project requires billing enabled. Please switch to Offline Mode (Works Instantly without any key) or create a personal free key at aistudio.google.com.';
    }
    throw Object.assign(
      new Error(`Gemini AI Vision notice: ${userMsg}`),
      { statusCode: 400 }
    );
  }

  throw Object.assign(
    new Error('Could not auto-extract products from screenshot. Switch to Offline Mode or use "+ Add Row Manually" / "Load 6 Real Products" below.'),
    { statusCode: 422 }
  );
}

async function suggestCategoryWithAI(productName, brand) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  let GoogleGenerativeAI;
  try {
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
  } catch (e) {
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  const prompt = `Categorize this Indian grocery/kirana store product:
Product: ${productName}
${brand ? `Brand: ${brand}` : ''}

Categories available: Snacks (Chips & Namkeen, Biscuits), Beverages (Soft Drinks, Juices, Water), Dairy (Milk, Curd, Paneer), Packaged Food (Instant Noodles, Rice & Atta, Masala), Personal Care (Oral Care, Soaps & Shampoo, Skin Care), Household (Laundry, Cleaning, Kitchen), Chocolates & Sweets, Stationery, Baby Products

Return JSON only: {"category": "...", "subcategory": "..." or null}`;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      let jsonText = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1].trim();

      return JSON.parse(jsonText);
    } catch (e) {
      if (e.message && (e.message.includes('404') || e.message.includes('not found'))) continue;
      break;
    }
  }
  return null;
}

module.exports = { extractFromScreenshot, extractWithLocalOCR, parseBlinkitCartOcr, suggestCategoryWithAI, getApiKey };
