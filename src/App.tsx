import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  runTransaction 
} from 'firebase/firestore';
import { auth, db, sanitizeFirestorePayload, getSafeIdToken } from './lib/firebase';
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
import { AdminPanelModal } from './components/AdminPanelModal';
import { PaymentModal } from './components/PaymentModal';
import { InsufficientBalanceModal } from './components/InsufficientBalanceModal';
import { PaymentSuccessModal } from './components/PaymentSuccessModal';
import { NavigationDrawer } from './components/NavigationDrawer';
import { PurchaseDetailsModal } from './components/PurchaseDetailsModal';
import { WalletModal } from './components/WalletModal';
import { CategoriesView } from './components/CategoriesView';
import { SupportView } from './components/SupportView';
import { LandingPage } from './components/LandingPage';
import { Footer } from './components/Footer';
import { VirtualNumbersView } from './components/VirtualNumbersView';
import { LogAccountsView } from './components/LogAccountsView';
import { AdminWalletsView } from './components/AdminWalletsView';
import { ZenetUpdateModal } from './components/ZenetUpdateModal';
import { ZenetUpdateAdminModal } from './components/ZenetUpdateAdminModal';
import { SocialBoostView } from './components/SocialBoostView';
import { PWAInstallBanner } from './components/PWAInstallPrompt';
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
  Trash2
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
  <div className="w-full bg-[#150c2a]/95 border border-[#2b184d] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 animate-pulse shadow-lg">
    <div className="space-y-2.5">
      <div className="flex items-start space-x-3">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#231343] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#231343] rounded-md w-3/4" />
          <div className="h-3 bg-[#1d0e37] rounded-md w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-[#1d0e37] rounded-md w-full" />
      <div className="flex space-x-2">
        <div className="h-5 bg-[#231343] rounded-full w-16" />
        <div className="h-5 bg-[#231343] rounded-full w-20" />
      </div>
    </div>
    <div className="pt-3 border-t border-[#231343] flex items-center justify-between">
      <div className="h-6 bg-[#231343] rounded-md w-20" />
      <div className="h-8 bg-[#2e1954] rounded-xl w-24" />
    </div>
  </div>
));

