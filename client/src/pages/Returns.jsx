import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Package,
  ArrowRight,
  History,
  AlertCircle,
  Tag,
  Warehouse,
  Check,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import StockBadge from '../components/shared/StockBadge';
import Modal from '../components/ui/Modal';

export default function Returns() {
  const [activeTab, setActiveTab] = useState('process'); // 'process' | 'history'

  // Catalogue & Articles state (identical to New Sale)
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Return Cart state
  const [returnCart, setReturnCart] = useState([]);
  const [refundMethod, setRefundMethod] = useState('cash'); // 'cash' | 'upi'
  const [returnReason, setReturnReason] = useState('Customer Return');
  const [restockToInventory, setRestockToInventory] = useState(true);
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Success summary modal
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [lastReturnResult, setLastReturnResult] = useState(null);

  // History state
  const [returnsHistory, setReturnsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const searchInputRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchCategories = async () => {
    try {
      const cats = await api.get('/categories');
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProducts = async (query = '', catId = null) => {
    try {
      setLoadingProducts(true);
      const params = { limit: 100 };
      if (query) params.search = query;
      if (catId) params.category_id = catId;
      const res = await api.get('/products', params);
      setProducts(res.products || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/returns');
      setReturnsHistory(Array.isArray(res) ? res : res.returns || []);
    } catch (e) {
      toast.error('Failed to load return history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    fetchProducts(q, selectedCategory);
  };

  const handleSelectCategory = (catId) => {
    const next = selectedCategory === catId ? null : catId;
    setSelectedCategory(next);
    fetchProducts(searchQuery, next);
  };

  // Add product to Return Cart (or increase quantity if already present)
  const handleAddToReturnCart = (product) => {
    setReturnCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          brand: product.brand,
          unit_price: product.selling_price || 0,
          current_stock: product.stock,
          unit: product.unit || 'packet',
          quantity: 1,
        },
      ];
    });
    toast.success(`Added ${product.name} to return cart`);
  };

  const handleUpdateQuantity = (productId, newQty) => {
    const parsed = parseInt(newQty, 10);
    if (isNaN(parsed) || parsed <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setReturnCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, quantity: parsed } : item
      )
    );
  };

  const handleIncrement = (productId) => {
    setReturnCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const handleDecrement = (productId) => {
    setReturnCart((prev) =>
      prev
        .map((item) =>
          item.product_id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (productId) => {
    setReturnCart((prev) => prev.filter((item) => item.product_id !== productId));
    toast('Item removed from return cart');
  };

  const handleClearCart = () => {
    setReturnCart([]);
  };

  // Totals
  const totalReturnUnits = returnCart.reduce((sum, item) => sum + item.quantity, 0);
  const totalRefundAmount = returnCart.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  // Process the return: pushes stock to inventory & updates sales in dashboard
  const handleProcessReturn = async () => {
    if (returnCart.length === 0) {
      toast.error('Return cart is empty. Click on articles to add them to return.');
      return;
    }

    try {
      setSubmittingReturn(true);

      const payload = {
        refund_amount: parseFloat(totalRefundAmount.toFixed(2)),
        refund_method: refundMethod,
        reason: returnReason,
        items: returnCart.map((item) => ({
          product_id: item.product_id,
          product_name_snapshot: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          restock: restockToInventory ? 1 : 0,
        })),
      };

      const res = await api.post('/returns', payload);

      setLastReturnResult({
        ...res,
        items: returnCart,
        totalRefund: totalRefundAmount,
        totalUnits: totalReturnUnits,
      });

      toast.success(
        `Return processed! ${totalReturnUnits} units restocked to inventory & dashboard synced.`
      );

      // Clear return cart & refresh catalogue so updated stock numbers display instantly
      setReturnCart([]);
      fetchProducts(searchQuery, selectedCategory);
      setSuccessModalOpen(true);
    } catch (err) {
      toast.error(err.message || 'Failed to process return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-navy-200 shadow-2xs">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="text-teal-600" size={24} />
            Customer Returns & Restock
          </h1>
          <p className="text-xs text-navy-500">
            Click articles to add to return cart, restock inventory automatically, and sync dashboard sales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('process')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'process'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            <ShoppingCart size={14} /> Process Return
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            <History size={14} /> Return History
          </button>
        </div>
      </div>

      {activeTab === 'process' ? (
        /* Main Two-Column Return Workspace (Exactly like New Sale) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT 7-8 COLS: All Articles & Products Catalog */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Search & Categories Bar */}
            <div className="bg-white p-3 rounded-xl border border-navy-200 shadow-2xs space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-navy-400" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search catalogue articles by name, brand, SKU..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-navy-50 border border-navy-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-navy-800"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectCategory(null)}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-all ${
                    selectedCategory === null
                      ? 'bg-navy-800 text-white font-bold'
                      : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
                  }`}
                >
                  All Articles ({products.length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCategory(c.id)}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-all ${
                      selectedCategory === c.id
                        ? 'bg-teal-600 text-white font-bold'
                        : 'bg-navy-50 text-navy-600 border border-navy-200 hover:bg-navy-100'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            {loadingProducts ? (
              <div className="bg-white p-12 rounded-xl border border-navy-200 flex justify-center items-center">
                <Spinner size="lg" />
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-navy-200 text-center text-navy-500 text-sm">
                No products match your search.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {products.map((product) => {
                  const inCart = returnCart.find((i) => i.product_id === product.id);
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleAddToReturnCart(product)}
                      className={`group relative bg-white p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 flex flex-col justify-between hover:shadow-md ${
                        inCart
                          ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20'
                          : 'border-navy-200 hover:border-teal-400'
                      }`}
                    >
                      {/* In-Cart Counter Pill */}
                      {inCart && (
                        <div className="absolute top-2 right-2 bg-teal-600 text-white font-bold text-xs px-2 py-0.5 rounded-full shadow-xs">
                          {inCart.quantity} in return
                        </div>
                      )}

                      <div>
                        {product.brand && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block truncate">
                            {product.brand}
                          </span>
                        )}
                        <h3 className="font-semibold text-xs sm:text-sm text-navy-900 line-clamp-2 mt-0.5">
                          {product.name}
                        </h3>
                      </div>

                      <div className="mt-3 pt-2 border-t border-navy-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-navy-400 block text-[10px]">Refund Price</span>
                          <span className="text-sm font-bold text-navy-900">
                            {formatCurrency(product.selling_price)}
                          </span>
                        </div>
                        <div className="text-right">
                          <StockBadge stock={product.stock} threshold={product.low_stock_threshold || 5} />
                        </div>
                      </div>

                      <div className="mt-2 text-center py-1 bg-navy-50 group-hover:bg-teal-600 group-hover:text-white rounded-md text-[11px] font-bold text-navy-700 transition-colors flex items-center justify-center gap-1">
                        <Plus size={12} /> {inCart ? 'Add +1 to Return' : 'Return Item'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 5-4 COLS: Return Cart & Restock Drawer */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-navy-200 shadow-sm flex flex-col h-full sticky top-4">
              {/* Cart Header */}
              <div className="p-4 border-b border-navy-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="text-teal-600" size={18} />
                  <h2 className="font-bold text-navy-900 text-sm">Return Register Cart</h2>
                  {returnCart.length > 0 && (
                    <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-0.5 rounded-full">
                      {totalReturnUnits} units
                    </span>
                  )}
                </div>
                {returnCart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              <div className="p-3 flex-1 overflow-y-auto max-h-[380px] space-y-2">
                {returnCart.length === 0 ? (
                  <div className="py-12 text-center text-navy-400 space-y-2">
                    <RotateCcw size={36} className="mx-auto text-navy-300 opacity-60" />
                    <p className="text-xs font-medium">Return cart is empty</p>
                    <p className="text-[11px] text-navy-400">
                      Click any product from the catalogue on the left to add it for return.
                    </p>
                  </div>
                ) : (
                  returnCart.map((item) => (
                    <div
                      key={item.product_id}
                      className="bg-navy-50/70 p-2.5 rounded-lg border border-navy-200 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-navy-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-navy-500">
                          {formatCurrency(item.unit_price)} each &bull; Stock: {item.current_stock}
                        </p>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1 bg-white border border-navy-200 rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => handleDecrement(item.product_id)}
                          className="w-6 h-6 flex items-center justify-center text-navy-600 hover:bg-navy-100 rounded text-xs"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.product_id, e.target.value)}
                          className="w-8 text-center text-xs font-bold font-mono focus:outline-none"
                          min="1"
                        />
                        <button
                          type="button"
                          onClick={() => handleIncrement(item.product_id)}
                          className="w-6 h-6 flex items-center justify-center text-navy-600 hover:bg-navy-100 rounded text-xs"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Line Total */}
                      <span className="text-xs font-bold text-navy-900 w-16 text-right">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.product_id)}
                        className="text-navy-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Return Form Options */}
              {returnCart.length > 0 && (
                <div className="p-4 border-t border-navy-200 bg-navy-50/40 space-y-3">
                  {/* Restock to inventory checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-navy-800">
                    <input
                      type="checkbox"
                      checked={restockToInventory}
                      onChange={(e) => setRestockToInventory(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded border-navy-300 focus:ring-teal-500"
                    />
                    <Warehouse size={14} className="text-teal-600" />
                    Push returned units back into Inventory (+{totalReturnUnits} units)
                  </label>

                  {/* Return Reason */}
                  <div>
                    <label className="text-[11px] font-bold text-navy-600 block mb-1">
                      Reason for Return:
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-navy-200 rounded-md text-navy-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="Customer Return">Customer Return</option>
                      <option value="Customer Changed Mind">Customer Changed Mind</option>
                      <option value="Defective or Damaged">Defective or Damaged Product</option>
                      <option value="Wrong Item Purchased">Wrong Item Purchased</option>
                      <option value="Expired / Near Expiry">Expired / Near Expiry</option>
                      <option value="Exchange / Adjustment">Exchange / Price Adjustment</option>
                    </select>
                  </div>

                  {/* Refund Method Toggle */}
                  <div>
                    <label className="text-[11px] font-bold text-navy-600 block mb-1">
                      Refund Paid Via:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRefundMethod('cash')}
                        className={`py-1.5 text-xs font-bold rounded-md border text-center transition-all ${
                          refundMethod === 'cash'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                            : 'bg-white text-navy-700 border-navy-200 hover:bg-navy-50'
                        }`}
                      >
                        Cash Refund
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefundMethod('upi')}
                        className={`py-1.5 text-xs font-bold rounded-md border text-center transition-all ${
                          refundMethod === 'upi'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                            : 'bg-white text-navy-700 border-navy-200 hover:bg-navy-50'
                        }`}
                      >
                        UPI / Online Refund
                      </button>
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="pt-2 border-t border-navy-200 space-y-1 text-xs">
                    <div className="flex justify-between text-navy-600">
                      <span>Total Returned Items:</span>
                      <span className="font-bold">{totalReturnUnits} units</span>
                    </div>
                    <div className="flex justify-between text-navy-600">
                      <span>Inventory Restock Action:</span>
                      <span className="font-bold text-teal-700">
                        {restockToInventory ? `+${totalReturnUnits} to Stock` : 'No restock'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-navy-900 pt-1 border-t border-navy-100">
                      <span>Total Refund Amount:</span>
                      <span className="text-rose-700 text-base">{formatCurrency(totalRefundAmount)}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 shadow-xs"
                    loading={submittingReturn}
                    onClick={handleProcessReturn}
                  >
                    <RotateCcw size={16} />
                    Complete Return ({formatCurrency(totalRefundAmount)})
                  </Button>
                  <p className="text-[10px] text-center text-navy-400">
                    Will restock inventory & deduct {formatCurrency(totalRefundAmount)} from today's dashboard sales.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Return History Tab */
        <div className="bg-white rounded-xl border border-navy-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-navy-900 text-base">Recorded Returns History</h2>
            <Button variant="ghost" size="sm" onClick={fetchHistory} icon={RotateCcw}>
              Refresh
            </Button>
          </div>

          {loadingHistory ? (
            <div className="p-12 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : returnsHistory.length === 0 ? (
            <div className="p-12 text-center text-navy-400 text-xs">
              No returns processed yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-navy-50 text-navy-600 border-b border-navy-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Return ID</th>
                    <th className="px-4 py-3 font-semibold">Date & Time</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold text-right">Refund Amount</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {returnsHistory.map((ret) => (
                    <tr key={ret.id} className="hover:bg-navy-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-teal-700">
                        RET-#{ret.id}
                      </td>
                      <td className="px-4 py-3 text-navy-700">{formatDateTime(ret.return_date || ret.created_at)}</td>
                      <td className="px-4 py-3 text-navy-800">{ret.reason || 'Customer Return'}</td>
                      <td className="px-4 py-3 uppercase text-navy-600 font-bold">{ret.refund_method}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-700">
                        {formatCurrency(ret.refund_amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Restocked &amp; Completed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Return Processed Successfully"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-emerald-950">
                Inventory Restocked &amp; Dashboard Synced!
              </p>
              <p>
                Successfully refunded <strong className="font-bold">{formatCurrency(lastReturnResult?.totalRefund || 0)}</strong>.
              </p>
              <p>
                {lastReturnResult?.totalUnits || 0} units have been returned to active stock and logged in the stock ledger.
              </p>
            </div>
          </div>

          <div className="border border-navy-100 rounded-lg p-3 bg-navy-50/50 space-y-2 text-xs">
            <span className="font-bold text-navy-700 block">Restocked Items:</span>
            {(lastReturnResult?.items || []).map((it) => (
              <div key={it.product_id} className="flex justify-between text-navy-800">
                <span>&bull; {it.name} (+{it.quantity} {it.unit})</span>
                <span className="font-bold">{formatCurrency(it.unit_price * it.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-navy-100">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSuccessModalOpen(false)}
            >
              Done / Process Another Return
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
