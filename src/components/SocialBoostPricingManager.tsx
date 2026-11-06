import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Sparkles, 
  DollarSign, 
  TrendingUp, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  ChevronLeft, 
  ChevronRight, 
  Info,
  Sliders,
  Check,
  X,
  ArrowLeft,
  Users,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Youtube,
  Plus,
  Minus,
  RotateCcw,
  ShieldCheck,
  Layers,
  HelpCircle
} from 'lucide-react';
import { auth, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch } from '../utils/api';

export interface CategoryMarkupSetting {
  markupFixedNgn?: number; // Markup amount in Naira per 1k
  markupPercent?: number;  // Optional percentage markup
}

export interface VoikerServicePricingItem {
  id: string;
  providerServiceId: string;
  name: string;
  platform: string;
  category: string;
  type: string;
  rateUsd: number;
  providerRatePer1000: number; // Converted wholesale cost from Voiker at live exchange rate
  customerRatePer1000: number; // Final selling price displayed to customers
  ratePer1000: number;
  markupPer1000: number;
  customMarkupFixedNgn?: number; // Individual markup override in Naira
  hasCustomMarkup?: boolean;
  min: number;
  max: number;
  isActive: boolean;
}

interface SocialBoostPricingManagerProps {
  onClose?: () => void;
  onPriceChangeApplied?: () => void;
  isOwner?: boolean;
}

