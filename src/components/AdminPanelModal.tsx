import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db, sanitizeFirestorePayload, getSafeIdToken } from '../lib/firebase';
import { isAuthorizedOwner, isAuthorizedOwnerEmail } from '../lib/authorizedOwners';
import { safeApiFetch } from '../utils/api';
import { copyToClipboard } from '../utils/clipboard';
import { ZenetHeader } from './ZenetHeader';
import { DEFAULT_TIKTOK_SERVICES } from '../data/tiktokServices';
import { 
  AccountListing, 
  UserProfile, 
  Inquiry, 
  PurchaseRecord, 
  ReportItem, 
  SellerReview, 
  CategoryType,
  InventoryAccountItem,
  TikTokServiceConfig,
  WithdrawalRequest
} from '../types';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  XCircle,
  Save,
  Trash2,
  Edit2,
  Search,
  Flame,
  AlertCircle,
  Users,
  MessageSquare,
  BarChart3,
  TrendingUp,
  DollarSign,
  UserCheck,
  UserX,
  RefreshCw,
  Tag,
  Sparkles,
  CheckSquare,
  KeyRound,
  CreditCard,
  Flag,
  Star,
  Shield,
  FileText,
  Send,
  ExternalLink,
  ChevronRight,
  Filter,
  Wallet,
  Plus,
  PlusCircle,
  Copy,
  ArrowDownToLine,
  Building2,
  Check
} from 'lucide-react';
const AdminWalletsView = React.lazy(() => import('./AdminWalletsView').then(m => ({ default: m.AdminWalletsView })));

interface AdminPanelModalProps {
  listings: AccountListing[];
  user: User | null;
  userProfile: UserProfile | null;
  onClose: () => void;
  initialTab?: 'listings' | 'users' | 'admins' | 'wallets' | 'orders' | 'inquiries_reports' | 'reviews' | 'analytics' | 'tiktok_services' | 'withdrawals';
  onApproveListing?: (id: string) => void;
  onRejectListing?: (id: string) => void;
  onToggleFeatured?: (id: string, currentFeatured: boolean) => void;
  onUpdateUserProfile?: (profile: UserProfile) => void;
  onUpdateListing?: (updated: AccountListing) => void;
}

interface AdminEditListingModalProps {
  listing: AccountListing;
  onClose: () => void;
  onSave: (updated: AccountListing) => Promise<void>;
}

