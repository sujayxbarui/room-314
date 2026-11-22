import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Minus,
  Search,
  CheckCircle,
  Warehouse,
  RefreshCw,
  Filter,
  Save,
  Package,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/ui/Button';
import StockBadge from '../components/shared/StockBadge';
import Spinner from '../components/ui/Spinner';

export default function StockPurchase() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'modified' | 'low_stock'

  // Map of product_id -> quantity to add (e.g. { 1: 10, 2: 5 })
  const [addQtyMap, setAddQtyMap] = useState({});

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        api.get('/products', { limit: 200 }),
        api.get('/categories').catch(() => []),
      ]);

      const items = prodRes.products || [];
      setProducts(items);
      setCategories(Array.isArray(catRes) ? catRes : []);
    } catch (err) {
      toast.error('Failed to load products for stock update');
    } finally {
      setLoading(false);
    }
  };

  const handleSetAddQty = (productId, qty) => {
    const val = parseInt(qty, 10);
    setAddQtyMap((prev) => {
      const copy = { ...prev };
      if (isNaN(val) || val <= 0) {
        delete copy[productId];
      } else {
        copy[productId] = val;
      }
      return copy;
    });
  };

  const handleStepQty = (productId, delta) => {
    const current = addQtyMap[productId] || 0;
    const next = Math.max(0, current + delta);
    handleSetAddQty(productId, next);
  };

  const handleQuickAdd = (productId, amount) => {
    const current = addQtyMap[productId] || 0;
    handleSetAddQty(productId, current + amount);
  };

  const handleClearAllChanges = () => {
    setAddQtyMap({});
    toast.success('Cleared changes');
  };

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));

    const matchCategory = !selectedCategory || String(p.category_id) === String(selectedCategory);

    let matchFilter = true;
    if (filterMode === 'modified') {
      matchFilter = Boolean(addQtyMap[p.id] && addQtyMap[p.id] > 0);
    } else if (filterMode === 'low_stock') {
      matchFilter = p.stock <= (p.low_stock_threshold || 5);
    }

    return matchSearch && matchCategory && matchFilter;
  });

  const modifiedCount = Object.keys(addQtyMap).length;
  const totalUnitsToAdd = Object.values(addQtyMap).reduce((sum, q) => sum + (parseInt(q, 10) || 0), 0);

  const handleSaveSync = async () => {
    const updates = Object.entries(addQtyMap)
      .filter(([_, qty]) => parseInt(qty, 10) > 0)
      .map(([id, qty]) => ({
        product_id: parseInt(id, 10),
        add_quantity: parseInt(qty, 10),
      }));

    if (updates.length === 0) {
      toast.error('No stock quantities have been modified. Increase quantity for items you received.');
      return;
    }

    try {
      setSaving(true);
      const res = await api.post('/inventory/quick-sync', { updates });
      toast.success(res.message || `Successfully synced stock for ${updates.length} products!`);
      setAddQtyMap({});
      navigate('/inventory');
    } catch (err) {
      toast.error(err.message || 'Failed to sync inventory');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="p-2 rounded-lg hover:bg-navy-100 text-navy-600 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Add Stock to Inventory</h1>
            <p className="text-sm text-navy-500">
              All your store products are listed below — simply increase quantities to sync stock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {modifiedCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAllChanges}
              className="text-navy-500 hover:text-navy-800"
            >
              Reset Changes
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            icon={Save}
            loading={saving}
            disabled={modifiedCount === 0}
            onClick={handleSaveSync}
            className="font-bold shadow-sm"
          >
            Sync {modifiedCount > 0 ? `(${modifiedCount} Items)` : ''} to Inventory
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex-1 w-full md:w-auto relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search product name, brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-navy-50/60 border border-navy-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg text-navy-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-lg border border-navy-200 bg-navy-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterMode === 'all' ? 'bg-white text-navy-900 shadow-2xs font-bold' : 'text-navy-600'
              }`}
            >
              All ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('modified')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterMode === 'modified' ? 'bg-teal-600 text-white shadow-2xs font-bold' : 'text-navy-600'
              }`}
            >
              Changed ({modifiedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('low_stock')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterMode === 'low_stock' ? 'bg-amber-500 text-white shadow-2xs font-bold' : 'text-navy-600'
              }`}
            >
              Low Stock
            </button>
          </div>
        </div>
      </div>

      {/* Products Stock Sync Table */}
      <div className="bg-white rounded-lg border border-navy-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-navy-400">
            <Spinner size="md" />
            <p className="mt-2 text-xs">Loading store catalogue...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-navy-500 space-y-2">
            <Package size={36} className="mx-auto text-navy-300" />
            <p className="text-sm font-medium">No products match your search/filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50 text-navy-700 text-xs uppercase font-medium border-b border-navy-200">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center w-28">Current Stock</th>
                  <th className="px-4 py-3 text-center w-72">Stock to Add (+ Qty)</th>
                  <th className="px-4 py-3 text-center w-36">New Total Stock</th>
                  <th className="px-4 py-3 text-right">Selling Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {filteredProducts.map((p) => {
                  const toAdd = addQtyMap[p.id] || 0;
                  const newTotal = p.stock + toAdd;
                  const isModified = toAdd > 0;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isModified ? 'bg-teal-50/30' : 'hover:bg-navy-50/50'
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-navy-900">
                        {p.name}
                        {p.brand && (
                          <span className="text-xs text-navy-500 block font-normal">{p.brand}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-navy-600">
                        {p.category_name || 'General'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-navy-800">{p.stock}</span>{' '}
                        <span className="text-xs text-navy-500">{p.unit}</span>
                      </td>

                      {/* Stock to Add controls */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStepQty(p.id, -1)}
                            disabled={!toAdd}
                            className="w-7 h-7 rounded border border-navy-200 bg-white hover:bg-navy-100 text-navy-700 font-bold flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition"
                          >
                            <Minus size={13} />
                          </button>

                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={addQtyMap[p.id] !== undefined ? addQtyMap[p.id] : ''}
                            onChange={(e) => handleSetAddQty(p.id, e.target.value)}
                            className={`w-16 px-2 py-1 text-center font-bold text-sm border rounded focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                              isModified
                                ? 'border-teal-500 text-teal-800 bg-teal-50/50'
                                : 'border-navy-200 text-navy-800 bg-white'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleStepQty(p.id, 1)}
                            className="w-7 h-7 rounded border border-navy-200 bg-white hover:bg-navy-100 text-navy-700 font-bold flex items-center justify-center transition"
                          >
                            <Plus size={13} />
                          </button>

                          {/* Quick Add Pills */}
                          <div className="flex items-center gap-1 ml-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(p.id, 5)}
                              className="px-2 py-1 text-[11px] font-semibold bg-navy-100 hover:bg-teal-100 text-navy-700 hover:text-teal-800 rounded transition"
                              title="Add +5"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(p.id, 10)}
                              className="px-2 py-1 text-[11px] font-semibold bg-navy-100 hover:bg-teal-100 text-navy-700 hover:text-teal-800 rounded transition"
                              title="Add +10"
                            >
                              +10
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* New Total Stock Preview */}
                      <td className="px-4 py-3 text-center">
                        {isModified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200 animate-pulse">
                            <CheckCircle size={12} />
                            {newTotal} {p.unit}
                          </span>
                        ) : (
                          <span className="text-xs text-navy-400">{p.stock} {p.unit}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-navy-900">
                        {formatCurrency(p.selling_price)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Bottom Bar when items are modified */}
      {modifiedCount > 0 && (
        <div className="fixed bottom-4 left-64 right-6 bg-navy-900 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between z-30 border border-navy-700 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <Warehouse size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Ready to Sync: {modifiedCount} product{modifiedCount > 1 ? 's' : ''} ({totalUnitsToAdd} total units)
              </p>
              <p className="text-xs text-navy-300">
                Clicking Sync will atomically update your live store inventory and stock ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAllChanges}
              className="text-navy-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={CheckCircle}
              loading={saving}
              onClick={handleSaveSync}
              className="font-bold px-6 py-2 bg-teal-500 hover:bg-teal-400 text-navy-950"
            >
              Sync & Save Stock to Inventory
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
