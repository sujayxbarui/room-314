const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('../db');

// Main workspace sales_records folder
const projectSalesDir = path.resolve(__dirname, '../../sales_records');
// User app support sales_records folder (persists in packaged macOS app)
const appSupportSalesDir = path.join(os.homedir(), 'Library/Application Support/Room-314/sales_records');

function ensureSalesDir() {
  try {
    if (!fs.existsSync(projectSalesDir)) {
      fs.mkdirSync(projectSalesDir, { recursive: true });
    }
  } catch (e) {}

  try {
    if (!fs.existsSync(appSupportSalesDir)) {
      fs.mkdirSync(appSupportSalesDir, { recursive: true });
    }
  } catch (e) {}
}

/**
 * Archive daily sales to a JSON & CSV file in sales_records folder.
 * @param {string} dateStr - YYYY-MM-DD
 */
function archiveDailySales(dateStr) {
  try {
    ensureSalesDir();

    const sales = db.prepare(`
      SELECT s.*, u.name AS user_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE DATE(s.sale_date, 'localtime') = DATE(?) AND s.status = 'completed'
      ORDER BY s.sale_date ASC
    `).all(dateStr);

    const returns = db.prepare(`
      SELECT r.*, u.name AS user_name
      FROM returns r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE DATE(r.return_date, 'localtime') = DATE(?) AND r.status = 'completed'
      ORDER BY r.return_date ASC
    `).all(dateStr);

    if (sales.length === 0 && returns.length === 0) return null;

    const getItems = db.prepare(`
      SELECT si.*, p.name AS current_product_name, p.sku
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `);

    const getReturnItems = db.prepare(`
      SELECT ri.*, p.purchase_price AS current_purchase_price
      FROM return_items ri
      LEFT JOIN products p ON ri.product_id = p.id
      WHERE ri.return_id = ?
    `);

    let totalRevenue = 0;
    let totalCost = 0;
    let totalItems = 0;

    for (const sale of sales) {
      sale.items = getItems.all(sale.id);
      totalRevenue += sale.total;
      for (const item of sale.items) {
        totalCost += (item.purchase_price_snapshot || 0) * item.quantity;
        totalItems += item.quantity;
      }
    }

    let totalRefunds = 0;
    let totalReturnCost = 0;
    let returnedItemsCount = 0;

    for (const ret of returns) {
      ret.items = getReturnItems.all(ret.id);
      totalRefunds += ret.refund_amount;
      for (const item of ret.items) {
        totalReturnCost += (item.current_purchase_price || 0) * item.quantity;
        returnedItemsCount += item.quantity;
      }
    }

    const netSales = Math.max(0, parseFloat((totalRevenue - totalRefunds).toFixed(2)));
    const netProfit = Math.max(0, parseFloat(((totalRevenue - totalCost) - (totalRefunds - totalReturnCost)).toFixed(2)));

    const payload = {
      date: dateStr,
      archived_at: new Date().toISOString(),
      transaction_count: sales.length,
      return_count: returns.length,
      total_items_sold: Math.max(0, totalItems - returnedItemsCount),
      total_sales_inr: netSales,
      gross_sales_inr: parseFloat(totalRevenue.toFixed(2)),
      total_refunds_inr: parseFloat(totalRefunds.toFixed(2)),
      estimated_profit_inr: netProfit,
      sales: sales.map(s => ({
        receipt_number: s.receipt_number,
        time: s.sale_date,
        total: s.total,
        payment_method: s.payment_method,
        customer: s.customer_name || 'Walk-in',
        items: (s.items || []).map(i => ({
          name: i.product_name_snapshot,
          quantity: i.quantity,
          unit_price: i.unit_price,
          line_total: i.line_total
        }))
      })),
      returns: returns.map(r => ({
        return_id: r.id,
        time: r.return_date,
        refund_amount: r.refund_amount,
        refund_method: r.refund_method,
        reason: r.reason || 'Customer Return',
        items: (r.items || []).map(i => ({
          name: i.product_name_snapshot,
          quantity: i.quantity,
          unit_price: i.unit_price,
          restock: i.restock
        }))
      }))
    };

    const fileNameJson = `sales-${dateStr}.json`;
    const fileNameCsv = `sales-${dateStr}.csv`;

    // 1. JSON Export
    const jsonContent = JSON.stringify(payload, null, 2);

    // 2. CSV Export
    let csvContent = 'Receipt,Time,Customer,PaymentMethod,ItemName,Quantity,UnitPrice,LineTotal\n';
    for (const s of sales) {
      for (const item of (s.items || [])) {
        csvContent += `"${s.receipt_number}","${s.sale_date}","${s.customer_name || 'Walk-in'}","${s.payment_method}","${item.product_name_snapshot.replace(/"/g, '""')}",${item.quantity},${item.unit_price},${item.line_total}\n`;
      }
    }

    // Write to both project directory and application support directory
    [projectSalesDir, appSupportSalesDir].forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          fs.writeFileSync(path.join(dir, fileNameJson), jsonContent, 'utf8');
          fs.writeFileSync(path.join(dir, fileNameCsv), csvContent, 'utf8');
        }
      } catch (e) {}
    });

    // Update all-time summary
    updateAllTimeArchive();

    return payload;
  } catch (err) {
    console.error('Error archiving daily sales for', dateStr, err.message);
    return null;
  }
}

