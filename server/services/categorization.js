const db = require('../db');

/**
 * Rule-based categorization engine for common Indian kirana store products.
 */

// Keyword → category mapping rules
const CATEGORY_RULES = [
  // Snacks
  { keywords: ['chips', 'lays', 'kurkure', 'pringles', 'bingo', 'mad angles', 'uncle chipps', 'doritos'], category: 'Snacks', subcategory: 'Chips & Namkeen' },
  { keywords: ['namkeen', 'bhujia', 'haldiram', 'mixture', 'sev', 'aloo bhujia', 'moong dal'], category: 'Snacks', subcategory: 'Chips & Namkeen' },
  { keywords: ['biscuit', 'cookie', 'parle-g', 'parle g', 'good day', 'bourbon', 'oreo', 'marie', 'hide & seek', 'hide and seek', 'monaco', 'krackjack', 'tiger', 'treat', 'britannia', 'sunfeast', 'jim jam', '50-50', 'dark fantasy', 'cream biscuit', 'digestive'], category: 'Snacks', subcategory: 'Biscuits' },
  { keywords: ['rusk', 'toast'], category: 'Snacks', subcategory: 'Biscuits' },

  // Beverages
  { keywords: ['cola', 'coca-cola', 'coca cola', 'pepsi', 'thums up', 'thumbs up', 'sprite', 'fanta', 'limca', 'mirinda', '7up', '7 up', 'mountain dew', 'sting', 'soft drink', 'soda', 'carbonated'], category: 'Beverages', subcategory: 'Soft Drinks' },
  { keywords: ['juice', 'tropicana', 'real juice', 'frooti', 'maaza', 'slice', 'appy fizz', 'paper boat', 'raw pressery', 'mango drink'], category: 'Beverages', subcategory: 'Juices' },
  { keywords: ['water', 'bisleri', 'kinley', 'aquafina', 'mineral water', 'packaged water'], category: 'Beverages', subcategory: 'Water' },
  { keywords: ['tea', 'chai', 'tata tea', 'brooke bond', 'red label', 'taj mahal', 'wagh bakri', 'green tea', 'lipton'], category: 'Beverages', subcategory: 'Tea & Coffee' },
  { keywords: ['coffee', 'nescafe', 'bru', 'instant coffee'], category: 'Beverages', subcategory: 'Tea & Coffee' },
  { keywords: ['energy drink', 'red bull', 'monster'], category: 'Beverages', subcategory: 'Soft Drinks' },

  // Dairy
  { keywords: ['milk', 'amul milk', 'mother dairy', 'toned milk', 'full cream', 'double toned'], category: 'Dairy', subcategory: 'Milk' },
  { keywords: ['curd', 'dahi', 'yogurt', 'yoghurt', 'lassi', 'chaach', 'buttermilk'], category: 'Dairy', subcategory: 'Curd' },
  { keywords: ['paneer', 'cheese', 'amul cheese', 'butter', 'ghee', 'cream'], category: 'Dairy', subcategory: 'Paneer' },

  // Packaged Food
  { keywords: ['noodles', 'maggi', 'yippee', 'top ramen', 'ching', 'instant noodle', 'pasta', 'macaroni', 'vermicelli', 'sewai'], category: 'Packaged Food', subcategory: 'Instant Noodles' },
  { keywords: ['rice', 'basmati', 'atta', 'flour', 'wheat', 'maida', 'suji', 'rava', 'sooji', 'besan', 'gram flour'], category: 'Packaged Food', subcategory: 'Rice & Atta' },
  { keywords: ['masala', 'spice', 'mdh', 'everest', 'catch', 'turmeric', 'haldi', 'chilli powder', 'garam masala', 'coriander powder', 'cumin', 'jeera'], category: 'Packaged Food', subcategory: 'Masala' },
  { keywords: ['dal', 'toor', 'moong', 'chana', 'rajma', 'lentil', 'pulses', 'arhar'], category: 'Packaged Food', subcategory: 'Rice & Atta' },
  { keywords: ['oil', 'cooking oil', 'mustard oil', 'sunflower oil', 'refined oil', 'fortune', 'saffola', 'olive oil'], category: 'Packaged Food', subcategory: 'Masala' },
  { keywords: ['sauce', 'ketchup', 'soy sauce', 'chilli sauce', 'mayonnaise', 'vinegar', 'jam', 'honey', 'pickle', 'achar'], category: 'Packaged Food', subcategory: 'Masala' },
  { keywords: ['sugar', 'salt', 'jaggery', 'gur'], category: 'Packaged Food', subcategory: 'Rice & Atta' },
  { keywords: ['poha', 'oats', 'muesli', 'cornflakes', 'cereal', 'chocos'], category: 'Packaged Food', subcategory: 'Rice & Atta' },

  // Personal Care
  { keywords: ['toothpaste', 'colgate', 'pepsodent', 'sensodyne', 'close-up', 'closeup', 'oral-b', 'toothbrush', 'mouthwash', 'listerine'], category: 'Personal Care', subcategory: 'Oral Care' },
  { keywords: ['soap', 'bath soap', 'lux', 'lifebuoy', 'dove', 'pears', 'dettol soap', 'cinthol', 'santoor', 'body wash', 'handwash'], category: 'Personal Care', subcategory: 'Soaps & Shampoo' },
  { keywords: ['shampoo', 'conditioner', 'head & shoulders', 'head and shoulders', 'pantene', 'dove shampoo', 'clinic plus', 'sunsilk', 'tresemme', 'hair oil', 'parachute', 'navratna', 'coconut oil'], category: 'Personal Care', subcategory: 'Soaps & Shampoo' },
  { keywords: ['cream', 'lotion', 'moisturizer', 'sunscreen', 'face wash', 'fair & lovely', 'pond', 'nivea', 'vaseline', 'skin care', 'body lotion', 'talcum', 'powder'], category: 'Personal Care', subcategory: 'Skin Care' },
  { keywords: ['deodorant', 'deo', 'perfume', 'roll on', 'body spray'], category: 'Personal Care', subcategory: 'Skin Care' },
  { keywords: ['razor', 'shaving', 'gillette', 'blade'], category: 'Personal Care', subcategory: 'Skin Care' },
  { keywords: ['sanitary', 'pad', 'whisper', 'stayfree', 'sofy'], category: 'Personal Care', subcategory: 'Skin Care' },

  // Household
  { keywords: ['detergent', 'surf excel', 'tide', 'ariel', 'rin', 'nirma', 'washing powder', 'washing liquid', 'fabric softener', 'comfort'], category: 'Household', subcategory: 'Laundry' },
  { keywords: ['cleaner', 'harpic', 'lizol', 'colin', 'domex', 'vim', 'dish wash', 'scrubber', 'phenyl', 'floor cleaner', 'toilet cleaner', 'glass cleaner'], category: 'Household', subcategory: 'Cleaning' },
  { keywords: ['mosquito', 'good knight', 'all out', 'hit', 'mortein', 'repellent', 'cockroach', 'insecticide', 'pest'], category: 'Household', subcategory: 'Cleaning' },
  { keywords: ['aluminium foil', 'cling wrap', 'garbage bag', 'trash bag', 'kitchen tissue', 'paper towel', 'napkin'], category: 'Household', subcategory: 'Kitchen' },
  { keywords: ['matchbox', 'match', 'candle', 'agarbatti', 'incense', 'dhoop', 'camphor', 'kapoor'], category: 'Household', subcategory: 'Kitchen' },

  // Chocolates & Sweets
  { keywords: ['chocolate', 'dairy milk', 'cadbury', 'kitkat', 'kit kat', '5 star', '5star', 'munch', 'perk', 'snickers', 'gems', 'bar one', 'silk', 'milkybar', 'bournville', 'ferrero'], category: 'Chocolates & Sweets', subcategory: null },
  { keywords: ['candy', 'toffee', 'lollipop', 'eclairs', 'pulse candy', 'mango bite', 'alpenliebe', 'kismi'], category: 'Chocolates & Sweets', subcategory: null },
  { keywords: ['chewing gum', 'center fresh', 'big babool', 'orbit', 'mentos', 'polo'], category: 'Chocolates & Sweets', subcategory: null },

  // Baby Products
  { keywords: ['diaper', 'pampers', 'huggies', 'mamy poko', 'baby wipes', 'baby cream', 'baby powder', 'baby oil', 'johnson baby', 'baby food', 'cerelac'], category: 'Baby Products', subcategory: null },

  // Stationery
  { keywords: ['pen', 'pencil', 'eraser', 'sharpener', 'notebook', 'register', 'scale', 'ruler', 'stapler', 'glue', 'fevicol', 'tape', 'scissor', 'marker', 'highlighter', 'sketch pen', 'cello', 'reynolds', 'classmate'], category: 'Stationery', subcategory: null },
];

