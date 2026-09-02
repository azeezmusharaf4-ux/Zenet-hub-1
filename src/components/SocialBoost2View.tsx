import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  Sparkles, 
  Instagram, 
  Facebook, 
  Youtube, 
  Twitter, 
  Send, 
  Rocket, 
  ShieldCheck, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Wallet, 
  Search, 
  RefreshCw, 
  Sliders, 
  Eye, 
  EyeOff, 
  DollarSign, 
  Copy, 
  Layers, 
  Flame, 
  Music2, 
  Share2, 
  Check, 
  Star, 
  Plus, 
  Minus, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Globe, 
  Video, 
  MessageSquare, 
  Users, 
  Compass, 
  Database, 
  ExternalLink, 
  Info, 
  PackageCheck, 
  SlidersHorizontal, 
  Bookmark, 
  Gamepad2, 
  Palette, 
  Cloud 
} from 'lucide-react';
import { UserProfile, SocialBoostService, SocialBoostOrder, SocialBoostPricingSettings } from '../types';
import { auth, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch, sanitizeApiErrorMessage } from '../utils/api';

interface SocialBoost2ViewProps {
  userProfile: UserProfile | null;
  walletBalance: number;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
}

// Visual Identity & Color Theme Resolver for all SMM Platforms
const getPlatformVisuals = (platformName: string) => {
  const p = (platformName || '').toLowerCase().trim();
  
  if (p.includes('instagram') || p === 'ig') {
    return { 
      icon: Instagram, 
      iconColor: 'text-[#E1306C]',
      iconBg: 'bg-[#E1306C]/15 border-[#E1306C]/30',
      accentColor: 'from-[#E1306C] to-[#833AB4]',
      displayName: 'INSTAGRAM',
      tagline: 'Followers, Likes, Views & Comments'
    };
  }
  if (p.includes('facebook') || p === 'fb') {
    return { 
      icon: Facebook, 
      iconColor: 'text-[#1877F2]',
      iconBg: 'bg-[#1877F2]/15 border-[#1877F2]/30',
      accentColor: 'from-[#1877F2] to-[#0D65D9]',
      displayName: 'FACEBOOK',
      tagline: 'Page Likes, Followers & Reactions'
    };
  }
  if (p.includes('tiktok') || p === 'tt') {
    return { 
      icon: Music2, 
      iconColor: 'text-[#00F2FE]',
      iconBg: 'bg-[#00F2FE]/15 border-[#00F2FE]/30',
      accentColor: 'from-[#00F2FE] to-[#FE0979]',
      displayName: 'TIKTOK',
      tagline: 'Followers, FYP Likes & Live Views'
    };
  }
  if (p.includes('youtube') || p === 'yt') {
    return { 
      icon: Youtube, 
      iconColor: 'text-[#FF0000]',
      iconBg: 'bg-[#FF0000]/15 border-[#FF0000]/30',
      accentColor: 'from-[#FF0000] to-[#CC0000]',
      displayName: 'YOUTUBE',
      tagline: 'Subscribers, Views & Watch Hours'
    };
  }
  if (p.includes('twitter') || p.includes('x.com') || p.includes('x / twitter') || p.includes('tweet') || p === 'x') {
    return { 
      icon: Twitter, 
      iconColor: 'text-[#1DA1F2]',
      iconBg: 'bg-[#1DA1F2]/15 border-[#1DA1F2]/30',
      accentColor: 'from-[#1DA1F2] to-[#0c85d0]',
      displayName: 'TWITTER / X',
      tagline: 'Followers, Retweets & Impressions'
    };
  }
  if (p.includes('telegram') || p === 'tg') {
    return { 
      icon: Send, 
      iconColor: 'text-[#229ED9]',
      iconBg: 'bg-[#229ED9]/15 border-[#229ED9]/30',
      accentColor: 'from-[#229ED9] to-[#1782b6]',
      displayName: 'TELEGRAM',
      tagline: 'Channel Members & Post Views'
    };
  }
  if (p.includes('spotify') || p.includes('music')) {
    return { 
      icon: Music2, 
      iconColor: 'text-[#1DB954]',
      iconBg: 'bg-[#1DB954]/15 border-[#1DB954]/30',
      accentColor: 'from-[#1DB954] to-[#14833b]',
      displayName: 'SPOTIFY & MUSIC',
      tagline: 'Plays, Monthly Listeners & Saves'
    };
  }
  return { 
    icon: Flame, 
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15 border-cyan-500/30',
    accentColor: 'from-cyan-500 to-blue-600',
    displayName: platformName?.toUpperCase() || 'SOCIAL GROWTH',
    tagline: 'Instant Social Media Marketing'
  };
};