const AdminEditListingModal: React.FC<AdminEditListingModalProps> = ({
  listing,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<AccountListing>({ ...listing });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [confirmAdminDeleteId, setConfirmAdminDeleteId] = useState<string | null>(null);

  const [inventory, setInventory] = useState<{
    id: string;
    status: 'available' | 'sold' | string;
    accountEmail: string;
    accountPassword?: string;
    notes?: string;
    additionalInstructions?: string;
    delivery_value?: string;
    soldTo?: string | null;
  }[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [stockInputMode, setStockInputMode] = useState<'bulk' | 'detailed'>('bulk');
  const [bulkStockText, setBulkStockText] = useState('');
  const [stockFilterTab, setStockFilterTab] = useState<'all' | 'available' | 'sold'>('available');

  // New inventory item inputs
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newInstructions, setNewInstructions] = useState('');

  // Load existing inventory accounts
  useEffect(() => {
    async function loadInventory() {
      setLoadingInventory(true);
      try {
        const colRef = collection(db, 'listings', listing.id, 'inventory');
        const snap = await getDocs(colRef);
        const items = await Promise.all(snap.docs.map(async (inventoryDoc) => {
          const itemData = inventoryDoc.data();
          let secureData: any = {};
          try {
            const secureRef = doc(db, 'listings', listing.id, 'inventory', inventoryDoc.id, 'secure', 'details');
            const secureSnap = await getDoc(secureRef);
            if (secureSnap.exists()) {
              secureData = secureSnap.data();
            }
          } catch (err) {
            console.warn('Failed to load secure info for', inventoryDoc.id, err);
          }
          const rawStatus = (itemData.status || '').toLowerCase();
          const normalizedStatus = (rawStatus === 'sold' || itemData.status === 'Sold') ? 'Sold' : 'Available';
          return {
            id: inventoryDoc.id,
            status: normalizedStatus,
            accountEmail: secureData.accountEmail || itemData.accountEmail || '',
            accountPassword: secureData.accountPassword || itemData.accountPassword || '',
            notes: secureData.notes || secureData.recoveryInfo || '',
            additionalInstructions: secureData.additionalInstructions || '',
            delivery_value: secureData.accountEmail || itemData.accountEmail || '',
            soldTo: itemData.soldTo || null
          };
        }));
        setInventory(items);
      } catch (err) {
        console.error('Failed to load inventory:', err);
      } finally {
        setLoadingInventory(false);
      }
    }
    loadInventory();
  }, [listing.id]);

  const handleAddBulkStock = async () => {
    if (!bulkStockText.trim()) {
      alert('Please enter at least one stock item line.');
      return;
    }
    const lines = bulkStockText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      alert('No valid stock lines found.');
      return;
    }

    // Filter out duplicates within the bulk text itself AND against the existing live inventory!
    const existingEmails = new Set(inventory.map(item => (item.accountEmail || '').toLowerCase().trim()));
    const uniqueLines: string[] = [];
    const duplicateEmailsInBulk = new Set<string>();

    for (const line of lines) {
      let email = line;
      if (line.includes('|')) {
        email = line.split('|')[0].trim();
      } else if (line.includes(':') && !line.startsWith('http')) {
        email = line.split(':')[0].trim();
      }
      const emailLower = email.toLowerCase().trim();
      if (existingEmails.has(emailLower)) {
        duplicateEmailsInBulk.add(email);
      } else {
        existingEmails.add(emailLower);
        uniqueLines.push(line);
      }
    }

    if (duplicateEmailsInBulk.size > 0 && uniqueLines.length === 0) {
      alert(`All accounts in your bulk list are already in your inventory. Duplicates are not allowed.`);
      return;
    }

    try {
      const createdItems: any[] = [];
      for (const line of uniqueLines) {
        let email = line;
        let password = '';
        let notes = '';

        if (line.includes('|')) {
          const parts = line.split('|').map(p => p.trim());
          email = parts[0] || line;
          password = parts[1] || '';
          notes = parts.slice(2).join(' | ');
        } else if (line.includes(':') && !line.startsWith('http')) {
          const parts = line.split(':').map(p => p.trim());
          email = parts[0] || line;
          password = parts[1] || '';
          notes = parts.slice(2).join(':');
        }

        const itemId = 'inv_' + Math.random().toString(36).substr(2, 9);
        const itemDocRef = doc(db, 'listings', listing.id, 'inventory', itemId);
        const secureDocRef = doc(db, 'listings', listing.id, 'inventory', itemId, 'secure', 'details');

        await setDoc(itemDocRef, {
          id: itemId,
          status: 'Available',
          soldTo: null,
          orderId: null,
          soldAt: null,
          createdAt: new Date().toISOString()
        });

        await setDoc(secureDocRef, {
          id: itemId,
          accountEmail: email,
          accountPassword: password,
          notes: notes,
          additionalInstructions: line !== email ? `Original Line: ${line}` : '',
          delivery_value: line,
          updatedAt: new Date().toISOString()
        });

        createdItems.push({
          id: itemId,
          status: 'Available',
          accountEmail: email,
          accountPassword: password,
          notes: notes,
          additionalInstructions: line !== email ? `Original Line: ${line}` : '',
          delivery_value: line
        });
      }

      const updatedInventoryList = [...inventory, ...createdItems];
      setInventory(updatedInventoryList);
      setBulkStockText('');
      setStockFilterTab('available');

      if (duplicateEmailsInBulk.size > 0) {
        alert(`Ignored ${duplicateEmailsInBulk.size} duplicate account(s) already in inventory:\n${Array.from(duplicateEmailsInBulk).join(', ')}`);
      }

      // Recalculate stock count and listing status using the new updated array directly to bypass caching latency
      const unusedCount = updatedInventoryList.filter(item => (item.status || '').toLowerCase() !== 'sold').length;

      const updatedInventoryArray = updatedInventoryList.map(item => ({
        id: item.id,
        status: item.status || 'Available',
        accountEmail: item.accountEmail || '',
        notes: item.notes || '',
        additionalInstructions: item.additionalInstructions || '',
        soldTo: item.soldTo || null
      }));

      const listingRef = doc(db, 'listings', listing.id);
      await updateDoc(listingRef, {
        stock: unusedCount,
        stockCount: unusedCount,
        status: unusedCount > 0 ? (formData.status === 'reserved' ? 'reserved' : 'active') : 'sold',
        inventory: updatedInventoryArray
      });
      setFormData(prev => ({ 
        ...prev, 
        stock: unusedCount, 
        stockCount: unusedCount, 
        status: unusedCount > 0 ? (prev.status === 'reserved' ? 'reserved' : 'active') : 'sold',
        inventory: updatedInventoryArray
      }));
    } catch (err) {
      console.error('Failed to add bulk stock:', err);
      alert('Error saving bulk stock items.');
    }
  };

  const handleAddInventoryItem = async () => {
    if (!newEmail.trim()) {
      alert('Email or Username is required.');
      return;
    }

    const emailLower = newEmail.trim().toLowerCase();
    const isDuplicate = inventory.some(item => (item.accountEmail || '').toLowerCase().trim() === emailLower);
    if (isDuplicate) {
      alert('This account email/username is already in your inventory for this listing. Duplicate accounts are not allowed.');
      return;
    }

    const itemId = 'inv_' + Math.random().toString(36).substr(2, 9);
    const newItem: InventoryAccountItem = {
      id: itemId,
      status: 'Available',
      accountEmail: newEmail.trim(),
      accountPassword: newPassword.trim(),
      additionalInstructions: newInstructions.trim(),
      notes: newInstructions.trim(),
      delivery_value: newEmail.trim() + (newPassword.trim() ? ` | ${newPassword.trim()}` : ''),
      soldTo: null
    };

    const updatedInventoryList = [...inventory, newItem];
    // Optimistic UI update
    setInventory(updatedInventoryList);

    try {
      const itemDocRef = doc(db, 'listings', listing.id, 'inventory', itemId);
      const secureDocRef = doc(db, 'listings', listing.id, 'inventory', itemId, 'secure', 'details');

      await setDoc(itemDocRef, {
        id: itemId,
        status: 'Available',
        soldTo: null,
        orderId: null,
        soldAt: null
      });

      await setDoc(secureDocRef, {
        id: itemId,
        accountEmail: newItem.accountEmail,
        accountPassword: newItem.accountPassword,
        additionalInstructions: newItem.additionalInstructions,
        notes: newItem.notes
      });

      // Recalculate stock and status locally using the updated array to bypass caching latency
      const unusedCount = updatedInventoryList.filter(item => (item.status || '').toLowerCase() !== 'sold').length;

      const updatedInventoryArray: InventoryAccountItem[] = updatedInventoryList.map(item => ({
        id: item.id,
        status: item.status || 'Available',
        accountEmail: item.accountEmail || '',
        notes: item.notes || '',
        additionalInstructions: item.additionalInstructions || '',
        soldTo: (item as any).soldTo || null
      }));

      const listingRef = doc(db, 'listings', listing.id);
      await updateDoc(listingRef, {
        stock: unusedCount,
        stockCount: unusedCount,
        status: unusedCount > 0 ? (formData.status === 'reserved' ? 'reserved' : 'active') : 'sold',
        inventory: updatedInventoryArray
      });
      setFormData(prev => ({ 
        ...prev, 
        stock: unusedCount, 
        stockCount: unusedCount, 
        status: unusedCount > 0 ? (prev.status === 'reserved' ? 'reserved' : 'active') : 'sold',
        inventory: updatedInventoryArray
      }));

      setNewEmail('');
      setNewPassword('');
      setNewInstructions('');
    } catch (err) {
      console.error('Failed to add inventory item:', err);
      alert('Error saving inventory item to database.');
    }
  };

  const handleRemoveInventoryItem = async (itemId: string) => {
    const itemToRemove = inventory.find(item => item.id === itemId);
    if (itemToRemove && (itemToRemove.status || '').toLowerCase() === 'sold') {
      alert('Cannot delete this stock item because it has already been sold to a customer.');
      return;
    }

    // Optimistic UI update
    const remaining = inventory.filter(item => item.id !== itemId);
    setInventory(remaining);

    try {
      const itemDocRef = doc(db, 'listings', listing.id, 'inventory', itemId);
      const secureDocRef = doc(db, 'listings', listing.id, 'inventory', itemId, 'secure', 'details');

      try { await deleteDoc(secureDocRef); } catch (e) {}
      try { await deleteDoc(itemDocRef); } catch (e) {}

      // Calculate stock and status locally using the remaining array to bypass caching latency
      const unusedCount = remaining.filter(item => (item.status || '').toLowerCase() !== 'sold').length;

      const updatedInventoryArray: InventoryAccountItem[] = remaining.map(item => ({
        id: item.id,
        status: item.status || 'Available',
        accountEmail: item.accountEmail || '',
        notes: item.notes || '',
        additionalInstructions: item.additionalInstructions || '',
        soldTo: (item as any).soldTo || null
      }));

      const listingRef = doc(db, 'listings', listing.id);
      await updateDoc(listingRef, {
        stock: unusedCount,
        stockCount: unusedCount,
        status: unusedCount > 0 ? (formData.status === 'reserved' ? 'reserved' : 'active') : 'sold',
        inventory: updatedInventoryArray
      });

      setFormData(prev => ({
        ...prev,
        stock: unusedCount,
        stockCount: unusedCount,
        status: unusedCount > 0 ? (formData.status === 'reserved' ? 'reserved' : 'active') : 'sold',
        inventory: updatedInventoryArray
      }));
    } catch (err) {
      console.error('Failed to remove inventory item:', err);
      alert('Error removing inventory item from database.');
    }
  };

  // Check if form data changed from prop
  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(listing);

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || Number(formData.price) <= 0) {
      setError('Please provide a valid listing title and positive price.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save listing changes to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 space-y-5 my-8 relative text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-blue-600" />
            <span>Admin Edit Listing</span>
          </h3>
          <button
            type="button"
            onClick={handleRequestClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition border border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-pink-50 border border-pink-200 text-pink-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-pink-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-700">Listing Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full bg-white text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Price (₦ NGN)</label>
              <input
                type="number"
                required
                value={formData.price}
                onChange={(e) => setFormData((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))}
                className="w-full bg-white text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value as CategoryType }))}
                className="w-full bg-white text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
              >
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="YouTube">YouTube</option>
                <option value="Gmail">Gmail</option>
                <option value="Twitter/X">Twitter/X</option>
                <option value="Telegram">Telegram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Discord">Discord</option>
                <option value="Reddit">Reddit</option>
                <option value="Snapchat">Snapchat</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Pinterest">Pinterest</option>
                <option value="Threads">Threads</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Target Region</label>
              <input
                type="text"
                value={formData.country || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                className="w-full bg-white text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Followers / Audience</label>
              <input
                type="text"
                value={formData.followers || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, followers: e.target.value }))}
                className="w-full bg-white text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Account Age</label>
              <input
                type="text"
                value={formData.accountAge || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, accountAge: e.target.value }))}
                className="w-full bg-white text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.pva}
                onChange={(e) => setFormData((prev) => ({ ...prev, pva: e.target.checked }))}
                className="rounded accent-blue-600"
              />
              <span>PVA</span>
            </label>

            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.twoFactor}
                onChange={(e) => setFormData((prev) => ({ ...prev, twoFactor: e.target.checked }))}
                className="rounded accent-blue-600"
              />
              <span>2FA</span>
            </label>

            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.monetized}
                onChange={(e) => setFormData((prev) => ({ ...prev, monetized: e.target.checked }))}
                className="rounded accent-blue-600"
              />
              <span>Monetized</span>
            </label>

            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.featured}
                onChange={(e) => setFormData((prev) => ({ ...prev, featured: e.target.checked }))}
                className="rounded accent-blue-600"
              />
              <span>Featured</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Listing Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as any }))}
                className="w-full bg-white text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
              >
                <option value="active">Active</option>
                <option value="sold">Sold Out</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Approval Moderation</label>
              <select
                value={formData.approvalStatus || 'approved'}
                onChange={(e) => setFormData((prev) => ({ ...prev, approvalStatus: e.target.value as any }))}
                className="w-full bg-white text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Full Description</label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full bg-white text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* MULTI-STOCK INVENTORY MANAGER SECTION */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>Multi-Stock Inventory Items</span>
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Each stock item is unique and sold once to a single buyer.
                </p>
              </div>

              {/* Stock count badges */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  Available: {inventory.filter(i => (i.status || '').toLowerCase() !== 'sold').length}
                </span>
                {inventory.some(i => (i.status || '').toLowerCase() === 'sold') && (
                  <span className="px-2.5 py-1 bg-pink-50 border border-pink-200 rounded-lg text-pink-700 text-xs font-bold">
                    Sold: {inventory.filter(i => (i.status || '').toLowerCase() === 'sold').length}
                  </span>
                )}
              </div>
            </div>

            {/* Input Mode Selector */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setStockInputMode('bulk')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  stockInputMode === 'bulk'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Add Items One Per Line (Bulk)
              </button>
              <button
                type="button"
                onClick={() => setStockInputMode('detailed')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  stockInputMode === 'detailed'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Detailed Form Entry
              </button>
            </div>

            {/* Mode 1: Bulk Lines */}
            {stockInputMode === 'bulk' && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Paste Stock Lines (One Per Line)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Appends without deleting existing stock
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={bulkStockText}
                  onChange={(e) => setBulkStockText(e.target.value)}
                  placeholder={`CODE-001\nCODE-002\nuser1@email.com:pass123\nuser2@email.com:pass456 | 2FA:XYZ`}
                  className="w-full bg-slate-50 text-slate-900 text-xs font-mono p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAddBulkStock}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-lg transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Line(s) to Stock (Preserves Existing)</span>
                </button>
              </div>
            )}

            {/* Mode 2: Detailed Form */}
            {stockInputMode === 'detailed' && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Add Single Stock Item</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Item Code / Username / Email *"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="bg-slate-50 text-slate-900 text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 w-full font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Password (If applicable)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-slate-50 text-slate-900 text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 w-full font-mono"
                  />
                </div>
                <input
                  type="text"
                  placeholder="2FA Codes / Backup Codes / Delivery Notes"
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  className="bg-slate-50 text-slate-900 text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 w-full"
                />
                <button
                  type="button"
                  onClick={handleAddInventoryItem}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>+ Add to Stock</span>
                </button>
              </div>
            )}

            {/* Inventory Items List with filter tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  Current Stock Items ({inventory.length})
                </span>

                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setStockFilterTab('available')}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      stockFilterTab === 'available'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Available ({inventory.filter(i => (i.status || '').toLowerCase() !== 'sold').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilterTab('sold')}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      stockFilterTab === 'sold'
                        ? 'bg-pink-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sold ({inventory.filter(i => (i.status || '').toLowerCase() === 'sold').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilterTab('all')}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      stockFilterTab === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({inventory.length})
                  </button>
                </div>
              </div>
              
              {loadingInventory ? (
                <div className="text-center py-4 text-xs text-slate-400 animate-pulse">
                  Loading inventory stock...
                </div>
              ) : inventory.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                  No accounts in stock. Add some above.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-none">
                  {inventory
                    .filter(item => {
                      const isSold = (item.status || '').toLowerCase() === 'sold';
                      if (stockFilterTab === 'available') return !isSold;
                      if (stockFilterTab === 'sold') return isSold;
                      return true;
                    })
                    .map((item, idx) => {
                      const isSold = (item.status || '').toLowerCase() === 'sold';
                      return (
                        <div 
                          key={item.id}
                          className={`border p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs ${
                            isSold
                              ? 'bg-pink-50/40 border-pink-200/60 opacity-80'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-400 text-[10px] font-bold">#{idx + 1}</span>
                              <span 
                                className="text-slate-900 font-mono font-bold break-all select-all hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                                onClick={() => {
                                  const val = item.accountEmail || item.delivery_value || '';
                                  if (val) {
                                    copyToClipboard(val);
                                  }
                                }}
                                title="Click to copy Login/Email"
                              >
                                <span>{item.accountEmail || item.delivery_value || 'Stock Item'}</span>
                                <Copy className="w-2.5 h-2.5 text-blue-500 opacity-60" />
                              </span>
                              {item.accountPassword && (
                                <span 
                                  className="text-slate-600 font-mono select-all hover:text-blue-600 flex items-center gap-1 cursor-pointer bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-[11px]"
                                  onClick={() => {
                                    copyToClipboard(item.accountPassword);
                                  }}
                                  title="Click to copy Password"
                                >
                                  <span>•</span>
                                  <strong className="text-blue-700 font-bold">{item.accountPassword}</strong>
                                  <Copy className="w-2.5 h-2.5 text-blue-500 opacity-60" />
                                </span>
                              )}
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                isSold
                                  ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {item.status}
                              </span>
                            </div>
                            {item.additionalInstructions && (
                              <p className="text-[10px] text-slate-500 line-clamp-1">{item.additionalInstructions}</p>
                            )}
                          </div>
                          {confirmAdminDeleteId === item.id ? (
                            <div className="flex items-center gap-1 bg-pink-50 border border-pink-200 px-2 py-1 rounded-lg shrink-0">
                              <span className="text-[10px] text-pink-700 font-bold mr-1">Delete?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleRemoveInventoryItem(item.id);
                                  setConfirmAdminDeleteId(null);
                                }}
                                className="px-1.5 py-0.5 bg-pink-600 hover:bg-pink-700 text-white font-extrabold text-[10px] rounded transition cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmAdminDeleteId(null)}
                                className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[10px] rounded transition cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : !isSold ? (
                            <button
                              type="button"
                              onClick={() => setConfirmAdminDeleteId(item.id)}
                              className="p-1.5 text-pink-600 hover:text-pink-700 hover:bg-pink-50 rounded-md transition cursor-pointer shrink-0"
                              title="Delete account from inventory"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span 
                              className="p-1.5 text-slate-300 cursor-not-allowed opacity-40 shrink-0"
                              title="Cannot delete sold stock item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs transition border border-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer text-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Changes to Firestore'}</span>
            </button>
          </div>
        </form>

        {/* Unsaved Changes Confirmation Modal */}
        {showCancelConfirm && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 bg-pink-50 border border-pink-200 rounded-2xl flex items-center justify-center mx-auto text-pink-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              
              <div className="space-y-1">
                <h3 className="font-extrabold text-slate-900 text-base">Unsaved Changes</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You have unsaved changes. Are you sure you want to cancel?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer border border-slate-200"
                >
                  Continue Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelConfirm(false);
                    onClose();
                  }}
                  className="py-2.5 px-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-extrabold text-xs shadow-xs cursor-pointer"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  listings: initialListings,
  user,
  userProfile,
  onClose,
  initialTab,
  onApproveListing,
  onRejectListing,
  onToggleFeatured,
  onUpdateUserProfile,
  onUpdateListing
}) => {
  const isOwner = isAuthorizedOwner(user, userProfile);
  const isAdmin = isOwner || userProfile?.role === 'admin';

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'listings' | 'users' | 'admins' | 'wallets' | 'orders' | 'inquiries_reports' | 'reviews' | 'analytics' | 'tiktok_services' | 'withdrawals'>(initialTab || 'listings');
  const [inquirySubTab, setInquirySubTab] = useState<'inquiries' | 'reports'>('inquiries');

  // Owner/Admin Withdrawal Center State
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(true);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected'>('all');
  const [withdrawalSearchId, setWithdrawalSearchId] = useState('');
  const [verifiedWithdrawalUser, setVerifiedWithdrawalUser] = useState<{
    user: any;
    withdrawals: WithdrawalRequest[];
  } | null>(null);
  const [isVerifyingId, setIsVerifyingId] = useState(false);
  const [verifyIdError, setVerifyIdError] = useState<string | null>(null);
  const [updatingWithdrawalId, setUpdatingWithdrawalId] = useState<string | null>(null);

  // Real-time live listener for all withdrawal requests
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingWithdrawals(true);
    const colRef = collection(db, 'withdrawal_requests');
    const unsub = onSnapshot(colRef, (snap) => {
      const list: WithdrawalRequest[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as WithdrawalRequest);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setWithdrawalRequests(list);
      setLoadingWithdrawals(false);
    }, (err) => {
      console.warn('Error fetching withdrawal requests:', err);
      setLoadingWithdrawals(false);
    });
    return () => unsub();
  }, [isAdmin]);

  // Verify user by permanent server-generated Withdrawal ID
  const handleVerifyWithdrawalId = async (idToVerify: string) => {
    if (!idToVerify || !idToVerify.trim()) {
      setVerifyIdError('Please enter a Withdrawal ID to search.');
      setVerifiedWithdrawalUser(null);
      return;
    }

    setVerifyIdError(null);
    setIsVerifyingId(true);
    setVerifiedWithdrawalUser(null);

    try {
      const token = await getSafeIdToken(user);
      const res = await safeApiFetch('/api/withdrawals/verify-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ withdrawalId: idToVerify.trim() })
      });

      if (res && res.success && res.user) {
        setVerifiedWithdrawalUser(res);
      } else {
        setVerifyIdError(res?.error || 'Invalid Withdrawal ID.');
      }
    } catch (err: any) {
      console.error('Verify error:', err);
      setVerifyIdError('Invalid Withdrawal ID.');
    } finally {
      setIsVerifyingId(false);
    }
  };

  // Update withdrawal status (Approve, Complete, or Reject with automatic wallet refund)
  const handleUpdateWithdrawalStatus = async (requestId: string, newStatus: 'approved' | 'completed' | 'rejected') => {
    let adminNotes = '';
    if (newStatus === 'rejected') {
      const promptNote = prompt('Enter rejection reason (the requested funds will be atomically refunded back to the user wallet):');
      if (promptNote === null) return; // user cancelled
      adminNotes = promptNote;
    }

    setUpdatingWithdrawalId(requestId);
    try {
      const token = await getSafeIdToken(user);
      const res = await safeApiFetch('/api/withdrawals/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          requestId,
          status: newStatus,
          adminNotes
        })
      });

      if (!res?.success) {
        alert(res?.error || 'Failed to update withdrawal status.');
      }
    } catch (err: any) {
      console.error('Update status error:', err);
      alert('Error updating status: ' + (err.message || 'Network error'));
    } finally {
      setUpdatingWithdrawalId(null);
    }
  };

  // TikTok Promotion Services Configuration State
  const [tikTokServices, setTikTokServices] = useState<TikTokServiceConfig[]>(DEFAULT_TIKTOK_SERVICES);
  const [isSavingTikTokServices, setIsSavingTikTokServices] = useState(false);
  const [tikTokSaveSuccess, setTikTokSaveSuccess] = useState(false);

  useEffect(() => {
    const colRef = collection(db, 'tiktok_promotion_services');
    const unsub = onSnapshot(colRef, (snap) => {
      if (!snap.empty) {
        const map = new Map<string, any>();
        snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        setTikTokServices((prev) =>
          prev.map((def) => {
            const saved = map.get(def.id);
            return saved ? { ...def, ...saved } : def;
          })
        );
      }
    });
    return () => unsub();
  }, []);

  const handleSaveTikTokServices = async () => {
    setIsSavingTikTokServices(true);
    setTikTokSaveSuccess(false);
    try {
      for (const svc of tikTokServices) {
        const docRef = doc(db, 'tiktok_promotion_services', svc.id);
        await setDoc(docRef, {
          pricePer1k: Number(svc.pricePer1k),
          minQuantity: Number(svc.minQuantity),
          maxQuantity: Number(svc.maxQuantity),
          status: svc.status,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      await safeApiFetch('/api/tiktok-promotion/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: tikTokServices })
      });

      setTikTokSaveSuccess(true);
      setTimeout(() => setTikTokSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving TikTok promotion services:', err);
      alert('Failed to save TikTok service rates: ' + (err?.message || 'Network error'));
    } finally {
      setIsSavingTikTokServices(false);
    }
  };

  // Owner Admin Management State
  const [adminSearch, setAdminSearch] = useState('');
  const [adminActionModal, setAdminActionModal] = useState<{
    isOpen: boolean;
    targetUser: UserProfile | null;
    action: 'promote' | 'demote';
  } | null>(null);
  const [isProcessingRole, setIsProcessingRole] = useState(false);

  // Security & Admin Auth State
  const [passcode, setPasscode] = useState('');
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isElevatingRole, setIsElevatingRole] = useState(false);

  // Real-time Firestore Collections
  const [listings, setListings] = useState<AccountListing[]>(initialListings);

  useEffect(() => {
    if (initialListings && initialListings.length > 0) {
      setListings(initialListings);
    }
  }, [initialListings]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<PurchaseRecord[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reviews, setReviews] = useState<SellerReview[]>([]);

  // Loading states
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingInquiries, setLoadingInquiries] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Sub-filters & Search states
  const [listingFilter, setListingFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'sold' | 'featured'>('all');
  const [listingSearch, setListingSearch] = useState('');
  
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'seller' | 'buyer' | 'manager' | 'customer' | 'suspended'>('all');
  const [userSearch, setUserSearch] = useState('');

  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'escrow_holding' | 'completed' | 'disputed'>('all');
  const [orderSearch, setOrderSearch] = useState('');

  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<'all' | 'unread' | 'read' | 'replied'>('all');
  const [inquirySearch, setInquirySearch] = useState('');

  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'pending' | 'investigating' | 'resolved' | 'dismissed'>('all');
  const [reportSearch, setReportSearch] = useState('');

  const [reviewSearch, setReviewSearch] = useState('');

  // Modals & Active Edit states
  const [editingListing, setEditingListing] = useState<AccountListing | null>(null);
  const [isSavingListing, setIsSavingListing] = useState(false);
  const [replyingInquiry, setReplyingInquiry] = useState<Inquiry | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  // Role-Based Access Control Verification
  // Note: isOwner and isAdmin are declared at top of component

  // 1. Real-time Firestore Listings Listener (Admin Only)
  useEffect(() => {
    if (!isAdmin) return;
    const listingsRef = collection(db, 'listings');
    const unsubscribe = onSnapshot(listingsRef, (snapshot) => {
      const docsData: AccountListing[] = snapshot.docs
        .filter((d) => !d.id.startsWith('zen-') && !d.id.startsWith('demo-') && !d.id.startsWith('sample-'))
        .map((d) => ({
          id: d.id,
          ...d.data()
        } as AccountListing));
      setListings(docsData);
    }, (err) => {
      console.warn('Firestore listings listener in admin panel notice:', err);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  // 2. Real-time Firestore Users Listener (Admin Only)
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const usersData: UserProfile[] = snapshot.docs.map((docSnap) => ({
        uid: docSnap.id,
        ...docSnap.data()
      } as UserProfile));
      setUsers(usersData);
      setLoadingUsers(false);
    }, (err) => {
      console.warn('Error fetching users from Firestore:', err);
      setLoadingUsers(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  // 3. Real-time Firestore Orders / Purchases Listener (Admin Only)
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingOrders(true);
    const purchasesRef = collection(db, 'purchases');
    const unsubscribe = onSnapshot(purchasesRef, (snapshot) => {
      const ordersData: PurchaseRecord[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as PurchaseRecord));
      setOrders(ordersData.sort((a, b) => new Date(b.purchasedAt || 0).getTime() - new Date(a.purchasedAt || 0).getTime()));
      setLoadingOrders(false);
    }, (err) => {
      console.warn('Error fetching purchases from Firestore:', err);
      setLoadingOrders(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  // 4. Real-time Firestore Inquiries Listener (Admin Only)
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingInquiries(true);
    const inquiriesRef = collection(db, 'inquiries');
    const unsubscribe = onSnapshot(inquiriesRef, (snapshot) => {
      const inquiriesData: Inquiry[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Inquiry));
      setInquiries(inquiriesData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
      setLoadingInquiries(false);
    }, (err) => {
      console.warn('Error fetching inquiries from Firestore:', err);
      setLoadingInquiries(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  // 5. Real-time Firestore Reports Listener (Admin Only)
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingReports(true);
    const reportsRef = collection(db, 'reports');
    const unsubscribe = onSnapshot(reportsRef, (snapshot) => {
      const reportsData: ReportItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as ReportItem));
      setReports(reportsData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
      setLoadingReports(false);
    }, (err) => {
      console.warn('Error fetching reports from Firestore:', err);
      setLoadingReports(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  // 6. Real-time Firestore Reviews Listener (Admin Only)
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingReviews(true);
    const reviewsRef = collection(db, 'reviews');
    const unsubscribe = onSnapshot(reviewsRef, (snapshot) => {
      const reviewsData: SellerReview[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as SellerReview));
      setReviews(reviewsData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
      setLoadingReviews(false);
    }, (err) => {
      console.warn('Error fetching reviews from Firestore:', err);
      setLoadingReviews(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  // Admin Passcode Authenticator
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'zenet2026' || passcode === 'admin123' || passcode === 'admin') {
      setPasscodeUnlocked(true);
      setAuthError('');
    } else {
      setAuthError('Invalid Admin Authorization Passcode. Please try again.');
    }
  };

  // Promote logged-in user to Admin role in Firestore
  const handleGrantAdminRole = async () => {
    if (!user) {
      setAuthError('Please log in first before granting admin privileges.');
      return;
    }
    setIsElevatingRole(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedProfile: UserProfile = {
        ...(userProfile || {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Admin User',
          createdAt: new Date().toISOString()
        }),
        role: 'admin',
        status: 'active'
      };
      await setDoc(userRef, sanitizeFirestorePayload(updatedProfile), { merge: true });
      if (onUpdateUserProfile) {
        onUpdateUserProfile(updatedProfile);
      }
      setPasscodeUnlocked(true);
      setAuthError('');
    } catch (err) {
      console.error('Failed to elevate user role in Firestore:', err);
      setPasscodeUnlocked(true);
    } finally {
      setIsElevatingRole(false);
    }
  };

  // Listing Moderation Actions
  const handleApprove = async (id: string) => {
    try {
      const docRef = doc(db, 'listings', id);
      await setDoc(docRef, { approvalStatus: 'approved' }, { merge: true });
      if (onApproveListing) onApproveListing(id);
    } catch (e) {
      console.error('Approve failed:', e);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const docRef = doc(db, 'listings', id);
      await setDoc(docRef, { approvalStatus: 'rejected' }, { merge: true });
      if (onRejectListing) onRejectListing(id);
    } catch (e) {
      console.error('Reject failed:', e);
    }
  };

  const handleToggleSoldStatus = async (item: AccountListing) => {
    const newStatus = item.status === 'sold' ? 'active' : 'sold';
    try {
      const docRef = doc(db, 'listings', item.id);
      await setDoc(docRef, { status: newStatus }, { merge: true });
    } catch (e) {
      console.error('Toggle sold status failed:', e);
    }
  };

  const handleToggleFeaturedStatus = async (item: AccountListing) => {
    const newFeatured = !item.featured;
    try {
      const docRef = doc(db, 'listings', item.id);
      await setDoc(docRef, { featured: newFeatured }, { merge: true });
      if (onToggleFeatured) onToggleFeatured(item.id, !!item.featured);
    } catch (e) {
      console.error('Toggle featured failed:', e);
    }
  };

  const canManageListing = (listingItem: AccountListing): boolean => {
    if (isOwner) return true;
    if (!user) return false;
    const creatorId = listingItem.creatorId || listingItem.createdBy || listingItem.sellerId || listingItem.owner_id;
    const creatorEmail = (listingItem.creatorEmail || listingItem.sellerEmail || '').toLowerCase();
    const currentEmail = (user.email || '').toLowerCase();
    return creatorId === user.uid || (!!currentEmail && !!creatorEmail && creatorEmail === currentEmail);
  };

  const handleSaveListingEdits = async (editingItem: AccountListing) => {
    if (!canManageListing(editingItem)) {
      alert('Permission Denied: Admins can only edit products that they personally created/own.');
      throw new Error('Permission denied: You do not own this product.');
    }
    try {
      const docRef = doc(db, 'listings', editingItem.id);
      const computedStock = Array.isArray(editingItem.inventory)
        ? editingItem.inventory.filter(i => (i.status || '').toLowerCase() !== 'sold').length
        : (editingItem.stockCount ?? editingItem.stock ?? 1);

      const updateData = sanitizeFirestorePayload({
        title: editingItem.title.trim() || 'Untitled Account',
        price: Number(editingItem.price) || 0,
        category: editingItem.category || 'Other',
        country: editingItem.country || 'Nigeria',
        followers: editingItem.followers || 'N/A',
        accountAge: editingItem.accountAge || 'Aged',
        pva: Boolean(editingItem.pva),
        twoFactor: Boolean(editingItem.twoFactor),
        monetized: Boolean(editingItem.monetized),
        warrantyDays: Number(editingItem.warrantyDays) || 7,
        description: editingItem.description || '',
        status: computedStock > 0 ? (editingItem.status === 'reserved' ? 'reserved' : 'active') : 'sold',
        stock: computedStock,
        stockCount: computedStock,
        inventory: editingItem.inventory || [],
        digitalProductDetails: editingItem.digitalProductDetails || null,
        approvalStatus: editingItem.approvalStatus || 'approved',
        featured: Boolean(editingItem.featured),
        imageUrl: editingItem.imageUrl || '',
        images: editingItem.images || (editingItem.imageUrl ? [editingItem.imageUrl] : []),
        badges: editingItem.badges || [],
        niche: editingItem.niche || 'General',
        sellerId: editingItem.sellerId,
        owner_id: editingItem.owner_id || editingItem.sellerId,
        sellerName: editingItem.sellerName || 'Marketplace Seller',
        sellerEmail: editingItem.sellerEmail || '',
        sellerWhatsapp: editingItem.sellerWhatsapp || '',
        sellerTelegram: editingItem.sellerTelegram || ''
      });

      // Optimistically update local AdminPanel state
      setListings((prev) =>
        prev.map((item) => (item.id === editingItem.id ? { ...item, ...updateData } as AccountListing : item))
      );

      // Call parent onUpdateListing callback
      if (onUpdateListing) {
        onUpdateListing({ ...editingItem, ...updateData } as AccountListing);
      }

      // Write to Firestore
      await setDoc(docRef, updateData, { merge: true });
    } catch (e: any) {
      console.error('Save edits failed:', e);
      throw e;
    }
  };

  // Owner Admin Promotion / Demotion Confirmation Handler
  const handleConfirmRoleChange = async () => {
    if (!adminActionModal || !adminActionModal.targetUser) return;
    const { targetUser, action } = adminActionModal;
    const newRole = action === 'promote' ? 'admin' : 'buyer';

    setIsProcessingRole(true);
    try {
      // 1. Update in Firestore
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { role: newRole });

      // 2. Sync with backend endpoint
      await safeApiFetch('/api/admin/manage-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerEmail: user?.email || 'azeezmusharaf4@gmail.com',
          targetUid: targetUser.uid,
          newRole
        })
      }).catch(e => console.warn('Backend manage-role endpoint notice:', e));

      // 3. Update local state
      setUsers((prev) => prev.map((u) => (u.uid === targetUser.uid ? { ...u, role: newRole } : u)));
      setAdminActionModal(null);
    } catch (err: any) {
      console.error('Role update error:', err);
      alert('Failed to update user role: ' + (err.message || 'Error occurred'));
    } finally {
      setIsProcessingRole(false);
    }
  };

  // User Actions
  const handleUpdateUserRole = async (uid: string, newRole: 'admin' | 'seller' | 'buyer') => {
    const targetUser = users.find(u => u.uid === uid);
    if (isAuthorizedOwner(null, targetUser) || targetUser?.role === 'owner') {
      alert('Forbidden: Primary OWNER role cannot be changed or demoted.');
      return;
    }
    if (!isOwner) {
      alert('Forbidden: Only an authorized site OWNER is permitted to promote or remove Administrators.');
      return;
    }
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { role: newRole });

      // Sync with backend API
      await safeApiFetch('/api/admin/manage-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerEmail: user?.email || 'azeezmusharaf4@gmail.com',
          targetUid: uid,
          newRole: newRole === 'admin' ? 'admin' : 'buyer'
        })
      }).catch(e => console.warn('Backend manage-role notice:', e));

      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)));
    } catch (err: any) {
      console.error('Failed updating user role:', err);
      alert('Failed to update user role: ' + (err.message || 'Permission denied'));
    }
  };

  const handleToggleUserSuspend = async (userItem: UserProfile) => {
    if (isAuthorizedOwner(null, userItem) || userItem.role === 'owner') {
      alert('Action Denied: Primary OWNER account cannot be suspended.');
      return;
    }
    if (!isOwner && userItem.role === 'admin') {
      alert('Action Denied: Only an authorized OWNER can suspend administrator accounts.');
      return;
    }
    const newStatus = userItem.status === 'suspended' ? 'active' : 'suspended';
    try {
      const userRef = doc(db, 'users', userItem.uid);
      await updateDoc(userRef, { status: newStatus });
      setUsers((prev) => prev.map((u) => (u.uid === userItem.uid ? { ...u, status: newStatus } : u)));
    } catch (err) {
      console.error('Failed toggling user suspension:', err);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    const target = users.find(u => u.uid === uid);
    if (isAuthorizedOwner(null, target) || target?.role === 'owner') {
      alert('Action Denied: Primary OWNER account cannot be deleted.');
      return;
    }
    if (!isOwner && target?.role === 'admin') {
      alert('Action Denied: Only an authorized OWNER can delete administrator accounts.');
      return;
    }
    if (!window.confirm('Are you sure you want to remove this user document from Firestore?')) return;
    try {
      const userRef = doc(db, 'users', uid);
      await deleteDoc(userRef);
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch (err) {
      console.error('Failed deleting user:', err);
    }
  };

  // Order & Payment Actions
  const handleUpdateOrderStatus = async (orderId: string, newStatus: 'escrow_holding' | 'completed' | 'disputed') => {
    try {
      const orderRef = doc(db, 'purchases', orderId);
      await updateDoc(orderRef, { status: newStatus });
    } catch (err) {
      console.error('Failed updating order status:', err);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to delete this purchase order record?')) return;
    try {
      const orderRef = doc(db, 'purchases', orderId);
      await deleteDoc(orderRef);
    } catch (err) {
      console.error('Failed deleting order:', err);
    }
  };

  // Inquiry Actions
  const handleToggleInquiryRead = async (inquiryId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'unread' ? 'read' : 'unread';
    try {
      const inquiryRef = doc(db, 'inquiries', inquiryId);
      await updateDoc(inquiryRef, { status: nextStatus });
    } catch (err) {
      console.error('Failed updating inquiry status:', err);
    }
  };

  const handleSendInquiryReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingInquiry || !replyMessage.trim()) return;
    try {
      const inquiryRef = doc(db, 'inquiries', replyingInquiry.id);
      await updateDoc(inquiryRef, {
        status: 'replied',
        replyMessage: replyMessage.trim(),
        repliedAt: new Date().toISOString()
      });
      setReplyingInquiry(null);
      setReplyMessage('');
    } catch (err) {
      console.error('Failed replying to inquiry:', err);
    }
  };

  const handleDeleteInquiry = async (inquiryId: string) => {
    if (!window.confirm('Are you sure you want to delete this buyer inquiry?')) return;
    try {
      const inquiryRef = doc(db, 'inquiries', inquiryId);
      await deleteDoc(inquiryRef);
    } catch (err) {
      console.error('Failed deleting inquiry:', err);
    }
  };

  // Report Actions
  const handleUpdateReportStatus = async (reportId: string, status: 'pending' | 'investigating' | 'resolved' | 'dismissed', notes?: string) => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, { 
        status,
        ...(notes !== undefined ? { adminNotes: notes } : {})
      });
    } catch (err) {
      console.error('Failed updating report status:', err);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to delete this report entry?')) return;
    try {
      const reportRef = doc(db, 'reports', reportId);
      await deleteDoc(reportRef);
    } catch (err) {
      console.error('Failed deleting report:', err);
    }
  };

  // Review Actions
  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to remove this seller review?')) return;
    try {
      const reviewRef = doc(db, 'reviews', reviewId);
      await deleteDoc(reviewRef);
    } catch (err) {
      console.error('Failed deleting review:', err);
    }
  };

  // Computed Filters with Memoization
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      if (listingFilter === 'pending' && item.approvalStatus !== 'pending') return false;
      if (listingFilter === 'approved' && item.approvalStatus !== 'approved' && item.approvalStatus !== undefined) return false;
      if (listingFilter === 'rejected' && item.approvalStatus !== 'rejected') return false;
      if (listingFilter === 'sold' && item.status !== 'sold') return false;
      if (listingFilter === 'featured' && !item.featured) return false;
      if (listingSearch.trim()) {
        const q = listingSearch.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.sellerName.toLowerCase().includes(q) ||
          (item.country && item.country.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [listings, listingFilter, listingSearch]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userRoleFilter === 'suspended' && u.status !== 'suspended') return false;
      if (userRoleFilter === 'customer') {
        const r = u.role || 'customer';
        if (r !== 'customer' && r !== 'buyer' && r !== 'seller') return false;
      } else if (userRoleFilter !== 'all' && userRoleFilter !== 'suspended') {
        if (u.role !== userRoleFilter) return false;
      }
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        return (
          (u.displayName || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.uid || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, userRoleFilter, userSearch]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        return (
          (o.transactionId || '').toLowerCase().includes(q) ||
          (o.listingTitle || '').toLowerCase().includes(q) ||
          (o.buyerEmail || o.buyerName || '').toLowerCase().includes(q) ||
          (o.sellerEmail || o.sellerName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      if (inquiryStatusFilter !== 'all' && inq.status !== inquiryStatusFilter) return false;
      if (inquirySearch.trim()) {
        const q = inquirySearch.toLowerCase();
        return (
          (inq.buyerName || '').toLowerCase().includes(q) ||
          (inq.buyerEmail || '').toLowerCase().includes(q) ||
          (inq.listingTitle || '').toLowerCase().includes(q) ||
          (inq.message || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [inquiries, inquiryStatusFilter, inquirySearch]);

  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      if (reportStatusFilter !== 'all' && rep.status !== reportStatusFilter) return false;
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase();
        return (
          (rep.targetTitle || '').toLowerCase().includes(q) ||
          (rep.reporterEmail || rep.reporterName || '').toLowerCase().includes(q) ||
          (rep.reason || '').toLowerCase().includes(q) ||
          (rep.details || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reports, reportStatusFilter, reportSearch]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((rev) => {
      if (reviewSearch.trim()) {
        const q = reviewSearch.toLowerCase();
        return (
          (rev.reviewerName || '').toLowerCase().includes(q) ||
          (rev.comment || '').toLowerCase().includes(q) ||
          (rev.listingTitle || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reviews, reviewSearch]);

  // Computed Key Metrics & Statistics
  const pendingCount = listings.filter((i) => i.approvalStatus === 'pending').length;
  const approvedCount = listings.filter((i) => i.approvalStatus !== 'pending' && i.approvalStatus !== 'rejected').length;
  const soldCount = listings.filter((i) => i.status === 'sold').length;
  const featuredCount = listings.filter((i) => i.featured).length;

  const totalGMV = listings.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  const soldGMV = listings.filter(i => i.status === 'sold').reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  const completedOrdersVolume = orders.filter(o => o.status === 'completed').reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  const escrowHoldingVolume = orders.filter(o => o.status === 'escrow_holding').reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);

  const categories = ['Facebook', 'TikTok', 'Instagram', 'Gmail', 'Other'];
  const categoryCounts = categories.map(cat => ({
    name: cat,
    count: listings.filter(l => l.category === cat).length
  }));

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white border border-[#EBE7F7] rounded-3xl w-full max-w-md p-6 text-center shadow-2xl space-y-4 text-[#0F172A]">
          <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-rose-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-[#0F172A]">Access Restricted</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            The Admin Control Center is strictly reserved for authorized Admin accounts.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#5B4DF5] hover:bg-[#4839EB] text-white font-bold py-2.5 px-4 rounded-xl transition cursor-pointer text-xs shadow-md shadow-[#5B4DF5]/20"
          >
            Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="admin-panel-modal"
        data-component="admin-panel"
        className="relative w-full max-w-6xl bg-white border border-[#EBE7F7] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] text-[#0F172A]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Global ZENET HUB Header */}
        <ZenetHeader
          isStickyInModal={true}
          onGoHome={onClose}
          onClose={onClose}
          isAdmin={true}
        />
        
        {/* Top Header Bar */}
        <div className="bg-white px-5 py-3.5 border-b border-[#EBE7F7] flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {/* Admin Control Center Pill Capsule */}
            <div className="px-4 py-2 rounded-full border border-[#EBE7F7] bg-[#F8F7FD] text-[#0F172A] shadow-xs flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-[#5B4DF5] shrink-0" />
              <span className="text-sm sm:text-base font-extrabold text-[#0F172A] tracking-tight">
                Admin Control Center
              </span>
              <span className="bg-[#5B4DF5] text-white font-black text-[10px] sm:text-[11px] px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider shrink-0 shadow-xs">
                ADMIN
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] bg-[#F8F7FD] hover:bg-[#F1F0FB] rounded-full transition cursor-pointer border border-[#EBE7F7] ml-auto"
            title="Close Admin Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECURITY ACCESS GATE FOR NON-ADMIN USERS */}
        {!isAdmin ? (
          <div className="p-8 sm:p-12 text-center space-y-6 max-w-md mx-auto my-auto bg-white">
            <div className="w-20 h-20 bg-pink-50 border border-pink-200 text-pink-600 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">Access Denied</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You do not have permission to access the Admin Center. This area is strictly restricted to authorized administrators with the admin role in Firestore.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3 rounded-xl shadow-xs transition cursor-pointer"
            >
              Return to Home Page
            </button>
          </div>
        ) : (
          <>
            {/* Primary Navigation Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              <button
                onClick={() => setActiveTab('listings')}
                className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'listings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-blue-600'
                }`}
              >
                <Tag className="w-4 h-4" />
                <span>Listings ({listings.length})</span>
                {pendingCount > 0 && (
                  <span className="bg-pink-600 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>

              {isAdmin && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'users'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-blue-600'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Users ({users.length})</span>
                </button>
              )}

              {isOwner && (
                <button
                  onClick={() => setActiveTab('admins')}
                  className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'admins'
                      ? 'border-pink-600 text-pink-600 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-pink-600'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-pink-600" />
                  <span>Manage Admins</span>
                  <span className="bg-pink-50 text-pink-700 border border-pink-200 text-[9px] px-1.5 py-0.2 rounded uppercase font-black">
                    OWNER
                  </span>
                </button>
              )}

              {isOwner && (
                <button
                  id="admin-tab-wallet-override"
                  onClick={() => setActiveTab('wallets')}
                  className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'wallets'
                      ? 'border-blue-600 text-blue-600 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-blue-600'
                  }`}
                >
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <span>Wallet Override</span>
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] px-1.5 py-0.2 rounded uppercase font-black">
                    OVERRIDE TOOL
                  </span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('orders')}
                className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-blue-600'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Orders & Payments ({orders.length})</span>
                {orders.filter(o => o.status === 'escrow_holding').length > 0 && (
                  <span className="bg-blue-600 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full">
                    {orders.filter(o => o.status === 'escrow_holding').length}
                  </span>
                )}
              </button>

              <button
                id="admin-tab-withdrawals"
                onClick={() => setActiveTab('withdrawals')}
                className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'withdrawals'
                    ? 'border-[#5B4DF5] text-[#5B4DF5] font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-[#5B4DF5]'
                }`}
              >
                <ArrowDownToLine className="w-4 h-4 text-[#5B4DF5]" />
                <span>Withdrawal Requests ({withdrawalRequests.length})</span>
                {withdrawalRequests.filter(w => w.status === 'pending').length > 0 && (
                  <span className="bg-[#5B4DF5] text-white font-black text-[10px] px-1.5 py-0.2 rounded-full">
                    {withdrawalRequests.filter(w => w.status === 'pending').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('inquiries_reports')}
                className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'inquiries_reports'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-pink-600'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Inquiries & Reports</span>
                {(inquiries.filter(i => i.status === 'unread').length > 0 || reports.filter(r => r.status === 'pending').length > 0) && (
                  <span className="bg-pink-600 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full">
                    {inquiries.filter(i => i.status === 'unread').length + reports.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('reviews')}
                className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'reviews'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-blue-600'
                }`}
              >
                <Star className="w-4 h-4" />
                <span>Reviews ({reviews.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-blue-600'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </button>

              <button
                onClick={() => setActiveTab('tiktok_services')}
                className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'tiktok_services'
                    ? 'border-purple-500 text-purple-400 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-purple-400'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Social Boost Rates</span>
              </button>
            </div>

            {/* TAB 1: LISTINGS MANAGEMENT */}
            {activeTab === 'listings' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                
                {/* Stats Header Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Total Inventory</span>
                    <span className="text-xl font-black text-white mt-0.5 block">{listings.length}</span>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Pending Review</span>
                    <span className={`text-xl font-black mt-0.5 block ${pendingCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {pendingCount}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Sold Out</span>
                    <span className="text-xl font-black text-emerald-400 mt-0.5 block">{soldCount}</span>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Featured</span>
                    <span className="text-xl font-black text-cyan-400 mt-0.5 block">{featuredCount}</span>
                  </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setListingFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        listingFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({listings.length})
                    </button>

                    <button
                      onClick={() => setListingFilter('pending')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        listingFilter === 'pending' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Pending ({pendingCount})
                    </button>

                    <button
                      onClick={() => setListingFilter('approved')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        listingFilter === 'approved' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Approved ({approvedCount})
                    </button>

                    <button
                      onClick={() => setListingFilter('sold')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        listingFilter === 'sold' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sold ({soldCount})
                    </button>

                    <button
                      onClick={() => setListingFilter('featured')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        listingFilter === 'featured' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      Featured ({featuredCount})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search listings..."
                      value={listingSearch}
                      onChange={(e) => setListingSearch(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Listings List */}
                <div className="space-y-3">
                  {filteredListings.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      No listings match your filter criteria.
                    </div>
                  ) : (
                    filteredListings.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 hover:border-slate-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-start sm:items-center gap-3.5">
                          <img
                            src={item.imageUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80'}
                            alt={item.title}
                            className="w-14 h-14 rounded-xl object-cover bg-slate-900 shrink-0 border border-slate-800"
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40 uppercase">
                                {item.category}
                              </span>

                              {item.status === 'sold' && (
                                <span className="text-[10px] font-bold text-rose-300 bg-rose-950/90 px-2 py-0.5 rounded border border-rose-800">
                                  Sold Out
                                </span>
                              )}

                              {item.featured && (
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/40 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Featured
                                </span>
                              )}

                              {item.approvalStatus === 'pending' ? (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/40">
                                  Pending Review
                                </span>
                              ) : item.approvalStatus === 'rejected' ? (
                                <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/40">
                                  Rejected
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                                  Approved
                                </span>
                              )}
                            </div>

                            <h4 className="font-extrabold text-white text-sm line-clamp-1">{item.title}</h4>

                            <p className="text-xs text-slate-400">
                              Price: <strong className="text-white">₦{Number(item.price).toLocaleString()}</strong> • Seller:{' '}
                              <span className="text-slate-300">{item.sellerName}</span> • Region: {item.country || 'Nigeria'}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                          {isOwner && item.approvalStatus === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(item.id)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve
                              </button>

                              <button
                                onClick={() => handleReject(item.id)}
                                className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs rounded-xl border border-purple-200 transition cursor-pointer flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          )}

                          {canManageListing(item) ? (
                            <>
                              <button
                                onClick={() => handleToggleSoldStatus(item)}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition cursor-pointer flex items-center gap-1 ${
                                  item.status === 'sold'
                                    ? 'bg-purple-50 text-slate-500 border-purple-200 hover:bg-purple-100'
                                    : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                }`}
                                title="Toggle Sold / Active status"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                                {item.status === 'sold' ? 'Mark Active' : 'Mark Sold'}
                              </button>

                              <button
                                onClick={() => setEditingListing(item)}
                                className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl border border-purple-200 transition cursor-pointer"
                                title="Edit Listing Details"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {isOwner && (
                                <button
                                  onClick={() => handleToggleFeaturedStatus(item)}
                                  className={`p-2 rounded-xl border transition cursor-pointer ${
                                    item.featured
                                      ? 'bg-purple-600 text-white border-purple-600'
                                      : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                  }`}
                                  title={item.featured ? 'Remove from Featured' : 'Feature on Homepage'}
                                >
                                  <Flame className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 px-2 py-1 bg-purple-50/50 rounded-lg border border-purple-100 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-purple-600" />
                              Managed by Creator
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: USER MANAGEMENT */}
            {activeTab === 'users' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setUserRoleFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        userRoleFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All Users ({users.length})
                    </button>

                    <button
                      onClick={() => setUserRoleFilter('admin')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        userRoleFilter === 'admin' ? 'bg-rose-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Admins ({users.filter(u => u.role === 'admin').length})
                    </button>

                    <button
                      onClick={() => setUserRoleFilter('manager')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        userRoleFilter === 'manager' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Managers ({users.filter(u => u.role === 'manager').length})
                    </button>

                    <button
                      onClick={() => setUserRoleFilter('customer')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        userRoleFilter === 'customer' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Customers ({users.filter(u => (u.role || 'customer') === 'customer' || u.role === 'buyer' || u.role === 'seller').length})
                    </button>

                    <button
                      onClick={() => setUserRoleFilter('suspended')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        userRoleFilter === 'suspended' ? 'bg-rose-900 text-rose-200' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Suspended ({users.filter(u => u.status === 'suspended').length})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {loadingUsers ? (
                  <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Loading registered users from Firestore...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    No users found matching filter.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map((u) => (
                      <div
                        key={u.uid}
                        className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 hover:border-slate-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center font-extrabold text-sm uppercase shadow shrink-0">
                            {(u.displayName || u.email || 'U').charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-white text-sm">{u.displayName || 'Unnamed User'}</h4>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase border ${
                                u.role === 'admin'
                                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                                  : u.role === 'manager'
                                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}>
                                {u.role || 'customer'}
                              </span>

                              {u.status === 'suspended' && (
                                <span className="text-[10px] font-bold text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-900">
                                  Suspended
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{u.email} • UID: <code className="text-[10px] text-slate-500">{u.uid}</code></p>
                            <div className="flex items-center flex-wrap gap-2 text-xs mt-1.5">
                              <span className="bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-800/80 font-mono font-bold">
                                Wallet: ₦{(u.walletBalance || 0).toLocaleString()}
                              </span>
                              {isOwner && (
                                <button
                                  onClick={() => setActiveTab('wallets')}
                                  className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 rounded-md font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                                  title="Adjust user balance in Wallet Override Tool"
                                >
                                  <Wallet className="w-3 h-3 text-emerald-400" />
                                  <span>Override</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <select
                            value={u.role || 'buyer'}
                            onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as 'admin' | 'seller' | 'buyer')}
                            className="bg-slate-900 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 cursor-pointer"
                          >
                            <option value="buyer">Buyer Role</option>
                            <option value="seller">Seller Role</option>
                            <option value="admin">Admin Role</option>
                          </select>

                          <button
                            onClick={() => handleToggleUserSuspend(u)}
                            className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              u.status === 'suspended'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-rose-950/80 text-rose-400 border-rose-800/80'
                            }`}
                            title={u.status === 'suspended' ? 'Reactivate User' : 'Suspend User'}
                          >
                            {u.status === 'suspended' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u.uid)}
                            className="p-2 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800 transition cursor-pointer"
                            title="Delete User Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: MANAGE ADMINS (OWNER ONLY) */}
            {activeTab === 'admins' && isOwner && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-amber-950/80 via-purple-950/60 to-slate-950 p-4 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-extrabold text-sm flex items-center gap-2">
                        <span>Administrator Management</span>
                        <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">
                          OWNER CONTROL
                        </span>
                      </h3>
                      <p className="text-slate-300 text-xs mt-0.5">
                        Promote trusted buyers to Administrators or revoke Admin privileges. Only you (the site Owner) have authority over admins.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono text-amber-300 shrink-0">
                    Active Admins: <strong>{users.filter(u => u.role === 'admin' || u.role === 'owner' || isAuthorizedOwner(null, u)).length}</strong>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search users by Name, Email, or UID..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="text-slate-400 text-xs">
                    Showing {users.filter(u => 
                      !adminSearch || 
                      (u.displayName && u.displayName.toLowerCase().includes(adminSearch.toLowerCase())) ||
                      (u.email && u.email.toLowerCase().includes(adminSearch.toLowerCase())) ||
                      (u.uid && u.uid.toLowerCase().includes(adminSearch.toLowerCase()))
                    ).length} registered users
                  </div>
                </div>

                {/* Users List */}
                <div className="space-y-3">
                  {users
                    .filter(u => 
                      !adminSearch || 
                      (u.displayName && u.displayName.toLowerCase().includes(adminSearch.toLowerCase())) ||
                      (u.email && u.email.toLowerCase().includes(adminSearch.toLowerCase())) ||
                      (u.uid && u.uid.toLowerCase().includes(adminSearch.toLowerCase()))
                    )
                    .map((u) => {
                      const isThisOwner = isAuthorizedOwner(null, u) || u.role === 'owner';
                      const isThisAdmin = !isThisOwner && u.role === 'admin';

                      return (
                        <div
                          key={u.uid}
                          className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                            isThisOwner
                              ? 'bg-amber-950/20 border-amber-500/40'
                              : isThisAdmin
                              ? 'bg-rose-950/20 border-rose-500/30'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl font-black text-sm uppercase flex items-center justify-center shrink-0 border ${
                              isThisOwner
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : isThisAdmin
                                ? 'bg-rose-600 text-white border-rose-400'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}>
                              {(u.displayName || u.email || 'U').charAt(0)}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-white text-sm">
                                  {u.displayName || 'Unnamed Account'}
                                </h4>

                                {isThisOwner ? (
                                  <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">
                                    OWNER (Protected)
                                  </span>
                                ) : isThisAdmin ? (
                                  <span className="bg-rose-500 text-white font-black text-[9px] px-2 py-0.5 rounded uppercase">
                                    ADMINISTRATOR
                                  </span>
                                ) : (
                                  <span className="bg-slate-800 text-slate-300 font-bold text-[9px] px-2 py-0.5 rounded uppercase">
                                    BUYER
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-400 mt-0.5">
                                {u.email} • UID: <code className="text-[10px] text-slate-500">{u.uid}</code>
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {isThisOwner ? (
                              <span className="text-amber-400 text-xs font-bold bg-amber-950/80 border border-amber-800/80 px-3 py-1.5 rounded-xl">
                                Site Owner
                              </span>
                            ) : isThisAdmin ? (
                              <button
                                onClick={() => setAdminActionModal({ isOpen: true, targetUser: u, action: 'demote' })}
                                className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 hover:border-rose-500 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Remove Admin</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setAdminActionModal({ isOpen: true, targetUser: u, action: 'promote' })}
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:border-amber-400 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                                <span>Make Admin</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* TAB: WALLET OVERRIDE (OWNER ONLY) */}
            {activeTab === 'wallets' && isOwner && (
              <div className="flex-1 overflow-y-auto p-5">
                <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading wallet manager...</div>}>
                  <AdminWalletsView
                    user={user}
                    userProfile={userProfile}
                    onBackToMarketplace={() => setActiveTab('listings')}
                  />
                </React.Suspense>
              </div>
            )}

            {/* TAB 3: ORDERS & PAYMENTS (ESCROW MANAGEMENT) */}
            {activeTab === 'orders' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Completed Volume</span>
                    <p className="text-xl font-black text-emerald-400">₦{completedOrdersVolume.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500">{orders.filter(o => o.status === 'completed').length} finalized orders</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Escrow Funds Held</span>
                    <p className="text-xl font-black text-cyan-400">₦{escrowHoldingVolume.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500">{orders.filter(o => o.status === 'escrow_holding').length} active escrows</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Transactions</span>
                    <p className="text-xl font-black text-white">{orders.length}</p>
                    <p className="text-[11px] text-slate-500">Recorded order logs</p>
                  </div>
                </div>

                {/* Sub-Filters & Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setOrderStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        orderStatusFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All Orders ({orders.length})
                    </button>

                    <button
                      onClick={() => setOrderStatusFilter('escrow_holding')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        orderStatusFilter === 'escrow_holding' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Escrow Holding ({orders.filter(o => o.status === 'escrow_holding').length})
                    </button>

                    <button
                      onClick={() => setOrderStatusFilter('completed')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        orderStatusFilter === 'completed' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Completed ({orders.filter(o => o.status === 'completed').length})
                    </button>

                    <button
                      onClick={() => setOrderStatusFilter('disputed')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        orderStatusFilter === 'disputed' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Disputed ({orders.filter(o => o.status === 'disputed').length})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search txn ID, buyer, seller..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Orders Table */}
                {loadingOrders ? (
                  <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Loading purchase orders from Firestore...</span>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    No purchase records found matching filter.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 hover:border-slate-700 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                              TXN: {ord.transactionId || ord.id.substring(0, 10)}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase border ${
                              ord.status === 'completed'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : ord.status === 'disputed'
                                ? 'bg-rose-950 text-rose-300 border-rose-800'
                                : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                            }`}>
                              {ord.status === 'escrow_holding' ? 'Escrow Holding' : ord.status}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              via {ord.paymentGateway || 'Paystack'}
                            </span>
                          </div>

                          <h4 className="font-extrabold text-white text-sm">{ord.listingTitle}</h4>

                          <p className="text-xs text-slate-400">
                            Amount: <strong className="text-white">₦{Number(ord.price || 0).toLocaleString()}</strong> • Buyer:{' '}
                            <span className="text-slate-300">{ord.buyerName || ord.buyerEmail}</span> • Seller:{' '}
                            <span className="text-slate-300">{ord.sellerName || ord.sellerEmail}</span>
                          </p>

                          {ord.digitalProductDetails && (ord.digitalProductDetails.accountEmail || ord.digitalProductDetails.accountPassword || ord.digitalProductDetails.recoveryInfo) && (
                            <div className="mt-2 p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-[11px] space-y-1 font-mono text-slate-300">
                              <span className="text-[10px] text-cyan-400 font-extrabold uppercase font-sans flex items-center gap-1">
                                <KeyRound className="w-3 h-3" /> Private Digital Credentials (Admin Escrow Access)
                              </span>
                              {ord.digitalProductDetails.accountEmail && <div>Email: <strong className="text-white">{ord.digitalProductDetails.accountEmail}</strong></div>}
                              {ord.digitalProductDetails.accountPassword && <div>Password: <strong className="text-amber-300">{ord.digitalProductDetails.accountPassword}</strong></div>}
                              {ord.digitalProductDetails.recoveryInfo && <div>Recovery: <span className="text-slate-200">{ord.digitalProductDetails.recoveryInfo}</span></div>}
                              {ord.digitalProductDetails.backupCodes && <div>2FA Codes: <span className="text-slate-200">{ord.digitalProductDetails.backupCodes}</span></div>}
                              {ord.digitalProductDetails.additionalInstructions && <div className="font-sans text-[11px] text-slate-400 font-normal">Notes: {ord.digitalProductDetails.additionalInstructions}</div>}
                            </div>
                          )}
                        </div>

                        {/* Order Actions */}
                        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                          <select
                            value={ord.status}
                            onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value as any)}
                            className="bg-slate-900 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 cursor-pointer"
                          >
                            <option value="escrow_holding">Escrow Holding</option>
                            <option value="completed">Release / Completed</option>
                            <option value="disputed">Mark Disputed</option>
                          </select>

                          <button
                            onClick={() => handleDeleteOrder(ord.id)}
                            className="p-2 bg-rose-950/80 hover:bg-rose-900 text-rose-400 rounded-xl border border-rose-800/60 transition cursor-pointer"
                            title="Delete Order Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: WITHDRAWAL REQUESTS CENTER (OWNER & ADMIN) */}
            {activeTab === 'withdrawals' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Requests</span>
                    <p className="text-2xl font-black text-white">{withdrawalRequests.length}</p>
                    <span className="text-[10px] text-slate-500 font-semibold">All submitted payouts</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pending Payouts</span>
                    <p className="text-2xl font-black text-amber-400">
                      ₦{withdrawalRequests.filter(w => w.status === 'pending').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString()}
                    </p>
                    <span className="text-[10px] text-amber-500/80 font-semibold">
                      {withdrawalRequests.filter(w => w.status === 'pending').length} requests awaiting review
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Completed Payouts</span>
                    <p className="text-2xl font-black text-emerald-400">
                      ₦{withdrawalRequests.filter(w => w.status === 'completed').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString()}
                    </p>
                    <span className="text-[10px] text-emerald-500/80 font-semibold">
                      {withdrawalRequests.filter(w => w.status === 'completed').length} fulfilled transfers
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-[#A78BFA] uppercase tracking-wider">Total Volume</span>
                    <p className="text-2xl font-black text-[#DDD6FE]">
                      ₦{withdrawalRequests.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString()}
                    </p>
                    <span className="text-[10px] text-slate-500 font-semibold">Lifetime withdrawal requests</span>
                  </div>
                </div>

                {/* Section 1: Verify by Permanent Withdrawal ID */}
                <div className="bg-slate-950 p-4.5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#A78BFA]" />
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                      Verify User by Permanent Withdrawal ID
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400">
                    Query user records and legitimate withdrawal history directly from the database using their unique permanent ID.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={withdrawalSearchId}
                        onChange={(e) => {
                          setWithdrawalSearchId(e.target.value);
                          if (verifyIdError) setVerifyIdError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleVerifyWithdrawalId(withdrawalSearchId);
                          }
                        }}
                        placeholder="Enter Withdrawal ID (e.g. ZN-WID-4A82F1)"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-[#7C3AED] text-white text-xs font-mono font-bold pl-9 pr-4 py-2.5 rounded-xl outline-none transition"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleVerifyWithdrawalId(withdrawalSearchId)}
                      disabled={isVerifyingId || !withdrawalSearchId.trim()}
                      className="px-4 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {isVerifyingId ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verify ID</span>
                        </>
                      )}
                    </button>
                    {(verifiedWithdrawalUser || verifyIdError) && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifiedWithdrawalUser(null);
                          setVerifyIdError(null);
                          setWithdrawalSearchId('');
                        }}
                        className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Verification Error Notice */}
                  {verifyIdError && (
                    <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{verifyIdError}</span>
                    </div>
                  )}

                  {/* Verified User Details Card */}
                  {verifiedWithdrawalUser && (
                    <div className="p-4 bg-slate-900 border border-[#7C3AED]/40 rounded-xl space-y-3 animate-in zoom-in-95 duration-200">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                            <Check className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-white">
                                {verifiedWithdrawalUser.user.displayName}
                              </span>
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-black uppercase">
                                VERIFIED IDENTITY
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {verifiedWithdrawalUser.user.email}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Available Balance</span>
                          <span className="text-sm font-black text-emerald-400">
                            ₦{Number(verifiedWithdrawalUser.user.walletBalance || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">Permanent Withdrawal ID:</span>
                          <span className="font-mono font-black text-[#A78BFA]">{verifiedWithdrawalUser.user.withdrawalId}</span>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">User Role:</span>
                          <span className="font-black uppercase text-amber-400">{verifiedWithdrawalUser.user.role}</span>
                        </div>
                      </div>

                      {/* User's Verified Withdrawal Records */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                          Verified Withdrawal Records ({verifiedWithdrawalUser.withdrawals.length})
                        </span>
                        {verifiedWithdrawalUser.withdrawals.length === 0 ? (
                          <p className="text-xs text-slate-500 italic p-2 bg-slate-950 rounded-lg border border-slate-800">
                            No past withdrawal requests associated with this account.
                          </p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                            {verifiedWithdrawalUser.withdrawals.map((w) => (
                              <div key={w.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
                                <div>
                                  <span className="font-mono font-bold text-white block">{w.id}</span>
                                  <span className="text-[10px] text-slate-400">{w.createdDate} at {w.createdTime} • {w.bankName}</span>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <span className="font-black text-emerald-400">₦{w.amount.toLocaleString()}</span>
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    w.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                                    w.status === 'approved' ? 'bg-blue-500/20 text-blue-300' :
                                    w.status === 'rejected' ? 'bg-rose-500/20 text-rose-300' :
                                    'bg-amber-500/20 text-amber-300'
                                  }`}>
                                    {w.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Live Withdrawal Requests List */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="w-4 h-4 text-[#A78BFA]" />
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Live Payout Requests ({withdrawalRequests.length})
                      </h4>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {(['all', 'pending', 'approved', 'completed', 'rejected'] as const).map((filterKey) => (
                        <button
                          key={filterKey}
                          type="button"
                          onClick={() => setWithdrawalFilter(filterKey)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold capitalize transition cursor-pointer ${
                            withdrawalFilter === filterKey
                              ? 'bg-[#7C3AED] text-white shadow-xs'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {filterKey} ({filterKey === 'all' ? withdrawalRequests.length : withdrawalRequests.filter(w => w.status === filterKey).length})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* List Container */}
                  {loadingWithdrawals ? (
                    <div className="py-12 text-center text-xs text-slate-400 font-semibold space-y-2">
                      <div className="w-6 h-6 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin mx-auto"></div>
                      <p>Loading real-time withdrawal requests...</p>
                    </div>
                  ) : withdrawalRequests.filter(w => withdrawalFilter === 'all' || w.status === withdrawalFilter).length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                      <p className="font-bold">No withdrawal requests found matching '{withdrawalFilter}'.</p>
                      <p className="text-[11px] text-slate-600">New requests submitted by owners/admins will update live here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {withdrawalRequests
                        .filter(w => withdrawalFilter === 'all' || w.status === withdrawalFilter)
                        .map((w) => {
                          const isProcessing = updatingWithdrawalId === w.id;
                          return (
                            <div
                              key={w.id}
                              className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-3 transition"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2.5">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-black text-white">{w.id}</span>
                                    <span className="text-[10px] font-mono text-[#A78BFA] bg-purple-950/60 px-2 py-0.5 rounded border border-purple-900/60">
                                      ID: {w.withdrawalId}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span className="font-bold text-slate-300">{w.userName}</span>
                                    <span>•</span>
                                    <span className="font-mono text-[11px]">{w.userEmail}</span>
                                  </div>
                                </div>

                                <div className="text-right flex items-center gap-3">
                                  <div className="text-right">
                                    <span className="text-base font-black text-emerald-400 block">
                                      ₦{w.amount.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      {w.createdDate} at {w.createdTime}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                    w.status === 'completed' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' :
                                    w.status === 'approved' ? 'bg-blue-950/80 text-blue-400 border-blue-800' :
                                    w.status === 'rejected' ? 'bg-rose-950/80 text-rose-400 border-rose-800' :
                                    'bg-amber-950/80 text-amber-400 border-amber-800'
                                  }`}>
                                    {w.status}
                                  </span>
                                </div>
                              </div>

                              {/* Bank Destination Details */}
                              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Bank Name</span>
                                  <span className="font-bold text-slate-200">{w.bankName}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Account Number</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-white">{w.accountNumber}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(w.accountNumber)}
                                      className="text-slate-400 hover:text-white transition"
                                      title="Copy Account Number"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Account Name</span>
                                  <span className="font-bold text-slate-200">{w.accountName}</span>
                                </div>
                              </div>

                              {w.notes && (
                                <p className="text-[11px] text-slate-400 italic">
                                  <span className="font-semibold text-slate-500">User note:</span> {w.notes}
                                </p>
                              )}

                              {w.adminNotes && (
                                <div className="p-2 bg-rose-950/40 border border-rose-900/50 rounded-lg text-[11px] text-rose-300">
                                  <span className="font-bold">Rejection note:</span> {w.adminNotes}
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-900">
                                {w.status === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleUpdateWithdrawalStatus(w.id, 'approved')}
                                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 text-xs font-bold rounded-xl transition cursor-pointer"
                                    >
                                      Approve Payout
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleUpdateWithdrawalStatus(w.id, 'completed')}
                                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer shadow-sm"
                                    >
                                      Mark Completed
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleUpdateWithdrawalStatus(w.id, 'rejected')}
                                      className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border border-rose-800 text-xs font-bold rounded-xl transition cursor-pointer"
                                    >
                                      Reject & Refund
                                    </button>
                                  </>
                                )}

                                {w.status === 'approved' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleUpdateWithdrawalStatus(w.id, 'completed')}
                                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer shadow-sm"
                                    >
                                      Mark Completed
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleUpdateWithdrawalStatus(w.id, 'rejected')}
                                      className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border border-rose-800 text-xs font-bold rounded-xl transition cursor-pointer"
                                    >
                                      Reject & Refund
                                    </button>
                                  </>
                                )}

                                {(w.status === 'completed' || w.status === 'rejected') && (
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    Processed on {w.updatedAt ? new Date(w.updatedAt).toLocaleDateString() : w.createdDate}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: INQUIRIES & REPORTS MANAGEMENT */}
            {activeTab === 'inquiries_reports' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Sub-tab Navigation */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInquirySubTab('inquiries')}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
                        inquirySubTab === 'inquiries' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Buyer Inquiries ({inquiries.length})</span>
                    </button>

                    <button
                      onClick={() => setInquirySubTab('reports')}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
                        inquirySubTab === 'reports' ? 'bg-rose-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Flag className="w-4 h-4" />
                      <span>Flagged Reports ({reports.length})</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Tab 1: Buyer Inquiries */}
                {inquirySubTab === 'inquiries' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <button
                          onClick={() => setInquiryStatusFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            inquiryStatusFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          All ({inquiries.length})
                        </button>

                        <button
                          onClick={() => setInquiryStatusFilter('unread')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            inquiryStatusFilter === 'unread' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Unread ({inquiries.filter(i => i.status === 'unread').length})
                        </button>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search message, buyer..."
                          value={inquirySearch}
                          onChange={(e) => setInquirySearch(e.target.value)}
                          className="w-full bg-slate-900 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {loadingInquiries ? (
                      <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                        <span>Loading inquiries...</span>
                      </div>
                    ) : filteredInquiries.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-sm">
                        No buyer inquiries found.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredInquiries.map((inq) => (
                          <div
                            key={inq.id}
                            className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-white text-xs">{inq.buyerName}</span>
                                <span className="text-[11px] text-slate-400">({inq.buyerEmail})</span>
                                <span className="text-[10px] text-slate-500">• {new Date(inq.createdAt || 0).toLocaleDateString()}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                                  inq.status === 'unread'
                                    ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {inq.status}
                                </span>

                                <button
                                  onClick={() => setReplyingInquiry(inq)}
                                  className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-[11px] font-bold rounded-lg border border-cyan-800 transition cursor-pointer flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  Reply
                                </button>

                                <button
                                  onClick={() => handleToggleInquiryRead(inq.id, inq.status)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold rounded-lg border border-slate-800 transition cursor-pointer"
                                >
                                  Toggle Read
                                </button>

                                <button
                                  onClick={() => handleDeleteInquiry(inq.id)}
                                  className="p-1.5 text-rose-400 hover:bg-rose-950 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-cyan-400 mb-1">
                                Listing: {inq.listingTitle}
                              </p>
                              <p className="text-xs text-slate-200 bg-slate-900/80 p-3 rounded-xl border border-slate-800/60 leading-relaxed whitespace-pre-line">
                                {inq.message}
                              </p>
                              {inq.replyMessage && (
                                <div className="mt-2 text-xs text-cyan-300 bg-cyan-950/40 p-3 rounded-xl border border-cyan-800/40">
                                  <strong>Admin Reply:</strong> {inq.replyMessage}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-Tab 2: Flagged Abuse Reports */}
                {inquirySubTab === 'reports' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <button
                          onClick={() => setReportStatusFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            reportStatusFilter === 'all' ? 'bg-rose-500 text-slate-950' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          All Reports ({reports.length})
                        </button>

                        <button
                          onClick={() => setReportStatusFilter('pending')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            reportStatusFilter === 'pending' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Pending ({reports.filter(r => r.status === 'pending').length})
                        </button>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search report reason, reporter..."
                          value={reportSearch}
                          onChange={(e) => setReportSearch(e.target.value)}
                          className="w-full bg-slate-900 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    {loadingReports ? (
                      <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                        <span>Loading reports from Firestore...</span>
                      </div>
                    ) : filteredReports.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-sm">
                        No flagged reports found.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredReports.map((rep) => (
                          <div
                            key={rep.id}
                            className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2">
                              <div>
                                <span className="text-xs font-extrabold text-rose-400 block">{rep.reason}</span>
                                <span className="text-[11px] text-slate-400">
                                  Target: <strong>{rep.targetTitle}</strong> ({rep.targetType}) • Reported by: {rep.reporterName || rep.reporterEmail}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <select
                                  value={rep.status}
                                  onChange={(e) => handleUpdateReportStatus(rep.id, e.target.value as any)}
                                  className="bg-slate-900 text-slate-200 text-xs font-bold px-3 py-1 rounded-xl border border-slate-800 focus:outline-none focus:border-rose-500 cursor-pointer"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="investigating">Investigating</option>
                                  <option value="resolved">Resolved</option>
                                  <option value="dismissed">Dismissed</option>
                                </select>

                                <button
                                  onClick={() => handleDeleteReport(rep.id)}
                                  className="p-1.5 text-rose-400 hover:bg-rose-950 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-slate-200 bg-slate-900/80 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
                              {rep.details}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: REVIEWS & SELLER RATINGS */}
            {activeTab === 'reviews' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span>Seller Reviews & Moderation</span>
                  </h3>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search reviews..."
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {loadingReviews ? (
                  <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Loading seller reviews...</span>
                  </div>
                ) : filteredReviews.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    No seller reviews recorded in Firestore.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredReviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-xs">{rev.reviewerName}</span>
                            <div className="flex items-center text-amber-400">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-500">• {new Date(rev.createdAt || 0).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                            {rev.comment}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDeleteReview(rev.id)}
                          className="p-2 bg-rose-950/80 hover:bg-rose-900 text-rose-400 rounded-xl border border-rose-800/60 transition cursor-pointer shrink-0 self-end sm:self-center"
                          title="Delete Spam Review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: MARKETPLACE ANALYTICS & STATISTICS */}
            {activeTab === 'analytics' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Executive Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-bold uppercase tracking-wider">Gross Inventory GMV</span>
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-white">₦{totalGMV.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400">Total listed account value across all statuses</p>
                  </div>

                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-bold uppercase tracking-wider">Completed Sales GMV</span>
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-2xl font-black text-cyan-400">₦{soldGMV.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400">Total volume of accounts marked as sold out</p>
                  </div>

                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-bold uppercase tracking-wider">Total Buyer Inquiries</span>
                      <MessageSquare className="w-4 h-4 text-indigo-400" />
                    </div>
                    <p className="text-2xl font-black text-indigo-300">{inquiries.length}</p>
                    <p className="text-[11px] text-slate-400">Direct lead conversions generated</p>
                  </div>
                </div>

                {/* Distribution Charts & Progress Bars */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Category Breakdown */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-cyan-400" />
                      <span>Category Distribution</span>
                    </h3>

                    <div className="space-y-3">
                      {categoryCounts.map((cat) => {
                        const pct = listings.length > 0 ? Math.round((cat.count / listings.length) * 100) : 0;
                        return (
                          <div key={cat.name} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-300">{cat.name} Accounts</span>
                              <span className="text-slate-400">{cat.count} listings ({pct}%)</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Security Specs Breakdown */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Security & Verification Ratio</span>
                    </h3>

                    <div className="space-y-4 text-xs">
                      <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-300 font-semibold">Phone Verified (PVA)</span>
                        <span className="font-extrabold text-emerald-400">
                          {listings.filter(l => l.pva).length} / {listings.length} Listings
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-300 font-semibold">2FA Security Enabled</span>
                        <span className="font-extrabold text-indigo-400">
                          {listings.filter(l => l.twoFactor).length} / {listings.length} Listings
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-300 font-semibold">Monetized / Creator Revenue</span>
                        <span className="font-extrabold text-amber-400">
                          {listings.filter(l => l.monetized).length} / {listings.length} Listings
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 7: TIKTOK PROMOTION RATES & LIMITS CONFIGURATION */}
            {activeTab === 'tiktok_services' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      <span>Social Boost Rates & Limits Controls</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure live price per 1,000 units, minimum & maximum order quantities, and active/paused service status for each TikTok service.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveTikTokServices}
                    disabled={isSavingTikTokServices}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs px-5 py-2.5 rounded-xl transition cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {isSavingTikTokServices ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{isSavingTikTokServices ? 'Saving...' : 'Save Service Rates'}</span>
                  </button>
                </div>

                {tikTokSaveSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Social Boost service rates and limits updated successfully in database!</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tikTokServices.map((svc, idx) => (
                    <div key={`${svc.id}-${idx}`} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-white text-sm">{svc.name}</h4>
                          <span className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider block">
                            Target: {svc.targetType === 'profile_url' ? 'Profile URL' : 'Video URL'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTikTokServices((prev) =>
                              prev.map((s) => s.id === svc.id ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s)
                            );
                          }}
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border transition cursor-pointer ${
                            svc.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {svc.status}
                        </button>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            Price per 1,000 Units (₦)
                          </label>
                          <input
                            type="number"
                            value={svc.pricePer1k}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setTikTokServices((prev) =>
                                prev.map((s) => s.id === svc.id ? { ...s, pricePer1k: val } : s)
                              );
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                              Min Quantity
                            </label>
                            <input
                              type="number"
                              value={svc.minQuantity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setTikTokServices((prev) =>
                                  prev.map((s) => s.id === svc.id ? { ...s, minQuantity: val } : s)
                                );
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                              Max Quantity
                            </label>
                            <input
                              type="number"
                              value={svc.maxQuantity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setTikTokServices((prev) =>
                                  prev.map((s) => s.id === svc.id ? { ...s, maxQuantity: val } : s)
                                );
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* EDIT LISTING OVERLAY MODAL */}
      {editingListing && (
        <AdminEditListingModal
          listing={editingListing}
          onClose={() => setEditingListing(null)}
          onSave={handleSaveListingEdits}
        />
      )}

      {/* REPLY TO INQUIRY OVERLAY MODAL */}
      {replyingInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                <span>Reply to Buyer Inquiry</span>
              </h3>
              <button
                onClick={() => setReplyingInquiry(null)}
                className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-400">To: <strong className="text-white">{replyingInquiry.buyerName} ({replyingInquiry.buyerEmail})</strong></p>
              <p className="text-slate-400">Regarding: <strong className="text-cyan-400">{replyingInquiry.listingTitle}</strong></p>
            </div>

            <form onSubmit={handleSendInquiryReply} className="space-y-3">
              <textarea
                rows={4}
                placeholder="Type administrator reply to buyer..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                className="w-full bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReplyingInquiry(null)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg"
                >
                  Send Reply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROMOTE / DEMOTE ADMIN CONFIRMATION MODAL */}
      {adminActionModal && adminActionModal.isOpen && adminActionModal.targetUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-5 shadow-2xl text-center">
            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${
              adminActionModal.action === 'promote'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="font-extrabold text-white text-lg">
                {adminActionModal.action === 'promote'
                  ? 'Make this user an Administrator?'
                  : 'Remove administrator access from this user?'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {adminActionModal.action === 'promote'
                  ? `This will grant ${adminActionModal.targetUser.displayName || adminActionModal.targetUser.email} access to authorized marketplace management functions.`
                  : `This will revoke admin privileges from ${adminActionModal.targetUser.displayName || adminActionModal.targetUser.email} and set their role back to Buyer.`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessingRole}
                onClick={() => setAdminActionModal(null)}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingRole}
                onClick={handleConfirmRoleChange}
                className={`py-3 px-4 text-white rounded-xl font-extrabold text-xs shadow-lg cursor-pointer transition flex items-center justify-center gap-2 ${
                  adminActionModal.action === 'promote'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {isProcessingRole ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Confirm Action</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
