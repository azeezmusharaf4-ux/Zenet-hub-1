import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { AccountListing, Inquiry, UserProfile, PurchaseRecord, CategoryType } from '../types';
import { 
  X, 
  Store, 
  MessageSquare, 
  Trash2, 
  CheckCircle2, 
  User as UserIcon, 
  ShieldCheck, 
  Tag, 
  Edit3, 
  PlusCircle, 
  DollarSign, 
  TrendingUp, 
  Check, 
  Send, 
  Search, 
  Image, 
  Sparkles
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const EditListingModal = React.lazy(() => import('./EditListingModal').then(m => ({ default: m.EditListingModal })));

export type SellerDashboardTab = 'overview' | 'listings' | 'inquiries';

interface SellerDashboardModalProps {
  user: User | null;
  userProfile: UserProfile | null;
  myListings: AccountListing[];
  inquiries: Inquiry[];
  purchases?: PurchaseRecord[];
  onClose: () => void;
  onSelectListing: (listing: AccountListing) => void;
  onOpenCreateListing: () => void;
  onUpdateListingStatus: (listingId: string, newStatus: 'active' | 'sold') => Promise<void>;
  onDeleteListing: (listingId: string) => Promise<void>;
  onUpdateProfile?: (profileData: Partial<UserProfile>) => Promise<void>;
  onUpdateListing?: (updated: AccountListing) => void;
}

export const SellerDashboardModal: React.FC<SellerDashboardModalProps> = ({
  user,
  userProfile,
  myListings,
  inquiries,
  purchases = [],
  onClose,
  onSelectListing,
  onOpenCreateListing,
  onUpdateListingStatus,
  onDeleteListing,
  onUpdateProfile,
  onUpdateListing
}) => {
  const [activeTab, setActiveTab] = useState<SellerDashboardTab>('overview');
  
  // Filtering states in Listings tab
  const [categoryFilter, setCategoryFilter] = useState<CategoryType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'active' | 'sold'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing listing modal state
  const [editingListing, setEditingListing] = useState<AccountListing | null>(null);

  // Store display name for header
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Zenet Store';

  // Inquiry reply state
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [isSubmittingReply, setIsSubmittingReply] = useState<string | null>(null);

  if (!user || userProfile?.role === 'buyer') return null;

  // Filter inquiries related to seller's listings or where sellerId matches user.uid
  const sellerInquiries = inquiries.filter(
    (inq) => inq.sellerId === user.uid || myListings.some((l) => l.id === inq.listingId)
  );

  // Calculate Seller Sales Statistics
  const totalListings = myListings.length;
  const activeListings = myListings.filter((l) => l.status === 'active').length;
  const soldListings = myListings.filter((l) => l.status === 'sold').length;

  // Total Revenue in NGN & USD
  const totalRevenueNGN = myListings
    .filter((l) => l.status === 'sold')
    .reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  
  // 1 NGN ~ 0.00067 USD approx for display reference (₦1,500 = $1)
  const totalRevenueUSD = (totalRevenueNGN / 1500).toFixed(2);
  const avgPriceNGN = soldListings > 0 ? Math.round(totalRevenueNGN / soldListings) : 0;

  // Filtered listings
  const filteredListings = myListings.filter((listing) => {
    if (categoryFilter !== 'All' && listing.category !== categoryFilter) return false;
    if (statusFilter !== 'All' && listing.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = listing.title.toLowerCase().includes(q);
      const matchDesc = listing.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  // Handle Inquiry Reply submission in Firestore
  const handleSendReply = async (inquiry: Inquiry) => {
    const text = replyTexts[inquiry.id];
    if (!text || !text.trim()) return;

    setIsSubmittingReply(inquiry.id);
    try {
      const inquiryRef = doc(db, 'inquiries', inquiry.id);
      await updateDoc(inquiryRef, {
        replyMessage: text.trim(),
        repliedAt: new Date().toISOString(),
        status: 'replied'
      });

      setReplyTexts((prev) => ({ ...prev, [inquiry.id]: '' }));
      alert(`Reply dispatched to ${inquiry.buyerName || inquiry.buyerEmail}!`);
    } catch (err: any) {
      console.error('Error replying to inquiry:', err);
      alert('Failed to send reply. Please try again.');
    } finally {
      setIsSubmittingReply(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div 
        id="seller-dashboard-modal"
        data-component="seller-dashboard"
        className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-slate-800 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-white px-4 sm:px-6 py-3.5 sm:py-4 border-b border-purple-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white font-black flex items-center justify-center text-lg shadow-md border border-purple-500">
                <Store className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-600 border-2 border-white rounded-full" title="Verified Seller Active" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">
                  Seller Merchant Hub
                </h2>
                <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-purple-600" />
                  Verified Store
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Store: <strong className="text-slate-900 font-semibold">{displayName}</strong> ({user.email})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateListing}
              className="hidden sm:flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ List New Account</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 bg-purple-50/50 hover:bg-purple-100 border border-purple-200 rounded-full transition cursor-pointer"
              title="Close Dashboard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-purple-50/30 px-4 sm:px-6 py-2.5 border-b border-purple-100 flex items-center gap-2 overflow-x-auto text-xs font-semibold shrink-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-purple-600 hover:bg-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Sales & Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('listings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'listings'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-purple-600 hover:bg-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>My Listed Accounts ({myListings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inquiries')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'inquiries'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-purple-600 hover:bg-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Buyer Inquiries ({sellerInquiries.length})</span>
          </button>
        </div>

        {/* Scrollable Main Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm bg-white">

          {/* ========================================================= */}
          {/* TAB 1: SALES & ANALYTICS OVERVIEW */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Sales Statistics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                
                {/* Total Listings Card */}
                <div className="bg-white border border-purple-100 p-4.5 rounded-2xl space-y-1 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Listings</span>
                    <Store className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">{totalListings}</div>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    {activeListings} Active • {soldListings} Sold
                  </p>
                </div>

                {/* Active Listings Card */}
                <div className="bg-white border border-purple-100 p-4.5 rounded-2xl space-y-1 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-purple-700">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Active Inventory</span>
                    <CheckCircle2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-purple-600 font-mono">{activeListings}</div>
                  <p className="text-[11px] text-purple-600/80 font-semibold">
                    Ready for buyer orders
                  </p>
                </div>

                {/* Sold Listings Card */}
                <div className="bg-white border border-purple-100 p-4.5 rounded-2xl space-y-1 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-purple-700">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Completed Sales</span>
                    <Tag className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-purple-600 font-mono">{soldListings}</div>
                  <p className="text-[11px] text-purple-600/80 font-semibold">
                    Successfully delivered
                  </p>
                </div>

                {/* Total Escrow Revenue Card */}
                <div className="bg-white border border-purple-100 p-4.5 rounded-2xl space-y-1 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-purple-700">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Revenue</span>
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    ₦{totalRevenueNGN.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-purple-600/80 font-semibold">
                    ≈ ${totalRevenueUSD} USD equivalent
                  </p>
                </div>

              </div>

              {/* Quick Action Banner */}
              <div className="bg-purple-50/50 border border-purple-100 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                      Ready to list another verified account?
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    List Facebook, TikTok, Instagram, or Gmail accounts with 2FA, PVA verification & 100% Escrow Guarantee.
                  </p>
                </div>

                <button
                  onClick={onOpenCreateListing}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-sm transition cursor-pointer flex items-center gap-2 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create New Account Listing</span>
                </button>
              </div>

              {/* Recent Account Inventory Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Store className="w-4 h-4 text-purple-600" />
                    Recent Listed Inventory ({myListings.slice(0, 4).length})
                  </h4>
                  <button
                    onClick={() => setActiveTab('listings')}
                    className="text-xs text-purple-600 hover:text-purple-800 font-bold"
                  >
                    View All ({myListings.length}) →
                  </button>
                </div>

                {myListings.length === 0 ? (
                  <div className="text-center py-10 bg-purple-50/30 border border-dashed border-purple-200 rounded-2xl p-6 space-y-3">
                    <Store className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                    <h5 className="text-slate-900 font-extrabold text-sm">No accounts listed yet</h5>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Click the "+ Create New Account Listing" button above to list your first account for sale!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {myListings.slice(0, 4).map((listing) => (
                      <div key={listing.id} className="bg-white border border-purple-100 p-4 rounded-2xl space-y-2.5 shadow-xs hover:border-purple-300 transition">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            {listing.category}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            listing.status === 'sold'
                              ? 'bg-purple-50 text-slate-500 border border-purple-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {listing.status}
                          </span>
                        </div>

                        <h5 className="font-bold text-slate-900 text-sm line-clamp-1">{listing.title}</h5>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-purple-50">
                          <span className="font-black text-purple-600 font-mono">₦{Number(listing.price).toLocaleString()}</span>
                          <button
                            onClick={() => setEditingListing(listing)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-bold flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                            <span>Edit Listing</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: MY LISTED ACCOUNTS (WITH FILTERS & FULL EDIT/DELETE/STATUS CONTROLS) */}
          {/* ========================================================= */}
          {activeTab === 'listings' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Header & Filter Toolbar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-purple-100 shadow-xs">
                
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search my listings by title..."
                    className="w-full bg-white text-slate-900 pl-9 pr-3 py-2 rounded-xl border border-purple-100 text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Filter dropdowns */}
                <div className="flex items-center gap-2 overflow-x-auto text-xs">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                    className="bg-white text-slate-700 border border-purple-100 px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
                  >
                    <option value="All">All Categories</option>
                    <option value="Facebook">Facebook</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Gmail">Gmail / Google</option>
                    <option value="Other">Other</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-white text-slate-700 border border-purple-100 px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
                  >
                    <option value="All">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="sold">Sold Only</option>
                  </select>

                  <button
                    onClick={onOpenCreateListing}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ New Listing</span>
                  </button>
                </div>
              </div>

              {/* Listings Container */}
              {filteredListings.length === 0 ? (
                <div className="text-center py-16 bg-purple-50/30 border border-dashed border-purple-200 rounded-2xl p-6 space-y-3">
                  <Store className="w-12 h-12 text-slate-400 mx-auto opacity-50" />
                  <h4 className="text-slate-900 font-extrabold text-sm">No Listings Found</h4>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    {searchQuery || categoryFilter !== 'All' || statusFilter !== 'All'
                      ? 'No listings match your filter criteria. Try clearing search filters.'
                      : 'You have not created any account listings yet. Click "+ New Listing" to add your first account!'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredListings.map((listing) => (
                    <div 
                      key={listing.id} 
                      className="bg-white border border-purple-100 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs hover:border-purple-300 transition"
                    >
                      {/* Left info */}
                      <div className="flex items-start gap-4">
                        {/* Thumbnail Image */}
                        <div className="w-20 h-16 sm:w-24 sm:h-20 rounded-xl overflow-hidden bg-purple-50/50 border border-purple-100 shrink-0 relative">
                          <img
                            src={listing.imageUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80'}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                          {listing.images && listing.images.length > 1 && (
                            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Image className="w-2.5 h-2.5 text-purple-300" />
                              {listing.images.length}
                            </span>
                          )}
                        </div>

                        {/* Title & Metadata */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-purple-50 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-200 uppercase">
                              {listing.category}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              listing.status === 'sold'
                                ? 'bg-purple-50 text-slate-500 border border-purple-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              ● {listing.status}
                            </span>
                            {listing.pva && (
                              <span className="bg-purple-50 text-purple-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
                                PVA
                              </span>
                            )}
                            {listing.twoFactor && (
                              <span className="bg-purple-50 text-purple-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
                                2FA
                              </span>
                            )}
                          </div>

                          <h4 
                            onClick={() => { onClose(); onSelectListing(listing); }}
                            className="font-extrabold text-slate-900 text-base hover:text-purple-600 transition cursor-pointer line-clamp-1"
                          >
                            {listing.title}
                          </h4>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span>Price: <strong className="text-purple-600 font-black font-mono">₦{Number(listing.price).toLocaleString()}</strong></span>
                            <span>• Followers: <strong className="text-slate-700">{listing.followers || 'N/A'}</strong></span>
                            <span>• Age: <strong className="text-slate-700">{listing.accountAge || 'Aged'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          onClick={() => setEditingListing(listing)}
                          className="bg-white hover:bg-purple-50/50 text-slate-700 border border-purple-100 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                          title="Edit Listing Details"
                        >
                          <Edit3 className="w-4 h-4 text-purple-600" />
                          <span>Edit</span>
                        </button>

                        {listing.status === 'active' ? (
                          <button
                            onClick={() => onUpdateListingStatus(listing.id, 'sold')}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer"
                          >
                            Mark Sold
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateListingStatus(listing.id, 'active')}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer"
                          >
                            Re-list Active
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteListing(listing.id)}
                          className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl transition cursor-pointer"
                          title="Delete Listing"
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

          {/* ========================================================= */}
          {/* TAB 3: BUYER INQUIRIES & LEADS */}
          {/* ========================================================= */}
          {activeTab === 'inquiries' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                    Buyer Inquiries & Direct Messages
                  </h3>
                  <p className="text-xs text-slate-500">
                    Respond to prospective account buyers and coordinate credential delivery
                  </p>
                </div>
                <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold px-3 py-1 rounded-full">
                  {sellerInquiries.length} Inquiries Received
                </span>
              </div>

              {sellerInquiries.length === 0 ? (
                <div className="text-center py-16 bg-purple-50/30 border border-dashed border-purple-200 rounded-2xl p-6 space-y-3">
                  <MessageSquare className="w-12 h-12 text-slate-400 mx-auto opacity-50" />
                  <h4 className="text-slate-900 font-extrabold text-sm">No Buyer Inquiries Yet</h4>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    When buyers submit messages regarding your listed accounts, they will appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sellerInquiries.map((inq) => (
                    <div key={inq.id} className="bg-white border border-purple-100 p-5 rounded-2xl space-y-3 shadow-xs">
                      
                      {/* Top Inquiry Info */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-50 pb-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            <UserIcon className="w-4 h-4 text-purple-600" />
                            Buyer: {inq.buyerName || 'Interested Buyer'}
                          </span>
                          <span className="text-slate-400 font-mono">({inq.buyerEmail})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            inq.status === 'replied'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {inq.status === 'replied' ? '✓ Replied' : '● New Message'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(inq.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Buyer Message Box */}
                      <div className="bg-purple-50/30 p-3.5 rounded-xl border border-purple-100 text-xs text-slate-800 space-y-1">
                        <span className="text-[10px] text-purple-600 font-extrabold uppercase block">
                          Regarding Account Listing: {inq.listingTitle}
                        </span>
                        <p className="whitespace-pre-line leading-relaxed text-slate-700">{inq.message}</p>
                      </div>

                      {/* Previous Seller Reply if existing */}
                      {inq.replyMessage && (
                        <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100 text-xs space-y-1 text-slate-800">
                          <span className="text-[10px] text-purple-700 font-extrabold uppercase flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Your Response (Sent {inq.repliedAt ? new Date(inq.repliedAt).toLocaleDateString() : ''}):
                          </span>
                          <p className="whitespace-pre-line leading-relaxed text-slate-700">{inq.replyMessage}</p>
                        </div>
                      )}

                      {/* Seller Reply Form */}
                      <div className="pt-1 flex gap-2">
                        <input
                          type="text"
                          value={replyTexts[inq.id] || ''}
                          onChange={(e) => setReplyTexts((prev) => ({ ...prev, [inq.id]: e.target.value }))}
                          placeholder="Type seller reply or credentials delivery instructions..."
                          className="flex-1 bg-white text-slate-900 p-3 rounded-xl border border-purple-100 focus:outline-none focus:border-purple-500 text-xs"
                        />
                        <button
                          onClick={() => handleSendReply(inq)}
                          disabled={!replyTexts[inq.id]?.trim() || isSubmittingReply === inq.id}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-5 py-3 rounded-xl transition cursor-pointer disabled:opacity-40 text-xs flex items-center gap-1.5 shrink-0"
                        >
                          <Send className="w-4 h-4" />
                          <span>{isSubmittingReply === inq.id ? 'Sending...' : 'Send Reply'}</span>
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Render Edit Listing Modal if active */}
      {editingListing && (
        <React.Suspense fallback={null}>
          <EditListingModal
            listing={editingListing}
            onClose={() => setEditingListing(null)}
            user={user}
            userProfile={userProfile}
            isOwner={user?.email?.toLowerCase() === 'azeezmusharaf4@gmail.com' || userProfile?.role === 'owner'}
            onSuccess={(updated) => {
              if (onUpdateListing && editingListing) {
                onUpdateListing({ ...editingListing, ...updated } as AccountListing);
              }
              setEditingListing(null);
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
};
