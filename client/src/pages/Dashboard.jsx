import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  Receipt,
  AlertTriangle,
  Package,
  PlusCircle,
  ShoppingCart,
  Upload,
  ArrowRight,
  RefreshCw,
  Calendar,
  Folder,
  CheckCircle2,
  Clock,
  CreditCard,
  Banknote,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, getLocalDateString } from '../utils/formatters';
import StatCard from '../components/shared/StatCard';
import StockBadge from '../components/shared/StockBadge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [todayStr, setTodayStr] = useState(getLocalDateString());
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [loading, setLoading] = useState(true);

  // All-time aggregate and date breakdown
  const [allTimeData, setAllTimeData] = useState({
    all_time_sales: 0,
    total_orders: 0,
    total_profit: 0,
    dates: [],
    sales_folder: '',
  });

  // Selected date's detailed report
  const [dateSalesData, setDateSalesData] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [inventorySummary, setInventorySummary] = useState(null);

  useEffect(() => {
    fetchAllTimeData();
  }, []);

  useEffect(() => {
    fetchDateSales(selectedDate);
  }, [selectedDate]);

  const fetchAllTimeData = async () => {
    try {
      const [allTimeRes, lowStockRes, invRes] = await Promise.all([
        api.get('/reports/all-time').catch(() => null),
        api.get('/products/low-stock').catch(() => []),
        api.get('/reports/inventory-valuation').catch(() => null),
      ]);

      if (allTimeRes) setAllTimeData(allTimeRes);
      setLowStockItems(Array.isArray(lowStockRes) ? lowStockRes : []);
      setInventorySummary(invRes);
    } catch (e) {
      console.error('Failed to load all-time dashboard data', e);
    }
  };

  const fetchDateSales = async (date) => {
    try {
      setLoading(true);
      const res = await api.get('/reports/daily', { date });
      setDateSalesData(res);
    } catch (err) {
      console.error('Failed to load sales for date', date, err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    const currentLocal = getLocalDateString();
    setTodayStr(currentLocal);
    fetchAllTimeData();
    fetchDateSales(selectedDate);
    toast.success('Dashboard refreshed');
  };

  // Midnight auto-rollover listener: switches date automatically at 12:00 midnight local time
  useEffect(() => {
    const timer = setInterval(() => {
      const currentLocal = getLocalDateString();
      if (currentLocal !== todayStr) {
        setTodayStr(currentLocal);
        setSelectedDate(currentLocal);
        fetchAllTimeData();
        fetchDateSales(currentLocal);
        toast('Midnight rollover: Switched to new day!', { icon: '🌙' });
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [todayStr]);

  const handleResetDay = async () => {
    try {
      setResetting(true);
      const res = await api.post('/reports/reset-day', { date: selectedDate });
      toast.success(res.message || `Register for ${selectedDate} reset to ₹0.00!`);
      setResetModalOpen(false);
      fetchAllTimeData();
      fetchDateSales(selectedDate);
    } catch (err) {
      toast.error(err.message || 'Failed to reset register');
    } finally {
      setResetting(false);
    }
  };

  const isToday = selectedDate === todayStr;

  // Selected date numbers
  const dateSales = dateSalesData?.total_sales || 0;
  const dateOrders = dateSalesData?.transaction_count || 0;
  const dateProfit = dateSalesData?.estimated_profit || 0;
  const totalProducts = inventorySummary?.total_products || 0;
  const totalStockValue = inventorySummary?.total_retail_value || 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            {isToday ? "Today's Overview" : `Sales Overview — ${selectedDate}`}
          </h1>
          <p className="text-sm text-navy-500">
            {isToday
              ? 'Live sales and inventory status for Room-314'
              : `Sales and transaction history recorded on ${selectedDate}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            icon={RefreshCw}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={ShoppingCart}
            onClick={() => navigate('/pos')}
          >
            New Sale (POS)
          </Button>
        </div>
      </div>

      {/* Date Selector & Navigation Bar */}
      <div className="bg-white rounded-lg border border-navy-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-navy-600 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={14} className="text-teal-600" />
            View Sales By Date:
          </span>

          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              isToday
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            Today's Overview
          </button>

          {/* Quick Date Chips from recorded sales dates */}
          {(allTimeData.dates || [])
            .filter((d) => d.date !== todayStr)
            .slice(0, 4)
            .map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  selectedDate === d.date
                    ? 'bg-navy-800 text-white font-bold shadow-xs'
                    : 'bg-navy-50 text-navy-700 border border-navy-200 hover:bg-navy-100'
                }`}
              >
                {d.date} ({formatCurrency(d.total_sales)})
              </button>
            ))}
        </div>

        {/* Date Picker Input & Manual Reset */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-navy-500 font-medium">Pick Date:</span>
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            className="px-2.5 py-1 text-xs border border-navy-300 rounded-md font-mono bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-navy-800"
          />

          {isAdmin && (
            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className="px-2.5 py-1 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1 shrink-0"
              title="Reset this day's sales register to ₹0.00 (safely auto-archives to sales_records/ first)"
            >
              <RotateCcw size={12} />
              Reset to ₹0
            </button>
          )}
        </div>
      </div>

      {/* Primary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Selected Date Sales */}
        <StatCard
          label={isToday ? "Today's Net Sales" : `Net Sales on ${selectedDate}`}
          value={formatCurrency(dateSales)}
          icon={TrendingUp}
          trend={
            dateSalesData?.total_refunds > 0
              ? `${dateOrders} order${dateOrders !== 1 ? 's' : ''} • -${formatCurrency(dateSalesData.total_refunds)} returned`
              : dateOrders > 0
              ? `${dateOrders} order${dateOrders !== 1 ? 's' : ''}`
              : 'No orders on this date'
          }
        />

        {/* Card 2: All-Time Total Sales */}
        <StatCard
          label="All-Time Net Sales"
          value={formatCurrency(allTimeData.all_time_sales)}
          icon={Receipt}
          trend={
            allTimeData.total_refunds > 0
              ? `${allTimeData.total_orders} orders • -${formatCurrency(allTimeData.total_refunds)} returned`
              : `Across ${allTimeData.total_orders} total orders recorded`
          }
        />

        {/* Card 3: Selected Date Estimated Profit */}
        <StatCard
          label={isToday ? "Today's Profit" : `Profit on ${selectedDate}`}
          value={formatCurrency(dateProfit)}
          icon={TrendingUp}
          trend={dateSales > 0 ? `${((dateProfit / dateSales) * 100).toFixed(1)}% gross margin` : 'Revenue - Cost of goods'}
        />

        {/* Card 4: Inventory & Total Stock */}
        <StatCard
          label="Total Products in Stock"
          value={totalProducts.toString()}
          icon={Package}
          trend={`Inventory valued at ${formatCurrency(totalStockValue)}`}
        />
      </div>

      {/* Storage Folder Information Badge */}
      <div className="bg-teal-50/60 border border-teal-200 rounded-lg p-3 text-xs text-teal-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-start sm:items-center gap-2">
          <Folder size={18} className="text-teal-700 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span className="font-bold">Daily Sales Auto-Save Folder:</span>
            <span className="ml-1.5 font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-teal-200 text-navy-800 break-all">
              {allTimeData.sales_folder || 'sales_records/'}
            </span>
          </div>
        </div>
        <span className="text-[11px] text-teal-800 font-medium">
          Daily sales files are automatically archived here as JSON & CSV when each day concludes.
        </span>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white rounded-lg border border-navy-200 p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-navy-500 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/pos"
            className="flex items-center gap-3 p-3 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100/70 transition-colors"
          >
            <div className="p-2 bg-teal-600 text-white rounded-md">
              <ShoppingCart size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-teal-900">Start Sale</p>
              <p className="text-xs text-teal-700">Open POS billing</p>
            </div>
          </Link>

          <Link
            to="/inventory/purchase"
            className="flex items-center gap-3 p-3 rounded-lg border border-navy-200 bg-navy-50 hover:bg-navy-100/70 transition-colors"
          >
            <div className="p-2 bg-navy-700 text-white rounded-md">
              <Package size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">Add Stock</p>
              <p className="text-xs text-navy-500">Quick increase stock</p>
            </div>
          </Link>

          <Link
            to="/products/import"
            className="flex items-center gap-3 p-3 rounded-lg border border-navy-200 bg-navy-50 hover:bg-navy-100/70 transition-colors"
          >
            <div className="p-2 bg-navy-700 text-white rounded-md">
              <Upload size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">Upload Blinkit</p>
              <p className="text-xs text-navy-500">Screenshot to catalogue</p>
            </div>
          </Link>

          <Link
            to="/products/add"
            className="flex items-center gap-3 p-3 rounded-lg border border-navy-200 bg-navy-50 hover:bg-navy-100/70 transition-colors"
          >
            <div className="p-2 bg-navy-700 text-white rounded-md">
              <PlusCircle size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">Add Product</p>
              <p className="text-xs text-navy-500">New single product</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Completed Orders List for the Selected Date */}
      <div className="bg-white rounded-lg border border-navy-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-navy-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-teal-600" />
            <h2 className="text-base font-semibold text-navy-900">
              {isToday ? "Today's Orders" : `Orders on ${selectedDate}`}
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-navy-100 text-navy-700">
              {dateOrders} order{dateOrders !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="text-xs text-navy-500 font-medium">
            Total Revenue: <strong className="text-navy-900 font-bold">{formatCurrency(dateSales)}</strong>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-navy-400">
            <Spinner size="md" />
            <p className="mt-2 text-xs">Loading orders for {selectedDate}...</p>
          </div>
        ) : !dateSalesData?.sales || dateSalesData.sales.length === 0 ? (
          <div className="p-12 text-center text-navy-500 text-sm">
            No sales recorded on {isToday ? 'today yet' : selectedDate}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50 text-navy-700 text-xs uppercase font-medium border-b border-navy-200">
                <tr>
                  <th className="px-4 py-2.5">Receipt #</th>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Payment</th>
                  <th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {dateSalesData.sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-navy-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-teal-700 text-xs">
                      {sale.receipt_number}
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {sale.sale_date.split(' ')[1] || sale.sale_date}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-700">
                      {sale.customer_name || 'Walk-in Customer'}
                      {sale.customer_phone && (
                        <span className="block text-[11px] text-navy-400 font-mono">
                          {sale.customer_phone}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          sale.payment_method === 'cash'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {sale.payment_method === 'cash' ? (
                          <Banknote size={12} />
                        ) : (
                          <CreditCard size={12} />
                        )}
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-600">
                      {(sale.items || []).map((i) => `${i.product_name_snapshot} (${i.quantity})`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-navy-900">
                      {formatCurrency(sale.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Returns on Selected Date Section */}
      {dateSalesData?.returns && dateSalesData.returns.length > 0 && (
        <div className="bg-white rounded-lg border border-rose-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
            <div className="flex items-center gap-2">
              <RotateCcw size={16} className="text-rose-600" />
              <h2 className="text-sm font-bold text-navy-900">
                Returns &amp; Restocks on {isToday ? 'Today' : selectedDate}
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                {dateSalesData.returns.length} return{dateSalesData.returns.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-xs text-rose-700 font-bold">
              Total Refunded: -{formatCurrency(dateSalesData.total_refunds)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/30 text-navy-600 uppercase font-semibold border-b border-rose-100">
                <tr>
                  <th className="px-4 py-2">Return ID</th>
                  <th className="px-4 py-2">Items Returned</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2 text-right">Refund Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {dateSalesData.returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-rose-50/20">
                    <td className="px-4 py-2.5 font-mono font-bold text-rose-700">RET-#{ret.id}</td>
                    <td className="px-4 py-2.5 text-navy-700">
                      {(ret.items || []).map((i) => `${i.product_name_snapshot} (${i.quantity})`).join(', ')}
                    </td>
                    <td className="px-4 py-2.5 text-navy-600">{ret.reason || 'Customer Return'}</td>
                    <td className="px-4 py-2.5 uppercase font-bold text-navy-500">{ret.refund_method}</td>
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

      {/* Low Stock Alerts */}
      <div className="bg-white rounded-lg border border-navy-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-navy-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="text-base font-semibold text-navy-900">Low Stock & Out of Stock Alerts</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {lowStockItems.length} items
            </span>
          </div>
          <Link
            to="/inventory/purchase"
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 bg-teal-50 px-2.5 py-1 rounded border border-teal-200"
          >
            Quick Add Stock <ArrowRight size={14} />
          </Link>
        </div>

        {lowStockItems.length === 0 ? (
          <div className="p-8 text-center text-navy-500 text-sm">
            ✅ All products have healthy stock levels!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50 text-navy-700 text-xs uppercase font-medium border-b border-navy-200">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5 text-right">Selling Price</th>
                  <th className="px-4 py-2.5 text-center">Current Stock</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {lowStockItems.slice(0, 8).map((item) => (
                  <tr key={item.id} className="hover:bg-navy-50/50">
                    <td className="px-4 py-3 font-medium text-navy-900">
                      {item.name}
                      {item.brand && <span className="text-xs text-navy-500 block">{item.brand}</span>}
                    </td>
                    <td className="px-4 py-3 text-navy-600">{item.category_name || 'General'}</td>
                    <td className="px-4 py-3 text-right font-medium text-navy-900">
                      {formatCurrency(item.selling_price)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-navy-900">
                      {item.stock} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StockBadge stock={item.stock} threshold={item.low_stock_threshold} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/inventory/purchase"
                        className="text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-2.5 py-1 rounded border border-teal-200"
                      >
                        + Add Stock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset Register Confirmation Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Register for This Date?"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <CheckCircle2 size={14} className="text-amber-700" />
              Automatic Backup Guaranteed:
            </p>
            <p>
              All current sales for <span className="font-bold">{selectedDate}</span> are automatically saved into your <span className="font-mono bg-amber-100 px-1 rounded">sales_records/</span> folder in JSON & CSV format before resetting.
            </p>
            <p className="mt-1">
              Today's sales counter will be reset back to <span className="font-bold">₹0.00 (0 orders)</span>.
            </p>
          </div>

          <p className="text-sm text-navy-700">
            Do you want to reset the register for <strong className="text-navy-950 font-bold">{selectedDate}</strong> to ₹0.00?
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-navy-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetModalOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={resetting}
              onClick={handleResetDay}
              icon={RotateCcw}
            >
              Confirm Reset to ₹0.00
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
