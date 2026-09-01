import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { AccountListing, Inquiry, UserProfile, PurchaseRecord, CategoryType } from '../types';
import { 
  X, 
  Store, 
  MessageSquare, 
  ShoppingBag, 
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
  Phone, 
  Globe, 
  Save, 
  Sparkles, 
  AlertCircle,
  Clock,
  ExternalLink,
  Lock,
  Eye,
  Star,
  Layers,
  Award
} from 'lucide-react';
import { db, sanitizeFirestorePayload } from '../lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { EditListingModal } from './EditListingModal';

export type SellerDashboardTab = 'overview' | 'listings' | 'inquiries' | 'sales' | 'profile';

interface SellerDashboardModalProps {
  user: User | null;
  userProfile: UserProfile | null;
  myListings: AccountListing[];
  inquiries: Inquiry[];
  purchases: PurchaseRecord[];
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
  purchases,
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

  // Profile Edit Form state
  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || ''
  );
  const [whatsapp, setWhatsapp] = useState(userProfile?.whatsapp || '');
  const [telegram, setTelegram] = useState(userProfile?.telegram || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [preferredCurrency, setPreferredCurrency] = useState<string>(
    userProfile?.preferredCurrency || 'USD'
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileError, setProfileError] = useState('');

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

  // Handle Profile Update in Firestore
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg('');
    setProfileError('');

    try {
      const updatedData = sanitizeFirestorePayload({
        displayName: displayName.trim(),
        whatsapp: whatsapp.trim(),
        telegram: telegram.trim(),
        bio: bio.trim(),
        preferredCurrency
      });

      // 1. Update Firestore user doc
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, updatedData);

      // 2. Call parent callback if provided
      if (onUpdateProfile) {
        await onUpdateProfile(updatedData);
      }

      setProfileSuccessMsg('Seller Store Profile updated successfully in real time!');
      setTimeout(() => setProfileSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#05020c]/90 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#120826] border border-[#2d1952] rounded-2xl sm:rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-purple-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-[#0c051a] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#251347] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-600 text-white font-black flex items-center justify-center text-lg shadow-lg border border-purple-400/40">
                <Store className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0c051a] rounded-full" title="Verified Seller Active" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-white text-base sm:text-lg leading-tight">
                  Seller Merchant Hub
                </h2>
                <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Verified Store
                </span>
              </div>
              <span className="text-xs text-purple-300/60">
                Store: <strong className="text-white font-semibold">{displayName}</strong> ({user.email})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateListing}
              className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-full shadow-md transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ List New Account</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-purple-300 hover:text-white bg-[#1c0f38] border border-[#361d66] rounded-full transition cursor-pointer"
              title="Close Dashboard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-[#0e061e] px-4 sm:px-6 py-2 border-b border-[#241344] flex gap-1.5 overflow-x-auto text-xs font-semibold shrink-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-md font-bold'
                : 'text-purple-300/70 hover:text-white hover:bg-[#1b0d38]'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Sales & Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('listings')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'listings'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-md font-bold'
                : 'text-purple-300/70 hover:text-white hover:bg-[#1b0d38]'
            }`}
          >
            <Store className="w-4 h-4 text-violet-400" />
            <span>My Listed Accounts ({myListings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inquiries')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'inquiries'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-md font-bold'
                : 'text-purple-300/70 hover:text-white hover:bg-[#1b0d38]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>Buyer Inquiries ({sellerInquiries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'sales'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-md font-bold'
                : 'text-purple-300/70 hover:text-white hover:bg-[#1b0d38]'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Escrow Sales Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-md font-bold'
                : 'text-purple-300/70 hover:text-white hover:bg-[#1b0d38]'
            }`}
          >
            <UserIcon className="w-4 h-4 text-cyan-400" />
            <span>Seller Store Profile</span>
          </button>
        </div>

        {/* Scrollable Main Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">

          {/* ========================================================= */}
          {/* TAB 1: SALES & ANALYTICS OVERVIEW */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Sales Statistics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                
                {/* Total Listings Card */}
                <div className="bg-gradient-to-br from-[#190c36] to-[#120729] border border-[#321a5c] p-4.5 rounded-3xl space-y-1 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-purple-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Listings</span>
                    <Store className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white font-mono">{totalListings}</div>
                  <p className="text-[11px] text-purple-300/60 font-semibold">
                    {activeListings} Active • {soldListings} Sold
                  </p>
                </div>

                {/* Active Listings Card */}
                <div className="bg-gradient-to-br from-[#0c2420] to-[#071614] border border-[#1b4e45] p-4.5 rounded-3xl space-y-1 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-emerald-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Active Inventory</span>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white font-mono">{activeListings}</div>
                  <p className="text-[11px] text-emerald-300/60 font-semibold">
                    Ready for buyer orders
                  </p>
                </div>

                {/* Sold Listings Card */}
                <div className="bg-gradient-to-br from-[#2a132e] to-[#180a1c] border border-[#52215c] p-4.5 rounded-3xl space-y-1 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-amber-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Completed Sales</span>
                    <Tag className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white font-mono">{soldListings}</div>
                  <p className="text-[11px] text-amber-300/60 font-semibold">
                    Successfully delivered
                  </p>
                </div>

                {/* Total Escrow Revenue Card */}
                <div className="bg-gradient-to-br from-[#1d123e] to-[#0d0724] border border-[#41277d] p-4.5 rounded-3xl space-y-1 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-cyan-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Revenue</span>
                    <DollarSign className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                    ₦{totalRevenueNGN.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-cyan-300/70 font-semibold">
                    ≈ ${totalRevenueUSD} USD equivalent
                  </p>
                </div>

              </div>

              {/* Quick Action Banner */}
              <div className="bg-gradient-to-r from-[#1c0d3b] via-[#170933] to-[#200d45] border border-[#381c6e] p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <h3 className="font-extrabold text-white text-base sm:text-lg">
                      Ready to list another verified account?
                    </h3>
                  </div>
                  <p className="text-xs text-purple-300/80">
                    List Facebook, TikTok, Instagram, or Gmail accounts with 2FA, PVA verification & 100% Escrow Guarantee.
                  </p>
                </div>

                <button
                  onClick={onOpenCreateListing}
                  className="bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-lg transition cursor-pointer flex items-center gap-2 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create New Account Listing</span>
                </button>
              </div>

              {/* Recent Account Inventory Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <Store className="w-4 h-4 text-violet-400" />
                    Recent Listed Inventory ({myListings.slice(0, 4).length})
                  </h4>
                  <button
                    onClick={() => setActiveTab('listings')}
                    className="text-xs text-purple-400 hover:text-purple-200 font-bold"
                  >
                    View All ({myListings.length}) →
                  </button>
                </div>

                {myListings.length === 0 ? (
                  <div className="text-center py-10 bg-[#150a2b] border border-dashed border-[#2d1952] rounded-3xl p-6 space-y-3">
                    <Store className="w-8 h-8 text-purple-400 mx-auto opacity-50" />
                    <h5 className="text-white font-extrabold text-sm">No accounts listed yet</h5>
                    <p className="text-xs text-purple-300/60 max-w-sm mx-auto">
                      Click the "+ Create New Account Listing" button above to list your first account for sale!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {myListings.slice(0, 4).map((listing) => (
                      <div key={listing.id} className="bg-[#170c30] border border-[#2d1952] p-4 rounded-2xl space-y-2.5 shadow-md hover:border-purple-500/40 transition">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/60">
                            {listing.category}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            listing.status === 'sold'
                              ? 'bg-rose-950/90 text-rose-300 border border-rose-800'
                              : 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'
                          }`}>
                            {listing.status}
                          </span>
                        </div>

                        <h5 className="font-bold text-white text-sm line-clamp-1">{listing.title}</h5>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-[#261448]">
                          <span className="font-black text-emerald-400 font-mono">₦{Number(listing.price).toLocaleString()}</span>
                          <button
                            onClick={() => setEditingListing(listing)}
                            className="text-xs text-purple-300 hover:text-white font-bold flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-purple-400" />
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
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#160b2f] p-4 rounded-3xl border border-[#2b174e]">
                
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search my listings by title..."
                    className="w-full bg-[#0a0416] text-white pl-9 pr-3 py-2 rounded-2xl border border-[#2d1952] text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Filter dropdowns */}
                <div className="flex items-center gap-2 overflow-x-auto text-xs">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                    className="bg-[#0a0416] text-purple-200 border border-[#2d1952] px-3 py-2 rounded-2xl focus:outline-none"
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
                    className="bg-[#0a0416] text-purple-200 border border-[#2d1952] px-3 py-2 rounded-2xl focus:outline-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="sold">Sold Only</option>
                  </select>

                  <button
                    onClick={onOpenCreateListing}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-2 rounded-2xl transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ New Listing</span>
                  </button>
                </div>
              </div>

              {/* Listings Container */}
              {filteredListings.length === 0 ? (
                <div className="text-center py-16 bg-[#150a2b] border border-dashed border-[#2d1952] rounded-3xl p-6 space-y-3">
                  <Store className="w-12 h-12 text-purple-400 mx-auto opacity-40" />
                  <h4 className="text-white font-extrabold text-sm">No Listings Found</h4>
                  <p className="text-purple-300/70 text-xs max-w-sm mx-auto">
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
                      className="bg-[#170c30] border border-[#2d1952] p-4 sm:p-5 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg hover:border-purple-500/40 transition"
                    >
                      {/* Left info */}
                      <div className="flex items-start gap-4">
                        {/* Thumbnail Image */}
                        <div className="w-20 h-16 sm:w-24 sm:h-20 rounded-2xl overflow-hidden bg-[#0a0416] border border-[#2e1953] shrink-0 relative">
                          <img
                            src={listing.imageUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80'}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                          {listing.images && listing.images.length > 1 && (
                            <span className="absolute bottom-1 right-1 bg-black/80 text-purple-200 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Image className="w-2.5 h-2.5 text-purple-400" />
                              {listing.images.length}
                            </span>
                          )}
                        </div>

                        {/* Title & Metadata */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-purple-950/80 text-purple-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-800/60 uppercase">
                              {listing.category}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              listing.status === 'sold'
                                ? 'bg-rose-950/90 text-rose-300 border border-rose-800'
                                : 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'
                            }`}>
                              ● {listing.status}
                            </span>
                            {listing.pva && (
                              <span className="bg-blue-950/80 text-blue-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-blue-800/60">
                                PVA
                              </span>
                            )}
                            {listing.twoFactor && (
                              <span className="bg-indigo-950/80 text-indigo-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-indigo-800/60">
                                2FA
                              </span>
                            )}
                          </div>

                          <h4 
                            onClick={() => { onClose(); onSelectListing(listing); }}
                            className="font-extrabold text-white text-base hover:text-purple-300 transition cursor-pointer line-clamp-1"
                          >
                            {listing.title}
                          </h4>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-purple-300/70">
                            <span>Price: <strong className="text-white font-black font-mono">₦{Number(listing.price).toLocaleString()}</strong></span>
                            <span>• Followers: <strong className="text-purple-200">{listing.followers || 'N/A'}</strong></span>
                            <span>• Age: <strong className="text-purple-200">{listing.accountAge || 'Aged'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          onClick={() => setEditingListing(listing)}
                          className="bg-[#241348] hover:bg-[#341b68] text-purple-200 border border-[#3e1f7a] text-xs font-bold px-3.5 py-2 rounded-2xl transition cursor-pointer flex items-center gap-1.5"
                          title="Edit Listing Details"
                        >
                          <Edit3 className="w-4 h-4 text-purple-300" />
                          <span>Edit</span>
                        </button>

                        {listing.status === 'active' ? (
                          <button
                            onClick={() => onUpdateListingStatus(listing.id, 'sold')}
                            className="bg-[#211043] hover:bg-[#2e165b] text-amber-300 border border-[#3e1e78] text-xs font-bold px-3.5 py-2 rounded-2xl transition cursor-pointer"
                          >
                            Mark Sold
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateListingStatus(listing.id, 'active')}
                            className="bg-[#211043] hover:bg-[#2e165b] text-emerald-300 border border-[#3e1e78] text-xs font-bold px-3.5 py-2 rounded-2xl transition cursor-pointer"
                          >
                            Re-list Active
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteListing(listing.id)}
                          className="p-2 bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-800/80 rounded-2xl transition cursor-pointer"
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
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-400" />
                    Buyer Inquiries & Direct Messages
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Respond to prospective account buyers and coordinate credential delivery
                  </p>
                </div>
                <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold px-3 py-1 rounded-full">
                  {sellerInquiries.length} Inquiries Received
                </span>
              </div>

              {sellerInquiries.length === 0 ? (
                <div className="text-center py-16 bg-[#150a2b] border border-dashed border-[#2d1952] rounded-3xl p-6 space-y-3">
                  <MessageSquare className="w-12 h-12 text-indigo-400 mx-auto opacity-40" />
                  <h4 className="text-white font-extrabold text-sm">No Buyer Inquiries Yet</h4>
                  <p className="text-purple-300/70 text-xs max-w-sm mx-auto">
                    When buyers submit messages regarding your listed accounts, they will appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sellerInquiries.map((inq) => (
                    <div key={inq.id} className="bg-[#170c30] border border-[#2d1952] p-5 rounded-3xl space-y-3 shadow-lg">
                      
                      {/* Top Inquiry Info */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#271447] pb-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white flex items-center gap-1.5">
                            <UserIcon className="w-4 h-4 text-indigo-400" />
                            Buyer: {inq.buyerName || 'Interested Buyer'}
                          </span>
                          <span className="text-purple-300/60 font-mono">({inq.buyerEmail})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            inq.status === 'replied'
                              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950/90 text-amber-300 border border-amber-800'
                          }`}>
                            {inq.status === 'replied' ? '✓ Replied' : '● New Message'}
                          </span>
                          <span className="text-[10px] text-purple-300/50 font-mono">
                            {new Date(inq.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Buyer Message Box */}
                      <div className="bg-[#100722] p-3.5 rounded-2xl border border-[#271348] text-xs text-purple-100 space-y-1">
                        <span className="text-[10px] text-purple-400 font-extrabold uppercase block">
                          Regarding Account Listing: {inq.listingTitle}
                        </span>
                        <p className="whitespace-pre-line leading-relaxed text-purple-200">{inq.message}</p>
                      </div>

                      {/* Previous Seller Reply if existing */}
                      {inq.replyMessage && (
                        <div className="bg-[#191036] p-3.5 rounded-2xl border border-[#351c6e] text-xs space-y-1 text-emerald-200">
                          <span className="text-[10px] text-emerald-400 font-extrabold uppercase flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Your Response (Sent {inq.repliedAt ? new Date(inq.repliedAt).toLocaleDateString() : ''}):
                          </span>
                          <p className="whitespace-pre-line leading-relaxed">{inq.replyMessage}</p>
                        </div>
                      )}

                      {/* Seller Reply Form */}
                      <div className="pt-1 flex gap-2">
                        <input
                          type="text"
                          value={replyTexts[inq.id] || ''}
                          onChange={(e) => setReplyTexts((prev) => ({ ...prev, [inq.id]: e.target.value }))}
                          placeholder="Type seller reply or credentials delivery instructions..."
                          className="flex-1 bg-[#100722] text-white p-3 rounded-2xl border border-[#2b174f] focus:outline-none focus:border-purple-500 text-xs"
                        />
                        <button
                          onClick={() => handleSendReply(inq)}
                          disabled={!replyTexts[inq.id]?.trim() || isSubmittingReply === inq.id}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold px-5 py-3 rounded-2xl transition cursor-pointer disabled:opacity-40 text-xs flex items-center gap-1.5 shrink-0"
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

          {/* ========================================================= */}
          {/* TAB 4: ESCROW SALES ORDERS */}
          {/* ========================================================= */}
          {activeTab === 'sales' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-amber-400" />
                    Escrow Sales & Payment Orders
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Track account sales paid by buyers through Paystack & Escrow
                  </p>
                </div>
              </div>

              {purchases.length === 0 ? (
                <div className="text-center py-16 bg-[#150a2b] border border-dashed border-[#2d1952] rounded-3xl p-6 space-y-3">
                  <ShoppingBag className="w-12 h-12 text-amber-400 mx-auto opacity-40" />
                  <h4 className="text-white font-extrabold text-sm">No Sales Records Yet</h4>
                  <p className="text-purple-300/70 text-xs max-w-sm mx-auto">
                    When buyers complete payment for your listed accounts, order details and escrow release statuses will display here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {purchases.map((ord) => (
                    <div key={ord.id} className="bg-[#170c30] border border-[#2d1952] p-5 rounded-3xl space-y-3 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#281548] pb-3">
                        <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          {ord.status === 'completed' ? 'Escrow Released to Seller' : 'Funds Secured in Escrow'}
                        </span>
                        <span className="text-xs text-purple-300/60 font-mono">
                          {new Date(ord.purchasedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-purple-400 uppercase">{ord.category} Account</span>
                          <h4 className="font-extrabold text-white text-base">{ord.listingTitle}</h4>
                          <p className="text-xs text-purple-300/80">
                            Buyer: <strong className="text-white">{ord.buyerName || 'Verified Buyer'}</strong> ({ord.buyerEmail})
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-purple-300/60 font-bold uppercase block">Escrow Amount</span>
                          <span className="text-xl font-black text-white font-mono">
                            ₦{Number(ord.paidAmount || ord.price).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: SELLER STORE PROFILE MANAGEMENT */}
          {/* ========================================================= */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-cyan-400" />
                    Seller Store Profile & Branding
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Customize your public merchant presence, direct contact links, and store credentials
                  </p>
                </div>
              </div>

              {profileSuccessMsg && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 rounded-2xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-2xl text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="bg-[#170c30] border border-[#2d1952] p-5 rounded-3xl space-y-5 shadow-lg">
                
                {/* Store Name */}
                <div>
                  <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
                    Store / Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Zenet Verified Accounts Store"
                    className="w-full bg-[#0a0416] text-white p-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
                    required
                  />
                </div>

                {/* Direct Contact Handles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
                      WhatsApp Number (with Country Code)
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                      <input
                        type="text"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="+2348012345678"
                        className="w-full bg-[#0a0416] text-white pl-10 pr-3 py-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
                      Telegram Username
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                      <input
                        type="text"
                        value={telegram}
                        onChange={(e) => setTelegram(e.target.value)}
                        placeholder="@zenet_seller"
                        className="w-full bg-[#0a0416] text-white pl-10 pr-3 py-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Bio / Store Guarantee */}
                <div>
                  <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
                    Store Description & Delivery Guarantee
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Provide details about your experience as an account provider, fast response rate, 24/7 support..."
                    className="w-full bg-[#0a0416] text-white p-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
                  />
                </div>

                {/* Seller Badges preview */}
                <div className="bg-[#0b0419] p-4 rounded-2xl border border-[#281349] space-y-2">
                  <span className="text-xs font-extrabold text-purple-300 uppercase block">Active Seller Badges</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Verified Merchant
                    </span>
                    <span className="bg-indigo-950/90 text-indigo-300 border border-indigo-800 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-indigo-400" />
                      100% Escrow Rating
                    </span>
                    <span className="bg-purple-950/90 text-purple-300 border border-purple-800 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      Instant Delivery Seller
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold px-6 py-3 rounded-2xl shadow-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-50 text-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingProfile ? 'Saving Store Profile...' : 'Save Seller Profile'}</span>
                  </button>
                </div>

              </form>
            </div>
          )}

        </div>

      </div>

      {/* Render Edit Listing Modal if active */}
      {editingListing && (
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
      )}
    </div>
  );
};
