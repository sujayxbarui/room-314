# Room-314 — POS & Inventory Management System

A clean, fast Point of Sale and Inventory Management system built for Room-314 kirana store.

## Features

- ⚡ **Fast POS Billing** — Search, add to cart, checkout in seconds
- 📸 **Blinkit Screenshot Import** — Upload cart screenshots, AI extracts product data
- 🏷️ **Smart Categories** — Auto-suggest categories for new products
- 💵 **Cash + UPI Payments** — Simple payment flow
- 📱 **WhatsApp Receipts** — Share bills on WhatsApp when customers ask
- 📊 **Daily Sales & Reports** — Track revenue, profit, best sellers
- 📦 **Inventory Management** — Stock tracking, purchase records, low-stock alerts
- 🔄 **Returns & Cancellations** — Full audit trail
- 👥 **2-User Access** — Login for owner and cofounder
- 💾 **Easy Backup** — Single file database, one-command backup

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| AI | Google Gemini Vision (for screenshot extraction) |
| Auth | JWT + bcrypt |

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Gemini API Key** (optional, for screenshot extraction) — [Get free key](https://aistudio.google.com)

## Quick Start

```bash
# 1. Clone or navigate to the project
cd room-314

# 2. Install all dependencies
npm run install:all

# 3. Set up environment
cp .env.example .env
# Edit .env and add your Gemini API key (optional)

# 4. Create database
npm run migrate

# 5. Load demo data (optional — creates sample products and 2 user accounts)
npm run seed

# 6. Start the application
npm run dev
```

The app will open at **http://localhost:5173**

### Demo Accounts (after running seed)

| Role | Email | Password |
|---|---|---|
| Owner | owner@room314.com | admin123 |
| Partner | partner@room314.com | admin123 |

### Access from iPhone/Android

On the same WiFi network, find your Mac's IP address:
```bash
ipconfig getifaddr en0
```
Then open `http://<your-ip>:5173` on your phone.

## Project Structure

```
room-314/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # UI and shared components
│   │   ├── pages/           # All page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API client
│   │   ├── context/         # Auth context
│   │   └── utils/           # Formatters, constants
│   └── index.html
├── server/                  # Express backend
│   ├── routes/              # API endpoints
│   ├── models/              # Database queries & business logic
│   ├── middleware/          # Auth & error handling
│   ├── services/            # AI, categorization, WhatsApp
│   ├── migrations/          # Database schema
│   └── seeds/               # Demo data
├── database/                # SQLite database file
├── uploads/                 # Temporary uploaded files
├── backups/                 # Backup scripts & files
├── .env.example             # Environment template
└── README.md
```

## Backup & Restore

### Create a backup
```bash
npm run backup
```
This copies the database file to `backups/` with a timestamp.

### Restore from backup
```bash
cp backups/room314-backup-YYYY-MM-DD.db database/room314.db
```
Restart the server after restoring.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Register new user |
| GET | /api/auth/me | Current user info |
| GET | /api/products | List products |
| POST | /api/products | Create product |
| GET | /api/products/search | Search products |
| PUT | /api/products/:id | Update product |
| DELETE | /api/products/:id | Archive product |
| GET | /api/categories | List categories |
| POST | /api/categories | Create category |
| POST | /api/sales | Create sale (checkout) |
| GET | /api/sales | List sales |
| POST | /api/sales/:id/cancel | Cancel sale |
| POST | /api/inventory/purchase | Record stock purchase |
| POST | /api/inventory/adjust | Stock adjustment |
| POST | /api/returns | Process return |
| GET | /api/reports/daily | Daily sales report |
| GET | /api/reports/profit | Profit report |
| POST | /api/ai/extract-screenshot | Extract products from screenshot |
| POST | /api/ai/suggest-category | Suggest category for product |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| PORT | No | Server port (default: 3000) |
| JWT_SECRET | Yes | Secret key for JWT tokens |
| GEMINI_API_KEY | No | Google Gemini API key for screenshot extraction |
| DB_PATH | No | Database file path (default: ../database/room314.db) |
| SHOP_NAME | No | Shop name for receipts (default: Room-314) |
| SHOP_PHONE | No | Shop phone for receipts |
| SHOP_ADDRESS | No | Shop address for receipts |

## Limitations

- No barcode scanning (by design — search by name)
- No printed receipts (digital only — WhatsApp sharing)
- No GST/tax invoicing (shop is not GST registered)
- No customer credit/udhaar tracking
- No expiry date tracking
- No offline mode (requires internet)
- No loose goods / weight-based billing
- Screenshot extraction requires Gemini API key

All excluded features are architecturally supported and can be added later.

## License

Private — built for Room-314.

