import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Settings as SettingsIcon,
  Store,
  FolderTree,
  Users,
  Database,
  Sparkles,
  Key,
  ExternalLink,
  Plus,
  Trash2,
  Download,
  Upload,
  Laptop,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';

export default function Settings() {
  const [activeSection, setActiveSection] = useState('shop'); // 'shop' | 'categories' | 'ai' | 'users' | 'backup'
  const [loading, setLoading] = useState(false);

  // Shop settings
  const [shopName, setShopName] = useState('Room-314');
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [savingShop, setSavingShop] = useState(false);

  // AI & Vision settings
  const [geminiKey, setGeminiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState(null);
  const [savingAiKey, setSavingAiKey] = useState(false);

  // Categories
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatParent, setNewCatParent] = useState('');
  const [addCatModalOpen, setAddCatModalOpen] = useState(false);

  // Users
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchSettings();
    fetchCategories();
    fetchUsers();
    fetchAiStatus();
  }, []);

  const fetchAiStatus = async () => {
    try {
      const res = await api.get('/ai/status');
      setHasApiKey(Boolean(res?.has_api_key));
      setKeyPreview(res?.preview || null);
    } catch (e) {}
  };

  const handleSaveAiKey = async (e) => {
    e.preventDefault();
    if (!geminiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    try {
      setSavingAiKey(true);
      const res = await api.post('/ai/set-key', { api_key: geminiKey.trim() });
      toast.success(res.message || 'Gemini API key saved');
      setHasApiKey(true);
      setKeyPreview(res.preview);
      setGeminiKey('');
    } catch (err) {
      toast.error(err.message || 'Failed to save Gemini key');
    } finally {
      setSavingAiKey(false);
    }
  };

  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [restoringDb, setRestoringDb] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetData = async (action) => {
    const msg = action === 'clear_sales'
      ? 'Clear all sales transactions and reset Today\'s Sales and Transactions to ₹0? (Your products will be kept)'
      : 'WARNING: Wipe ALL products and sales? This will completely empty your store so you can start from scratch.';
    if (!confirm(msg)) return;

    try {
      setResetting(true);
      const res = await api.post('/settings/reset-data', { action });
      toast.success(res.message);
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error(err.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setDownloadingBackup(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/settings/backup/download', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `room314-shop-data-${new Date().toISOString().slice(0, 10)}.db`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Shop backup downloaded successfully!');
    } catch (e) {
      toast.error('Failed to download database backup');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Are you sure you want to restore shop data from "${file.name}"? This will replace your current sales and products with the data from this file.`)) {
      e.target.value = '';
      return;
    }

    try {
      setRestoringDb(true);
      const formData = new FormData();
      formData.append('database_file', file);

      const res = await api.upload('/settings/backup/restore', formData);
      toast.success(res.message || 'Database restored successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      toast.error(err.message || 'Database restore failed');
    } finally {
      setRestoringDb(false);
      e.target.value = '';
    }
  };

  const fetchSettings = async () => {
    try {
      const s = await api.get('/settings');
      if (s) {
        if (s.shop_name) setShopName(s.shop_name);
        if (s.shop_phone) setShopPhone(s.shop_phone);
        if (s.shop_address) setShopAddress(s.shop_address);
      }
    } catch (e) {}
  };

  const fetchCategories = async () => {
    try {
      const cats = await api.get('/categories/flat');
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (e) {}
  };

  const fetchUsers = async () => {
    try {
      const u = await api.get('/settings/users');
      setUsers(Array.isArray(u) ? u : []);
    } catch (e) {}
  };

  const handleSaveShopSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingShop(true);
      await api.put('/settings', {
        shop_name: shopName.trim(),
        shop_phone: shopPhone.trim(),
        shop_address: shopAddress.trim(),
      });
      toast.success('Shop details updated');
    } catch (err) {
      toast.error('Failed to update shop details');
    } finally {
      setSavingShop(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post('/categories', {
        name: newCatName.trim(),
        parent_id: newCatParent ? parseInt(newCatParent, 10) : null,
      });
      toast.success(`Category "${newCatName}" created`);
      setNewCatName('');
      setNewCatParent('');
      setAddCatModalOpen(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.message || 'Failed to create category');
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success(`Category "${name}" deleted`);
      fetchCategories();
    } catch (err) {
      toast.error(err.message || 'Cannot delete category in use');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Shop Settings</h1>
        <p className="text-sm text-navy-500">Configure receipt headers, product categories, and system data</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-navy-200 gap-6">
        {[
          { key: 'shop', label: 'Shop & Receipts', icon: Store },
          { key: 'categories', label: 'Categories', icon: FolderTree },
          { key: 'ai', label: 'AI & Vision', icon: Sparkles },
          { key: 'users', label: 'Users & Access', icon: Users },
          { key: 'backup', label: 'Backups & DB', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSection(tab.key)}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                activeSection === tab.key
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-navy-500 hover:text-navy-900'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: SHOP & RECEIPT SETTINGS */}
      {activeSection === 'shop' && (
        <form onSubmit={handleSaveShopSettings} className="bg-white p-6 rounded-lg border border-navy-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-navy-900">Receipt & Header Information</h2>
          <p className="text-xs text-navy-500">This information will appear at the top of your WhatsApp customer receipts.</p>

          <Input
            label="Shop Name *"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            required
          />

          <Input
            label="Shop Contact Phone (for receipts)"
            placeholder="+91 98765 43210"
            value={shopPhone}
            onChange={(e) => setShopPhone(e.target.value)}
          />

          <Input
            label="Shop Address / Counter location"
            placeholder="e.g. Counter 1, Room-314"
            value={shopAddress}
            onChange={(e) => setShopAddress(e.target.value)}
          />

          <div className="pt-2">
            <Button type="submit" variant="primary" loading={savingShop}>
              Save Shop Details
            </Button>
          </div>
        </form>
      )}

      {/* SECTION 2: CATEGORIES */}
      {activeSection === 'categories' && (
        <div className="bg-white rounded-lg border border-navy-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-navy-900">Product Categories</h2>
              <p className="text-xs text-navy-500">Categories used for grouping and automatic classification</p>
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAddCatModalOpen(true)}>
              Add Category
            </Button>
          </div>

          <div className="divide-y divide-navy-100 border border-navy-200 rounded-lg overflow-hidden">
            {categories.map((c) => (
              <div key={c.id} className="p-3 flex items-center justify-between hover:bg-navy-50 text-sm">
                <div>
                  <span className="font-semibold text-navy-900">{c.name}</span>
                  {c.parent_name && (
                    <span className="text-xs text-navy-500 ml-2">in {c.parent_name}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(c.id, c.name)}
                  className="text-navy-400 hover:text-red-600 p-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Add Category Modal */}
          <Modal
            isOpen={addCatModalOpen}
            onClose={() => setAddCatModalOpen(false)}
            title="Create New Category"
            size="sm"
          >
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <Input
                label="Category Name *"
                placeholder="e.g. Ice Creams"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1">
                  Parent Category (Optional)
                </label>
                <select
                  value={newCatParent}
                  onChange={(e) => setNewCatParent(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg text-navy-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories
                    .filter((c) => !c.parent_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setAddCatModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create Category
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* SECTION: AI & VISION */}
      {activeSection === 'ai' && (
        <div className="bg-white rounded-lg border border-navy-200 shadow-sm p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-navy-900">Google Gemini AI Configuration</h2>
              <p className="text-xs text-navy-500 mt-0.5">
                Powers automated Blinkit screenshot parsing and intelligent category recommendations
              </p>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 bg-teal-50 px-3 py-1.5 rounded-md border border-teal-200"
            >
              Get Free Key at Google AI Studio <ExternalLink size={13} />
            </a>
          </div>

          <div className="bg-navy-50 p-4 rounded-lg border border-navy-200 flex items-center justify-between text-sm">
            <div>
              <p className="font-semibold text-navy-900">Current AI Vision Status:</p>
              <p className="text-xs text-navy-600 mt-0.5">
                {hasApiKey ? (
                  <span className="text-emerald-700 font-bold">
                    ✅ Active & Connected ({keyPreview})
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold">
                    ⚠️ Not configured (screenshot extraction disabled)
                  </span>
                )}
              </p>
            </div>
            <span className="text-xs bg-navy-200 px-2 py-1 rounded text-navy-700 font-mono">
              Model: gemini-1.5-flash
            </span>
          </div>

          <form onSubmit={handleSaveAiKey} className="space-y-3">
            <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider">
              {hasApiKey ? 'Change Gemini API Key' : 'Enter Gemini API Key'}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Paste your key: AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-white border border-navy-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <Button type="submit" variant="primary" loading={savingAiKey}>
                Save Key
              </Button>
            </div>
            <p className="text-xs text-navy-500">
              Your API key is stored securely in your shop's database and local environment file.
            </p>
          </form>
        </div>
      )}

      {/* SECTION 3: USERS & ACCESS */}
      {activeSection === 'users' && (
        <div className="bg-white rounded-lg border border-navy-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-navy-900">Shop Partners & Access</h2>
            <p className="text-xs text-navy-500">Both partners have equal access to billing, inventory, and reports</p>
          </div>

          <div className="divide-y divide-navy-100 border border-navy-200 rounded-lg overflow-hidden">
            {users.map((u) => (
              <div key={u.id} className="p-3.5 flex items-center justify-between hover:bg-navy-50 text-sm">
                <div>
                  <p className="font-bold text-navy-900">{u.name}</p>
                  <p className="text-xs text-navy-500 font-mono">{u.email}</p>
                </div>
                <span className="text-xs bg-teal-50 text-teal-700 font-semibold px-2.5 py-1 rounded border border-teal-200 uppercase">
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: BACKUPS & SYNC */}
      {activeSection === 'backup' && (
        <div className="bg-white rounded-lg border border-navy-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-navy-900">Database Backup & Transfer Between Macs</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Room-314 stores your entire shop (products, sales, settings) in a single SQLite database file.
            </p>
          </div>

          {/* 1-Click Export & Import Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Download Backup */}
            <div className="p-4 rounded-lg border border-teal-200 bg-teal-50/40 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
                  <Download size={18} className="text-teal-600" />
                  <span>Download Shop Snapshot (.db)</span>
                </div>
                <p className="text-xs text-navy-600 mt-1">
                  Export your latest products, stock levels, sales history, and settings into a single file to back up or send to another Mac.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                icon={Download}
                loading={downloadingBackup}
                onClick={handleDownloadBackup}
                size="md"
                className="font-bold w-full"
              >
                Download Shop Data
              </Button>
            </div>

            {/* Restore / Import Backup */}
            <div className="p-4 rounded-lg border border-navy-200 bg-navy-50/50 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-navy-900 font-bold text-sm">
                  <Upload size={18} className="text-navy-700" />
                  <span>Import / Restore Shop Data</span>
                </div>
                <p className="text-xs text-navy-600 mt-1">
                  Upload a previously downloaded <code className="font-mono bg-navy-100 px-1 py-0.5 rounded text-[11px]">.db</code> file from another Mac to instantly restore that shop's exact state.
                </p>
              </div>
              <div>
                <input
                  type="file"
                  id="restore-db-input"
                  accept=".db,.sqlite"
                  onChange={handleRestoreFile}
                  className="hidden"
                />
                <label
                  htmlFor="restore-db-input"
                  className={`flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-semibold rounded-lg border border-navy-300 bg-white hover:bg-navy-100 text-navy-800 cursor-pointer shadow-2xs transition ${
                    restoringDb ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <Upload size={16} />
                  <span>{restoringDb ? 'Restoring Database...' : 'Select .db File to Restore'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Sync Between Two Macs Instructions */}
          <div className="pt-2 border-t border-navy-100 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <Laptop size={18} className="text-teal-600" />
              <span>How to Transfer or Sync to a Different Mac</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-navy-200 bg-white space-y-1">
                <span className="font-bold text-teal-800">Method 1: AirDrop / Send File (Simplest)</span>
                <p className="text-navy-600">
                  1. Click <strong>"Download Shop Data"</strong> above on Mac #1.<br />
                  2. AirDrop or WhatsApp the <code className="bg-navy-100 px-1 rounded">.db</code> file to Mac #2.<br />
                  3. On Mac #2, click <strong>"Select .db File to Restore"</strong>.<br />
                  All products, sales, and settings are instantly synced!
                </p>
              </div>

              <div className="p-3 rounded-lg border border-navy-200 bg-white space-y-1">
                <span className="font-bold text-teal-800">Method 2: Live Local Network Sharing</span>
                <p className="text-navy-600">
                  Keep Mac #1 running Room-314 at the counter.<br />
                  On Mac #2 or your phones (on the same WiFi), open:<br />
                  <code className="bg-navy-100 px-1 rounded font-bold">http://10.7.16.47:5173</code><br />
                  Both Macs bill into the <em>exact same live database</em> in real time!
                </p>
              </div>
            </div>
          </div>

          {/* Reset / Fresh Start Section */}
          <div className="pt-4 border-t border-red-200 bg-red-50/30 p-4 rounded-lg space-y-3">
            <div>
              <span className="text-xs uppercase font-bold text-red-800">Fresh Start / Clear Demo Data</span>
              <p className="text-xs text-navy-600 mt-0.5">
                Remove demo transactions or reset your store to clean zero state when you're ready for real business.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={resetting}
                onClick={() => handleResetData('clear_sales')}
                className="text-red-700 hover:bg-red-50 border-red-200"
              >
                Clear Demo Sales Only (Reset to ₹0)
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={resetting}
                onClick={() => handleResetData('clear_all')}
              >
                Wipe Everything (Blank Store)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

