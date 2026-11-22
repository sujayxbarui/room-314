import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Warehouse,
  Plus,
  Search,
  Filter,
  SlidersHorizontal,
  RefreshCw,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import StockBadge from '../components/shared/StockBadge';
import Spinner from '../components/ui/Spinner';

export default function Inventory() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockStatus, setStockStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantityChange, setQuantityChange] = useState('');
  const [adjustReason, setAdjustReason] = useState('count_correction');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = { limit: 200 };
      if (search) params.search = search;
      if (stockStatus !== 'all') params.stock_status = stockStatus;
      if (category) params.category_id = category;

      const res = await api.get('/inventory', params);
      const list = res?.products || res?.items || (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/categories').then((cats) => setCategories(Array.isArray(cats) ? cats : []));
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [stockStatus, category]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInventory();
  };

  const openAdjustModal = (product) => {
    setSelectedProduct(product);
    setQuantityChange('');
    setAdjustReason('count_correction');
    setAdjustNotes('');
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    const change = parseInt(quantityChange, 10);
    if (!change || isNaN(change)) {
      toast.error('Please enter a valid quantity change (e.g. +5 or -2)');
      return;
    }

    try {
      setSavingAdjust(true);
      await api.post('/inventory/adjust', {
        product_id: selectedProduct.id,
        quantity_change: change,
        reason: adjustReason,
        notes: adjustNotes,
      });

      toast.success('Stock adjusted successfully');
      setAdjustModalOpen(false);
      fetchInventory();
    } catch (err) {
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setSavingAdjust(false);
    }
  };

  const totalStockValue = items.reduce(
    (sum, item) => sum + (parseFloat(item.stock_value) || (item.stock * (item.purchase_price || item.selling_price * 0.82 || 0))),
    0
  );
  const totalUnits = items.reduce((sum, item) => sum + (parseInt(item.stock, 10) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Inventory Management</h1>
          <p className="text-sm text-navy-500">Live stock valuation, threshold monitoring, and adjustments</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Link to="/inventory/purchase">
              <Button variant="primary" icon={Plus}>
                + Add Stock to Products
              </Button>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <Lock size={13} /> View Only Mode (Staff)
            </span>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-amber-600 flex-shrink-0" />
            <span>
              <strong>Staff Permissions:</strong> Live stock valuation and quantities are view-only. Purchasing new inventory or performing stock corrections is restricted to store administrators.
            </span>
          </div>
          <span className="font-semibold uppercase tracking-wider text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
            Read Only
          </span>
        </div>
      )}

      {/* Valuation Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
          <p className="text-xs uppercase font-semibold text-navy-500">Total Valuation (Cost)</p>
          <p className="text-2xl font-extrabold text-navy-900 mt-1">{formatCurrency(totalStockValue)}</p>
          <p className="text-xs text-navy-400 mt-0.5">Based on purchase cost</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
          <p className="text-xs uppercase font-semibold text-navy-500">Total Physical Units</p>
          <p className="text-2xl font-extrabold text-teal-700 mt-1">{totalUnits} units</p>
          <p className="text-xs text-navy-400 mt-0.5">Across {items.length} products</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm">
          <p className="text-xs uppercase font-semibold text-navy-500">Low & Out of Stock</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">
            {items.filter((i) => i.stock <= i.low_stock_threshold).length} items
          </p>
          <p className="text-xs text-navy-400 mt-0.5">Require replenishment</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full md:w-auto relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search inventory by product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-navy-50/60 border border-navy-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg text-navy-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg text-navy-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Items</option>
            <option value="low">Low Stock (≤ Threshold)</option>
            <option value="out">Out of Stock (0)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-navy-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-navy-400">
            <Spinner size="md" />
            <p className="mt-2 text-xs">Loading inventory ledger...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-navy-500">
            <Warehouse size={36} className="mx-auto text-navy-300 mb-2" />
            <p className="text-sm font-medium">No inventory items match your filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50 text-navy-700 text-xs uppercase font-medium border-b border-navy-200">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Cost Price</th>
                  <th className="px-4 py-3 text-right">Selling Price</th>
                  <th className="px-4 py-3 text-center">In Stock</th>
                  <th className="px-4 py-3 text-right">Stock Valuation</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">{isAdmin ? 'Adjust' : 'Access'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-navy-50/50 transition-colors ${
                      item.stock === 0 ? 'bg-red-50/20' : item.stock <= item.low_stock_threshold ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-navy-900">
                      {item.name}
                      {item.brand && <span className="text-xs text-navy-500 block font-normal">{item.brand}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-600">{item.category_name || 'General'}</td>
                    <td className="px-4 py-3 text-right text-xs text-navy-600">{formatCurrency(item.purchase_price || 0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-teal-700">{formatCurrency(item.selling_price)}</td>
                    <td className="px-4 py-3 text-center font-bold text-navy-900">
                      {item.stock} <span className="text-xs text-navy-500 font-normal">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-navy-900">
                      {formatCurrency(item.stock_value || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StockBadge stock={item.stock} threshold={item.low_stock_threshold} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => openAdjustModal(item)}
                          className="text-xs font-semibold text-navy-600 hover:text-teal-700 bg-navy-50 hover:bg-teal-50 px-2 py-1 rounded border border-navy-200 transition"
                        >
                          Adjust
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-navy-400 bg-navy-50 px-2 py-0.5 rounded border border-navy-200">
                          <Lock size={11} /> Locked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Manual Stock Adjustment"
        size="md"
      >
        {selectedProduct && (
          <form onSubmit={handleSaveAdjustment} className="space-y-4">
            <div className="bg-navy-50 p-3 rounded-lg border border-navy-200">
              <p className="text-xs text-navy-500">Selected Product</p>
              <p className="text-sm font-bold text-navy-900">{selectedProduct.name}</p>
              <p className="text-xs text-navy-600 mt-1">
                Current Stock: <strong>{selectedProduct.stock} {selectedProduct.unit}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1">
                Quantity Change (+ to add, - to deduct) *
              </label>
              <Input
                type="number"
                placeholder="e.g. +5 or -2"
                value={quantityChange}
                onChange={(e) => setQuantityChange(e.target.value)}
                required
              />
              <p className="text-xs text-navy-400 mt-1">
                New stock will be:{' '}
                <strong>
                  {selectedProduct.stock + (parseInt(quantityChange, 10) || 0)} {selectedProduct.unit}
                </strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1">
                Reason *
              </label>
              <select
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg text-navy-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="count_correction">Physical Count Correction</option>
                <option value="damaged">Damaged / Leaked</option>
                <option value="expired">Expired</option>
                <option value="supplier_return">Returned to Supplier</option>
                <option value="other">Other</option>
              </select>
            </div>

            <Input
              label="Notes (Optional)"
              placeholder="e.g. packet crushed during unloading"
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-navy-100">
              <Button type="button" variant="secondary" onClick={() => setAdjustModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={savingAdjust}>
                Save Adjustment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

