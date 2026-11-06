import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Phone, 
  Globe, 
  ArrowLeft, 
  Loader2, 
  Copy, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  XCircle,
  Clock, 
  Search, 
  ChevronDown, 
  X, 
  Settings, 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Smartphone, 
  FileText,
  Star,
  Zap,
  Plus,
  Radio
} from 'lucide-react';
import { auth, getSafeIdToken } from '../lib/firebase';
import { UserProfile } from '../types';
import { sanitizeApiErrorMessage, isValidOtpCode, resolveCountryInfo, getNetlifyFunctionFallback } from '../utils/api';
import { copyToClipboard } from '../utils/clipboard';
import { ServiceLogo } from './ServiceLogo';

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
  eurToNgnRate?: number;
}

interface VirtualNumbersViewProps {
  userProfile: UserProfile;
  walletBalance: number;
  onRefreshProfile: () => void;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  initialServer?: string;
}

export const VirtualNumbersView: React.FC<VirtualNumbersViewProps> = ({
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet,
  initialServer = 'all1'
}) => {
  const isOwner = 
    userProfile?.role === 'owner' || 
    userProfile?.email?.toLowerCase().trim() === 'azeezmusharaf4@gmail.com' || 
    auth?.currentUser?.email?.toLowerCase().trim() === 'azeezmusharaf4@gmail.com';

  // Loaders
  const [initialLoading, setInitialLoading] = useState(true);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [buyingLoading, setBuyingLoading] = useState(false);
  const [cancellingLoading, setCancellingLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Data lists loaded dynamically from API
  const [countries, setCountries] = useState<Array<{ id: string; name: string; code?: string; flag?: string }>>([]);
  const [services, setServices] = useState<Array<{ id: string; slug?: string; name: string; category?: string }>>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // Selected values in Quick Buy Panel (Start empty per user requirements)
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>(''); // empty initially, or 'cheapest', or country ISO (e.g. 'US')
  const [resolvedCheapestCountry, setResolvedCheapestCountry] = useState<{ id: string; name: string; flag: string; code: string } | null>(null);

  // Search dropdown states for Quick Buy
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [countrySearchQuery, setCountrySearchQuery] = useState('');

  const serviceDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Pricing details
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('opt_1');
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);
  const [availableStock, setAvailableStock] = useState<number>(0);
  const [successRate, setSuccessRate] = useState<number>(0.9);
  const [isPriceAvailable, setIsPriceAvailable] = useState<boolean>(false);
  const [priceErrorMessage, setPriceErrorMessage] = useState<string>('');

  // Owner Pricing Settings State & Modal
  const [isOwnerSettingsOpen, setIsOwnerSettingsOpen] = useState<boolean>(false);
  const [ownerSettings, setOwnerSettings] = useState<PricingSettings>({
    optionsCount: 4,
    minMarkup: 500,
    maxMarkup: 4500,
    pricingStyle: 'natural',
    eurToNgnRate: 1750
  });
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<string>('');

  // Owner Price Management Section State
  const [isPriceSectionOpen, setIsPriceSectionOpen] = useState<boolean>(false);
  const [priceService, setPriceService] = useState<string>('');
  const [priceCountry, setPriceCountry] = useState<string>('');
  const [isPriceServiceDropdownOpen, setIsPriceServiceDropdownOpen] = useState<boolean>(false);
  const [isPriceCountryDropdownOpen, setIsPriceCountryDropdownOpen] = useState<boolean>(false);
  const [priceServiceSearchQuery, setPriceServiceSearchQuery] = useState<string>('');
  const [priceCountrySearchQuery, setPriceCountrySearchQuery] = useState<string>('');
  const priceServiceDropdownRef = useRef<HTMLDivElement>(null);
  const priceCountryDropdownRef = useRef<HTMLDivElement>(null);

  const [priceSectionLoading, setPriceSectionLoading] = useState<boolean>(false);
  const [priceSectionProviderCost, setPriceSectionProviderCost] = useState<number | null>(null);
  const [priceSectionCurrentPrice, setPriceSectionCurrentPrice] = useState<number | null>(null);
  const [priceSectionStock, setPriceSectionStock] = useState<number | null>(null);
  const [priceSectionInputPrice, setPriceSectionInputPrice] = useState<number>(0);
  const [priceSectionHasCustomPrice, setPriceSectionHasCustomPrice] = useState<boolean>(false);
  const [priceSectionSaving, setPriceSectionSaving] = useState<boolean>(false);
  const [priceSectionResetting, setPriceSectionResetting] = useState<boolean>(false);
  const [priceSectionSuccessMsg, setPriceSectionSuccessMsg] = useState<string>('');
  const [priceSectionErrorMsg, setPriceSectionErrorMsg] = useState<string>('');

  // Active Order info
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [pollingStatus, setPollingStatus] = useState<'WAITING' | 'RECEIVED' | 'CANCELLED'>('WAITING');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [smsContent, setSmsContent] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [copiedText, setCopiedText] = useState<'number' | 'code' | string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [comingSoonNotice, setComingSoonNotice] = useState<string>('');
  const [apiConnectionError, setApiConnectionError] = useState<string>('');
  const [providerTopUpRequired, setProviderTopUpRequired] = useState<boolean>(false);
  const [providerBalanceInfo, setProviderBalanceInfo] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // 1-second ticker for real-time 15-minute refund countdown
  useEffect(() => {
    const ticker = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) {
        setIsServiceDropdownOpen(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
      if (priceServiceDropdownRef.current && !priceServiceDropdownRef.current.contains(event.target as Node)) {
        setIsPriceServiceDropdownOpen(false);
      }
      if (priceCountryDropdownRef.current && !priceCountryDropdownRef.current.contains(event.target as Node)) {
        setIsPriceCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear running intervals on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

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

  // Safe JSON API fetcher that handles non-JSON responses and Netlify fallback gracefully
  const safeFetchJson = async (url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> => {
    const doFetch = async (targetUrl: string): Promise<{ ok: boolean; status: number; data: any; isHtml: boolean }> => {
      try {
        const res = await fetch(targetUrl, {
          ...options,
          headers: {
            'Accept': 'application/json, text/plain, */*',
            ...(options?.headers || {})
          }
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          return { ok: res.ok, status: res.status, data, isHtml: false };
        }
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          return { ok: res.ok, status: res.status, data, isHtml: false };
        } catch {
          const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
          return {
            ok: false,
            status: res.status,
            data: { error: sanitizeApiErrorMessage(text, 'This option is currently updating. Please choose another country or service.') },
            isHtml
          };
        }
      } catch (netErr: any) {
        return {
          ok: false,
          status: 0,
          data: { error: sanitizeApiErrorMessage(netErr?.message, 'Network connection issue. Please check your connection.') },
          isHtml: false
        };
      }
    };

    let result = await doFetch(url);
    if ((!result.ok || result.isHtml || result.status === 404 || result.status === 502) && url.startsWith('/api/')) {
      const fallbackUrl = getNetlifyFunctionFallback(url);
      if (fallbackUrl && fallbackUrl !== url) {
        const fallbackResult = await doFetch(fallbackUrl);
        if (fallbackResult.ok && !fallbackResult.isHtml && fallbackResult.data) {
          result = fallbackResult;
        }
      }
    }
    return { ok: result.ok, status: result.status, data: result.data };
  };

  // Service display and branding helper
  const getServiceDisplayName = (serviceId: string, fallbackName?: string) => {
    if (!serviceId) return 'Select service';
    if (fallbackName && fallbackName.trim() !== '' && fallbackName.toLowerCase() !== serviceId.toLowerCase()) {
      return fallbackName;
    }
    const map: Record<string, string> = {
      telegram: 'Telegram',
      tg: 'Telegram',
      whatsapp: 'WhatsApp & WA Business',
      wa: 'WhatsApp & WA Business',
      google: 'Google / Gmail / YouTube',
      go: 'Google / Gmail / YouTube',
      openai: 'OpenAI / ChatGPT',
      oi: 'OpenAI / ChatGPT',
      instagram: 'Instagram & Threads',
      ig: 'Instagram & Threads',
      facebook: 'Facebook & Messenger',
      fb: 'Facebook & Messenger',
      twitter: 'Twitter / X',
      tw: 'Twitter / X',
      tiktok: 'TikTok',
      tk: 'TikTok',
      netflix: 'Netflix',
      nf: 'Netflix',
      apple: 'Apple / iCloud',
      binance: 'Binance / Crypto',
      paypal: 'PayPal Verification',
      discord: 'Discord',
      snapchat: 'Snapchat',
      uber: 'Uber & Eats',
      steam: 'Steam'
    };
    return map[serviceId.toLowerCase()] || fallbackName || serviceId.charAt(0).toUpperCase() + serviceId.slice(1);
  };

  const getServiceBadgeInitial = (serviceId: string) => {
    const clean = (serviceId || '').toLowerCase();
    if (clean.includes('tele') || clean === 'tg') return 'T';
    if (clean.includes('whats') || clean === 'wa') return 'W';
    if (clean.includes('goog') || clean === 'go') return 'G';
    if (clean.includes('open') || clean.includes('chat') || clean === 'oi') return 'AI';
    if (clean.includes('insta') || clean === 'ig') return 'I';
    if (clean.includes('face') || clean === 'fb') return 'F';
    if (clean.includes('twit') || clean === 'tw' || clean === 'x') return 'X';
    if (clean.includes('tik') || clean === 'tk') return 'TT';
    if (clean.includes('netf') || clean === 'nf') return 'N';
    if (clean.includes('appl')) return 'A';
    if (clean.includes('bina')) return 'B';
    if (clean.includes('payp')) return 'P';
    if (clean.includes('disc')) return 'D';
    return clean.slice(0, 2).toUpperCase() || 'SMS';
  };

  const getServiceColor = (serviceId: string) => {
    const clean = (serviceId || '').toLowerCase();
    if (clean.includes('tele') || clean === 'tg') return 'bg-[#229ED9] text-white';
    if (clean.includes('whats') || clean === 'wa') return 'bg-[#25D366] text-white';
    if (clean.includes('goog') || clean === 'go') return 'bg-[#4285F4] text-white';
    if (clean.includes('open') || clean === 'oi') return 'bg-[#10A37F] text-white';
    if (clean.includes('insta') || clean === 'ig') return 'bg-[#E1306C] text-white';
    if (clean.includes('face') || clean === 'fb') return 'bg-[#1877F2] text-white';
    if (clean.includes('tik') || clean === 'tk') return 'bg-[#000000] text-white';
    if (clean.includes('netf') || clean === 'nf') return 'bg-[#E50914] text-white';
    if (clean.includes('bina')) return 'bg-[#F0B90B] text-black';
    if (clean.includes('payp')) return 'bg-[#003087] text-white';
    return 'bg-[#7C3AED] text-white';
  };

  // Country Flag mapping helper
  const getCountryFlagEmoji = (countryCodeOrName: string) => {
    if (!countryCodeOrName) return '🌐';
    const lower = countryCodeOrName.toLowerCase();
    if (lower === 'cheapest' || lower === 'cheapest_available') return '★';
    if (lower.includes('united states') || lower === 'us' || lower === 'usa' || lower === '187') return '🇺🇸';
    if (lower.includes('united kingdom') || lower === 'gb' || lower === 'uk') return '🇬🇧';
    if (lower.includes('canada') || lower === 'ca') return '🇨🇦';
    if (lower.includes('nigeria') || lower === 'ng') return '🇳🇬';
    if (lower.includes('russia') || lower === 'ru') return '🇷🇺';
    if (lower.includes('india') || lower === 'in') return '🇮🇳';
    if (lower.includes('indonesia') || lower === 'id') return '🇮🇩';
    if (lower.includes('brazil') || lower === 'br') return '🇧🇷';
    if (lower.includes('philippines') || lower === 'ph') return '🇵🇭';
    if (lower.includes('south africa') || lower === 'za') return '🇿🇦';
    if (lower.includes('germany') || lower === 'de') return '🇩🇪';
    if (lower.includes('france') || lower === 'fr') return '🇫🇷';
    if (lower.includes('ghana') || lower === 'gh') return '🇬🇭';
    if (lower.includes('kenya') || lower === 'ke') return '🇰🇪';
    if (lower.includes('netherlands') || lower === 'nl') return '🇳🇱';
    if (countryCodeOrName.length === 2 && /^[a-zA-Z]+$/.test(countryCodeOrName)) {
      const code = countryCodeOrName.toUpperCase();
      const codePoints = code.split('').map(char => 127397 + char.charCodeAt(0));
      try {
        return String.fromCodePoint(...codePoints);
      } catch {
        return '🌐';
      }
    }
    return '🌐';
  };

  const getCountryDialCode = (countryId: string, countryName?: string, existingCode?: string): string => {
    if (existingCode && existingCode.trim()) {
      return existingCode.startsWith('+') ? existingCode : `+${existingCode}`;
    }
    const idLower = (countryId || '').toLowerCase();
    const nameLower = (countryName || '').toLowerCase();
    if (idLower === 'us' || idLower === 'usa' || idLower === '187' || nameLower.includes('united states')) return '+1';
    if (idLower === 'gb' || idLower === 'uk' || nameLower.includes('united kingdom')) return '+44';
    if (idLower === 'ru' || nameLower.includes('russia')) return '+7';
    if (idLower === 'in' || nameLower.includes('india')) return '+91';
    if (idLower === 'id' || nameLower.includes('indonesia')) return '+62';
    if (idLower === 'br' || nameLower.includes('brazil')) return '+55';
    if (idLower === 'ph' || nameLower.includes('philippines')) return '+63';
    if (idLower === 'ng' || nameLower.includes('nigeria')) return '+234';
    if (idLower === 'za' || nameLower.includes('south africa')) return '+27';
    if (idLower === 'ke' || nameLower.includes('kenya')) return '+254';
    if (idLower === 'gh' || nameLower.includes('ghana')) return '+233';
    if (idLower === 'de' || nameLower.includes('germany')) return '+49';
    if (idLower === 'fr' || nameLower.includes('france')) return '+33';
    if (idLower === 'nl' || nameLower.includes('netherlands')) return '+31';
    return '';
  };

  // 1. Initial Load: Fetch Services and Countries concurrently from API
  const loadInitialData = async () => {
    setInitialLoading(true);
    setApiConnectionError('');
    try {
      // 1a. Fetch Services
      setServicesLoading(true);
      const sRes = await safeFetchJson('/api/onegridhub/services?action=services');
      const serviceList = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.services || sRes.data?.data || []);
      if (sRes.ok && serviceList.length > 0) {
        setServices(serviceList);
      } else {
        throw new Error(sRes.data?.error || 'Could not load SMS services.');
      }

      // 1b. Fetch Countries
      setCountriesLoading(true);
      const cRes = await safeFetchJson('/api/onegridhub/countries?action=countries');
      const countryList = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.countries || cRes.data?.data || []);
      if (cRes.ok && countryList.length > 0) {
        const enriched = countryList.map((c: any) => ({
          ...c,
          id: c.id || c.code,
          flag: c.flag || getCountryFlagEmoji(c.code || c.id),
          code: c.code || getCountryDialCode(c.id, c.name, c.code)
        }));
        setCountries(enriched);
      } else {
        throw new Error(cRes.data?.error || 'Could not load countries.');
      }

      // 1c. If owner, check wholesale provider status
      if (isOwner) {
        getAuthHeaders().then(hdrs => {
          safeFetchJson('/api/onegridhub/balance?action=balance', { headers: hdrs }).then(({ ok, data }) => {
            if (ok && data) {
              setProviderBalanceInfo(data);
              if (data.requiresTopUp || data.canPurchase === false) {
                setProviderTopUpRequired(true);
              }
            }
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch (err: any) {
      console.warn('[VirtualNumbersView] Initial data fetch notice:', err.message);
      setApiConnectionError(err.message || 'Unable to connect to VirtualSMSNumbers gateway. Please check your internet or retry.');
    } finally {
      setServicesLoading(false);
      setCountriesLoading(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    fetchOrders();
  }, []);

  // 2. Fetch Price whenever both selectedService and selectedCountry are chosen
  const fetchPrice = async (serviceToUse = selectedService, countryToUse = selectedCountry) => {
    if (!serviceToUse || !countryToUse) {
      setCalculatedPrice(0);
      setPriceOptions([]);
      setIsPriceAvailable(false);
      setPriceErrorMessage('');
      return;
    }

    setPriceLoading(true);
    setPriceErrorMessage('');

    try {
      const headers = await getAuthHeaders();
      const callerEmail = (userProfile?.email || auth?.currentUser?.email || '').toLowerCase().trim();
      if (callerEmail) {
        headers['x-caller-email'] = callerEmail;
      }

      const countryParam = !countryToUse || countryToUse === 'cheapest' ? 'cheapest' : countryToUse;
      const { ok, data } = await safeFetchJson(
        `/api/onegridhub/price?action=price&country=${encodeURIComponent(countryParam)}&service=${encodeURIComponent(serviceToUse)}&callerEmail=${encodeURIComponent(callerEmail)}`,
        { headers }
      );

      if (ok && (data?.available || data?.hasCustomPrice || Number(data?.effectiveSellingPrice || data?.customerPrice || data?.price) > 0)) {
        const effectivePrice = Number(data.effectiveSellingPrice ?? data.customerPrice ?? data.totalPrice ?? data.price ?? 0);
        const rawOptions: any[] = Array.isArray(data.options) && data.options.length > 0
          ? data.options
          : [{
              optionId: 'opt_1',
              tierIndex: 0,
              tierName: 'Standard Line',
              badge: 'Popular',
              description: 'Direct carrier routing',
              customerPrice: effectivePrice,
              providerCost: Number(data.providerCost || 0),
              markup: Number(data.markup || 0),
              profit: Number(data.profit || data.markup || 0)
            }];

        const formattedOptions: PriceOption[] = rawOptions.map((opt, i) => ({
          optionId: opt.optionId || `opt_${i + 1}`,
          tierIndex: opt.tierIndex ?? i,
          tierName: opt.tierName || `Option ${i + 1}`,
          badge: opt.badge,
          description: opt.description,
          customerPrice: Number(opt.customerPrice || effectivePrice),
          providerCost: opt.providerCost !== undefined ? Number(opt.providerCost) : undefined,
          markup: opt.markup !== undefined ? Number(opt.markup) : undefined,
          profit: opt.profit !== undefined ? Number(opt.profit) : undefined,
          marginPercent: opt.marginPercent !== undefined ? Number(opt.marginPercent) : undefined
        }));

        setPriceOptions(formattedOptions);

        const matched = formattedOptions.find(o => o.optionId === selectedOptionId) || formattedOptions[0];
        setSelectedOptionId(matched.optionId);
        setCalculatedPrice(matched.customerPrice);
        const actualStock = Number(data.availableStock ?? data.stock ?? 0);
        setAvailableStock(isNaN(actualStock) || actualStock < 0 ? 0 : actualStock);
        setSuccessRate(Number(data.successRate ?? 0.9));
        const inStock = Boolean(data.available && actualStock > 0);
        setIsPriceAvailable(inStock);

        if (!inStock) {
          const serviceName = getServiceDisplayName(serviceToUse);
          const countryObj = countries.find(c => c.id === countryToUse || c.code === countryToUse);
          const countryLabel = countryObj?.name || (data?.resolvedCountryName) || 'this country';
          setPriceErrorMessage(`No numbers currently in stock for ${serviceName} in ${countryLabel}. Saved selling price is ₦${effectivePrice.toLocaleString()}.`);
        } else {
          setPriceErrorMessage('');
        }

        if (data.isCheapest && data.resolvedCountry) {
          setResolvedCheapestCountry({
            id: data.resolvedCountry,
            name: data.resolvedCountryName || data.resolvedCountry,
            flag: data.resolvedFlag || getCountryFlagEmoji(data.resolvedCountry),
            code: data.resolvedDialCode || getCountryDialCode(data.resolvedCountry)
          });
        }
      } else {
        setIsPriceAvailable(false);
        setPriceOptions([]);
        setCalculatedPrice(0);
        const serviceName = getServiceDisplayName(serviceToUse);
        const countryObj = countries.find(c => c.id === countryToUse || c.code === countryToUse);
        const countryLabel = countryObj?.name || (data?.resolvedCountryName) || 'this country';
        const dynamicMsg = `No numbers currently in stock for ${serviceName} in ${countryLabel}. Try selecting Cheapest available or another country (e.g. United States, United Kingdom, Poland) which have numbers in stock.`;
        setPriceErrorMessage(sanitizeApiErrorMessage(data?.error, dynamicMsg));
      }
    } catch (err: any) {
      console.error('Failed to get price options:', err);
      setIsPriceAvailable(false);
      setPriceOptions([]);
      setCalculatedPrice(0);
      setPriceErrorMessage('Service temporarily busy. Please choose another country or service.');
    } finally {
      setPriceLoading(false);
    }
  };

  useEffect(() => {
    if (selectedService && selectedCountry) {
      fetchPrice(selectedService, selectedCountry);
    } else {
      setCalculatedPrice(0);
      setPriceOptions([]);
      setIsPriceAvailable(false);
      setPriceErrorMessage('');
    }
  }, [selectedService, selectedCountry]);

  // Owner Price Management Data Fetcher
  const fetchPriceManagementData = async (serviceToFetch = priceService, countryToFetch = priceCountry) => {
    if (!serviceToFetch || !countryToFetch) {
      setPriceSectionProviderCost(null);
      setPriceSectionCurrentPrice(null);
      setPriceSectionInputPrice(0);
      setPriceSectionHasCustomPrice(false);
      setPriceSectionErrorMsg('');
      return;
    }

    setPriceSectionLoading(true);
    setPriceSectionErrorMsg('');
    setPriceSectionSuccessMsg('');

    try {
      const headers = await getAuthHeaders();
      const callerEmail = (userProfile?.email || auth?.currentUser?.email || '').toLowerCase().trim();
      if (callerEmail) {
        headers['x-caller-email'] = callerEmail;
      }

      const { ok, data } = await safeFetchJson(
        `/api/onegridhub/price?action=price&country=${encodeURIComponent(countryToFetch)}&service=${encodeURIComponent(serviceToFetch)}&callerEmail=${encodeURIComponent(callerEmail)}`,
        { headers }
      );

      if (ok && data) {
        const providerCost = Number(data.providerCost ?? 0);
        const customerPrice = Number(data.effectiveSellingPrice ?? data.customerPrice ?? data.price ?? providerCost);
        const actualStock = Number(data.availableStock ?? data.stock ?? 0);
        setPriceSectionStock(isNaN(actualStock) ? 0 : actualStock);
        setPriceSectionProviderCost(providerCost);
        setPriceSectionCurrentPrice(customerPrice);
        setPriceSectionInputPrice(customerPrice > 0 ? customerPrice : providerCost);
        setPriceSectionHasCustomPrice(Boolean(data.hasCustomPrice));
      } else {
        setPriceSectionStock(null);
        setPriceSectionProviderCost(null);
        setPriceSectionCurrentPrice(null);
        setPriceSectionErrorMsg(sanitizeApiErrorMessage(data?.error, 'Could not retrieve pricing details for this selection.'));
      }
    } catch (err: any) {
      setPriceSectionStock(null);
      setPriceSectionProviderCost(null);
      setPriceSectionCurrentPrice(null);
      setPriceSectionErrorMsg(sanitizeApiErrorMessage(err?.message, 'Failed to connect to provider.'));
    } finally {
      setPriceSectionLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner && priceService && priceCountry) {
      fetchPriceManagementData(priceService, priceCountry);
    } else {
      setPriceSectionStock(null);
      setPriceSectionProviderCost(null);
      setPriceSectionCurrentPrice(null);
      setPriceSectionInputPrice(0);
      setPriceSectionHasCustomPrice(false);
      setPriceSectionErrorMsg('');
      setPriceSectionSuccessMsg('');
    }
  }, [priceService, priceCountry, isOwner]);

  const handleSaveCustomPrice = async () => {
    if (!priceService || !priceCountry) return;

    const providerCost = priceSectionProviderCost ?? 0;
    const numPrice = Math.round(Number(priceSectionInputPrice) || 0);

    if (numPrice <= 0) {
      setPriceSectionErrorMsg('Please enter a valid selling price greater than 0.');
      return;
    }

    // Strict minimum price restriction enforcement:
    if (providerCost > 0 && numPrice < providerCost) {
      setPriceSectionErrorMsg(`Selling price (₦${numPrice.toLocaleString()}) cannot be lower than the provider cost of ₦${providerCost.toLocaleString()}.`);
      return;
    }

    setPriceSectionSaving(true);
    setPriceSectionErrorMsg('');
    setPriceSectionSuccessMsg('');

    try {
      const headers = await getAuthHeaders();
      const callerEmail = (userProfile?.email || auth?.currentUser?.email || '').toLowerCase().trim();
      if (callerEmail) {
        headers['x-caller-email'] = callerEmail;
      }

      const matchedService = services.find(s => s.slug === priceService || s.id === priceService || (s as any).code === priceService);
      const matchedCountry = countries.find(c => c.id === priceCountry || c.code === priceCountry);
      const canonicalCountry = (matchedCountry?.id || priceCountry).toUpperCase();

      const { ok, data } = await safeFetchJson('/api/onegridhub/set-custom-price', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'set-custom-price',
          service: matchedService?.slug || priceService,
          serviceName: matchedService?.name || priceService,
          serviceId: matchedService?.id || '',
          serviceSlug: matchedService?.slug || priceService,
          country: canonicalCountry,
          countryName: matchedCountry?.name || canonicalCountry,
          countryId: canonicalCountry,
          countryCode: canonicalCountry,
          providerCost: providerCost,
          sellingPrice: numPrice,
          profit: Math.max(0, numPrice - providerCost),
          callerEmail
        })
      });

      if (ok && data?.success) {
        setPriceSectionSuccessMsg(data.message || `Selling price successfully saved at ₦${numPrice.toLocaleString()}.`);
        setPriceSectionCurrentPrice(numPrice);
        setPriceSectionHasCustomPrice(true);
        if (selectedService === priceService && (selectedCountry === priceCountry || selectedCountry === canonicalCountry || selectedCountry === 'cheapest')) {
          fetchPrice(selectedService, selectedCountry);
        }
      } else {
        setPriceSectionErrorMsg(data?.error || 'Failed to save selling price.');
      }
    } catch (err: any) {
      setPriceSectionErrorMsg(err?.message || 'Network error while saving selling price.');
    } finally {
      setPriceSectionSaving(false);
    }
  };

  const handleResetCustomPrice = async () => {
    if (!priceService || !priceCountry) return;
    setPriceSectionResetting(true);
    setPriceSectionErrorMsg('');
    setPriceSectionSuccessMsg('');

    try {
      const headers = await getAuthHeaders();
      const callerEmail = (userProfile?.email || auth?.currentUser?.email || '').toLowerCase().trim();
      if (callerEmail) {
        headers['x-caller-email'] = callerEmail;
      }

      const matchedService = services.find(s => s.slug === priceService || s.id === priceService || (s as any).code === priceService);
      const matchedCountry = countries.find(c => c.id === priceCountry || c.code === priceCountry);
      const canonicalCountry = (matchedCountry?.id || priceCountry).toUpperCase();

      const { ok, data } = await safeFetchJson('/api/onegridhub/reset-custom-price', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'reset-custom-price',
          service: matchedService?.slug || priceService,
          country: canonicalCountry,
          callerEmail
        })
      });

      if (ok && data?.success) {
        const cost = priceSectionProviderCost || 0;
        setPriceSectionSuccessMsg(`Custom price reset. Selling price is now provider cost (₦${cost.toLocaleString()}).`);
        setPriceSectionCurrentPrice(cost);
        setPriceSectionInputPrice(cost);
        setPriceSectionHasCustomPrice(false);
        if (selectedService === priceService && (selectedCountry === priceCountry || selectedCountry === canonicalCountry || selectedCountry === 'cheapest')) {
          fetchPrice(selectedService, selectedCountry);
        }
      } else {
        setPriceSectionErrorMsg(data?.error || 'Failed to reset custom price.');
      }
    } catch (err: any) {
      setPriceSectionErrorMsg(err?.message || 'Network error while resetting price.');
    } finally {
      setPriceSectionResetting(false);
    }
  };

  // 3. Orders History Fetcher
  const fetchOrders = async () => {
    if (!userProfile?.uid) return;
    setOrdersLoading(true);
    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson(`/api/onegridhub/orders?action=orders&userId=${encodeURIComponent(userProfile.uid)}`, {
        headers
      });
      if (ok && data?.orders && Array.isArray(data.orders)) {
        setOrders(data.orders);
        // If there's an active waiting order in history and no activeOrder in state, resume monitoring
        if (!activeOrder) {
          const ongoing = data.orders.find((o: any) => o.status === 'WAITING' && !o.code);
          if (ongoing) {
            setActiveOrder(ongoing);
            setPollingStatus('WAITING');
            startSmsPolling(ongoing.orderId || ongoing.id);
          }
        }
      }
    } catch (e) {
      console.warn('Orders fetch warning:', e);
    } finally {
      setOrdersLoading(false);
    }
  };

  // 4. Buy Virtual Number Action
  const handleBuyNumber = async () => {
    if (buyingLoading || priceLoading || !isPriceAvailable || !selectedService || !selectedCountry) return;
    setErrorMessage('');
    setInfoMessage('');
    setComingSoonNotice('');
    setBuyingLoading(true);

    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson('/api/onegridhub/buy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'buy',
          country: selectedCountry,
          service: selectedService,
          optionId: selectedOptionId,
          selectedPrice: calculatedPrice,
          userId: userProfile?.uid
        })
      });

      if (!ok || !data || !data.success) {
        const errMsg = data?.error || data?.message || 'Failed to allocate virtual number.';
        throw new Error(errMsg);
      }

      const newOrder = data.order || data;
      setActiveOrder(newOrder);
      setPollingStatus('WAITING');
      setVerificationCode('');
      setSmsContent('');
      setElapsedSeconds(0);
      const cleanFormattedPhone = String(newOrder.phoneNumber || '').replace(/[^\d]/g, '');
      setInfoMessage(`Allocated +${cleanFormattedPhone}! Waiting for SMS code (up to 20 mins).`);

      startSmsPolling(newOrder.orderId || newOrder.id);
      if (onRefreshProfile) onRefreshProfile();
      fetchOrders();
    } catch (err: any) {
      setErrorMessage(sanitizeApiErrorMessage(err.message, 'Purchase failed.'));
    } finally {
      setBuyingLoading(false);
    }
  };

  // 5. SMS Polling Mechanism
  const startSmsPolling = (orderId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const headers = await getAuthHeaders();
        const { ok, data } = await safeFetchJson(
          `/api/onegridhub/status?action=status&order_id=${encodeURIComponent(orderId)}&userId=${encodeURIComponent(userProfile?.uid || '')}`,
          { headers }
        );

        if (ok && data) {
          const rawCode = data.code || data.smsCode || data.otp;
          const hasValidOtp = isValidOtpCode(rawCode);

          if (hasValidOtp) {
            setPollingStatus('RECEIVED');
            setVerificationCode(rawCode);
            setSmsContent(data.smsText || `Your verification code is: ${rawCode}`);
            
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

            // Notify backend to mark activation completed
            safeFetchJson('/api/onegridhub/complete', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                action: 'complete',
                orderId,
                userId: userProfile?.uid
              })
            }).catch(e => console.warn('VirtualSMSNumbers complete activation notice:', e));
            
            if (onRefreshProfile) onRefreshProfile();
            fetchOrders();
          } else if (data.status === 'CANCELLED' || data.status === 'cancelled' || data.status === 'EXPIRED' || data.status === 'expired') {
            setPollingStatus('CANCELLED');
            setErrorMessage(data.message || 'This session expired or was cancelled by the carrier. Unused funds were returned to your wallet.');
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (onRefreshProfile) onRefreshProfile();
            fetchOrders();
          } else {
            // Still waiting
            setPollingStatus('WAITING');
            setVerificationCode('');
          }
        }
      } catch (err) {
        console.warn('Status poll exception:', err);
      }
    }, 4000);
  };

  // 6. Cancel & Refund
  const handleCancelOrder = async (orderToCancel?: any) => {
    const target = orderToCancel || activeOrder;
    if (!target) return;
    const orderIdToCancel = target.orderId || target.id;
    setErrorMessage('');
    setCancellingLoading(true);

    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson('/api/onegridhub/cancel', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'cancel',
          userId: userProfile?.uid,
          orderId: orderIdToCancel
        })
      });

      if (!ok || !data || !data.success) {
        throw new Error(data?.error || 'Cancellation declined.');
      }

      setPollingStatus('CANCELLED');
      setInfoMessage(data.message || 'Order cancelled successfully! Funds refunded to your wallet.');
      if (activeOrder && (activeOrder.orderId === orderIdToCancel || activeOrder.id === orderIdToCancel)) {
        setActiveOrder(null);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      }

      if (onRefreshProfile) onRefreshProfile();
      fetchOrders();
    } catch (err: any) {
      setErrorMessage(sanitizeApiErrorMessage(err.message, 'Failed to cancel order.'));
    } finally {
      setCancellingLoading(false);
    }
  };

  // Clipboard copy handler
  const handleCopy = (text: string, type: 'number' | 'code' | string) => {
    if (!text) return;
    copyToClipboard(text);
    setCopiedText(type);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  // Search filters & priority sorting for 500+ API services and 220+ API countries
  const filteredServices = useMemo(() => {
    const q = serviceSearchQuery.toLowerCase().trim();
    if (!q) {
      const popularSlugs = [
        'telegram', 'tg', 'whatsapp', 'wa', 'google', 'go', 'openai', 'oi',
        'instagram', 'ig', 'tiktok', 'tk', 'facebook', 'fb', 'twitter', 'tw',
        'netflix', 'nf', 'apple', 'wx', 'snapchat', 'fu', 'paypal', 'ts',
        'binance', 'wb', 'discord', 'ds', 'amazon', 'am', 'uber', 'ub', 'steam', 'st'
      ];
      return [...services].sort((a, b) => {
        const aSlug = (a.slug || a.id || '').toLowerCase();
        const bSlug = (b.slug || b.id || '').toLowerCase();
        const aIdx = popularSlugs.indexOf(aSlug);
        const bIdx = popularSlugs.indexOf(bSlug);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
    }
    return services.filter(s => {
      const name = (s.name || '').toLowerCase();
      const id = (s.id || '').toLowerCase();
      const slug = (s.slug || '').toLowerCase();
      const display = getServiceDisplayName(s.id, s.name).toLowerCase();
      return name.includes(q) || id.includes(q) || slug.includes(q) || display.includes(q);
    });
  }, [services, serviceSearchQuery]);

  const filteredCountries = useMemo(() => {
    const q = countrySearchQuery.toLowerCase().trim();
    if (!q) {
      const popularCodes = ['US', 'GB', 'CA', 'NG', 'PT', 'FR', 'DE', 'NL', 'BR', 'IN', 'ID', 'PH', 'ZA', 'GH', 'KE'];
      return [...countries].sort((a, b) => {
        const aCode = (a.id || a.code || '').toUpperCase();
        const bCode = (b.id || b.code || '').toUpperCase();
        const aIdx = popularCodes.indexOf(aCode);
        const bIdx = popularCodes.indexOf(bCode);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
    }
    return countries.filter(c => {
      const name = (c.name || '').toLowerCase();
      const id = (c.id || '').toLowerCase();
      const code = (c.code || '').toLowerCase();
      return name.includes(q) || id.includes(q) || code.includes(q);
    });
  }, [countries, countrySearchQuery]);

  const selectedCountryObj = countries.find(c => c.id === selectedCountry || c.code === selectedCountry);
  const selectedServiceObj = services.find(s => s.id === selectedService || s.slug === selectedService);

  const filteredPriceServices = useMemo(() => {
    const q = priceServiceSearchQuery.toLowerCase().trim();
    if (!q) {
      return services;
    }
    return services.filter(s => {
      const name = (s.name || '').toLowerCase();
      const id = (s.id || '').toLowerCase();
      const slug = (s.slug || '').toLowerCase();
      const display = getServiceDisplayName(s.id, s.name).toLowerCase();
      return name.includes(q) || id.includes(q) || slug.includes(q) || display.includes(q);
    });
  }, [services, priceServiceSearchQuery]);

  const filteredPriceCountries = useMemo(() => {
    const q = priceCountrySearchQuery.toLowerCase().trim();
    if (!q) {
      return countries;
    }
    return countries.filter(c => {
      const name = (c.name || '').toLowerCase();
      const id = (c.id || '').toLowerCase();
      const code = (c.code || '').toLowerCase();
      return name.includes(q) || id.includes(q) || code.includes(q);
    });
  }, [countries, priceCountrySearchQuery]);

  const selectedPriceCountryObj = countries.find(c => c.id === priceCountry || c.code === priceCountry);
  const selectedPriceServiceObj = services.find(s => s.id === priceService || s.slug === priceService);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const formatDateSimple = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()} ${months[d.getMonth()]} • ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return dateStr || '';
    }
  };

  const formatPhoneNumber = (phone: string | number | null | undefined): string => {
    if (!phone) return '';
    const digits = String(phone).replace(/[^\d]/g, '');
    return digits ? `+${digits}` : '';
  };

  const getRefundCountdown = (order: any) => {
    if (order.status !== 'WAITING' || order.code || order.refunded) {
      return { eligible: false, remainingSeconds: 0, text: '' };
    }
    const createdMs = order.createdAtMs || (order.createdAt ? new Date(order.createdAt).getTime() : 0);
    const availableMs = order.refundAvailableAtMs || (createdMs ? createdMs + 15 * 60 * 1000 : 0);
    const diffMs = Math.max(0, availableMs - currentTime);
    const remainingSec = Math.ceil(diffMs / 1000);
    const eligible = remainingSec === 0;
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    const text = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    return { eligible, remainingSeconds: remainingSec, text };
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      
      {/* 1. TOP HEADER & WALLET BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-[#E9E2FA] shadow-xs zenet-card-enter">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBackToMarketplace}
            className="w-10 h-10 bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#171329] rounded-2xl transition cursor-pointer border border-[#E9E2FA] flex items-center justify-center shrink-0 active:scale-95 shadow-2xs zenet-btn-interactive"
            title="Back to Marketplace"
          >
            <ArrowLeft className="w-5 h-5 text-[#171329]" />
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#171329]">
                Service Numbers
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FAF8FE] border border-[#E9E2FA] text-[#6D28D9]">
                VirtualSMS
              </span>
            </div>
            <p className="text-xs text-[#64748B] font-medium">
              Instant OTP activation and real-time carrier virtual numbers
            </p>
          </div>
        </div>

        {/* Wallet Balance & Action */}
        <div className="flex items-center space-x-3 self-end sm:self-auto">
          <div className="flex items-center space-x-2 bg-[#FAF8FE] border border-[#E9E2FA] px-3.5 py-1.5 rounded-2xl zenet-card-interactive">
            <span className="text-xs font-medium text-[#64748B]">Balance:</span>
            <span className="text-sm font-black text-[#6D28D9]">
              ₦{Number(walletBalance || 0).toLocaleString()}
            </span>
            <button
              onClick={onOpenWallet}
              className="p-1 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-lg transition cursor-pointer"
              title="Top Up Wallet"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={() => setIsPriceSectionOpen(prev => !prev)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-2xl border transition cursor-pointer ${
                isPriceSectionOpen 
                  ? 'bg-[#6D28D9] text-white border-[#6D28D9] shadow-xs' 
                  : 'bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#6D28D9] hover:text-[#5B21B6] border-[#E9E2FA]'
              }`}
            >
              Price
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setIsOwnerSettingsOpen(true)}
              className="p-2.5 bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#171329] rounded-2xl border border-[#E9E2FA] transition cursor-pointer"
              title="Pricing Engine Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {infoMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-4 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{infoMessage}</span>
          </div>
          <button onClick={() => setInfoMessage('')} className="text-emerald-700 hover:text-emerald-900 font-extrabold cursor-pointer">×</button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold p-4 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-700 hover:text-rose-900 font-extrabold cursor-pointer">×</button>
        </div>
      )}

      {/* API Connection Error Fallback Banner */}
      {apiConnectionError && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900">VirtualSMSNumbers Gateway Notice</p>
              <p className="text-xs text-amber-700">{apiConnectionError}</p>
            </div>
          </div>
          <button
            onClick={loadInitialData}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* OWNER PRICE MANAGEMENT SECTION (UNDER THE NOTIFICATION) */}
      {isOwner && isPriceSectionOpen && (
        <div className="bg-white border-2 border-[#6D28D9]/25 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 max-h-[85vh] sm:max-h-[680px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
          
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#E9E2FA] pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-2xl bg-[#FAF8FE] border border-[#E9E2FA] flex items-center justify-center text-[#6D28D9] font-black text-base shadow-2xs">
                ₦
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base sm:text-lg font-black text-[#171329] tracking-tight">
                    Price Management
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE]">
                    Owner Only
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Select a service &amp; country to view VirtualSMS provider price and manage your selling price.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPriceSectionOpen(false)}
              className="p-2 text-[#64748B] hover:text-[#171329] hover:bg-[#FAF8FE] rounded-xl border border-[#E9E2FA] transition cursor-pointer"
              title="Close Price Management"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Searchable Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Field 1: Select service */}
            <div className="space-y-1.5" ref={priceServiceDropdownRef}>
              <label className="text-xs font-bold text-[#171329] block">
                Select service
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsPriceServiceDropdownOpen(prev => !prev);
                    setIsPriceCountryDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between bg-[#FAF8FE] hover:bg-[#F3F0FA] border border-[#E9E2FA] p-3 rounded-2xl text-left transition cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    {priceService ? (
                      <>
                        <ServiceLogo
                          serviceId={priceService}
                          serviceName={selectedPriceServiceObj?.name}
                          category={selectedPriceServiceObj?.category}
                          size="md"
                        />
                        <span className="text-xs sm:text-sm font-bold text-[#171329] truncate">
                          {getServiceDisplayName(priceService, selectedPriceServiceObj?.name)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-7 h-7 rounded-lg bg-white border border-[#E9E2FA] flex items-center justify-center text-xs font-bold text-[#64748B] shadow-2xs shrink-0">
                          #
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#64748B] truncate">
                          Select service
                        </span>
                      </>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${isPriceServiceDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isPriceServiceDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E9E2FA] rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={priceServiceSearchQuery}
                        onChange={(e) => setPriceServiceSearchQuery(e.target.value)}
                        placeholder="Search service..."
                        className="w-full pl-9 pr-8 py-2 bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl text-xs font-medium text-[#171329] focus:outline-none focus:border-[#6D28D9]"
                        autoFocus
                      />
                      {priceServiceSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setPriceServiceSearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-xs text-[#64748B] hover:text-[#171329]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {filteredPriceServices.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[#64748B]">
                          No services found matching &quot;{priceServiceSearchQuery}&quot;
                        </div>
                      ) : (
                        filteredPriceServices.map(s => {
                          const serviceKey = (s as any).slug || s.id;
                          const isSelected = priceService === serviceKey;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setPriceService(serviceKey);
                                setIsPriceServiceDropdownOpen(false);
                                setPriceServiceSearchQuery('');
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition cursor-pointer ${
                                isSelected ? 'bg-[#FAF8FE] text-[#6D28D9] font-bold border border-[#E9E2FA]' : 'hover:bg-[#FAF8FE] text-[#171329]'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 truncate">
                                <ServiceLogo
                                  serviceId={s.id}
                                  serviceName={s.name}
                                  category={s.category}
                                  size="sm"
                                />
                                <span className="truncate">{getServiceDisplayName(s.id, s.name)}</span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#6D28D9] shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Field 2: 🌐 Select country */}
            <div className="space-y-1.5" ref={priceCountryDropdownRef}>
              <label className="text-xs font-bold text-[#171329] block">
                🌐 Select country
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsPriceCountryDropdownOpen(prev => !prev);
                    setIsPriceServiceDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between bg-[#FAF8FE] hover:bg-[#F3F0FA] border border-[#E9E2FA] p-3 rounded-2xl text-left transition cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    {priceCountry ? (
                      <>
                        <span className="text-lg shrink-0">
                          {getCountryFlagEmoji(priceCountry)}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[#171329] truncate">
                          {selectedPriceCountryObj?.name || priceCountry}
                        </span>
                        <span className="text-xs text-[#64748B] font-mono">
                          {getCountryDialCode(priceCountry, selectedPriceCountryObj?.name, selectedPriceCountryObj?.code)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-7 h-7 rounded-lg bg-white border border-[#E9E2FA] flex items-center justify-center text-base shadow-2xs shrink-0">
                          🌐
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#64748B] truncate">
                          🌐 Select country
                        </span>
                      </>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${isPriceCountryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isPriceCountryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E9E2FA] rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={priceCountrySearchQuery}
                        onChange={(e) => setPriceCountrySearchQuery(e.target.value)}
                        placeholder="Search country or dial code..."
                        className="w-full pl-9 pr-8 py-2 bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl text-xs font-medium text-[#171329] focus:outline-none focus:border-[#6D28D9]"
                        autoFocus
                      />
                      {priceCountrySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setPriceCountrySearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-xs text-[#64748B] hover:text-[#171329]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {filteredPriceCountries.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[#64748B]">
                          No countries found matching &quot;{priceCountrySearchQuery}&quot;
                        </div>
                      ) : (
                        filteredPriceCountries.map(c => {
                          const isSelected = priceCountry === c.id;
                          const flag = c.flag || getCountryFlagEmoji(c.code || c.id);
                          const dial = getCountryDialCode(c.id, c.name, c.code);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setPriceCountry(c.id);
                                setIsPriceCountryDropdownOpen(false);
                                setPriceCountrySearchQuery('');
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition cursor-pointer ${
                                isSelected ? 'bg-[#FAF8FE] text-[#6D28D9] font-bold border border-[#E9E2FA]' : 'hover:bg-[#FAF8FE] text-[#171329]'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span className="text-base shrink-0">{flag}</span>
                                <span className="truncate">{c.name}</span>
                                {dial && <span className="text-[10px] text-[#64748B] font-mono shrink-0">({dial})</span>}
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#6D28D9] shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* PRICING DETAILS & ADJUSTMENT */}
          {(!priceService || !priceCountry) ? (
            <div className="p-4 bg-[#FAF8FE] border border-[#E9E2FA] rounded-2xl text-center text-xs text-[#64748B]">
              Please select both a service and country above to view the provider&apos;s price and set your selling price.
            </div>
          ) : priceSectionLoading ? (
            <div className="p-6 bg-[#FAF8FE] border border-[#E9E2FA] rounded-2xl flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#6D28D9]" />
              <p className="text-xs font-bold text-[#171329]">Loading price from VirtualSMSNumbers...</p>
            </div>
          ) : priceSectionProviderCost !== null ? (
            <div className="bg-[#FAF8FE] border border-[#E9E2FA] rounded-2xl p-4 sm:p-5 space-y-4">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Provider Price Card */}
                <div className="bg-white border border-[#E9E2FA] rounded-xl p-3.5 shadow-2xs">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                    Provider&apos;s Price (VirtualSMS)
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#171329] mt-1">
                    ₦{priceSectionProviderCost.toLocaleString()}
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-1">
                    {priceSectionProviderCost > 0
                      ? 'Minimum allowable selling price. VirtualSMS charges this exact cost.'
                      : 'Provider stock is currently 0. Minimum restriction applies when stock arrives.'}
                  </p>
                </div>

                {/* Current Selling Price Card */}
                <div className="bg-white border border-[#E9E2FA] rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                      Current Selling Price
                    </span>
                    {priceSectionHasCustomPrice && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#6D28D9] mt-1">
                    ₦{(priceSectionCurrentPrice ?? priceSectionProviderCost).toLocaleString()}
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-1">
                    What customers currently pay for this selection.
                  </p>
                </div>

                {/* Provider Stock Card */}
                <div className="bg-white border border-[#E9E2FA] rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                      Provider Stock
                    </span>
                    {priceSectionStock !== null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        priceSectionStock > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {priceSectionStock > 0 ? 'In Stock' : 'Out of Stock'}
                      </span>
                    )}
                  </div>
                  <div className={`text-xl sm:text-2xl font-black mt-1 ${
                    (priceSectionStock ?? 0) > 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {priceSectionStock !== null ? `${priceSectionStock.toLocaleString()} numbers` : 'Checking...'}
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-1">
                    {(priceSectionStock ?? 0) > 0
                      ? 'Live available inventory from VirtualSMS.'
                      : 'Currently 0 stock from provider. Your saved price applies when stock arrives.'}
                  </p>
                </div>
              </div>

              {/* Set or Increase/Decrease Selling Price */}
              <div className="bg-white border border-[#E9E2FA] rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#171329]">
                    Set Your Selling Price (₦)
                  </label>
                  <div className="text-xs font-bold text-emerald-700">
                    Profit: ₦{Math.max(0, (priceSectionInputPrice || 0) - priceSectionProviderCost).toLocaleString()}
                  </div>
                </div>

                {/* Stepper Input */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPriceSectionInputPrice(prev => Math.max(priceSectionProviderCost, (prev || priceSectionProviderCost) - 50));
                    }}
                    disabled={priceSectionInputPrice <= priceSectionProviderCost}
                    className="w-10 h-10 rounded-xl bg-[#FAF8FE] hover:bg-[#EDE9FE] disabled:opacity-40 disabled:hover:bg-[#FAF8FE] border border-[#E9E2FA] flex items-center justify-center font-black text-lg text-[#171329] transition cursor-pointer shrink-0"
                    title="Decrease price by ₦50"
                  >
                    -
                  </button>

                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-2.5 text-sm font-black text-[#64748B]">₦</span>
                    <input
                      type="number"
                      min={priceSectionProviderCost}
                      step="1"
                      value={priceSectionInputPrice || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setPriceSectionInputPrice(isNaN(val) ? 0 : val);
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl text-sm font-black text-[#171329] focus:outline-none focus:border-[#6D28D9]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPriceSectionInputPrice(prev => (prev || priceSectionProviderCost) + 50);
                    }}
                    className="w-10 h-10 rounded-xl bg-[#FAF8FE] hover:bg-[#EDE9FE] border border-[#E9E2FA] flex items-center justify-center font-black text-lg text-[#171329] transition cursor-pointer shrink-0"
                    title="Increase price by ₦50"
                  >
                    +
                  </button>
                </div>

                {/* Quick step increment/decrement chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPriceSectionInputPrice(priceSectionProviderCost)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#6D28D9] border border-[#E9E2FA] rounded-lg transition cursor-pointer"
                  >
                    Minimum (₦{priceSectionProviderCost.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceSectionInputPrice(prev => (prev || priceSectionProviderCost) + 50)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#171329] border border-[#E9E2FA] rounded-lg transition cursor-pointer"
                  >
                    +₦50
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceSectionInputPrice(prev => (prev || priceSectionProviderCost) + 100)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#171329] border border-[#E9E2FA] rounded-lg transition cursor-pointer"
                  >
                    +₦100
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceSectionInputPrice(prev => (prev || priceSectionProviderCost) + 200)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#171329] border border-[#E9E2FA] rounded-lg transition cursor-pointer"
                  >
                    +₦200
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceSectionInputPrice(prev => (prev || priceSectionProviderCost) + 500)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#171329] border border-[#E9E2FA] rounded-lg transition cursor-pointer"
                  >
                    +₦500
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceSectionInputPrice(prev => (prev || priceSectionProviderCost) + 1000)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#171329] border border-[#E9E2FA] rounded-lg transition cursor-pointer"
                  >
                    +₦1,000
                  </button>
                </div>

                {/* Minimum Price Restriction Warning */}
                {priceSectionProviderCost !== null && priceSectionProviderCost > 0 && priceSectionInputPrice < priceSectionProviderCost && (
                  <div className="flex items-center space-x-2 text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-xs font-bold animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Selling price cannot be below the provider&apos;s price of ₦{priceSectionProviderCost.toLocaleString()}.
                    </span>
                  </div>
                )}
              </div>

              {/* Success / Error Messages */}
              {priceSectionSuccessMsg && (
                <div className="flex items-center space-x-2 text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs font-bold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{priceSectionSuccessMsg}</span>
                </div>
              )}
              {priceSectionErrorMsg && (
                <div className="flex items-center space-x-2 text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs font-bold animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{priceSectionErrorMsg}</span>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                {priceSectionHasCustomPrice ? (
                  <button
                    type="button"
                    disabled={priceSectionResetting || priceSectionSaving}
                    onClick={handleResetCustomPrice}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1"
                  >
                    {priceSectionResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Reset to Provider Cost</span>
                  </button>
                ) : <div />}

                <button
                  type="button"
                  disabled={priceSectionSaving || priceSectionResetting || (priceSectionProviderCost !== null && priceSectionProviderCost > 0 && priceSectionInputPrice < priceSectionProviderCost)}
                  onClick={handleSaveCustomPrice}
                  className="px-5 py-2.5 bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center space-x-2 shadow-xs"
                >
                  {priceSectionSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Price...</span>
                    </>
                  ) : (
                    <span>Save Price</span>
                  )}
                </button>
              </div>

            </div>
          ) : (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold">
              {priceSectionErrorMsg || 'Could not load pricing details for this selection.'}
            </div>
          )}

        </div>
      )}

      {/* 2. MAIN DASHBOARD: QUICK BUY AT TOP, NUMBER HISTORY UNDERNEATH */}
      <div className="space-y-6">
        
        {/* QUICK BUY PANEL (AT TOP) */}
        <div className="space-y-4">
          
          <div className="bg-white border border-[#E9E2FA] rounded-3xl p-5 sm:p-6 shadow-md space-y-5 relative">
            
            {/* Quick Buy Header */}
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-[#FAF8FE] border border-[#E9E2FA] flex items-center justify-center text-[#6D28D9]">
                  <Zap className="w-4 h-4 fill-[#6D28D9]" />
                </div>
                <h3 className="text-lg font-black text-[#171329] tracking-tight">
                  Quick buy
                </h3>
              </div>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                Select a service and country to receive an instant verification code.
              </p>
            </div>

            {/* FORM 1: SERVICE SEARCHABLE DROPDOWN */}
            <div className="space-y-1.5" ref={serviceDropdownRef}>
              <label className="text-xs font-bold text-[#171329] block">
                Service
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsServiceDropdownOpen(!isServiceDropdownOpen);
                    setIsCountryDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between bg-[#FAF8FE] hover:bg-[#F3F0FA] border border-[#E9E2FA] p-3 rounded-2xl text-left transition cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    {selectedService ? (
                      <>
                        <ServiceLogo
                          serviceId={selectedService}
                          serviceName={selectedServiceObj?.name}
                          category={selectedServiceObj?.category}
                          size="md"
                        />
                        <span className="text-xs sm:text-sm font-bold text-[#171329] truncate">
                          {getServiceDisplayName(selectedService, selectedServiceObj?.name)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-7 h-7 rounded-lg bg-white border border-[#E9E2FA] flex items-center justify-center text-xs font-bold text-[#64748B] shadow-2xs shrink-0">
                          #
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#64748B] truncate">
                          Select service
                        </span>
                      </>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isServiceDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E9E2FA] rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95">
                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={serviceSearchQuery}
                        onChange={(e) => setServiceSearchQuery(e.target.value)}
                        placeholder="Search a service..."
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl text-xs font-medium text-[#171329] focus:outline-none focus:border-[#6D28D9]"
                        autoFocus
                      />
                      {serviceSearchQuery && (
                        <button
                          onClick={() => setServiceSearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-xs text-[#64748B] hover:text-[#171329]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Services Scroll List */}
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {filteredServices.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[#64748B]">
                          No services found matching &quot;{serviceSearchQuery}&quot;
                        </div>
                      ) : (
                        filteredServices.map(s => {
                          const isSelected = selectedService === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedService(s.id);
                                setIsServiceDropdownOpen(false);
                                setServiceSearchQuery('');
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition cursor-pointer ${
                                isSelected ? 'bg-[#FAF8FE] text-[#6D28D9] font-bold border border-[#E9E2FA]' : 'hover:bg-[#FAF8FE] text-[#171329]'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 truncate">
                                <ServiceLogo
                                  serviceId={s.id}
                                  serviceName={s.name}
                                  category={s.category}
                                  size="sm"
                                />
                                <span className="truncate">{getServiceDisplayName(s.id, s.name)}</span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#6D28D9] shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FORM 2: COUNTRY SEARCHABLE DROPDOWN (WITH "CHEAPEST AVAILABLE" TOP OPTION) */}
            <div className="space-y-1.5" ref={countryDropdownRef}>
              <label className="text-xs font-bold text-[#171329] block">
                Country
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsCountryDropdownOpen(!isCountryDropdownOpen);
                    setIsServiceDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between bg-[#FAF8FE] hover:bg-[#F3F0FA] border border-[#E9E2FA] p-3 rounded-2xl text-left transition cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    {!selectedCountry ? (
                      <>
                        <div className="w-7 h-7 rounded-lg bg-white border border-[#E9E2FA] flex items-center justify-center text-base shadow-2xs shrink-0">
                          🌐
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#64748B] truncate">
                          Select country
                        </span>
                      </>
                    ) : selectedCountry === 'cheapest' ? (
                      <>
                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                          ★
                        </div>
                        <div className="truncate">
                          <span className="text-xs sm:text-sm font-bold text-[#171329] block truncate">
                            Cheapest available
                          </span>
                          {resolvedCheapestCountry && (
                            <span className="text-[10px] text-[#6D28D9] font-semibold block">
                              Auto-selected: {resolvedCheapestCountry.flag} {resolvedCheapestCountry.name} ({resolvedCheapestCountry.code})
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-lg shrink-0">
                          {getCountryFlagEmoji(selectedCountry)}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[#171329] truncate">
                          {selectedCountryObj?.name || selectedCountry}
                        </span>
                        <span className="text-xs text-[#64748B] font-mono">
                          {getCountryDialCode(selectedCountry, selectedCountryObj?.name, selectedCountryObj?.code)}
                        </span>
                      </>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${isCountryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isCountryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E9E2FA] rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95">
                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={countrySearchQuery}
                        onChange={(e) => setCountrySearchQuery(e.target.value)}
                        placeholder="Search a country..."
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl text-xs font-medium text-[#171329] focus:outline-none focus:border-[#6D28D9]"
                        autoFocus
                      />
                      {countrySearchQuery && (
                        <button
                          onClick={() => setCountrySearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-xs text-[#64748B] hover:text-[#171329]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Countries Scroll List */}
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      
                      {/* Top Sticky Option: "Cheapest available" */}
                      {(!countrySearchQuery || 'cheapest available'.includes(countrySearchQuery.toLowerCase())) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCountry('cheapest');
                            setIsCountryDropdownOpen(false);
                            setCountrySearchQuery('');
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition cursor-pointer mb-1 ${
                            selectedCountry === 'cheapest' ? 'bg-[#FAF8FE] text-[#6D28D9] font-bold border border-[#E9E2FA]' : 'bg-amber-50/50 hover:bg-amber-50 text-[#171329]'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <span className="text-amber-500 font-bold text-sm">★</span>
                            <span className="font-bold">Cheapest available</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                              Lowest rate
                            </span>
                          </div>
                          {selectedCountry === 'cheapest' && <Check className="w-4 h-4 text-[#6D28D9] shrink-0" />}
                        </button>
                      )}

                      {/* All Countries List */}
                      {filteredCountries.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[#64748B]">
                          No countries found matching &quot;{countrySearchQuery}&quot;
                        </div>
                      ) : (
                        filteredCountries.map(c => {
                          const isSelected = selectedCountry === c.id;
                          const dial = getCountryDialCode(c.id, c.name, c.code);

                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c.id);
                                setIsCountryDropdownOpen(false);
                                setCountrySearchQuery('');
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition cursor-pointer ${
                                isSelected ? 'bg-[#FAF8FE] text-[#6D28D9] font-bold border border-[#E9E2FA]' : 'hover:bg-[#FAF8FE] text-[#171329]'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span className="text-base shrink-0">{c.flag || getCountryFlagEmoji(c.id)}</span>
                                <span className="font-medium truncate">{c.name}</span>
                              </div>
                              <div className="flex items-center space-x-2 shrink-0">
                                <span className="text-[11px] text-[#64748B] font-mono">{dial}</span>
                                {isSelected && <Check className="w-4 h-4 text-[#6D28D9]" />}
                              </div>
                            </button>
                          );
                        })
                      )}

                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* LIVE PRICE & STOCK CARD */}
            <div className="bg-[#FAF8FE] border border-[#E9E2FA] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Actual Price (NGN)
                  </span>
                  <div className="flex items-baseline space-x-1.5 mt-0.5">
                    {!selectedService || !selectedCountry ? (
                      <span className="text-xs font-semibold text-[#64748B] py-1">
                        Select service & country
                      </span>
                    ) : priceLoading ? (
                      <div className="flex items-center space-x-1.5 text-xs text-[#6D28D9] font-bold py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Calculating best price...</span>
                      </div>
                    ) : isPriceAvailable ? (
                      <>
                        <span className="text-2xl font-black text-[#6D28D9]">
                          ₦{calculatedPrice.toLocaleString()}
                        </span>
                        <span className="text-xs text-[#64748B] font-medium">/ 1 SMS</span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-rose-600">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock indicator */}
                <div className="text-right">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Stock
                  </span>
                  {!selectedService || !selectedCountry ? (
                    <span className="text-xs text-[#64748B]">—</span>
                  ) : priceLoading ? (
                    <span className="text-xs text-[#64748B]">Checking...</span>
                  ) : isPriceAvailable ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      ● {availableStock > 0 ? `${availableStock}+ in stock` : 'Available'}
                    </span>
                  ) : (
                    <span className="text-xs text-rose-600 font-bold">0 stock</span>
                  )}
                </div>
              </div>

              {!selectedService || !selectedCountry ? (
                <p className="text-[11px] text-[#64748B] font-medium leading-tight">
                  {!selectedService && !selectedCountry 
                    ? 'Please choose a service and country above to view live number prices.'
                    : !selectedService
                    ? 'Please select a service above to see available numbers.'
                    : 'Please select a country above to see available numbers.'}
                </p>
              ) : priceErrorMessage ? (
                <p className="text-[11px] text-rose-600 font-medium leading-tight">
                  {priceErrorMessage}
                </p>
              ) : null}

              {selectedService && selectedCountry && priceOptions.length > 1 && (
                <div className="pt-2 border-t border-[#E9E2FA] space-y-1.5">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Carrier Route Options
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {priceOptions.slice(0, 4).map((opt) => {
                      const isOptSelected = selectedOptionId === opt.optionId;
                      return (
                        <button
                          key={opt.optionId}
                          type="button"
                          onClick={() => {
                            setSelectedOptionId(opt.optionId);
                            setCalculatedPrice(opt.customerPrice);
                          }}
                          className={`p-2 rounded-xl text-left border transition cursor-pointer text-xs ${
                            isOptSelected
                              ? 'bg-white border-[#6D28D9] text-[#6D28D9] font-bold shadow-2xs ring-1 ring-[#6D28D9]'
                              : 'bg-white/80 border-[#E9E2FA] text-[#171329] hover:border-[#6D28D9]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="truncate">{opt.tierName}</span>
                            <span className="font-black">₦{opt.customerPrice.toLocaleString()}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* BUY NUMBER BUTTON */}
            <div>
              <button
                type="button"
                onClick={handleBuyNumber}
                disabled={buyingLoading || priceLoading || !isPriceAvailable || !selectedService || !selectedCountry}
                className={`w-full py-4 px-5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer ${
                  buyingLoading || priceLoading || !isPriceAvailable || !selectedService || !selectedCountry
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                    : 'bg-[#6D28D9] hover:bg-[#5B21B6] text-white active:scale-[0.99] shadow-purple-600/25'
                }`}
              >
                {!selectedService ? (
                  <span>Select a Service</span>
                ) : !selectedCountry ? (
                  <span>Select a Country</span>
                ) : buyingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Allocating Number...</span>
                  </>
                ) : priceLoading ? (
                  <span>Checking Availability...</span>
                ) : !isPriceAvailable ? (
                  <span>No Numbers Available</span>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 mr-1.5" />
                    <span>Buy Number (₦{calculatedPrice.toLocaleString()})</span>
                  </>
                )}
              </button>

              {comingSoonNotice && (
                <div className="mt-3 p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-center space-y-1 animate-in fade-in">
                  <p className="text-xs font-bold text-[#6D28D9] leading-relaxed">
                    {comingSoonNotice}
                  </p>
                </div>
              )}
            </div>

            {/* Security Assurance Footer */}
            <div className="flex items-center justify-center space-x-1.5 text-[11px] text-[#64748B] pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Instant OTP delivery · Auto-refunded if no SMS arrives</span>
            </div>

          </div>

        </div>

        {/* SECURITY & REFUND POLICY NOTICE */}
        <div className="bg-[#FAF8FE] border border-[#E9E2FA] rounded-3xl p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-[#6D28D9] shrink-0">
              <ShieldCheck className="w-4 h-4 text-[#6D28D9]" />
            </div>
            <h4 className="text-xs font-black text-[#171329] uppercase tracking-wider">
              SECURITY &amp; REFUND POLICY
            </h4>
          </div>
          <ul className="text-xs text-[#64748B] space-y-1.5 list-disc list-inside font-medium leading-relaxed pl-1">
            <li>Refund requests become available after 15 minutes, subject to provider verification.</li>
            <li>Activations that have received an OTP are not refundable.</li>
            <li>Refunds are processed only after successful provider cancellation and eligibility verification.</li>
            <li>Never share your OTP with anyone.</li>
          </ul>
        </div>

        {/* ORDERS HISTORY / NUMBER HISTORY SECTION (MOVED BELOW QUICK BUY) */}
        <div className="space-y-6">
          
          {/* Orders History Section */}
          <div className="bg-white border border-[#E9E2FA] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E9E2FA] pb-4">
              <div>
                <h3 className="text-base font-black text-[#171329] tracking-tight">
                  Purchased Numbers History
                </h3>
                <p className="text-xs text-[#64748B]">
                  Your past virtual numbers, delivered OTPs, and receipts
                </p>
              </div>
              <button
                onClick={fetchOrders}
                disabled={ordersLoading}
                className="p-2 text-[#6D28D9] hover:bg-[#FAF8FE] rounded-xl transition cursor-pointer border border-[#E9E2FA]"
                title="Refresh history"
              >
                <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {ordersLoading && orders.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B] flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#6D28D9]" />
                <span>Loading your orders...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                <FileText className="w-8 h-8 text-[#E9E2FA] mx-auto mb-2" />
                No purchase history yet. Your purchased numbers will appear here.
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 10).map((o) => {
                  const hasValidCode = isValidOtpCode(o.code);
                  const isCompleted = hasValidCode || o.status === 'COMPLETED';
                  const isCancelled = o.status === 'CANCELLED' || o.status === 'cancelled' || o.status === 'EXPIRED' || o.status === 'expired';
                  const displayPhone = formatPhoneNumber(o.phoneNumber);
                  const activationId = o.providerOrderId || o.providerActivationId;

                  return (
                    <div
                      key={o.orderId || o.id}
                      className="bg-[#FAF8FE] border border-[#E9E2FA] rounded-2xl p-4 space-y-3 transition hover:border-[#6D28D9]/40"
                    >
                      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ServiceLogo
                            serviceId={o.serviceSlug || o.service}
                            serviceName={o.serviceName}
                            size="xs"
                          />
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full text-white bg-[#6D28D9] uppercase tracking-wider">
                            {getServiceDisplayName(o.serviceSlug || o.service)}
                          </span>
                          <span className="font-semibold text-[#171329]">
                            {getCountryFlagEmoji(o.country)} {o.country}
                          </span>
                          {activationId && (
                            <span className="text-[10px] font-mono text-[#64748B] bg-white border border-[#E9E2FA] px-1.5 py-0.5 rounded">
                              ID: {activationId}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#64748B]">
                          {formatDateSimple(o.createdAt)}
                        </span>
                      </div>

                      {/* Number & Copy Row */}
                      <div className="flex items-center justify-between bg-white border border-[#E9E2FA] p-3 rounded-xl">
                        <span className="text-base font-black text-[#6D28D9] font-mono tracking-wider">
                          {displayPhone}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(displayPhone, o.orderId || o.id)}
                          className="flex items-center space-x-1 px-2.5 py-1 bg-[#FAF8FE] hover:bg-[#EDE9FE] border border-[#E9E2FA] text-[#171329] rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          {copiedText === (o.orderId || o.id) ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#6D28D9]" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Status and OTP */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-[#E9E2FA]">
                        <div>
                          {hasValidCode ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-[11px] font-bold text-emerald-800">OTP:</span>
                              <span className="font-mono font-black text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded-md">
                                {o.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(o.code, `${o.orderId || o.id}-code`)}
                                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                                title="Copy OTP"
                              >
                                {copiedText === `${o.orderId || o.id}-code` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : isCancelled ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              REFUNDED / EXPIRED
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 animate-pulse">
                                WAITING FOR OTP
                              </span>
                              {(() => {
                                const { eligible, text } = getRefundCountdown(o);
                                if (!eligible) {
                                  return (
                                    <button
                                      type="button"
                                      disabled
                                      className="text-[10px] text-gray-500 bg-gray-100 border border-gray-200 font-bold px-2.5 py-1 rounded-lg cursor-not-allowed flex items-center space-x-1"
                                      title={`Refund unlocks after 15 minutes of carrier waiting. Remaining: ${text}`}
                                    >
                                      <Clock className="w-3 h-3 text-gray-400" />
                                      <span>Refund in {text}</span>
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelOrder(o)}
                                    disabled={cancellingLoading}
                                    className="text-[10px] text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-bold px-2.5 py-1 rounded-lg cursor-pointer transition flex items-center space-x-1 active:scale-95"
                                    title="Cancel order and refund to wallet"
                                  >
                                    {cancellingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    <span>Cancel &amp; Refund</span>
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[#6D28D9]">
                            ₦{(Number(o.customerPrice || o.price || 0)).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedService(o.serviceSlug || o.service);
                              setSelectedCountry(o.country || o.countryCode || 'cheapest');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-[11px] text-[#6D28D9] hover:underline font-bold cursor-pointer"
                          >
                            Buy Again
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

      </div>

      {/* OWNER PRICING ENGINE MODAL */}
      {isOwner && isOwnerSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E9E2FA] rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 text-[#171329]">
            
            <div className="flex items-center justify-between border-b border-[#E9E2FA] pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-[#6D28D9] rounded-2xl shadow-sm text-white">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-[#171329] tracking-tight">
                    Virtual Number Pricing Engine
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Control wholesale EUR &rarr; NGN conversion and profit margins
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOwnerSettingsOpen(false)}
                className="p-2 bg-[#FAF8FE] hover:bg-[#EDE9FE] text-[#64748B] hover:text-[#171329] rounded-xl transition cursor-pointer border border-[#E9E2FA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settingsSaveSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-xl flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{settingsSaveSuccess}</span>
              </div>
            )}

            <div className="space-y-4 text-xs font-bold text-[#171329]">
              
              {/* VirtualSMSNumbers Upstream Provider Account Card */}
              <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-[#6D28D9]" />
                    <span className="font-bold text-[#6D28D9] text-xs uppercase tracking-wider">VirtualSMSNumbers Upstream Gateway</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    providerBalanceInfo?.canPurchase ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {providerBalanceInfo?.canPurchase ? 'Active' : '€30.00 Top-Up Required'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-medium text-[#475569]">
                  <div>Account: <span className="font-bold text-[#171329]">{providerBalanceInfo?.accountEmail || 'zenethubofficial@gmail.com'}</span></div>
                  <div>Balance: <span className="font-bold text-[#171329]">€{providerBalanceInfo?.balanceEur || '0.00'} EUR</span></div>
                </div>
                {!providerBalanceInfo?.canPurchase && (
                  <p className="text-[11px] text-amber-800 leading-normal pt-1">
                    VirtualSMSNumbers requires an initial top-up of at least €30.00 on <a href="https://virtualsmsnumbers.com/dashboard/billing" target="_blank" rel="noopener noreferrer" className="underline font-bold text-[#6D28D9]">virtualsmsnumbers.com</a> before live numbers can be purchased via API.
                  </p>
                )}
              </div>

              {/* Zero Markup Status Notice */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] leading-relaxed">
                <span className="font-bold">Zero Profit Markup Active:</span> Profit margins and tier markups are disabled for VirtualSMSNumbers. Customers see 100% exact converted provider wholesale cost (Provider EUR × Rate) with no additional fee.
              </div>

              {/* EUR to NGN Rate */}
              <div className="space-y-1.5">
                <label className="block text-[#64748B]">
                  EUR &rarr; NGN Exchange Rate
                </label>
                <input
                  type="number"
                  value={ownerSettings.eurToNgnRate || 1750}
                  onChange={(e) => setOwnerSettings(prev => ({ ...prev, eurToNgnRate: Number(e.target.value) }))}
                  className="w-full p-3 bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl text-sm font-bold text-[#171329] focus:outline-none focus:border-[#6D28D9]"
                />
              </div>

              {/* Minimum Markup */}
              <div className="space-y-1.5">
                <label className="block text-[#64748B]">
                  Minimum Profit Markup (₦)
                </label>
                <input
                  type="number"
                  value={ownerSettings.minMarkup || 500}
                  onChange={(e) => setOwnerSettings(prev => ({ ...prev, minMarkup: Number(e.target.value) }))}
                  className="w-full p-3 bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl text-sm font-bold text-[#171329] focus:outline-none focus:border-[#6D28D9]"
                />
              </div>

              {/* Pricing Style */}
              <div className="space-y-1.5">
                <label className="block text-[#64748B]">
                  Price Rounding Style
                </label>
                <select
                  value={ownerSettings.pricingStyle || 'natural'}
                  onChange={(e) => setOwnerSettings(prev => ({ ...prev, pricingStyle: e.target.value as any }))}
                  className="w-full p-3 bg-[#FAF8FE] border border-[#E9E2FA] rounded-xl text-sm font-bold text-[#171329] focus:outline-none focus:border-[#6D28D9]"
                >
                  <option value="natural">Natural (Ends in ₦50, ₦80, ₦90)</option>
                  <option value="clean">Clean (Exact Multiples of ₦100)</option>
                  <option value="tiered">Tiered (Multiples of ₦50)</option>
                </select>
              </div>

            </div>

            <div className="pt-3 border-t border-[#E9E2FA] flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsOwnerSettingsOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isSavingSettings}
                onClick={async () => {
                  setIsSavingSettings(true);
                  try {
                    const headers = await getAuthHeaders();
                    await safeFetchJson('/api/onegridhub/pricing-settings', {
                      method: 'POST',
                      headers,
                      body: JSON.stringify(ownerSettings)
                    });
                    setSettingsSaveSuccess('Settings saved successfully!');
                    fetchPrice();
                    setTimeout(() => setSettingsSaveSuccess(''), 3000);
                  } catch (e: any) {
                    setErrorMessage('Failed to save settings: ' + e.message);
                  } finally {
                    setIsSavingSettings(false);
                  }
                }}
                className="px-5 py-2 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-xs"
              >
                {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Settings</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
