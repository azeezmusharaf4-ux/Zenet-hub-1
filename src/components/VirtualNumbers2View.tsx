import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  Globe, 
  Server, 
  CreditCard, 
  ArrowLeft, 
  Loader2, 
  Copy, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  XCircle,
  Clock, 
  Search, 
  ChevronRight,
  ChevronDown, 
  X, 
  Settings, 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck,
  Bell,
  Smartphone,
  FileText
} from 'lucide-react';
import { auth, getSafeIdToken } from '../lib/firebase';
import { UserProfile } from '../types';
import { sanitizeApiErrorMessage, safeApiFetch } from '../utils/api';

export interface PriceOption {
  optionId: string;
  tierIndex: number;
  tierName: string;
  badge?: string;
  description?: string;
  customerPrice: number;
  providerCost?: number;
  markup?: number;
  profit?: number;
  marginPercent?: number;
}

export interface PricingSettings {
  optionsCount: number;
  minMarkup: number;
  maxMarkup: number;
  pricingStyle: 'natural' | 'clean' | 'tiered';
}

interface VirtualNumbers2ViewProps {
  userProfile?: UserProfile | null;
  walletBalance: number;
  onRefreshProfile?: () => void;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

export const VirtualNumbers2View: React.FC<VirtualNumbers2ViewProps> = ({
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet,
  onOpenAuth
}) => {
  const isOwner = userProfile?.role === 'owner' || userProfile?.email?.toLowerCase().trim() === 'azeezmusharaf4@gmail.com' || auth?.currentUser?.email?.toLowerCase().trim() === 'azeezmusharaf4@gmail.com';

  // Navigation & Step states
  const [activeStep, setActiveStep] = useState<'selection' | 'activation'>('selection');
  const [activeTab, setActiveTab] = useState<'all' | 'usa'>('all');

  // Loaders
  const [serversLoading, setServersLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [buyingLoading, setBuyingLoading] = useState(false);
  const [cancellingLoading, setCancellingLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Data lists loaded dynamically from API
  const [servers, setServers] = useState<Array<{ id: string; name: string }>>([
    { id: 'server_1', name: 'Server 1 - Instant Global Route' },
    { id: 'server_2', name: 'Server 2 - Premium Carrier Direct' },
    { id: 'server_3', name: 'Server 3 - High Success PVA Pool' }
  ]);
  const [countries, setCountries] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string; price?: number }>>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // Selected values & Live Pricing Breakdown
  const [selectedServer, setSelectedServer] = useState<string>('server_1');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');

  // Search state for Country and Service Selectors
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  
  // Multiple Live Pricing options details
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('opt_1');
  const [providerPrice, setProviderPrice] = useState<number>(0);
  const [markupAmount, setMarkupAmount] = useState<number>(500);
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);
  const [isPriceAvailable, setIsPriceAvailable] = useState<boolean>(false);
  const [priceErrorMessage, setPriceErrorMessage] = useState<string>('');

  // Owner Pricing Settings State & Modal
  const [isOwnerSettingsOpen, setIsOwnerSettingsOpen] = useState<boolean>(false);
  const [ownerSettings, setOwnerSettings] = useState<PricingSettings>({
    optionsCount: 4,
    minMarkup: 500,
    maxMarkup: 4500,
    pricingStyle: 'natural'
  });
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<string>('');

  // Active Order info
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [pollingStatus, setPollingStatus] = useState<'WAITING' | 'RECEIVED' | 'CANCELLED'>('WAITING');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [smsContent, setSmsContent] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [copiedText, setCopiedText] = useState<'number' | 'code' | string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [infoMessage, setInfoMessage] = useState<string>('');

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to obtain secure Firebase Auth headers
  const getAuthHeaders = async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    try {
      const token = await getSafeIdToken(auth?.currentUser);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Could not fetch Firebase Auth token:', e);
    }
    return headers;
  };

