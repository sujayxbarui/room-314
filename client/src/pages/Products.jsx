import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Package,
  Plus,
  Upload,
  Search,
  Filter,
  Edit2,
  Trash2,
  Archive,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import StockBadge from '../components/shared/StockBadge';
import Spinner from '../components/ui/Spinner';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockStatus, setStockStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [productToArchive, setProductToArchive] = useState(null);

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const fetchCategories = async () => {
    try {
      const cats = await api.get('/categories');
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 25,
      };
      if (search) params.search = search;
      if (selectedCategory) params.category_id = selectedCategory;
      if (stockStatus !== 'all') params.stock_status = stockStatus;

      const res = await api.get('/products', params);
      setProducts(res.products || []);
      setTotalCount(res.total || 0);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [page, selectedCategory, stockStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const confirmArchive = (product) => {
    setProductToArchive(product);
    setArchiveModalOpen(true);
  };

  const handleArchive = async () => {
    if (!productToArchive) return;
    try {
      await api.delete(`/products/${productToArchive.id}`);
      toast.success(`${productToArchive.name} archived`);
      setArchiveModalOpen(false);
      setProductToArchive(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to archive product');
    }
  };

  const handleDeletePermanent = async () => {
    if (!productToArchive) return;
    try {
      await api.delete(`/products/${productToArchive.id}/permanent`);
      toast.success(`${productToArchive.name} deleted`);
      setArchiveModalOpen(false);
      setProductToArchive(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to delete product');
    }
  };

  const handleClearAllProducts = async () => {
    if (!confirm('Are you sure you want to delete ALL products in your catalogue? This will give you a clean slate.')) {
      return;
    }
    try {
      await api.post('/settings/reset-data', { action: 'clear_all' });
      toast.success('All products cleared!');
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to clear products');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Product Catalogue</h1>
          <p className="text-sm text-navy-500">Manage all packaged food items, prices, and stock levels</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              {products.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={handleClearAllProducts}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-semibold"
                >
                  Clear All Products
                </Button>
              )}
              <Link to="/products/import">
                <Button variant="secondary" icon={Upload}>
                  Import Blinkit
                </Button>
              </Link>
              <Link to="/products/add">
                <Button variant="primary" icon={Plus}>
                  Add Product
                </Button>
              </Link>
            </>
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
              <strong>Staff Permissions:</strong> You can view all catalogue details, live stock, and prices. Adding, modifying, or deleting products requires an Administrator account.
            </span>
          </div>
          <span className="font-semibold uppercase tracking-wider text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
            Read Only
          </span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-navy-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full md:w-auto relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search by product name, brand, or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-navy-50/60 border border-navy-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
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
            onChange={(e) => {
              setStockStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg text-navy-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Stock Levels</option>
            <option value="low">Low Stock Only</option>
            <option value="out">Out of Stock Only</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-navy-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-navy-400">
            <Spinner size="md" />
            <p className="mt-2 text-xs">Loading catalogue...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-navy-500 space-y-3">
            <Package size={36} className="mx-auto text-navy-300" />
            <p className="text-sm font-medium">No products found</p>
            <p className="text-xs text-navy-400">Try adjusting your search or add a new product</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50 text-navy-700 text-xs uppercase font-medium border-b border-navy-200">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Selling Price</th>
                  <th className="px-4 py-3 text-right">Cost Price</th>
                  <th className="px-4 py-3 text-center">Stock</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">{isAdmin ? 'Actions' : 'Access'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-navy-900">
                      {p.name}
                      {p.brand && <span className="text-xs text-navy-500 block font-normal">{p.brand}</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-navy-500">{p.sku || '—'}</td>
                    <td className="px-4 py-3 text-xs text-navy-600">{p.category_name || 'General'}</td>
                    <td className="px-4 py-3 text-right font-bold text-teal-700">
                      {formatCurrency(p.selling_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-navy-500">
                      {formatCurrency(p.purchase_price || 0)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-navy-800">
                      {p.stock} <span className="text-xs font-normal text-navy-500">{p.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StockBadge stock={p.stock} threshold={p.low_stock_threshold} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/products/edit/${p.id}`)}
                            className="p-1.5 rounded hover:bg-navy-100 text-navy-600 hover:text-navy-900 transition"
                            title="Edit Product"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmArchive(p)}
                            className="p-1.5 rounded hover:bg-red-50 text-navy-400 hover:text-red-600 transition"
                            title="Archive Product"
                          >
                            <Archive size={15} />
                          </button>
                        </div>
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

        {/* Pagination */}
        <div className="p-3 border-t border-navy-200 flex items-center justify-between text-xs text-navy-600">
          <span>Total: {totalCount} products</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 bg-white border border-navy-200 rounded disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2.5 py-1 font-semibold">Page {page}</span>
            <button
              disabled={products.length < 25}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 bg-white border border-navy-200 rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Archive / Delete Confirmation Modal */}
      <Modal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="Remove Product"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-navy-600">
            What would you like to do with <strong>{productToArchive?.name}</strong>?
          </p>
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleDeletePermanent}
              className="w-full text-left p-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100/70 transition"
            >
              <div className="text-xs font-bold text-red-800">Permanently Delete</div>
              <div className="text-[11px] text-red-600 mt-0.5">Completely removes this product from catalogue.</div>
            </button>
            <button
              type="button"
              onClick={handleArchive}
              className="w-full text-left p-3 rounded-lg border border-navy-200 bg-navy-50 hover:bg-navy-100/70 transition"
            >
              <div className="text-xs font-bold text-navy-800">Archive Only</div>
              <div className="text-[11px] text-navy-600 mt-0.5">Hides from POS checkout, keeps sales history.</div>
            </button>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => setArchiveModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