export const SocialBoost2View: React.FC<SocialBoost2ViewProps> = ({
  userProfile,
  walletBalance,
  onBackToMarketplace,
  onOpenWallet
}) => {
  const isOwner = userProfile?.role === 'owner' || userProfile?.email?.toLowerCase().trim() === 'azeezmusharaf4@gmail.com' || auth?.currentUser?.email?.toLowerCase().trim() === 'azeezmusharaf4@gmail.com';

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'order' | 'history' | 'owner_panel'>('order');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data states
  const [services, setServices] = useState<SocialBoostService[]>([]);
  const [orders, setOrders] = useState<SocialBoostOrder[]>([]);
  const [pricingSettings, setPricingSettings] = useState<SocialBoostPricingSettings | null>(null);

  // Loaders
  const [servicesLoading, setServicesLoading] = useState<boolean>(true);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);
  const [placingOrder, setPlacingOrder] = useState<boolean>(false);

  // Selected order state
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1000);
  const [runs, setRuns] = useState<number>(1);
  const [interval, setInterval] = useState<number>(0);

  // Status & notifications
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [orderCreated, setOrderCreated] = useState<SocialBoostOrder | null>(null);

  // 1. Fetch Provider 2 Services
  const fetchServices = useCallback(async () => {
    setServicesLoading(true);
    setErrorMessage('');
    try {
      const callerEmail = userProfile?.email || auth?.currentUser?.email || '';
      const endpoint = `/api/social-boost-2/services?action=services&callerEmail=${encodeURIComponent(callerEmail)}`;
      const data = await safeApiFetch(endpoint);
      if (data && Array.isArray(data.services)) {
        setServices(data.services);
        if (data.pricingSettings) {
          setPricingSettings(data.pricingSettings);
        }
      } else {
        // High quality fallback catalog for Provider 2
        const defaultServices: SocialBoostService[] = [
          {
            service: '201',
            name: 'Instagram Followers [High Quality - Non Drop - Instant]',
            type: 'Default',
            category: 'Instagram Followers',
            rate: 1800,
            min: 50,
            max: 100000,
            dripfeed: false,
            refill: true,
            cancel: true,
            provider: 'Provider 2 High-Speed Pool',
            platform: 'Instagram',
            description: 'Instant start. Refill button active for 30 days.'
          },
          {
            service: '202',
            name: 'Instagram Likes [Real Active - 20k/Day - Super Fast]',
            type: 'Default',
            category: 'Instagram Likes',
            rate: 450,
            min: 50,
            max: 50000,
            dripfeed: false,
            refill: false,
            cancel: false,
            provider: 'Provider 2 High-Speed Pool',
            platform: 'Instagram',
            description: 'Fast delivery within 5-10 minutes.'
          },
          {
            service: '203',
            name: 'TikTok Followers [Worldwide Real Accounts - Instant]',
            type: 'Default',
            category: 'TikTok Followers',
            rate: 2200,
            min: 100,
            max: 50000,
            dripfeed: false,
            refill: true,
            cancel: true,
            provider: 'Provider 2 High-Speed Pool',
            platform: 'TikTok',
            description: 'High retention accounts, zero drop.'
          },
          {
            service: '204',
            name: 'TikTok FYP Video Views [Algorithm Trigger - Instant]',
            type: 'Default',
            category: 'TikTok Views',
            rate: 150,
            min: 500,
            max: 1000000,
            dripfeed: true,
            refill: false,
            cancel: false,
            provider: 'Provider 2 High-Speed Pool',
            platform: 'TikTok',
            description: 'Boosts video ranking and algorithm discovery.'
          },
          {
            service: '205',
            name: 'YouTube Views [High Retention - Monetizable]',
            type: 'Default',
            category: 'YouTube Views',
            rate: 3100,
            min: 500,
            max: 500000,
            dripfeed: true,
            refill: true,
            cancel: true,
            provider: 'Provider 2 High-Speed Pool',
            platform: 'YouTube',
            description: 'Real audience watch time, safe for monetized channels.'
          },
          {
            service: '206',
            name: 'Telegram Channel Members [Non Drop - 0% Drop Rate]',
            type: 'Default',
            category: 'Telegram Members',
            rate: 1650,
            min: 50,
            max: 200000,
            dripfeed: false,
            refill: true,
            cancel: true,
            provider: 'Provider 2 High-Speed Pool',
            platform: 'Telegram',
            description: 'High quality channel subscribers.'
          },
          {
            service: '207',
            name: 'Twitter / X Followers [Organic Looking - Instant]',
            type: 'Default',
            category: 'Twitter Followers',
            rate: 2800,
            min: 100,
            max: 50000,
            dripfeed: false,
            refill: true,
            cancel: true,
            provider: 'Provider 2 High-Speed Pool',
            platform: 'Twitter',
            description: 'Verified appearance, stable profiles.'
          },
          {
            service: '208',
            name: 'Facebook Page Likes & Followers [High Quality]',
            type: 'Default',
            category: 'Facebook Page Likes',
            rate: 1950,
            min: 100,
            max: 50000,
            dripfeed: false,
            refill: true,
            cancel: true,
            provider: 'Provider 2 High-Speed Pool',
            platform: 'Facebook',
            description: 'Permanent page followers and engagements.'
          }
        ];
        setServices(defaultServices);
      }
    } catch (err: any) {
      console.warn('Error fetching Provider 2 services:', err);
    } finally {
      setServicesLoading(false);
    }
  }, [userProfile?.email]);

  // 2. Fetch Provider 2 Orders
  const fetchOrders = useCallback(async () => {
    if (!auth?.currentUser?.uid) return;
    setOrdersLoading(true);
    try {
      const endpoint = isOwner 
        ? '/api/social-boost-2/orders?action=orders&all=true' 
        : `/api/social-boost-2/orders?action=orders&userId=${encodeURIComponent(auth.currentUser.uid)}`;
      const data = await safeApiFetch(endpoint);
      if (data && Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch (err: any) {
      console.warn('Error fetching Provider 2 orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchOrders();
    }
  }, [activeTab, fetchOrders]);

  // Unique Platforms list
  const platforms = useMemo(() => {
    const list = Array.from(new Set(services.map(s => s.platform || 'Other'))).filter(Boolean);
    return ['all', ...list];
  }, [services]);

  // Filtered services by platform & search
  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchPlatform = selectedPlatform === 'all' || (s.platform || 'Other').toLowerCase() === selectedPlatform.toLowerCase();
      const matchCategory = selectedCategory === 'all' || s.category === selectedCategory;
      const matchSearch = !searchQuery.trim() || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.service && String(s.service).includes(searchQuery));
      return matchPlatform && matchCategory && matchSearch;
    });
  }, [services, selectedPlatform, selectedCategory, searchQuery]);

  // Categories for selected platform
  const categories = useMemo(() => {
    const subset = selectedPlatform === 'all' 
      ? services 
      : services.filter(s => (s.platform || 'Other').toLowerCase() === selectedPlatform.toLowerCase());
    const cats = Array.from(new Set(subset.map(s => s.category))).filter(Boolean);
    return ['all', ...cats];
  }, [services, selectedPlatform]);

  // Active selected service object
  const selectedService = useMemo(() => {
    return services.find(s => String(s.service) === String(selectedServiceId)) || filteredServices[0] || null;
  }, [services, selectedServiceId, filteredServices]);

  // Synchronize default service selection
  useEffect(() => {
    if (!selectedServiceId && filteredServices.length > 0) {
      setSelectedServiceId(String(filteredServices[0].service));
      setQuantity(Math.max(filteredServices[0].min || 100, 1000));
    }
  }, [filteredServices, selectedServiceId]);

  // Calculate total price in NGN
  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    const ratePerThousand = selectedService.rate || 0;
    const totalQty = quantity * (runs || 1);
    const calculated = (ratePerThousand / 1000) * totalQty;
    return Math.max(1, Math.round(calculated));
  }, [selectedService, quantity, runs]);

  // Handle Order Placement
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setOrderCreated(null);

    if (!selectedService) {
      setErrorMessage('Please select a boost service to proceed.');
      return;
    }

    if (!link.trim()) {
      setErrorMessage('Please provide the target link or username (e.g. https://instagram.com/yourprofile).');
      return;
    }

    if (quantity < (selectedService.min || 1)) {
      setErrorMessage(`Minimum quantity for this service is ${selectedService.min.toLocaleString()}.`);
      return;
    }

    if (selectedService.max && quantity > selectedService.max) {
      setErrorMessage(`Maximum quantity for this service is ${selectedService.max.toLocaleString()}.`);
      return;
    }

    if (walletBalance < totalPrice) {
      setErrorMessage(`Insufficient wallet balance (₦${walletBalance.toLocaleString()}). You need ₦${totalPrice.toLocaleString()} to complete this order.`);
      return;
    }

    setPlacingOrder(true);
    try {
      const payload = {
        action: 'order',
        service: selectedService.service,
        serviceName: selectedService.name,
        category: selectedService.category,
        platform: selectedService.platform || 'Other',
        link: link.trim(),
        quantity: Number(quantity),
        runs: Number(runs) || 1,
        interval: Number(interval) || 0,
        totalCost: totalPrice,
        userId: userProfile?.uid || auth?.currentUser?.uid,
        userEmail: userProfile?.email || auth?.currentUser?.email
      };

      const data = await safeApiFetch('/api/social-boost-2/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (data && data.success) {
        setSuccessMessage(`Order #${data.order?.orderId || data.orderId} submitted successfully to Provider 2!`);
        setOrderCreated(data.order || { orderId: data.orderId, serviceName: selectedService.name, charge: totalPrice, status: 'Pending' });
        setLink('');
        fetchOrders();
      } else {
        setErrorMessage(data?.error || data?.message || 'Failed to place order with Provider 2. Please verify your details.');
      }
    } catch (err: any) {
      setErrorMessage(sanitizeApiErrorMessage(err.message || 'Network request failed.'));
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#210f3f]">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToMarketplace}
            className="p-2.5 rounded-xl bg-[#140b2b] border border-[#2b165c] text-purple-300 hover:text-white hover:bg-[#1f1042] transition cursor-pointer"
            title="Back to Marketplace"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase tracking-widest text-[#bd93f9]">
                SOCIAL BOOST 2
              </span>
              <span className="bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                PROVIDER 2
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Social Boost 2</span>
            </h1>
          </div>
        </div>

        {/* User Balance & Fund CTA */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-[#12082b] border border-[#261352] px-3.5 py-2 rounded-xl">
            <Wallet className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-300/80 font-bold">Balance:</span>
            <span className="text-sm font-black text-white font-mono">₦{walletBalance.toLocaleString()}</span>
          </div>
          <button
            onClick={onOpenWallet}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black rounded-xl shadow-lg shadow-purple-600/30 transition cursor-pointer"
          >
            Fund Wallet
          </button>
        </div>
      </div>

      {/* Provider Notice Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#190c30] via-[#240e45] to-[#190c30] border border-pink-500/30 text-pink-200 text-xs flex items-start gap-3 shadow-md">
        <Sparkles className="w-5 h-5 text-pink-400 shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <p className="font-extrabold text-white">
            Secondary SMM Provider Architecture (Social Boost 2)
          </p>
          <p className="text-pink-200/80 leading-relaxed">
            This module provides high-speed automated promotions powered exclusively by <strong>Provider 2</strong>. Your original Social Boost remains completely untouched and live simultaneously. Provider 2 credentials can be populated in the server environment without affecting existing keys.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center space-x-2 mb-6 border-b border-[#210f3f] pb-3">
        <button
          onClick={() => setActiveTab('order')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
            activeTab === 'order'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-purple-300 hover:bg-[#150a2e] hover:text-white'
          }`}
        >
          <Rocket className="w-4 h-4" />
          <span>New Order (Provider 2)</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-purple-300 hover:bg-[#150a2e] hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Order History ({orders.length})</span>
        </button>
      </div>

      {/* Alert Messages */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start space-x-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{errorMessage}</div>
          <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start space-x-2.5 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{successMessage}</div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'order' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Form Column (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Platform Filter Tabs */}
            <div className="bg-[#0f0724] border border-[#231248] rounded-2xl p-5 space-y-3 shadow-lg">
              <label className="text-xs font-black uppercase tracking-wider text-purple-200 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-pink-400" />
                <span>1. Select Platform</span>
              </label>

              <div className="flex flex-wrap gap-2">
                {platforms.map((plat) => {
                  const isSel = selectedPlatform.toLowerCase() === plat.toLowerCase();
                  const visuals = getPlatformVisuals(plat);
                  const Icon = visuals.icon;
                  return (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => {
                        setSelectedPlatform(plat);
                        setSelectedCategory('all');
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer border ${
                        isSel
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-pink-400 shadow-md font-black'
                          : 'bg-[#140b2b] border-[#2b1756] text-purple-300 hover:bg-[#1c0f3d]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="capitalize">{plat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category & Service Dropdowns */}
            <div className="bg-[#0f0724] border border-[#231248] rounded-2xl p-5 space-y-4 shadow-lg">
              <label className="text-xs font-black uppercase tracking-wider text-purple-200 flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-pink-400" />
                <span>2. Select Category & Service</span>
              </label>

              {/* Category selector */}
              <div>
                <span className="text-[10px] font-black uppercase text-purple-300/70 block mb-1">Category</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-[#140b2b] border border-[#2b1756] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500 font-bold"
                >
                  <option value="all">All Categories ({categories.length - 1})</option>
                  {categories.filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Service selector */}
              <div>
                <span className="text-[10px] font-black uppercase text-purple-300/70 block mb-1">Service</span>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-[#140b2b] border border-[#2b1756] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500 font-bold"
                >
                  {filteredServices.map(srv => (
                    <option key={srv.service} value={srv.service}>
                      ID {srv.service} - {srv.name} (₦{srv.rate?.toLocaleString()} / 1,000)
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Details Card */}
              {selectedService && (
                <div className="p-3.5 rounded-xl bg-[#140a2c] border border-[#2d155b] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white">{selectedService.name}</span>
                    <span className="font-mono font-black text-pink-400">
                      ₦{selectedService.rate?.toLocaleString()} / 1k
                    </span>
                  </div>
                  {selectedService.description && (
                    <p className="text-[11px] text-purple-300/70">{selectedService.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-purple-300/80">
                    <span className="bg-[#1e0e3d] px-2 py-0.5 rounded border border-[#37196d]">
                      Min: {selectedService.min?.toLocaleString()}
                    </span>
                    <span className="bg-[#1e0e3d] px-2 py-0.5 rounded border border-[#37196d]">
                      Max: {selectedService.max?.toLocaleString()}
                    </span>
                    {selectedService.refill && (
                      <span className="bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                        30-Day Refill
                      </span>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Target Link & Quantity Input */}
            <form onSubmit={handlePlaceOrder} className="bg-[#0f0724] border border-[#231248] rounded-2xl p-5 space-y-4 shadow-lg">
              <label className="text-xs font-black uppercase tracking-wider text-purple-200 flex items-center space-x-2">
                <Rocket className="w-4 h-4 text-pink-400" />
                <span>3. Order Parameters</span>
              </label>

              {/* Target Link */}
              <div>
                <label className="text-[10px] font-black uppercase text-purple-300/70 block mb-1">
                  Target Link / Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://instagram.com/your_handle or profile link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="w-full bg-[#140b2b] border border-[#2b1756] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-purple-400/40 focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Quantity */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black uppercase text-purple-300/70">Quantity</label>
                  {selectedService && (
                    <span className="text-[10px] text-purple-400/60">
                      Min {selectedService.min?.toLocaleString()} - Max {selectedService.max?.toLocaleString()}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min={selectedService?.min || 10}
                  max={selectedService?.max || 1000000}
                  step={10}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-[#140b2b] border border-[#2b1756] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Quick quantity chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[500, 1000, 2500, 5000, 10000].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuantity(q)}
                    className="px-2.5 py-1 rounded-lg bg-[#140b2b] hover:bg-[#1e0e3d] border border-[#2b1756] text-[10px] font-bold text-purple-300"
                  >
                    +{q.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={placingOrder || servicesLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-sm shadow-xl shadow-purple-600/30 transition duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer mt-4"
              >
                {placingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Order to Provider 2...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    <span>Submit Boost Order (₦{totalPrice.toLocaleString()})</span>
                  </>
                )}
              </button>
            </form>

          </div>

          {/* Right Summary Column (1 col) */}
          <div className="space-y-6">
            
            <div className="bg-gradient-to-b from-[#140a33] to-[#0d0521] border border-[#2c165a] rounded-2xl p-6 shadow-xl space-y-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-pink-400 block">
                  ORDER SUMMARY (PROVIDER 2)
                </span>
                <h3 className="text-lg font-black text-white">Estimated Charge</h3>
              </div>

              <div className="space-y-3 py-3 border-y border-[#221045] text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300/70">Platform:</span>
                  <span className="font-extrabold text-white capitalize">{selectedService?.platform || 'Social'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300/70">Rate per 1,000:</span>
                  <span className="font-mono text-white font-bold">₦{selectedService?.rate?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300/70">Ordered Quantity:</span>
                  <span className="font-mono text-white font-black">{quantity.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs text-purple-300 font-bold block">Total Amount</span>
                  <span className="text-[10px] text-pink-400/80 font-semibold block">Deducted from wallet</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-white">
                    ₦{totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#140b2b] border border-[#2a1656] text-[11px] text-purple-300/70 leading-relaxed">
                Orders through Provider 2 are queued instantly into high-speed carrier nodes. Ensure your target profile is public.
              </div>
            </div>

            {/* Provider 2 Info Widget */}
            <div className="bg-[#0f0724] border border-[#231248] rounded-2xl p-5 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-pink-400 font-black">
                <ShieldCheck className="w-4 h-4" />
                <span>Provider 2 SMM Gateway</span>
              </div>
              <p className="text-purple-300/60 leading-relaxed text-[11px]">
                Separate from Provider 1. Automatically dispatches tasks once your Provider 2 API credentials are configured.
              </p>
            </div>

          </div>

        </div>
      ) : (
        /* ORDER HISTORY TAB */
        <div className="bg-[#0f0724] border border-[#231248] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white">Provider 2 Order History</h3>
            <button
              onClick={fetchOrders}
              className="text-purple-400 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12 text-purple-300/50 space-y-2">
              <Clock className="w-8 h-8 mx-auto text-purple-400/30" />
              <p className="text-sm font-bold">No Provider 2 boost orders recorded yet.</p>
              <p className="text-xs">Place an order above to begin tracking live fulfillment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-purple-200">
                <thead className="border-b border-[#231248] text-[10px] font-black uppercase text-purple-400/60">
                  <tr>
                    <th className="py-3 px-2">Order ID</th>
                    <th className="py-3 px-2">Service</th>
                    <th className="py-3 px-2">Link</th>
                    <th className="py-3 px-2">Quantity</th>
                    <th className="py-3 px-2">Charge</th>
                    <th className="py-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e0e3d]">
                  {orders.map((ord) => (
                    <tr key={ord.orderId || ord.id} className="hover:bg-[#140b2b]">
                      <td className="py-3 px-2 font-mono text-white font-bold">#{ord.orderId}</td>
                      <td className="py-3 px-2 font-bold max-w-xs truncate">{ord.serviceName || ord.service}</td>
                      <td className="py-3 px-2 font-mono text-purple-300/70 max-w-xs truncate">{ord.link}</td>
                      <td className="py-3 px-2 font-mono">{ord.quantity?.toLocaleString()}</td>
                      <td className="py-3 px-2 font-mono text-white font-bold">₦{ord.charge?.toLocaleString()}</td>
                      <td className="py-3 px-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          ord.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' :
                          ord.status === 'In progress' || ord.status === 'Processing' ? 'bg-blue-500/20 text-blue-300' :
                          ord.status === 'Canceled' ? 'bg-red-500/20 text-red-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {ord.status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
