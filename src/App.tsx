import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { User, onAuthStateChanged, onIdTokenChanged, signOut } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  writeBatch, 
  limit, 
  runTransaction,
  increment 
} from 'firebase/firestore';
import { auth, db, sanitizeFirestorePayload, getSafeIdToken } from './lib/firebase';
import { isAuthorizedOwner, isAuthorizedOwnerEmail, isAuthorizedOwnerUid } from './lib/authorizedOwners';
import { AccountListing, CategoryType, FilterState, Inquiry, UserProfile, PurchaseRecord, ActiveAppView, WalletTransaction } from './types';
import { isCategoryMatch } from './utils/category';
import { safeApiFetch } from './utils/api';

import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { SafetyBanner } from './components/SafetyBanner';
import { CategoryFilter } from './components/CategoryFilter';
import { FeaturedListings } from './components/FeaturedListings';
import { ListingCard } from './components/ListingCard';
import { ListingDetailModal } from './components/ListingDetailModal';
import { CreateListingModal } from './components/CreateListingModal';
import { AuthModal } from './components/AuthModal';
import { ContactSellerModal } from './components/ContactSellerModal';
import { UserDashboardModal, DashboardTab } from './components/UserDashboardModal';
import { SellerDashboardModal } from './components/SellerDashboardModal';
import { SellerProfileModal } from './components/SellerProfileModal';
import { PaymentModal } from './components/PaymentModal';
import { InsufficientBalanceModal } from './components/InsufficientBalanceModal';
import { PaymentSuccessModal } from './components/PaymentSuccessModal';
import { BuyNowConfirmModal } from './components/BuyNowConfirmModal';
import { PurchaseProcessingModal } from './components/PurchaseProcessingModal';
import { NavigationDrawer } from './components/NavigationDrawer';
import { PurchaseDetailsModal } from './components/PurchaseDetailsModal';
import { WalletModal } from './components/WalletModal';
import { CategoriesView } from './components/CategoriesView';
import { SupportView } from './components/SupportView';
import { LandingPage } from './components/LandingPage';
import { Footer } from './components/Footer';
import { LogAccountsView } from './components/LogAccountsView';
import { HistoryView } from './components/HistoryView';
import { HomeDashboardView } from './components/HomeDashboardView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ProfileView } from './components/ProfileView';
import { EditProfileView } from './components/EditProfileView';
import { ReferralsView, generateUserReferralCode } from './components/ReferralsView';
import { ChangePasswordView } from './components/ChangePasswordView';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { safeLocalStorage } from './utils/storage';
import { ServiceUnavailableView } from './components/ServiceUnavailableView';

// Code-split heavy views & modals for lighter initial bundle
const AdminPanelModal = React.lazy(() => import('./components/AdminPanelModal').then(m => ({ default: m.AdminPanelModal })));
const VirtualNumbersView = React.lazy(() => import('./components/VirtualNumbersView').then(m => ({ default: m.VirtualNumbersView })));
const SocialBoostView = React.lazy(() => import('./components/SocialBoostView').then(m => ({ default: m.SocialBoostView })));
const Server2View = React.lazy(() => import('./components/Server2View').then(m => ({ default: m.Server2View })));
const VirtualNumbers2View = React.lazy(() => import('./components/VirtualNumbers2View').then(m => ({ default: m.VirtualNumbers2View })));
const SocialBoost2View = React.lazy(() => import('./components/SocialBoost2View').then(m => ({ default: m.SocialBoost2View })));
const AdminWalletsView = React.lazy(() => import('./components/AdminWalletsView').then(m => ({ default: m.AdminWalletsView })));
const ZenetUpdateModal = React.lazy(() => import('./components/ZenetUpdateModal').then(m => ({ default: m.ZenetUpdateModal })));
const ZenetUpdateAdminModal = React.lazy(() => import('./components/ZenetUpdateAdminModal').then(m => ({ default: m.ZenetUpdateAdminModal })));

const LazyViewFallback: React.FC = () => (
  <div className="w-full min-h-[360px] flex flex-col items-center justify-center p-8 text-center text-[#5B4DF5] animate-in fade-in duration-200">
    <div className="w-10 h-10 border-3 border-[#EBE7F7] border-t-[#5B4DF5] rounded-full animate-spin mb-3"></div>
    <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Loading...</span>
  </div>
);
import { Phone, UserCheck } from 'lucide-react';

import { 
  ShieldCheck, 
  Sparkles, 
  Search, 
  Store, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Award,
  Trash2,
  X
} from 'lucide-react';

const CATEGORY_ORDER: CategoryType[] = [
  'Facebook', 'Instagram', 'TikTok', 'YouTube', 'Gmail', 'Twitter/X',
  'Telegram', 'WhatsApp', 'Discord', 'LinkedIn', 'Reddit', 'Snapchat',
  'Pinterest', 'Threads', 'Other'
];

