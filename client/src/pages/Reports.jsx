import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
  Receipt,
  Package,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency, formatDateTime, getLocalDateString } from '../utils/formatters';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'best_sellers' | 'profit' | 'products'
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [loading, setLoading] = useState(false);
  const [dailyData, setDailyData] = useState(null);
  const [bestSellers, setBestSellers] = useState([]);
  const [profitData, setProfitData] = useState(null);
  const [productSales, setProductSales] = useState([]);

  const fetchCurrentTab = async () => {
    try {
      setLoading(true);
      if (activeTab === 'daily') {
        const res = await api.get('/reports/daily', { date: selectedDate });
        setDailyData(res);
      } else if (activeTab === 'best_sellers') {
        const res = await api.get('/reports/best-sellers', { from: fromDate, to: toDate, limit: 15 });
        setBestSellers(Array.isArray(res) ? res : []);
      } else if (activeTab === 'profit') {
        const res = await api.get('/reports/profit', { from: fromDate, to: toDate });
        setProfitData(res);
      } else if (activeTab === 'products') {
        const res = await api.get('/reports/products', { from: fromDate, to: toDate });
        setProductSales(Array.isArray(res) ? res : []);
      }
    } catch (err) {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentTab();
  }, [activeTab, selectedDate, fromDate, toDate]);

  const handleExportCSV = (type) => {
    const token = localStorage.getItem('token');
    const url = `/api/reports/export/csv?type=${type}&from=${fromDate}&to=${toDate}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Sales & Business Reports</h1>
          <p className="text-sm text-navy-500">Track revenue, gross margins, best-moving stock, and daily receipts</p>
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={Download}
            onClick={() => handleExportCSV('sales')}
            size="sm"
          >
            Export Sales CSV
          </Button>
          <Button
            variant="secondary"
            icon={Download}
            onClick={() => handleExportCSV('inventory')}
            size="sm"
          >
            Export Inventory CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-navy-200 gap-6 overflow-x-auto">
        {[
          { key: 'daily', label: "Today's Sales" },
          { key: 'best_sellers', label: 'Best Sellers' },
          { key: 'profit', label: 'Profit & Margins' },
          { key: 'products', label: 'Product-wise Sales' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Pickers */}
      <div className="bg-white p-3 rounded-lg border border-navy-200 shadow-sm flex items-center justify-between gap-4">
        {activeTab === 'daily' ? (
          <div className="flex items-center gap-2 text-sm text-navy-700 font-medium">
            <Calendar size={16} className="text-navy-400" />
            <span>Select Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-1 text-xs border border-navy-200 rounded font-semibold focus:ring-1 focus:ring-teal-500"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-navy-700 font-medium">
            <Calendar size={16} className="text-navy-400" />
            <span>Date Range:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 text-xs border border-navy-200 rounded font-semibold"
            />
            <span className="text-navy-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 text-xs border border-navy-200 rounded font-semibold"
            />
          </div>
        )}

        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchCurrentTab}>
          Refresh
        </Button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-navy-400">
          <Spinner size="md" />
          <p className="mt-2 text-xs">Computing report metrics...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: DAILY SALES */}
          {activeTab === 'daily' && dailyData && (
            <div className="space-y-6">
              {/* Daily KPI summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
                  <p className="text-xs uppercase font-semibold text-navy-500">Day's Total Revenue</p>
                  <p className="text-2xl font-extrabold text-navy-900 mt-1">
                    {formatCurrency(dailyData.total_sales || 0)}
                  </p>
                  <p className="text-xs text-navy-400 mt-0.5">{dailyData.transaction_count || 0} completed bills</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
                  <p className="text-xs uppercase font-semibold text-navy-500">Gross Profit (Revenue - Cost)</p>
                  <p className="text-2xl font-extrabold text-teal-700 mt-1">
                    {formatCurrency(dailyData.estimated_profit || 0)}
                  </p>
                  <p className="text-xs text-teal-600 mt-0.5">
                    {dailyData.total_sales > 0
                      ? `${((dailyData.estimated_profit / dailyData.total_sales) * 100).toFixed(1)}% margin`
                      : '0% margin'}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
                  <p className="text-xs uppercase font-semibold text-navy-500">Cash vs UPI Split</p>
                  <p className="text-sm font-bold text-navy-800 mt-2">
                    Cash: {formatCurrency(dailyData.cash_total || 0)}
                  </p>
                  <p className="text-sm font-bold text-teal-700">
                    UPI: {formatCurrency(dailyData.upi_total || 0)}
                  </p>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="bg-white rounded-lg border border-navy-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-navy-200 font-bold text-navy-900 text-sm">
                  All Bills for {selectedDate}
                </div>
                {(!dailyData.sales || dailyData.sales.length === 0) ? (
                  <div className="p-8 text-center text-navy-400 text-sm">No sales recorded on this date.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-navy-50 text-navy-700 text-xs uppercase font-medium border-b border-navy-200">
                        <tr>
                          <th className="px-4 py-2.5">Receipt #</th>
                          <th className="px-4 py-2.5">Time</th>
                          <th className="px-4 py-2.5">Items</th>
                          <th className="px-4 py-2.5">Customer</th>
                          <th className="px-4 py-2.5 text-center">Payment</th>
                          <th className="px-4 py-2.5 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-100">
                        {dailyData.sales.map((s) => (
                          <tr key={s.id} className="hover:bg-navy-50/50">
                            <td className="px-4 py-3 font-mono text-xs font-bold text-navy-900">{s.receipt_number}</td>
                            <td className="px-4 py-3 text-xs text-navy-500">
                              {new Date(s.sale_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 text-xs text-navy-600">
                              {s.items?.length || 1} item{s.items?.length > 1 ? 's' : ''}
                            </td>
                            <td className="px-4 py-3 text-xs text-navy-700">{s.customer_name || 'Walk-in'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-[11px] font-semibold uppercase bg-navy-100 px-2 py-0.5 rounded text-navy-700">
                                {s.payment_method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-navy-900">
                              {formatCurrency(s.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Returns on this Date */}
                {dailyData.returns && dailyData.returns.length > 0 && (
                  <div className="border-t border-navy-200 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                        <RotateCcw size={16} /> Returns Recorded on {selectedDate} ({dailyData.returns.length})
                      </h3>
                      <span className="text-xs font-bold text-rose-700">
                        Total Refunded: -{formatCurrency(dailyData.total_refunds)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-rose-50 text-navy-700 font-semibold border-b border-rose-200">
                          <tr>
                            <th className="px-4 py-2">Return ID</th>
                            <th className="px-4 py-2">Items Returned</th>
                            <th className="px-4 py-2">Reason</th>
                            <th className="px-4 py-2">Method</th>
                            <th className="px-4 py-2 text-right">Refund Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-100">
                          {dailyData.returns.map((ret) => (
                            <tr key={ret.id} className="hover:bg-rose-50/30">
                              <td className="px-4 py-2.5 font-mono font-bold text-rose-700">RET-#{ret.id}</td>
                              <td className="px-4 py-2.5 text-navy-800">
                                {(ret.items || []).map((i) => `${i.product_name_snapshot} (${i.quantity})`).join(', ')}
                              </td>
                              <td className="px-4 py-2.5 text-navy-600">{ret.reason || 'Customer Return'}</td>
                              <td className="px-4 py-2.5 uppercase font-bold text-navy-600">{ret.refund_method}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-rose-700">
                                -{formatCurrency(ret.refund_amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BEST SELLERS */}
          {activeTab === 'best_sellers' && (
            <div className="bg-white rounded-lg border border-navy-200 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-bold text-navy-900">Top Selling Products</h2>
              <p className="text-xs text-navy-500">Ranked by units sold in the selected date range</p>

              {bestSellers.length === 0 ? (
                <div className="p-8 text-center text-navy-400 text-sm">No sales data in this date range</div>
              ) : (
                <div className="space-y-3 pt-2">
                  {bestSellers.map((item, idx) => {
                    const maxQty = bestSellers[0]?.total_quantity || 1;
                    const percent = Math.min(100, Math.round((item.total_quantity / maxQty) * 100));

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="font-semibold text-navy-900">
                            #{idx + 1} {item.product_name}
                          </span>
                          <span className="font-bold text-navy-800">
                            {item.total_quantity} sold • {formatCurrency(item.total_revenue)}
                          </span>
                        </div>
                        {/* CSS Bar */}
                        <div className="w-full bg-navy-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PROFIT & MARGINS */}
          {activeTab === 'profit' && profitData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
                  <p className="text-xs uppercase font-semibold text-navy-500">Gross Sales Revenue</p>
                  <p className="text-2xl font-extrabold text-navy-900 mt-1">{formatCurrency(profitData.revenue || 0)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
                  <p className="text-xs uppercase font-semibold text-navy-500">Cost of Goods Sold (COGS)</p>
                  <p className="text-2xl font-extrabold text-navy-600 mt-1">{formatCurrency(profitData.cogs || 0)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
                  <p className="text-xs uppercase font-semibold text-navy-500">Gross Profit</p>
                  <p className="text-2xl font-extrabold text-teal-700 mt-1">{formatCurrency(profitData.gross_profit || 0)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
                  <p className="text-xs uppercase font-semibold text-navy-500">Gross Profit Margin</p>
                  <p className="text-2xl font-extrabold text-teal-800 mt-1">{profitData.margin_percentage || '0.0'}%</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRODUCT-WISE SALES */}
          {activeTab === 'products' && (
            <div className="bg-white rounded-lg border border-navy-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-navy-50 text-navy-700 text-xs uppercase font-medium border-b border-navy-200">
                    <tr>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3 text-center">Units Sold</th>
                      <th className="px-4 py-3 text-right">Total Revenue</th>
                      <th className="px-4 py-3 text-right">Avg Price / Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {productSales.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-navy-400">
                          No product sales in this period
                        </td>
                      </tr>
                    ) : (
                      productSales.map((p, idx) => (
                        <tr key={idx} className="hover:bg-navy-50/50">
                          <td className="px-4 py-3 font-semibold text-navy-900">{p.product_name}</td>
                          <td className="px-4 py-3 text-center font-bold text-navy-800">{p.total_quantity}</td>
                          <td className="px-4 py-3 text-right font-extrabold text-teal-700">
                            {formatCurrency(p.total_revenue)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-navy-600">
                            {formatCurrency(p.total_revenue / p.total_quantity)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

