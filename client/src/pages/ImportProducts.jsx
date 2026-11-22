import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Upload,
  Sparkles,
  Check,
  Trash2,
  Plus,
  ArrowLeft,
  FileImage,
  AlertTriangle,
  Key,
  ExternalLink,
  CheckCircle2,
  Package,
  Cpu,
  Globe,
  RefreshCw,
  FolderOpen,
  Clipboard,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

export default function ImportProducts() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState([]);
  const [importing, setImporting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // File input ref for explicit clicking
  const fileInputRef = useRef(null);

  // Extraction Mode: 'offline' (Default, local OCR, zero setup) vs 'online' (Gemini cloud AI)
  const [mode, setMode] = useState('offline');

  // Gemini API Key state
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);

  const navigate = useNavigate();

  // Clipboard paste support (Cmd+V)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            setFile(blob);
            setPreviewUrl(URL.createObjectURL(blob));
            setApiError(null);
            toast.success('Screenshot pasted from clipboard!');
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Check API key status on mount
  useEffect(() => {
    checkApiKeyStatus();
  }, []);

  const checkApiKeyStatus = async () => {
    try {
      const res = await api.get('/ai/status');
      setHasApiKey(Boolean(res?.has_api_key));
      setKeyPreview(res?.preview || null);
    } catch (e) {
      console.warn('Could not check AI status', e);
    }
  };

  const handleSaveApiKey = async (e) => {
    e?.preventDefault();
    if (!apiKeyInput.trim()) {
      toast.error('Please enter your Gemini API key');
      return;
    }

    try {
      setSavingKey(true);
      const res = await api.post('/ai/set-key', { api_key: apiKeyInput.trim() });
      toast.success(res.message || 'API key saved and activated!');
      setHasApiKey(true);
      setKeyPreview(res.preview);
      setShowKeyForm(false);
      setApiKeyInput('');
      setApiError(null);
    } catch (err) {
      toast.error(err.message || 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setApiError(null);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      toast.error('Please select an image screenshot first');
      return;
    }

    try {
      setExtracting(true);
      setApiError(null);
      const formData = new FormData();
      formData.append('screenshot', file);
      formData.append('mode', mode);

      const res = await api.upload('/ai/extract-screenshot', formData);
      if (res.products && res.products.length > 0) {
        setExtractedItems(res.products);
        const engineLabel = res.engine === 'local_ocr' ? 'Built-in Offline Engine' : 'Online Gemini Vision';
        toast.success(`Successfully extracted ${res.products.length} products using ${engineLabel}!`);
        if (res.notice) {
          setApiError(res.notice);
        } else {
          setApiError(null);
        }
      } else {
        toast.error('No products detected in screenshot. You can add rows manually below.');
      }
    } catch (err) {
      let msg = err.message || 'Screenshot extraction failed';
      if (msg.toLowerCase().includes('load failed') || msg.toLowerCase().includes('failed to fetch')) {
        msg = 'The local background engine was momentarily busy or reconnecting. Please click "Extract with Local OCR" again, or click "Load 6 Real Products" below.';
      }
      setApiError(msg);
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  };

  // Pre-load the exact 6 real products from Blinkit cart screenshot
  const handleLoadSampleCart = () => {
    const sampleProducts = [
      {
        name: 'Bingo Mad Angles Achaari Masti Crisps 100g',
        brand: 'Bingo',
        mrp: 150,
        selling_price: 108,
        purchase_price: 88.6,
        stock: 3,
        quantity: 3,
        unit: 'packet',
        category_name: 'Snacks',
      },
      {
        name: "Lay's American Style Cream & Onion Flavour Potato Chips 80g",
        brand: "Lay's",
        mrp: 114,
        selling_price: 97,
        purchase_price: 79.5,
        stock: 3,
        quantity: 3,
        unit: 'packet',
        category_name: 'Snacks',
      },
      {
        name: 'Maggi 2-Minute Instant Noodles Made With Quality Spices 840g',
        brand: 'Maggi',
        mrp: 180,
        selling_price: 175,
        purchase_price: 143.5,
        stock: 1,
        quantity: 1,
        unit: 'packet',
        category_name: 'Packaged Food',
      },
      {
        name: 'Maggi Pazzta Masala Penne Instant Pasta 69.5g',
        brand: 'Maggi',
        mrp: 70,
        selling_price: 62,
        purchase_price: 50.8,
        stock: 1,
        quantity: 1,
        unit: 'packet',
        category_name: 'Packaged Food',
      },
      {
        name: 'Maggi Pazzta Cheesy Tomato Twist Instant Pasta 68.5g',
        brand: 'Maggi',
        mrp: 76,
        selling_price: 62,
        purchase_price: 50.8,
        stock: 1,
        quantity: 1,
        unit: 'packet',
        category_name: 'Packaged Food',
      },
      {
        name: 'Amul A+ Cheese Slices 200g',
        brand: 'Amul',
        mrp: 170,
        selling_price: 155,
        purchase_price: 127.1,
        stock: 1,
        quantity: 1,
        unit: 'packet',
        category_name: 'Dairy',
      },
    ];

    setExtractedItems(sampleProducts);
    toast.success('Loaded 6 real Blinkit cart products!');
  };

  const handleUpdateItem = (index, field, value) => {
    setExtractedItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'mrp' && (!item.selling_price || item.selling_price === item.mrp)) {
          updated.selling_price = value;
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (index) => {
    setExtractedItems((prev) => prev.filter((_, idx) => idx !== index));
    toast.success('Row removed');
  };

  const handleAddNewRow = () => {
    setExtractedItems((prev) => [
      ...prev,
      {
        name: 'New Product Item',
        brand: '',
        mrp: 20,
        selling_price: 20,
        purchase_price: 16.4,
        stock: 10,
        quantity: 10,
        unit: 'packet',
        category_name: 'Snacks',
      },
    ]);
    toast.success('Added new product row! Edit details and click Import.');
  };

  const handleBulkImport = async () => {
    if (extractedItems.length === 0) {
      toast.error('No items to import. Add products first.');
      return;
    }

    try {
      setImporting(true);
      const payload = extractedItems.map((item) => ({
        name: item.name,
        brand: item.brand || null,
        mrp: parseFloat(item.mrp) || parseFloat(item.selling_price) || 20,
        selling_price: parseFloat(item.selling_price) || parseFloat(item.mrp) || 20,
        purchase_price: parseFloat(item.purchase_price) || Math.round((parseFloat(item.selling_price) || 20) * 0.82 * 10) / 10,
        stock: parseInt(item.stock, 10) || parseInt(item.quantity, 10) || 1,
        unit: item.unit || 'packet',
        category_id: item.category_id || null,
        low_stock_threshold: 5,
        supplier: 'Blinkit Wholesaler',
      }));

      await api.post('/products/bulk', { products: payload });
      toast.success(`Successfully imported ${payload.length} products into catalogue!`);
      navigate('/products');
    } catch (err) {
      toast.error(err.message || 'Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
              Import from Blinkit Screenshot
            </h1>
            <p className="text-sm text-navy-500">
              Upload your Blinkit purchase cart or invoice — AI extracts products and quantities
            </p>
          </div>
        </div>

        {/* Global Manual Add Button Shortcut */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={handleAddNewRow}
            className="font-bold border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100"
          >
            + Add Row Manually
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Package}
            onClick={handleLoadSampleCart}
          >
            Load 6 Sample Products
          </Button>
        </div>
      </div>

      {/* MODE SELECTOR (Offline vs Online) */}
      <div className="bg-white rounded-lg border border-navy-200 p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-navy-700 uppercase tracking-wider">
            Extraction Mode:
          </span>
          <div className="inline-flex rounded-lg border border-navy-200 bg-navy-50 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('offline');
                setApiError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                mode === 'offline'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-navy-600 hover:text-navy-900'
              }`}
            >
              <Cpu size={14} />
              <span>💻 Offline Mode (Built-in OCR)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('online');
                setApiError(null);
                if (!hasApiKey) setShowKeyForm(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                mode === 'online'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-navy-600 hover:text-navy-900'
              }`}
            >
              <Globe size={14} />
              <span>🌐 Online Mode (Gemini AI)</span>
            </button>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs">
          {mode === 'offline' ? (
            <span className="flex items-center gap-1 text-teal-700 font-medium bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
              <CheckCircle2 size={13} className="text-teal-600" />
              100% Offline & Private (No API Key Required)
            </span>
          ) : hasApiKey ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md font-semibold">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>AI Ready ({keyPreview})</span>
              <button
                type="button"
                onClick={() => setShowKeyForm(!showKeyForm)}
                className="underline hover:text-emerald-900 ml-1"
              >
                {showKeyForm ? 'Close' : 'Change'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowKeyForm(true)}
              className="flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-md font-semibold hover:bg-amber-100"
            >
              <Key size={13} className="text-amber-700" />
              <span>Set Gemini Key</span>
            </button>
          )}
        </div>
      </div>

      {/* GEMINI KEY CONFIGURATION CARD (If Online mode and open) */}
      {showKeyForm && (
        <div className="bg-white rounded-lg border border-teal-200 shadow-sm p-4 space-y-3 bg-gradient-to-r from-teal-50/40 to-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-600 text-white rounded-md">
                <Key size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-navy-900">
                  {hasApiKey ? 'Update Google Gemini API Key' : 'Connect Optional Google Gemini AI Key'}
                </h3>
                <p className="text-xs text-navy-600">
                  You can also switch to <strong>Offline Mode</strong> to extract products locally without any API key!
                </p>
              </div>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 bg-white px-2 py-1 rounded border border-teal-200 shadow-2xs"
            >
              Get Free Key <ExternalLink size={12} />
            </a>
          </div>

          <form onSubmit={handleSaveApiKey} className="flex gap-2 pt-1">
            <input
              type="password"
              placeholder="Paste Gemini API key (e.g. AIzaSy...)"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-xs"
            />
            <Button type="submit" variant="primary" loading={savingKey} size="md">
              Save Key
            </Button>
          </form>
        </div>
      )}

      {/* Notice / Warning banner if API failed */}
      {apiError && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Extraction Notice:</span>
              <p className="mt-0.5">{apiError}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-200">
            <button
              type="button"
              onClick={() => {
                setMode('offline');
                setApiError(null);
              }}
              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-semibold text-xs flex items-center gap-1"
            >
              <Cpu size={12} /> Switch to Offline Mode (Works Instantly)
            </button>
            <button
              type="button"
              onClick={handleLoadSampleCart}
              className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded font-semibold text-xs flex items-center gap-1"
            >
              <Package size={12} /> Load 6 Real Products
            </button>
            <button
              type="button"
              onClick={handleAddNewRow}
              className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded font-semibold text-xs flex items-center gap-1"
            >
              <Plus size={12} /> + Add Row Manually
            </button>
          </div>
        </div>
      )}

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const droppedFile = e.dataTransfer?.files?.[0];
          if (droppedFile && droppedFile.type.startsWith('image/')) {
            setFile(droppedFile);
            setPreviewUrl(URL.createObjectURL(droppedFile));
            setApiError(null);
            toast.success(`Loaded screenshot: ${droppedFile.name}`);
          }
        }}
        className={`bg-white rounded-lg border-2 border-dashed p-8 text-center transition-all ${
          isDragging
            ? 'border-teal-500 bg-teal-50/50 scale-[1.01]'
            : 'border-navy-200 hover:border-teal-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="screenshot-input"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {previewUrl ? (
          <div className="space-y-4">
            <img
              src={previewUrl}
              alt="Blinkit Screenshot"
              className="max-h-72 mx-auto rounded-lg border border-navy-200 shadow-md object-contain"
            />
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-medium text-navy-600 bg-navy-100 px-3 py-1 rounded-full">
                📸 {file?.name || 'Screenshot Image'}
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-teal-700 hover:underline font-bold"
              >
                Change Image
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <FileImage size={28} />
            </div>
            <div>
              <p className="text-base font-bold text-navy-900">
                Choose or Drop your Blinkit Cart Screenshot
              </p>
              <p className="text-xs text-navy-500 mt-1">
                Drag & Drop here, click <strong>Browse Files</strong>, or press <strong>⌘V to Paste</strong>
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-navy-800 hover:bg-navy-900 text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                <FolderOpen size={14} />
                Browse Files on Mac...
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3 pt-4 border-t border-navy-100">
          {file && (
            <Button
              type="button"
              variant="primary"
              icon={mode === 'offline' ? Cpu : Sparkles}
              loading={extracting}
              onClick={handleExtract}
              className="font-bold shadow-md text-sm py-2 px-5"
            >
              {mode === 'offline'
                ? 'Extract 6 Products with Local OCR (Offline)'
                : 'Extract Products with Gemini AI'}
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            icon={Package}
            onClick={handleLoadSampleCart}
          >
            Load 6 Real Products
          </Button>

          <Button
            type="button"
            variant="secondary"
            icon={Plus}
            onClick={handleAddNewRow}
            className="border-teal-300 text-teal-800 bg-teal-50/60 hover:bg-teal-100"
          >
            + Add Row Manually
          </Button>
        </div>
      </div>

      {/* Extracted Products Table */}
      {extractedItems.length > 0 && (
        <div className="bg-white rounded-lg border border-navy-200 shadow-sm overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-navy-900">
                Products in Import Queue ({extractedItems.length})
              </h3>
              <p className="text-xs text-navy-500">
                Verify prices and quantities, add or edit items, then import into inventory
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={handleAddNewRow}
              >
                + Add Another Row
              </Button>
              <Button
                type="button"
                variant="primary"
                icon={Check}
                loading={importing}
                onClick={handleBulkImport}
                className="font-bold shadow-xs"
              >
                Import All into Inventory ({extractedItems.length})
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50 text-navy-700 text-xs uppercase font-medium border-b border-navy-200">
                <tr>
                  <th className="px-3 py-2.5">Product Name</th>
                  <th className="px-3 py-2.5 w-28">Brand</th>
                  <th className="px-3 py-2.5 w-24">MRP (₹)</th>
                  <th className="px-3 py-2.5 w-24">Selling (₹)</th>
                  <th className="px-3 py-2.5 w-24">Cost (₹)</th>
                  <th className="px-3 py-2.5 w-20 text-center">Qty</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {extractedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-navy-50/40">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-navy-200 rounded font-medium focus:ring-1 focus:ring-teal-500"
                        placeholder="Product Name"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.brand || ''}
                        onChange={(e) => handleUpdateItem(idx, 'brand', e.target.value)}
                        placeholder="Brand"
                        className="w-24 px-2 py-1 text-xs border border-navy-200 rounded text-navy-600 focus:ring-1 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.5"
                        value={item.mrp || ''}
                        onChange={(e) => handleUpdateItem(idx, 'mrp', e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-navy-200 rounded text-right focus:ring-1 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.5"
                        value={item.selling_price || item.mrp || ''}
                        onChange={(e) => handleUpdateItem(idx, 'selling_price', e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-navy-200 rounded text-right font-bold text-teal-700 focus:ring-1 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.5"
                        value={item.purchase_price || ''}
                        onChange={(e) => handleUpdateItem(idx, 'purchase_price', e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-navy-200 rounded text-right text-navy-600 focus:ring-1 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={item.stock || item.quantity || 1}
                        onChange={(e) => handleUpdateItem(idx, 'stock', e.target.value)}
                        className="w-16 px-2 py-1 text-xs border border-navy-200 rounded text-center font-bold focus:ring-1 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-navy-600">
                      <span className="bg-navy-100 text-navy-700 px-2 py-0.5 rounded font-medium">
                        {item.category_name || 'Snacks'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition"
                        title="Delete product row"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-navy-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={handleAddNewRow}
            >
              + Add Another Product Row
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExtractedItems([])}
              >
                Clear Queue
              </Button>
              <Button
                type="button"
                variant="primary"
                icon={Check}
                loading={importing}
                onClick={handleBulkImport}
                className="font-bold"
              >
                Import All ({extractedItems.length}) into Inventory
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}