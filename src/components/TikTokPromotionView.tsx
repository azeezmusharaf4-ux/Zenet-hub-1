import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  Users, 
  Eye, 
  Heart, 
  MessageSquare, 
  Share2, 
  ShieldCheck, 
  Sparkles, 
  ArrowLeft, 
  Wallet, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Sliders, 
  Save, 
  RefreshCw, 
  Lock, 
  PlusCircle,
  Copy,
  ChevronRight,
  TrendingUp,
  Flame,
  Bookmark,
  Info
} from 'lucide-react';
import { UserProfile, ActiveAppView, TikTokServiceConfig, TikTokPromotionOrder, TikTokServiceType } from '../types';
import { DEFAULT_TIKTOK_SERVICES, calculateServiceCost, validateTikTokUrl } from '../data/tiktokServices';
import { isAuthorizedOwner } from '../lib/authorizedOwners';
import { safeApiFetch } from '../utils/api';
import { copyToClipboard } from '../utils/clipboard';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

interface TikTokPromotionViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  walletBalance: number;
  onBackToMarketplace: () => void;
  onSelectView: (view: ActiveAppView) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenWallet: () => void;
  onBalanceDeducted?: (newBalance: number) => void;
}

export const TikTokPromotionView: React.FC<TikTokPromotionViewProps> = ({
  user,
  userProfile,
  walletBalance,
  onBackToMarketplace,
  onSelectView,
  onOpenAuth,
  onOpenWallet,
  onBalanceDeducted
}) => {
  const isOwner = isAuthorizedOwner(user, userProfile);
  const isAdmin = Boolean(isOwner || userProfile?.role === 'admin');

  // Services state (loaded from Firestore or fallback to defaults)
  const [services, setServices] = useState<TikTokServiceConfig[]>(DEFAULT_TIKTOK_SERVICES);
  const [selectedServiceId, setSelectedServiceId] = useState<TikTokServiceType>('followers');

  // Customer order inputs
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1000);
  const [commentsText, setCommentsText] = useState<string>('');
  
  // Submission & Confirmation state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedOrder, setCompletedOrder] = useState<TikTokPromotionOrder | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Tabs: 'order' or 'history'
  const [activeTab, setActiveTab] = useState<'order' | 'history'>('order');
  const [userOrders, setUserOrders] = useState<TikTokPromotionOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);

  // Admin Configuration State
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);
  const [adminServicesEdit, setAdminServicesEdit] = useState<Record<string, { pricePer1k: number; minQuantity: number; maxQuantity: number; status: 'active' | 'paused' }>>({});
  const [savingAdminSettings, setSavingAdminSettings] = useState<boolean>(false);
  const [adminSaveSuccess, setAdminSaveSuccess] = useState<boolean>(false);

  // Listen to Firestore real-time service configs
  useEffect(() => {
    const colRef = collection(db, 'tiktok_promotion_services');
    const unsub = onSnapshot(colRef, (snap) => {
      if (!snap.empty) {
        const map = new Map<string, any>();
        snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        setServices((prev) =>
          prev.map((def) => {
            const saved = map.get(def.id);
            return saved ? { ...def, ...saved } : def;
          })
        );
      }
    }, (err) => {
      console.warn('Real-time TikTok service notice:', err);
    });

    return () => unsub();
  }, []);

  // Initialize admin edit fields when services change
  useEffect(() => {
    const initial: Record<string, { pricePer1k: number; minQuantity: number; maxQuantity: number; status: 'active' | 'paused' }> = {};
    services.forEach((s) => {
      initial[s.id] = {
        pricePer1k: s.pricePer1k,
        minQuantity: s.minQuantity,
        maxQuantity: s.maxQuantity,
        status: s.status
      };
    });
    setAdminServicesEdit(initial);
  }, [services]);

  // Current selected service object
  const currentService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0];
  }, [services, selectedServiceId]);

  // Ensure quantity is within service min/max when switching services
  useEffect(() => {
    if (currentService) {
      if (quantity < currentService.minQuantity) {
        setQuantity(currentService.minQuantity);
      } else if (quantity > currentService.maxQuantity) {
        setQuantity(currentService.maxQuantity);
      }
    }
  }, [selectedServiceId, currentService]);

  // Comments parsing
  const parsedComments = useMemo(() => {
    return commentsText
      .split('\n')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }, [commentsText]);

  // Calculate live total cost
  const totalCost = useMemo(() => {
    return calculateServiceCost(quantity, currentService.pricePer1k);
  }, [quantity, currentService.pricePer1k]);

  // Check if wallet has sufficient funds
  const isBalanceSufficient = walletBalance >= totalCost;

  // Fetch orders when History tab is selected
  useEffect(() => {
    if (activeTab === 'history' && user) {
      fetchOrders();
    }
  }, [activeTab, user]);

  const fetchOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      const data = await safeApiFetch('/api/tiktok-promotion/orders');
      if (data && data.success && Array.isArray(data.orders)) {
        setUserOrders(data.orders);
      }
    } catch (err) {
      console.warn('Error fetching TikTok promotion orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Service Icons map
  const getServiceIcon = (id: TikTokServiceType, className = 'w-5 h-5') => {
    switch (id) {
      case 'followers':
        return <Users className={className} />;
      case 'likes':
        return <Heart className={className} />;
      case 'comments':
        return <MessageSquare className={className} />;
      case 'shares':
        return <Share2 className={className} />;
      case 'favorites':
        return <Bookmark className={className} />;
      case 'views':
        return <Eye className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  // Handle Order Preview Validation
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    if (!user) {
      onOpenAuth('login');
      return;
    }

    if (currentService.status === 'paused') {
      setOrderError('This service is currently paused for updates. Please select another active service.');
      return;
    }

    // URL Validation
    const urlValidation = validateTikTokUrl(currentService.targetType, targetUrl);
    if (!urlValidation.isValid) {
      setOrderError(urlValidation.message || 'Please provide a valid TikTok URL.');
      return;
    }

    // Quantity Validation
    if (quantity < currentService.minQuantity || quantity > currentService.maxQuantity) {
      setOrderError(`Quantity must be between ${currentService.minQuantity.toLocaleString()} and ${currentService.maxQuantity.toLocaleString()}.`);
      return;
    }

    // Comments Validation
    if (currentService.requiresComments && parsedComments.length === 0) {
      setOrderError('Please provide at least one custom comment for this order.');
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Submit Order via Secure Server API
  const handleConfirmOrder = async () => {
    if (!user) return;
    if (!isBalanceSufficient) {
      onOpenWallet();
      return;
    }

    setIsSubmitting(true);
    setOrderError(null);

    try {
      const payload = {
        serviceId: currentService.id,
        targetUrl: targetUrl.trim(),
        quantity: Number(quantity),
        comments: currentService.requiresComments ? parsedComments : undefined,
        userEmail: user.email || ''
      };

      const res = await safeApiFetch('/api/tiktok-promotion/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setIsConfirmModalOpen(false);
        setCompletedOrder(res.order || {
          id: res.orderId,
          orderNumber: res.orderNumber,
          serviceId: currentService.id,
          serviceName: currentService.name,
          targetUrl: targetUrl.trim(),
          quantity,
          pricePer1k: currentService.pricePer1k,
          totalCost,
          userId: user.uid,
          status: 'pending',
          createdAt: new Date().toISOString()
        });

        if (typeof res.newBalance === 'number' && onBalanceDeducted) {
          onBalanceDeducted(res.newBalance);
        }

        // Reset form inputs
        setTargetUrl('');
        setCommentsText('');
      } else {
        setOrderError(res?.error || 'Failed to submit TikTok promotion order. Please check your wallet balance and try again.');
        setIsConfirmModalOpen(false);
      }
    } catch (err: any) {
      console.error('Order error:', err);
      setOrderError(err?.message || 'A network error occurred while processing your order. Please try again.');
      setIsConfirmModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Save Settings
  const handleAdminSave = async () => {
    setSavingAdminSettings(true);
    setAdminSaveSuccess(false);
    try {
      // 1. Direct Firestore write for rapid update
      for (const [id, cfg] of Object.entries(adminServicesEdit)) {
        const docRef = doc(db, 'tiktok_promotion_services', id);
        await setDoc(docRef, {
          pricePer1k: Number(cfg.pricePer1k),
          minQuantity: Number(cfg.minQuantity),
          maxQuantity: Number(cfg.maxQuantity),
          status: cfg.status,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 2. Also notify backend API
      const servicesArray = Object.entries(adminServicesEdit).map(([id, cfg]) => ({
        id,
        ...cfg
      }));
      await safeApiFetch('/api/tiktok-promotion/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: servicesArray })
      });

      setAdminSaveSuccess(true);
      setTimeout(() => setAdminSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Admin save error:', err);
      alert('Failed to save settings: ' + (err?.message || 'Network error'));
    } finally {
      setSavingAdminSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFE] text-[#0F172A] pb-24 select-none">
      
      {/* Top Banner Navigation Bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between">
        <button
          onClick={onBackToMarketplace}
          className="flex items-center space-x-2 text-xs sm:text-sm font-bold text-[#64748B] hover:text-[#7C3AED] transition cursor-pointer p-1.5 rounded-xl hover:bg-purple-50/60"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>

        {/* Live Wallet Chip */}
        <div className="flex items-center space-x-2">
          {user ? (
            <button
              onClick={onOpenWallet}
              className="flex items-center space-x-2 bg-purple-50 hover:bg-purple-100/80 border border-purple-200 text-[#7C3AED] px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer shadow-2xs"
              title="View & Top Up Wallet Balance"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>₦{walletBalance.toLocaleString()}</span>
              <span className="text-[10px] bg-[#7C3AED] text-white px-1.5 py-0.2 rounded-full font-bold">Top Up</span>
            </button>
          ) : (
            <button
              onClick={() => onOpenAuth('login')}
              className="bg-[#7C3AED] text-white text-xs font-black px-4 py-1.5 rounded-full hover:bg-[#6D28D9] transition cursor-pointer shadow-sm shadow-purple-600/20"
            >
              Log In
            </button>
          )}

          {/* Admin Controls Toggle */}
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel((prev) => !prev)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-black transition cursor-pointer border ${
                showAdminPanel 
                  ? 'bg-slate-900 text-white border-slate-800' 
                  : 'bg-white hover:bg-purple-50 border-purple-200 text-[#7C3AED]'
              }`}
              title="Admin Service Pricing & Limits Control"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Admin Rates</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 pt-2">
        
        {/* Modern TikTok Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#0B0914] via-[#160D29] to-[#0A051A] text-white p-6 sm:p-8 border border-purple-900/40 shadow-xl">
          {/* Subtle TikTok themed atmospheric glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#FE2C55]/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-[#00F2FE]/15 rounded-full blur-3xl pointer-events-none -mb-20" />

          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 text-[11px] font-black uppercase tracking-wider text-purple-200">
              <span className="w-2 h-2 rounded-full bg-[#FE2C55] animate-pulse" />
              <span>Official TikTok Creator Promotion</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Grow Your <span className="bg-linear-to-r from-[#FE2C55] via-purple-300 to-[#00F2FE] bg-clip-text text-transparent">TikTok Reach</span> Legitimate & Safe
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Targeted promotion for real creators, business brands, and artists. Powered by legitimate network audience distribution strictly compliant with TikTok platform guidelines.
            </p>

            {/* Quick Guarantees */}
            <div className="pt-2 flex flex-wrap gap-2 sm:gap-3 text-[11px] font-bold text-slate-200">
              <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-xl">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                100% Policy Compliant
              </span>
              <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-xl">
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                No Password Required
              </span>
              <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-xl">
                <Lock className="w-3.5 h-3.5 text-cyan-300" />
                Escrow Protected Funds
              </span>
            </div>
          </div>
        </div>

        {/* ADMIN CONFIGURATION PANEL (Only visible to admin when toggled) */}
        {isAdmin && showAdminPanel && (
          <div className="bg-white border-2 border-purple-200 rounded-3xl p-5 sm:p-6 shadow-md space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#7C3AED] flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-[#0F172A] text-sm sm:text-base">
                    Admin Rate & Limit Controls
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Configure live price per 1,000, minimum quantity, maximum quantity, and active status for each TikTok service.
                  </p>
                </div>
              </div>

              <button
                onClick={handleAdminSave}
                disabled={savingAdminSettings}
                className="flex items-center space-x-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-black px-4 py-2 rounded-xl transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                {savingAdminSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savingAdminSettings ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>

            {adminSaveSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Social Boost services updated and synchronized in database successfully!</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              {services.map((svc, idx) => {
                const edit = adminServicesEdit[svc.id] || {
                  pricePer1k: svc.pricePer1k,
                  minQuantity: svc.minQuantity,
                  maxQuantity: svc.maxQuantity,
                  status: svc.status
                };

                return (
                  <div key={`${svc.id}-${idx}`} className="bg-purple-50/40 border border-purple-100 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getServiceIcon(svc.id, 'w-4 h-4 text-[#7C3AED]')}
                        <span className="font-black text-xs text-[#0F172A]">{svc.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminServicesEdit((prev) => ({
                            ...prev,
                            [svc.id]: {
                              ...edit,
                              status: edit.status === 'active' ? 'paused' : 'active'
                            }
                          }));
                        }}
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border transition cursor-pointer ${
                          edit.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {edit.status}
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-[#64748B] block mb-1">
                          Price per 1,000 (₦)
                        </label>
                        <input
                          type="number"
                          value={edit.pricePer1k}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setAdminServicesEdit((prev) => ({
                              ...prev,
                              [svc.id]: { ...edit, pricePer1k: val }
                            }));
                          }}
                          className="w-full bg-white border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#0F172A] focus:outline-purple-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-[#64748B] block mb-1">
                            Min Qty
                          </label>
                          <input
                            type="number"
                            value={edit.minQuantity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAdminServicesEdit((prev) => ({
                                ...prev,
                                [svc.id]: { ...edit, minQuantity: val }
                              }));
                            }}
                            className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#0F172A] focus:outline-purple-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#64748B] block mb-1">
                            Max Qty
                          </label>
                          <input
                            type="number"
                            value={edit.maxQuantity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAdminServicesEdit((prev) => ({
                                ...prev,
                                [svc.id]: { ...edit, maxQuantity: val }
                              }));
                            }}
                            className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#0F172A] focus:outline-purple-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View Selection Tabs (Order vs History) */}
        <div className="flex items-center space-x-2 border-b border-purple-100 pb-2">
          <button
            onClick={() => setActiveTab('order')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
              activeTab === 'order'
                ? 'bg-[#7C3AED] text-white shadow-sm shadow-purple-600/20'
                : 'text-[#64748B] hover:text-[#7C3AED] hover:bg-purple-50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Order Promotion</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
              activeTab === 'history'
                ? 'bg-[#7C3AED] text-white shadow-sm shadow-purple-600/20'
                : 'text-[#64748B] hover:text-[#7C3AED] hover:bg-purple-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Promotion History</span>
            {userOrders.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-purple-100 text-[#7C3AED]'
              }`}>
                {userOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* MAIN TAB 1: ORDER PROMOTION */}
        {activeTab === 'order' && (
          <div className="space-y-6">

            {/* Error Message if any */}
            {orderError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold p-4 rounded-2xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{orderError}</span>
                  {!isBalanceSufficient && totalCost > 0 && (
                    <button
                      onClick={onOpenWallet}
                      className="block mt-2 underline text-[#7C3AED] hover:text-[#6D28D9] font-black cursor-pointer"
                    >
                      Click here to fund your wallet & continue →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 1: SELECT TIKTOK SERVICE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#0F172A] text-sm sm:text-base flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-[#7C3AED] text-white text-xs font-black flex items-center justify-center">1</span>
                  <span>Select TikTok Service</span>
                </h3>
                <span className="text-[11px] font-bold text-[#64748B]">
                  {services.length} Services Available
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {services.map((svc, idx) => {
                  const isSelected = svc.id === selectedServiceId;
                  const isPaused = svc.status === 'paused';

                  return (
                    <button
                      key={`${svc.id}-${idx}`}
                      type="button"
                      onClick={() => setSelectedServiceId(svc.id)}
                      className={`text-left px-3.5 py-3 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-2 ${
                        isSelected
                          ? 'bg-purple-50/70 border-[#7C3AED] ring-2 ring-[#7C3AED]/20 shadow-xs'
                          : 'bg-white hover:bg-purple-50/30 border-purple-100 hover:border-purple-200 shadow-2xs'
                      } ${isPaused ? 'opacity-70' : ''}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-[#7C3AED] text-white shadow-2xs' : 'bg-purple-100 text-[#7C3AED]'
                          }`}>
                            {getServiceIcon(svc.id, 'w-3.5 h-3.5')}
                          </div>

                          <div className="flex items-center gap-1">
                            {svc.badge && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white border border-purple-200 text-[#7C3AED]">
                                {svc.badge}
                              </span>
                            )}
                            {isPaused ? (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                Paused
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-[#0F172A] text-xs sm:text-sm">{svc.name}</h4>
                          <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5 font-medium leading-normal">
                            {svc.description}
                          </p>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-purple-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-black text-[#7C3AED] text-xs sm:text-sm">
                            ₦{svc.pricePer1k.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-[#64748B] font-semibold block -mt-0.5">
                            per 1,000 units
                          </span>
                        </div>

                        <div className="text-right text-[9px] text-[#64748B] font-bold">
                          <span>Min: {svc.minQuantity.toLocaleString()}</span>
                          <span className="block">Max: {svc.maxQuantity.toLocaleString()}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: ORDER CONFIGURATION & TARGET URL */}
            <form onSubmit={handleProceedToReview} className="bg-white border border-purple-100 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
              
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <h3 className="font-extrabold text-[#0F172A] text-sm sm:text-base flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-[#7C3AED] text-white text-xs font-black flex items-center justify-center">2</span>
                  <span>Enter Details for {currentService.name}</span>
                </h3>

                <span className="text-[11px] font-bold text-[#7C3AED] bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                  {currentService.deliverySpeed || 'Real creator delivery'}
                </span>
              </div>

              {/* Notice if service is paused */}
              {currentService.status === 'paused' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>This service is currently paused for platform maintenance by the administration. You can select another service above.</span>
                </div>
              )}

              {/* Target URL Input (Followers vs Video Services) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0F172A]">
                    {currentService.targetType === 'profile_url' ? 'TikTok Profile Link or Username' : 'TikTok Video URL'}
                    <span className="text-rose-500 ml-1">*</span>
                  </label>
                  <span className="text-[10px] text-[#64748B] font-semibold">
                    {currentService.targetType === 'profile_url' ? 'e.g. https://www.tiktok.com/@username' : 'e.g. https://www.tiktok.com/@user/video/123...'}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder={
                      currentService.targetType === 'profile_url'
                        ? 'https://www.tiktok.com/@yourusername or @yourusername'
                        : 'https://www.tiktok.com/@creator/video/739182749102847...'
                    }
                    className="w-full bg-[#FAF8FE] border border-purple-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:bg-white transition"
                  />
                </div>
                <p className="text-[10px] text-[#64748B] font-medium">
                  {currentService.targetType === 'profile_url'
                    ? 'Account must be public so followers can connect legitimately.'
                    : 'Video must be public and playable on TikTok.'}
                </p>
              </div>

              {/* COMMENTS TEXTAREA (Only for TikTok Comments) */}
              {currentService.requiresComments && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#0F172A]">
                      Required Custom Comments (One per line)
                      <span className="text-rose-500 ml-1">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-[#7C3AED]">
                      {parsedComments.length} entered / {quantity} required
                    </span>
                  </div>

                  <textarea
                    rows={4}
                    required
                    value={commentsText}
                    onChange={(e) => setCommentsText(e.target.value)}
                    placeholder={"Type one custom comment per line...\nGreat content!\nAwesome video quality\nLove your tips here\nFollowing for more!"}
                    className="w-full bg-[#FAF8FE] border border-purple-200 rounded-2xl p-3.5 text-xs sm:text-sm font-medium text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:bg-white transition custom-scrollbar"
                  />
                  <p className="text-[10px] text-[#64748B] font-medium">
                    Comments will be distributed organically from active real viewer profiles.
                  </p>
                </div>
              )}

              {/* QUANTITY SELECTOR */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0F172A]">
                    Order Quantity
                    <span className="text-rose-500 ml-1">*</span>
                  </label>
                  <span className="text-[11px] font-bold text-[#64748B]">
                    Min: {currentService.minQuantity.toLocaleString()} • Max: {currentService.maxQuantity.toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      required
                      min={currentService.minQuantity}
                      max={currentService.maxQuantity}
                      step={currentService.requiresComments ? 1 : 50}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full bg-[#FAF8FE] border border-purple-200 rounded-2xl px-4 py-3 text-sm font-black font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:bg-white transition"
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {[
                      currentService.minQuantity,
                      Math.min(currentService.maxQuantity, currentService.minQuantity * 2),
                      Math.min(currentService.maxQuantity, 1000),
                      Math.min(currentService.maxQuantity, 2500),
                      Math.min(currentService.maxQuantity, 5000)
                    ]
                      .filter((val, idx, arr) => arr.indexOf(val) === idx && val >= currentService.minQuantity && val <= currentService.maxQuantity)
                      .map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setQuantity(val)}
                          className={`text-xs font-black px-3 py-2 rounded-xl border transition cursor-pointer shrink-0 ${
                            quantity === val
                              ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-2xs'
                              : 'bg-white hover:bg-purple-50 text-[#0F172A] border-purple-200'
                          }`}
                        >
                          {val.toLocaleString()}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* LIVE PRICING & WALLET SUMMARY BOX */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/80 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-[#64748B] tracking-wider block">
                      Total Order Cost
                    </span>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl sm:text-3xl font-black font-mono text-[#7C3AED]">
                        ₦{totalCost.toLocaleString()}
                      </span>
                      <span className="text-xs text-[#64748B] font-bold">
                        (₦{(currentService.pricePer1k / 1000).toFixed(2)} per unit)
                      </span>
                    </div>
                  </div>

                  {/* Wallet Check */}
                  <div className="sm:text-right">
                    <span className="text-[10px] font-bold text-[#64748B] block">
                      Your Available Wallet Balance
                    </span>
                    <span className={`text-base font-black font-mono ${
                      isBalanceSufficient ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      ₦{walletBalance.toLocaleString()}
                    </span>
                    {!isBalanceSufficient && (
                      <span className="text-[10px] text-rose-600 font-bold block">
                        Short by ₦{(totalCost - walletBalance).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#64748B] font-medium pt-0.5">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Automated Escrow Order Protection
                  </span>
                  <span>Instant Delivery Queue</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={currentService.status === 'paused'}
                  className="w-full sm:flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black text-sm py-3.5 px-6 rounded-2xl transition shadow-md shadow-purple-600/20 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <span>Review & Confirm Order</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {!isBalanceSufficient && totalCost > 0 && (
                  <button
                    type="button"
                    onClick={onOpenWallet}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3.5 px-5 rounded-2xl transition cursor-pointer shadow-xs active:scale-[0.99] flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Top Up Wallet</span>
                  </button>
                )}
              </div>
            </form>

            {/* COMPLIANCE & LEGITIMATE PROMOTION NOTICE */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 space-y-2.5">
              <div className="flex items-center space-x-2 text-emerald-400">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <h4 className="font-black text-sm">
                  100% Policy-Compliant & Legitimate Promotion Guarantee
                </h4>
              </div>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                All promotions on ZENET HUB are distributed via real, consenting viewers and legitimate creator discovery networks. We strictly prohibit fake bot accounts, automated scripts, or deceptive engagement in full compliance with TikTok’s Terms of Service. Safe for verified creators and monetization-eligible accounts.
              </p>
            </div>

          </div>
        )}

        {/* MAIN TAB 2: PROMOTION HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white border border-purple-100 rounded-3xl p-5 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div>
                <h3 className="font-extrabold text-[#0F172A] text-base">
                  Your Social Boost Orders
                </h3>
                <p className="text-xs text-[#64748B]">
                  Live status and records of all Social Boost campaigns placed from your wallet.
                </p>
              </div>

              <button
                onClick={fetchOrders}
                disabled={loadingOrders}
                className="text-xs font-bold text-[#7C3AED] hover:text-[#6D28D9] flex items-center gap-1 cursor-pointer p-1.5 rounded-lg hover:bg-purple-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingOrders ? (
              <div className="text-center py-12 space-y-2">
                <RefreshCw className="w-6 h-6 text-[#7C3AED] animate-spin mx-auto" />
                <p className="text-xs text-[#64748B] font-semibold">Loading your promotion history...</p>
              </div>
            ) : userOrders.length === 0 ? (
              <div className="text-center py-12 space-y-3 bg-purple-50/30 rounded-2xl border border-dashed border-purple-200 p-6">
                <Flame className="w-8 h-8 text-slate-400 mx-auto opacity-40" />
                <h4 className="font-black text-sm text-[#0F172A]">No Social Boost orders yet</h4>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                  Select a TikTok service above to launch your first legitimate promotion campaign!
                </p>
                <button
                  onClick={() => setActiveTab('order')}
                  className="bg-[#7C3AED] text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs hover:bg-[#6D28D9] transition cursor-pointer"
                >
                  Start New Promotion
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {userOrders.map((ord, idx) => (
                  <div
                    key={`${ord.id}-${idx}`}
                    className="bg-[#FAF8FE] border border-purple-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-purple-300 transition"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-[#7C3AED] bg-white border border-purple-200 px-2 py-0.5 rounded-md">
                          {ord.orderNumber || ord.id.slice(0, 10)}
                        </span>
                        <span className="font-black text-xs text-[#0F172A]">
                          {ord.serviceName}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          ord.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : ord.status === 'processing'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {ord.status}
                        </span>
                      </div>

                      <div className="text-xs text-[#64748B] space-y-0.5">
                        <p className="truncate font-mono">
                          Target: <span className="text-[#0F172A] font-semibold">{ord.targetUrl}</span>
                        </p>
                        <p className="text-[11px]">
                          Quantity: <strong className="text-[#0F172A]">{ord.quantity.toLocaleString()}</strong> • Placed: {new Date(ord.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <span className="font-mono font-black text-[#7C3AED] text-base block">
                        ₦{ord.totalCost.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#64748B] font-semibold">
                        Paid via Zenet Wallet
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* CONFIRMATION & ORDER REVIEW MODAL (SHOWS SERVICE, PRICE, QUANTITY, LINK, TOTAL COST CLEARLY) */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white border border-purple-100 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-5 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#7C3AED] text-white flex items-center justify-center shadow-xs">
                  {getServiceIcon(currentService.id, 'w-5 h-5')}
                </div>
                <div>
                  <h3 className="font-black text-[#0F172A] text-base">
                    Review Order Summary
                  </h3>
                  <span className="text-xs text-[#64748B] font-semibold">
                    Confirm your Social Boost campaign details
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Clear Order Items Table */}
            <div className="bg-purple-50/50 border border-purple-200/80 rounded-2xl p-4.5 space-y-3 text-xs sm:text-sm">
              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                <span className="text-[#64748B] font-bold">Selected Service:</span>
                <span className="font-black text-[#0F172A] flex items-center gap-1.5">
                  {currentService.name}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                <span className="text-[#64748B] font-bold">Unit Price Rate:</span>
                <span className="font-mono font-bold text-[#7C3AED]">
                  ₦{currentService.pricePer1k.toLocaleString()} / 1,000 units
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                <span className="text-[#64748B] font-bold">Order Quantity:</span>
                <span className="font-mono font-black text-[#0F172A]">
                  {quantity.toLocaleString()} units
                </span>
              </div>

              <div className="space-y-1 border-b border-purple-100 pb-2">
                <span className="text-[#64748B] font-bold block">Target TikTok Link:</span>
                <p className="font-mono text-xs text-[#0F172A] bg-white border border-purple-100 p-2 rounded-xl break-all">
                  {targetUrl}
                </p>
              </div>

              {currentService.requiresComments && parsedComments.length > 0 && (
                <div className="space-y-1 border-b border-purple-100 pb-2">
                  <span className="text-[#64748B] font-bold block">
                    Custom Comments ({parsedComments.length}):
                  </span>
                  <div className="bg-white border border-purple-100 p-2 rounded-xl max-h-24 overflow-y-auto custom-scrollbar space-y-1 text-xs">
                    {parsedComments.map((c, i) => (
                      <p key={i} className="text-[#0F172A] truncate">
                        {i + 1}. {c}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-black text-[#0F172A]">Total Cost:</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-[#7C3AED]">
                  ₦{totalCost.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Wallet Balance Check Indicator */}
            <div className="flex items-center justify-between p-3 rounded-xl border text-xs font-bold ${
              isBalanceSufficient 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 shrink-0" />
                <span>Wallet Balance: ₦{walletBalance.toLocaleString()}</span>
              </div>
              <span>{isBalanceSufficient ? 'Sufficient Balance' : 'Insufficient Balance'}</span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-[#0F172A] font-bold text-xs py-3 rounded-2xl transition cursor-pointer"
              >
                Back / Edit
              </button>

              {isBalanceSufficient ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmOrder}
                  className="flex-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black text-xs sm:text-sm py-3 rounded-2xl transition shadow-md shadow-purple-600/20 active:scale-[0.99] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing Order...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Pay ₦{totalCost.toLocaleString()}</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmModalOpen(false);
                    onOpenWallet();
                  }}
                  className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm py-3 rounded-2xl transition cursor-pointer shadow-xs active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Top Up Wallet via Paystack</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ORDER SUCCESS MODAL */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white border border-purple-100 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 sm:p-7 space-y-5 text-center animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-black text-[#0F172A]">
                Promotion Order Placed!
              </h3>
              <p className="text-xs text-[#64748B] font-medium">
                Your Social Boost campaign has been submitted and queued for live distribution.
              </p>
            </div>

            <div className="bg-[#FAF8FE] border border-purple-100 rounded-2xl p-4 text-xs space-y-2 text-left">
              <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                <span className="text-[#64748B] font-bold">Order Number:</span>
                <span className="font-mono font-black text-[#7C3AED]">
                  {completedOrder.orderNumber}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                <span className="text-[#64748B] font-bold">Service:</span>
                <span className="font-black text-[#0F172A]">{completedOrder.serviceName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                <span className="text-[#64748B] font-bold">Quantity:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {completedOrder.quantity.toLocaleString()} units
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B] font-bold">Amount Paid:</span>
                <span className="font-mono font-black text-[#7C3AED]">
                  ₦{completedOrder.totalCost.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCompletedOrder(null);
                  setActiveTab('history');
                  fetchOrders();
                }}
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black text-xs sm:text-sm py-3 rounded-2xl transition shadow-md shadow-purple-600/20 active:scale-[0.99] cursor-pointer"
              >
                View Order in History
              </button>
              <button
                type="button"
                onClick={() => setCompletedOrder(null)}
                className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-[#0F172A] font-bold text-xs py-2.5 rounded-2xl transition cursor-pointer"
              >
                Place Another Promotion
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
