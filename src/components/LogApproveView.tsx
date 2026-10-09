import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDocs, 
  getDoc 
} from 'firebase/firestore';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  Edit3, 
  Save, 
  X, 
  Copy, 
  Check, 
  User as UserIcon, 
  Calendar, 
  Tag, 
  Layers, 
  RefreshCw,
  AlertCircle,
  KeyRound,
  FileText,
  ChevronRight,
  Package,
  Info
} from 'lucide-react';
import { db, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch } from '../utils/api';
import { AccountListing, StockApprovalRecord, UserProfile, InventoryAccountItem } from '../types';

interface LogApproveViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  onBack: () => void;
  onListingUpdated?: (listing: AccountListing) => void;
}

export const LogApproveView: React.FC<LogApproveViewProps> = ({
  user,
  userProfile,
  onBack,
  onListingUpdated
}) => {
  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed'>('pending');
  const [pendingListings, setPendingListings] = useState<AccountListing[]>([]);
  const [confirmedApprovals, setConfirmedApprovals] = useState<StockApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Detailed Review Screen State (When Owner taps a pending submission or Review button)
  const [selectedReviewListing, setSelectedReviewListing] = useState<AccountListing | null>(null);
  const [inspectedInventory, setInspectedInventory] = useState<Record<string, InventoryAccountItem[]>>({});
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Price & Details Editing State
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Confirmation Modal for APPROVE
  const [confirmingApproveListing, setConfirmingApproveListing] = useState<AccountListing | null>(null);

  // Rejection Dialog State
  const [rejectingListing, setRejectingListing] = useState<AccountListing | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Status Alerts
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Real-time Firestore Listener: Pending Submissions
  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const q = query(
      collection(db, 'listings'),
      where('approvalStatus', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AccountListing[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<AccountListing, 'id'>)
      }));

      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPendingListings(items);
      setLoading(false);
    }, (err) => {
      console.warn('Pending listings listener notice:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore Listener: Confirmed Approvals
  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(db, 'stock_approvals'),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: StockApprovalRecord[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<StockApprovalRecord, 'id'>)
      }));

      items.sort((a, b) => new Date(b.reviewedAt || b.submittedAt).getTime() - new Date(a.reviewedAt || a.submittedAt).getTime());
      setConfirmedApprovals(items);
    }, (err) => {
      console.warn('Confirmed approvals listener notice:', err);
    });

    return () => unsubscribe();
  }, []);

  // When a listing is opened for review, fetch its inventory items automatically
  useEffect(() => {
    if (!selectedReviewListing) return;
    loadInventoryAccounts(selectedReviewListing);
  }, [selectedReviewListing?.id]);

  const loadInventoryAccounts = async (listing: AccountListing) => {
    if (inspectedInventory[listing.id] && inspectedInventory[listing.id].length > 0) {
      return;
    }

    setLoadingInventory(true);
    try {
      const token = user ? await getSafeIdToken(user) : null;
      // Fetch via server endpoint to load credentials from secure subcollection
      const res = await safeApiFetch(`/api/stock/inventory/${listing.id}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (res && res.success && Array.isArray(res.items) && res.items.length > 0) {
        setInspectedInventory((prev) => ({ ...prev, [listing.id]: res.items }));
      } else if (Array.isArray(listing.inventory) && listing.inventory.length > 0) {
        setInspectedInventory((prev) => ({ ...prev, [listing.id]: listing.inventory! }));
      } else if (db) {
        // Fallback: direct query
        const colRef = collection(db, 'listings', listing.id, 'inventory');
        const snap = await getDocs(colRef);
        const docs = await Promise.all(snap.docs.map(async (d) => {
          const item = d.data();
          try {
            const sec = await getDoc(doc(db, 'listings', listing.id, 'inventory', d.id, 'secure', 'details'));
            if (sec.exists()) return { id: d.id, ...item, ...sec.data() };
          } catch {}
          return { id: d.id, ...item };
        }));
        setInspectedInventory((prev) => ({ ...prev, [listing.id]: docs as any }));
      }
    } catch (err) {
      console.warn('Error loading stock inventory details:', err);
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Open Edit Price / Details
  const handleStartEditPrice = (listing: AccountListing) => {
    setIsEditingPrice(true);
    setEditPrice(String(listing.price || 0));
    setEditTitle(listing.title || '');
  };

  // Save Price & Details to Database
  const handleSavePriceEdit = async () => {
    if (!selectedReviewListing) return;
    const numPrice = Number(editPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      setActionError('Please enter a valid price amount');
      return;
    }

    setIsSavingEdit(true);
    setActionError(null);
    try {
      const token = user ? await getSafeIdToken(user) : null;
      const res = await safeApiFetch('/api/stock/update-pending-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          listingId: selectedReviewListing.id,
          price: numPrice,
          title: editTitle.trim() || selectedReviewListing.title
        })
      });

      if (res && res.success) {
        setActionSuccess(`Price for "${selectedReviewListing.title}" updated to ₦${numPrice.toLocaleString()}`);
        const updated = { 
          ...selectedReviewListing, 
          price: numPrice, 
          title: editTitle.trim() || selectedReviewListing.title 
        };
        setSelectedReviewListing(updated);
        setPendingListings(prev => prev.map(l => l.id === updated.id ? updated : l));
        if (onListingUpdated) onListingUpdated(updated);
        setIsEditingPrice(false);
      } else {
        setActionError(res?.error || 'Failed to update listing details');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error updating price');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Execute Owner Approval (Server-side enforced)
  const handleConfirmApprove = async () => {
    if (!confirmingApproveListing) return;
    const listing = confirmingApproveListing;

    setIsProcessingAction(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const token = user ? await getSafeIdToken(user) : null;
      const res = await safeApiFetch('/api/stock/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          listingId: listing.id,
          approvedPrice: listing.price
        })
      });

      if (res && res.success) {
        setActionSuccess(`Approved! "${listing.title}" is now active and available on Zenet Hub.`);
        // Remove from pending locally
        setPendingListings(prev => prev.filter(l => l.id !== listing.id));
        if (onListingUpdated) {
          onListingUpdated({ ...listing, approvalStatus: 'approved', status: 'active' });
        }
        setConfirmingApproveListing(null);
        setSelectedReviewListing(null);
      } else {
        setActionError(res?.error || 'Server error approving stock');
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error approving stock');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Execute Owner Rejection (Server-side enforced with custom reason)
  const handleConfirmReject = async () => {
    if (!rejectingListing) return;
    if (!rejectionReason.trim()) {
      setActionError('Please provide a reason for rejecting this stock submission.');
      return;
    }

    setIsProcessingAction(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const token = user ? await getSafeIdToken(user) : null;
      const res = await safeApiFetch('/api/stock/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          listingId: rejectingListing.id,
          rejectionReason: rejectionReason.trim()
        })
      });

      if (res && res.success) {
        setActionSuccess(`Rejected: Stock submission rejected and submitter was notified.`);
        // Remove from pending locally
        setPendingListings(prev => prev.filter(l => l.id !== rejectingListing.id));
        if (onListingUpdated) {
          onListingUpdated({ ...rejectingListing, approvalStatus: 'rejected', rejectionReason: rejectionReason.trim() });
        }
        setRejectingListing(null);
        setRejectionReason('');
        setSelectedReviewListing(null);
      } else {
        setActionError(res?.error || 'Failed to reject stock');
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error rejecting stock');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  // ==========================================================================
  // VIEW B: DETAILED REVIEW SCREEN (When a pending submission is opened)
  // ==========================================================================
  if (selectedReviewListing) {
    const listing = selectedReviewListing;
    const accounts = inspectedInventory[listing.id] || (Array.isArray(listing.inventory) ? listing.inventory : []);
    const stockQty = Number(listing.stockCount || listing.stock || (accounts.length > 0 ? accounts.length : 1));

    return (
      <div className="w-full min-h-[100dvh] bg-[#FAF8FE] flex flex-col pb-36 sm:pb-32 animate-in fade-in duration-150">
        
        {/* Top Header */}
        <div className="bg-white border-b border-[#F1EEF9] sticky top-0 z-30 px-3 sm:px-6 py-3.5 shadow-2xs">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setSelectedReviewListing(null);
                setIsEditingPrice(false);
              }}
              className="p-2 -ml-1 text-[#0F172A] hover:text-[#5B4DF5] rounded-xl hover:bg-slate-100 transition cursor-pointer flex items-center gap-1.5 font-bold text-xs"
            >
              <ArrowLeft className="w-5 h-5 text-[#0F172A]" />
              <span>Back to Pending List</span>
            </button>

            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Pending Approval</span>
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 space-y-4">
          
          {/* Action Alerts */}
          {actionSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="flex-1">{actionSuccess}</span>
              <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {actionError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="flex-1">{actionError}</span>
              <button type="button" onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 1. Main Overview Card */}
          <div className="bg-white rounded-3xl border border-[#EAE6F8] shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-black uppercase text-[#5B4DF5] bg-[#EDE9FE] px-2.5 py-0.5 rounded-lg border border-[#DDD6FE]">
                  {listing.category}
                </span>
                <h2 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
                  {listing.title}
                </h2>
              </div>

              {/* Price with Review / Edit Option */}
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">Submitted Price</span>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-xl font-black text-emerald-600 font-mono">
                    ₦{Number(listing.price).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStartEditPrice(listing)}
                    className="p-1 rounded-lg text-[#5B4DF5] hover:bg-[#EDE9FE] transition cursor-pointer"
                    title="Edit Price before Approval"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Price Edit Box if open */}
            {isEditingPrice && (
              <div className="p-3.5 rounded-2xl bg-[#FAF8FE] border border-[#DDD6FE] space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F172A]">Edit Listing Price / Title</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingPrice(false)}
                    className="text-xs text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] block mb-1">Price (₦)</label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#DDD6FE] bg-white font-mono font-bold text-xs focus:outline-[#5B4DF5]"
                      placeholder="e.g. 5000"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] block mb-1">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#DDD6FE] bg-white font-bold text-xs focus:outline-[#5B4DF5]"
                      placeholder="Listing Title"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePriceEdit}
                  disabled={isSavingEdit}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? 'Saving...' : 'Save Updated Price'}</span>
                </button>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#F1EEF9] text-xs">
              <div className="space-y-0.5">
                <span className="text-[#64748B] font-semibold text-[11px]">Submitter:</span>
                <p className="font-extrabold text-[#0F172A] truncate">
                  {listing.sellerName || 'Seller'}
                </p>
                <p className="text-[10px] text-[#64748B] font-mono truncate">
                  {listing.sellerEmail || listing.sellerId}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[#64748B] font-semibold text-[11px]">Stock Quantity:</span>
                <p className="font-black text-[#5B4DF5]">
                  {stockQty} {stockQty === 1 ? 'item' : 'items'}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  Platform: {listing.country || 'Global'}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[#64748B] font-semibold text-[11px]">Submitted At:</span>
                <p className="font-bold text-[#0F172A]">
                  {formatDate(listing.createdAt)}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  Warranty: {listing.warrantyDays || 7} days
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[#64748B] font-semibold text-[11px]">Listing ID:</span>
                <p className="font-mono text-[10px] text-[#64748B] truncate">
                  {listing.id}
                </p>
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {listing.pva && (
                    <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                      PVA
                    </span>
                  )}
                  {listing.twoFactor && (
                    <span className="text-[9px] font-extrabold bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                      2FA
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {listing.description && (
              <div className="p-3.5 bg-[#FAF8FE] rounded-2xl text-xs space-y-1 border border-[#F1EEF9]">
                <span className="font-bold text-[#64748B] block text-[11px]">Listing Description / Notes:</span>
                <p className="text-[#334155] whitespace-pre-wrap">{listing.description}</p>
              </div>
            )}
          </div>

          {/* 2. Submitted Stock Accounts Inspection Section */}
          <div className="bg-white rounded-3xl border border-[#EAE6F8] shadow-sm p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1EEF9]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center">
                  <KeyRound className="w-4 h-4 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#0F172A]">
                    Inspect Stock Accounts ({accounts.length})
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Review all submitted login credentials before making an approval decision
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                Owner Eyes Only
              </span>
            </div>

            {loadingInventory ? (
              <div className="py-10 text-center text-xs text-[#64748B] flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#5B4DF5]" />
                <span>Loading submitted accounts from secure database...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#64748B] bg-slate-50 rounded-2xl space-y-1">
                <p className="font-semibold text-slate-700">Single Account Listing</p>
                {listing.digitalProductDetails?.username ? (
                  <div className="text-left bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 mt-2">
                    <p><strong>Username / Email:</strong> {listing.digitalProductDetails.username}</p>
                    <p><strong>Password:</strong> {listing.digitalProductDetails.password || 'N/A'}</p>
                    {listing.digitalProductDetails.additionalInfo && (
                      <p><strong>Info:</strong> {listing.digitalProductDetails.additionalInfo}</p>
                    )}
                  </div>
                ) : (
                  <p>Credentials will be generated or delivered upon customer purchase.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((acc: any, idx: number) => {
                  const passVisible = visiblePasswords[acc.id || idx];
                  const username = acc.accountEmail || acc.username || acc.email || 'N/A';
                  const password = acc.accountPassword || acc.password || 'N/A';
                  const backupCodes = acc.twoFactorCode || acc.twoFactorSecret || acc.backupCodes || acc.twoFactorSecretKey || '';
                  const recovery = acc.recoveryEmail || acc.recoveryInfo || '';

                  return (
                    <div 
                      key={acc.id || idx}
                      className="p-3.5 rounded-2xl bg-[#FAF8FE] border border-[#EAE6F8] space-y-2.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-[#5B4DF5] text-xs flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" />
                          <span>Stock Account #{idx + 1}</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                          {acc.status || 'available'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Username/Email */}
                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#EAE6F8]">
                          <span className="text-[#64748B] text-[11px] font-semibold">User/Email:</span>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-[#0F172A]">
                            <span className="truncate max-w-[150px]">{username}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(username, `u-${idx}`)}
                              className="text-[#5B4DF5] hover:text-[#4838EE] p-1 cursor-pointer"
                              title="Copy username"
                            >
                              {copiedKey === `u-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Password */}
                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#EAE6F8]">
                          <span className="text-[#64748B] text-[11px] font-semibold">Password:</span>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-[#0F172A]">
                            <span>{passVisible ? password : '••••••••'}</span>
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords(p => ({ ...p, [acc.id || idx]: !p[acc.id || idx] }))}
                              className="text-[#64748B] hover:text-[#0F172A] p-1 cursor-pointer"
                              title={passVisible ? 'Hide password' : 'Show password'}
                            >
                              {passVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(password, `p-${idx}`)}
                              className="text-[#5B4DF5] hover:text-[#4838EE] p-1 cursor-pointer"
                              title="Copy password"
                            >
                              {copiedKey === `p-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 2FA / Recovery / Notes */}
                      {(backupCodes || recovery || acc.notes || acc.additionalInstructions) && (
                        <div className="pt-2 text-[11px] text-[#64748B] space-y-1 border-t border-[#F1EEF9]">
                          {backupCodes && (
                            <p className="flex items-center justify-between">
                              <span><strong>2FA / Backup:</strong> <span className="font-mono text-[#0F172A]">{backupCodes}</span></span>
                              <button
                                type="button"
                                onClick={() => handleCopy(backupCodes, `b-${idx}`)}
                                className="text-[#5B4DF5] text-[10px] font-bold cursor-pointer"
                              >
                                {copiedKey === `b-${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </p>
                          )}
                          {recovery && <p><strong>Recovery Email:</strong> <span className="font-mono text-[#0F172A]">{recovery}</span></p>}
                          {acc.notes && <p><strong>Notes:</strong> {acc.notes}</p>}
                          {acc.additionalInstructions && <p><strong>Instructions:</strong> {acc.additionalInstructions}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ACTION SECTION: Placed directly right here at the bottom of the Inspect Stock Accounts section ("Put it here") */}
            <div className="pt-4 mt-3 border-t border-[#F1EEF9] dark:border-[#2c1850] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-[#0F172A] dark:text-[#FAF8FE] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#5B4DF5]" />
                    <span>Inspection Decision & Approval</span>
                  </h4>
                  <p className="text-[11px] text-[#64748B] dark:text-[#a594c9]">
                    Confirm and approve this stock to make it active, or keep it pending in queue.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {/* 1. KEEP AS PENDING BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReviewListing(null);
                    setIsEditingPrice(false);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl border border-slate-200 dark:border-[#381e64] bg-slate-100 hover:bg-slate-200 dark:bg-[#1e123b] text-slate-700 dark:text-[#ddd6fe] font-extrabold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-xs min-h-[48px]"
                  title="Close review and keep this listing in pending status"
                >
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Keep as Pending</span>
                </button>

                {/* 2. REJECT BUTTON */}
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => {
                    setRejectingListing(listing);
                    setRejectionReason('');
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-extrabold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
                >
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Reject Stock</span>
                </button>

                {/* 3. CONFIRM & APPROVE BUTTON */}
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => setConfirmingApproveListing(listing)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Confirm & Approve</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Bottom Sticky Action Bar: REJECT and APPROVE (Elevated with safe-area support) */}
        <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-[#110a24] border-t border-[#F1EEF9] dark:border-[#2c1850] px-3 sm:px-4 pt-3 pb-[max(env(safe-area-inset-bottom,0px),0.875rem)] shadow-[0_-4px_25px_rgba(0,0,0,0.35)]">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedReviewListing(null);
                setIsEditingPrice(false);
              }}
              className="px-3 sm:px-4 py-3 rounded-2xl border border-slate-200 dark:border-[#381e64] bg-slate-100 hover:bg-slate-200 dark:bg-[#1e123b] text-slate-700 dark:text-[#ddd6fe] font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 min-h-[46px]"
              title="Close review and keep this listing in pending status"
            >
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Keep as Pending</span>
            </button>

            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              {/* REJECT BUTTON */}
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => {
                  setRejectingListing(listing);
                  setRejectionReason('');
                }}
                className="px-3 sm:px-5 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-extrabold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 min-h-[46px]"
              >
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Reject</span>
              </button>

              {/* APPROVE BUTTON */}
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setConfirmingApproveListing(listing)}
                className="flex-1 sm:flex-initial px-4 sm:px-7 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 min-h-[46px] whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Confirm & Approve</span>
              </button>
            </div>
          </div>
        </div>

        {/* MODAL: Confirmation Dialog for APPROVE */}
        {confirmingApproveListing && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 border border-[#EAE6F8] shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 stroke-[2.4]" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base sm:text-lg font-black text-[#0F172A]">
                  Approve this stock?
                </h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Once approved, this stock will become active and available according to the existing marketplace rules.
                </p>
                <p className="text-xs font-bold text-emerald-700 font-mono pt-1">
                  ₦{Number(confirmingApproveListing.price).toLocaleString()} • {confirmingApproveListing.title}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => setConfirmingApproveListing(null)}
                  className="w-full py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={handleConfirmApprove}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isProcessingAction ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Approving...</span>
                    </>
                  ) : (
                    <span>Approve Stock</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Rejection Dialog for REJECT */}
        {rejectingListing && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 border border-[#EAE6F8] shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7 stroke-[2.4]" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base sm:text-lg font-black text-[#0F172A]">
                  Reject Stock
                </h3>
                <p className="text-xs text-[#64748B]">
                  Please enter a reason for rejecting this stock submission. The submitter will receive a notification containing this reason.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[#0F172A] uppercase block">
                  Reason for rejection <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Invalid credentials, wrong category, or price correction needed..."
                  className="w-full p-3 rounded-2xl border border-rose-200 bg-rose-50/20 text-xs font-semibold focus:outline-rose-500 placeholder:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => {
                    setRejectingListing(null);
                    setRejectionReason('');
                  }}
                  className="w-full py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction || !rejectionReason.trim()}
                  onClick={handleConfirmReject}
                  className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-600/25 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isProcessingAction ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <span>Reject Stock</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ==========================================================================
  // VIEW A: MAIN STOCK APPROVAL CENTER (Tabs: Pending Approval & Confirmed Logs)
  // ==========================================================================
  return (
    <div className="w-full min-h-[100dvh] bg-[#FAF8FE] flex flex-col pb-28 md:pb-12 animate-in fade-in duration-150">
      
      {/* 1. Header (Normal Zenet Hub Style, Full-width mobile) */}
      <div className="bg-white border-b border-[#F1EEF9] sticky top-0 z-30 px-3 sm:px-6 py-3.5 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-1 text-[#0F172A] hover:text-[#5B4DF5] rounded-xl hover:bg-slate-100 transition cursor-pointer flex items-center gap-1.5 font-bold text-xs"
              title="Back to Profile"
            >
              <ArrowLeft className="w-5 h-5 text-[#0F172A]" />
              <span className="hidden xs:inline">Back</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-5 h-5 stroke-[2.4]" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-[#0F172A] tracking-tight">
                  Log Approve
                </h1>
                <p className="text-[11px] text-[#64748B] font-medium hidden xs:block">
                  Stock Approval Center & Verification
                </p>
              </div>
            </div>
          </div>

          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            Owner Access
          </span>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-4">
        
        {/* Action Alerts */}
        {actionSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">{actionSuccess}</span>
            <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {actionError && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Large Selectable Tabs: LEFT: Pending Approval, RIGHT: Confirmed Logs */}
        <div className="grid grid-cols-2 bg-white p-1 rounded-2xl border border-[#EAE6F8] shadow-2xs gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`py-3 px-3 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-[#EDE9FE] text-[#5B4DF5] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Approval</span>
            {pendingListings.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.2 rounded-full animate-pulse">
                {pendingListings.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('confirmed')}
            className={`py-3 px-3 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'confirmed'
                ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Confirmed Logs</span>
            <span className="text-[11px] font-bold text-[#64748B]">
              ({confirmedApprovals.length})
            </span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: PENDING APPROVAL LIST                                   */}
        {/* ============================================================== */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-20 text-center text-xs text-[#64748B] font-semibold space-y-2">
                <div className="w-6 h-6 border-2 border-[#5B4DF5]/20 border-t-[#5B4DF5] rounded-full animate-spin mx-auto"></div>
                <p>Loading pending stock submissions...</p>
              </div>
            ) : pendingListings.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-[#EAE6F8] shadow-sm space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">All Clear! No Pending Stock</h3>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                  When sellers or administrators submit new account stock, it will automatically enter this queue for your inspection before going active.
                </p>
              </div>
            ) : (
              pendingListings.map((listing) => {
                const stockQty = Number(listing.stockCount || listing.stock || (Array.isArray(listing.inventory) ? listing.inventory.length : 1));

                return (
                  <div 
                    key={listing.id}
                    onClick={() => setSelectedReviewListing(listing)}
                    className="bg-white rounded-3xl border border-[#EAE6F8] shadow-sm hover:border-[#DDD6FE] hover:shadow-md transition cursor-pointer p-4 sm:p-5 space-y-3"
                  >
                    {/* Top Row: Title, Category, Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-[#5B4DF5] bg-[#EDE9FE] px-2.5 py-0.5 rounded-lg border border-[#DDD6FE]">
                            {listing.category}
                          </span>
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Pending Approval</span>
                          </span>
                        </div>
                        <h3 className="text-base font-black text-[#0F172A] tracking-tight">
                          {listing.title}
                        </h3>
                      </div>

                      {/* Submitted Price */}
                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] font-bold text-[#64748B] uppercase block">Price</span>
                        <span className="text-lg font-black text-emerald-600 font-mono">
                          ₦{Number(listing.price).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Middle Info Breakdown: Seller, Quantity, Date */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#F1EEF9] text-xs">
                      <div>
                        <span className="text-[#64748B] font-semibold text-[11px] block">Submitter:</span>
                        <p className="font-extrabold text-[#0F172A] truncate">
                          {listing.sellerName || 'Seller'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[#64748B] font-semibold text-[11px] block">Stock Quantity:</span>
                        <p className="font-black text-[#5B4DF5]">
                          {stockQty} {stockQty === 1 ? 'account' : 'accounts'} submitted
                        </p>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[#64748B] font-semibold text-[11px] block">Date Submitted:</span>
                        <p className="font-bold text-[#0F172A]">
                          {formatDate(listing.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action: View/Review Button */}
                    <div className="pt-2 border-t border-[#F1EEF9] flex items-center justify-between">
                      <span className="text-[11px] text-[#64748B]">
                        Tap to inspect credentials & approve
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReviewListing(listing);
                        }}
                        className="px-4 py-2 rounded-xl bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#5B4DF5] font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review Submission</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CONFIRMED LOGS (Permanent Audit Trail)                 */}
        {/* ============================================================== */}
        {activeTab === 'confirmed' && (
          <div className="space-y-3">
            {confirmedApprovals.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-[#EAE6F8] shadow-sm space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">No Confirmed Logs Yet</h3>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                  When you approve stock submissions, their permanent approval records and audit information will be archived here.
                </p>
              </div>
            ) : (
              confirmedApprovals.map((rec) => (
                <div 
                  key={rec.id}
                  className="bg-white rounded-3xl border border-[#EAE6F8] shadow-sm p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Confirmed / Approved</span>
                        </span>
                        <span className="text-[10px] font-bold text-[#64748B] bg-[#FAF8FE] px-2 py-0.5 rounded border border-[#EDE9FE]">
                          {rec.category}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-[#0F172A]">
                        {rec.title}
                      </h4>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase block">Approved Price</span>
                      <span className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                        ₦{Number(rec.approvedPrice || rec.originalPrice).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Audit Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#F1EEF9] text-xs">
                    <div>
                      <span className="text-[#64748B] font-semibold text-[11px] block">Submitter:</span>
                      <p className="font-extrabold text-[#0F172A] truncate">
                        {rec.submitterName}
                      </p>
                      <p className="text-[10px] text-[#64748B] font-mono truncate">
                        {rec.submitterEmail || rec.submitterId}
                      </p>
                    </div>

                    <div>
                      <span className="text-[#64748B] font-semibold text-[11px] block">Quantity:</span>
                      <p className="font-black text-[#0F172A]">
                        {rec.quantity} {rec.quantity === 1 ? 'account' : 'accounts'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[#64748B] font-semibold text-[11px] block">Approved At:</span>
                      <p className="font-bold text-[#0F172A]">
                        {formatDate(rec.reviewedAt)}
                      </p>
                    </div>

                    <div>
                      <span className="text-[#64748B] font-semibold text-[11px] block">Approved By:</span>
                      <p className="font-mono text-[10px] text-emerald-800 font-bold truncate">
                        {rec.reviewedBy}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};
