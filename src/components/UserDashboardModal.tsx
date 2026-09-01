import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { AccountListing, Inquiry, UserProfile, PurchaseRecord, ReferralRecord } from '../types';
import { 
  X, 
  Store, 
  MessageSquare, 
  Bookmark, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  User as UserIcon, 
  ExternalLink,
  ShieldCheck,
  Tag,
  ShoppingBag,
  Key,
  Eye,
  Settings,
  Mail,
  Phone,
  Send,
  LogOut,
  Save,
  Check,
  Lock,
  Globe,
  Bell,
  Sparkles,
  HelpCircle,
  Copy,
  ChevronRight,
  Shield,
  EyeOff,
  Gift,
  Share2,
  Users,
  DollarSign,
  Award,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { db, sanitizeFirestorePayload } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { AdminWalletsView } from './AdminWalletsView';

export type DashboardTab = 'profile' | 'purchases' | 'saved' | 'recent' | 'inquiries' | 'listings' | 'referrals' | 'settings' | 'wallets';

interface UserDashboardModalProps {
  user: User | null;
  userProfile: UserProfile | null;
  initialTab?: DashboardTab;
  myListings: AccountListing[];
  inquiries: Inquiry[];
  savedListings: AccountListing[];
  recentlyViewedListings?: AccountListing[];
  purchases?: PurchaseRecord[];
  onClose: () => void;
  onSelectListing: (listing: AccountListing) => void;
  onUpdateListingStatus: (listingId: string, newStatus: 'active' | 'sold') => Promise<void>;
  onDeleteListing: (listingId: string) => Promise<void>;
  onRemoveSaved: (listingId: string) => void;
  onClearRecentlyViewed?: () => void;
  onBuyNow?: (listing: AccountListing) => void;
  onContactSeller?: (listing: AccountListing) => void;
  onUpdateProfile?: (profileData: Partial<UserProfile>) => Promise<void>;
  onSignOut?: () => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

export const UserDashboardModal: React.FC<UserDashboardModalProps> = ({
  user,
  userProfile,
  initialTab = 'profile',
  myListings,
  inquiries,
  savedListings,
  recentlyViewedListings = [],
  purchases = [],
  onClose,
  onSelectListing,
  onUpdateListingStatus,
  onDeleteListing,
  onRemoveSaved,
  onClearRecentlyViewed,
  onBuyNow,
  onContactSeller,
  onUpdateProfile,
  onSignOut,
  onOpenAuth
}) => {
  const isOwner = user?.email?.toLowerCase() === 'azeezmusharaf4@gmail.com' || userProfile?.role === 'owner';
  const isAdmin = isOwner || userProfile?.role === 'admin';

  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  // Profile Edit State
  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || ''
  );
  const [whatsapp, setWhatsapp] = useState(userProfile?.whatsapp || '');
  const [telegram, setTelegram] = useState(userProfile?.telegram || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [preferredCurrency, setPreferredCurrency] = useState<string>(
    userProfile?.preferredCurrency || 'USD'
  );
  const [emailNotifications, setEmailNotifications] = useState<boolean>(
    userProfile?.emailNotifications ?? true
  );

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  // Copy state for credentials & referrals
  const [copiedItemKey, setCopiedItemKey] = useState<string | null>(null);

  // Referral State & Firestore Subscription
  const [referralsList, setReferralsList] = useState<ReferralRecord[]>([]);

  const userReferralCode = userProfile?.referralCode || (user ? `ZN-${user.uid.substring(0, 6).toUpperCase()}` : 'ZN-HUB');
  const userReferralLink = typeof window !== 'undefined' ? `${window.location.origin}?ref=${userReferralCode}` : `https://zenethub.com/?ref=${userReferralCode}`;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referrals'), where('referrerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ReferralRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ReferralRecord);
      });
      list.sort((a, b) => new Date(b.referredAt || 0).getTime() - new Date(a.referredAt || 0).getTime());
      setReferralsList(list);
    }, (err) => {
      console.warn('Error reading referrals:', err);
    });
    return () => unsubscribe();
  }, [user]);

  // Reply message state in Inquiries tab
  const [replyText, setReplyText] = useState<{ [inquiryId: string]: string }>({});
  const [replySentIds, setReplySentIds] = useState<string[]>([]);

  const handleCopyCredential = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItemKey(key);
    setTimeout(() => setCopiedItemKey(null), 2000);
  };

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05020c]/90 backdrop-blur-md overflow-y-auto">
        <div 
          className="bg-[#120826] border border-[#2d1952] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-purple-100 p-8 flex flex-col items-center text-center gap-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-purple-900/30 text-purple-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Logo/Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 p-0.5 shadow-lg shadow-purple-600/30 flex items-center justify-center mt-4">
            <Store className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Welcome to ZENET HUB</h2>
            <p className="text-xs text-purple-200/80 leading-relaxed max-w-sm">
              The premier marketplace for premium social media accounts, PVAs, 2FA protection, and digital assets. Secure escrow transactions and instant auto-deliveries.
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <button
              onClick={() => {
                onClose();
                if (onOpenAuth) {
                  onOpenAuth('login');
                } else {
                  // Fallback
                  setTimeout(() => {
                    const btn = document.querySelector('[data-auth-trigger="login"]') as HTMLButtonElement;
                    if (btn) btn.click();
                  }, 100);
                }
              }}
              className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black py-3.5 px-4 rounded-2xl shadow-lg hover:shadow-purple-600/20 active:scale-[0.98] transition cursor-pointer"
            >
              LOG IN / REGISTER
            </button>
            <button
              onClick={onClose}
              className="w-full bg-[#1c0e35] hover:bg-[#251544] text-purple-200 font-bold text-xs py-3.5 px-4 rounded-2xl border border-[#31195a] transition cursor-pointer"
            >
              Explore Marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Save profile to Firestore
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
        preferredCurrency,
        emailNotifications
      });

      // 1. Update Firestore user doc
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, updatedData);

      // 2. Call parent callback if provided
      if (onUpdateProfile) {
        await onUpdateProfile(updatedData);
      }

      setProfileSuccessMsg('Profile settings updated successfully!');
      setTimeout(() => setProfileSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setProfileError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSendReply = (inquiry: Inquiry) => {
    const text = replyText[inquiry.id];
    if (!text || !text.trim()) return;

    // Simulate sending reply or alert
    setReplySentIds(prev => [...prev, inquiry.id]);
    setReplyText(prev => ({ ...prev, [inquiry.id]: '' }));
    alert(`Reply sent to ${inquiry.buyerName || 'Seller'}: "${text.trim()}"`);
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
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-violet-600 to-indigo-600 text-white font-black flex items-center justify-center text-base shadow-md">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0c051a] rounded-full" title="Online & Verified" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-white text-base sm:text-lg leading-tight">
                  {user.displayName || userProfile?.displayName || user.email?.split('@')[0]}
                </h2>
                <span className="bg-purple-950/80 text-purple-300 border border-purple-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  {userProfile?.role === 'admin' ? 'Admin Account' : userProfile?.role === 'seller' ? 'Seller Account' : 'Buyer Account'}
                </span>
              </div>
              <span className="text-xs text-purple-300/60 font-mono">{user.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSignOut && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to log out of your ZENET account?')) {
                    onClose();
                    onSignOut();
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 hover:border-rose-600 rounded-xl transition text-xs font-bold cursor-pointer"
                title="Log out of account"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Sign out</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-purple-300 hover:text-white bg-[#1c0f38] border border-[#361d66] rounded-full transition cursor-pointer"
              title="Close Dashboard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Body Scrollable Container */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">

          {/* ========================================================= */}
          {/* TAB 1: PROFILE OVERVIEW */}
          {/* ========================================================= */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Profile Card Summary Banner */}
              <div className="bg-gradient-to-r from-[#1b0e38] via-[#160a2f] to-[#1d0b3e] border border-[#351a66] p-5 rounded-3xl relative overflow-hidden shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700 text-white font-black flex items-center justify-center text-2xl shadow-lg border border-purple-400/30">
                      {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-lg sm:text-xl">{displayName}</h3>
                        <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Verified
                        </span>
                      </div>
                      <p className="text-xs text-purple-300/70 font-mono">{user.email}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-purple-300/80 pt-1">
                        {whatsapp && <span className="flex items-center gap-1 font-semibold text-emerald-400"><Phone className="w-3 h-3" /> WhatsApp: {whatsapp}</span>}
                        {telegram && <span className="flex items-center gap-1 font-semibold text-cyan-400"><Send className="w-3 h-3" /> Telegram: {telegram}</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('settings')}
                    className="bg-[#2a1354] hover:bg-[#381a70] text-purple-200 border border-[#48228d] font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                  >
                    <Settings className="w-4 h-4 text-purple-300" />
                    <span>Edit Profile</span>
                  </button>
                </div>
              </div>

              {/* Quick Dashboard Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#170c30] border border-[#2e1852] p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-purple-300/60 uppercase font-bold block tracking-wider">Purchases</span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-white">{purchases.length}</span>
                    <ShoppingBag className="w-5 h-5 text-emerald-400 opacity-80" />
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold block">In Escrow Vault</span>
                </div>

                <div className="bg-[#170c30] border border-[#2e1852] p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-purple-300/60 uppercase font-bold block tracking-wider">Saved Items</span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-white">{savedListings.length}</span>
                    <Bookmark className="w-5 h-5 text-amber-400 opacity-80" />
                  </div>
                  <span className="text-[10px] text-amber-300 font-semibold block">Shortlist</span>
                </div>

                <div className="bg-[#170c30] border border-[#2e1852] p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-purple-300/60 uppercase font-bold block tracking-wider">Recent Viewed</span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-white">{recentlyViewedListings.length}</span>
                    <Eye className="w-5 h-5 text-cyan-400 opacity-80" />
                  </div>
                  <span className="text-[10px] text-cyan-300 font-semibold block">Browsed</span>
                </div>

                {isAdmin && (
                  <div className="bg-[#170c30] border border-[#2e1852] p-4 rounded-2xl space-y-1 shadow-md">
                    <span className="text-[10px] text-purple-300/60 uppercase font-bold block tracking-wider">Inquiries</span>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-white">{inquiries.length}</span>
                      <MessageSquare className="w-5 h-5 text-indigo-400 opacity-80" />
                    </div>
                    <span className="text-[10px] text-indigo-300 font-semibold block">Messages</span>
                  </div>
                )}
              </div>

              {/* Owner Give Credit Quick Access Banner */}
              {isOwner && (
                <div className="bg-gradient-to-r from-emerald-950/80 via-[#0d2822] to-[#120826] border border-emerald-500/40 p-5 rounded-3xl relative overflow-hidden shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                      <Wallet className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-white text-sm sm:text-base">Give Credit / Add Virtual Store Credit</h4>
                        <span className="bg-emerald-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                          OWNER ONLY
                        </span>
                      </div>
                      <p className="text-xs text-emerald-200/70 mt-0.5 max-w-lg">
                        Directly grant, adjust, or override virtual wallet credits for any buyer account in the system.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('wallets')}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-500/20 shrink-0"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Open Give Credit Tool</span>
                  </button>
                </div>
              )}

              {/* Profile Details Update Form */}
              <div className="bg-[#170c30] border border-[#2e1852] p-5 rounded-3xl space-y-4 shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-[#281547]">
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-purple-400" />
                    Buyer Contact Information & Preferences
                  </h4>
                  <span className="text-[11px] text-purple-300/60">Synced with Firestore</span>
                </div>

                {profileSuccessMsg && (
                  <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{profileSuccessMsg}</span>
                  </div>
                )}

                {profileError && (
                  <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                    <X className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{profileError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-purple-300/80 font-semibold mb-1">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full bg-[#100722] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-purple-300/80 font-semibold mb-1">Account Email (Read-only)</label>
                      <input
                        type="email"
                        disabled
                        value={user.email || ''}
                        className="w-full bg-[#0a0416] text-purple-300/50 p-2.5 rounded-xl border border-[#22123f] cursor-not-allowed font-mono text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-purple-300/80 font-semibold mb-1">WhatsApp Contact (Optional)</label>
                      <input
                        type="text"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="+234 800 000 0000"
                        className="w-full bg-[#100722] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-purple-300/80 font-semibold mb-1">Telegram Handle (Optional)</label>
                      <input
                        type="text"
                        value={telegram}
                        onChange={(e) => setTelegram(e.target.value)}
                        placeholder="@username"
                        className="w-full bg-[#100722] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-purple-300/80 font-semibold mb-1">Buyer Notes / Preferred Categories</label>
                    <textarea
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="e.g. Interested in aged 2018-2022 Facebook PVA accounts & TikTok Monetized Creators."
                      className="w-full bg-[#100722] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs sm:text-sm resize-none"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 flex items-center gap-2 text-xs sm:text-sm"
                    >
                      {isSavingProfile ? (
                        <span>Saving...</span>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Profile Updates</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: MY ORDERS & ESCROW HISTORY */}
          {/* ========================================================= */}
          {activeTab === 'purchases' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-400" />
                    My Escrow Orders & Purchases
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Accounts purchased with 7-Day Escrow Money-Back Guarantee
                  </p>
                </div>
                <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold px-3 py-1 rounded-full">
                  {purchases.length} Total Orders
                </span>
              </div>

              {purchases.length === 0 ? (
                <div className="text-center py-14 bg-[#150a2b] border border-dashed border-[#2d1952] rounded-3xl p-6 space-y-3">
                  <div className="w-14 h-14 bg-purple-900/30 text-purple-400 rounded-full flex items-center justify-center mx-auto border border-purple-500/30">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <h4 className="text-white font-extrabold text-sm">No Purchases Yet</h4>
                  <p className="text-purple-300/70 text-xs max-w-sm mx-auto">
                    When you purchase Facebook, TikTok, Instagram, or Gmail accounts, your orders and escrow security tokens will appear here.
                  </p>
                  <button
                    onClick={onClose}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-lg transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>Browse Accounts Marketplace</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                purchases.map((ord) => (
                  <div key={ord.id} className="bg-[#170c30] border border-[#2d1952] p-4 sm:p-5 rounded-3xl space-y-3 shadow-lg hover:border-purple-500/40 transition">
                    
                    {/* Top Status Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#281548] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          {ord.status === 'completed' ? 'Escrow Released' : 'Held in Safe Escrow'}
                        </span>

                        <span className="bg-purple-950/90 text-purple-300 border border-purple-800/80 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                          {ord.paymentGateway || 'Paystack'} Gateway
                        </span>
                      </div>

                      <span className="text-xs text-purple-300/60 font-mono">
                        {new Date(ord.purchasedAt).toLocaleDateString()} {new Date(ord.purchasedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Order Details */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                          {ord.type === 'virtual_number' 
                            ? 'Virtual Number OTP Slot' 
                            : ord.type === 'log_account' 
                              ? 'Automated Log Account' 
                              : `${ord.category || 'Platform'} Account`}
                        </span>
                        <h4 className="font-extrabold text-white text-base leading-snug">{ord.listingTitle}</h4>
                        <p className="text-xs text-purple-300/80">
                          {ord.type === 'virtual_number' ? (
                            <>
                              Provider: <strong className="text-purple-300 font-semibold">OneGridHub Carrier</strong>
                            </>
                          ) : ord.type === 'log_account' ? (
                            <>
                              Provider: <strong className="text-purple-300 font-semibold">OneGridHub Log Store</strong>
                            </>
                          ) : (
                            <>
                              Seller: <strong className="text-white font-semibold">{ord.sellerName || 'Zenet Agent'}</strong> {ord.sellerEmail && `(${ord.sellerEmail})`}
                            </>
                          )}
                        </p>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] text-purple-300/60 font-bold uppercase block">Paid Amount</span>
                        <span className="text-xl font-black text-white font-mono">
                          {ord.currency || 'USD'} {Number(ord.paidAmount || ord.price).toLocaleString()}
                        </span>
                        {ord.price && (
                          <span className="text-[10px] text-purple-300/60 block">
                            (₦{ord.price.toLocaleString()} NGN)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ref */}
                    {ord.transactionId && (
                      <div className="text-[11px] text-purple-300/60 font-mono">
                        Transaction Ref: <span className="text-purple-200">{ord.transactionId}</span>
                      </div>
                    )}

                    {/* Revealed Digital Credentials Section */}
                    <div className="bg-[#120826] border border-[#3b1d73] p-4 rounded-2xl space-y-3 mt-3">
                      <div className="flex items-center justify-between border-b border-[#2d1952] pb-2.5">
                        <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
                          {ord.type === 'virtual_number' ? (
                            <>
                              <Phone className="w-4 h-4 text-purple-400" />
                              <span>Active Virtual Number OTP Info</span>
                            </>
                          ) : (
                            <>
                              <Key className="w-4 h-4 text-amber-300" />
                              <span>🔑 Digital Product Credentials (Purchased & Revealed)</span>
                            </>
                          )}
                        </div>
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-md font-bold uppercase">
                          {ord.type === 'virtual_number' ? 'Activation Slot' : 'Buyer Access Only'}
                        </span>
                      </div>

                      {ord.type === 'virtual_number' ? (
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between bg-[#0a0418] p-2.5 rounded-xl border border-[#231245]">
                            <div>
                              <span className="text-[10px] text-purple-300/60 font-bold block uppercase">Assigned Phone Number</span>
                              <span className="text-white font-mono font-bold">{ord.phoneNumber || 'Provisioning...'}</span>
                            </div>
                            {ord.phoneNumber && (
                              <button
                                onClick={() => handleCopyCredential(ord.phoneNumber, `${ord.id}_phone`)}
                                className={`p-1.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                                  copiedItemKey === `${ord.id}_phone`
                                    ? 'bg-emerald-600 text-white border-emerald-400'
                                    : 'bg-[#211242] hover:bg-[#311961] text-purple-200 border-[#3c1d75]'
                                }`}
                              >
                                {copiedItemKey === `${ord.id}_phone` ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3 text-purple-300" />}
                                <span>{copiedItemKey === `${ord.id}_phone` ? 'Copied' : 'Copy'}</span>
                              </button>
                            )}
                          </div>

                          <div className="bg-[#0a0418] p-3 rounded-xl border border-[#231245] space-y-2">
                            <span className="text-[10px] text-purple-300/60 font-bold block uppercase">Verification Code (OTP) Status</span>
                            
                            {ord.smsCode ? (
                              <div className="flex items-center justify-between bg-emerald-950/20 border border-emerald-500/25 p-2 rounded-lg">
                                <span className="text-emerald-400 font-black font-mono text-base tracking-widest">{ord.smsCode}</span>
                                <button
                                  onClick={() => handleCopyCredential(ord.smsCode, `${ord.id}_otp`)}
                                  className={`p-1 rounded text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                                    copiedItemKey === `${ord.id}_otp`
                                      ? 'bg-emerald-600 text-white border-emerald-400'
                                      : 'bg-[#211242] hover:bg-[#311961] text-purple-200 border-[#3c1d75]'
                                  }`}
                                >
                                  {copiedItemKey === `${ord.id}_otp` ? 'Copied' : 'Copy OTP'}
                                </button>
                              </div>
                            ) : (
                              <p className="text-[11px] text-purple-300/50 animate-pulse font-medium">
                                Waiting for incoming SMS... {ord.orderStatus === 'CANCELLED' ? '(Session Expired or Cancelled)' : ''}
                              </p>
                            )}

                            {ord.smsText && (
                              <div className="bg-[#120826] p-2 rounded border border-purple-900/30 font-mono text-[11px] text-slate-300">
                                {ord.smsText}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : ord.digitalProductDetails && (ord.digitalProductDetails.accountEmail || ord.digitalProductDetails.accountPassword || ord.digitalProductDetails.recoveryInfo || ord.digitalProductDetails.backupCodes || ord.digitalProductDetails.additionalInstructions) ? (
                        <div className="space-y-2.5 text-xs">
                          {ord.digitalProductDetails.accountEmail && (
                            <div className="flex items-center justify-between bg-[#0a0418] p-2.5 rounded-xl border border-[#231245]">
                              <div>
                                <span className="text-[10px] text-purple-300/60 font-bold block uppercase">Account Email / Login</span>
                                <span className="text-white font-mono font-bold">{ord.digitalProductDetails.accountEmail}</span>
                              </div>
                              <button
                                onClick={() => handleCopyCredential(ord.digitalProductDetails?.accountEmail || '', `${ord.id}_email`)}
                                className={`p-1.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                                  copiedItemKey === `${ord.id}_email`
                                    ? 'bg-emerald-600 text-white border-emerald-400'
                                    : 'bg-[#211242] hover:bg-[#311961] text-purple-200 border-[#3c1d75]'
                                }`}
                              >
                                {copiedItemKey === `${ord.id}_email` ? (
                                  <>
                                    <Check className="w-3 h-3 text-white" /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-purple-300" /> Copy
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {ord.digitalProductDetails.accountPassword && (
                            <div className="flex items-center justify-between bg-[#0a0418] p-2.5 rounded-xl border border-[#231245]">
                              <div>
                                <span className="text-[10px] text-purple-300/60 font-bold block uppercase">Account Password</span>
                                <span className="text-amber-300 font-mono font-bold">{ord.digitalProductDetails.accountPassword}</span>
                              </div>
                              <button
                                onClick={() => handleCopyCredential(ord.digitalProductDetails?.accountPassword || '', `${ord.id}_pass`)}
                                className={`p-1.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                                  copiedItemKey === `${ord.id}_pass`
                                    ? 'bg-emerald-600 text-white border-emerald-400'
                                    : 'bg-[#211242] hover:bg-[#311961] text-purple-200 border-[#3c1d75]'
                                }`}
                              >
                                {copiedItemKey === `${ord.id}_pass` ? (
                                  <>
                                    <Check className="w-3 h-3 text-white" /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-purple-300" /> Copy
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {ord.digitalProductDetails.recoveryInfo && (
                            <div className="flex items-center justify-between bg-[#0a0418] p-2.5 rounded-xl border border-[#231245]">
                              <div>
                                <span className="text-[10px] text-purple-300/60 font-bold block uppercase">Recovery Info</span>
                                <span className="text-purple-100 font-mono">{ord.digitalProductDetails.recoveryInfo}</span>
                              </div>
                              <button
                                onClick={() => handleCopyCredential(ord.digitalProductDetails?.recoveryInfo || '', `${ord.id}_rec`)}
                                className={`p-1.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                                  copiedItemKey === `${ord.id}_rec`
                                    ? 'bg-emerald-600 text-white border-emerald-400'
                                    : 'bg-[#211242] hover:bg-[#311961] text-purple-200 border-[#3c1d75]'
                                }`}
                              >
                                {copiedItemKey === `${ord.id}_rec` ? (
                                  <>
                                    <Check className="w-3 h-3 text-white" /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-purple-300" /> Copy
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {ord.digitalProductDetails.twoFactorSecretKey && (
                            <div className="bg-[#0a0418] p-2.5 rounded-xl border border-amber-500/30">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-amber-300/80 font-bold uppercase">2FA Authenticator Secret Key</span>
                                <button
                                  onClick={() => handleCopyCredential(ord.digitalProductDetails?.twoFactorSecretKey || '', `${ord.id}_2fa_sec`)}
                                  className={`p-1.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                                    copiedItemKey === `${ord.id}_2fa_sec`
                                      ? 'bg-emerald-600 text-white border-emerald-400'
                                      : 'bg-[#251342] hover:bg-[#371b63] text-amber-200 border-[#4a237d]'
                                  }`}
                                >
                                  {copiedItemKey === `${ord.id}_2fa_sec` ? (
                                    <>
                                      <Check className="w-3 h-3 text-white" /> Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-amber-300" /> Copy Secret Key
                                    </>
                                  )}
                                </button>
                              </div>
                              <code className="text-amber-200 font-mono text-xs select-all block break-all">{ord.digitalProductDetails.twoFactorSecretKey}</code>
                            </div>
                          )}

                          {(ord.digitalProductDetails.twoFactorBackupCodes || ord.digitalProductDetails.backupCodes) && (
                            <div className="bg-[#0a0418] p-2.5 rounded-xl border border-[#231245]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-purple-300/60 font-bold uppercase">2FA Backup Codes</span>
                                <button
                                  onClick={() => handleCopyCredential(ord.digitalProductDetails?.twoFactorBackupCodes || ord.digitalProductDetails?.backupCodes || '', `${ord.id}_2fa`)}
                                  className={`p-1.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                                    copiedItemKey === `${ord.id}_2fa`
                                      ? 'bg-emerald-600 text-white border-emerald-400'
                                      : 'bg-[#211242] hover:bg-[#311961] text-purple-200 border-[#3c1d75]'
                                  }`}
                                >
                                  {copiedItemKey === `${ord.id}_2fa` ? (
                                    <>
                                      <Check className="w-3 h-3 text-white" /> Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-purple-300" /> Copy Codes
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-amber-200 font-mono text-[11px] whitespace-pre-wrap break-all">{ord.digitalProductDetails.twoFactorBackupCodes || ord.digitalProductDetails.backupCodes}</p>
                            </div>
                          )}

                          {ord.digitalProductDetails.additionalInstructions && (
                            <div className="bg-[#0a0418] p-2.5 rounded-xl border border-[#231245]">
                              <span className="text-[10px] text-purple-300/60 font-bold block uppercase mb-1">Transfer & Takeover Instructions</span>
                              <p className="text-purple-200 text-xs leading-relaxed">{ord.digitalProductDetails.additionalInstructions}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-purple-300/70 italic">
                          Credentials will be provided by seller upon takeover request. Contact seller directly using contact info.
                        </p>
                      )}
                    </div>

                    {/* Escrow Release Token Box */}
                    {ord.transferCode && (
                      <div className="bg-[#1f103d] border border-[#381c6e] p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <Key className="w-4 h-4 text-amber-300 shrink-0" />
                          <div>
                            <span className="text-purple-300/70 text-[10px] uppercase font-bold block">
                              Escrow Verification Release Token
                            </span>
                            <code className="text-amber-300 font-mono font-black text-xs sm:text-sm tracking-wider">
                              {ord.transferCode}
                            </code>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(ord.transferCode || '');
                            alert('Escrow Token copied to clipboard!');
                          }}
                          className="bg-[#2a1354] hover:bg-[#381b70] text-purple-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-[#48228d] transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5 text-purple-300" />
                          <span>Copy Token</span>
                        </button>
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: SAVED SHORTLIST */}
          {/* ========================================================= */}
          {activeTab === 'saved' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-amber-400" />
                    Saved Account Shortlist
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Accounts you saved for quick comparison and purchase
                  </p>
                </div>
                <span className="bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-3 py-1 rounded-full">
                  {savedListings.length} Saved
                </span>
              </div>

              {savedListings.length === 0 ? (
                <div className="text-center py-14 bg-[#150a2b] border border-dashed border-[#2d1952] rounded-3xl p-6 space-y-3">
                  <div className="w-14 h-14 bg-amber-900/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
                    <Bookmark className="w-7 h-7" />
                  </div>
                  <h4 className="text-white font-extrabold text-sm">Your Shortlist is Empty</h4>
                  <p className="text-purple-300/70 text-xs max-w-sm mx-auto">
                    Click the bookmark star/icon on any listing card to save accounts to your shortlist!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedListings.map((listing) => (
                    <div key={listing.id} className="bg-[#170c30] border border-[#2d1952] p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-md hover:border-purple-500/40 transition">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-purple-400 uppercase bg-purple-950/70 border border-purple-800/60 px-2 py-0.5 rounded">
                            {listing.category}
                          </span>
                          <span className="text-sm font-black text-white">₦{Number(listing.price).toLocaleString()}</span>
                        </div>
                        <h4 
                          onClick={() => { onClose(); onSelectListing(listing); }}
                          className="font-extrabold text-white hover:text-purple-300 transition cursor-pointer text-sm line-clamp-2"
                        >
                          {listing.title}
                        </h4>
                        <p className="text-xs text-purple-300/60 line-clamp-1">{listing.description}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#261448]">
                        <button
                          onClick={() => { onClose(); onSelectListing(listing); }}
                          className="text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-400" />
                          <span>Inspect</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {onBuyNow && (
                            <button
                              onClick={() => {
                                onClose();
                                onBuyNow(listing);
                              }}
                              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-md"
                            >
                              <Lock className="w-3 h-3 text-purple-200" />
                              <span>Buy Now</span>
                            </button>
                          )}

                          <button
                            onClick={() => onRemoveSaved(listing.id)}
                            className="p-1.5 text-purple-400/60 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                            title="Remove from saved"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: RECENTLY VIEWED */}
          {/* ========================================================= */}
          {activeTab === 'recent' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <Eye className="w-5 h-5 text-cyan-400" />
                    Recently Viewed Accounts
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Accounts you recently inspected in this session
                  </p>
                </div>

                {recentlyViewedListings.length > 0 && onClearRecentlyViewed && (
                  <button
                    onClick={onClearRecentlyViewed}
                    className="text-xs text-purple-400/80 hover:text-rose-300 font-semibold transition cursor-pointer"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {recentlyViewedListings.length === 0 ? (
                <div className="text-center py-14 bg-[#150a2b] border border-dashed border-[#2d1952] rounded-3xl p-6 space-y-3">
                  <div className="w-14 h-14 bg-cyan-950/40 text-cyan-400 rounded-full flex items-center justify-center mx-auto border border-cyan-500/30">
                    <Eye className="w-7 h-7" />
                  </div>
                  <h4 className="text-white font-extrabold text-sm">No Recently Viewed Accounts</h4>
                  <p className="text-purple-300/70 text-xs max-w-sm mx-auto">
                    Browse account listings on the marketplace home page to track your view history here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentlyViewedListings.map((listing) => (
                    <div key={listing.id} className="bg-[#170c30] border border-[#2d1952] p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md hover:border-purple-500/40 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-purple-950/70 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            {listing.category}
                          </span>
                          {listing.followers && (
                            <span className="text-[10px] text-purple-300/70 font-semibold">
                              {listing.followers}
                            </span>
                          )}
                        </div>
                        <h4 
                          onClick={() => { onClose(); onSelectListing(listing); }}
                          className="font-bold text-white hover:text-cyan-400 transition cursor-pointer text-sm line-clamp-1"
                        >
                          {listing.title}
                        </h4>
                        <p className="text-xs text-purple-300/60">Asking Price: <strong className="text-white">₦{Number(listing.price).toLocaleString()}</strong></p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { onClose(); onSelectListing(listing); }}
                          className="bg-[#241246] hover:bg-[#321960] text-purple-200 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-[#3c1d73] transition cursor-pointer flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5 text-purple-300" />
                        </button>

                        {onBuyNow && (
                          <button
                            onClick={() => {
                              onClose();
                              onBuyNow(listing);
                            }}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Buy</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: MESSAGES & INQUIRIES */}
          {/* ========================================================= */}
          {activeTab === 'inquiries' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-400" />
                    Messages & Seller Inquiries
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Direct communications with account sellers regarding credentials & transfers
                  </p>
                </div>
                <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold px-3 py-1 rounded-full">
                  {inquiries.length} Messages
                </span>
              </div>

              {inquiries.length === 0 ? (
                <div className="text-center py-14 bg-[#150a2b] border border-dashed border-[#2d1952] rounded-3xl p-6 space-y-3">
                  <div className="w-14 h-14 bg-indigo-950/40 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-500/30">
                    <MessageSquare className="w-7 h-7" />
                  </div>
                  <h4 className="text-white font-extrabold text-sm">No Messages Yet</h4>
                  <p className="text-purple-300/70 text-xs max-w-sm mx-auto">
                    When you contact sellers about account listings, your message threads and responses will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inquiries.map((inq) => (
                    <div key={inq.id} className="bg-[#170c30] border border-[#2d1952] p-4.5 rounded-3xl space-y-3 shadow-md">
                      
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-[#271447]">
                        <span className="font-extrabold text-purple-300 flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                          From: {inq.buyerName || 'User'} ({inq.buyerEmail})
                        </span>
                        <span className="text-[10px] text-purple-300/50 font-mono">
                          {new Date(inq.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="bg-[#100722] p-3 rounded-2xl border border-[#271348] text-xs text-purple-100 space-y-1">
                        <span className="text-[10px] text-purple-400 font-extrabold uppercase block">
                          Listing: {inq.listingTitle}
                        </span>
                        <p className="whitespace-pre-line leading-relaxed">{inq.message}</p>
                      </div>

                      {/* Reply Input Box */}
                      <div className="pt-1 flex gap-2">
                        <input
                          type="text"
                          value={replyText[inq.id] || ''}
                          onChange={(e) => setReplyText(prev => ({ ...prev, [inq.id]: e.target.value }))}
                          placeholder="Type a message reply..."
                          className="flex-1 bg-[#100722] text-white p-2.5 rounded-xl border border-[#2b174f] focus:outline-none focus:border-purple-500 text-xs"
                        />
                        <button
                          onClick={() => handleSendReply(inq)}
                          disabled={!replyText[inq.id]?.trim()}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-40 text-xs flex items-center gap-1 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Reply</span>
                        </button>
                      </div>

                      {replySentIds.includes(inq.id) && (
                        <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Reply dispatched to recipient</span>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: MY LISTINGS (SELLER TAB) */}
          {/* ========================================================= */}
          {activeTab === 'listings' && (userProfile?.role === 'seller' || userProfile?.role === 'admin') && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <Store className="w-5 h-5 text-violet-400" />
                    My Listed Accounts for Sale
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Manage active listings, sales performance & escrow status
                  </p>
                </div>
                <span className="bg-violet-950/80 text-violet-300 border border-violet-500/40 text-[11px] font-bold px-3 py-1 rounded-full self-start sm:self-auto">
                  {myListings.length} Listed
                </span>
              </div>

              {/* Sales Statistics Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#14092b] border border-[#2d1852] p-3 rounded-2xl space-y-0.5">
                  <span className="text-[10px] text-purple-300/60 font-bold uppercase block">Total Listings</span>
                  <span className="text-lg font-black text-white font-mono">{myListings.length}</span>
                </div>

                <div className="bg-[#0b201d] border border-[#1b4d44] p-3 rounded-2xl space-y-0.5">
                  <span className="text-[10px] text-emerald-300/60 font-bold uppercase block">Active Inventory</span>
                  <span className="text-lg font-black text-emerald-300 font-mono">
                    {myListings.filter((l) => l.status === 'active').length}
                  </span>
                </div>

                <div className="bg-[#240e29] border border-[#481c52] p-3 rounded-2xl space-y-0.5">
                  <span className="text-[10px] text-amber-300/60 font-bold uppercase block">Sold Accounts</span>
                  <span className="text-lg font-black text-amber-300 font-mono">
                    {myListings.filter((l) => l.status === 'sold').length}
                  </span>
                </div>

                <div className="bg-[#190d3d] border border-[#3b1f7a] p-3 rounded-2xl space-y-0.5">
                  <span className="text-[10px] text-cyan-300/60 font-bold uppercase block">Total Revenue</span>
                  <span className="text-lg font-black text-white font-mono">
                    ₦{myListings
                      .filter((l) => l.status === 'sold')
                      .reduce((sum, l) => sum + (Number(l.price) || 0), 0)
                      .toLocaleString()}
                  </span>
                </div>
              </div>

              {myListings.length === 0 ? (
                <div className="text-center py-14 bg-[#150a2b] border border-dashed border-[#2d1952] rounded-3xl p-6 space-y-3">
                  <div className="w-14 h-14 bg-violet-950/40 text-violet-400 rounded-full flex items-center justify-center mx-auto border border-violet-500/30">
                    <Store className="w-7 h-7" />
                  </div>
                  <h4 className="text-white font-extrabold text-sm">No Accounts Listed Yet</h4>
                  <p className="text-purple-300/70 text-xs max-w-sm mx-auto">
                    Click "List Account" on the top navigation bar to list your Facebook, TikTok, Instagram, or Gmail accounts for sale!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myListings.map((listing) => (
                    <div key={listing.id} className="bg-[#170c30] p-4 rounded-2xl border border-[#2d1952] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-purple-950/70 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
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
                        <h4 
                          onClick={() => { onClose(); onSelectListing(listing); }}
                          className="font-bold text-white hover:text-purple-300 transition cursor-pointer text-sm"
                        >
                          {listing.title}
                        </h4>
                        <p className="text-xs text-purple-300/70">
                          Asking Price: <strong className="text-white">₦{Number(listing.price).toLocaleString()}</strong> • Followers: {listing.followers || 'N/A'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {listing.status === 'active' ? (
                          <button
                            onClick={() => onUpdateListingStatus(listing.id, 'sold')}
                            className="bg-[#211043] hover:bg-[#2e165b] text-amber-300 border border-[#3e1e78] text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                          >
                            Mark as Sold
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateListingStatus(listing.id, 'active')}
                            className="bg-[#211043] hover:bg-[#2e165b] text-emerald-300 border border-[#3e1e78] text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                          >
                            Re-list Active
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteListing(listing.id)}
                          className="p-2 bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-800/80 rounded-xl transition cursor-pointer"
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
          {/* TAB 7: REFERRALS & REWARDS */}
          {/* ========================================================= */}
          {activeTab === 'referrals' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Header Hero Banner */}
              <div className="bg-gradient-to-r from-amber-950/80 via-purple-950/80 to-indigo-950/80 border border-amber-500/40 p-5 rounded-3xl relative overflow-hidden shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 font-black flex items-center justify-center shadow-lg shrink-0">
                      <Gift className="w-8 h-8 text-slate-950" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-lg sm:text-xl">Invite Friends & Earn ₦100 per User</h3>
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Unlimited Earnings
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/80 max-w-xl leading-relaxed">
                        Share your unique referral code or link. When a referred friend completes <strong className="text-white">₦1,000</strong> or more in account purchases, you automatically receive a <strong className="text-amber-300 font-bold">₦100 NGN</strong> wallet bonus!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Referral Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#170c30] border border-[#2e1852] p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-purple-300/60 uppercase font-bold block tracking-wider">Total Friends Referred</span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-white">{referralsList.length}</span>
                    <Users className="w-5 h-5 text-purple-400 opacity-80" />
                  </div>
                  <span className="text-[10px] text-purple-300/80 font-semibold block">Registered via your link</span>
                </div>

                <div className="bg-[#170c30] border border-amber-500/30 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-amber-300/60 uppercase font-bold block tracking-wider">Total Referral Earnings</span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-amber-300">
                      ₦{(userProfile?.totalReferralEarnings || referralsList.filter(r => r.rewardClaimed).reduce((sum, r) => sum + (r.rewardAmount || 100), 0)).toLocaleString()} NGN
                    </span>
                    <DollarSign className="w-5 h-5 text-amber-400 opacity-80" />
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold block">Credited directly to Wallet</span>
                </div>

                <div className="bg-[#170c30] border border-[#2e1852] p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-purple-300/60 uppercase font-bold block tracking-wider">Bonus Rate</span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-emerald-400">₦100 / user</span>
                    <Award className="w-5 h-5 text-emerald-400 opacity-80" />
                  </div>
                  <span className="text-[10px] text-emerald-300 font-semibold block">Triggers at ₦1,000 spend</span>
                </div>
              </div>

              {/* Share Code & Link Box */}
              <div className="bg-[#170c30] border border-[#2e1852] p-5 rounded-3xl space-y-4 shadow-lg">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-amber-400" />
                  Your Unique Referral Credentials
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Code Box */}
                  <div className="bg-[#0f0721] p-4 rounded-2xl border border-[#281547] space-y-2">
                    <label className="text-[11px] font-bold text-purple-300/70 uppercase tracking-wider block">Your Referral Code</label>
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-purple-500/30 font-mono text-base font-extrabold text-amber-300 tracking-wider flex-1">
                        {userReferralCode}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCredential(userReferralCode, 'ref-code')}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-md"
                      >
                        {copiedItemKey === 'ref-code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedItemKey === 'ref-code' ? 'Copied!' : 'Copy Code'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Link Box */}
                  <div className="bg-[#0f0721] p-4 rounded-2xl border border-[#281547] space-y-2">
                    <label className="text-[11px] font-bold text-purple-300/70 uppercase tracking-wider block">Your Direct Referral Link</label>
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-950 px-3 py-2.5 rounded-xl border border-purple-500/30 font-mono text-xs text-purple-200 truncate flex-1">
                        {userReferralLink}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCredential(userReferralLink, 'ref-link')}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-md shrink-0"
                      >
                        {copiedItemKey === 'ref-link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedItemKey === 'ref-link' ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Instant Social Share Buttons */}
                <div className="pt-2 border-t border-[#251347] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-purple-300/70 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Share directly with one click:
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join ZENET HUB using my referral link and get verified social media accounts: ${userReferralLink}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp</span>
                    </a>
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(userReferralLink)}&text=${encodeURIComponent('Join ZENET HUB to buy & sell social media accounts safely!')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition"
                    >
                      <Send className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Telegram</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Referral History Table */}
              <div className="bg-[#170c30] border border-[#2e1852] p-5 rounded-3xl space-y-4 shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-[#29154a]">
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    Referred Friends History & Bonus Progress ({referralsList.length})
                  </h4>
                  <span className="text-[11px] text-purple-300/60 font-mono">₦1,000 threshold required</span>
                </div>

                {referralsList.length === 0 ? (
                  <div className="py-8 text-center space-y-3 bg-[#0f0721] rounded-2xl border border-dashed border-[#281547] p-6">
                    <div className="w-12 h-12 rounded-full bg-purple-950/80 border border-purple-500/30 flex items-center justify-center mx-auto text-amber-400">
                      <Gift className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-bold text-white text-sm">No Referred Friends Yet</h5>
                      <p className="text-xs text-purple-300/60 max-w-sm mx-auto">
                        Copy your link above and share it on social media, WhatsApp groups, or with friends. When they register and spend ₦1,000, you'll see your ₦100 bonus here!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referralsList.map((refItem) => {
                      const totalSpent = refItem.totalSpent || 0;
                      const progressPct = Math.min(100, Math.round((totalSpent / 1000) * 100));
                      const isClaimed = refItem.rewardClaimed;

                      return (
                        <div key={refItem.id || refItem.referredUserId} className="bg-[#0f0721] p-4 rounded-2xl border border-[#281547] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {refItem.referredUserEmail || refItem.referredUserName || 'Referred User'}
                              </span>
                              {isClaimed ? (
                                <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  ₦100 Reward Paid
                                </span>
                              ) : (
                                <span className="bg-amber-950/90 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  In Progress ({progressPct}%)
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-purple-300/60 flex items-center gap-3">
                              <span>Joined: {refItem.referredAt ? new Date(refItem.referredAt).toLocaleDateString() : 'Recently'}</span>
                              <span>Total Purchases: <strong className="text-white">₦{totalSpent.toLocaleString()} NGN</strong></span>
                            </p>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-purple-500/20 max-w-md mt-1">
                              <div
                                className={`h-full transition-all duration-300 ${isClaimed ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-purple-500'}`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {isClaimed ? (
                              <div className="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl text-center">
                                <span className="text-xs text-emerald-400 font-bold block">+₦100 NGN</span>
                                <span className="text-[10px] text-purple-300/60 block font-mono">Bonus Credited</span>
                              </div>
                            ) : (
                              <div className="bg-purple-950/40 border border-purple-500/20 p-2.5 rounded-xl text-center">
                                <span className="text-xs text-amber-300 font-bold block">Needs ₦{Math.max(0, 1000 - totalSpent).toLocaleString()}</span>
                                <span className="text-[10px] text-purple-300/60 block font-mono">For ₦100 Bonus</span>
                              </div>
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
          {activeTab === 'settings' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-400" />
                    Buyer Account Settings & Preferences
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Manage your regional currency display, security, and alerts
                  </p>
                </div>
              </div>

              {/* Preferences Box */}
              <div className="bg-[#170c30] border border-[#2d1952] p-5 rounded-3xl space-y-4 shadow-lg">
                
                {/* Currency Selection */}
                <div>
                  <label className="block text-purple-300/90 font-bold mb-1.5 text-xs uppercase tracking-wider">
                    Preferred Display Currency
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { code: 'USD', symbol: '$', name: 'US Dollar' },
                      { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
                      { code: 'EUR', symbol: '€', name: 'Euro' },
                      { code: 'GBP', symbol: '£', name: 'British Pound' }
                    ].map((curr) => (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => setPreferredCurrency(curr.code)}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          preferredCurrency === curr.code
                            ? 'bg-purple-600/30 border-purple-400 text-white shadow-md'
                            : 'bg-[#100722] border-[#2b174e] text-purple-300/60 hover:border-purple-500/30'
                        }`}
                      >
                        <span className="font-black text-sm block">{curr.code} ({curr.symbol})</span>
                        <span className="text-[10px] text-purple-300/70">{curr.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email Alert Notifications */}
                <div className="pt-3 border-t border-[#281547] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-xs block">Escrow Transfer Email Notifications</span>
                    <span className="text-[11px] text-purple-300/60">Receive email alerts when credentials are released or verified</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    className={`w-12 h-6 rounded-full transition p-1 cursor-pointer flex items-center ${
                      emailNotifications ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                  </button>
                </div>

              </div>

              {/* Security & Authentication Box */}
              <div className="bg-[#170c30] border border-[#2d1952] p-5 rounded-3xl space-y-3 shadow-lg">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  Security & Authentication
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#100722] p-3 rounded-2xl border border-[#29154a] space-y-1">
                    <span className="text-purple-300/60 text-[10px] font-bold uppercase block">Firebase UID</span>
                    <code className="text-purple-200 font-mono text-[11px] select-all">{user.uid}</code>
                  </div>

                  <div className="bg-[#100722] p-3 rounded-2xl border border-[#29154a] space-y-1">
                    <span className="text-purple-300/60 text-[10px] font-bold uppercase block">Auth Provider</span>
                    <span className="text-emerald-300 font-semibold flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" />
                      Firebase Password / Google Auth
                    </span>
                  </div>
                </div>
              </div>

              {/* Log Out Button */}
              {onSignOut && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Are you sure you want to log out of your ZENET account?')) {
                        onClose();
                        onSignOut();
                      }
                    }}
                    className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold px-5 py-2.5 rounded-full text-xs transition cursor-pointer flex items-center gap-2 shadow-md"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out of Account</span>
                  </button>
                </div>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: OWNER GIVE CREDIT / WALLET OVERRIDE */}
          {/* ========================================================= */}
          {activeTab === 'wallets' && isOwner && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <AdminWalletsView
                user={user}
                userProfile={userProfile}
                onBackToMarketplace={() => setActiveTab('profile')}
              />
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