/**
 * Update all-time sales summary file.
 */
function updateAllTimeArchive() {
  try {
    ensureSalesDir();

    const allTimeSummary = db.prepare(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total), 0) AS all_time_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS total_cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN total ELSE 0 END), 0) AS total_upi_sales,
        MIN(DATE(sale_date, 'localtime')) AS first_sale_date,
        MAX(DATE(sale_date, 'localtime')) AS latest_sale_date
      FROM sales
      WHERE status = 'completed'
    `).get();

    const returnSummary = db.prepare(`
      SELECT
        COUNT(*) AS total_returns,
        COALESCE(SUM(refund_amount), 0) AS all_time_refunds,
        COALESCE(SUM(CASE WHEN refund_method = 'cash' THEN refund_amount ELSE 0 END), 0) AS refund_cash,
        COALESCE(SUM(CASE WHEN refund_method = 'upi' THEN refund_amount ELSE 0 END), 0) AS refund_upi
      FROM returns
      WHERE status = 'completed'
    `).get();

    const netAllTimeSales = Math.max(0, (allTimeSummary.all_time_sales || 0) - (returnSummary.all_time_refunds || 0));
    const netCashSales = Math.max(0, (allTimeSummary.total_cash_sales || 0) - (returnSummary.refund_cash || 0));
    const netUpiSales = Math.max(0, (allTimeSummary.total_upi_sales || 0) - (returnSummary.refund_upi || 0));

    const datesList = db.prepare(`
      SELECT
        dates.date,
        COALESCE(s.order_count, 0) AS order_count,
        COALESCE(r.return_count, 0) AS return_count,
        MAX(0, COALESCE(s.daily_total, 0) - COALESCE(r.daily_refunds, 0)) AS daily_total
      FROM (
        SELECT DATE(sale_date, 'localtime') AS date FROM sales WHERE status = 'completed'
        UNION
        SELECT DATE(return_date, 'localtime') AS date FROM returns WHERE status = 'completed'
      ) dates
      LEFT JOIN (
        SELECT DATE(sale_date, 'localtime') AS date, COUNT(*) AS order_count, SUM(total) AS daily_total
        FROM sales WHERE status = 'completed'
        GROUP BY DATE(sale_date, 'localtime')
      ) s ON dates.date = s.date
      LEFT JOIN (
        SELECT DATE(return_date, 'localtime') AS date, COUNT(*) AS return_count, SUM(refund_amount) AS daily_refunds
        FROM returns WHERE status = 'completed'
        GROUP BY DATE(return_date, 'localtime')
      ) r ON dates.date = r.date
      ORDER BY dates.date DESC
    `).all();

    const summaryPayload = {
      updated_at: new Date().toISOString(),
      all_time: {
        total_sales: parseFloat(netAllTimeSales.toFixed(2)),
        gross_sales: parseFloat(allTimeSummary.all_time_sales.toFixed(2)),
        total_refunds: parseFloat(returnSummary.all_time_refunds.toFixed(2)),
        total_orders: allTimeSummary.total_orders,
        total_returns: returnSummary.total_returns,
        cash_sales: parseFloat(netCashSales.toFixed(2)),
        upi_sales: parseFloat(netUpiSales.toFixed(2)),
        first_date: allTimeSummary.first_sale_date,
        latest_date: allTimeSummary.latest_sale_date
      },
      dates: datesList.map(d => ({
        date: d.date,
        orders: d.order_count,
        returns: d.return_count,
        total: parseFloat(d.daily_total.toFixed(2))
      }))
    };

    const summaryJson = JSON.stringify(summaryPayload, null, 2);

    [projectSalesDir, appSupportSalesDir].forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          fs.writeFileSync(path.join(dir, 'all_time_sales_summary.json'), summaryJson, 'utf8');
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error('Error updating all-time archive:', e.message);
  }
}

function getSalesFolderInfo() {
  ensureSalesDir();
  return {
    project_folder: projectSalesDir,
    app_support_folder: appSupportSalesDir,
    exists: fs.existsSync(projectSalesDir) || fs.existsSync(appSupportSalesDir)
  };
}

module.exports = {
  archiveDailySales,
  updateAllTimeArchive,
  getSalesFolderInfo,
  projectSalesDir,
  appSupportSalesDir
};

