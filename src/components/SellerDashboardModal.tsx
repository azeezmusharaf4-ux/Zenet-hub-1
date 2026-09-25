import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { AccountListing, Inquiry, UserProfile, PurchaseRecord, CategoryType, SellerRevenueRecord } from '../types';
import { isAuthorizedOwner } from '../lib/authorizedOwners';
import { 
  X, 
  Store, 
  MessageSquare, 
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
  Sparkles,
  PieChart,
  Receipt,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, setDoc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { calculateRevenueSplit, syncHistoricalSellerRevenue } from '../lib/revenueSplit';

const EditListingModal = React.lazy(() => import('./EditListingModal').then(m => ({ default: m.EditListingModal })));

export type SellerDashboardTab = 'overview' | 'inquiries';

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
  onBuyNow?: (listing: AccountListing) => void;
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
  onBuyNow,
  onUpdateProfile,
  onUpdateListing
}) => {
  const [activeTab, setActiveTab] = useState<SellerDashboardTab>('overview');
  const [showAllListings, setShowAllListings] = useState(false);

  // Editing listing modal state
  const [editingListing, setEditingListing] = useState<AccountListing | null>(null);

  // Live seller revenue state from Firestore
  const [revenueRecord, setRevenueRecord] = useState<SellerRevenueRecord | null>(null);
  const [sellerPurchases, setSellerPurchases] = useState<PurchaseRecord[]>([]);
  const [showRevenueAnalysis, setShowRevenueAnalysis] = useState<boolean>(false);

  // Live real-time listener for seller_revenues/{user.uid} and purchases
  useEffect(() => {
    if (!user?.uid) return;

    // 1. Listen to seller_revenues doc
    const revDocRef = doc(db, 'seller_revenues', user.uid);
    const unsubRev = onSnapshot(revDocRef, (snap) => {
      if (snap.exists()) {
        setRevenueRecord(snap.data() as SellerRevenueRecord);
      }
    }, (err) => {
      console.warn('Seller revenue snapshot notice:', err);
    });

    // 2. Listen to purchases where sellerId == user.uid
    const purchasesRef = collection(db, 'purchases');
    const qPurchases = query(purchasesRef, where('sellerId', '==', user.uid));
    const unsubPurchases = onSnapshot(qPurchases, (snap) => {
      const pDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchaseRecord));
      setSellerPurchases(pDocs);
    }, (err) => {
      console.warn('Seller purchases snapshot notice:', err);
    });

    return () => {
      unsubRev();
      unsubPurchases();
    };
  }, [user?.uid]);

  // Ensure any existing sold listings or completed purchases are permanently saved in seller_revenues
  useEffect(() => {
    if (!user?.uid) return;
    const soldListingsItems = myListings.filter((l) => l.status === 'sold');
    if (soldListingsItems.length > 0 || sellerPurchases.length > 0) {
      syncHistoricalSellerRevenue(
        user.uid,
        user.email || '',
        soldListingsItems.map((l) => ({ id: l.id, title: l.title, price: Number(l.price) || 0, createdAt: l.createdAt })),
        sellerPurchases
      ).then((synced) => {
        if (synced && !revenueRecord) {
          setRevenueRecord(synced);
        }
      }).catch((e) => console.warn('Revenue sync check notice:', e));
    }
  }, [user?.uid, myListings, sellerPurchases]);

  // Store display name for header
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Zenet Store';

  // Inquiry reply state
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [isSubmittingReply, setIsSubmittingReply] = useState<string | null>(null);

  const isOwnerUser = isAuthorizedOwner(user, userProfile);
  if (!user || (!isOwnerUser && userProfile?.role === 'buyer')) return null;

  // Filter inquiries related to seller's listings or where sellerId matches user.uid (Owners can see store inquiries)
  const sellerInquiries = inquiries.filter(
    (inq) => isOwnerUser || inq.sellerId === user.uid || myListings.some((l) => l.id === inq.listingId)
  );

  // 1. TOTAL LISTINGS = the total number of listings created by that seller, including Active and Sold
  const totalListings = myListings.length;

  // 2. ACTIVE INVENTORY = seller’s currently available listings
  const activeListings = myListings.filter(
    (l) => l.status === 'active' || (l.status !== 'sold' && (l.stockCount === undefined || l.stockCount > 0))
  ).length;

  // 3. COMPLETED SALES = seller’s successfully completed sales
  const soldListingsFromListings = myListings.filter((l) => l.status === 'sold').length;
  const completedSalesCount = Math.max(
    soldListingsFromListings,
    revenueRecord?.completedSalesCount || 0,
    sellerPurchases.length
  );

  // 4. TOTAL REVENUE = LIVE 70% Seller earnings / 30% Website Owner share
  const dbGross = Number(revenueRecord?.totalGrossSales) || 0;
  const dbSeller = Number(revenueRecord?.totalSellerRevenue) || 0;

  const purchasesGross = sellerPurchases.reduce((sum, p) => sum + (Number(p.paidAmount || p.price) || 0), 0);
  const listingsSoldGross = myListings.filter((l) => l.status === 'sold').reduce((sum, l) => sum + (Number(l.price) || 0), 0);

  const totalGrossSales = Math.max(dbGross, purchasesGross, listingsSoldGross);

  // Seller's actual accumulated 70% earnings
  const totalSellerRevenue = totalGrossSales > 0 
    ? (dbSeller > 0 ? Math.max(dbSeller, Math.round(totalGrossSales * 0.70)) : Math.round(totalGrossSales * 0.70))
    : 0;

  // Website Owner's 30% share
  const totalOwnerCommission = Math.max(0, totalGrossSales - totalSellerRevenue);

  // 1 NGN ~ 0.00067 USD approx for display reference (₦1,500 = $1)
  const totalRevenueUSD = (totalSellerRevenue / 1500).toFixed(2);
  const avgPriceNGN = completedSalesCount > 0 ? Math.round(totalGrossSales / completedSalesCount) : 0;

  // Itemized sales list for revenue analysis modal
  const allRecordedSales = useMemo(() => {
    const list: Array<{
      orderId: string;
      txId?: string;
      listingId?: string;
      listingTitle?: string;
      grossAmount: number;
      sellerShare: number;
      ownerShare: number;
      sellerPercent: number;
      ownerPercent: number;
      date: string;
    }> = [];

    const seenIds = new Set<string>();

    if (Array.isArray(revenueRecord?.sales)) {
      revenueRecord.sales.forEach((s) => {
        const id = s.orderId || s.txId || `s_${Math.random()}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const gross = Number(s.grossAmount) || 0;
          const split = calculateRevenueSplit(gross);
          list.push({
            orderId: id,
            txId: s.txId,
            listingId: s.listingId,
            listingTitle: s.listingTitle,
            grossAmount: gross,
            sellerShare: s.sellerShare !== undefined ? Number(s.sellerShare) : split.sellerShare,
            ownerShare: s.ownerShare !== undefined ? Number(s.ownerShare) : split.ownerShare,
            sellerPercent: 70,
            ownerPercent: 30,
            date: s.date || new Date().toISOString()
          });
        }
      });
    }

    sellerPurchases.forEach((p) => {
      const id = p.id || p.transactionId || `p_${Math.random()}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const gross = Number(p.paidAmount || p.price || 0);
        const split = calculateRevenueSplit(gross);
        list.push({
          orderId: id,
          txId: p.transactionId || id,
          listingId: p.listingId,
          listingTitle: p.listingTitle,
          grossAmount: split.grossAmount,
          sellerShare: p.sellerShare !== undefined ? Number(p.sellerShare) : split.sellerShare,
          ownerShare: p.ownerShare !== undefined ? Number(p.ownerShare) : split.ownerShare,
          sellerPercent: 70,
          ownerPercent: 30,
          date: p.purchasedAt || new Date().toISOString()
        });
      }
    });

    myListings.filter((l) => l.status === 'sold').forEach((l) => {
      if (!list.some((s) => s.listingId === l.id)) {
        const id = `SOLD_${l.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const gross = Number(l.price || 0);
          const split = calculateRevenueSplit(gross);
          list.push({
            orderId: id,
            txId: `TX_${l.id}`,
            listingId: l.id,
            listingTitle: l.title,
            grossAmount: split.grossAmount,
            sellerShare: split.sellerShare,
            ownerShare: split.ownerShare,
            sellerPercent: 70,
            ownerPercent: 30,
            date: l.createdAt || new Date().toISOString()
          });
        }
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [revenueRecord?.sales, sellerPurchases, myListings]);

  const displayedListings = showAllListings ? myListings : myListings.slice(0, 4);

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
                    {activeListings} Active • {completedSalesCount} Sold
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
                  <div className="text-2xl sm:text-3xl font-black text-purple-600 font-mono">{completedSalesCount}</div>
                  <p className="text-[11px] text-purple-600/80 font-semibold">
                    Successfully delivered
                  </p>
                </div>

                {/* Total Escrow Revenue Card */}
                <div 
                  onClick={() => setShowRevenueAnalysis(true)}
                  className="bg-white border border-purple-100 hover:border-purple-300 p-4.5 rounded-2xl space-y-1 shadow-xs hover:shadow-sm relative overflow-hidden cursor-pointer transition group"
                  title="Click to view live 70% Seller / 30% Owner revenue analysis"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowRevenueAnalysis(true);
                    }
                  }}
                >
                  <div className="flex items-center justify-between text-purple-700">
                    <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                      Total Revenue
                      <ArrowUpRight className="w-3.5 h-3.5 text-purple-500 group-hover:text-purple-700 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                    </span>
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    ₦{totalSellerRevenue.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-purple-600/80 font-semibold flex items-center justify-between">
                    <span>≈ ${totalRevenueUSD} USD • 70% Share</span>
                    <span className="text-[10px] text-purple-600 font-bold group-hover:underline">View Split →</span>
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
                    Recent Listed Inventory ({displayedListings.length})
                  </h4>
                  {myListings.length > 4 && (
                    <button
                      onClick={() => setShowAllListings((prev) => !prev)}
                      className="text-xs text-purple-600 hover:text-purple-800 font-bold transition cursor-pointer"
                    >
                      {showAllListings ? 'Show Recent (4) ↑' : `View All (${myListings.length}) →`}
                    </button>
                  )}
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
                    {displayedListings.map((listing) => (
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
                            className="text-xs text-purple-600 hover:text-purple-800 font-bold flex items-center gap-1 cursor-pointer"
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
          {/* TAB 2: BUYER INQUIRIES & LEADS */}
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

      {/* Clean Revenue Analysis Modal (70% Seller / 30% Website Owner Live Split) */}
      {showRevenueAnalysis && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowRevenueAnalysis(false)}
        >
          <div 
            className="bg-white border border-purple-100 rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-auto animate-in zoom-in-95 duration-150 text-slate-800 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-white px-5 sm:px-6 py-4 border-b border-purple-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white font-black flex items-center justify-center shadow-md">
                  <PieChart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">
                      Revenue & Commission Analysis
                    </h3>
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Live 70/30 Split
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Store: <strong className="text-slate-800 font-semibold">{displayName}</strong> • {completedSalesCount} Completed Sale{completedSalesCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowRevenueAnalysis(false)}
                className="p-2 text-slate-400 hover:text-slate-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-full transition cursor-pointer"
                title="Close Analysis"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
              {/* Top 3 Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Total Gross Sales */}
                <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Total Gross Sales</span>
                    <Receipt className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                    ₦{totalGrossSales.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    100% Total Sales Volume
                  </p>
                </div>

                {/* 2. Seller's 70% Earnings */}
                <div className="bg-purple-50/70 border-2 border-purple-300 p-4 rounded-2xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-purple-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      Seller Revenue
                      <span className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">70%</span>
                    </span>
                    <DollarSign className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-purple-700 font-mono">
                    ₦{totalSellerRevenue.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-purple-600 font-semibold">
                    Your Accumulated Earnings
                  </p>
                </div>

                {/* 3. Owner's 30% Share */}
                <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      Owner Share
                      <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.2 rounded-full">30%</span>
                    </span>
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
                    ₦{totalOwnerCommission.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Platform & Escrow Service
                  </p>
                </div>
              </div>

              {/* Visual 70/30 Split Bar */}
              <div className="bg-purple-50/40 border border-purple-100 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5 text-purple-700 font-extrabold">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                    Seller Payout: 70% (₦{totalSellerRevenue.toLocaleString()})
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                    Owner Share: 30% (₦{totalOwnerCommission.toLocaleString()})
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                  <div 
                    className="h-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${totalGrossSales > 0 ? (totalSellerRevenue / totalGrossSales) * 100 : 70}%` }}
                    title="Seller: 70%"
                  />
                  <div 
                    className="h-full bg-slate-400 transition-all duration-300"
                    style={{ width: `${totalGrossSales > 0 ? (totalOwnerCommission / totalGrossSales) * 100 : 30}%` }}
                    title="Owner: 30%"
                  />
                </div>
              </div>

              {/* Live Automated Split Explanation Card */}
              <div className="bg-purple-50/30 border border-purple-100 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-slate-600">
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                    Automated Revenue Split System
                  </h4>
                  <p className="leading-relaxed">
                    Whenever a buyer purchases one of your account listings, the payment split is calculated automatically:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-700 font-medium">
                    <li><strong className="text-purple-700 font-extrabold">Seller receives 70%</strong> accumulated in Total Revenue</li>
                    <li><strong className="text-slate-800 font-bold">Website Owner receives 30%</strong> platform service & escrow fee</li>
                  </ul>
                  <p className="text-[11px] text-purple-700 font-bold bg-white/80 border border-purple-100 px-2.5 py-1 rounded-lg inline-block mt-1">
                    Example: ₦2,000 sale → Seller ₦1,400, Owner ₦600.
                  </p>
                </div>
              </div>

              {/* Completed Sales Itemized List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-purple-600" />
                    Completed Sales Breakdown ({allRecordedSales.length})
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    All calculations saved in database
                  </span>
                </div>

                {allRecordedSales.length === 0 ? (
                  <div className="text-center py-8 bg-purple-50/20 border border-dashed border-purple-200 rounded-2xl p-5 space-y-2">
                    <DollarSign className="w-7 h-7 text-slate-400 mx-auto opacity-40" />
                    <p className="font-bold text-slate-800 text-xs">No Completed Sales Recorded Yet</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      When buyers purchase any of your listings, the 70/30 commission split is calculated automatically and saved here permanently.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {allRecordedSales.map((sale, idx) => (
                      <div 
                        key={sale.orderId || `sale-${idx}`}
                        className="bg-white border border-purple-100 hover:border-purple-200 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 text-xs line-clamp-1">
                            {sale.listingTitle || 'Account Listing'}
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                            <span>{new Date(sale.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>Order #{String(sale.orderId || sale.txId || '').slice(-6).toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-right">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Sale</span>
                            <span className="font-black text-slate-800 text-xs font-mono">
                              ₦{sale.grossAmount.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-purple-600 block">Seller 70%</span>
                            <span className="font-black text-purple-600 text-xs font-mono">
                              +₦{sale.sellerShare.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Owner 30%</span>
                            <span className="font-bold text-slate-500 text-xs font-mono">
                              ₦{sale.ownerShare.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="bg-purple-50/30 px-5 sm:px-6 py-3 border-t border-purple-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                Live database synced with Firestore
              </span>
              <button
                onClick={() => setShowRevenueAnalysis(false)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition cursor-pointer"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
