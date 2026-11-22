import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sparkles, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { UNITS } from '../utils/constants';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

export default function AddProduct() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category_id: '',
    subcategory_id: '',
    sku: '',
    mrp: '',
    selling_price: '',
    purchase_price: '',
    stock: '10',
    unit: 'packet',
    low_stock_threshold: '5',
    supplier: 'Blinkit Wholesaler',
  });

  useEffect(() => {
    // Load categories
    api.get('/categories').then((cats) => setCategories(Array.isArray(cats) ? cats : []));

    // If editing, load product details
    if (isEditing) {
      setLoading(true);
      api.get(`/products/${id}`)
        .then((product) => {
          setFormData({
            name: product.name || '',
            brand: product.brand || '',
            category_id: product.category_id || '',
            subcategory_id: product.subcategory_id || '',
            sku: product.sku || '',
            mrp: product.mrp !== null ? product.mrp.toString() : '',
            selling_price: product.selling_price ? product.selling_price.toString() : '',
            purchase_price: product.purchase_price ? product.purchase_price.toString() : '',
            stock: product.stock !== undefined ? product.stock.toString() : '0',
            unit: product.unit || 'packet',
            low_stock_threshold: product.low_stock_threshold ? product.low_stock_threshold.toString() : '5',
            supplier: product.supplier || '',
          });
        })
        .catch(() => toast.error('Failed to load product'))
        .finally(() => setLoading(false));
    }
  }, [id, isEditing]);

  const handleNameBlur = async () => {
    if (!formData.name.trim() || isEditing) return;

    // 1. Suggest category
    try {
      const sug = await api.post('/ai/suggest-category', {
        product_name: formData.name,
        brand: formData.brand,
      });
      if (sug && sug.category) {
        setSuggestion(sug);
        if (sug.category_id && !formData.category_id) {
          setFormData((prev) => ({ ...prev, category_id: sug.category_id }));
        }
      }
    } catch (e) {
      // Suggestion silent fail
    }

    // 2. Check duplicate
    try {
      const dup = await api.get('/products/duplicate-check', {
        name: formData.name,
        brand: formData.brand,
      });
      if (dup?.duplicate) {
        setDuplicateWarning(dup.product);
      } else {
        setDuplicateWarning(null);
      }
    } catch (e) {}
  };

  const handleMrpChange = (val) => {
    setFormData((prev) => {
      const updates = { ...prev, mrp: val };
      if (!prev.selling_price || prev.selling_price === prev.mrp) {
        updates.selling_price = val;
      }
      if (!prev.purchase_price && val && parseFloat(val) > 0) {
        updates.purchase_price = (Math.round(parseFloat(val) * 0.82 * 10) / 10).toString();
      }
      return updates;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    const price = formData.selling_price || formData.mrp;
    if (!price || parseFloat(price) <= 0) {
      toast.error('Please enter a valid selling price or MRP');
      return;
    }

    try {
      setLoading(true);
      const parsedPrice = parseFloat(price);
      const parsedMrp = formData.mrp ? parseFloat(formData.mrp) : parsedPrice;
      const parsedCost = formData.purchase_price 
        ? parseFloat(formData.purchase_price) 
        : Math.round(parsedPrice * 0.82 * 10) / 10;

      const payload = {
        name: formData.name.trim(),
        brand: formData.brand ? formData.brand.trim() : null,
        category_id: formData.category_id ? parseInt(formData.category_id, 10) : null,
        subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id, 10) : null,
        sku: formData.sku ? formData.sku.trim() : undefined,
        mrp: parsedMrp,
        selling_price: parsedPrice,
        purchase_price: parsedCost,
        stock: Math.max(0, parseInt(formData.stock, 10) || 0),
        unit: formData.unit || 'packet',
        low_stock_threshold: parseInt(formData.low_stock_threshold, 10) || 5,
        supplier: formData.supplier ? formData.supplier.trim() : null,
      };

      if (isEditing) {
        await api.put(`/products/${id}`, payload);
        toast.success('Product updated successfully');
      } else {
        await api.post('/products', payload);

        // If user accepted an auto-categorized category, learn it for the future
        if (suggestion && formData.category_id) {
          api.post('/ai/learn-category', {
            keyword: formData.name.split(' ')[0],
            category_id: formData.category_id,
          }).catch(() => {});
        }

        toast.success('Product added to catalogue!');
      }

      navigate('/products');
    } catch (err) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="p-2 rounded-lg hover:bg-navy-100 text-navy-600 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-sm text-navy-500">
            {isEditing ? 'Update pricing, category, or stock details' : 'Enter product information or scan/paste name'}
          </p>
        </div>
      </div>

      {/* Duplicate Alert */}
      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Possible duplicate product:</span> A product named{' '}
            <strong>"{duplicateWarning.name}"</strong> already exists in inventory with SKU{' '}
            <span className="font-mono">{duplicateWarning.sku}</span>.
          </div>
        </div>
      )}

      {/* Category Suggestion Banner */}
      {suggestion && suggestion.category && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3.5 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-teal-600" />
            <div>
              <span className="text-xs uppercase font-bold text-teal-800">Smart Category Suggestion:</span>
              <p className="text-teal-900 font-semibold">
                {suggestion.category} {suggestion.subcategory ? `› ${suggestion.subcategory}` : ''}
              </p>
            </div>
          </div>
          <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-medium">
            {suggestion.confidence} confidence
          </span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-navy-200 shadow-sm p-6 space-y-6">
        {/* Section 1: Product Basics */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-navy-500 mb-3">1. Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Product Name *"
                placeholder="e.g. Lay's Classic Salted Potato Chips 50g"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onBlur={handleNameBlur}
                required
              />
            </div>

            <Input
              label="Brand / Company"
              placeholder="e.g. Lay's, Parle, Amul"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg text-navy-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Pricing */}
        <div className="pt-4 border-t border-navy-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-navy-500 mb-3">2. Pricing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="MRP (₹) *"
              type="number"
              step="0.5"
              placeholder="20.00"
              value={formData.mrp}
              onChange={(e) => handleMrpChange(e.target.value)}
              required
            />

            <Input
              label="Selling Price (₹)"
              type="number"
              step="0.5"
              placeholder="Auto-synced with MRP"
              value={formData.selling_price}
              onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
            />

            <Input
              label="Purchase / Cost Price (₹)"
              type="number"
              step="0.5"
              placeholder="16.50"
              value={formData.purchase_price}
              onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
            />
          </div>
        </div>

        {/* Section 3: Inventory */}
        <div className="pt-4 border-t border-navy-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-navy-500 mb-3">3. Stock & Storage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Initial Stock Quantity"
              type="number"
              placeholder="10"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1">
                Unit of Measurement
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg text-navy-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Low Stock Alert Threshold"
              type="number"
              placeholder="5"
              value={formData.low_stock_threshold}
              onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-6 border-t border-navy-200 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/products')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading} className="font-bold">
            {isEditing ? 'Save Changes' : 'Add to Catalogue'}
          </Button>
        </div>
      </form>
    </div>
  );
}

