import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare, 
  UserCheck, 
  TrendingUp, 
  Sparkles, 
  Wallet,
  Phone,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  RefreshCw,
  ShoppingBag,
  Lock
} from 'lucide-react';
import { PurchaseRecord, UserProfile, ActiveAppView } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export type HistoryCategory = 'number' | 'log' | 'boost' | 'update';

interface HistoryViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  purchases: PurchaseRecord[];
  onBack: () => void;
  onSelectView: (view: ActiveAppView) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenWallet: () => void;
  initialCategory?: HistoryCategory | null;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  user,
  userProfile,
  purchases = [],
  onBack,
  onSelectView,
  onOpenAuth,
  onOpenWallet,
  initialCategory = null
}) => {
  const [selectedCategory, setSelectedCategory] = useState<HistoryCategory | null>(initialCategory);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Additional live orders loaded for Virtual Numbers and Social Boost
  const [apiNumberOrders, setApiNumberOrders] = useState<any[]>([]);
  const [apiBoostOrders, setApiBoostOrders] = useState<any[]>([]);
  const [apiUpdateOrders, setApiUpdateOrders] = useState<any[]>([]);
  const [isLoadingExtras, setIsLoadingExtras] = useState<boolean>(false);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const togglePasswordVisibility = (orderId: string) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Fetch orders from API endpoints & collections if user is logged in
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    setIsLoadingExtras(true);

    const fetchExtraOrders = async () => {
      try {
        // 1. Virtual number orders
        try {
          const res = await fetch(`/api/onegridhub/orders?action=orders&userId=${encodeURIComponent(user.uid)}`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted && Array.isArray(data)) {
              setApiNumberOrders(data);
            }
          }
        } catch (e) {
          console.warn('Could not fetch onegridhub number orders:', e);
        }

        // 2. Social boost orders
        try {
          const res = await fetch(`/api/social-boost/orders?action=orders&userId=${encodeURIComponent(user.uid)}`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data && Array.isArray(data.orders)) {
              setApiBoostOrders(data.orders);
            }
          }
        } catch (e) {
          console.warn('Could not fetch boost orders:', e);
        }

        // 3. Zenet update orders from Firestore
        try {
          const uRef = collection(db, 'zenedUpdateOrders');
          const q = query(uRef, where('buyerId', '==', user.uid));
          const snap = await getDocs(q);
          if (isMounted && !snap.empty) {
            const updates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setApiUpdateOrders(updates);
          }
        } catch (e) {
          console.warn('Could not fetch zenedUpdateOrders:', e);
        }
      } finally {
        if (isMounted) setIsLoadingExtras(false);
      }
    };

    fetchExtraOrders();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Categorize orders
  // 1. Number Orders
  const numberOrders = useMemo(() => {
    const fromPurchases = purchases
      .filter((p) => p.type === 'virtual_number' || p.category === 'virtual_number' || Boolean(p.phoneNumber))
      .map((p) => ({
        id: p.id,
        orderId: p.transactionId || p.id,
        phoneNumber: p.phoneNumber || '',
        smsCode: p.smsCode || '',
        smsText: p.smsText || '',
        status: p.orderStatus || p.status || 'COMPLETED',
        service: p.listingTitle || 'Virtual Number',
        country: (p as any).country || '',
        price: p.paidAmount || p.price || 0,
        createdAt: p.purchasedAt || new Date().toISOString(),
        source: 'purchases'
      }));

    const fromApi = apiNumberOrders.map((o) => ({
      id: o.orderId || o.id,
      orderId: o.orderId || o.id,
      phoneNumber: o.phoneNumber || o.phone || '',
      smsCode: o.code || o.smsCode || '',
      smsText: o.smsText || '',
      status: o.status || 'WAITING',
      service: o.service || 'Virtual Number',
      country: o.country || '',
      price: o.customerPrice || o.price || 0,
      createdAt: o.createdAt || new Date().toISOString(),
      source: 'api'
    }));

    // Deduplicate by phoneNumber or id
    const combined = [...fromApi];
    for (const p of fromPurchases) {
      if (!combined.some((c) => (c.phoneNumber && c.phoneNumber === p.phoneNumber) || c.id === p.id)) {
        combined.push(p);
      }
    }

    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [purchases, apiNumberOrders]);

  // 2. Log Account Orders
  const logOrders = useMemo(() => {
    return purchases
      .filter((p) => {
        // Exclude virtual numbers, social boost, and update products
        if (p.type === 'virtual_number' || p.phoneNumber) return false;
        if (p.type === 'social_boost') return false;
        if (p.type === 'zenet_update') return false;
        const titleLower = (p.listingTitle || '').toLowerCase();
        if (titleLower.includes('update package') || titleLower.includes('zenet update')) return false;
        return true;
      })
      .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
  }, [purchases]);

  // 3. Social Boost Orders
  const boostOrders = useMemo(() => {
    const fromPurchases = purchases
      .filter((p) => p.type === 'social_boost')
      .map((p) => ({
        id: p.id,
        orderId: p.transactionId || p.id,
        serviceName: p.listingTitle || 'Social Boost Order',
        target: (p as any).target || '',
        quantity: (p as any).quantity || 1000,
        charge: p.paidAmount || p.price || 0,
        status: (p as any).orderStatus || p.status || 'completed',
        createdAt: p.purchasedAt || new Date().toISOString()
      }));

    const fromApi = apiBoostOrders.map((o) => ({
      id: o.orderId || o.id,
      orderId: o.orderId || o.id,
      serviceName: o.serviceName || 'Social Boost Order',
      target: o.target || '',
      quantity: o.quantity || 0,
      charge: o.charge || 0,
      status: o.status || 'pending',
      createdAt: o.createdAt || new Date().toISOString()
    }));

    const combined = [...fromApi];
    for (const p of fromPurchases) {
      if (!combined.some((c) => c.id === p.id || c.orderId === p.orderId)) {
        combined.push(p);
      }
    }

    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [purchases, apiBoostOrders]);

  // 4. Zenet Update Orders
  const updateOrders = useMemo(() => {
    const fromPurchases = purchases
      .filter((p) => {
        if (p.type === 'zenet_update') return true;
        const titleLower = (p.listingTitle || '').toLowerCase();
        return titleLower.includes('update') || titleLower.includes('zenet update');
      })
      .map((p) => ({
        id: p.id,
        productName: p.listingTitle || 'Zenet Update Package',
        price: p.paidAmount || p.price || 0,
        secretDeliveryInfo: p.digitalProductDetails?.additionalInstructions || p.digitalProductDetails?.accountPassword || '',
        privateDeliveryLink: (p as any).privateDeliveryLink || '',
        purchasedAt: p.purchasedAt || new Date().toISOString(),
        transactionId: p.transactionId || p.id
      }));

    const fromApi = apiUpdateOrders.map((u) => ({
      id: u.id,
      productName: u.productName || u.name || 'Zenet Update Package',
      price: u.price || 0,
      secretDeliveryInfo: u.secretDeliveryInfo || '',
      privateDeliveryLink: u.privateDeliveryLink || '',
      purchasedAt: u.purchasedAt || u.createdAt || new Date().toISOString(),
      transactionId: u.transactionId || u.id
    }));

    const combined = [...fromApi];
    for (const p of fromPurchases) {
      if (!combined.some((c) => c.id === p.id || c.transactionId === p.transactionId)) {
        combined.push(p);
      }
    }

    return combined.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
  }, [purchases, apiUpdateOrders]);

  // Count items
  const counts = {
    number: numberOrders.length,
    log: logOrders.length,
    boost: boostOrders.length,
    update: updateOrders.length
  };

  // Helper when clicking back button
  const handleGoBack = () => {
    if (selectedCategory !== null) {
      setSelectedCategory(null);
      setSearchQuery('');
    } else {
      onBack();
    }
  };

  // --------------------------------------------------------------------------
  // RENDER: SUB-VIEWS (when user clicks any of the 4 cards)
  // --------------------------------------------------------------------------

  const renderSubViewContent = () => {
    if (!user) {
      return (
        <div className="bg-white border border-[#E9E2FA] rounded-3xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-[#171329]">Log In to View Your History</h3>
          <p className="text-xs text-[#716B82] max-w-sm mx-auto">
            Sign in to securely access your ordered virtual numbers, purchased log accounts, social boost status, and update releases.
          </p>
          <button
            onClick={() => onOpenAuth('login')}
            className="px-6 py-2.5 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-purple-600/20"
          >
            Log In to ZENET HUB
          </button>
        </div>
      );
    }

    // 1. NUMBER HISTORY DRILL-DOWN
    if (selectedCategory === 'number') {
      const filtered = numberOrders.filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.phoneNumber.toLowerCase().includes(q) ||
          item.service.toLowerCase().includes(q) ||
          item.smsCode.toLowerCase().includes(q) ||
          item.country.toLowerCase().includes(q)
        );
      });

      return (
        <div className="space-y-4">
          {/* Subview Header Bar */}
          <div className="flex items-center justify-between pb-2 border-b border-[#E9E2FA]">
            <div>
              <span className="text-xs font-bold text-[#716B82]">
                {numberOrders.length} {numberOrders.length === 1 ? 'Number Order' : 'Number Orders'}
              </span>
            </div>
            <button
              onClick={() => onSelectView('virtual-numbers')}
              className="px-3.5 py-1.5 rounded-full bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7C3AED] font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Get New Number</span>
            </button>
          </div>

          {numberOrders.length > 3 && (
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phone number, service, or OTP code..."
                className="w-full bg-white border border-[#E9E2FA] rounded-2xl pl-10 pr-4 py-2 text-xs text-[#171329] focus:outline-none focus:border-[#7C3AED] transition"
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E9E2FA] rounded-3xl p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="font-black text-[#171329] text-sm">No Number Orders Found</h4>
              <p className="text-xs text-[#716B82] max-w-xs mx-auto">
                You haven&apos;t ordered any virtual numbers yet. Buy instant OTP numbers across 100+ countries.
              </p>
              <button
                onClick={() => onSelectView('virtual-numbers')}
                className="mt-2 px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full transition cursor-pointer"
              >
                Order Virtual Number
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const isWaiting = item.status === 'WAITING' || item.status === 'waiting_for_sms' || (!item.smsCode && item.status !== 'CANCELLED');
                const isCancelled = item.status === 'CANCELLED' || item.status === 'cancelled' || item.status === 'expired';
                const hasCode = Boolean(item.smsCode);

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#E9E2FA] hover:border-[#7C3AED]/40 rounded-3xl p-4 sm:p-5 shadow-xs transition space-y-3"
                  >
                    {/* Top Row: Service & Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0 font-bold text-xs">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm text-[#171329]">{item.service}</h4>
                            {item.country && (
                              <span className="text-[10px] font-bold text-[#716B82] bg-[#F1EDF9] px-2 py-0.5 rounded-md">
                                {item.country}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#716B82]">
                            {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-sm text-[#171329] block">
                          ₦{Number(item.price || 0).toLocaleString()}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                          hasCode
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCancelled
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}>
                          {hasCode ? 'Code Received' : isCancelled ? 'Cancelled' : 'Waiting for SMS'}
                        </span>
                      </div>
                    </div>

                    {/* Phone Number Display */}
                    <div className="bg-[#FAF8FE] border border-[#E9E2FA] p-3 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#716B82] uppercase tracking-wider block">
                          Assigned Phone Number
                        </span>
                        <span className="font-mono font-black text-sm sm:text-base text-[#171329]">
                          {item.phoneNumber || 'Provisioning...'}
                        </span>
                      </div>
                      {item.phoneNumber && (
                        <button
                          onClick={() => handleCopy(item.phoneNumber, `${item.id}_phone`)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            copiedKey === `${item.id}_phone`
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-[#E9E2FA] hover:bg-[#EDE9FE] text-[#7C3AED]'
                          }`}
                        >
                          {copiedKey === `${item.id}_phone` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === `${item.id}_phone` ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    {/* OTP Code Box */}
                    <div className="bg-[#FAF8FE] border border-[#E9E2FA] p-3.5 rounded-2xl space-y-2">
                      <span className="text-[10px] font-bold text-[#716B82] uppercase tracking-wider block">
                        Verification Code (OTP)
                      </span>
                      {hasCode ? (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                          <span className="font-mono font-black text-lg sm:text-xl text-emerald-700 tracking-widest">
                            {item.smsCode}
                          </span>
                          <button
                            onClick={() => handleCopy(item.smsCode, `${item.id}_code`)}
                            className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                              copiedKey === `${item.id}_code`
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {copiedKey === `${item.id}_code` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === `${item.id}_code` ? 'Copied' : 'Copy OTP'}</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-[#716B82] italic flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                          <span>Waiting for SMS code... {isCancelled ? '(Cancelled)' : ''}</span>
                        </p>
                      )}

                      {item.smsText && (
                        <div className="text-[11px] text-[#475569] bg-white p-2 rounded-xl border border-[#E9E2FA] font-mono mt-1">
                          {item.smsText}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // 2. LOG HISTORY DRILL-DOWN
    if (selectedCategory === 'log') {
      const filtered = logOrders.filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.listingTitle.toLowerCase().includes(q) ||
          (item.digitalProductDetails?.accountEmail || '').toLowerCase().includes(q) ||
          (item.transactionId || '').toLowerCase().includes(q)
        );
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E9E2FA]">
            <span className="text-xs font-bold text-[#716B82]">
              {logOrders.length} {logOrders.length === 1 ? 'Log Account Order' : 'Log Account Orders'}
            </span>
            <button
              onClick={() => onSelectView('log-accounts')}
              className="px-3.5 py-1.5 rounded-full bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7C3AED] font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Browse Logs</span>
            </button>
          </div>

          {logOrders.length > 3 && (
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search account title, email, or order ID..."
                className="w-full bg-white border border-[#E9E2FA] rounded-2xl pl-10 pr-4 py-2 text-xs text-[#171329] focus:outline-none focus:border-[#7C3AED] transition"
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E9E2FA] rounded-3xl p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center mx-auto">
                <UserCheck className="w-6 h-6" />
              </div>
              <h4 className="font-black text-[#171329] text-sm">No Log Account Purchases Yet</h4>
              <p className="text-xs text-[#716B82] max-w-xs mx-auto">
                Explore thousands of verified digital logs, aged social accounts, and developer profiles.
              </p>
              <button
                onClick={() => onSelectView('log-accounts')}
                className="mt-2 px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full transition cursor-pointer"
              >
                Browse Log Accounts
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filtered.map((item) => {
                const creds = item.digitalProductDetails;
                const isPwVisible = Boolean(showPasswordMap[item.id]);

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#E9E2FA] hover:border-[#7C3AED]/40 rounded-3xl p-4 sm:p-5 shadow-xs transition space-y-3.5"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase text-[#7C3AED] bg-[#EDE9FE] px-2 py-0.5 rounded-md inline-block mb-1">
                          {item.category || 'Log Account'}
                        </span>
                        <h4 className="font-black text-sm sm:text-base text-[#171329]">{item.listingTitle}</h4>
                        <span className="text-[11px] text-[#716B82] block mt-0.5">
                          Purchased on {new Date(item.purchasedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-sm sm:text-base text-[#171329] block">
                          ₦{Number(item.paidAmount || item.price || 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Delivered
                        </span>
                      </div>
                    </div>

                    {/* Credentials Box */}
                    {creds && (creds.accountEmail || creds.accountPassword || creds.backupCodes || creds.additionalInstructions) ? (
                      <div className="bg-[#FAF8FE] border border-[#DDD6FE] p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between border-b border-[#EDE9FE] pb-2">
                          <span className="text-xs font-black text-[#171329] flex items-center gap-1.5">
                            <Key className="w-4 h-4 text-[#7C3AED]" />
                            <span>Revealed Credentials</span>
                          </span>
                          <span className="text-[10px] font-extrabold text-[#7C3AED] uppercase">
                            Instant Delivery
                          </span>
                        </div>

                        {/* Email */}
                        {creds.accountEmail && (
                          <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-[#E9E2FA]">
                            <div className="min-w-0 pr-2">
                              <span className="text-[10px] font-bold text-[#716B82] uppercase block">Login / Email</span>
                              <span className="font-mono font-bold text-xs sm:text-sm text-[#171329] truncate block">
                                {creds.accountEmail}
                              </span>
                            </div>
                            <button
                              onClick={() => handleCopy(creds.accountEmail || '', `${item.id}_email`)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                                copiedKey === `${item.id}_email`
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7C3AED]'
                              }`}
                            >
                              {copiedKey === `${item.id}_email` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedKey === `${item.id}_email` ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        )}

                        {/* Password */}
                        {creds.accountPassword && (
                          <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-[#E9E2FA]">
                            <div className="min-w-0 pr-2">
                              <span className="text-[10px] font-bold text-[#716B82] uppercase block">Password</span>
                              <span className="font-mono font-bold text-xs sm:text-sm text-[#171329] truncate block">
                                {isPwVisible ? creds.accountPassword : '••••••••••••'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => togglePasswordVisibility(item.id)}
                                className="p-1.5 text-[#716B82] hover:text-[#171329] bg-white border border-[#E9E2FA] rounded-lg transition cursor-pointer"
                                title={isPwVisible ? 'Hide Password' : 'Show Password'}
                              >
                                {isPwVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleCopy(creds.accountPassword || '', `${item.id}_pw`)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                  copiedKey === `${item.id}_pw`
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7C3AED]'
                                }`}
                              >
                                {copiedKey === `${item.id}_pw` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedKey === `${item.id}_pw` ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Backup codes or 2FA */}
                        {creds.backupCodes && (
                          <div className="bg-white p-2.5 rounded-xl border border-[#E9E2FA] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[#716B82] uppercase block">Backup Codes / 2FA Secret</span>
                              <button
                                onClick={() => handleCopy(creds.backupCodes || '', `${item.id}_codes`)}
                                className="text-[10px] font-bold text-[#7C3AED] hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === `${item.id}_codes` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedKey === `${item.id}_codes` ? 'Copied' : 'Copy Codes'}</span>
                              </button>
                            </div>
                            <p className="font-mono text-xs text-[#171329] bg-[#FAF8FE] p-2 rounded-lg break-all">
                              {creds.backupCodes}
                            </p>
                          </div>
                        )}

                        {/* Additional Instructions */}
                        {creds.additionalInstructions && (
                          <div className="text-xs text-[#475569] bg-white p-2.5 rounded-xl border border-[#E9E2FA]">
                            <span className="text-[10px] font-bold text-[#716B82] uppercase block mb-1">Seller Transfer Notes</span>
                            <p className="whitespace-pre-line text-[11px] leading-relaxed">{creds.additionalInstructions}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-[#FAF8FE] p-3 rounded-2xl text-xs text-[#716B82] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Account delivery confirmed. For support, contact ZENET Support.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // 3. BOOST HISTORY DRILL-DOWN
    if (selectedCategory === 'boost') {
      const filtered = boostOrders.filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.serviceName.toLowerCase().includes(q) ||
          item.target.toLowerCase().includes(q) ||
          item.orderId.toLowerCase().includes(q)
        );
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E9E2FA]">
            <span className="text-xs font-bold text-[#716B82]">
              {boostOrders.length} {boostOrders.length === 1 ? 'Boosting Order' : 'Boosting Orders'}
            </span>
            <button
              onClick={() => onSelectView('social-boost')}
              className="px-3.5 py-1.5 rounded-full bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7C3AED] font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>New Boost</span>
            </button>
          </div>

          {boostOrders.length > 3 && (
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search boosting service, target link, or order ID..."
                className="w-full bg-white border border-[#E9E2FA] rounded-2xl pl-10 pr-4 py-2 text-xs text-[#171329] focus:outline-none focus:border-[#7C3AED] transition"
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E9E2FA] rounded-3xl p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center mx-auto">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h4 className="font-black text-[#171329] text-sm">No Social Boost Orders Yet</h4>
              <p className="text-xs text-[#716B82] max-w-xs mx-auto">
                Supercharge your presence on TikTok, Instagram, YouTube, and X with instant high-retention boosts.
              </p>
              <button
                onClick={() => onSelectView('social-boost')}
                className="mt-2 px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full transition cursor-pointer"
              >
                Boost Socials Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const statusStr = (item.status || 'completed').toLowerCase();
                const isCompleted = statusStr === 'completed';
                const isProcessing = statusStr === 'in_progress' || statusStr === 'processing' || statusStr === 'pending';

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#E9E2FA] hover:border-[#7C3AED]/40 rounded-3xl p-4 sm:p-5 shadow-xs transition space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm sm:text-base text-[#171329]">{item.serviceName}</h4>
                        </div>
                        <span className="text-[11px] text-[#716B82] block mt-0.5">
                          Order ID: <strong className="font-mono text-[#171329]">{item.orderId}</strong> • {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-sm sm:text-base text-[#171329] block">
                          ₦{Number(item.charge || 0).toLocaleString()}
                        </span>
                        <span className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isProcessing
                            ? 'bg-purple-100 text-purple-800 animate-pulse'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>

                    {/* Target and Quantity info */}
                    <div className="bg-[#FAF8FE] border border-[#E9E2FA] p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-[#716B82] uppercase block">Target URL / Account</span>
                        <a
                          href={item.target.startsWith('http') ? item.target : `https://${item.target}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#7C3AED] hover:underline truncate block"
                        >
                          {item.target || 'Target specified at order'}
                        </a>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] font-bold text-[#716B82] uppercase block">Quantity</span>
                        <span className="font-black text-sm text-[#171329] font-mono">
                          {Number(item.quantity || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // 4. UPDATE HISTORY DRILL-DOWN
    if (selectedCategory === 'update') {
      const filtered = updateOrders.filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.productName.toLowerCase().includes(q) ||
          item.secretDeliveryInfo.toLowerCase().includes(q) ||
          item.transactionId.toLowerCase().includes(q)
        );
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E9E2FA]">
            <span className="text-xs font-bold text-[#716B82]">
              {updateOrders.length} {updateOrders.length === 1 ? 'Update Purchase' : 'Update Purchases'}
            </span>
            <button
              onClick={() => onSelectView('marketplace')}
              className="px-3.5 py-1.5 rounded-full bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7C3AED] font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Browse Updates</span>
            </button>
          </div>

          {updateOrders.length > 3 && (
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search update release, product name, or download..."
                className="w-full bg-white border border-[#E9E2FA] rounded-2xl pl-10 pr-4 py-2 text-xs text-[#171329] focus:outline-none focus:border-[#7C3AED] transition"
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E9E2FA] rounded-3xl p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="font-black text-[#171329] text-sm">No Zenet Update Purchases Yet</h4>
              <p className="text-xs text-[#716B82] max-w-xs mx-auto">
                Access curated system scripts, digital updates, and premium verified software releases.
              </p>
              <button
                onClick={() => onSelectView('marketplace')}
                className="mt-2 px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full transition cursor-pointer"
              >
                Explore Zenet Updates
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#E9E2FA] hover:border-[#7C3AED]/40 rounded-3xl p-4 sm:p-5 shadow-xs transition space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-[#7C3AED] bg-[#EDE9FE] px-2 py-0.5 rounded-md inline-block mb-1">
                        Zenet Update Release
                      </span>
                      <h4 className="font-black text-sm sm:text-base text-[#171329]">{item.productName}</h4>
                      <span className="text-[11px] text-[#716B82] block mt-0.5">
                        Purchased on {new Date(item.purchasedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-sm sm:text-base text-[#171329] block">
                        ₦{Number(item.price || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Activated
                      </span>
                    </div>
                  </div>

                  {/* Delivery & Link Info */}
                  {(item.secretDeliveryInfo || item.privateDeliveryLink) && (
                    <div className="bg-[#FAF8FE] border border-[#DDD6FE] p-4 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between border-b border-[#EDE9FE] pb-2">
                        <span className="text-xs font-black text-[#171329] flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                          <span>Delivered Package Details</span>
                        </span>
                        <span className="text-[10px] font-extrabold text-[#7C3AED] uppercase">
                          Verified Release
                        </span>
                      </div>

                      {item.privateDeliveryLink && (
                        <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-[#E9E2FA]">
                          <div className="min-w-0 pr-2">
                            <span className="text-[10px] font-bold text-[#716B82] uppercase block">Download Link</span>
                            <a
                              href={item.privateDeliveryLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-[#7C3AED] hover:underline truncate block"
                            >
                              {item.privateDeliveryLink}
                            </a>
                          </div>
                          <a
                            href={item.privateDeliveryLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D28D9] transition flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open</span>
                          </a>
                        </div>
                      )}

                      {item.secretDeliveryInfo && (
                        <div className="bg-white p-2.5 rounded-xl border border-[#E9E2FA] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#716B82] uppercase block">Access Key / Instructions</span>
                            <button
                              onClick={() => handleCopy(item.secretDeliveryInfo, `${item.id}_info`)}
                              className="text-[10px] font-bold text-[#7C3AED] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              {copiedKey === `${item.id}_info` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedKey === `${item.id}_info` ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <p className="text-xs text-[#171329] bg-[#FAF8FE] p-2 rounded-lg font-mono whitespace-pre-line leading-relaxed">
                            {item.secretDeliveryInfo}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // --------------------------------------------------------------------------
  // RENDER: MAIN 4-SERVICE HISTORY MENU (EXACTLY MATCHING USER'S REFERENCE IMAGE)
  // --------------------------------------------------------------------------

  return (
    <div className="w-full max-w-2xl mx-auto px-1 sm:px-2 py-2 select-none animate-in fade-in duration-200">
      
      {/* 1. TOP BAR WITH ROUNDED BACK BUTTON AND TITLE */}
      <div className="flex items-center justify-between py-1 mb-2">
        <div className="flex items-center">
          <button
            onClick={handleGoBack}
            className="w-10 h-10 rounded-2xl bg-white border border-[#E9E2FA] flex items-center justify-center text-[#171329] hover:bg-[#F3EEFF] hover:border-[#7C3AED]/40 shadow-2xs transition cursor-pointer active:scale-95 shrink-0"
            title={selectedCategory ? "Back to History Menu" : "Back to Marketplace"}
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 text-[#171329]" />
          </button>
          <span className="text-lg font-black text-[#171329] tracking-tight ml-3.5">
            History
          </span>
        </div>

        {/* Deposit/Wallet shortcut */}
        <button
          onClick={onOpenWallet}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E9E2FA] hover:border-[#7C3AED]/40 text-[#171329] hover:text-[#7C3AED] text-xs font-bold transition cursor-pointer shadow-2xs"
          title="View Wallet & Deposit History"
        >
          <Wallet className="w-3.5 h-3.5 text-[#7C3AED]" />
          <span className="hidden sm:inline">Wallet</span>
        </button>
      </div>

      {/* 2. MAIN HEADER (LARGE BOLD TITLE & SUBTITLE) */}
      <div className="mt-3 mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-[#171329] tracking-tight">
          {selectedCategory === 'number'
            ? 'Number History'
            : selectedCategory === 'log'
            ? 'Log History'
            : selectedCategory === 'boost'
            ? 'Boost History'
            : selectedCategory === 'update'
            ? 'Update History'
            : 'History'}
        </h1>
        <p className="text-xs sm:text-sm text-[#716B82] font-semibold mt-1">
          {selectedCategory === 'number'
            ? 'OTP numbers and received codes'
            : selectedCategory === 'log'
            ? 'Purchased logs, accounts and credentials'
            : selectedCategory === 'boost'
            ? 'Followers, likes, views and boosting orders'
            : selectedCategory === 'update'
            ? 'System updates, releases and digital packages'
            : 'Track your payments, numbers and transactions'}
        </p>
      </div>

      {/* 3. CONDITIONAL BODY: DRILL-DOWN SUBVIEW OR THE 4 CARDS */}
      {selectedCategory !== null ? (
        renderSubViewContent()
      ) : (
        <div className="space-y-3.5 sm:space-y-4">
          
          {/* CARD 1: NUMBER HISTORY */}
          <button
            onClick={() => setSelectedCategory('number')}
            className="w-full bg-white border border-[#E9E2FA] rounded-3xl p-4 sm:p-5 flex items-center justify-between shadow-2xs hover:border-[#7C3AED]/50 hover:shadow-md transition-all cursor-pointer group text-left active:scale-[0.99]"
          >
            <div className="flex items-center">
              {/* Light Purple Rounded Icon Box */}
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0 mr-4 shadow-2xs group-hover:scale-105 group-hover:bg-[#7C3AED] group-hover:text-white transition duration-200">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[#171329] group-hover:text-[#7C3AED] transition tracking-tight">
                    Number History
                  </h3>
                  {counts.number > 0 && (
                    <span className="bg-[#EDE9FE] text-[#7C3AED] text-[10px] font-black px-2 py-0.5 rounded-full">
                      {counts.number}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#716B82] font-medium mt-0.5">
                  OTP numbers and received codes
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition shrink-0 ml-2" />
          </button>

          {/* CARD 2: LOG HISTORY */}
          <button
            onClick={() => setSelectedCategory('log')}
            className="w-full bg-white border border-[#E9E2FA] rounded-3xl p-4 sm:p-5 flex items-center justify-between shadow-2xs hover:border-[#7C3AED]/50 hover:shadow-md transition-all cursor-pointer group text-left active:scale-[0.99]"
          >
            <div className="flex items-center">
              {/* Light Purple Rounded Icon Box */}
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0 mr-4 shadow-2xs group-hover:scale-105 group-hover:bg-[#7C3AED] group-hover:text-white transition duration-200">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[#171329] group-hover:text-[#7C3AED] transition tracking-tight">
                    Log History
                  </h3>
                  {counts.log > 0 && (
                    <span className="bg-[#EDE9FE] text-[#7C3AED] text-[10px] font-black px-2 py-0.5 rounded-full">
                      {counts.log}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#716B82] font-medium mt-0.5">
                  Purchased logs, accounts and credentials
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition shrink-0 ml-2" />
          </button>

          {/* CARD 3: BOOST HISTORY */}
          <button
            onClick={() => setSelectedCategory('boost')}
            className="w-full bg-white border border-[#E9E2FA] rounded-3xl p-4 sm:p-5 flex items-center justify-between shadow-2xs hover:border-[#7C3AED]/50 hover:shadow-md transition-all cursor-pointer group text-left active:scale-[0.99]"
          >
            <div className="flex items-center">
              {/* Light Purple Rounded Icon Box */}
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0 mr-4 shadow-2xs group-hover:scale-105 group-hover:bg-[#7C3AED] group-hover:text-white transition duration-200">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[#171329] group-hover:text-[#7C3AED] transition tracking-tight">
                    Boost History
                  </h3>
                  {counts.boost > 0 && (
                    <span className="bg-[#EDE9FE] text-[#7C3AED] text-[10px] font-black px-2 py-0.5 rounded-full">
                      {counts.boost}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#716B82] font-medium mt-0.5">
                  Followers, likes, views and boosting orders
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition shrink-0 ml-2" />
          </button>

          {/* CARD 4: UPDATE HISTORY */}
          <button
            onClick={() => setSelectedCategory('update')}
            className="w-full bg-white border border-[#E9E2FA] rounded-3xl p-4 sm:p-5 flex items-center justify-between shadow-2xs hover:border-[#7C3AED]/50 hover:shadow-md transition-all cursor-pointer group text-left active:scale-[0.99]"
          >
            <div className="flex items-center">
              {/* Light Purple Rounded Icon Box */}
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0 mr-4 shadow-2xs group-hover:scale-105 group-hover:bg-[#7C3AED] group-hover:text-white transition duration-200">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[#171329] group-hover:text-[#7C3AED] transition tracking-tight">
                    Update History
                  </h3>
                  {counts.update > 0 && (
                    <span className="bg-[#EDE9FE] text-[#7C3AED] text-[10px] font-black px-2 py-0.5 rounded-full">
                      {counts.update}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#716B82] font-medium mt-0.5">
                  System updates, releases and digital packages
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition shrink-0 ml-2" />
          </button>

          {/* SUBTLE FOOTER NOTE FOR WALLET TRANSACTIONS */}
          <div className="pt-3 px-2 flex items-center justify-between text-xs text-[#716B82]">
            <span>Need wallet deposit records?</span>
            <button
              onClick={onOpenWallet}
              className="font-bold text-[#7C3AED] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>View Deposit History</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