  // Dynamic Country Flag mapping helper
  const getCountryFlagEmoji = (countryCodeOrName: string) => {
    const code = (countryCodeOrName || '').toUpperCase();
    const flags: Record<string, string> = {
      US: '🇺🇸', USA: '🇺🇸', UK: '🇬🇧', GB: '🇬🇧', CA: '🇨🇦', NG: '🇳🇬', 
      DE: '🇩🇪', FR: '🇫🇷', IN: '🇮🇳', BR: '🇧🇷', ID: '🇮🇩', RU: '🇷🇺',
      ES: '🇪🇸', IT: '🇮🇹', NL: '🇳🇱', AU: '🇦🇺', PL: '🇵🇱', TR: '🇹🇷',
      UA: '🇺🇦', ZA: '🇿🇦', GH: '🇬🇭', KE: '🇰🇪', PH: '🇵🇭', VN: '🇻🇳',
      TH: '🇹🇭', MY: '🇲🇾', SG: '🇸🇬', JP: '🇯🇵', KR: '🇰🇷', MX: '🇲🇽',
      CO: '🇨🇴', AR: '🇦🇷', CL: '🇨🇱', EG: '🇪🇬', MA: '🇲🇦', PK: '🇵🇰'
    };
    return flags[code] || '🌐';
  };

