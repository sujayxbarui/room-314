import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Share2,
  ArrowRight,
  User,
  Phone,
  Banknote,
  QrCode,
  Tag,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import { useCart } from '../hooks/useCart';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import StockBadge from '../components/shared/StockBadge';
import ReceiptPreview from '../components/shared/ReceiptPreview';

export default function POS() {
  const {
    items,
    addItem,
    removeItem,
    incrementItem,
    decrementItem,
    clearCart,
    subtotal,
    discount,
    setDiscount,
    total,
    itemCount,
  } = useCart();

  // Product catalog state
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Checkout modal state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'upi'
  const [amountPaid, setAmountPaid] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [completingSale, setCompletingSale] = useState(false);

  // Post-sale success state
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);

  const searchInputRef = useRef(null);

  // Load products and categories on mount
  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Keyboard shortcut listener (F2 / Ctrl+Enter for checkout)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'F2' || (e.ctrlKey && e.key === 'Enter')) && items.length > 0 && !checkoutModalOpen) {
        e.preventDefault();
        openCheckout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, checkoutModalOpen]);

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
      const params = { limit: 60 };
      if (query) params.search = query;
      if (catId) params.category_id = catId;
      const res = await api.get('/products', params);
      setProducts(res.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchProducts(val, selectedCategory);
  };

  const handleCategoryClick = (catId) => {
    const newCat = selectedCategory === catId ? null : catId;
    setSelectedCategory(newCat);
    fetchProducts(searchQuery, newCat);
  };

  const handleAddProduct = (product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock!`);
      return;
    }
    const currentInCart = items.find((i) => i.product.id === product.id)?.quantity || 0;
    if (currentInCart >= product.stock) {
      toast.error(`Only ${product.stock} in stock!`);
      return;
    }
    addItem(product);
  };

  const openCheckout = () => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setAmountPaid(total.toString());
    setPaymentMethod('cash');
    setCheckoutModalOpen(true);
  };

  const handleCompleteSale = async () => {
    try {
      setCompletingSale(true);
      const payload = {
        payment_method: paymentMethod,
        discount: parseFloat(discount) || 0,
        amount_paid: paymentMethod === 'cash' ? (parseFloat(amountPaid) || total) : total,
        customer_name: customerName ? customerName.trim() : null,
        customer_phone: customerPhone ? customerPhone.trim() : null,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.product.selling_price,
          discount: 0,
        })),
      };

      const result = await api.post('/sales', payload);

      setCompletedSale(result);
      setCheckoutModalOpen(false);
      setSuccessModalOpen(true);
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      fetchProducts(searchQuery, selectedCategory); // refresh stocks
      toast.success('Sale completed successfully!');
    } catch (err) {
      toast.error(err.message || 'Checkout failed');
    } finally {
      setCompletingSale(false);
    }
  };

  const startNewSale = () => {
    setSuccessModalOpen(false);
    setCompletedSale(null);
    clearCart();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleShareWhatsApp = () => {
    if (!completedSale) return;
    if (completedSale.whatsapp_link) {
      window.open(completedSale.whatsapp_link, '_blank');
    } else {
      toast.error('Could not generate WhatsApp link');
    }
  };

  const parsedAmountPaid = parseFloat(amountPaid) || 0;
  const changeDue = Math.max(0, parsedAmountPaid - total);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
      {/* ================= LEFT SIDE: PRODUCT CATALOG ================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-lg border border-navy-200 shadow-sm p-4 overflow-hidden">
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search products by name or brand... (Press / to search)"
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-navy-50/70 border border-navy-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-navy-900 transition-all placeholder:text-navy-400"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          <button
            type="button"
            onClick={() => handleCategoryClick(null)}
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              selectedCategory === null
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            All Items
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleCategoryClick(c.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === c.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto mt-3 pr-1">
          {loadingProducts ? (
            <div className="flex items-center justify-center py-20 text-navy-400 text-sm">
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-navy-400 text-sm">
              <Search size={32} className="mb-2 text-navy-300" />
              <p>No products found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p) => {
                const inCart = items.find((i) => i.product.id === p.id)?.quantity || 0;
                const isOutOfStock = p.stock <= 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => handleAddProduct(p)}
                    className={`relative p-3 text-left rounded-lg border transition-all flex flex-col justify-between ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed bg-navy-50/50 border-navy-200'
                        : inCart > 0
                        ? 'border-teal-500 bg-teal-50/30 hover:border-teal-600'
                        : 'border-navy-200 hover:border-teal-400 bg-white hover:bg-navy-50/40 shadow-sm'
                    }`}
                  >
                    {inCart > 0 && (
                      <span className="absolute -top-2 -right-2 w-6 h-6 bg-teal-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
                        {inCart}
                      </span>
                    )}

                    <div>
                      <p className="text-xs font-medium text-navy-500 line-clamp-1">{p.brand || 'Item'}</p>
                      <h4 className="text-sm font-semibold text-navy-900 line-clamp-2 mt-0.5 leading-snug">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-navy-100 flex items-center justify-between">
                      <span className="text-base font-bold text-teal-700">
                        {formatCurrency(p.selling_price)}
                      </span>
                      <span
                        className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                          isOutOfStock
                            ? 'bg-red-100 text-red-700'
                            : p.stock <= p.low_stock_threshold
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-navy-100 text-navy-600'
                        }`}
                      >
                        {p.stock} left
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT SIDE: CART PANEL ================= */}
      <div className="w-full lg:w-[420px] flex flex-col bg-white rounded-lg border border-navy-200 shadow-sm overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b border-navy-200 flex items-center justify-between bg-navy-50/50">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-teal-600" />
            <h2 className="text-base font-bold text-navy-900">Current Sale</h2>
            <span className="text-xs bg-navy-200 text-navy-700 px-2 py-0.5 rounded-full font-semibold">
              {itemCount} items
            </span>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-medium"
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-navy-100">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-navy-400 py-16">
              <ShoppingCart size={40} className="text-navy-200 mb-3" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs text-navy-400 mt-1">Click products on the left or search to add items</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs font-semibold text-navy-900 truncate">{item.product.name}</p>
                  <p className="text-[11px] text-navy-500">
                    {formatCurrency(item.product.selling_price)} × {item.quantity}
                  </p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1 bg-navy-100 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => decrementItem(item.product.id)}
                    className="w-6 h-6 rounded flex items-center justify-center bg-white hover:bg-navy-200 text-navy-700 transition"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-navy-900">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => handleAddProduct(item.product)}
                    className="w-6 h-6 rounded flex items-center justify-center bg-white hover:bg-navy-200 text-navy-700 transition"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                <div className="text-right w-18">
                  <p className="text-xs font-bold text-navy-900">
                    {formatCurrency(item.product.selling_price * item.quantity)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Summary & Checkout Button */}
        <div className="p-4 border-t border-navy-200 bg-navy-50/30 space-y-3">
          {/* Discount Field */}
          <div className="flex items-center justify-between text-xs text-navy-600">
            <span className="flex items-center gap-1 font-medium">
              <Tag size={13} /> Discount (₹)
            </span>
            <input
              type="number"
              min="0"
              value={discount || ''}
              onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0"
              className="w-20 px-2 py-1 text-right text-xs bg-white border border-navy-200 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-between text-xs text-navy-500">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-xs text-teal-600 font-medium">
              <span>Discount applied</span>
              <span>- {formatCurrency(discount)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-navy-200 flex justify-between items-baseline">
            <span className="text-sm font-semibold text-navy-900">Final Total</span>
            <span className="text-2xl font-extrabold text-navy-900 tracking-tight">
              {formatCurrency(total)}
            </span>
          </div>

          <Button
            type="button"
            variant="primary"
            fullWidth
            size="lg"
            disabled={items.length === 0}
            onClick={openCheckout}
            className="mt-2 py-3.5 text-base font-bold shadow-sm"
          >
            Checkout ({formatCurrency(total)}) — [F2]
          </Button>
        </div>
      </div>

      {/* ================= MODAL 1: CHECKOUT MODAL ================= */}
      <Modal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title="Complete Checkout"
        size="md"
      >
        <div className="space-y-5">
          {/* Amount Due Banner */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-center">
            <p className="text-xs uppercase font-bold tracking-wider text-teal-700">Total Payable</p>
            <p className="text-3xl font-extrabold text-teal-900 mt-1">{formatCurrency(total)}</p>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-bold transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-500'
                    : 'border-navy-200 text-navy-700 hover:bg-navy-50'
                }`}
              >
                <Banknote size={18} /> Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-bold transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-500'
                    : 'border-navy-200 text-navy-700 hover:bg-navy-50'
                }`}
              >
                <QrCode size={18} /> UPI / QR
              </button>
            </div>
          </div>

          {/* Cash Amount & Change Due */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2 bg-navy-50/60 p-3 rounded-lg border border-navy-200">
              <label className="block text-xs font-medium text-navy-700">Cash Received from Customer (₹)</label>
              <Input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={total.toString()}
              />

              {/* Quick Cash Presets */}
              <div className="flex gap-1.5 pt-1">
                {[total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, 500].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAmountPaid(preset.toString())}
                    className="px-2.5 py-1 text-xs bg-white border border-navy-200 rounded text-navy-700 hover:bg-navy-100 font-medium"
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>

              {parsedAmountPaid >= total && (
                <div className="mt-2 pt-2 border-t border-navy-200 flex justify-between items-center text-sm">
                  <span className="font-medium text-navy-600">Change Due to Customer:</span>
                  <span className="font-extrabold text-base text-teal-700">{formatCurrency(changeDue)}</span>
                </div>
              )}
            </div>
          )}

          {/* Optional Customer Details */}
          <div className="space-y-3 pt-2 border-t border-navy-100">
            <p className="text-xs text-navy-500 font-medium">Customer Details (Optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Customer Name"
                icon={User}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                placeholder="Phone (for WhatsApp bill)"
                icon={Phone}
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setCheckoutModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={completingSale}
              onClick={handleCompleteSale}
              className="font-bold"
            >
              Confirm Sale ({formatCurrency(total)})
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL 2: POST-SALE SUCCESS ================= */}
      <Modal
        isOpen={successModalOpen}
        onClose={startNewSale}
        title="Sale Completed Successfully"
        size="md"
      >
        {completedSale && (
          <div className="space-y-5 text-center">
            <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-navy-900">
                {formatCurrency(completedSale.total)}
              </h3>
              <p className="text-xs font-mono text-navy-500 mt-1">Receipt: {completedSale.receipt_number}</p>
              <p className="text-xs text-navy-600 mt-0.5 capitalize">
                Paid via {completedSale.payment_method}
                {completedSale.change_due > 0 && ` • Change given: ${formatCurrency(completedSale.change_due)}`}
              </p>
            </div>

            {/* Receipt text preview */}
            <ReceiptPreview sale={completedSale} />

            {/* WhatsApp & New Sale Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                variant="primary"
                fullWidth
                icon={Share2}
                onClick={handleShareWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Share on WhatsApp
              </Button>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                icon={RotateCcw}
                onClick={startNewSale}
              >
                Start New Sale
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