/**
 * Suggest a category for a product based on its name and brand.
 * @param {string} productName
 * @param {string} brand
 * @returns {object} { category, subcategory, confidence, source }
 */
function suggestCategory(productName, brand) {
  const rawText = `${productName} ${brand || ''}`.toLowerCase().trim();
  const normalizedText = rawText.replace(/['’]/g, '');

  // 1. Check database mappings first
  try {
    const mapping = db.prepare(`
      SELECT cm.*, c.name AS category_name, pc.name AS parent_name
      FROM category_mappings cm
      JOIN categories c ON cm.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      WHERE ? LIKE '%' || cm.keyword || '%' OR ? LIKE '%' || cm.keyword || '%'
      ORDER BY cm.confidence DESC, LENGTH(cm.keyword) DESC
      LIMIT 1
    `).get(rawText, normalizedText);

    if (mapping) {
      return {
        category: mapping.parent_name || mapping.category_name,
        subcategory: mapping.parent_name ? mapping.category_name : null,
        category_id: mapping.category_id,
        confidence: 'high',
        source: 'database_mapping',
      };
    }
  } catch (e) {
    // DB might not be available during testing; fall through to rules
  }

  // 2. Try rule-based matching
  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      const cleanKeyword = keyword.toLowerCase();
      if (rawText.includes(cleanKeyword) || normalizedText.includes(cleanKeyword)) {
        // Look up category ID from database
        let categoryId = null;
        try {
          const cat = db.prepare(`
            SELECT c.id
            FROM categories c
            LEFT JOIN categories p ON c.parent_id = p.id
            WHERE c.name = ? AND (p.name = ? OR (? IS NULL AND c.parent_id IS NULL))
            LIMIT 1
          `).get(
            rule.subcategory || rule.category,
            rule.subcategory ? rule.category : null,
            rule.subcategory ? rule.category : null
          );
          categoryId = cat ? cat.id : null;

          // If subcategory not found, try parent
          if (!categoryId) {
            const parentCat = db.prepare('SELECT id FROM categories WHERE name = ? AND parent_id IS NULL LIMIT 1').get(rule.category);
            categoryId = parentCat ? parentCat.id : null;
          }
        } catch (e) {
          // Ignore DB errors
        }

        return {
          category: rule.category,
          subcategory: rule.subcategory,
          category_id: categoryId,
          confidence: 'medium',
          source: 'rule_engine',
        };
      }
    }
  }

  // 3. No match found
  return {
    category: null,
    subcategory: null,
    category_id: null,
    confidence: 'low',
    source: 'none',
  };
}

module.exports = { suggestCategory, CATEGORY_RULES };