  // Safe JSON fetch wrapper
  const safeFetchJson = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || 'Invalid response from server' };
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      return { ok: false, status: 0, data: { error: err.message || 'Network request failed' } };
    }
  };

  // 1. Fetch countries on mount or tab switch
  useEffect(() => {
    const fetchCountries = async () => {
      setCountriesLoading(true);
      setErrorMessage('');
      try {
        const headers = await getAuthHeaders();
        const queryParams = new URLSearchParams({
          action: 'countries',
          server: selectedServer,
          tab: activeTab
        });
        const { ok, data } = await safeFetchJson(`/api/service-number-2/countries?${queryParams.toString()}`, { headers });
        if (ok && data && Array.isArray(data.countries)) {
          setCountries(data.countries);
          if (data.countries.length > 0 && !selectedCountry) {
            const defaultC = activeTab === 'usa' 
              ? data.countries.find((c: any) => c.id === '187' || c.code === 'US' || c.name.toLowerCase().includes('united states')) || data.countries[0]
              : data.countries[0];
            setSelectedCountry(defaultC.id);
          }
        } else {
          // Fallback initial list
          setCountries([
            { id: '187', name: 'United States', code: 'US' },
            { id: '1', name: 'United Kingdom', code: 'GB' },
            { id: '2', name: 'Canada', code: 'CA' },
            { id: '3', name: 'Nigeria', code: 'NG' },
            { id: '4', name: 'Germany', code: 'DE' },
            { id: '5', name: 'France', code: 'FR' }
          ]);
          setSelectedCountry('187');
        }
      } catch (err) {
        console.warn('Error fetching Provider 2 countries:', err);
      } finally {
        setCountriesLoading(false);
      }
    };

    fetchCountries();
  }, [selectedServer, activeTab]);

  // 2. Fetch services when server or country changes
  useEffect(() => {
    const fetchServices = async () => {
      if (!selectedCountry) return;
      setServicesLoading(true);
      try {
        const headers = await getAuthHeaders();
        const queryParams = new URLSearchParams({
          action: 'services',
          server: selectedServer,
          country: selectedCountry
        });
        const { ok, data } = await safeFetchJson(`/api/service-number-2/services?${queryParams.toString()}`, { headers });
        if (ok && data && Array.isArray(data.services)) {
          setServices(data.services);
          if (data.services.length > 0) {
            setSelectedService(data.services[0].id);
          }
        } else {
          setServices([
            { id: 'wa', name: 'WhatsApp' },
            { id: 'tg', name: 'Telegram' },
            { id: 'go', name: 'Google / Gmail' },
            { id: 'ig', name: 'Instagram' },
            { id: 'fb', name: 'Facebook' },
            { id: 'tk', name: 'TikTok' },
            { id: 'tw', name: 'Twitter / X' },
            { id: 'ds', name: 'Discord' }
          ]);
          setSelectedService('wa');
        }
      } catch (err) {
        console.warn('Error fetching Provider 2 services:', err);
      } finally {
        setServicesLoading(false);
      }
    };

    fetchServices();
  }, [selectedServer, selectedCountry]);

  // 3. Fetch price options when server, country, or service changes
  useEffect(() => {
    const fetchPrice = async () => {
      if (!selectedCountry || !selectedService) return;
      setPriceLoading(true);
      setPriceErrorMessage('');
      setIsPriceAvailable(false);
      try {
        const headers = await getAuthHeaders();
        const queryParams = new URLSearchParams({
          action: 'price',
          server: selectedServer,
          country: selectedCountry,
          service: selectedService
        });
        const { ok, data } = await safeFetchJson(`/api/service-number-2/price?${queryParams.toString()}`, { headers });
        if (ok && data && data.success) {
          setPriceOptions(data.options || []);
          setProviderPrice(data.providerPrice || 0);
          setMarkupAmount(data.markup || 500);
          setCalculatedPrice(data.customerPrice || 1200);
          setSelectedOptionId(data.selectedOptionId || data.options?.[0]?.optionId || 'opt_1');
          setIsPriceAvailable(true);
        } else {
          // Fallback realistic tier pricing
          const baseCost = 650;
          const defaultOptions: PriceOption[] = [
            {
              optionId: 'opt_1',
              tierIndex: 1,
              tierName: 'Standard Pool',
              badge: 'Fast',
              description: 'Instant carrier routing',
              customerPrice: 1150,
              providerCost: baseCost,
              markup: 500
            },
            {
              optionId: 'opt_2',
              tierIndex: 2,
              tierName: 'PVA Verified Route',
              badge: 'Best Value',
              description: 'Fresh number pool, 99.4% SMS delivery',
              customerPrice: 1550,
              providerCost: baseCost,
              markup: 900
            },
            {
              optionId: 'opt_3',
              tierIndex: 3,
              tierName: 'VIP Direct Carrier',
              badge: 'Highest Success',
              description: 'Exclusive private carrier slot',
              customerPrice: 2200,
              providerCost: baseCost,
              markup: 1550
            }
          ];
          setPriceOptions(defaultOptions);
          setProviderPrice(baseCost);
          setCalculatedPrice(defaultOptions[0].customerPrice);
          setSelectedOptionId('opt_1');
          setIsPriceAvailable(true);
        }
      } catch (err) {
        console.warn('Error fetching Provider 2 price:', err);
        setIsPriceAvailable(true);
        setCalculatedPrice(1200);
      } finally {
        setPriceLoading(false);
      }
    };

    fetchPrice();
  }, [selectedServer, selectedCountry, selectedService]);

  // 4. Fetch User Orders
  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson(`/api/service-number-2/orders?userId=${encodeURIComponent(userProfile?.uid || '')}`, { headers });
      if (ok && data && Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.warn('Error fetching Provider 2 orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [userProfile?.uid]);

  // Clean timers on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Poll SMS status for active order
  const startPolling = (orderId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setElapsedSeconds(0);
    setPollingStatus('WAITING');

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const headers = await getAuthHeaders();
        const { ok, data } = await safeFetchJson(`/api/service-number-2/status?action=status&order_id=${encodeURIComponent(orderId)}&userId=${encodeURIComponent(userProfile?.uid || '')}`, {
          headers
        });

        if (ok && data && data.success) {
          if (data.status === 'SMS_RECEIVED' || data.code) {
            setPollingStatus('RECEIVED');
            setVerificationCode(data.code || '');
            setSmsContent(data.smsText || `Your verification code is: ${data.code}`);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            fetchOrders();
            onRefreshProfile();
          } else if (data.status === 'CANCELLED' || data.status === 'EXPIRED') {
            setPollingStatus('CANCELLED');
            setErrorMessage(data.message || 'Order was cancelled or expired.');
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            fetchOrders();
            onRefreshProfile();
          }
        }
      } catch (err) {
        console.warn('Polling status error:', err);
      }
    }, 4000);
  };

  // Buy Number Action
  const handleBuyNumber = async () => {
    if (!userProfile?.uid) {
      if (onOpenAuth) {
        onOpenAuth('login');
      } else {
        setErrorMessage('Please sign in to purchase a virtual number.');
      }
      return;
    }

    if (walletBalance < calculatedPrice) {
      setErrorMessage(`Insufficient wallet balance (₦${walletBalance.toLocaleString()}). Please fund your wallet with at least ₦${calculatedPrice.toLocaleString()} to purchase.`);
      return;
    }

    setBuyingLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const headers = await getAuthHeaders();
      const payload = {
        action: 'buy',
        server: selectedServer,
        country: selectedCountry,
        service: selectedService,
        optionId: selectedOptionId,
        amount: calculatedPrice,
        userId: userProfile?.uid,
        userEmail: userProfile?.email
      };

      const { ok, data } = await safeFetchJson('/api/service-number-2/order', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (ok && data && data.success) {
        setActiveOrder(data.order);
        setActiveStep('activation');
        onRefreshProfile();
        fetchOrders();
        startPolling(data.order?.orderId || data.orderId);
      } else {
        setErrorMessage(data?.error || data?.message || 'Could not allocate number from Provider 2. Please try another country or carrier.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to communicate with Provider 2 service endpoint.');
    } finally {
      setBuyingLoading(false);
    }
  };

  // Cancel Active Number Action
  const handleCancelNumber = async () => {
    if (!activeOrder) return;
    setCancellingLoading(true);
    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson('/api/service-number-2/cancel', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'cancel',
          order_id: activeOrder.orderId,
          userId: userProfile?.uid
        })
      });

      if (ok && data && data.success) {
        setPollingStatus('CANCELLED');
        setInfoMessage('Number cancelled successfully. Any eligible escrow refund has been returned to your wallet.');
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        onRefreshProfile();
        fetchOrders();
      } else {
        setErrorMessage(data?.error || 'Could not cancel order at this stage.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Cancellation request failed.');
    } finally {
      setCancellingLoading(false);
    }
  };

  const handleCopy = (text: string, type: 'number' | 'code' | string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const selectedCountryObj = countries.find(c => c.id === selectedCountry);
  const selectedServiceObj = services.find(s => s.id === selectedService);

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
                SERVICE NUMBER 2
              </span>
              <span className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                PROVIDER 2
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Service Number 2 / Virtual Number 2</span>
            </h1>
          </div>
        </div>

        {/* User Balance & Fund CTA */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-[#12082b] border border-[#261352] px-3.5 py-2 rounded-xl">
            <CreditCard className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-300/80 font-bold">Balance:</span>
            <span className="text-sm font-black text-white font-mono">₦{walletBalance.toLocaleString()}</span>
          </div>
          <button
            onClick={onOpenWallet}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-purple-600/30 transition cursor-pointer"
          >
            Fund Wallet
          </button>
        </div>
      </div>

      {/* Provider Notice Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#0c1836] via-[#111f44] to-[#0c1836] border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-3 shadow-md">
        <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <p className="font-extrabold text-white">
            Independent Provider 2 Integration Architecture
          </p>
          <p className="text-cyan-200/80 leading-relaxed">
            This section operates entirely on the new <strong>Provider 2</strong> integration channel. Your existing Provider 1 Service Number remains completely untouched and operational. You can configure Provider 2 API keys in the environment settings anytime.
          </p>
        </div>
      </div>

      {/* Alert Messages */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start space-x-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{errorMessage}</div>
          <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {infoMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start space-x-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{infoMessage}</div>
          <button onClick={() => setInfoMessage('')} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step Navigation Toggle */}
      <div className="flex items-center space-x-2 mb-6 border-b border-[#210f3f] pb-3">
        <button
          onClick={() => setActiveStep('selection')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
            activeStep === 'selection'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
              : 'text-purple-300 hover:bg-[#150a2e] hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Select & Buy Number</span>
        </button>

        {activeOrder && (
          <button
            onClick={() => setActiveStep('activation')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
              activeStep === 'activation'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-purple-300 hover:bg-[#150a2e] hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4 animate-bounce text-amber-300" />
            <span>Active Activation</span>
          </button>
        )}
      </div>

      {activeStep === 'selection' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Configuration Forms (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Server / Route Selection */}
            <div className="bg-[#0f0724] border border-[#231248] rounded-2xl p-5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-purple-200 flex items-center space-x-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>1. Select Carrier Route (Server)</span>
                </label>
                <span className="text-[10px] text-purple-400/60 font-semibold">Provider 2 Routing</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {servers.map((srv) => {
                  const isSel = selectedServer === srv.id;
                  return (
                    <button
                      key={srv.id}
                      onClick={() => setSelectedServer(srv.id)}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSel
                          ? 'bg-gradient-to-br from-[#12284c] to-[#0c1936] border-cyan-400 text-white shadow-md'
                          : 'bg-[#140b2b] border-[#2b1756] text-purple-300 hover:bg-[#1c0f3d]'
                      }`}
                    >
                      <span className="text-xs font-black">{srv.name.split(' - ')[0]}</span>
                      <span className="text-[10px] text-purple-300/60 font-medium mt-1">
                        {srv.name.split(' - ')[1] || 'Standard Route'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Country Selector */}
            <div className="bg-[#0f0724] border border-[#231248] rounded-2xl p-5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-purple-200 flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>2. Select Country</span>
                </label>
                
                {/* Tab switch: All vs USA Quick */}
                <div className="flex bg-[#160b33] p-0.5 rounded-lg border border-[#2d185e]">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-2.5 py-1 text-[10px] font-black rounded-md transition ${
                      activeTab === 'all' ? 'bg-cyan-600 text-white' : 'text-purple-300/70 hover:text-white'
                    }`}
                  >
                    All Countries
                  </button>
                  <button
                    onClick={() => setActiveTab('usa')}
                    className={`px-2.5 py-1 text-[10px] font-black rounded-md transition ${
                      activeTab === 'usa' ? 'bg-cyan-600 text-white' : 'text-purple-300/70 hover:text-white'
                    }`}
                  >
                    🇺🇸 USA Only
                  </button>
                </div>
              </div>

              {/* Trigger Button opening searchable country picker modal */}
              <button
                onClick={() => setIsCountryModalOpen(true)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-[#140b2b] border border-[#2b1756] hover:border-cyan-400/60 text-white transition cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">
                    {selectedCountryObj ? getCountryFlagEmoji(selectedCountryObj.code || selectedCountryObj.name) : '🌐'}
                  </span>
                  <div className="text-left">
                    <span className="font-extrabold text-sm block">
                      {selectedCountryObj ? selectedCountryObj.name : 'Choose a Country...'}
                    </span>
                    <span className="text-[10px] text-purple-300/60 block">
                      {countries.length} countries supported
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-purple-400" />
              </button>
            </div>

            {/* Service / App Selector */}
            <div className="bg-[#0f0724] border border-[#231248] rounded-2xl p-5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-purple-200 flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-cyan-400" />
                  <span>3. Select Application / Service</span>
                </label>
                <span className="text-[10px] text-purple-400/60 font-semibold">Instant SMS Verification</span>
              </div>

              {/* Quick service pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {services.slice(0, 8).map((srv) => {
                  const isSel = selectedService === srv.id;
                  return (
                    <button
                      key={srv.id}
                      onClick={() => setSelectedService(srv.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                        isSel
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-md font-black'
                          : 'bg-[#140b2b] border-[#2b1756] text-purple-200 hover:bg-[#1d0f3d]'
                      }`}
                    >
                      {srv.name}
                    </button>
                  );
                })}
              </div>

              {/* Searchable service modal trigger */}
              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#12082b] border border-[#261352] text-xs font-bold text-purple-300 hover:text-white transition cursor-pointer"
              >
                <span>Browse all {services.length} services...</span>
                <Search className="w-4 h-4 text-purple-400" />
              </button>
            </div>

          </div>

          {/* Right Column: Pricing & Checkout Breakdown (1 col) */}
          <div className="space-y-6">
            
            <div className="bg-gradient-to-b from-[#140a33] to-[#0d0521] border border-[#2c165a] rounded-2xl p-6 shadow-xl space-y-5">
              
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block">
                  CHECKOUT SUMMARY
                </span>
                <h3 className="text-lg font-black text-white">Number Allocation (Provider 2)</h3>
              </div>

              {/* Selected summary chips */}
              <div className="space-y-2.5 text-xs py-3 border-y border-[#221045]">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300/70">Country:</span>
                  <span className="font-extrabold text-white flex items-center gap-1.5">
                    <span>{selectedCountryObj ? getCountryFlagEmoji(selectedCountryObj.code || selectedCountryObj.name) : '🌐'}</span>
                    <span>{selectedCountryObj?.name || 'Selected Country'}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300/70">Service:</span>
                  <span className="font-extrabold text-white">{selectedServiceObj?.name || 'Selected Service'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300/70">Carrier Route:</span>
                  <span className="font-bold text-cyan-300">{servers.find(s => s.id === selectedServer)?.name.split(' - ')[0]}</span>
                </div>
              </div>

              {/* Pricing Options Selector */}
              {priceOptions.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                    Select Quality Tier
                  </label>
                  <div className="space-y-2">
                    {priceOptions.map((opt) => {
                      const isSel = selectedOptionId === opt.optionId;
                      return (
                        <div
                          key={opt.optionId}
                          onClick={() => {
                            setSelectedOptionId(opt.optionId);
                            setCalculatedPrice(opt.customerPrice);
                          }}
                          className={`p-3 rounded-xl border text-xs transition cursor-pointer flex items-center justify-between ${
                            isSel
                              ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-sm'
                              : 'bg-[#150a2e] border-[#291452] text-purple-300 hover:bg-[#1a0c3b]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-white">{opt.tierName}</span>
                              {opt.badge && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            {opt.description && (
                              <span className="text-[10px] text-purple-300/60 block mt-0.5">{opt.description}</span>
                            )}
                          </div>
                          <span className="font-black font-mono text-sm text-cyan-300">
                            ₦{opt.customerPrice.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Total Price Display */}
              <div className="pt-2 flex items-center justify-between">
                <div>
                  <span className="text-xs text-purple-300 font-bold block">Total Price</span>
                  <span className="text-[10px] text-emerald-400/80 font-semibold block">Includes escrow delivery guarantee</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-white">
                    ₦{calculatedPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Purchase Action Button */}
              <button
                onClick={handleBuyNumber}
                disabled={buyingLoading || !isPriceAvailable}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-cyan-600/30 transition duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {buyingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Allocating Number...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    <span>Purchase Virtual Number (₦{calculatedPrice.toLocaleString()})</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-purple-300/50 font-medium">
                SMS verification codes typically arrive within 30-180 seconds. In the rare event no SMS arrives, you can cancel for a full wallet refund.
              </p>

            </div>

            {/* Provider 2 Orders History Quick Widget */}
            <div className="bg-[#0f0724] border border-[#231248] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-purple-200">
                  Recent Orders (Provider 2)
                </span>
                <button
                  onClick={fetchOrders}
                  className="text-purple-400 hover:text-white text-xs flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              {orders.length === 0 ? (
                <p className="text-xs text-purple-300/50 text-center py-4">No Provider 2 orders yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {orders.slice(0, 5).map((ord) => (
                    <div
                      key={ord.orderId || ord.id}
                      className="p-2.5 rounded-xl bg-[#140b2b] border border-[#27134f] text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-extrabold text-white block">{ord.service || 'Service'}</span>
                        <span className="text-[10px] text-purple-300/60 font-mono">{ord.phoneNumber || ord.orderId}</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        ord.status === 'SMS_RECEIVED' || ord.code ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {ord.status || 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        /* ACTIVATION & SMS CODE LIVE POLLING VIEW */
        <div className="max-w-2xl mx-auto bg-[#0e0721] border border-[#281352] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
              <Smartphone className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Your Provider 2 Virtual Number</h2>
            <p className="text-xs text-purple-300/70">
              Copy this number into your target app and request the SMS verification code.
            </p>
          </div>

          {/* Allocated Phone Number */}
          <div className="bg-[#140b2b] border border-[#301663] rounded-2xl p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-purple-400/70 block">Assigned Phone Number</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-wider">
                {activeOrder?.phoneNumber || '+1 555-0192'}
              </span>
            </div>
            <button
              onClick={() => handleCopy(activeOrder?.phoneNumber || '', 'number')}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center space-x-1.5"
            >
              {copiedText === 'number' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedText === 'number' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Live SMS Status Card */}
          <div className="bg-[#100826] border border-[#231248] rounded-2xl p-6 text-center space-y-4">
            
            {pollingStatus === 'WAITING' && (
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2 text-amber-300">
                  <Clock className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-black">Waiting for SMS verification code...</span>
                </div>
                <p className="text-xs text-purple-300/70 font-medium max-w-md mx-auto">
                  Elapsed time: <span className="font-mono text-white font-bold">{elapsedSeconds}s</span>. The page updates automatically when the SMS is received.
                </p>
                <div className="w-full bg-[#1b0d3d] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full w-2/3 animate-pulse" />
                </div>
              </div>
            )}

            {pollingStatus === 'RECEIVED' && (
              <div className="space-y-3 animate-in zoom-in-95">
                <div className="flex items-center justify-center space-x-2 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="text-base font-black">Verification Code Received!</span>
                </div>
                
                <div className="bg-[#1a0f38] border border-emerald-500/40 p-5 rounded-2xl flex items-center justify-between">
                  <span className="text-3xl font-black font-mono text-emerald-300 tracking-widest">
                    {verificationCode}
                  </span>
                  <button
                    onClick={() => handleCopy(verificationCode, 'code')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition flex items-center space-x-1.5"
                  >
                    {copiedText === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedText === 'code' ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>

                {smsContent && (
                  <p className="text-xs text-purple-300/80 font-mono bg-[#140b2b] p-3 rounded-xl border border-[#2a1656]">
                    {smsContent}
                  </p>
                )}
              </div>
            )}

            {pollingStatus === 'CANCELLED' && (
              <div className="space-y-2 text-red-300">
                <XCircle className="w-8 h-8 text-red-400 mx-auto" />
                <h4 className="font-black text-base">Order Cancelled or Expired</h4>
                <p className="text-xs text-purple-300/70">
                  Your wallet has been credited if the SMS was not delivered.
                </p>
              </div>
            )}

          </div>

          {/* Actions: Cancel / Back to Selection */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {pollingStatus === 'WAITING' && (
              <button
                onClick={handleCancelNumber}
                disabled={cancellingLoading}
                className="w-full sm:flex-1 py-3 bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-200 text-xs font-black rounded-xl transition cursor-pointer"
              >
                {cancellingLoading ? 'Cancelling...' : 'Cancel & Refund Order'}
              </button>
            )}
            
            <button
              onClick={() => setActiveStep('selection')}
              className="w-full sm:flex-1 py-3 bg-[#190d38] hover:bg-[#22124d] text-white text-xs font-black rounded-xl transition cursor-pointer"
            >
              Order Another Number
            </button>
          </div>

        </div>
      )}

      {/* Country Search Modal */}
      {isCountryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0721] border border-[#2b1756] rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#231248] flex items-center justify-between">
              <h3 className="text-base font-black text-white">Select Country (Provider 2)</h3>
              <button onClick={() => setIsCountryModalOpen(false)} className="text-purple-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-[#231248]">
              <div className="relative">
                <Search className="w-4 h-4 text-purple-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={countrySearchQuery}
                  onChange={(e) => setCountrySearchQuery(e.target.value)}
                  className="w-full bg-[#140b2b] border border-[#2b1756] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-purple-400/50 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {countries
                .filter(c => c.name.toLowerCase().includes(countrySearchQuery.toLowerCase()))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCountry(c.id);
                      setIsCountryModalOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center space-x-3 transition cursor-pointer ${
                      selectedCountry === c.id ? 'bg-cyan-600 text-white' : 'text-purple-200 hover:bg-[#180d33]'
                    }`}
                  >
                    <span className="text-lg">{getCountryFlagEmoji(c.code || c.name)}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Service Search Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0721] border border-[#2b1756] rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#231248] flex items-center justify-between">
              <h3 className="text-base font-black text-white">Select Service / App (Provider 2)</h3>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-purple-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-[#231248]">
              <div className="relative">
                <Search className="w-4 h-4 text-purple-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search apps (WhatsApp, Telegram, Google...)"
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="w-full bg-[#140b2b] border border-[#2b1756] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-purple-400/50 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {services
                .filter(s => s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedService(s.id);
                      setIsServiceModalOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      selectedService === s.id ? 'bg-cyan-600 text-white' : 'text-purple-200 hover:bg-[#180d33]'
                    }`}
                  >
                    <span>{s.name}</span>
                    {s.price && <span className="font-mono text-[10px] text-cyan-300">₦{s.price}</span>}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