// Standard categories supported for bulk and group controls
export const STANDARD_CATEGORIES = [
  { key: 'Followers', label: 'Followers', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { key: 'Views', label: 'Views', icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'Likes', label: 'Likes', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  { key: 'Comments', label: 'Comments', icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'Shares', label: 'Shares', icon: Share2, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'Subscribers', label: 'Subscribers', icon: Youtube, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  { key: 'Other', label: 'Other Engagement', icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' }
] as const;

export const SocialBoostPricingManager: React.FC<SocialBoostPricingManagerProps> = ({
  onClose,
  onPriceChangeApplied,
  isOwner = true
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'categories' | 'global' | 'services'>('categories');

  // Core Data
  const [services, setServices] = useState<VoikerServicePricingItem[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Live Exchange Rate
  const [liveRate, setLiveRate] = useState<number>(1346.47);
  const [rateSource, setRateSource] = useState<string>('open.er-api.com');
  const [rateTimestamp, setRateTimestamp] = useState<string>('');
  const [isRefreshingRate, setIsRefreshingRate] = useState<boolean>(false);

  // Global Default Markup
  const [globalDefaultMarkup, setGlobalDefaultMarkup] = useState<number>(0);
  const [globalMarkupPercent, setGlobalMarkupPercent] = useState<number>(0);
  const [pendingGlobalMarkup, setPendingGlobalMarkup] = useState<number>(0);
  const [pendingGlobalPercent, setPendingGlobalPercent] = useState<number>(0);

  // Category Markups: Record<categoryKey, CategoryMarkupSetting>
  const [categoryMarkups, setCategoryMarkups] = useState<Record<string, CategoryMarkupSetting>>({
    Followers: { markupFixedNgn: 0, markupPercent: 0 },
    Views: { markupFixedNgn: 0, markupPercent: 0 },
    Likes: { markupFixedNgn: 0, markupPercent: 0 },
    Comments: { markupFixedNgn: 0, markupPercent: 0 },
    Shares: { markupFixedNgn: 0, markupPercent: 0 },
    Subscribers: { markupFixedNgn: 0, markupPercent: 0 },
    Other: { markupFixedNgn: 0, markupPercent: 0 }
  });
  const [pendingCategoryMarkups, setPendingCategoryMarkups] = useState<Record<string, CategoryMarkupSetting>>({});

  // Individual Service Overrides: Record<serviceId, number | null>
  const [pendingServiceMarkups, setPendingServiceMarkups] = useState<Record<string, number | null>>({});
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [savedSuccessMap, setSavedSuccessMap] = useState<Record<string, boolean>>({});

  // Global Saving State & Notifications
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtering & Pagination for Individual Services
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [markupStatusFilter, setMarkupStatusFilter] = useState<'all' | 'custom' | 'default'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification((cur) => (cur?.text === text ? null : cur));
    }, 4500);
  };

  // Helper: Resolve category key for a service
  const getCategoryKey = useCallback((svc: { type?: string; name?: string; category?: string }): string => {
    const rawType = (svc.type || '').trim();
    if (['Followers', 'Views', 'Likes', 'Comments', 'Shares', 'Subscribers'].includes(rawType)) {
      return rawType;
    }
    const combined = `${svc.name || ''} ${svc.category || ''}`.toLowerCase();
    if (combined.includes('follower')) return 'Followers';
    if (combined.includes('like') || combined.includes('reaction')) return 'Likes';
    if (combined.includes('view') || combined.includes('stream') || combined.includes('play')) return 'Views';
    if (combined.includes('comment')) return 'Comments';
    if (combined.includes('share') || combined.includes('repost')) return 'Shares';
    if (combined.includes('subscriber') || combined.includes('sub ')) return 'Subscribers';
    return 'Other';
  }, []);

  // Compute category service counts and average provider costs
  const categoryStats = useMemo(() => {
    const counts: Record<string, { count: number; avgProviderRate: number; totalRate: number }> = {
      Followers: { count: 0, avgProviderRate: 0, totalRate: 0 },
      Views: { count: 0, avgProviderRate: 0, totalRate: 0 },
      Likes: { count: 0, avgProviderRate: 0, totalRate: 0 },
      Comments: { count: 0, avgProviderRate: 0, totalRate: 0 },
      Shares: { count: 0, avgProviderRate: 0, totalRate: 0 },
      Subscribers: { count: 0, avgProviderRate: 0, totalRate: 0 },
      Other: { count: 0, avgProviderRate: 0, totalRate: 0 }
    };

    for (const svc of services) {
      const cat = getCategoryKey(svc);
      if (!counts[cat]) {
        counts[cat] = { count: 0, avgProviderRate: 0, totalRate: 0 };
      }
      counts[cat].count += 1;
      counts[cat].totalRate += (svc.providerRatePer1000 || 0);
    }

    for (const key of Object.keys(counts)) {
      if (counts[key].count > 0) {
        counts[key].avgProviderRate = Math.round(counts[key].totalRate / counts[key].count);
      }
    }

    return counts;
  }, [services, getCategoryKey]);

  // Load Settings & Services from Server
  const loadData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      // 1. Fetch Pricing Settings
      const settingsRes: any = await safeApiFetch('/api/voiker/pricing-settings', { headers });
      if (settingsRes && settingsRes.success && settingsRes.settings) {
        const s = settingsRes.settings;
        if (typeof s.usdToNgnRate === 'number' && s.usdToNgnRate > 0) {
          setLiveRate(s.usdToNgnRate);
        }
        if (s.exchangeRateSource) setRateSource(s.exchangeRateSource);
        if (s.exchangeRateRetrievedAt) setRateTimestamp(s.exchangeRateRetrievedAt);

        const defFixed = typeof s.defaultMarkupFixedNgn === 'number' ? s.defaultMarkupFixedNgn : 0;
        const defPct = typeof s.defaultMarkupPercent === 'number' ? s.defaultMarkupPercent : 0;
        setGlobalDefaultMarkup(defFixed);
        setPendingGlobalMarkup(defFixed);
        setGlobalMarkupPercent(defPct);
        setPendingGlobalPercent(defPct);

        if (s.categoryMarkups && typeof s.categoryMarkups === 'object') {
          const merged: Record<string, CategoryMarkupSetting> = {
            Followers: { markupFixedNgn: 0, markupPercent: 0 },
            Views: { markupFixedNgn: 0, markupPercent: 0 },
            Likes: { markupFixedNgn: 0, markupPercent: 0 },
            Comments: { markupFixedNgn: 0, markupPercent: 0 },
            Shares: { markupFixedNgn: 0, markupPercent: 0 },
            Subscribers: { markupFixedNgn: 0, markupPercent: 0 },
            Other: { markupFixedNgn: 0, markupPercent: 0 },
            ...s.categoryMarkups
          };
          setCategoryMarkups(merged);
          setPendingCategoryMarkups(merged);
        }
      }

      // 2. Fetch Catalogue Services
      const servicesUrl = `/api/voiker/services?action=services${forceRefresh ? '&refresh=true' : ''}`;
      const servicesRes: any = await safeApiFetch(servicesUrl, { headers });
      if (servicesRes && servicesRes.success && Array.isArray(servicesRes.services)) {
        setServices(servicesRes.services);
        if (Array.isArray(servicesRes.platforms)) {
          setPlatforms(servicesRes.platforms);
        }
      } else {
        throw new Error(servicesRes?.error || 'Failed to load Social Boost services catalogue.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred loading Social Boost pricing.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh Live Exchange Rate
  const handleRefreshExchangeRate = async () => {
    setIsRefreshingRate(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res: any = await safeApiFetch('/api/voiker/exchange-rate?refresh=true', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res && res.success && typeof res.rate === 'number') {
        setLiveRate(res.rate);
        setRateSource(res.source || 'Financial API');
        setRateTimestamp(res.retrievedAt || new Date().toISOString());
        showNotification(`Live USD/NGN exchange rate refreshed: ₦${res.rate.toLocaleString()} / $1 USD`);
        await loadData(true);
        if (onPriceChangeApplied) onPriceChangeApplied();
      } else {
        throw new Error(res?.error || 'Failed to retrieve exchange rate');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error updating exchange rate', 'error');
    } finally {
      setIsRefreshingRate(false);
    }
  };

  // --------------------------------------------------------------------------
  // CATEGORY PRICING CONTROLS
  // --------------------------------------------------------------------------
  const getCategoryCurrentMarkup = (catKey: string): { fixed: number; percent: number } => {
    const current = pendingCategoryMarkups[catKey] || categoryMarkups[catKey] || { markupFixedNgn: 0, markupPercent: 0 };
    return {
      fixed: typeof current.markupFixedNgn === 'number' ? Math.max(0, current.markupFixedNgn) : 0,
      percent: typeof current.markupPercent === 'number' ? Math.max(0, current.markupPercent) : 0
    };
  };

  const handleCategoryMarkupChange = (catKey: string, deltaAmount: number) => {
    const { fixed, percent } = getCategoryCurrentMarkup(catKey);
    const newFixed = Math.max(0, fixed + deltaAmount);
    setPendingCategoryMarkups(prev => ({
      ...prev,
      [catKey]: {
        markupFixedNgn: newFixed,
        markupPercent: percent
      }
    }));
  };

  const handleCategoryFixedInput = (catKey: string, valStr: string) => {
    const num = Math.max(0, Math.round(Number(valStr) || 0));
    const { percent } = getCategoryCurrentMarkup(catKey);
    setPendingCategoryMarkups(prev => ({
      ...prev,
      [catKey]: {
        markupFixedNgn: num,
        markupPercent: percent
      }
    }));
  };

  const handleCategoryPercentInput = (catKey: string, valStr: string) => {
    const num = Math.max(0, Math.min(300, Math.round(Number(valStr) || 0)));
    const { fixed } = getCategoryCurrentMarkup(catKey);
    setPendingCategoryMarkups(prev => ({
      ...prev,
      [catKey]: {
        markupFixedNgn: fixed,
        markupPercent: num
      }
    }));
  };

  const handleCategoryReset = (catKey: string) => {
    setPendingCategoryMarkups(prev => ({
      ...prev,
      [catKey]: {
        markupFixedNgn: 0,
        markupPercent: 0
      }
    }));
  };

  // --------------------------------------------------------------------------
  // GLOBAL DEFAULT CONTROLS
  // --------------------------------------------------------------------------
  const handleGlobalDelta = (delta: number) => {
    setPendingGlobalMarkup(prev => Math.max(0, prev + delta));
  };

  // --------------------------------------------------------------------------
  // INDIVIDUAL SERVICE CONTROLS
  // --------------------------------------------------------------------------
  const getEffectiveServiceMarkup = (service: VoikerServicePricingItem): { markup: number; source: 'custom' | 'category' | 'global' } => {
    // 1. Pending or saved custom override
    const pendingVal = pendingServiceMarkups[service.id];
    if (typeof pendingVal === 'number') {
      return { markup: pendingVal, source: 'custom' };
    }
    if (typeof service.customMarkupFixedNgn === 'number') {
      return { markup: service.customMarkupFixedNgn, source: 'custom' };
    }

    // 2. Category markup
    const cat = getCategoryKey(service);
    const catMarkup = getCategoryCurrentMarkup(cat);
    let catAmount = catMarkup.fixed;
    if (catMarkup.percent > 0) {
      catAmount += Math.round(service.providerRatePer1000 * (catMarkup.percent / 100));
    }
    if (catAmount > 0) {
      return { markup: catAmount, source: 'category' };
    }

    // 3. Global markup
    if (pendingGlobalMarkup > 0) {
      return { markup: pendingGlobalMarkup, source: 'global' };
    }
    if (pendingGlobalPercent > 0) {
      return { markup: Math.round(service.providerRatePer1000 * (pendingGlobalPercent / 100)), source: 'global' };
    }

    return { markup: 0, source: 'global' };
  };

  const handleServiceMarkupChange = (serviceId: string, val: string) => {
    if (val === '') {
      setPendingServiceMarkups(prev => ({ ...prev, [serviceId]: null }));
      return;
    }
    const num = Math.max(0, Math.round(Number(val)));
    if (!isNaN(num)) {
      setPendingServiceMarkups(prev => ({ ...prev, [serviceId]: num }));
    }
  };

  const handleServiceDelta = (service: VoikerServicePricingItem, delta: number) => {
    const effective = getEffectiveServiceMarkup(service);
    const newVal = Math.max(0, effective.markup + delta);
    setPendingServiceMarkups(prev => ({ ...prev, [service.id]: newVal }));
  };

  const handleResetServiceToCategory = (serviceId: string) => {
    setPendingServiceMarkups(prev => ({ ...prev, [serviceId]: null }));
  };

  const handleSaveSingleService = async (service: VoikerServicePricingItem) => {
    const markupVal = pendingServiceMarkups[service.id];
    setSavingServiceId(service.id);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res: any = await safeApiFetch('/api/voiker/save-markup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          serviceId: service.id,
          customMarkupFixedNgn: markupVal === null ? null : markupVal
        })
      });

      if (res && res.success) {
        setSavedSuccessMap(prev => ({ ...prev, [service.id]: true }));
        setTimeout(() => {
          setSavedSuccessMap(prev => ({ ...prev, [service.id]: false }));
        }, 2500);
        showNotification(`Price updated for "${service.name.slice(0, 30)}..."`);
        if (onPriceChangeApplied) onPriceChangeApplied();
      } else {
        throw new Error(res?.error || 'Failed to save individual markup');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error saving service price', 'error');
    } finally {
      setSavingServiceId(null);
    }
  };

  // --------------------------------------------------------------------------
  // SAVE ALL PENDING CHANGES (CATEGORIES, GLOBAL, SERVICES) TO FIRESTORE
  // --------------------------------------------------------------------------
  const hasUnsavedChanges = useMemo(() => {
    if (pendingGlobalMarkup !== globalDefaultMarkup) return true;
    if (pendingGlobalPercent !== globalMarkupPercent) return true;

    for (const [key, val] of Object.entries(pendingCategoryMarkups)) {
      const orig = categoryMarkups[key] || { markupFixedNgn: 0, markupPercent: 0 };
      if (val.markupFixedNgn !== orig.markupFixedNgn || val.markupPercent !== orig.markupPercent) {
        return true;
      }
    }

    if (Object.keys(pendingServiceMarkups).length > 0) return true;

    return false;
  }, [pendingGlobalMarkup, globalDefaultMarkup, pendingGlobalPercent, globalMarkupPercent, pendingCategoryMarkups, categoryMarkups, pendingServiceMarkups]);

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const payload: any = {
        defaultMarkupFixedNgn: pendingGlobalMarkup,
        defaultMarkupPercent: pendingGlobalPercent,
        categoryMarkups: pendingCategoryMarkups,
        markups: pendingServiceMarkups
      };

      const res: any = await safeApiFetch('/api/voiker/save-bulk-markups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setGlobalDefaultMarkup(pendingGlobalMarkup);
        setGlobalMarkupPercent(pendingGlobalPercent);
        setCategoryMarkups({ ...pendingCategoryMarkups });
        setPendingServiceMarkups({});
        showNotification('All pricing settings and category markups permanently saved to database!');
        await loadData(true);
        if (onPriceChangeApplied) onPriceChangeApplied();
      } else {
        throw new Error(res?.error || 'Failed to save pricing changes to database.');
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to save changes. Please try again.', 'error');
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDiscardChanges = () => {
    setPendingGlobalMarkup(globalDefaultMarkup);
    setPendingGlobalPercent(globalMarkupPercent);
    setPendingCategoryMarkups({ ...categoryMarkups });
    setPendingServiceMarkups({});
    showNotification('All unsaved edits have been discarded.');
  };

  // --------------------------------------------------------------------------
  // FILTERED SERVICES FOR INDIVIDUAL TAB
  // --------------------------------------------------------------------------
  const filteredServices = useMemo(() => {
    return services.filter(svc => {
      if (selectedPlatform !== 'All' && svc.platform !== selectedPlatform) return false;

      if (selectedCategoryFilter !== 'All') {
        const cat = getCategoryKey(svc);
        if (cat !== selectedCategoryFilter) return false;
      }

      if (markupStatusFilter === 'custom' && !svc.hasCustomMarkup && pendingServiceMarkups[svc.id] === undefined) {
        return false;
      }
      if (markupStatusFilter === 'default' && (svc.hasCustomMarkup || typeof pendingServiceMarkups[svc.id] === 'number')) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (svc.name || '').toLowerCase().includes(q);
        const matchesId = (svc.id || '').toLowerCase().includes(q) || (svc.providerServiceId || '').toLowerCase().includes(q);
        const matchesPlat = (svc.platform || '').toLowerCase().includes(q);
        const matchesCat = (svc.category || '').toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesPlat && !matchesCat) return false;
      }

      return true;
    });
  }, [services, selectedPlatform, selectedCategoryFilter, markupStatusFilter, searchQuery, pendingServiceMarkups, getCategoryKey]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, currentPage, pageSize]);

  return (
    <div className="w-full h-full flex flex-col bg-[#FAF8FE] text-[#0F172A] overflow-hidden min-h-0">
      
      {/* 1. TOP HEADER (PURPLE & WHITE THEME) */}
      <header className="bg-white border-b border-[#E9E2FA] px-3 sm:px-6 py-3.5 shrink-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          
          {/* Left: Back / Title / Badges */}
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E9E2FA] bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#7C3AED] hover:text-[#5B21B6] text-xs font-black transition cursor-pointer active:scale-95 shrink-0"
                title="Return to Social Boost"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Social Boost</span>
              </button>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-[#7C3AED] text-[10px] font-black uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Owner Pricing Engine</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Voika Provider Connected</span>
                </span>
              </div>
              <h1 className="text-base sm:text-xl font-black text-[#0F172A] tracking-tight mt-0.5">
                Social Boost Markup & Pricing Settings
              </h1>
            </div>
          </div>

          {/* Right: Live Exchange Rate & Main Save Button */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap ml-auto">
            
            {/* Live Exchange Rate Pill */}
            <div className="bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-2xs">
              <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <div className="text-[9px] uppercase font-bold text-[#64748B] flex items-center gap-1">
                  <span>Live USD/NGN Rate</span>
                </div>
                <div className="text-xs sm:text-sm font-black text-[#0F172A]">
                  ₦{liveRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-[10px] text-purple-600 font-semibold ml-1">/ $1 USD</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefreshExchangeRate}
                disabled={isRefreshingRate}
                title="Refresh live rate from exchange rate API"
                className="p-1 text-[#64748B] hover:text-[#7C3AED] transition cursor-pointer disabled:opacity-50 active:scale-95 ml-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRate ? 'animate-spin text-[#7C3AED]' : ''}`} />
              </button>
            </div>

            {/* Save All Changes Button */}
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSavingAll || !hasUnsavedChanges}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer active:scale-95 ${
                hasUnsavedChanges
                  ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white ring-2 ring-purple-300 animate-pulse'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              {isSavingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                  {hasUnsavedChanges && (
                    <span className="w-2 h-2 rounded-full bg-amber-300" />
                  )}
                </>
              )}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-[#94A3B8] hover:text-[#0F172A] hover:bg-neutral-100 rounded-xl transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

        </div>

        {/* 2. NAVIGATION TABS */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 mt-3 border-t border-[#F1F5F9] pt-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-[#7C3AED] text-white shadow-2xs'
                : 'bg-[#FAF8FE] text-[#64748B] hover:text-[#0F172A] hover:bg-[#EDE9FE]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Category Pricing Controls</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'categories' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-[#7C3AED]'}`}>
              Followers, Views, Likes...
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'global'
                ? 'bg-[#7C3AED] text-white shadow-2xs'
                : 'bg-[#FAF8FE] text-[#64748B] hover:text-[#0F172A] hover:bg-[#EDE9FE]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Global Default Markup</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'global' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-[#7C3AED]'}`}>
              +₦{pendingGlobalMarkup.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'services'
                ? 'bg-[#7C3AED] text-white shadow-2xs'
                : 'bg-[#FAF8FE] text-[#64748B] hover:text-[#0F172A] hover:bg-[#EDE9FE]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Individual Services ({services.length.toLocaleString()})</span>
            {Object.keys(pendingServiceMarkups).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* TOAST NOTIFICATION BANNER */}
      {notification && (
        <div className={`p-3 px-4 flex items-center justify-between text-xs font-bold transition-all shadow-xs shrink-0 ${
          notification.type === 'success'
            ? 'bg-emerald-500 text-white'
            : 'bg-rose-500 text-white'
        }`}>
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.text}</span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="ml-auto text-white/80 hover:text-white cursor-pointer px-1 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. MAIN CONTENT AREA (Dedicated vertical scroll container with generous bottom clearance) */}
      <main 
        className="flex-1 overflow-y-auto overscroll-contain w-full p-3 sm:p-6 pb-56 sm:pb-48"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-7xl mx-auto space-y-6">

          {/* LOADING STATE */}
          {isLoading && (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#E9E2FA] shadow-xs space-y-3">
              <RefreshCw className="w-8 h-8 text-[#7C3AED] animate-spin mx-auto" />
              <h3 className="text-sm font-black text-[#0F172A]">Loading Social Boost Services Catalogue...</h3>
              <p className="text-xs text-[#64748B]">Connecting to Voika wholesale API and financial exchange rate feed.</p>
            </div>
          )}

          {/* ERROR STATE */}
          {error && !isLoading && (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Unable to load pricing data</span>
              </div>
              <p className="text-xs">{error}</p>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="mt-2 px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 1: CATEGORY PRICING CONTROLS (STAR FEATURE)                 */}
          {/* ================================================================ */}
          {!isLoading && activeTab === 'categories' && (
            <div className="space-y-4">
              
              {/* Informative Header Banner */}
              <div className="bg-white border border-[#E9E2FA] rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                    <h2 className="text-sm sm:text-base font-black text-[#0F172A]">
                      Category Price Increase & Decrease Controls
                    </h2>
                  </div>
                  <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed">
                    Set targeted profit markups for each engagement type. Use the <strong>+</strong> and <strong>−</strong> buttons to adjust your profit margin in Naira. The selling price and profit automatically update in real-time.
                  </p>
                </div>
                
                {/* Live Formula Callout matching User's Exact Example */}
                <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 shrink-0 text-left">
                  <div className="text-[10px] uppercase font-bold text-purple-700">Live Formula Calculation</div>
                  <div className="text-xs font-mono font-bold text-[#0F172A] mt-0.5">
                    Provider Cost + Your Markup = Customer Selling Price
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    e.g. ₦500 wholesale + ₦200 markup = <strong>₦700</strong> customer pays
                  </div>
                </div>
              </div>

              {/* Grid of Categories */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {STANDARD_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const stats = categoryStats[cat.key] || { count: 0, avgProviderRate: 500 };
                  const { fixed, percent } = getCategoryCurrentMarkup(cat.key);
                  const sampleProviderCost = stats.avgProviderRate > 0 ? stats.avgProviderRate : 500;
                  
                  // Live Calculation for Example / Preview
                  const sampleMarkupFromPercent = percent > 0 ? Math.round(sampleProviderCost * (percent / 100)) : 0;
                  const totalSampleMarkup = fixed + sampleMarkupFromPercent;
                  const sampleSellingPrice = sampleProviderCost + totalSampleMarkup;

                  return (
                    <div 
                      key={cat.key}
                      className="bg-white border border-[#E9E2FA] rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-[#7C3AED]/40 transition space-y-4 flex flex-col justify-between"
                    >
                      {/* Card Header */}
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-xl ${cat.bg} ${cat.border} border flex items-center justify-center shrink-0`}>
                              <Icon className={`w-5 h-5 ${cat.color}`} />
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-[#0F172A]">{cat.label}</h3>
                              <span className="text-[10px] text-[#64748B] font-bold">
                                {stats.count.toLocaleString()} services
                              </span>
                            </div>
                          </div>

                          {/* Reset to ₦0 */}
                          {(fixed > 0 || percent > 0) && (
                            <button
                              type="button"
                              onClick={() => handleCategoryReset(cat.key)}
                              className="text-[10px] font-bold text-[#64748B] hover:text-rose-600 flex items-center gap-0.5 px-2 py-1 rounded-md hover:bg-rose-50 transition cursor-pointer"
                              title="Reset markup to ₦0"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                          )}
                        </div>

                        {/* LIVE CALCULATION DISPLAY BOX */}
                        <div className="mt-3.5 p-3 rounded-xl bg-[#FAF8FE] border border-[#E9E2FA] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#64748B] font-medium">Voika Provider Cost:</span>
                            <span className="font-bold text-[#0F172A]">~₦{sampleProviderCost.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#64748B] font-medium">Your Profit Markup:</span>
                            <span className="font-black text-[#7C3AED]">
                              +₦{totalSampleMarkup.toLocaleString()}
                              {percent > 0 && <span className="text-[10px] font-normal text-purple-600 ml-1">({percent}%)</span>}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#E9E2FA]">
                            <span className="font-black text-[#0F172A]">Customer Selling Price:</span>
                            <span className="font-black text-sm text-emerald-600">
                              ₦{sampleSellingPrice.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CONTROLS: INCREASE & DECREASE BUTTONS */}
                      <div className="space-y-3 pt-2">
                        
                        {/* 1. Quick Step Buttons: Decrease & Increase */}
                        <div>
                          <label className="text-[10px] font-black uppercase text-[#64748B] tracking-wider block mb-1.5">
                            Quick Price Adjuster (₦ / 1k)
                          </label>
                          <div className="grid grid-cols-6 gap-1">
                            <button
                              type="button"
                              onClick={() => handleCategoryMarkupChange(cat.key, -500)}
                              className="py-1 px-1 bg-[#FAF8FE] hover:bg-rose-50 hover:text-rose-700 text-[#475569] border border-[#E9E2FA] rounded-lg text-[10px] font-extrabold transition cursor-pointer active:scale-95"
                              title="Decrease by ₦500"
                            >
                              -500
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCategoryMarkupChange(cat.key, -100)}
                              className="py-1 px-1 bg-[#FAF8FE] hover:bg-rose-50 hover:text-rose-700 text-[#475569] border border-[#E9E2FA] rounded-lg text-[10px] font-extrabold transition cursor-pointer active:scale-95"
                              title="Decrease by ₦100"
                            >
                              -100
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCategoryMarkupChange(cat.key, -50)}
                              className="py-1 px-1 bg-[#FAF8FE] hover:bg-rose-50 hover:text-rose-700 text-[#475569] border border-[#E9E2FA] rounded-lg text-[10px] font-extrabold transition cursor-pointer active:scale-95"
                              title="Decrease by ₦50"
                            >
                              -50
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCategoryMarkupChange(cat.key, 50)}
                              className="py-1 px-1 bg-[#FAF8FE] hover:bg-purple-100 hover:text-[#7C3AED] text-[#475569] border border-[#E9E2FA] rounded-lg text-[10px] font-extrabold transition cursor-pointer active:scale-95"
                              title="Increase by ₦50"
                            >
                              +50
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCategoryMarkupChange(cat.key, 100)}
                              className="py-1 px-1 bg-[#FAF8FE] hover:bg-purple-100 hover:text-[#7C3AED] text-[#475569] border border-[#E9E2FA] rounded-lg text-[10px] font-extrabold transition cursor-pointer active:scale-95"
                              title="Increase by ₦100"
                            >
                              +100
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCategoryMarkupChange(cat.key, 500)}
                              className="py-1 px-1 bg-[#FAF8FE] hover:bg-purple-100 hover:text-[#7C3AED] text-[#475569] border border-[#E9E2FA] rounded-lg text-[10px] font-extrabold transition cursor-pointer active:scale-95"
                              title="Increase by ₦500"
                            >
                              +500
                            </button>
                          </div>
                        </div>

                        {/* 2. Direct Naira Input Box with Step Arrows */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[#475569] block mb-1">
                              Fixed Markup (₦ / 1k)
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-2.5 text-xs font-bold text-[#64748B]">₦</span>
                              <input
                                type="number"
                                min="0"
                                step="10"
                                value={fixed === 0 ? '' : fixed}
                                onChange={(e) => handleCategoryFixedInput(cat.key, e.target.value)}
                                placeholder="0"
                                className="w-full bg-[#FAF8FE] border border-[#E9E2FA] focus:border-[#7C3AED] focus:bg-white rounded-xl pl-6 pr-2 py-1.5 text-xs font-bold text-[#0F172A] outline-hidden transition"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-[#475569] block mb-1">
                              Percentage Markup (%)
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="300"
                                value={percent === 0 ? '' : percent}
                                onChange={(e) => handleCategoryPercentInput(cat.key, e.target.value)}
                                placeholder="0%"
                                className="w-full bg-[#FAF8FE] border border-[#E9E2FA] focus:border-[#7C3AED] focus:bg-white rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#0F172A] outline-hidden transition"
                              />
                              <span className="absolute right-2.5 text-xs font-bold text-[#64748B]">%</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: GLOBAL DEFAULT MARKUP                                    */}
          {/* ================================================================ */}
          {!isLoading && activeTab === 'global' && (
            <div className="max-w-2xl mx-auto space-y-5">
              
              <div className="bg-white border border-[#E9E2FA] rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-50 text-[#7C3AED] text-xs font-bold mb-2">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Universal Storewide Default</span>
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-[#0F172A]">
                    Global Social Boost Default Markup
                  </h2>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    This profit margin is applied as a baseline fallback for any service that has no individual or category-specific markup.
                  </p>
                </div>

                {/* Live Simulation Card */}
                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2.5">
                  <div className="text-xs font-bold text-purple-900 uppercase tracking-wide">
                    Live Price Demonstration
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-[#64748B] block font-medium">Provider Cost</span>
                      <span className="text-sm font-black text-[#0F172A]">₦500</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-[#64748B] block font-medium">Global Markup</span>
                      <span className="text-sm font-black text-[#7C3AED]">
                        +₦{pendingGlobalMarkup.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-[#64748B] block font-medium">Customer Pays</span>
                      <span className="text-sm font-black text-emerald-600">
                        ₦{(500 + pendingGlobalMarkup).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Adjuster Buttons */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-[#0F172A] block mb-2">
                      Increase / Decrease Global Markup
                    </label>
                    <div className="grid grid-cols-6 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleGlobalDelta(-500)}
                        className="py-2 bg-[#FAF8FE] hover:bg-rose-50 hover:text-rose-700 text-[#0F172A] border border-[#E9E2FA] rounded-xl text-xs font-black transition cursor-pointer active:scale-95"
                      >
                        -500
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGlobalDelta(-100)}
                        className="py-2 bg-[#FAF8FE] hover:bg-rose-50 hover:text-rose-700 text-[#0F172A] border border-[#E9E2FA] rounded-xl text-xs font-black transition cursor-pointer active:scale-95"
                      >
                        -100
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGlobalDelta(-50)}
                        className="py-2 bg-[#FAF8FE] hover:bg-rose-50 hover:text-rose-700 text-[#0F172A] border border-[#E9E2FA] rounded-xl text-xs font-black transition cursor-pointer active:scale-95"
                      >
                        -50
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGlobalDelta(50)}
                        className="py-2 bg-[#FAF8FE] hover:bg-purple-100 hover:text-[#7C3AED] text-[#0F172A] border border-[#E9E2FA] rounded-xl text-xs font-black transition cursor-pointer active:scale-95"
                      >
                        +50
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGlobalDelta(100)}
                        className="py-2 bg-[#FAF8FE] hover:bg-purple-100 hover:text-[#7C3AED] text-[#0F172A] border border-[#E9E2FA] rounded-xl text-xs font-black transition cursor-pointer active:scale-95"
                      >
                        +100
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGlobalDelta(500)}
                        className="py-2 bg-[#FAF8FE] hover:bg-purple-100 hover:text-[#7C3AED] text-[#0F172A] border border-[#E9E2FA] rounded-xl text-xs font-black transition cursor-pointer active:scale-95"
                      >
                        +500
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[#475569] block mb-1">
                        Specific Markup (₦ in Naira / 1k)
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-sm font-bold text-[#64748B]">₦</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={pendingGlobalMarkup === 0 ? '' : pendingGlobalMarkup}
                          onChange={(e) => setPendingGlobalMarkup(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                          placeholder="0"
                          className="w-full bg-[#FAF8FE] border border-[#E9E2FA] focus:border-[#7C3AED] focus:bg-white rounded-xl pl-8 pr-3 py-2 text-sm font-bold text-[#0F172A] outline-hidden transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#475569] block mb-1">
                        Percentage Markup (% Fallback)
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={pendingGlobalPercent === 0 ? '' : pendingGlobalPercent}
                          onChange={(e) => setPendingGlobalPercent(Math.max(0, Math.min(300, Math.round(Number(e.target.value) || 0))))}
                          placeholder="0%"
                          className="w-full bg-[#FAF8FE] border border-[#E9E2FA] focus:border-[#7C3AED] focus:bg-white rounded-xl px-3 py-2 text-sm font-bold text-[#0F172A] outline-hidden transition"
                        />
                        <span className="absolute right-3 text-sm font-bold text-[#64748B]">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingGlobalMarkup(0);
                        setPendingGlobalPercent(0);
                      }}
                      className="text-xs font-bold text-[#64748B] hover:text-rose-600 transition cursor-pointer"
                    >
                      Reset Global Markup to ₦0
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveAll}
                      disabled={isSavingAll || !hasUnsavedChanges}
                      className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
                    >
                      Save Global Markup
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: INDIVIDUAL SERVICES (1,775+ VOIKA SERVICES)              */}
          {/* ================================================================ */}
          {!isLoading && activeTab === 'services' && (
            <div className="space-y-4">
              
              {/* Filter & Search Bar */}
              <div className="bg-white border border-[#E9E2FA] rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search by service name, ID, platform or category..."
                      className="w-full bg-[#FAF8FE] border border-[#E9E2FA] focus:border-[#7C3AED] focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[#0F172A] outline-hidden transition"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    {/* Platform Selector */}
                    <select
                      value={selectedPlatform}
                      onChange={(e) => {
                        setSelectedPlatform(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] cursor-pointer"
                    >
                      <option value="All">All Platforms</option>
                      {platforms.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    {/* Category Selector */}
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => {
                        setSelectedCategoryFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] cursor-pointer"
                    >
                      <option value="All">All Categories</option>
                      {STANDARD_CATEGORIES.map(c => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>

                    {/* Status Filter */}
                    <select
                      value={markupStatusFilter}
                      onChange={(e: any) => {
                        setMarkupStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] cursor-pointer"
                    >
                      <option value="all">All Markups</option>
                      <option value="custom">Custom Overrides Only</option>
                      <option value="default">Default / Category Only</option>
                    </select>
                  </div>
                </div>

                {/* Results Count & Quick Stats */}
                <div className="flex items-center justify-between text-xs text-[#64748B] pt-1 border-t border-[#F1F5F9]">
                  <span>Showing <strong>{filteredServices.length.toLocaleString()}</strong> services</span>
                  <span>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
                </div>
              </div>

              {/* Services List / Table */}
              <div className="bg-white border border-[#E9E2FA] rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF8FE] border-b border-[#E9E2FA] text-[10px] font-black uppercase text-[#64748B] tracking-wider">
                        <th className="py-3 px-4">Service & Platform</th>
                        <th className="py-3 px-3 text-right">Voika Wholesale (USD)</th>
                        <th className="py-3 px-3 text-right">Provider Cost (NGN)</th>
                        <th className="py-3 px-3 text-center">Your Markup (₦)</th>
                        <th className="py-3 px-3 text-right">Selling Price</th>
                        <th className="py-3 px-3 text-right">Your Profit</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {paginatedServices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[#64748B]">
                            No services match your filters. Try clearing search or platform filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedServices.map((svc) => {
                          const effective = getEffectiveServiceMarkup(svc);
                          const currentPending = pendingServiceMarkups[svc.id];
                          const hasEdit = currentPending !== undefined;
                          const effectiveMarkup = effective.markup;
                          const finalSellingPrice = svc.providerRatePer1000 + effectiveMarkup;
                          const isSaving = savingServiceId === svc.id;
                          const isSuccess = savedSuccessMap[svc.id];

                          return (
                            <tr key={svc.id} className="hover:bg-[#FAF8FE] transition">
                              
                              {/* Service Info */}
                              <td className="py-3 px-4 max-w-xs">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-extrabold text-[9px]">
                                    {svc.platform}
                                  </span>
                                  <span className="text-[10px] font-mono text-[#94A3B8]">#{svc.providerServiceId || svc.id}</span>
                                </div>
                                <div className="font-bold text-[#0F172A] truncate" title={svc.name}>
                                  {svc.name}
                                </div>
                                <span className="text-[10px] text-[#64748B]">
                                  Min: {svc.min.toLocaleString()} • Max: {svc.max.toLocaleString()}
                                </span>
                              </td>

                              {/* Voika USD */}
                              <td className="py-3 px-3 text-right font-mono text-[#64748B] whitespace-nowrap">
                                ${svc.rateUsd?.toFixed(4) || '0.0000'}
                              </td>

                              {/* Converted NGN Provider Cost */}
                              <td className="py-3 px-3 text-right font-bold text-[#0F172A] whitespace-nowrap">
                                ₦{svc.providerRatePer1000?.toLocaleString()}
                              </td>

                              {/* Markup Controls */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleServiceDelta(svc, -50)}
                                    className="p-1 rounded bg-[#FAF8FE] hover:bg-rose-50 text-[#64748B] hover:text-rose-600 border border-[#E9E2FA] transition cursor-pointer"
                                    title="Decrease by ₦50"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  
                                  <div className="relative flex items-center">
                                    <span className="absolute left-1.5 text-[10px] font-bold text-[#64748B]">₦</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={effectiveMarkup === 0 ? '' : effectiveMarkup}
                                      onChange={(e) => handleServiceMarkupChange(svc.id, e.target.value)}
                                      placeholder="0"
                                      className={`w-20 rounded-lg pl-4 pr-1.5 py-1 text-xs font-bold text-center border outline-hidden transition ${
                                        hasEdit
                                          ? 'border-purple-500 bg-purple-50 text-[#7C3AED]'
                                          : effective.source === 'custom'
                                            ? 'border-amber-300 bg-amber-50/60 text-amber-900'
                                            : 'border-[#E9E2FA] bg-[#FAF8FE] text-[#0F172A]'
                                      }`}
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleServiceDelta(svc, 50)}
                                    className="p-1 rounded bg-[#FAF8FE] hover:bg-purple-100 text-[#64748B] hover:text-[#7C3AED] border border-[#E9E2FA] transition cursor-pointer"
                                    title="Increase by ₦50"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="text-[9px] text-[#94A3B8] mt-0.5">
                                  {effective.source === 'custom' ? (
                                    <span className="text-amber-700 font-bold">Custom Override</span>
                                  ) : effective.source === 'category' ? (
                                    <span>Category Rule</span>
                                  ) : (
                                    <span>Global Default</span>
                                  )}
                                </div>
                              </td>

                              {/* Customer Selling Price */}
                              <td className="py-3 px-3 text-right font-black text-sm text-[#7C3AED] whitespace-nowrap">
                                ₦{finalSellingPrice.toLocaleString()}
                              </td>

                              {/* Your Profit */}
                              <td className="py-3 px-3 text-right font-black text-xs text-emerald-600 whitespace-nowrap">
                                +₦{effectiveMarkup.toLocaleString()}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveSingleService(svc)}
                                    disabled={isSaving}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer flex items-center gap-1 ${
                                      isSuccess
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white active:scale-95'
                                    }`}
                                    title="Save markup for this service"
                                  >
                                    {isSuccess ? (
                                      <>
                                        <Check className="w-3 h-3" />
                                        <span>Saved</span>
                                      </>
                                    ) : isSaving ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <span>Save</span>
                                    )}
                                  </button>

                                  {(svc.hasCustomMarkup || hasEdit) && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetServiceToCategory(svc.id)}
                                      className="p-1 text-[#94A3B8] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                      title="Reset to category markup"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="p-3 bg-[#FAF8FE] border-t border-[#E9E2FA] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-[#E9E2FA] bg-white text-xs font-bold text-[#0F172A] hover:bg-[#FAF8FE] disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </button>

                    <span className="text-xs font-bold text-[#64748B]">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-[#E9E2FA] bg-white text-xs font-bold text-[#0F172A] hover:bg-[#FAF8FE] disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </main>

      {/* 4. FLOATING / FIXED BOTTOM ACTION BAR FOR UNSAVED CHANGES */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E9E2FA] p-3 sm:p-4 shadow-xl animate-in slide-in-from-bottom duration-150">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span className="text-xs font-black text-[#0F172A]">
                You have unsaved pricing markup changes
              </span>
              <span className="text-[11px] text-[#64748B] hidden sm:inline">
                Click "Save All Changes" to permanently persist and update live customer prices.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="px-3 py-1.5 border border-[#E9E2FA] bg-[#FAF8FE] hover:bg-neutral-100 text-[#64748B] rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
              >
                Discard Edits
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSavingAll}
                className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
              >
                {isSavingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving to Firestore...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save All Changes (Permanent)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default SocialBoostPricingManager;