export default function App() {
  // Auth state with instant cache hydration
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('zenet_cached_user_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Helper to update and cache user profile
  const setAndCacheUserProfile = (profile: UserProfile | null) => {
    setUserProfile(profile);
    try {
      if (profile) {
        localStorage.setItem('zenet_cached_user_profile', JSON.stringify(profile));
      } else {
        localStorage.removeItem('zenet_cached_user_profile');
      }
    } catch (e) {
      console.warn('Could not cache user profile in localStorage:', e);
    }
  };

  // Firestore listings & inquiries state
  const [listings, setListings] = useState<AccountListing[]>(() => {
    try {
      const cached = localStorage.getItem('zenet_cached_listings');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [listingsLoading, setListingsLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('zenet_cached_listings');
      const parsed = cached ? JSON.parse(cached) : [];
      return parsed.length === 0;
    } catch (e) {
      return true;
    }
  });
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [savedListingIds, setSavedListingIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('zenet_saved_ids');
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
  const [activeView, setActiveView] = useState<ActiveAppView>('landing');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isZenetUpdateModalOpen, setIsZenetUpdateModalOpen] = useState(false);
  const [isZenetUpdateAdminModalOpen, setIsZenetUpdateAdminModalOpen] = useState(false);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<PurchaseRecord | null>(null);

  // Modal open states
  const [selectedListing, setSelectedListing] = useState<AccountListing | null>(null);
  const [contactListing, setContactListing] = useState<AccountListing | null>(null);
  const [buyingListing, setBuyingListing] = useState<AccountListing | null>(null);
  const [insufficientBalanceListing, setInsufficientBalanceListing] = useState<AccountListing | null>(null);
  const [latestWalletBalance, setLatestWalletBalance] = useState<number>(0);
  const [completedOrder, setCompletedOrder] = useState<PurchaseRecord | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string>('');

  const handleLogout = async () => {
    localStorage.removeItem('zenet_last_seen_timestamp');
    localStorage.removeItem('zenet_cached_user_profile');
    setSessionExpiredNotice('');
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setUser(null);
    setAndCacheUserProfile(null);
    setActiveView('landing');
  };

  const [dashboardTab, setDashboardTab] = useState<DashboardTab | null>(null);
  const [isSellerDashboardOpen, setIsSellerDashboardOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<{ id: string; name: string } | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  // Wallet State
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('zenet_cached_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        return typeof parsed.walletBalance === 'number' ? parsed.walletBalance : 0;
      }
    } catch {}
    return 0;
  });
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState<number>(0);

  const isOwner = user?.email?.trim().toLowerCase() === 'azeezmusharaf4@gmail.com' || userProfile?.role === 'owner';
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
      q = query(ticketsRef, where('status', '==', 'open'));
    } else {
      q = query(ticketsRef, where('userId', '==', user.uid));
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
          localStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());
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

  // Sync walletBalance with userProfile
  useEffect(() => {
    if (userProfile) {
      const balance = typeof userProfile.walletBalance === 'number' 
        ? userProfile.walletBalance 
        : (userProfile.walletBalance ? Number(userProfile.walletBalance) : 0);
      setWalletBalance(isNaN(balance) ? 0 : balance);
    } else if (!user) {
      setWalletBalance(0);
    }
  }, [userProfile, user]);

  // Smoothly close Authentication Modal only after both user AND userProfile (including role/wallet) are fully loaded and synchronized
  useEffect(() => {
    if (user && userProfile && authMode) {
      setAuthMode(null);
      setSessionExpiredNotice('');
    }
  }, [user, userProfile, authMode]);

  const handleAddWalletFunds = async (amount: number, gateway: string, reference?: string) => {
    // Verification is executed by server Paystack verify/webhook endpoints.
    if (reference && user) {
      try {
        const verifyRes = await safeApiFetch(`/api/paystack/verify/${encodeURIComponent(reference)}?userId=${encodeURIComponent(user.uid)}&isWalletFunding=true`);
        if (verifyRes.verified && verifyRes.status === 'success') {
          console.log('[Wallet Funding] Verified and balance synced from server.');
        }
      } catch (vErr) {
        console.warn('[Wallet Funding] Server verify notice:', vErr);
      }
    }
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
      'virtual-numbers',
      'log-accounts',
      'categories',
      'support',
      'admin_wallets'
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

  // Select Drawer View action
  const handleSelectView = (view: ActiveAppView) => {
    setIsDrawerOpen(false);

    if (
      view === 'marketplace' ||
      view === 'categories' ||
      view === 'support' ||
      view === 'admin_wallets' ||
      view === 'social-boost' ||
      view === 'virtual-numbers' ||
      view === 'log-accounts'
    ) {
      navigateRoute({ view, dashboardTab: null, walletModal: false, product: null, seller: null });
      return;
    }

    // Modal-backed views require login
    if (!user) {
      if (view === 'dashboard' || view === 'profile' || view === 'settings' || view === 'orders' || view === 'saved' || view === 'messages' || view === 'referrals') {
        navigateRoute({ dashboardTab: 'profile' });
        return;
      }
      setAuthMode('login');
      return;
    }

    if (view === 'dashboard' || view === 'profile') {
      navigateRoute({ dashboardTab: 'profile' });
    } else if (view === 'settings') {
      navigateRoute({ dashboardTab: 'settings' });
    } else if (view === 'orders') {
      navigateRoute({ dashboardTab: 'purchases' });
    } else if (view === 'saved') {
      navigateRoute({ dashboardTab: 'saved' });
    } else if (view === 'messages') {
      navigateRoute({ dashboardTab: 'inquiries' });
    } else if (view === 'referrals') {
      navigateRoute({ dashboardTab: 'referrals' });
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
      const raw = localStorage.getItem('zenet_recent_ids');
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
        localStorage.setItem('zenet_recent_ids', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      return updated;
    });
  }, [navigateRoute]);

  // Listen for Browser Back / Forward buttons (popstate event)
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);

      const vParam = url.searchParams.get('view') as ActiveAppView;
      const isWalletsUrl = url.pathname === '/admin/wallets' || url.pathname === '/admin/wallet' || url.searchParams.get('tab') === 'wallets';
      const validViews: ActiveAppView[] = [
        'marketplace',
        'social-boost',
        'virtual-numbers',
        'log-accounts',
        'categories',
        'support',
        'admin_wallets'
      ];
      const validView: ActiveAppView = (isWalletsUrl || vParam === 'admin_wallets') 
        ? 'admin_wallets' 
        : (vParam && validViews.includes(vParam))
        ? vParam 
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
      if (prodId && listings.length > 0) {
        const match = listings.find((l) => l.id === prodId);
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
  }, [listings]);

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
        localStorage.setItem('pending_referral_code', paramRef.trim().toUpperCase());
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
        localStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());
        setUser(currentUser);
        // Instant unlock - don't block the UI while fetching user doc
        setAuthLoading(false);

        // Sync user profile to Firestore & fetch role asynchronously in background
        const userRef = doc(db, 'users', currentUser.uid);

        // Check for return from Paystack checkout redirect
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const paystackRef = urlParams.get('reference') || urlParams.get('trxref') || (urlParams.get('paystack_verify') && urlParams.get('paystack_verify') !== 'true' ? urlParams.get('paystack_verify') : null);
          if (paystackRef) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

            safeApiFetch(`/api/paystack/verify/${encodeURIComponent(paystackRef)}?userId=${encodeURIComponent(currentUser.uid)}`)
              .then((verifyData) => {
                if (verifyData && verifyData.verified) {
                  console.log('[Paystack Auto-Verify] Payment verified successfully:', verifyData);
                  getDoc(userRef).then((uSnap) => {
                    if (uSnap.exists()) {
                      const updatedProfile = uSnap.data() as UserProfile;
                      setAndCacheUserProfile(updatedProfile);

                      // Check for pending Buy Now order to resume after wallet funding verification
                      const pendingListingId = sessionStorage.getItem('pending_buynow_listing_id') || localStorage.getItem('pending_buynow_listing_id');
                      if (pendingListingId) {
                        sessionStorage.removeItem('pending_buynow_listing_id');
                        localStorage.removeItem('pending_buynow_listing_id');

                        getDoc(doc(db, 'listings', pendingListingId)).then((listingDocSnap) => {
                          if (listingDocSnap.exists()) {
                            const listingObj = { id: listingDocSnap.id, ...listingDocSnap.data() } as AccountListing;
                            const liveBal = typeof updatedProfile.walletBalance === 'number'
                              ? updatedProfile.walletBalance
                              : Number(updatedProfile.walletBalance || 0);

                            if (liveBal >= listingObj.price) {
                              handleBuyNow(listingObj);
                            }
                          }
                        }).catch((lErr) => console.warn('Pending listing fetch error:', lErr));
                      }
                    }
                  });
                }
              })
              .catch((pvErr) => console.warn('Paystack auto-verify notice:', pvErr));
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
          if (currentUser.email === 'azeezmusharaf4@gmail.com') {
            assignedRole = 'owner';
          }

          const myReferralCode = existingData.referralCode || `ZN-${currentUser.uid.substring(0, 6).toUpperCase()}`;
          let referredBy = existingData.referredBy || null;

          // Check if brand new user or unlinked referral
          if (!referredBy) {
            const pendingRefCode = localStorage.getItem('pending_referral_code');
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

                    localStorage.removeItem('pending_referral_code');
                  }
                }
              } catch (err) {
                console.warn('Error linking referral code:', err);
              }
            }
          }

          const profileData: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Administrator',
            createdAt: existingData.createdAt || new Date().toISOString(),
            role: assignedRole,
            status: existingData.status || 'active',
            referralCode: myReferralCode,
            referredBy: referredBy || undefined,
            totalPurchasesAmount: existingData.totalPurchasesAmount || 0,
            referralRewardClaimed: existingData.referralRewardClaimed || false,
            referralCount: existingData.referralCount || 0,
            totalReferralEarnings: existingData.totalReferralEarnings || 0,
            walletBalance: existingData.walletBalance || 0,
            paystackCustomerCode: existingData.paystackCustomerCode || undefined
          };

          await setDoc(userRef, sanitizeFirestorePayload(profileData), { merge: true });
          setAndCacheUserProfile(profileData);
          if (activeView === 'landing') {
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
          }
        } catch (err) {
          console.error('Error writing user profile:', err);
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
        localStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());
      }
    });

    return () => {
      unsubscribe();
      unsubscribeToken();
    };
  }, []);

  // 1b. Real-time User Profile sync
  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setAndCacheUserProfile(data);
        if (typeof data.walletBalance === 'number') {
          setWalletBalance(data.walletBalance);
          setLatestWalletBalance(data.walletBalance);
        }
      }
    }, (err) => {
      console.warn('User profile listener notice:', err);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Real-time Firestore Listings listener (Displays real listings from Firebase)
  useEffect(() => {
    const listingsRef = collection(db, 'listings');
    
    const unsubscribe = onSnapshot(listingsRef, (snapshot) => {
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
        localStorage.setItem('zenet_cached_listings', JSON.stringify(docsData));
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
    const q = query(inquiriesRef, where('sellerId', '==', user.uid));
    
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
    const q = query(purchasesRef, where('buyerId', '==', user.uid));

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
    const q = query(txRef, where('userId', '==', user.uid));

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
  }) => {
    if (!user) return;

    const { listing, paidAmount, currency, paymentGateway, transactionId, transferCode, buyerEmail, buyerName } = orderInfo;

    // BRANCH 1: WALLET PAYMENT (Atomic Server-Side Execution with Idempotency & Zero-Deduction on Failure)
    if (paymentGateway === 'wallet') {
      try {
        const purchaseRes = await safeApiFetch('/api/wallet/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            listingId: listing.id,
            buyerEmail: buyerEmail || user.email || '',
            buyerName: buyerName || user.displayName || user.email?.split('@')[0] || 'Buyer'
          })
        });

        if (!purchaseRes || purchaseRes.success === false) {
          throw new Error(purchaseRes?.error || 'Failed to complete wallet purchase');
        }

        const completedRecord: PurchaseRecord = purchaseRes.purchaseRecord || {
          id: purchaseRes.txId,
          listingId: listing.id,
          listingTitle: listing.title,
          category: listing.category,
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
          digitalProductDetails: listing.digitalProductDetails
        };

        setCompletedOrder(null);
        setBuyingListing(null);
        navigateRoute({ dashboardTab: 'purchases' });
        return;
      } catch (err: any) {
        console.error('Secure wallet purchase error:', err);
        throw err;
      }
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

          secureDetails = {
            inventoryId: targetItemId,
            accountEmail: secureData.accountEmail || '',
            accountPassword: secureData.accountPassword || '',
            recoveryInfo: secureData.recoveryInfo || secureData.notes || '',
            backupCodes: secureData.backupCodes || secureData.twoFactorBackupCodes || secureData.twoFactorSecretKey || '',
            twoFactorSecretKey: secureData.twoFactorSecretKey || '',
            twoFactorBackupCodes: secureData.twoFactorBackupCodes || secureData.backupCodes || '',
            additionalInstructions: secureData.additionalInstructions || ''
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
          secureDetails = {
            inventoryId: targetAcc.id || `inv_${availableIdx + 1}`,
            accountEmail: targetAcc.accountEmail || '',
            accountPassword: targetAcc.accountPassword || '',
            recoveryInfo: targetAcc.recoveryInfo || targetAcc.notes || '',
            backupCodes: targetAcc.backupCodes || targetAcc.twoFactorBackupCodes || targetAcc.twoFactorSecretKey || '',
            twoFactorSecretKey: targetAcc.twoFactorSecretKey || '',
            twoFactorBackupCodes: targetAcc.twoFactorBackupCodes || targetAcc.backupCodes || '',
            additionalInstructions: targetAcc.additionalInstructions || ''
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
          if (listing.digitalProductDetails?.accountEmail) {
            secureDetails = {
              accountEmail: listing.digitalProductDetails.accountEmail || '',
              accountPassword: listing.digitalProductDetails.accountPassword || '',
              recoveryInfo: listing.digitalProductDetails.recoveryInfo || '',
              backupCodes: listing.digitalProductDetails.backupCodes || listing.digitalProductDetails.twoFactorBackupCodes || '',
              twoFactorSecretKey: listing.digitalProductDetails.twoFactorSecretKey || '',
              twoFactorBackupCodes: listing.digitalProductDetails.twoFactorBackupCodes || listing.digitalProductDetails.backupCodes || '',
              additionalInstructions: listing.digitalProductDetails.additionalInstructions || ''
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

    // Close checkout and open Orders & History cleanly
    setBuyingListing(null);
    setCompletedOrder(null);
    navigateRoute({ dashboardTab: 'purchases' });
  };

  // Handler: Secure and Streamlined Wallet Buy Now Flow
  const handleBuyNow = async (listing: AccountListing) => {
    if (!user) {
      setAuthMode('login');
      return;
    }

    try {
      // 1. First check the user's walletBalance in Firebase
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

      // 2. If walletBalance >= product price: Complete purchase automatically
      if (currentBalance >= listing.price) {
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
      } else {
        // 3. If walletBalance < product price: Show insufficient balance message
        setLatestWalletBalance(currentBalance);
        setInsufficientBalanceListing(listing);
      }
    } catch (err) {
      console.error('Error in streamlined buy now flow:', err);
    }
  };

  // Save shortlist to localStorage
  useEffect(() => {
    localStorage.setItem('zenet_saved_ids', JSON.stringify(savedListingIds));
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
          id: item.id,
          status: 'available',
          soldTo: null,
          orderId: null,
          soldAt: null
        });

        await setDoc(secureDocRef, {
          id: item.id,
          accountEmail: item.accountEmail || '',
          accountPassword: item.accountPassword || '',
          additionalInstructions: item.additionalInstructions || '',
          notes: item.notes || ''
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

      await setDoc(secureDocRef, {
        id: defaultId,
        accountEmail: listingData.digitalProductDetails?.accountEmail || '',
        accountPassword: listingData.digitalProductDetails?.accountPassword || '',
        additionalInstructions: listingData.digitalProductDetails?.additionalInstructions || '',
        notes: listingData.digitalProductDetails?.recoveryInfo || ''
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
    await setDoc(listingRef, { status: newStatus }, { merge: true });
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
      if (item.status === 'sold') return false;

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
    return listings.filter((item) => item.status !== 'sold' && (item.featured || item.sellerRating >= 4.9));
  }, [listings]);

  // Computed list subsets
  const myListings = useMemo(() => {
    if (!user) return [];
    return listings.filter((item) => item.sellerId === user.uid);
  }, [listings, user]);

  const savedListings = useMemo(() => {
    return listings.filter((item) => savedListingIds.includes(item.id));
  }, [listings, savedListingIds]);

  // Auth Loading Splash Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#070311] text-purple-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 p-0.5 animate-pulse shadow-lg shadow-purple-600/30">
            <div className="w-full h-full bg-[#0d061f] rounded-[14px] flex items-center justify-center text-white font-black text-2xl">
              Z
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs font-bold text-purple-300/80 tracking-wide uppercase">
            <span className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin"></span>
            <span>Connecting to ZENET HUB...</span>
          </div>
        </div>
      </div>
    );
  }

  // Enforce authentication: if no user is signed in, display a full-screen landing / authentication screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#070311] text-purple-100 font-sans antialiased flex flex-col items-center justify-center p-4 w-full">
        <AuthModal
          mode={authMode === 'signup' ? 'signup' : 'login'}
          sessionExpiredNotice={sessionExpiredNotice}
          onClose={() => {
            // Unauthenticated users cannot close the login screen
          }}
          onSwitchMode={(mode) => setAuthMode(mode)}
          onSuccess={() => {
            // Success handler is managed by our dedicated useEffect to ensure smooth transition
          }}
          hideCloseButton={true}
        />
      </div>
    );
  }

  // Prevent flash of un-synchronized profile data upon initial successful login
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-[#070311] text-purple-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 p-0.5 animate-pulse shadow-lg shadow-purple-600/30">
            <div className="w-full h-full bg-[#0d061f] rounded-[14px] flex items-center justify-center text-white font-black text-2xl">
              Z
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs font-bold text-purple-300/80 tracking-wide uppercase">
            <span className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin"></span>
            <span>Synchronizing user session...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070311] text-purple-100 font-sans antialiased flex flex-row selection:bg-purple-600 selection:text-white w-full max-w-full overflow-x-hidden">
      
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
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-5 pb-8 sm:pb-12 overflow-x-hidden">

          {/* VIEW: VIRTUAL NUMBERS MARKETPLACE */}
          {activeView === 'virtual-numbers' && userProfile && (
            <VirtualNumbersView
              userProfile={userProfile}
              walletBalance={walletBalance}
              onRefreshProfile={async () => {
                if (!user) return;
                const userRef = doc(db, 'users', user.uid);
                const uSnap = await getDoc(userRef);
                if (uSnap.exists()) {
                  setUserProfile(uSnap.data() as UserProfile);
                }
              }}
              onBackToMarketplace={() => setActiveView('marketplace')}
              onOpenWallet={() => handleSelectView('wallet')}
            />
          )}

          {/* VIEW: LOG ACCOUNTS MARKETPLACE */}
          {activeView === 'log-accounts' && userProfile && (
            <LogAccountsView
              userProfile={userProfile}
              walletBalance={walletBalance}
              listings={listings}
              listingsLoading={listingsLoading}
              savedListingIdsSet={savedListingIdsSet}
              categoryFilter={filters.category}
              onCategoryFilterChange={(cat) => setFilters(prev => ({ ...prev, category: cat }))}
              searchQuery={filters.searchQuery}
              onSearchChange={(q) => setFilters(prev => ({ ...prev, searchQuery: q }))}
              onRefreshProfile={async () => {
                if (!user) return;
                const userRef = doc(db, 'users', user.uid);
                const uSnap = await getDoc(userRef);
                if (uSnap.exists()) {
                  setUserProfile(uSnap.data() as UserProfile);
                }
              }}
              onBackToMarketplace={() => setActiveView('marketplace')}
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
            />
          )}

          {/* VIEW: ADMIN WALLET OVERRIDE (SECURED TO Azeezmusharaf4@gmail.com) */}
          {activeView === 'admin_wallets' && (
            <AdminWalletsView
              user={user}
              userProfile={userProfile}
              onBackToMarketplace={() => handleSelectView('marketplace')}
              onOpenAuth={(mode) => setAuthMode(mode)}
            />
          )}

          {/* VIEW: SOCIAL BOOST GROW HTH */}
          {activeView === 'social-boost' && (
            <SocialBoostView
              userProfile={userProfile}
              walletBalance={walletBalance}
              onBackToMarketplace={() => setActiveView('marketplace')}
              onOpenWallet={() => handleSelectView('wallet')}
            />
          )}

          {/* VIEW 3: MARKETPLACE HOME */}
          {activeView === 'marketplace' && (
            <>
              {/* Main Services UI Grid */}
              <div className="mb-8">
                <div className="space-y-1 mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#9e67fa] block">
                    OUR VERIFIED SOLUTIONS
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-1.5">
                    <span>Main Services</span>
                    <span className="text-[#a16eff] font-black">•</span>
                  </h3>
                </div>

                {/* Unified Balance and Funding Widget */}
                <div className="relative overflow-hidden flex items-center justify-between space-x-4 text-xs sm:text-sm font-black text-white mb-6 bg-gradient-to-r from-[#170830] via-[#24114f] to-[#170830] border border-[#7d4cf7]/40 px-5 py-3.5 rounded-2xl shadow-[0_0_20px_rgba(125,76,247,0.15)]">
                  {/* Subtle shining light sweep reflection */}
                  <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-40 animate-pulse" />
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-[#c1a0ff] tracking-widest uppercase text-[10px] sm:text-xs">Balance</span>
                    <span className="font-black text-white text-sm sm:text-base font-mono bg-black/40 px-3 py-1.5 rounded-lg border border-purple-900/30">
                      ₦{walletBalance.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => setIsWalletModalOpen(true)}
                    className="relative overflow-hidden px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8a4ff7] to-[#b37eff] hover:from-[#965eff] hover:to-[#be8eff] text-white font-black text-xs sm:text-sm transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(138,79,247,0.4)] hover:shadow-[0_0_22px_rgba(138,79,247,0.6)] active:scale-95 flex items-center space-x-2 border border-purple-300/30 uppercase tracking-wider"
                  >
                    <span>Fund Account</span>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* ROW 1 LEFT: Log Accounts */}
                  <button
                    id="main-service-log-accounts"
                    onClick={() => setActiveView('log-accounts')}
                    className="flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-[24px] bg-[#0c051f] border border-[#1b0d38] hover:border-[#4d24a3] hover:bg-[#12082b] transition duration-300 cursor-pointer group shadow-lg min-h-[180px]"
                  >
                    <div className="p-5 rounded-[22px] bg-[#1a0d3b] text-[#bd93f9] border border-[#2b165c] group-hover:scale-105 transition duration-300 shrink-0 mb-4 flex items-center justify-center">
                      <UserCheck className="w-6.5 h-6.5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-white text-sm sm:text-base">Log Accounts</h4>
                      <p className="text-[10px] sm:text-xs text-purple-300/40 font-semibold leading-tight max-w-[140px] mx-auto">
                        Purchase verified digital logs
                      </p>
                    </div>
                  </button>

                  {/* ROW 1 RIGHT: Virtual Numbers */}
                  <button
                    id="main-service-virtual-numbers"
                    onClick={() => setActiveView('virtual-numbers')}
                    className="flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-[24px] bg-[#0c051f] border border-[#1b0d38] hover:border-[#4d24a3] hover:bg-[#12082b] transition duration-300 cursor-pointer group shadow-lg min-h-[180px]"
                  >
                    <div className="p-5 rounded-[22px] bg-[#1a0d3b] text-[#bd93f9] border border-[#2b165c] group-hover:scale-105 transition duration-300 shrink-0 mb-4 flex items-center justify-center">
                      <Phone className="w-6.5 h-6.5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-white text-sm sm:text-base">Virtual Numbers</h4>
                      <p className="text-[10px] sm:text-xs text-purple-300/40 font-semibold leading-tight max-w-[140px] mx-auto">
                        Buy active virtual phone numbers
                      </p>
                    </div>
                  </button>

                  {/* ROW 2 LEFT: Social Boost */}
                  <button
                    id="main-service-social-boost"
                    onClick={() => handleSelectView('social-boost')}
                    className="flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-[24px] bg-[#0c051f] border border-[#1b0d38] hover:border-[#4d24a3] hover:bg-[#12082b] transition duration-300 cursor-pointer group shadow-lg min-h-[180px]"
                  >
                    <div className="p-5 rounded-[22px] bg-[#1a0d3b] text-indigo-400 border border-[#2b165c] group-hover:scale-105 transition duration-300 shrink-0 mb-4 flex items-center justify-center animate-pulse">
                      <TrendingUp className="w-6.5 h-6.5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-white text-sm sm:text-base">Social Boost</h4>
                      <p className="text-[10px] sm:text-xs text-purple-300/40 font-semibold leading-tight max-w-[140px] mx-auto">
                        Automated growth panels & social boosting services
                      </p>
                    </div>
                  </button>

                  {/* ROW 2 RIGHT: Zenet update */}
                  <button
                    id="main-service-zenet-update"
                    onClick={() => setIsZenetUpdateModalOpen(true)}
                    className="flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-[24px] bg-[#0c051f] border border-[#1b0d38] hover:border-[#4d24a3] hover:bg-[#12082b] transition duration-300 cursor-pointer group shadow-lg min-h-[180px]"
                  >
                    <div className="p-5 rounded-[22px] bg-[#1a0d3b] text-[#bd93f9] border border-[#2b165c] group-hover:scale-105 transition duration-300 shrink-0 mb-4 flex items-center justify-center">
                      <Sparkles className="w-6.5 h-6.5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-white text-sm sm:text-base">ZENET HUB Update</h4>
                      <p className="text-[10px] sm:text-xs text-purple-300/40 font-semibold leading-tight max-w-[140px] mx-auto">
                        Get the latest verified system updates and digital releases
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

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
            // No-op here; let our dedicated useEffect close the modal
            // only after both the authenticated user and userProfile states are fully synchronized.
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
            localStorage.removeItem('zenet_recent_ids');
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
          onOpenFundWallet={() => {
            try {
              sessionStorage.setItem('pending_buynow_listing_id', insufficientBalanceListing.id);
            } catch (e) {
              console.warn('Storage notice:', e);
            }
            setInsufficientBalanceListing(null);
            setIsWalletModalOpen(true);
          }}
        />
      )}

      {/* 9. Payment Order Success Page/Modal */}
      {completedOrder && (
        <PaymentSuccessModal
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
          onOpenOrderHistory={() => {
            setCompletedOrder(null);
            setDashboardTab('purchases');
          }}
          onContactSeller={(listing) => setContactListing(listing)}
        />
      )}

      {/* 10. Product Deletion Confirmation Popup Modal */}
      {deletingListingId && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => {
            if (!isDeleting) setDeletingListingId(null);
          }}
        >
          <div 
            className="bg-[#170c2e] border border-rose-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40 shadow-inner">
              <Trash2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-white">
                Are you sure you want to delete this product?
              </h3>
              <p className="text-xs sm:text-sm text-purple-300/80 leading-relaxed">
                This action is permanent. The product will be deleted from Firebase Firestore and removed immediately from the marketplace.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingListingId(null)}
                disabled={isDeleting}
                className="flex-1 px-5 py-3 rounded-2xl border border-[#371d67] bg-[#221043] hover:bg-[#2e165b] text-purple-200 font-bold text-xs sm:text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteListing}
                disabled={isDeleting}
                className="flex-1 px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-rose-600/40 transition cursor-pointer flex items-center justify-center space-x-2"
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
      <ZenetUpdateModal
        isOpen={isZenetUpdateModalOpen}
        onClose={() => setIsZenetUpdateModalOpen(false)}
        user={user}
        userProfile={userProfile}
        walletBalance={walletBalance}
        isOwner={isOwner}
        isAdmin={isAdmin}
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

      {/* 13. Progressive Web App (PWA) Install Prompt Banner */}
      <PWAInstallBanner />

    </div>
  );
}
