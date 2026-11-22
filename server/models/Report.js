const db = require('../db');

const Report = {
  /**
   * Daily sales report: all sales for a date with items, totals, profit.
   * @param {string} date - YYYY-MM-DD
   * @returns {object}
   */
  dailySales(date) {
    const sales = db.prepare(`
      SELECT s.*, u.name AS user_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE DATE(s.sale_date, 'localtime') = DATE(?) AND s.status = 'completed'
      ORDER BY s.sale_date ASC
    `).all(date);

    const returns = db.prepare(`
      SELECT r.*, u.name AS user_name
      FROM returns r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE DATE(r.return_date, 'localtime') = DATE(?) AND r.status = 'completed'
      ORDER BY r.return_date ASC
    `).all(date);

    const getItems = db.prepare(`
      SELECT si.*, p.name AS current_product_name
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
    let totalDiscount = 0;
    let itemCount = 0;

    for (const sale of sales) {
      sale.items = getItems.all(sale.id);
      totalRevenue += sale.total;
      totalDiscount += sale.discount;
      for (const item of sale.items) {
        totalCost += (item.purchase_price_snapshot || 0) * item.quantity;
        itemCount += item.quantity;
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
    const netCost = Math.max(0, parseFloat((totalCost - totalReturnCost).toFixed(2)));
    const netProfit = Math.max(0, parseFloat((netSales - netCost).toFixed(2)));

    return {
      date,
      sales,
      returns,
      total_sales: netSales,
      gross_sales: parseFloat(totalRevenue.toFixed(2)),
      total_refunds: parseFloat(totalRefunds.toFixed(2)),
      total_revenue: netSales,
      estimated_profit: netProfit,
      transaction_count: sales.length,
      return_count: returns.length,
      cogs: netCost,
      summary: {
        transaction_count: sales.length,
        return_count: returns.length,
        total_items_sold: Math.max(0, itemCount - returnedItemsCount),
        gross_sales: parseFloat(totalRevenue.toFixed(2)),
        total_refunds: parseFloat(totalRefunds.toFixed(2)),
        total_revenue: netSales,
        total_cost: netCost,
        total_discount: parseFloat(totalDiscount.toFixed(2)),
        gross_profit: netProfit,
      },
    };
  },

  /**
   * Summary statistics for a date range.
   * @param {string} from - YYYY-MM-DD
   * @param {string} to - YYYY-MM-DD
   * @returns {object}
   */
  dateRangeSummary(from, to) {
    const summary = db.prepare(`
      SELECT
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total), 0) AS total_revenue,
        COALESCE(SUM(discount), 0) AS total_discount,
        COALESCE(AVG(total), 0) AS average_order_value,
        COALESCE(MAX(total), 0) AS highest_sale,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN total ELSE 0 END), 0) AS upi_total
      FROM sales
      WHERE DATE(sale_date, 'localtime') >= DATE(?) AND DATE(sale_date, 'localtime') <= DATE(?) AND status = 'completed'
    `).get(from, to);

    const returnSummary = db.prepare(`
      SELECT
        COUNT(*) AS return_count,
        COALESCE(SUM(refund_amount), 0) AS total_refunds,
        COALESCE(SUM(CASE WHEN refund_method = 'cash' THEN refund_amount ELSE 0 END), 0) AS cash_refunds,
        COALESCE(SUM(CASE WHEN refund_method = 'upi' THEN refund_amount ELSE 0 END), 0) AS upi_refunds
      FROM returns
      WHERE DATE(return_date, 'localtime') >= DATE(?) AND DATE(return_date, 'localtime') <= DATE(?) AND status = 'completed'
    `).get(from, to);

    const costData = db.prepare(`
      SELECT COALESCE(SUM(si.purchase_price_snapshot * si.quantity), 0) AS total_cost
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.sale_date, 'localtime') >= DATE(?) AND DATE(s.sale_date, 'localtime') <= DATE(?) AND s.status = 'completed'
    `).get(from, to);

    const returnCostData = db.prepare(`
      SELECT COALESCE(SUM(p.purchase_price * ri.quantity), 0) AS return_cost
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      LEFT JOIN products p ON ri.product_id = p.id
      WHERE DATE(r.return_date, 'localtime') >= DATE(?) AND DATE(r.return_date, 'localtime') <= DATE(?) AND r.status = 'completed'
    `).get(from, to);

    const netRevenue = Math.max(0, (summary.total_revenue || 0) - (returnSummary.total_refunds || 0));
    const netCost = Math.max(0, (costData.total_cost || 0) - (returnCostData.return_cost || 0));
    const netProfit = Math.max(0, netRevenue - netCost);

    const dailyBreakdown = db.prepare(`
      SELECT
        dates.date,
        COALESCE(s.transactions, 0) AS transactions,
        COALESCE(r.return_count, 0) AS return_count,
        MAX(0, COALESCE(s.revenue, 0) - COALESCE(r.refunds, 0)) AS revenue,
        COALESCE(s.revenue, 0) AS gross_revenue,
        COALESCE(r.refunds, 0) AS refunds
      FROM (
        SELECT DATE(sale_date, 'localtime') AS date FROM sales
        WHERE DATE(sale_date, 'localtime') >= DATE(?) AND DATE(sale_date, 'localtime') <= DATE(?) AND status = 'completed'
        UNION
        SELECT DATE(return_date, 'localtime') AS date FROM returns
        WHERE DATE(return_date, 'localtime') >= DATE(?) AND DATE(return_date, 'localtime') <= DATE(?) AND status = 'completed'
      ) dates
      LEFT JOIN (
        SELECT DATE(sale_date, 'localtime') AS date, COUNT(*) AS transactions, SUM(total) AS revenue
        FROM sales
        WHERE DATE(sale_date, 'localtime') >= DATE(?) AND DATE(sale_date, 'localtime') <= DATE(?) AND status = 'completed'
        GROUP BY DATE(sale_date, 'localtime')
      ) s ON dates.date = s.date
      LEFT JOIN (
        SELECT DATE(return_date, 'localtime') AS date, COUNT(*) AS return_count, SUM(refund_amount) AS refunds
        FROM returns
        WHERE DATE(return_date, 'localtime') >= DATE(?) AND DATE(return_date, 'localtime') <= DATE(?) AND status = 'completed'
        GROUP BY DATE(return_date, 'localtime')
      ) r ON dates.date = r.date
      ORDER BY dates.date ASC
    `).all(from, to, from, to, from, to, from, to);

    return {
      from,
      to,
      ...summary,
      total_revenue: parseFloat(netRevenue.toFixed(2)),
      gross_revenue: parseFloat((summary.total_revenue || 0).toFixed(2)),
      total_refunds: parseFloat((returnSummary.total_refunds || 0).toFixed(2)),
      return_count: returnSummary.return_count || 0,
      average_order_value: parseFloat(summary.average_order_value.toFixed(2)),
      total_cost: parseFloat(netCost.toFixed(2)),
      gross_profit: parseFloat(netProfit.toFixed(2)),
      daily_breakdown: dailyBreakdown,
    };
  },

  /**
   * Aggregate sales by product.
   * @param {string} from
   * @param {string} to
   * @returns {Array}
   */
  productWiseSales(from, to) {
    return db.prepare(`
      SELECT
        si.product_id,
        si.product_name_snapshot AS product_name,
        p.sku,
        p.brand,
        SUM(si.quantity) AS total_quantity,
        SUM(si.line_total) AS total_revenue,
        SUM(si.purchase_price_snapshot * si.quantity) AS total_cost,
        SUM(si.line_total - (si.purchase_price_snapshot * si.quantity)) AS profit,
        COUNT(DISTINCT si.sale_id) AS times_sold
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE DATE(s.sale_date, 'localtime') >= DATE(?) AND DATE(s.sale_date, 'localtime') <= DATE(?) AND s.status = 'completed'
      GROUP BY si.product_id, si.product_name_snapshot
      ORDER BY total_revenue DESC
    `).all(from, to);
  },

  /**
   * Aggregate sales by category.
   * @param {string} from
   * @param {string} to
   * @returns {Array}
   */
  categoryWiseSales(from, to) {
    return db.prepare(`
      SELECT
        COALESCE(c.name, 'Uncategorized') AS category_name,
        c.id AS category_id,
        SUM(si.quantity) AS total_quantity,
        SUM(si.line_total) AS total_revenue,
        SUM(si.line_total - (si.purchase_price_snapshot * si.quantity)) AS profit,
        COUNT(DISTINCT si.sale_id) AS transactions
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE DATE(s.sale_date, 'localtime') >= DATE(?) AND DATE(s.sale_date, 'localtime') <= DATE(?) AND s.status = 'completed'
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `).all(from, to);
  },

  /**
   * Payment method breakdown.
   * @param {string} from
   * @param {string} to
   * @returns {Array}
   */
  paymentBreakdown(from, to) {
    return db.prepare(`
      SELECT
        payment_method,
        COUNT(*) AS transaction_count,
        SUM(total) AS total_amount,
        AVG(total) AS average_amount
      FROM sales
      WHERE DATE(sale_date, 'localtime') >= DATE(?) AND DATE(sale_date, 'localtime') <= DATE(?) AND status = 'completed'
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `).all(from, to);
  },

  /**
   * Top selling products.
   * @param {string} from
   * @param {string} to
   * @param {number} limit
   * @returns {Array}
   */
  bestSellers(from, to, limit = 10) {
    return db.prepare(`
      SELECT
        si.product_id,
        si.product_name_snapshot AS product_name,
        p.sku,
        p.brand,
        SUM(si.quantity) AS total_quantity,
        SUM(si.line_total) AS total_revenue,
        COUNT(DISTINCT si.sale_id) AS times_sold
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE DATE(s.sale_date, 'localtime') >= DATE(?) AND DATE(s.sale_date, 'localtime') <= DATE(?) AND s.status = 'completed'
      GROUP BY si.product_id, si.product_name_snapshot
      ORDER BY total_quantity DESC
      LIMIT ?
    `).all(from, to, limit);
  },

  /**
   * Low stock report.
   * @returns {Array}
   */
  lowStockReport() {
    return db.prepare(`
      SELECT p.id, p.name, p.brand, p.sku, p.stock, p.low_stock_threshold, p.unit,
        p.purchase_price, p.selling_price,
        c.name AS category_name,
        CASE
          WHEN p.stock = 0 THEN 'out_of_stock'
          ELSE 'low_stock'
        END AS status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_archived = 0 AND p.stock <= p.low_stock_threshold
      ORDER BY p.stock ASC, p.name ASC
    `).all();
  },

  /**
   * Total stock value grouped by category.
   * @returns {object}
   */
  inventoryValuation() {
    const byCategory = db.prepare(`
      SELECT
        COALESCE(c.name, 'Uncategorized') AS category_name,
        c.id AS category_id,
        COUNT(*) AS product_count,
        SUM(p.stock) AS total_units,
        SUM(p.stock * p.purchase_price) AS cost_value,
        SUM(p.stock * p.selling_price) AS retail_value
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_archived = 0
      GROUP BY c.id
      ORDER BY cost_value DESC
    `).all();

    const totals = byCategory.reduce(
      (acc, cat) => ({
        total_products: acc.total_products + cat.product_count,
        total_units: acc.total_units + cat.total_units,
        total_cost_value: acc.total_cost_value + (cat.cost_value || 0),
        total_retail_value: acc.total_retail_value + (cat.retail_value || 0),
      }),
      { total_products: 0, total_units: 0, total_cost_value: 0, total_retail_value: 0 }
    );

    totals.total_cost_value = parseFloat(totals.total_cost_value.toFixed(2));
    totals.total_retail_value = parseFloat(totals.total_retail_value.toFixed(2));
    totals.potential_profit = parseFloat((totals.total_retail_value - totals.total_cost_value).toFixed(2));

    return {
      ...totals,
      by_category: byCategory,
      totals,
    };
  },

  /**
   * Gross profit for a date range.
   * @param {string} from
   * @param {string} to
   * @returns {object}
   */
  grossProfit(from, to) {
    const data = db.prepare(`
      SELECT
        COALESCE(SUM(si.line_total), 0) AS total_revenue,
        COALESCE(SUM(si.purchase_price_snapshot * si.quantity), 0) AS total_cogs,
        COALESCE(SUM(s.discount), 0) AS total_discounts
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.sale_date, 'localtime') >= DATE(?) AND DATE(s.sale_date, 'localtime') <= DATE(?) AND s.status = 'completed'
    `).get(from, to);

    const returnData = db.prepare(`
      SELECT
        COALESCE(SUM(r.refund_amount), 0) AS total_refunds,
        COALESCE(SUM(p.purchase_price * ri.quantity), 0) AS return_cogs
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      LEFT JOIN products p ON ri.product_id = p.id
      WHERE DATE(r.return_date, 'localtime') >= DATE(?) AND DATE(r.return_date, 'localtime') <= DATE(?) AND r.status = 'completed'
    `).get(from, to);

    const revenue = Math.max(0, parseFloat(((data.total_revenue || 0) - (returnData.total_refunds || 0)).toFixed(2)));
    const cogs = Math.max(0, parseFloat(((data.total_cogs || 0) - (returnData.return_cogs || 0)).toFixed(2)));
    const grossProfit = Math.max(0, parseFloat((revenue - cogs).toFixed(2)));
    const margin = revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(2)) : 0;

    return {
      from,
      to,
      total_revenue: revenue,
      gross_revenue: parseFloat(data.total_revenue.toFixed(2)),
      total_refunds: parseFloat(returnData.total_refunds.toFixed(2)),
      total_cogs: cogs,
      total_discounts: parseFloat(data.total_discounts.toFixed(2)),
      gross_profit: grossProfit,
      gross_margin_percentage: margin,
    };
  },
};

module.exports = Report;