const CATEGORY_META: Record<CategoryType, { icon: string; title: string; subtitle: string; badgeColor: string }> = {
  All: { icon: '🌐', title: 'All Accounts', subtitle: 'Explore all digital accounts', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  Facebook: {
    icon: '📘',
    title: 'Facebook Accounts & Pages',
    subtitle: 'Aged Facebook profiles, Business Managers, and monetization-ready pages',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  Instagram: {
    icon: '📸',
    title: 'Instagram Accounts',
    subtitle: 'Niche profiles, creator accounts, and high-engagement handles',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30'
  },
  TikTok: {
    icon: '🎵',
    title: 'TikTok Accounts',
    subtitle: 'Monetized Creator Rewards accounts, live stream enabled & aged profiles',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
  },
  YouTube: {
    icon: '▶️',
    title: 'YouTube Channels',
    subtitle: 'YPP Monetized channels, zero copyright strikes, 1k+ subscribers',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30'
  },
  Gmail: {
    icon: '✉️',
    title: 'Gmail & Email Accounts',
    subtitle: 'Aged Google accounts, YouTube channel ready, PVA verified email suites',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  },
  'Twitter/X': {
    icon: '𝕏',
    title: 'Twitter / X Accounts',
    subtitle: 'X Premium Blue checkmark accounts, crypto & Web3 followers, high engagement',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-400/30'
  },
  Telegram: {
    icon: '✈️',
    title: 'Telegram Channels & Groups',
    subtitle: 'Established Telegram broadcast channels, high-member groups, TData session files',
    badgeColor: 'bg-sky-500/20 text-sky-200 border-sky-400/30'
  },
  WhatsApp: {
    icon: '💬',
    title: 'WhatsApp Business Accounts',
    subtitle: 'Aged WhatsApp Business API profiles, virtual & SIM verified numbers',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
  },
  Discord: {
    icon: '🎮',
    title: 'Discord Servers & Accounts',
    subtitle: 'Aged Discord profiles, early developer badges, high member servers',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30'
  },
  LinkedIn: {
    icon: '💼',
    title: 'LinkedIn Sales Accounts',
    subtitle: 'Aged LinkedIn accounts with 500+ connections, Sales Navigator active',
    badgeColor: 'bg-blue-600/20 text-blue-200 border-blue-400/30'
  },
  Reddit: {
    icon: '🤖',
    title: 'Reddit High Karma Accounts',
    subtitle: 'Aged Reddit profiles, high post & comment karma, subreddit moderator access',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-400/30'
  },
  Snapchat: {
    icon: '👻',
    title: 'Snapchat Spotlight Accounts',
    subtitle: 'Monetized Spotlight channels, high snap score handles, verified creator profiles',
    badgeColor: 'bg-yellow-500/20 text-yellow-200 border-yellow-400/30'
  },
  Pinterest: {
    icon: '📌',
    title: 'Pinterest Business Accounts',
    subtitle: 'High monthly view Pinterest boards, affiliate traffic ready',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30'
  },
  Threads: {
    icon: '🧵',
    title: 'Threads Accounts',
    subtitle: 'Meta Threads profiles linked to high follower Instagram handles',
    badgeColor: 'bg-purple-500/20 text-purple-200 border-purple-400/30'
  },
  Other: {
    icon: '⚡',
    title: 'Other Verified Digital Accounts',
    subtitle: 'Specialized digital assets, streaming accounts, and custom gaming handles',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  }
};

const ListingSkeleton = React.memo(() => (
  <div className="w-full bg-white border border-[#EBE7F7] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 animate-pulse shadow-xs">
    <div className="space-y-2.5">
      <div className="flex items-start space-x-3">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#F1F0FB] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#F1F0FB] rounded-md w-3/4" />
          <div className="h-3 bg-[#F8F7FD] rounded-md w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-[#F8F7FD] rounded-md w-full" />
      <div className="flex space-x-2">
        <div className="h-5 bg-[#F1F0FB] rounded-full w-16" />
        <div className="h-5 bg-[#F1F0FB] rounded-full w-20" />
      </div>
    </div>
    <div className="pt-3 border-t border-[#EBE7F7] flex items-center justify-between">
      <div className="h-6 bg-[#F1F0FB] rounded-md w-20" />
      <div className="h-8 bg-[#F1F0FB] rounded-xl w-24" />
    </div>
  </div>
));

export default function App() {
  // Auth state with instant cache hydration
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = safeLocalStorage.getItem('zenet_cached_user_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Helper to update and cache user profile stably
  const setAndCacheUserProfile = (profile: UserProfile | null) => {
    setUserProfile((prev) => {
      if (!prev && !profile) return null;
      if (prev && profile && prev.uid === profile.uid && prev.walletBalance === profile.walletBalance && prev.role === profile.role && prev.email === profile.email) {
        return prev;
      }
      return profile;
    });
    try {
      if (profile) {
        safeLocalStorage.setItem('zenet_cached_user_profile', JSON.stringify(profile));
      } else {
        safeLocalStorage.removeItem('zenet_cached_user_profile');
      }
    } catch (e) {
      console.warn('Could not cache user profile in localStorage:', e);
    }
  };

  // Firestore listings & inquiries state
  const [listings, setListings] = useState<AccountListing[]>(() => {
    try {
      const cached = safeLocalStorage.getItem('zenet_cached_listings');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [listingsLoading, setListingsLoading] = useState<boolean>(() => {
    try {
      const cached = safeLocalStorage.getItem('zenet_cached_listings');
      const parsed = cached ? JSON.parse(cached) : [];
      return parsed.length === 0;
    } catch (e) {
      return true;
    }
  });
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [savedListingIds, setSavedListingIds] = useState<string[]>(() => {
    try {
      const stored = safeLocalStorage.getItem('zenet_saved_ids');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    category: 'All',
    searchQuery: '',
    minPrice: 0,
    maxPrice: 10000000,
    pvaOnly: false,
    monetizedOnly: false,
    twoFactorOnly: false,
    countryFilter: 'All',
    sortBy: 'newest'
  });

  // Navigation Drawer & Active View State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveAppView>('marketplace');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isZenetUpdateModalOpen, setIsZenetUpdateModalOpen] = useState(false);
  const [isZenetUpdateAdminModalOpen, setIsZenetUpdateAdminModalOpen] = useState(false);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<PurchaseRecord | null>(null);

  // Modal open states
  const [selectedListing, setSelectedListing] = useState<AccountListing | null>(null);
  const [contactListing, setContactListing] = useState<AccountListing | null>(null);
  const [buyingListing, setBuyingListing] = useState<AccountListing | null>(null);
  const [confirmingBuyListing, setConfirmingBuyListing] = useState<AccountListing | null>(null);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState<boolean>(false);
  const [processingListing, setProcessingListing] = useState<AccountListing | null>(null);
  const [insufficientBalanceListing, setInsufficientBalanceListing] = useState<AccountListing | null>(null);
  const [latestWalletBalance, setLatestWalletBalance] = useState<number>(0);
  const [completedOrder, setCompletedOrder] = useState<PurchaseRecord | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string>('');
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [paymentSuccessToast, setPaymentSuccessToast] = useState<{
    amount: number;
    newBalance?: number;
    reference: string;
  } | null>(null);
  const verifiedPaystackRefs = useRef(new Set<string>());

  useEffect(() => {
    if (paymentSuccessToast) {
      const timer = setTimeout(() => {
        setPaymentSuccessToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [paymentSuccessToast]);

  const executeLogout = async () => {
    safeLocalStorage.removeItem('zenet_last_seen_timestamp');
    safeLocalStorage.removeItem('zenet_cached_user_profile');
    setSessionExpiredNotice('');
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setUser(null);
    setAndCacheUserProfile(null);
    setActiveView('marketplace');
    setIsLogoutConfirmOpen(false);
  };

  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const [dashboardTab, setDashboardTab] = useState<DashboardTab | null>(null);
  const [isSellerDashboardOpen, setIsSellerDashboardOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<{ id: string; name: string } | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  // Wallet State
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    try {
      const cached = safeLocalStorage.getItem('zenet_cached_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        return typeof parsed.walletBalance === 'number' ? parsed.walletBalance : 0;
      }
    } catch {}
    return 0;
  });
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState<number>(0);

  const isOwner = isAuthorizedOwner(user, userProfile);
  const isAdmin = isOwner || userProfile?.role === 'admin';

  // Listen to unread tickets count in Firestore
  useEffect(() => {
    if (!user) {
      setUnreadTicketsCount(0);
      return;
    }
    const ticketsRef = collection(db, 'tickets');
    let q;
    if (isAdmin) {
      q = query(ticketsRef, where('status', '==', 'open'), limit(50));
    } else {
      q = query(ticketsRef, where('userId', '==', user.uid), limit(50));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadTicketsCount(snapshot.docs.length);
    }, (err) => {
      console.warn('Tickets snapshot error:', err);
    });
    return () => unsubscribe();
  }, [user?.uid, isAdmin]);

  // Reliable Session Keep-Alive & Background Token Refresh Handler
  useEffect(() => {
    if (!user) return;

    // Smoothly re-validate token and refresh profile on tab focus or visibility return
    const handleReactivation = async () => {
      if (document.visibilityState === 'visible') {
        try {
          await getSafeIdToken(auth.currentUser, false);
          safeLocalStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());
        } catch (e) {
          console.warn('[Session Reactivation] Notice:', e);
        }
      }
    };

    window.addEventListener('focus', handleReactivation);
    document.addEventListener('visibilitychange', handleReactivation);

    return () => {
      window.removeEventListener('focus', handleReactivation);
      document.removeEventListener('visibilitychange', handleReactivation);
    };
  }, [user?.uid]);

  // Sync walletBalance with userProfile stably without triggering re-render loops
  useEffect(() => {
    if (userProfile) {
      const raw = (userProfile as any).walletBalance !== undefined 
        ? (userProfile as any).walletBalance 
        : (userProfile as any).balance;
      const balance = typeof raw === 'number' 
        ? raw 
        : (raw ? Number(raw) : 0);
      const safeBalance = isNaN(balance) ? 0 : balance;
      setWalletBalance((prev) => (prev !== safeBalance ? safeBalance : prev));
    } else if (!user) {
      setWalletBalance((prev) => (prev !== 0 ? 0 : prev));
    }
  }, [userProfile?.walletBalance, (userProfile as any)?.balance, user?.uid]);

  // Smoothly close Authentication Modal only after both user AND userProfile (including role/wallet) are fully loaded and synchronized
  useEffect(() => {
    if (user && userProfile && authMode) {
      setAuthMode(null);
      setSessionExpiredNotice('');
    }
  }, [user?.uid, Boolean(userProfile), authMode]);

  // Dedicated authoritative sync function to refresh user profile & balance from Firestore
  const refreshUserProfileAndBalance = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const walletRef = doc(db, 'wallets', user.uid);
      const [uSnap, wSnap] = await Promise.all([
        getDoc(userRef).catch(() => null),
        getDoc(walletRef).catch(() => null)
      ]);

      let confirmedBal: number | null = null;

      if (uSnap && uSnap.exists()) {
        const data = uSnap.data() as UserProfile;
        setAndCacheUserProfile(data);
        const rawBal = (data as any)?.walletBalance !== undefined ? (data as any)?.walletBalance : (data as any)?.balance;
        const numBal = typeof rawBal === 'number' ? rawBal : (rawBal ? Number(rawBal) : 0);
        confirmedBal = isNaN(numBal) ? 0 : numBal;
      }

      if (wSnap && wSnap.exists()) {
        const wData = wSnap.data();
        const rawWBal = wData?.walletBalance !== undefined ? wData?.walletBalance : wData?.balance;
        const numWBal = typeof rawWBal === 'number' ? rawWBal : (rawWBal ? Number(rawWBal) : 0);
        const safeWBal = isNaN(numWBal) ? 0 : numWBal;
        confirmedBal = confirmedBal !== null ? Math.max(confirmedBal, safeWBal) : safeWBal;
      }

      if (confirmedBal !== null) {
        setWalletBalance(confirmedBal);
        setLatestWalletBalance(confirmedBal);
      }
    } catch (err) {
      console.warn('Error refreshing profile and balance:', err);
    }
  }, [user?.uid]);

  const handleAddWalletFunds = async (amount: number, gateway: string, reference?: string) => {
    if (!user) return;
    const numAmount = typeof amount === 'number' ? amount : Number(amount) || 0;

    // Verification and crediting are authoritatively executed by server Paystack verify endpoint (single source of truth)
    if (reference) {
      try {
        const verifyRes = await safeApiFetch(`/api/paystack/verify/${encodeURIComponent(reference)}?reference=${encodeURIComponent(reference)}&userId=${encodeURIComponent(user.uid)}&isWalletFunding=true`);
        if (verifyRes && (verifyRes.verified || verifyRes.status === 'success' || verifyRes.alreadyProcessed)) {
          console.log('[Wallet Funding] Verified and balance synced from server.');
          const credited = verifyRes.amount || numAmount;
          if (typeof verifyRes.newBalance === 'number') {
            setWalletBalance(verifyRes.newBalance);
            setLatestWalletBalance(verifyRes.newBalance);
          }
          if (credited > 0) {
            setPaymentSuccessToast({
              amount: credited,
              newBalance: verifyRes.newBalance,
              reference
            });
          }
        }
      } catch (vErr) {
        console.warn('[Wallet Funding] Server verify notice:', vErr);
      }
    }

    // Authoritative Firestore refresh - single source of truth, no duplicate client writes
    await refreshUserProfileAndBalance();
  };

  // Helper for consistent SPA History Navigation & URL query params
  const navigateRoute = (opts: {
    view?: ActiveAppView;
    category?: CategoryType;
    search?: string;
    product?: AccountListing | null;
    dashboardTab?: DashboardTab | null;
    walletModal?: boolean;
    seller?: { id: string; name: string } | null;
    replace?: boolean;
  }) => {
    const VALID_PAGE_VIEWS: ActiveAppView[] = [
      'marketplace',
      'social-boost',
      'social-boost-2',
      'virtual-numbers',
      'virtual-numbers-2',
      'server-tool',
      'log-accounts',
      'categories',
      'support',
      'admin_wallets',
      'profile',
      'edit-profile',
      'change-password',
      'referrals',
      'orders',
      'history'
    ];

    const targetView = opts.view 
      ? (VALID_PAGE_VIEWS.includes(opts.view) ? opts.view : 'marketplace')
      : (VALID_PAGE_VIEWS.includes(activeView) ? activeView : 'marketplace');

    const targetCategory = opts.category !== undefined ? opts.category : filters.category;
    const targetSearch = opts.search !== undefined ? opts.search : filters.searchQuery;
    const targetProduct = opts.product !== undefined ? opts.product : selectedListing;
    const targetTab = opts.dashboardTab !== undefined ? opts.dashboardTab : dashboardTab;
    const targetWallet = opts.walletModal !== undefined ? opts.walletModal : isWalletModalOpen;
    const targetSeller = opts.seller !== undefined ? opts.seller : selectedSeller;

    // 1. Update React State
    setActiveView(targetView);
    
    if (opts.category !== undefined || opts.search !== undefined) {
      setFilters((prev) => ({
        ...prev,
        category: targetCategory,
        searchQuery: targetSearch
      }));
    }

    if (opts.product !== undefined) setSelectedListing(targetProduct);
    if (opts.dashboardTab !== undefined) setDashboardTab(targetTab);
    if (opts.walletModal !== undefined) setIsWalletModalOpen(targetWallet);
    if (opts.seller !== undefined) setSelectedSeller(targetSeller);

    // 2. Build URL Search Parameters
    const url = new URL(window.location.href);

    if (targetView !== 'marketplace') url.searchParams.set('view', targetView);
    else url.searchParams.delete('view');

    if (targetCategory !== 'All') url.searchParams.set('category', targetCategory);
    else url.searchParams.delete('category');

    if (targetSearch) url.searchParams.set('q', targetSearch);
    else url.searchParams.delete('q');

    if (targetProduct) url.searchParams.set('product', targetProduct.id);
    else url.searchParams.delete('product');

    if (targetTab) url.searchParams.set('tab', targetTab);
    else url.searchParams.delete('tab');

    if (targetWallet) url.searchParams.set('wallet', 'true');
    else url.searchParams.delete('wallet');

    if (targetSeller) {
      url.searchParams.set('seller', targetSeller.id);
      url.searchParams.set('sellerName', targetSeller.name);
    } else {
      url.searchParams.delete('seller');
      url.searchParams.delete('sellerName');
    }

    const searchStr = url.searchParams.toString();
    const relativePath = url.pathname + (searchStr ? `?${searchStr}` : '');

    const historyStateObj = {
      view: targetView,
      category: targetCategory,
      search: targetSearch,
      productId: targetProduct?.id || null,
      dashboardTab: targetTab,
      isWalletModalOpen: targetWallet,
      seller: targetSeller
    };

    if (opts.replace) {
      window.history.replaceState(historyStateObj, '', relativePath);
    } else {
      window.history.pushState(historyStateObj, '', relativePath);
    }
  };

  // Dedicated helper to return to homepage and reset scroll to top
  const handleBackToMarketplace = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    navigateRoute({ view: 'marketplace', product: null, seller: null, walletModal: false, dashboardTab: null });
  };

  // Scroll to top whenever activeView transitions to 'marketplace'
  useEffect(() => {
    if (activeView === 'marketplace') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeView]);

  // Select Drawer View action
  const handleSelectView = (view: ActiveAppView) => {
    setIsDrawerOpen(false);

    if (view === 'marketplace') {
      handleBackToMarketplace();
      return;
    }

    if (
      view === 'categories' ||
      view === 'support' ||
      view === 'admin_wallets' ||
      view === 'social-boost' ||
      view === 'social-boost-2' ||
      view === 'virtual-numbers' ||
      view === 'virtual-numbers-2' ||
      view === 'server-tool' ||
      view === 'log-accounts' ||
      view === 'orders' ||
      view === 'history' ||
      view === 'profile' ||
      view === 'edit-profile' ||
      view === 'change-password' ||
      view === 'referrals'
    ) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const targetView: ActiveAppView = view === 'history' ? 'orders' : view;
      setActiveView(targetView);
      navigateRoute({ view: targetView, dashboardTab: null, walletModal: false, product: null, seller: null });
      return;
    }

    // Modal-backed views require login
    if (!user) {
      if (view === 'dashboard' || view === 'settings' || view === 'saved' || view === 'messages') {
        navigateRoute({ dashboardTab: 'profile' });
        return;
      }
      setAuthMode('login');
      return;
    }

    if (view === 'dashboard') {
      navigateRoute({ dashboardTab: 'profile' });
    } else if (view === 'settings') {
      navigateRoute({ dashboardTab: 'settings' });
    } else if (view === 'saved') {
      navigateRoute({ dashboardTab: 'saved' });
    } else if (view === 'messages') {
      navigateRoute({ dashboardTab: 'inquiries' });
    } else if (view === 'wallet' || view === 'deposit-history') {
      navigateRoute({ walletModal: true });
    } else if (view === 'seller') {
      if (userProfile?.role === 'admin') {
        setIsSellerDashboardOpen(true);
      } else {
        navigateRoute({ dashboardTab: 'profile' });
      }
    }
  };

  // Recently Viewed Listings state
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const raw = safeLocalStorage.getItem('zenet_recent_ids');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const handleSelectListing = React.useCallback((listing: AccountListing) => {
    navigateRoute({ product: listing });
    setRecentlyViewedIds((prev) => {
      const updated = [listing.id, ...prev.filter((id) => id !== listing.id)].slice(0, 10);
      try {
        safeLocalStorage.setItem('zenet_recent_ids', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      return updated;
    });
  }, [navigateRoute]);

  const listingsRef = useRef(listings);
  const isPurchasingRef = useRef(false);
  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);

  // Listen for Browser Back / Forward buttons (popstate event) stably without re-attaching
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);

      const vParam = url.searchParams.get('view') as ActiveAppView;
      const isWalletsUrl = url.pathname === '/admin/wallets' || url.pathname === '/admin/wallet' || url.searchParams.get('tab') === 'wallets';
      const validViews: ActiveAppView[] = [
        'marketplace',
        'social-boost',
        'social-boost-2',
        'virtual-numbers',
        'virtual-numbers-2',
        'server-tool',
        'log-accounts',
        'categories',
        'support',
        'admin_wallets',
        'orders',
        'history'
      ];
      const normalizedViewParam: ActiveAppView | undefined = vParam === 'history' ? 'orders' : vParam;
      const validView: ActiveAppView = (isWalletsUrl || vParam === 'admin_wallets') 
        ? 'admin_wallets' 
        : (normalizedViewParam && validViews.includes(normalizedViewParam))
        ? normalizedViewParam 
        : 'marketplace';
      setActiveView(validView);

      const catParam = (url.searchParams.get('category') || 'All') as CategoryType;
      const qParam = url.searchParams.get('q') || url.searchParams.get('search') || '';
      setFilters((prev) => ({
        ...prev,
        category: catParam,
        searchQuery: qParam
      }));

      const prodId = url.searchParams.get('product') || url.searchParams.get('p');
      const currentListings = listingsRef.current;
      if (prodId && currentListings.length > 0) {
        const match = currentListings.find((l) => l.id === prodId);
        setSelectedListing(match || null);
      } else {
        setSelectedListing(null);
      }

      const tabParam = url.searchParams.get('tab') as DashboardTab | null;
      setDashboardTab(tabParam || null);

      const walletParam = url.searchParams.get('wallet') === 'true';
      setIsWalletModalOpen(walletParam);

      const sellerId = url.searchParams.get('seller');
      const sellerName = url.searchParams.get('sellerName');
      if (sellerId && sellerName) {
        setSelectedSeller({ id: sellerId, name: sellerName });
      } else {
        setSelectedSeller(null);
      }

      setIsDrawerOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync state with URL params when listings/user load for initial direct links
  useEffect(() => {
    const url = new URL(window.location.href);
    const prodId = url.searchParams.get('product') || url.searchParams.get('p');
    if (prodId && listings.length > 0 && !selectedListing) {
      const match = listings.find((l) => l.id === prodId);
      if (match) setSelectedListing(match);
    }
  }, [listings, selectedListing]);

  // 1. Firebase Auth state change listener & Connection Validation
  useEffect(() => {
    // Validate connection to Firestore on boot
    async function testConnection() {
      try {
        await getDoc(doc(db, 'listings', 'conn_test'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.warn("Firestore client working in cached mode.");
        }
      }
    }
    testConnection();

    // Detect referral query parameter or direct admin wallets / social boost / virtual numbers route on app load
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramRef = urlParams.get('ref') || urlParams.get('referral');
      if (paramRef) {
        safeLocalStorage.setItem('pending_referral_code', paramRef.trim().toUpperCase());
      }
      const vParam = urlParams.get('view') as ActiveAppView;
      const validViews: ActiveAppView[] = [
        'marketplace',
        'social-boost',
        'virtual-numbers',
        'log-accounts',
        'categories',
        'support',
        'admin_wallets'
      ];
      if (window.location.pathname === '/admin/wallets' || window.location.pathname === '/admin/wallet' || vParam === 'admin_wallets' || urlParams.get('tab') === 'wallets') {
        setActiveView('admin_wallets');
      } else if (vParam && validViews.includes(vParam)) {
        setActiveView(vParam);
      }
    } catch (err) {
      console.warn('URL ref code parse error:', err);
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        safeLocalStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());
        setUser(currentUser);
        // Instant unlock - don't block the UI while fetching user doc
        setAuthLoading(false);
        setAuthMode(null);
        setSessionExpiredNotice('');
        setActiveView((prev) => (prev === 'landing' ? 'marketplace' : prev));

        // Immediately hydrate fallback profile if empty so user is never stuck on synchronization screen
        setUserProfile((prev) => {
          if (prev && prev.uid === currentUser.uid) return prev;
          const fallbackProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            username: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            role: (isAuthorizedOwnerEmail(currentUser.email) || isAuthorizedOwnerUid(currentUser.uid)) ? 'owner' : 'buyer',
            status: 'active',
            createdAt: new Date().toISOString(),
            walletBalance: 0
          };
          return fallbackProfile;
        });

        // Sync user profile to Firestore & fetch role asynchronously in background
        const userRef = doc(db, 'users', currentUser.uid);
        let verifiedDepositBal: number | undefined;

        // Check for return from Paystack checkout redirect
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const paystackRef = urlParams.get('reference') || 
            urlParams.get('trxref') || 
            (urlParams.get('paystack_verify') && urlParams.get('paystack_verify') !== 'true' ? urlParams.get('paystack_verify') : null) ||
            (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('zenith_pending_paystack_ref') : null) ||
            (typeof localStorage !== 'undefined' ? localStorage.getItem('zenith_pending_paystack_ref') : null);

          if (paystackRef && !verifiedPaystackRefs.current.has(paystackRef)) {
            verifiedPaystackRefs.current.add(paystackRef);
            try {
              sessionStorage.removeItem('zenith_pending_paystack_ref');
              localStorage.removeItem('zenith_pending_paystack_ref');
            } catch {}

            try {
              const verifyData = await safeApiFetch(`/api/paystack/verify/${encodeURIComponent(paystackRef)}?reference=${encodeURIComponent(paystackRef)}&userId=${encodeURIComponent(currentUser.uid)}`);
              if (verifyData && (verifyData.verified || verifyData.status === 'success' || verifyData.alreadyProcessed)) {
                console.log('[Paystack Auto-Verify] Payment verified successfully:', verifyData);

                // 1. If this was a LOG order fulfilled directly by the server
                if (verifyData.delivered && verifyData.purchaseRecord) {
                  const purchaseRec = verifyData.purchaseRecord as PurchaseRecord;
                  setCompletedOrder(purchaseRec);
                  setPurchases((prev) => [purchaseRec, ...prev.filter((p) => p.id !== purchaseRec.id)]);
                  
                  const cleanUrl = window.location.origin + window.location.pathname;
                  window.history.replaceState({}, document.title, cleanUrl);

                  try {
                    sessionStorage.removeItem('pending_buynow_listing_id');
                    localStorage.removeItem('pending_buynow_listing_id');
                    sessionStorage.removeItem('zenith_pending_listing_id');
                    localStorage.removeItem('zenith_pending_listing_id');
                  } catch {}

                  await refreshUserProfileAndBalance();
                  return;
                }

                const creditedAmount = Number(verifyData.amount || 0);
                const newBal = typeof verifyData.newBalance === 'number' ? verifyData.newBalance : undefined;

                if (typeof newBal === 'number') {
                  verifiedDepositBal = newBal;
                  setWalletBalance(newBal);
                  setLatestWalletBalance(newBal);
                }

                if (creditedAmount > 0) {
                  setPaymentSuccessToast({
                    amount: creditedAmount,
                    newBalance: newBal,
                    reference: paystackRef
                  });
                }

                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);

                await refreshUserProfileAndBalance();

                // Check for pending Buy Now order to resume after wallet funding verification
                const pendingListingId = safeLocalStorage.getItem('pending_buynow_listing_id') ||
                  (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pending_buynow_listing_id') : null) ||
                  safeLocalStorage.getItem('zenith_pending_listing_id') ||
                  (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('zenith_pending_listing_id') : null);

                if (pendingListingId) {
                  safeLocalStorage.removeItem('pending_buynow_listing_id');
                  safeLocalStorage.removeItem('zenith_pending_listing_id');
                  try {
                    sessionStorage.removeItem('pending_buynow_listing_id');
                    sessionStorage.removeItem('zenith_pending_listing_id');
                  } catch {}

                  getDoc(doc(db, 'listings', pendingListingId)).then((listingDocSnap) => {
                    if (listingDocSnap.exists()) {
                      const listingObj = { id: listingDocSnap.id, ...listingDocSnap.data() } as AccountListing;
                      getDoc(userRef).then((uSnap) => {
                        if (uSnap.exists()) {
                          const updatedProfile = uSnap.data() as UserProfile;
                          const liveBal = typeof updatedProfile.walletBalance === 'number'
                            ? updatedProfile.walletBalance
                            : Number(updatedProfile.walletBalance || updatedProfile.balance || 0);

                          if (liveBal >= listingObj.price) {
                            handleBuyNow(listingObj);
                          }
                        }
                      });
                    }
                  }).catch((lErr) => console.warn('Pending listing fetch error:', lErr));
                }
              }
            } catch (pvErr) {
              console.warn('Paystack auto-verify notice:', pvErr);
            }
          }
        } catch (urlErr) {
          console.warn('Error checking Paystack return URL:', urlErr);
        }

        try {
          const docSnap = await getDoc(userRef).catch(() => null);
          let assignedRole: 'owner' | 'admin' | 'seller' | 'buyer' = 'buyer';
          let existingData: Partial<UserProfile> = {};

          if (docSnap && docSnap.exists()) {
            existingData = docSnap.data() as UserProfile;
            if (existingData.role) {
              if ((existingData.role as string) === 'customer') assignedRole = 'buyer';
              else if ((existingData.role as string) === 'manager') assignedRole = 'seller';
              else assignedRole = existingData.role as 'owner' | 'admin' | 'seller' | 'buyer';
            }
          }

          // Bootstrap owner account
          if (isAuthorizedOwnerEmail(currentUser.email) || isAuthorizedOwnerUid(currentUser.uid)) {
            assignedRole = 'owner';
          }

          let myReferralCode = existingData.referralCode;
          if (!myReferralCode || !myReferralCode.startsWith('REF')) {
            myReferralCode = generateUserReferralCode(currentUser.uid);
          }
          let referredBy = existingData.referredBy || null;

          // Check if brand new user or unlinked referral
          if (!referredBy) {
            const pendingRefCode = safeLocalStorage.getItem('pending_referral_code');
            if (pendingRefCode) {
              try {
                const qRef = query(collection(db, 'users'), where('referralCode', '==', pendingRefCode.toUpperCase()));
                const refQuerySnap = await getDocs(qRef);
                if (!refQuerySnap.empty) {
                  const referrerDoc = refQuerySnap.docs[0];
                  if (referrerDoc.id !== currentUser.uid) {
                    referredBy = referrerDoc.id;
                    const referrerData = referrerDoc.data() as UserProfile;

                    // Create referral record
                    const referralRecordId = `ref_${currentUser.uid}`;
                    const refDocRef = doc(db, 'referrals', referralRecordId);
                    await setDoc(refDocRef, {
                      id: referralRecordId,
                      referrerId: referrerDoc.id,
                      referredUserId: currentUser.uid,
                      referredUserEmail: currentUser.email || '',
                      referredUserName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                      referredAt: new Date().toISOString(),
                      totalSpent: existingData.totalPurchasesAmount || 0,
                      rewardClaimed: existingData.referralRewardClaimed || false,
                      rewardAmount: 100
                    }, { merge: true });

                    // Increment referrer referral count
                    const newRefCount = (referrerData.referralCount || 0) + 1;
                    await setDoc(doc(db, 'users', referrerDoc.id), { referralCount: newRefCount }, { merge: true });

                    safeLocalStorage.removeItem('pending_referral_code');
                  }
                }
              } catch (err) {
                console.warn('Error linking referral code:', err);
              }
            }
          }

          const rawExistingBal = (existingData as any)?.walletBalance !== undefined 
            ? (existingData as any)?.walletBalance 
            : (existingData as any)?.balance;
          const numExistingBal = typeof rawExistingBal === 'number' ? rawExistingBal : (rawExistingBal ? Number(rawExistingBal) : 0);
          const safeExistingBal = Math.max(
            isNaN(numExistingBal) ? 0 : numExistingBal,
            typeof verifiedDepositBal === 'number' ? verifiedDepositBal : 0
          );

          const profileData: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || existingData.email || '',
            username: existingData.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            displayName: existingData.displayName || currentUser.displayName || existingData.username || currentUser.email?.split('@')[0] || 'User',
            fullName: existingData.fullName || undefined,
            phoneNumber: existingData.phoneNumber || undefined,
            password: existingData.password || undefined,
            createdAt: existingData.createdAt || new Date().toISOString(),
            role: assignedRole,
            status: existingData.status || 'active',
            referralCode: myReferralCode,
            referredBy: referredBy || undefined,
            totalPurchasesAmount: existingData.totalPurchasesAmount || 0,
            referralRewardClaimed: existingData.referralRewardClaimed || false,
            referralCount: existingData.referralCount || 0,
            totalReferralEarnings: existingData.totalReferralEarnings || 0,
            walletBalance: safeExistingBal,
            balance: safeExistingBal,
            paystackCustomerCode: existingData.paystackCustomerCode || undefined
          };

          setAndCacheUserProfile(profileData);
          setWalletBalance(safeExistingBal);
          setLatestWalletBalance(safeExistingBal);
          setAuthMode(null);
          setSessionExpiredNotice('');
          const urlParams = new URLSearchParams(window.location.search);
          const vParam = urlParams.get('view') as ActiveAppView;
          const validViews: ActiveAppView[] = [
            'marketplace',
            'social-boost',
            'virtual-numbers',
            'log-accounts',
            'categories',
            'support',
            'admin_wallets'
          ];
          if (vParam && validViews.includes(vParam)) {
            setActiveView(vParam);
          } else {
            setActiveView('marketplace');
          }
          const profilePayload = { ...profileData };
          // CRITICAL: NEVER overwrite walletBalance or balance during auth profile background sync
          delete (profilePayload as any).walletBalance;
          delete (profilePayload as any).balance;
          await setDoc(userRef, sanitizeFirestorePayload(profilePayload), { merge: true }).catch((docErr) => {
            console.warn('User profile background sync notice:', docErr);
          });
        } catch (err) {
          console.warn('Error during user profile sync:', err);
        }
      } else {
        setAndCacheUserProfile(null);
        setUser(null);
        setActiveView('marketplace');
        setAuthLoading(false);
      }
    });

    // Listen to token refresh events seamlessly
    const unsubscribeToken = onIdTokenChanged(auth, (refreshedUser) => {
      if (refreshedUser) {
        setUser(refreshedUser);
        safeLocalStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());
      }
    });

    return () => {
      unsubscribe();
      unsubscribeToken();
    };
  }, []);

  // 1b. Real-time User Profile & Wallet sync
  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, 'users', user.uid);
    const walletRef = doc(db, 'wallets', user.uid);

    const unsubscribeUser = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setAndCacheUserProfile(data);
        const rawBal = (data as any)?.walletBalance !== undefined ? (data as any)?.walletBalance : (data as any)?.balance;
        const numBal = typeof rawBal === 'number' ? rawBal : (rawBal ? Number(rawBal) : 0);
        const safeBal = isNaN(numBal) ? 0 : numBal;
        setWalletBalance(safeBal);
        setLatestWalletBalance(safeBal);
      }
    }, (err) => {
      console.warn('User profile listener notice:', err);
    });

    const unsubscribeWallet = onSnapshot(walletRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const rawBal = data?.walletBalance !== undefined ? data?.walletBalance : data?.balance;
        const numBal = typeof rawBal === 'number' ? rawBal : (rawBal ? Number(rawBal) : 0);
        const safeBal = isNaN(numBal) ? 0 : numBal;
        setWalletBalance((prev) => Math.max(prev, safeBal));
        setLatestWalletBalance((prev) => Math.max(prev, safeBal));
      }
    }, () => {});

    return () => {
      unsubscribeUser();
      unsubscribeWallet();
    };
  }, [user?.uid]);

  // 2. Real-time Firestore Listings listener (Bounded query to prevent huge payloads on low-end devices)
  useEffect(() => {
    const listingsRef = collection(db, 'listings');
    const qListings = query(listingsRef, limit(80));
    
    const unsubscribe = onSnapshot(qListings, (snapshot) => {
      const docsData: AccountListing[] = [];
      snapshot.docs.forEach((d) => {
        // Filter out legacy demo listings
        if (!d.id.startsWith('zen-') && !d.id.startsWith('demo-') && !d.id.startsWith('sample-')) {
          docsData.push({
            id: d.id,
            ...d.data()
          } as AccountListing);
        }
      });
      setListings(docsData);
      setListingsLoading(false);
      try {
        // Cache up to 40 items safely to protect memory and avoid QuotaExceededError
        safeLocalStorage.setItem('zenet_cached_listings', JSON.stringify(docsData.slice(0, 40)));
      } catch (err) {
        console.warn('Listings cache write notice:', err);
      }
    }, (error) => {
      console.warn('Firestore snapshot error:', error);
      setListingsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. Firestore Inquiries listener for logged in user
  useEffect(() => {
    if (!user?.uid) {
      setInquiries([]);
      return;
    }

    const inquiriesRef = collection(db, 'inquiries');
    const q = query(inquiriesRef, where('sellerId', '==', user.uid), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Inquiry[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      } as Inquiry));
      setInquiries(data);
    }, (err) => {
      console.warn('Inquiries listener error:', err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 4. Firestore Purchases listener for logged in buyer
  useEffect(() => {
    if (!user?.uid) {
      setPurchases([]);
      return;
    }

    const purchasesRef = collection(db, 'purchases');
    const q = query(purchasesRef, where('buyerId', '==', user.uid), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: PurchaseRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      } as PurchaseRecord));
      setPurchases(data);
    }, (err) => {
      console.warn('Purchases listener notice:', err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 5. Firestore Wallet Transactions listener for logged in user
  useEffect(() => {
    if (!user?.uid) {
      setWalletTransactions([]);
      return;
    }

    const txRef = collection(db, 'wallet_transactions');
    const q = query(txRef, where('userId', '==', user.uid), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: WalletTransaction[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      } as WalletTransaction));
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setWalletTransactions(data);
    }, (err) => {
      console.warn('Wallet transactions listener notice:', err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Handler: Complete Purchase in Firestore
  const handlePaymentSuccess = async (orderInfo: {
    listing: AccountListing;
    paidAmount: number;
    currency: string;
    paymentGateway: string;
    transactionId: string;
    transferCode: string;
    buyerEmail: string;
    buyerName: string;
    purchaseRecord?: any;
  }) => {
    if (!user) return;

    const { listing, paidAmount, currency, paymentGateway, transactionId, transferCode, buyerEmail, buyerName } = orderInfo;

    // BRANCH 1: WALLET PAYMENT (Atomic Server-Side Execution with Idempotency & Zero-Deduction on Failure)
    if (paymentGateway === 'wallet') {
      try {
        const token = await getSafeIdToken(auth.currentUser);
        const purchaseRes = await safeApiFetch('/api/wallet/purchase', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            userId: user.uid,
            listingId: listing.id,
            buyerEmail: buyerEmail || user.email || '',
            buyerName: buyerName || user.displayName || user.email?.split('@')[0] || 'Buyer'
          })
        });

        if (!purchaseRes || purchaseRes.success === false) {
          const errMsg = purchaseRes?.error || 'Failed to complete wallet purchase';
          if (errMsg.toLowerCase().includes('sold')) {
            setListings((prev) =>
              prev.map((l) =>
                l.id === listing.id
                  ? { ...l, status: 'sold', stock: 0, stockCount: 0 }
                  : l
              )
            );
            if (selectedListing?.id === listing.id) {
              setSelectedListing(null);
            }
            alert('This listing is already sold out. Please explore our other available accounts.');
            return;
          }
          alert(errMsg);
          return;
        }

        // Immediately sync deducted wallet balance across whole app
        if (typeof purchaseRes.newBalance === 'number') {
          setWalletBalance(purchaseRes.newBalance);
          setLatestWalletBalance(purchaseRes.newBalance);
          setUserProfile((prev) => prev ? { ...prev, walletBalance: purchaseRes.newBalance } : prev);
        } else {
          await refreshUserProfileAndBalance();
        }

        const completedRecord: PurchaseRecord = purchaseRes.purchaseRecord || {
          id: purchaseRes.txId,
          listingId: listing.id,
          listingTitle: listing.title,
          category: listing.category || 'Log Account',
          price: listing.price,
          paidAmount: listing.price,
          currency: 'NGN',
          sellerId: listing.sellerId,
          sellerName: listing.sellerName,
          sellerEmail: listing.sellerEmail || '',
          buyerId: user.uid,
          buyerName: buyerName,
          buyerEmail: buyerEmail,
          paymentGateway: 'wallet',
          transactionId: purchaseRes.txId,
          purchasedAt: new Date().toISOString(),
          status: 'escrow_holding',
          transferCode: transferCode,
          imageUrl: listing.imageUrl,
          digitalProductDetails: listing.digitalProductDetails,
          type: 'log_account',
          transactionCategory: 'log'
        };

        setPurchases((prev) => [completedRecord, ...prev.filter((p) => p.id !== completedRecord.id)]);
        setSelectedListing(null);
        setBuyingListing(null);
        setIsProcessingPurchase(false);
        setProcessingListing(null);
        setCompletedOrder(completedRecord);
        return;
      } catch (err: any) {
        setIsProcessingPurchase(false);
        setProcessingListing(null);
        const msg = err?.message || 'Wallet purchase failed';
        if (msg.toLowerCase().includes('sold')) {
          setListings((prev) =>
            prev.map((l) =>
              l.id === listing.id
                ? { ...l, status: 'sold', stock: 0, stockCount: 0 }
                : l
            )
          );
          if (selectedListing?.id === listing.id) {
            setSelectedListing(null);
          }
          alert('This listing is already sold out. Please explore our other available accounts.');
          return;
        }
        console.warn('Wallet purchase notice:', msg);
        alert(msg);
        return;
      }
    }

    // If the server has already fulfilled and returned the purchase record
    if ((orderInfo as any).purchaseRecord) {
      const pRecord = (orderInfo as any).purchaseRecord as PurchaseRecord;
      setBuyingListing(null);
      setCompletedOrder(pRecord);
      setPurchases((prev) => [pRecord, ...prev.filter((p) => p.id !== pRecord.id)]);
      handleSelectView('orders');
      await refreshUserProfileAndBalance();
      return;
    }

    // BRANCH 2: DIRECT PAYSTACK CHECKOUT
    const newPurchaseRef = doc(collection(db, 'purchases'));

    // Fetch available inventory items from subcollection first
    let secureDetails: any = undefined;
    let isMultiStock = false;
    let updatedStockVal = 0;

    try {
      const inventoryColRef = collection(db, 'listings', listing.id, 'inventory');
      const inventorySnap = await getDocs(inventoryColRef);

      await runTransaction(db, async (transaction) => {
        const listingRef = doc(db, 'listings', listing.id);
        const liveListingSnap = await transaction.get(listingRef);
        if (!liveListingSnap.exists()) {
          throw new Error('Listing does not exist.');
        }
        const liveListingData = liveListingSnap.data() as any;

        if (!inventorySnap.empty) {
          isMultiStock = true;
          let targetItemDocSnap = null;
          let targetItemId = null;
          let availableCount = 0;

          for (const docSnap of inventorySnap.docs) {
            const liveSnap = await transaction.get(docSnap.ref);
            if (liveSnap.exists()) {
              const itemData = liveSnap.data();
              const itemStatus = (itemData.status || '').toLowerCase();
              if (itemStatus === 'available' || itemData.status === 'Available') {
                availableCount++;
                if (!targetItemDocSnap) {
                  targetItemDocSnap = liveSnap;
                  targetItemId = docSnap.id;
                }
              }
            }
          }

          if (!targetItemDocSnap || !targetItemId) {
            transaction.update(listingRef, { status: 'sold', stock: 0, stockCount: 0 });
            throw new Error('All accounts in this listing have already been purchased. Stock is 0.');
          }

          updatedStockVal = Math.max(0, availableCount - 1);

          const secureRef = doc(db, 'listings', listing.id, 'inventory', targetItemId, 'secure', 'details');
          const liveSecureSnap = await transaction.get(secureRef);
          let secureData: any = {};
          if (liveSecureSnap.exists()) {
            secureData = liveSecureSnap.data();
          } else {
            secureData = targetItemDocSnap.data();
          }

          const rawSec = {
            ...(targetItemDocSnap.data() || {}),
            ...(liveSecureSnap.exists() ? liveSecureSnap.data() : {})
          };
          delete rawSec.status;
          delete rawSec.soldTo;
          delete rawSec.soldToEmail;
          delete rawSec.soldAt;
          delete rawSec.orderId;

          secureDetails = {
            ...rawSec,
            inventoryId: targetItemId,
            accountEmail: rawSec.accountEmail || rawSec.email || '',
            accountPassword: rawSec.accountPassword || rawSec.password || '',
            recoveryInfo: rawSec.recoveryInfo || rawSec.notes || '',
            backupCodes: rawSec.backupCodes || rawSec.twoFactorBackupCodes || rawSec.twoFactorSecretKey || '',
            twoFactorSecretKey: rawSec.twoFactorSecretKey || rawSec.twoFactorSecret || rawSec.twoFactor || rawSec['2fa'] || '',
            twoFactorBackupCodes: rawSec.twoFactorBackupCodes || rawSec.backupCodes || '',
            additionalInstructions: rawSec.additionalInstructions || rawSec.instructions || ''
          };

          // Mark inventory item as Sold in transaction
          transaction.update(targetItemDocSnap.ref, {
            status: 'Sold',
            soldTo: user.uid,
            soldToEmail: buyerEmail || user.email || '',
            orderId: newPurchaseRef.id,
            soldAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          // Sync inventory array on parent doc if present
          let updatedInventoryArray = liveListingData.inventory;
          if (Array.isArray(updatedInventoryArray)) {
            updatedInventoryArray = updatedInventoryArray.map((invItem: any) => {
              if (invItem.id === targetItemId) {
                return {
                  ...invItem,
                  status: 'Sold',
                  soldTo: user.uid,
                  soldToEmail: buyerEmail || user.email || '',
                  orderId: newPurchaseRef.id,
                  soldAt: new Date().toISOString()
                };
              }
              return invItem;
            });
          }

          // Update listing stock & status in transaction
          transaction.update(listingRef, {
            stock: updatedStockVal,
            stockCount: updatedStockVal,
            status: updatedStockVal > 0 ? 'active' : 'sold',
            ...(updatedInventoryArray ? { inventory: updatedInventoryArray } : {})
          });

        } else if (Array.isArray(liveListingData.inventory) && liveListingData.inventory.length > 0) {
          isMultiStock = true;
          // Find first Available account in array
          const availableIdx = liveListingData.inventory.findIndex((acc: any) => (acc.status || '').toLowerCase() === 'available' || acc.status === 'Available');
          if (availableIdx === -1) {
            transaction.update(listingRef, { status: 'sold', stock: 0, stockCount: 0 });
            throw new Error('All accounts in this listing have already been purchased. Stock is 0.');
          }

          const targetAcc = liveListingData.inventory[availableIdx];
          const rawTarget = { ...(targetAcc || {}) };
          delete rawTarget.status;
          delete rawTarget.soldTo;
          delete rawTarget.soldToEmail;
          delete rawTarget.soldAt;
          delete rawTarget.orderId;

          secureDetails = {
            ...rawTarget,
            inventoryId: targetAcc.id || `inv_${availableIdx + 1}`,
            accountEmail: rawTarget.accountEmail || rawTarget.email || '',
            accountPassword: rawTarget.accountPassword || rawTarget.password || '',
            recoveryInfo: rawTarget.recoveryInfo || rawTarget.notes || '',
            backupCodes: rawTarget.backupCodes || rawTarget.twoFactorBackupCodes || rawTarget.twoFactorSecretKey || '',
            twoFactorSecretKey: rawTarget.twoFactorSecretKey || rawTarget.twoFactorSecret || rawTarget.twoFactor || rawTarget['2fa'] || '',
            twoFactorBackupCodes: rawTarget.twoFactorBackupCodes || rawTarget.backupCodes || '',
            additionalInstructions: rawTarget.additionalInstructions || rawTarget.instructions || ''
          };

          const updatedInventory = [...liveListingData.inventory];
          updatedInventory[availableIdx] = {
            ...targetAcc,
            status: 'Sold',
            soldTo: user.uid,
            soldToEmail: buyerEmail || user.email || '',
            orderId: newPurchaseRef.id,
            soldAt: new Date().toISOString()
          };

          const remainingAvailable = updatedInventory.filter((acc: any) => (acc.status || '').toLowerCase() === 'available' || acc.status === 'Available').length;
          updatedStockVal = remainingAvailable;

          transaction.update(listingRef, {
            inventory: updatedInventory,
            stock: remainingAvailable,
            stockCount: remainingAvailable,
            status: remainingAvailable > 0 ? 'active' : 'sold'
          });

        } else {
          // Fallback to legacy single-stock digitalProductDetails
          if (listing.digitalProductDetails?.accountEmail || listing.digitalProductDetails) {
            secureDetails = {
              ...listing.digitalProductDetails,
              accountEmail: listing.digitalProductDetails.accountEmail || listing.digitalProductDetails.email || '',
              accountPassword: listing.digitalProductDetails.accountPassword || listing.digitalProductDetails.password || '',
              recoveryInfo: listing.digitalProductDetails.recoveryInfo || listing.digitalProductDetails.notes || '',
              backupCodes: listing.digitalProductDetails.backupCodes || listing.digitalProductDetails.twoFactorBackupCodes || '',
              twoFactorSecretKey: listing.digitalProductDetails.twoFactorSecretKey || listing.digitalProductDetails.twoFactorSecret || listing.digitalProductDetails['2fa'] || '',
              twoFactorBackupCodes: listing.digitalProductDetails.twoFactorBackupCodes || listing.digitalProductDetails.backupCodes || '',
              additionalInstructions: listing.digitalProductDetails.additionalInstructions || listing.digitalProductDetails.instructions || ''
            };
          }
          transaction.update(listingRef, {
            stock: 0,
            stockCount: 0,
            status: 'sold'
          });
        }
      });
    } catch (err: any) {
      console.error('Error handling multi-stock inventory claim:', err);
      alert(`Checkout failed: ${err?.message || 'Please try again.'}`);
      return;
    }

    const purchaseRecord: PurchaseRecord = {
      id: newPurchaseRef.id,
      listingId: listing.id,
      listingTitle: listing.title,
      category: listing.category,
      price: listing.price,
      paidAmount: paidAmount,
      currency: currency,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      sellerEmail: listing.sellerEmail || '',
      buyerId: user.uid,
      buyerName: buyerName,
      buyerEmail: buyerEmail,
      paymentGateway: paymentGateway,
      transactionId: transactionId,
      purchasedAt: new Date().toISOString(),
      status: 'escrow_holding',
      transferCode: transferCode,
      imageUrl: listing.imageUrl,
      digitalProductDetails: secureDetails || undefined
    };

    // 1. Create Purchase doc in Firestore
    await setDoc(newPurchaseRef, purchaseRecord);

    // 2. Mark listing as 'sold' in Firestore if it was legacy single-stock
    if (!isMultiStock) {
      try {
        const listingRef = doc(db, 'listings', listing.id);
        await setDoc(listingRef, { status: 'sold', stock: 0 }, { merge: true });
      } catch (err) {
        console.warn('Listing status update notice:', err);
      }
    }

    // 3. Notify Seller by creating an inquiry/notification doc in Firestore
    try {
      const inqRef = collection(db, 'inquiries');
      await addDoc(inqRef, {
        listingId: listing.id,
        listingTitle: listing.title,
        buyerId: user.uid,
        buyerEmail: buyerEmail,
        buyerName: buyerName,
        sellerId: listing.sellerId,
        message: `🎉 ORDER CONFIRMED: Account "${listing.title}" was purchased for ${currency} ${paidAmount.toLocaleString()} via ${paymentGateway.toUpperCase()} Escrow! Escrow Token: ${transferCode}. Please release transfer login details to ${buyerEmail}.`,
        createdAt: new Date().toISOString(),
        status: 'unread'
      });
    } catch (err) {
      console.warn('Seller notification notice:', err);
    }

    // 4. Update buyer total spend & credit ₦100 referral bonus if ₦1,000 threshold reached
    try {
      const currentTotalSpent = (userProfile?.totalPurchasesAmount || 0) + paidAmount;
      const isRewardAlreadyClaimed = userProfile?.referralRewardClaimed || false;
      const referrerId = userProfile?.referredBy;

      const buyerUserRef = doc(db, 'users', user.uid);
      const buyerUpdates: Partial<UserProfile> = {
        totalPurchasesAmount: currentTotalSpent
      };

      if (referrerId) {
        const refRecordId = `ref_${user.uid}`;
        const refDocRef = doc(db, 'referrals', refRecordId);

        await setDoc(refDocRef, {
          totalSpent: currentTotalSpent
        }, { merge: true }).catch(() => null);

        // Check ₦1,000 threshold
        if (currentTotalSpent >= 1000 && !isRewardAlreadyClaimed) {
          buyerUpdates.referralRewardClaimed = true;

          const referrerUserRef = doc(db, 'users', referrerId);
          const referrerSnap = await getDoc(referrerUserRef).catch(() => null);

          if (referrerSnap && referrerSnap.exists()) {
            const referrerData = referrerSnap.data() as UserProfile;
            const currentRefBalance = referrerData.walletBalance || 0;
            const currentRefEarnings = referrerData.totalReferralEarnings || 0;
            const newRefBalance = currentRefBalance + 100;
            const newRefEarnings = currentRefEarnings + 100;

            await setDoc(referrerUserRef, {
              walletBalance: newRefBalance,
              totalReferralEarnings: newRefEarnings
            }, { merge: true });

            const refBonusTx: WalletTransaction = {
              id: `tx-ref-${Date.now()}`,
              userId: referrerId,
              type: 'referral_bonus',
              amount: 100,
              description: `Referral Bonus: ${buyerEmail || 'Referred user'} completed ₦1,000+ purchase milestone!`,
              date: new Date().toISOString().replace('T', ' ').slice(0, 16),
              status: 'completed',
              reference: `REF-BONUS-${user.uid.substring(0, 6).toUpperCase()}`
            };
            await addDoc(collection(db, 'wallet_transactions'), refBonusTx);

            await setDoc(refDocRef, {
              rewardClaimed: true,
              rewardClaimedAt: new Date().toISOString(),
              totalSpent: currentTotalSpent,
              rewardAmount: 100
            }, { merge: true });

            if (user.uid === referrerId) {
              setWalletBalance(newRefBalance);
              setWalletTransactions(prev => [refBonusTx, ...prev]);
            }
          }
        }
      }

      await setDoc(buyerUserRef, buyerUpdates, { merge: true });
      setUserProfile(prev => prev ? { ...prev, ...buyerUpdates } : prev);
    } catch (refErr) {
      console.error('Error processing referral bonus reward:', refErr);
    }

    // Close checkout and show completed order modal with credentials
    setIsProcessingPurchase(false);
    setProcessingListing(null);
    setBuyingListing(null);
    setCompletedOrder(purchaseRecord);
    setPurchases((prev) => [purchaseRecord, ...prev.filter((p) => p.id !== purchaseRecord.id)]);
    handleSelectView('orders');
  };

  // Step 1: Open centered Buy Now confirmation modal
  const handleBuyNow = (listing: AccountListing) => {
    if (!user) {
      setAuthMode('login');
      return;
    }

    // Pre-flight check: Is listing already marked sold or out of stock?
    const inventoryAvailable = Array.isArray(listing.inventory)
      ? listing.inventory.filter((acc: any) => (acc.status || '').toLowerCase() !== 'sold').length
      : undefined;
    const docStock = listing.stockCount !== undefined ? listing.stockCount : (listing.stock !== undefined ? listing.stock : 1);
    const effectiveStock = inventoryAvailable !== undefined ? inventoryAvailable : docStock;

    if (listing.status === 'sold' || effectiveStock <= 0) {
      alert('This listing is currently sold out. Please explore our other available accounts.');
      return;
    }

    setConfirmingBuyListing(listing);
  };

  // Step 2: Customer confirmed purchase in modal -> Show processing spinner and complete purchase
  const handleConfirmPurchase = async (listing: AccountListing) => {
    setConfirmingBuyListing(null);

    if (!user) {
      setAuthMode('login');
      return;
    }

    if (isPurchasingRef.current) {
      return;
    }

    setProcessingListing(listing);
    setIsProcessingPurchase(true);
    isPurchasingRef.current = true;

    try {
      // 1. Check user's live walletBalance in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      let currentBalance = 0;
      
      if (userSnap.exists()) {
        const profileData = userSnap.data();
        const balanceVal = profileData.walletBalance;
        currentBalance = typeof balanceVal === 'number'
          ? balanceVal
          : (balanceVal ? Number(balanceVal) : 0);
      } else {
        currentBalance = walletBalance;
      }

      // 2. If insufficient balance: dismiss processing modal and open wallet fund modal
      if (currentBalance < listing.price) {
        setIsProcessingPurchase(false);
        setProcessingListing(null);
        setLatestWalletBalance(currentBalance);
        setInsufficientBalanceListing(listing);
        return;
      }

      // 3. Complete purchase with a smooth minimum delay (1.2s) so loading state is clean and professional
      const startMs = Date.now();
      await handlePaymentSuccess({
        listing: listing,
        paidAmount: listing.price,
        currency: 'NGN',
        paymentGateway: 'wallet',
        transactionId: `WALLET_TX_${Date.now()}`,
        transferCode: `ZENET-ESCROW-${Math.floor(1000 + Math.random() * 9000)}-WALLET`,
        buyerEmail: user.email || '',
        buyerName: user.displayName || user.email?.split('@')[0] || ''
      });

      const elapsed = Date.now() - startMs;
      if (elapsed < 1200) {
        await new Promise((resolve) => setTimeout(resolve, 1200 - elapsed));
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.toLowerCase().includes('sold')) {
        setListings((prev) =>
          prev.map((l) =>
            l.id === listing.id ? { ...l, status: 'sold', stock: 0, stockCount: 0 } : l
          )
        );
        alert('This listing is already sold out. Please explore our other available accounts.');
      } else {
        console.warn('Purchase error:', errMsg);
        alert(errMsg || 'Failed to complete purchase. Please try again.');
      }
    } finally {
      setIsProcessingPurchase(false);
      setProcessingListing(null);
      isPurchasingRef.current = false;
    }
  };

  // Save shortlist to localStorage
  useEffect(() => {
    safeLocalStorage.setItem('zenet_saved_ids', JSON.stringify(savedListingIds));
  }, [savedListingIds]);

  // Handler: Toggle saved item
  const handleToggleSave = React.useCallback((id: string) => {
    setSavedListingIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  // Handler: Create new listing in Firestore
  const handleCreateListing = async (
    listingData: Omit<AccountListing, 'id' | 'createdAt' | 'sellerId'>,
    inventoryList?: any[]
  ) => {
    if (!user) return;
    const newDocRef = doc(collection(db, 'listings'));
    const fullListing: AccountListing = {
      ...listingData,
      id: newDocRef.id,
      creatorId: user.uid,
      createdBy: user.uid,
      creatorEmail: user.email || '',
      creatorRole: userProfile?.role || 'admin',
      sellerId: user.uid,
      owner_id: user.uid,
      approvalStatus: listingData.approvalStatus || 'approved',
      status: listingData.status || 'active',
      featured: listingData.featured || false,
      createdAt: new Date().toISOString()
    };

    // Optimistically update local state immediately
    setListings((prev) => [fullListing, ...prev.filter((item) => item.id !== fullListing.id)]);

    // Reset filters so the newly published listing is immediately visible on top of homepage
    setFilters({
      category: 'All',
      searchQuery: '',
      minPrice: 0,
      maxPrice: 100000000,
      pvaOnly: false,
      monetizedOnly: false,
      twoFactorOnly: false,
      countryFilter: 'All',
      sortBy: 'newest'
    });

    // Save document to Firestore 'listings' collection
    await setDoc(newDocRef, sanitizeFirestorePayload(fullListing));

    // Save multi-stock inventory subcollection if provided
    if (inventoryList && inventoryList.length > 0) {
      for (const item of inventoryList) {
        const itemDocRef = doc(db, 'listings', newDocRef.id, 'inventory', item.id);
        const secureDocRef = doc(db, 'listings', newDocRef.id, 'inventory', item.id, 'secure', 'details');
        
        await setDoc(itemDocRef, {
          ...item,
          id: item.id,
          status: 'available',
          soldTo: null,
          orderId: null,
          soldAt: null
        });

        // Save all dynamic configured delivery fields without stripping
        await setDoc(secureDocRef, {
          ...item,
          id: item.id
        });
      }
    } else {
      const defaultId = 'inv_' + Math.random().toString(36).substr(2, 9);
      const itemDocRef = doc(db, 'listings', newDocRef.id, 'inventory', defaultId);
      const secureDocRef = doc(db, 'listings', newDocRef.id, 'inventory', defaultId, 'secure', 'details');
      
      await setDoc(itemDocRef, {
        id: defaultId,
        status: 'available',
        soldTo: null,
        orderId: null,
        soldAt: null
      });

      // Save all dynamic configured delivery fields without stripping
      await setDoc(secureDocRef, {
        ...(listingData.digitalProductDetails || {}),
        id: defaultId
      });
    }
  };

  // Handler: Send inquiry in Firestore
  const handleSendInquiry = async (data: {
    listingId: string;
    listingTitle: string;
    sellerId: string;
    message: string;
  }) => {
    if (!user) return;
    const inqRef = collection(db, 'inquiries');
    const inquiryDoc: Omit<Inquiry, 'id'> = {
      listingId: data.listingId,
      listingTitle: data.listingTitle,
      buyerId: user.uid,
      buyerEmail: user.email || '',
      buyerName: user.displayName || user.email?.split('@')[0] || 'Buyer',
      sellerId: data.sellerId,
      message: data.message,
      createdAt: new Date().toISOString(),
      status: 'unread'
    };

    await addDoc(inqRef, inquiryDoc);
  };

  // Handler: Update listing status
  const handleUpdateStatus = async (id: string, newStatus: 'active' | 'sold') => {
    const listingRef = doc(db, 'listings', id);
    if (newStatus === 'active') {
      try {
        const snap = await getDoc(listingRef);
        const data = snap.exists() ? snap.data() : null;
        const currentStock = data?.stockCount !== undefined ? data.stockCount : (data?.stock !== undefined ? data.stock : 0);
        const newStock = Math.max(1, currentStock);

        let updatedInv = data?.inventory;
        if (Array.isArray(updatedInv) && updatedInv.length > 0) {
          const hasAvail = updatedInv.some((acc: any) => (acc.status || '').toLowerCase() === 'available');
          if (!hasAvail) {
            updatedInv = updatedInv.map((item: any, idx: number) => 
              idx === 0 ? { ...item, status: 'Available' } : item
            );
          }
        }

        await setDoc(listingRef, { 
          status: 'active',
          stock: newStock,
          stockCount: newStock,
          ...(updatedInv ? { inventory: updatedInv } : {})
        }, { merge: true });

        setListings((prev) => prev.map((item) => item.id === id ? {
          ...item,
          status: 'active',
          stock: newStock,
          stockCount: newStock,
          ...(updatedInv ? { inventory: updatedInv } : {})
        } : item));
      } catch (err) {
        console.warn('Error refreshing listing on active toggle:', err);
        await setDoc(listingRef, { status: 'active', stock: 1, stockCount: 1 }, { merge: true });
      }
    } else {
      await setDoc(listingRef, { status: 'sold', stock: 0, stockCount: 0 }, { merge: true });
      setListings((prev) => prev.map((item) => item.id === id ? {
        ...item,
        status: 'sold',
        stock: 0,
        stockCount: 0
      } : item));
    }
  };

  // Delete listing state & handlers
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleRequestDeleteListing = (id: string) => {
    setDeletingListingId(id);
  };

  const handleConfirmDeleteListing = async () => {
    if (!deletingListingId) return;
    setIsDeleting(true);
    try {
      const listingRef = doc(db, 'listings', deletingListingId);
      await deleteDoc(listingRef);
      setListings((prev) => prev.filter((item) => item.id !== deletingListingId));
      if (selectedListing?.id === deletingListingId) {
        setSelectedListing(null);
      }
    } catch (err) {
      console.error('Failed to delete product from Firestore:', err);
    } finally {
      setIsDeleting(false);
      setDeletingListingId(null);
    }
  };

  // Handler: Update User / Seller Profile and batch sync to seller listings in Firestore
  const handleUpdateProfile = async (updated: Partial<UserProfile>) => {
    if (!userProfile) return;
    const newProfile = { ...userProfile, ...updated };
    setUserProfile(newProfile);

    if (user?.uid) {
      try {
        const q = query(collection(db, 'listings'), where('sellerId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        querySnapshot.forEach((docSnap) => {
          batch.update(docSnap.ref, sanitizeFirestorePayload({
            sellerWhatsapp: updated.whatsapp !== undefined ? updated.whatsapp : (userProfile.whatsapp || ''),
            sellerTelegram: updated.telegram !== undefined ? updated.telegram : (userProfile.telegram || ''),
            sellerName: updated.displayName || userProfile.displayName
          }));
        });
        await batch.commit();

        setListings((prev) =>
          prev.map((item) => {
            if (item.sellerId === user.uid) {
              return {
                ...item,
                sellerWhatsapp: updated.whatsapp !== undefined ? updated.whatsapp : item.sellerWhatsapp,
                sellerTelegram: updated.telegram !== undefined ? updated.telegram : item.sellerTelegram,
                sellerName: updated.displayName || item.sellerName
              };
            }
            return item;
          })
        );
      } catch (e) {
        console.warn('Failed to batch sync seller profile to listings:', e);
      }
    }
  };

  // Memoized category grouping map for homepage
  const categoryGroupedListings = useMemo(() => {
    const groups: Record<string, AccountListing[]> = {};
    const activeListings = listings.filter((item) => item.status !== 'sold');

    const specificCats: CategoryType[] = [
      'Facebook', 'Instagram', 'TikTok', 'YouTube', 'Gmail',
      'Twitter/X', 'Telegram', 'WhatsApp', 'Discord', 'Reddit',
      'Snapchat', 'LinkedIn', 'Pinterest', 'Threads'
    ];

    activeListings.forEach((item) => {
      let matchedCat: string = 'Other';
      for (const cat of specificCats) {
        if (isCategoryMatch(item.category, cat)) {
          matchedCat = cat;
          break;
        }
      }
      if (!groups[matchedCat]) {
        groups[matchedCat] = [];
      }
      groups[matchedCat].push(item);
    });

    return groups;
  }, [listings]);

  // Fast Set lookup for saved listings
  const savedListingIdsSet = useMemo(() => new Set(savedListingIds), [savedListingIds]);

  // Stable handler callbacks for components
  const handleContactSeller = React.useCallback((listing: AccountListing) => {
    setContactListing(listing);
  }, []);

  const handleViewSellerProfile = React.useCallback((sellerId: string, sellerName: string) => {
    navigateRoute({ seller: { id: sellerId, name: sellerName } });
  }, [navigateRoute]);

  // Category counts computation
  const categoryCounts = useMemo(() => {
    const activeListings = listings.filter((item) => item.status !== 'sold');
    const counts: Record<CategoryType, number> = {
      All: activeListings.length,
      Facebook: 0,
      Instagram: 0,
      TikTok: 0,
      Gmail: 0,
      'Twitter/X': 0,
      Telegram: 0,
      Discord: 0,
      Reddit: 0,
      Snapchat: 0,
      LinkedIn: 0,
      Pinterest: 0,
      Threads: 0,
      WhatsApp: 0,
      YouTube: 0,
      Other: 0
    };

    const specificCats: CategoryType[] = [
      'Facebook', 'Instagram', 'TikTok', 'YouTube', 'Gmail',
      'Twitter/X', 'Telegram', 'WhatsApp', 'Discord', 'Reddit',
      'Snapchat', 'LinkedIn', 'Pinterest', 'Threads'
    ];

    activeListings.forEach((item) => {
      let matched = false;
      for (const cat of specificCats) {
        if (isCategoryMatch(item.category, cat)) {
          counts[cat]++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        counts.Other++;
      }
    });

    return counts;
  }, [listings]);

  // Filter & Search computation
  const filteredListings = useMemo(() => {
    const hasSearchQuery = Boolean(filters.searchQuery && filters.searchQuery.trim());
    const searchTerms = hasSearchQuery 
      ? filters.searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
      : [];

    return listings.filter((item) => {
      // 0. Exclude purchased/sold products from public marketplace
      const invAvail = Array.isArray(item.inventory)
        ? item.inventory.filter((acc: any) => (acc.status || '').toLowerCase() !== 'sold').length
        : undefined;
      const stockVal = item.stockCount !== undefined ? item.stockCount : (item.stock !== undefined ? item.stock : 1);
      const effStock = invAvail !== undefined ? invAvail : stockVal;
      if (item.status === 'sold' || effStock <= 0) return false;

      // 1. Category Filter (ALWAYS applied when filters.category !== 'All')
      if (filters.category !== 'All' && !isCategoryMatch(item.category, filters.category)) {
        return false;
      }

      // 2. Search Query Filter (matches real-time by title, category, country, description, niche, sellerName, and badges)
      if (hasSearchQuery) {
        const searchableText = [
          item.title || '',
          item.category || '',
          item.country || '',
          item.description || '',
          item.niche || '',
          item.sellerName || '',
          ...(item.badges || [])
        ].join(' ').toLowerCase();

        const allTermsMatch = searchTerms.every((term) => searchableText.includes(term));
        if (!allTermsMatch) {
          return false;
        }
      }

      // 3. Country Filter
      if (filters.countryFilter && filters.countryFilter !== 'All') {
        if (item.country !== filters.countryFilter) return false;
      }

      // 4. PVA Only
      if (filters.pvaOnly && !item.pva) return false;

      // 5. 2FA Only
      if (filters.twoFactorOnly && !item.twoFactor) return false;

      // 6. Monetized Only
      if (filters.monetizedOnly && !item.monetized) return false;

      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'price-asc') return a.price - b.price;
      if (filters.sortBy === 'price-desc') return b.price - a.price;
      if (filters.sortBy === 'popular') return (b.sellerSalesCount || 0) - (a.sellerSalesCount || 0);
      // default: newest
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [listings, filters]);

  // Featured listings subset
  const featuredListings = useMemo(() => {
    return listings.filter((item) => {
      if (item.status === 'sold') return false;
      const invAvail = Array.isArray(item.inventory)
        ? item.inventory.filter((acc: any) => (acc.status || '').toLowerCase() !== 'sold').length
        : undefined;
      const stockVal = item.stockCount !== undefined ? item.stockCount : (item.stock !== undefined ? item.stock : 1);
      const effStock = invAvail !== undefined ? invAvail : stockVal;
      return effStock > 0 && (item.featured || (item.sellerRating && item.sellerRating >= 4.9));
    });
  }, [listings]);

  // Computed list subsets
  const myListings = useMemo(() => {
    if (!user) return [];
    if (isOwner) {
      // Verified Owner can view and manage all original owner listings (LAn8Lec9ccT6rGEiDdylF8FfPZZ2)
      // plus any listings belonging to their own UID or any marketplace listings.
      return listings.filter((item) => 
        isOwner ||
        item.sellerId === user.uid || 
        item.sellerId === 'LAn8Lec9ccT6rGEiDdylF8FfPZZ2' ||
        isAuthorizedOwnerUid(item.sellerId)
      );
    }
    return listings.filter((item) => item.sellerId === user.uid);
  }, [listings, user, isOwner]);

  const savedListings = useMemo(() => {
    return listings.filter((item) => savedListingIds.includes(item.id));
  }, [listings, savedListingIds]);

  // Auth Loading Splash Screen
  if (authLoading) {
    return (
      <div className="w-full min-h-screen min-h-[100dvh] bg-white text-[#171329] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#7C3AED] shadow-sm flex items-center justify-center text-white font-black text-2xl">
            Z
          </div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#716B82] tracking-wide uppercase">
            <span className="w-4 h-4 border-2 border-[#E9E2FA] border-t-[#7C3AED] rounded-full animate-spin"></span>
            <span>Connecting to ZENET HUB...</span>
          </div>
        </div>
      </div>
    );
  }

  // Enforce authentication: if no user is signed in, display a full-screen landing / authentication screen
  if (!user) {
    return (
      <div className="w-full min-h-screen min-h-[100dvh] bg-white text-[#171329] font-sans antialiased flex flex-col m-0 p-0 overflow-x-hidden">
        <AuthModal
          mode={authMode === 'signup' ? 'signup' : 'login'}
          sessionExpiredNotice={sessionExpiredNotice}
          onClose={() => {
            // Unauthenticated users cannot close the login screen
          }}
          onSwitchMode={(mode) => setAuthMode(mode)}
          onSuccess={() => {
            setActiveView('marketplace');
            setAuthMode(null);
            setSessionExpiredNotice('');
          }}
          hideCloseButton={true}
          isFullScreenPage={true}
        />
      </div>
    );
  }

  // Reliable user profile fallback ensures the user instantly lands on marketplace without flash or delay
  const activeUserProfile: UserProfile = userProfile || {
    uid: user.uid,
    email: user.email || '',
    username: user.displayName || user.email?.split('@')[0] || 'User',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    role: user.email === 'azeezmusharaf4@gmail.com' ? 'owner' : 'buyer',
    status: 'active',
    createdAt: new Date().toISOString(),
    walletBalance: 0
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] text-[#171329] font-sans antialiased flex flex-row selection:bg-[#7C3AED] selection:text-white w-full max-w-full overflow-x-hidden">
      
      {/* Real-time Payment Success Notification Toast */}
      {paymentSuccessToast && (
        <div
          id="zenith-payment-success-toast"
          className="fixed top-5 right-4 sm:right-8 z-50 max-w-md w-[calc(100%-2rem)] bg-white border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                Payment Verified & Credited
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                ₦{paymentSuccessToast.amount.toLocaleString()} NGN added to your wallet!
              </div>
              {typeof paymentSuccessToast.newBalance === 'number' && (
                <div className="text-xs font-semibold text-slate-600 mt-1">
                  New Wallet Balance: <span className="font-bold text-[#5B4DF5]">₦{paymentSuccessToast.newBalance.toLocaleString()} NGN</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPaymentSuccessToast(null)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <Sidebar
        user={user}
        userProfile={userProfile}
        activeView={activeView}
        onSelectView={handleSelectView}
        onOpenAuth={(mode) => setAuthMode(mode)}
        onOpenCreateListing={() => {
          if (!user) {
            setAuthMode('login');
          } else if (!isAdmin) {
            alert('Access Denied: Product management and product creation are restricted to authorized Admin accounts.');
          } else {
            setIsCreateOpen(true);
          }
        }}
        onOpenAdmin={isOwner ? () => {
          setAdminOpen(true);
        } : undefined}
        onOpenSellerDashboard={isAdmin ? () => setIsSellerDashboardOpen(true) : undefined}
        onOpenZenetUpdateGenerator={isOwner ? () => setIsZenetUpdateAdminModalOpen(true) : undefined}
        onLogout={handleLogout}
        savedCount={savedListingIds.length}
        unreadMessagesCount={inquiries.length}
        unreadTicketsCount={unreadTicketsCount}
        walletBalance={walletBalance}
        ordersCount={purchases.length}
      />

      {/* Main Right Area Layout */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
        
        {/* Top Navigation Bar */}
        <Navbar
          user={user}
          userProfile={userProfile}
          onOpenAuth={(mode) => setAuthMode(mode)}
          onOpenCreateListing={() => {
            if (!user) {
              setAuthMode('login');
            } else if (!isAdmin) {
              alert('Access Denied: Product management and product creation are restricted to authorized Admin accounts.');
            } else {
              setIsCreateOpen(true);
            }
          }}
          onOpenDashboard={(tab) => setDashboardTab(tab || 'listings')}
          onOpenSellerDashboard={isAdmin ? () => setIsSellerDashboardOpen(true) : undefined}
          onOpenAdmin={isOwner ? () => {
            setAdminOpen(true);
          } : undefined}
          onLogout={handleLogout}
          searchQuery={filters.searchQuery}
          onSearchChange={(q) => setFilters((prev) => ({ ...prev, searchQuery: q }))}
          savedCount={savedListingIds.length}
          unreadInquiriesCount={inquiries.filter((i) => i.status === 'unread').length}
          onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
          walletBalance={walletBalance}
          onOpenWallet={() => handleSelectView('wallet')}
          onOpenZenetUpdate={() => setIsZenetUpdateModalOpen(true)}
          onOpenSocialBoost={() => handleSelectView('social-boost')}
          activeView={activeView}
          onGoHome={handleBackToMarketplace}
        />

        {/* Left Slide-out Navigation Drawer (☰) */}
        <NavigationDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          user={user}
          userProfile={userProfile}
          activeView={activeView}
          onSelectView={handleSelectView}
          onOpenAuth={(mode) => setAuthMode(mode)}
          onOpenCreateListing={() => {
            if (isAdmin) {
              setIsCreateOpen(true);
            } else {
              alert('Access Denied: Product creation is restricted to authorized Admin accounts.');
            }
          }}
          onOpenAdmin={isOwner ? () => {
            setAdminOpen(true);
          } : undefined}
          onOpenSellerDashboard={isAdmin ? () => setIsSellerDashboardOpen(true) : undefined}
          onOpenZenetUpdateGenerator={isOwner ? () => setIsZenetUpdateAdminModalOpen(true) : undefined}
          onLogout={handleLogout}
          savedCount={savedListingIds.length}
          unreadMessagesCount={inquiries.length}
          unreadTicketsCount={unreadTicketsCount}
          walletBalance={walletBalance}
          ordersCount={purchases.length}
        />

        {/* Main Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-5 pb-24 sm:pb-12 overflow-x-hidden">
          <React.Suspense fallback={<LazyViewFallback />}>

          {/* VIEW: SERVICE NUMBER (UNAVAILABLE) */}
          {(activeView === 'virtual-numbers' || activeView === 'virtual-numbers-2') && (
            <ServiceUnavailableView
              serviceType="service-number"
              onBackToMarketplace={handleBackToMarketplace}
            />
          )}

          {/* VIEW: LOG ACCOUNTS MARKETPLACE */}
          {activeView === 'log-accounts' && (
            <LogAccountsView
              userProfile={userProfile || ({ uid: user?.uid || '', email: user?.email || '', username: user?.displayName || 'Guest', role: 'customer', walletBalance } as any)}
              walletBalance={walletBalance}
              listings={listings}
              listingsLoading={listingsLoading}
              savedListingIdsSet={savedListingIdsSet}
              categoryFilter={filters.category}
              onCategoryFilterChange={(cat) => setFilters(prev => ({ ...prev, category: cat }))}
              searchQuery={filters.searchQuery}
              onSearchChange={(q) => setFilters(prev => ({ ...prev, searchQuery: q }))}
              onRefreshProfile={refreshUserProfileAndBalance}
              onBackToMarketplace={handleBackToMarketplace}
              onOpenWallet={() => handleSelectView('wallet')}
              onSelectListing={handleSelectListing}
              onContactSeller={handleContactSeller}
              onBuyNow={handleBuyNow}
              onToggleSave={handleToggleSave}
              onViewSellerProfile={handleViewSellerProfile}
              onDeleteListing={handleRequestDeleteListing}
            />
          )}

          {/* VIEW 1: CATEGORIES CATALOG */}
          {activeView === 'categories' && (
            <CategoriesView
              listings={listings}
              onBackToMarketplace={handleBackToMarketplace}
              onSelectCategory={(cat) => {
                setFilters((prev) => ({ ...prev, category: cat }));
                setActiveView('log-accounts');
              }}
            />
          )}

          {/* VIEW 2: SUPPORT & FAQ RESOLUTION */}
          {activeView === 'support' && (
            <SupportView
              user={user}
              userProfile={userProfile}
              isOwner={isOwner}
              isAdmin={isAdmin}
              onOpenAuth={(mode) => setAuthMode(mode)}
              onBackToMarketplace={handleBackToMarketplace}
            />
          )}

          {/* VIEW: ADMIN WALLET OVERRIDE (SECURED TO Azeezmusharaf4@gmail.com) */}
          {activeView === 'admin_wallets' && (
            <AdminWalletsView
              user={user}
              userProfile={userProfile}
              onBackToMarketplace={handleBackToMarketplace}
              onOpenAuth={(mode) => setAuthMode(mode)}
              onBalanceUpdated={(newBal) => {
                setWalletBalance(newBal);
                setLatestWalletBalance(newBal);
                setUserProfile((prev) => prev ? { ...prev, walletBalance: newBal, balance: newBal } : prev);
              }}
            />
          )}

          {/* VIEW: SOCIAL BOOST (UNAVAILABLE) */}
          {(activeView === 'social-boost' || activeView === 'social-boost-2' || activeView === 'server-tool') && (
            <ServiceUnavailableView
              serviceType="social-boost"
              onBackToMarketplace={handleBackToMarketplace}
            />
          )}

          {/* VIEW: ORDER & SERVICE HISTORY (NUMBER, LOG, BOOST, UPDATE) */}
          {(activeView === 'orders' || activeView === 'history') && (
            <HistoryView
              user={user}
              userProfile={userProfile}
              purchases={purchases}
              onBack={() => handleSelectView('profile')}
              onSelectView={handleSelectView}
              onOpenAuth={(mode) => setAuthMode(mode)}
              onOpenWallet={() => handleSelectView('wallet')}
            />
          )}

          {/* VIEW: PROFILE PAGE HOSTING ALL MENU OPTIONS */}
          {activeView === 'profile' && (
            <ProfileView
              user={user}
              userProfile={userProfile}
              walletBalance={walletBalance}
              ordersCount={purchases.length}
              savedCount={savedListingIds.length}
              unreadMessagesCount={inquiries.length}
              onSelectView={handleSelectView}
              onOpenDashboard={(tab) => setDashboardTab(tab || 'profile')}
              onOpenWallet={() => {
                if (!user) {
                  setAuthMode('login');
                } else {
                  setIsWalletModalOpen(true);
                }
              }}
              onOpenAdmin={isOwner ? () => setAdminOpen(true) : undefined}
              onOpenSellerDashboard={isAdmin ? () => setIsSellerDashboardOpen(true) : undefined}
              onOpenZenetUpdateGenerator={isOwner ? () => setIsZenetUpdateAdminModalOpen(true) : undefined}
              onLogout={handleLogout}
              onOpenAuth={(mode) => setAuthMode(mode)}
            />
          )}

          {/* VIEW: EDIT PROFILE MATCHING USER REFERENCE DESIGN */}
          {activeView === 'edit-profile' && (
            <EditProfileView
              user={user}
              userProfile={userProfile}
              onBack={() => handleSelectView('profile')}
              onProfileUpdated={(updated) => {
                setUserProfile((prev) => prev ? ({ ...prev, ...updated }) : null);
              }}
              onOpenAuth={(mode) => setAuthMode(mode)}
            />
          )}

          {/* VIEW: REFERRALS MATCHING USER REFERENCE DESIGN */}
          {activeView === 'referrals' && (
            <ReferralsView
              user={user}
              userProfile={userProfile}
              onBack={() => handleSelectView('profile')}
              onProfileUpdated={(updated) => {
                setUserProfile((prev) => prev ? ({ ...prev, ...updated }) : null);
              }}
              onOpenAuth={(mode) => setAuthMode(mode)}
            />
          )}

          {/* VIEW: CHANGE PASSWORD MATCHING USER REFERENCE DESIGN */}
          {activeView === 'change-password' && (
            <ChangePasswordView
              user={user}
              onBack={() => handleSelectView('profile')}
              onOpenAuth={(mode) => setAuthMode(mode)}
            />
          )}

          {/* VIEW 3: MARKETPLACE HOME & DASHBOARD PRESENTATION */}
          {activeView === 'marketplace' && (
            <HomeDashboardView
              user={user}
              userProfile={userProfile}
              walletBalance={walletBalance}
              purchases={purchases}
              onBalanceChange={(newBal) => {
                setWalletBalance(newBal);
                setLatestWalletBalance(newBal);
                setUserProfile((prev) => prev ? { ...prev, walletBalance: newBal } : prev);
              }}
              onOpenWallet={() => {
                if (!user) {
                  setAuthMode('login');
                } else {
                  setIsWalletModalOpen(true);
                }
              }}
              onSelectView={handleSelectView}
              onOpenZenetUpdate={() => setIsZenetUpdateModalOpen(true)}
              onSelectPurchase={(purchase) => setSelectedPurchaseDetails(purchase)}
              onOpenAuth={(mode) => setAuthMode(mode)}
              onOpenDashboard={(tab) => setDashboardTab(tab || 'profile')}
            />
          )}

          </React.Suspense>
        </main>

      {/* Footer */}
      <Footer onSelectCategory={(cat) => {
        setFilters((prev) => ({ ...prev, category: cat }));
        setActiveView('log-accounts');
      }} />

      </div> {/* Close main right area container */}

      {/* MODALS */}

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => navigateRoute({ walletModal: false })}
        user={user}
        walletBalance={walletBalance}
        onAddFunds={handleAddWalletFunds}
        transactions={walletTransactions}
        initialTab={activeView === 'deposit-history' ? 'history' : 'fund'}
      />

      {/* Purchase Details Modal */}
      {selectedPurchaseDetails && (
        <PurchaseDetailsModal
          purchase={selectedPurchaseDetails}
          onClose={() => setSelectedPurchaseDetails(null)}
          onContactSeller={(sellerId, sellerName) => navigateRoute({ seller: { id: sellerId, name: sellerName } })}
        />
      )}

      {/* 1. Listing Detail Drawer/Modal */}
      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          onClose={() => navigateRoute({ product: null })}
          onContactSeller={(listing) => setContactListing(listing)}
          onBuyNow={handleBuyNow}
          isSaved={savedListingIds.includes(selectedListing.id)}
          onToggleSave={handleToggleSave}
          onViewSellerProfile={(sellerId, sellerName) => navigateRoute({ seller: { id: sellerId, name: sellerName } })}
          onDelete={handleRequestDeleteListing}
          canDelete={isOwner || userProfile?.role === 'owner' || user?.email?.toLowerCase() === 'azeezmusharaf4@gmail.com' || userProfile?.role === 'admin' || (userProfile?.role === 'seller' && user?.uid === selectedListing.sellerId)}
        />
      )}

      {/* 2. Create Listing Modal */}
      {isCreateOpen && (
        <CreateListingModal
          user={user}
          userProfile={userProfile}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={handleCreateListing}
        />
      )}

      {/* 3. Authentication Modal */}
      {authMode && (
        <AuthModal
          mode={authMode}
          sessionExpiredNotice={sessionExpiredNotice}
          onClose={() => {
            setAuthMode(null);
            setSessionExpiredNotice('');
          }}
          onSwitchMode={(mode) => setAuthMode(mode)}
          onSuccess={() => {
            setActiveView('marketplace');
            setAuthMode(null);
            setSessionExpiredNotice('');
          }}
        />
      )}

      {/* 4. Contact Seller / Inquiry Modal */}
      {contactListing && (
        <ContactSellerModal
          user={user}
          userProfile={userProfile}
          listing={contactListing}
          onClose={() => setContactListing(null)}
          onSendInquiry={handleSendInquiry}
          onOpenAuth={() => {
            setContactListing(null);
            setAuthMode('login');
          }}
        />
      )}

      {/* 5. User Dashboard Modal */}
      {dashboardTab && (
        <UserDashboardModal
          user={user}
          userProfile={userProfile}
          initialTab={dashboardTab}
          myListings={myListings}
          inquiries={inquiries}
          savedListings={savedListings}
          recentlyViewedListings={listings.filter((item) => recentlyViewedIds.includes(item.id))}
          purchases={purchases}
          onClose={() => navigateRoute({ dashboardTab: null })}
          onSelectListing={(listing) => handleSelectListing(listing)}
          onUpdateListingStatus={handleUpdateStatus}
          onDeleteListing={async (id: string) => { handleRequestDeleteListing(id); }}
          onRemoveSaved={handleToggleSave}
          onClearRecentlyViewed={() => {
            setRecentlyViewedIds([]);
            safeLocalStorage.removeItem('zenet_recent_ids');
          }}
          onBuyNow={handleBuyNow}
          onContactSeller={(listing) => setContactListing(listing)}
          onUpdateProfile={async (updated) => {
            if (userProfile) {
              setUserProfile({ ...userProfile, ...updated });
            }
          }}
          onSignOut={handleLogout}
          onOpenAuth={(mode) => setAuthMode(mode)}
          onSelectView={(view) => handleSelectView(view)}
        />
      )}

      {/* Dedicated Seller Dashboard Modal */}
      {isSellerDashboardOpen && user && isAdmin && (
        <SellerDashboardModal
          user={user}
          userProfile={userProfile}
          myListings={myListings}
          inquiries={inquiries}
          purchases={purchases}
          onClose={() => setIsSellerDashboardOpen(false)}
          onSelectListing={(listing) => {
            setIsSellerDashboardOpen(false);
            handleSelectListing(listing);
          }}
          onOpenCreateListing={() => {
            setIsSellerDashboardOpen(false);
            setIsCreateOpen(true);
          }}
          onUpdateListingStatus={handleUpdateStatus}
          onDeleteListing={async (id: string) => { handleRequestDeleteListing(id); }}
          onBuyNow={handleBuyNow}
          onUpdateProfile={async (updated) => {
            if (userProfile) {
              setUserProfile({ ...userProfile, ...updated });
            }
          }}
          onUpdateListing={(updated) => {
            setListings((prev) =>
              prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
            );
          }}
        />
      )}

      {/* 6. Seller Profile Modal */}
      {selectedSeller && (
        <SellerProfileModal
          sellerId={selectedSeller.id}
          sellerName={selectedSeller.name}
          listings={listings}
          onClose={() => navigateRoute({ seller: null })}
          onSelectListing={(listing) => handleSelectListing(listing)}
          onContactSeller={(listing) => setContactListing(listing)}
        />
      )}

      {/* 7. Admin Moderation Panel */}
      {adminOpen && isOwner && (
        <React.Suspense fallback={null}>
          <AdminPanelModal
            listings={listings}
            user={user}
            userProfile={userProfile}
            onClose={() => setAdminOpen(false)}
            onApproveListing={async (id) => {
              const listingRef = doc(db, 'listings', id);
              await setDoc(listingRef, { approvalStatus: 'approved' }, { merge: true });
            }}
            onRejectListing={async (id) => {
              const listingRef = doc(db, 'listings', id);
              await setDoc(listingRef, { approvalStatus: 'rejected' }, { merge: true });
            }}
            onToggleFeatured={async (id, featured) => {
              const listingRef = doc(db, 'listings', id);
              await setDoc(listingRef, { featured: !featured }, { merge: true });
            }}
            onDeleteListing={handleRequestDeleteListing}
            onUpdateUserProfile={(profile) => setUserProfile(profile)}
            onUpdateListing={(updated) => {
              setListings((prev) =>
                prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
              );
            }}
          />
        </React.Suspense>
      )}

      {/* 8. International Payment Modal (Wallet & Payment Hub) */}
      {buyingListing && (
        <PaymentModal
          user={user}
          userProfile={userProfile}
          listing={buyingListing}
          walletBalance={walletBalance}
          onClose={() => setBuyingListing(null)}
          onPaymentSuccess={handlePaymentSuccess}
          onOpenWallet={() => {
            setBuyingListing(null);
            setIsWalletModalOpen(true);
          }}
          onOpenAuth={() => {
            setBuyingListing(null);
            setAuthMode('login');
          }}
        />
      )}

      {/* 8.1 Insufficient Wallet Balance Modal */}
      {insufficientBalanceListing && (
        <InsufficientBalanceModal
          isOpen={!!insufficientBalanceListing}
          onClose={() => setInsufficientBalanceListing(null)}
          listing={insufficientBalanceListing}
          currentBalance={latestWalletBalance}
          onPayDirectWithPaystack={() => {
            const targetListing = insufficientBalanceListing;
            setInsufficientBalanceListing(null);
            setBuyingListing(targetListing);
          }}
          onOpenFundWallet={() => {
            try {
              sessionStorage.setItem('pending_buynow_listing_id', insufficientBalanceListing.id);
              localStorage.setItem('pending_buynow_listing_id', insufficientBalanceListing.id);
            } catch (e) {
              console.warn('Storage notice:', e);
            }
            setInsufficientBalanceListing(null);
            setIsWalletModalOpen(true);
          }}
        />
      )}

      {/* Buy Now Confirmation Modal */}
      {confirmingBuyListing && (
        <BuyNowConfirmModal
          listing={confirmingBuyListing}
          onCancel={() => setConfirmingBuyListing(null)}
          onConfirm={() => handleConfirmPurchase(confirmingBuyListing)}
        />
      )}

      {/* Buy Now Processing Loading State Modal */}
      {isProcessingPurchase && (
        <PurchaseProcessingModal
          itemName={processingListing?.title}
          price={processingListing?.price}
        />
      )}

      {/* 9. Payment Order Success Page/Modal */}
      {completedOrder && (
        <PaymentSuccessModal
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
          onOpenOrderHistory={() => {
            setCompletedOrder(null);
            handleSelectView('orders');
          }}
          onContactSeller={(listing) => setContactListing(listing)}
        />
      )}

      {/* 10. Product Deletion Confirmation Popup Modal */}
      {deletingListingId && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => {
            if (!isDeleting) setDeletingListingId(null);
          }}
        >
          <div 
            className="bg-white border border-[#EBE7F7] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-xs">
              <Trash2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-[#0F172A]">
                Are you sure you want to delete this product?
              </h3>
              <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                This action is permanent. The product will be deleted from Firebase Firestore and removed immediately from the marketplace.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingListingId(null)}
                disabled={isDeleting}
                className="flex-1 px-5 py-3 rounded-2xl border border-[#EBE7F7] bg-[#F8F7FD] hover:bg-[#F1F0FB] text-[#0F172A] font-bold text-xs sm:text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteListing}
                disabled={isDeleting}
                className="flex-1 px-5 py-3 rounded-2xl bg-[#5B4DF5] hover:bg-[#4839EB] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-[#5B4DF5]/20 transition cursor-pointer flex items-center justify-center space-x-2"
              >
                {isDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Zenet Update & System Upgrades Modal */}
      <React.Suspense fallback={null}>
        <ZenetUpdateModal
          isOpen={isZenetUpdateModalOpen}
          onClose={() => setIsZenetUpdateModalOpen(false)}
          user={user}
          userProfile={userProfile}
          walletBalance={walletBalance}
          isOwner={isOwner}
          isAdmin={isAdmin}
          onBalanceChange={(newBal) => {
            setWalletBalance(newBal);
            setLatestWalletBalance(newBal);
            setUserProfile((prev) => prev ? { ...prev, walletBalance: newBal } : prev);
          }}
          onRefreshProfile={refreshUserProfileAndBalance}
          onOpenAuth={(mode) => setAuthMode(mode)}
          onOpenWallet={() => setIsWalletModalOpen(true)}
          onOpenAdminGenerator={() => setIsZenetUpdateAdminModalOpen(true)}
          onNavigateService={(service) => {
            setIsZenetUpdateModalOpen(false);
            if (service === 'wallet') {
              setIsWalletModalOpen(true);
            } else {
              setActiveView(service);
            }
          }}
        />

        {/* 12. Zenet Update Admin Product Generator Modal (Owner/Admin Only) */}
        <ZenetUpdateAdminModal
          isOpen={isZenetUpdateAdminModalOpen}
          onClose={() => setIsZenetUpdateAdminModalOpen(false)}
          user={user}
          userProfile={userProfile}
          isOwner={isOwner}
          isAdmin={isAdmin}
        />
      </React.Suspense>

      {/* 13. Mobile Bottom Navigation Bar (Home, Wallet, Profile) */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={handleSelectView}
        isWalletOpen={isWalletModalOpen}
        onOpenWallet={() => {
          if (!user) {
            setAuthMode('login');
          } else {
            setIsWalletModalOpen(true);
          }
        }}
      />

      {/* 15. Clean Logout Confirmation Dialog */}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirmLogout={executeLogout}
      />

    </div>
  );
}
