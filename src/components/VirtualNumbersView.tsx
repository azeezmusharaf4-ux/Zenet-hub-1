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
import { sanitizeApiErrorMessage } from '../utils/api';

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

interface VirtualNumbersViewProps {
  userProfile: UserProfile;
  walletBalance: number;
  onRefreshProfile: () => void;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
}

export const VirtualNumbersView: React.FC<VirtualNumbersViewProps> = ({
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet
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
  const [servers, setServers] = useState<Array<{ id: string; name: string }>>([]);
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
    if (!countryCodeOrName) return '🌐';
    const lower = countryCodeOrName.toLowerCase();
    if (lower.includes('united states') || lower === 'us' || lower === 'usa' || lower === '187') return '🇺🇸';
    if (lower.includes('united kingdom') || lower === 'gb' || lower === 'uk') return '🇬🇧';
    if (lower.includes('canada') || lower === 'ca') return '🇨🇦';
    if (lower.includes('nigeria') || lower === 'ng') return '🇳🇬';
    if (lower.includes('south africa') || lower === 'za') return '🇿🇦';
    if (lower.includes('germany') || lower === 'de') return '🇩🇪';
    if (lower.includes('france') || lower === 'fr') return '🇫🇷';
    if (lower.includes('ghana') || lower === 'gh') return '🇬🇭';
    if (lower.includes('kenya') || lower === 'ke') return '🇰🇪';
    if (lower.includes('netherlands') || lower === 'nl') return '🇳🇱';
    if (lower.includes('brazil') || lower === 'br') return '🇧🇷';
    if (lower.includes('india') || lower === 'in') return '🇮🇳';
    if (lower.includes('australia') || lower === 'au') return '🇦🇺';
    if (lower.includes('philippines') || lower === 'ph') return '🇵🇭';
    if (lower.includes('indonesia') || lower === 'id') return '🇮🇩';
    if (lower.includes('sweden') || lower === 'se') return '🇸🇪';
    if (lower.includes('italy') || lower === 'it') return '🇮🇹';
    if (lower.includes('spain') || lower === 'es') return '🇪🇸';
    if (lower.includes('poland') || lower === 'pl') return '🇵🇱';
    if (lower.includes('ukraine') || lower === 'ua') return '🇺🇦';
    if (lower.includes('russia') || lower === 'ru') return '🇷🇺';
    if (lower.includes('china') || lower === 'cn') return '🇨🇳';
    if (lower.includes('japan') || lower === 'jp') return '🇯🇵';
    if (lower.includes('korea') || lower === 'kr') return '🇰🇷';
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

  // Dynamic Country Dial Code / Phone number prefix helper
  const getCountryDialCode = (countryId: string, countryName?: string, existingCode?: string): string => {
    if (existingCode && existingCode.trim()) {
      return existingCode.startsWith('+') ? existingCode : `+${existingCode}`;
    }
    const idLower = (countryId || '').toLowerCase();
    const nameLower = (countryName || '').toLowerCase();
    
    if (idLower === '187' || idLower === 'us' || idLower === 'usa' || nameLower.includes('united states')) return '+1';
    if (idLower === 'gb' || idLower === 'uk' || nameLower.includes('united kingdom')) return '+44';
    if (idLower === 'ca' || nameLower.includes('canada')) return '+1';
    if (idLower === 'ng' || nameLower.includes('nigeria')) return '+234';
    if (idLower === 'gh' || nameLower.includes('ghana')) return '+233';
    if (idLower === 'za' || nameLower.includes('south africa')) return '+27';
    if (idLower === 'ke' || nameLower.includes('kenya')) return '+254';
    if (idLower === 'de' || nameLower.includes('germany')) return '+49';
    if (idLower === 'fr' || nameLower.includes('france')) return '+33';
    if (idLower === 'in' || nameLower.includes('india')) return '+91';
    if (idLower === 'au' || nameLower.includes('australia')) return '+61';
    if (idLower === 'br' || nameLower.includes('brazil')) return '+55';
    if (idLower === 'ph' || nameLower.includes('philippines')) return '+63';
    if (idLower === 'id' || nameLower.includes('indonesia')) return '+62';
    if (idLower === 'nl' || nameLower.includes('netherlands')) return '+31';
    if (idLower === 'es' || nameLower.includes('spain')) return '+34';
    if (idLower === 'it' || nameLower.includes('italy')) return '+39';
    if (idLower === 'se' || nameLower.includes('sweden')) return '+46';
    if (idLower === 'pl' || nameLower.includes('poland')) return '+48';
    if (idLower === 'ua' || nameLower.includes('ukraine')) return '+380';
    if (idLower === 'ru' || nameLower.includes('russia')) return '+7';
    if (idLower === 'cn' || nameLower.includes('china')) return '+86';
    if (idLower === 'jp' || nameLower.includes('japan')) return '+81';
    if (idLower === 'kr' || nameLower.includes('korea')) return '+82';
    if (idLower === 'tr' || nameLower.includes('turkey')) return '+90';
    if (idLower === 'ae' || nameLower.includes('emirates')) return '+971';
    if (idLower === 'sa' || nameLower.includes('saudi')) return '+966';
    if (idLower === 'eg' || nameLower.includes('egypt')) return '+20';
    if (idLower === 'mx' || nameLower.includes('mexico')) return '+52';
    if (idLower === 'co' || nameLower.includes('colombia')) return '+57';
    if (idLower === 'ar' || nameLower.includes('argentina')) return '+54';
    if (idLower === 'vn' || nameLower.includes('vietnam')) return '+84';
    if (idLower === 'th' || nameLower.includes('thailand')) return '+66';
    if (idLower === 'my' || nameLower.includes('malaysia')) return '+60';
    if (idLower === 'sg' || nameLower.includes('singapore')) return '+65';
    return '';
  };

  const DEFAULT_COUNTRIES: Array<{ id: string; name: string; code?: string }> = [
    { id: '187', name: 'United States', code: '+1' },
    { id: 'GB', name: 'United Kingdom', code: '+44' },
    { id: 'NG', name: 'Nigeria', code: '+234' },
    { id: 'CA', name: 'Canada', code: '+1' },
    { id: 'GH', name: 'Ghana', code: '+233' },
    { id: 'ZA', name: 'South Africa', code: '+27' },
    { id: 'KE', name: 'Kenya', code: '+254' },
    { id: 'DE', name: 'Germany', code: '+49' },
    { id: 'FR', name: 'France', code: '+33' },
    { id: 'IN', name: 'India', code: '+91' },
    { id: 'AU', name: 'Australia', code: '+61' },
    { id: 'BR', name: 'Brazil', code: '+55' },
    { id: 'PH', name: 'Philippines', code: '+63' },
    { id: 'ID', name: 'Indonesia', code: '+62' },
    { id: 'NL', name: 'Netherlands', code: '+31' },
    { id: 'ES', name: 'Spain', code: '+34' },
    { id: 'IT', name: 'Italy', code: '+39' },
    { id: 'SE', name: 'Sweden', code: '+46' },
    { id: 'PL', name: 'Poland', code: '+48' },
    { id: 'UA', name: 'Ukraine', code: '+380' },
    { id: 'RU', name: 'Russia', code: '+7' },
    { id: 'CN', name: 'China', code: '+86' },
    { id: 'JP', name: 'Japan', code: '+81' },
    { id: 'KR', name: 'South Korea', code: '+82' },
    { id: 'TR', name: 'Turkey', code: '+90' },
    { id: 'AE', name: 'United Arab Emirates', code: '+971' },
    { id: 'SA', name: 'Saudi Arabia', code: '+966' },
    { id: 'EG', name: 'Egypt', code: '+20' },
    { id: 'MX', name: 'Mexico', code: '+52' },
    { id: 'CO', name: 'Colombia', code: '+57' },
    { id: 'AR', name: 'Argentina', code: '+54' },
    { id: 'VN', name: 'Vietnam', code: '+84' },
    { id: 'TH', name: 'Thailand', code: '+66' },
    { id: 'MY', name: 'Malaysia', code: '+60' },
    { id: 'SG', name: 'Singapore', code: '+65' }
  ];

  // Helper to format country names + flags + dials
  const getCountryDisplayName = (countryId: string, fallbackName?: string, dialCode?: string) => {
    if (!countryId) return 'Select Country';
    const countryObj = countries.find(c => c.id === countryId);
    const resolvedName = fallbackName || countryObj?.name || countryId;
    const flag = getCountryFlagEmoji(countryObj?.code || resolvedName || countryId);
    return `${flag} ${resolvedName}${dialCode ? ` (${dialCode})` : ''}`;
  };

  // Clean service name mapping
  const getServiceDisplayName = (serviceId: string, fallbackName?: string) => {
    if (fallbackName && fallbackName.trim() !== '' && fallbackName.toLowerCase() !== serviceId.toLowerCase()) {
      return fallbackName;
    }
    const map: Record<string, string> = {
      whatsapp: 'WhatsApp & WA Business',
      wa: 'WhatsApp & WA Business',
      telegram: 'Telegram',
      tg: 'Telegram',
      google: 'Google / Gmail / YouTube',
      go: 'Google / Gmail / YouTube',
      openai: 'OpenAI / ChatGPT',
      chatgpt: 'OpenAI / ChatGPT',
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
      amazon: 'Amazon',
      am: 'Amazon',
      steam: 'Steam',
      discord: 'Discord',
      ds: 'Discord',
      uber: 'Uber & UberEats',
      paypal: 'PayPal Verification',
      apple: 'Apple / iCloud',
      snapchat: 'Snapchat',
      binance: 'Binance / Crypto',
      microsoft: 'Microsoft / Outlook / Azure',
      tinder: 'Tinder / Match',
      linkedin: 'LinkedIn',
      viber: 'Viber',
      vi: 'Viber',
      yahoo: 'Yahoo / AOL',
      mb: 'Yahoo / AOL',
      ot: 'Any Other Service'
    };
    return map[serviceId.toLowerCase()] || fallbackName || serviceId.toUpperCase();
  };

  // Safe JSON API fetcher that handles non-JSON responses gracefully
  const safeFetchJson = async (url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          ...(options?.headers || {})
        }
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      }
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return { ok: res.ok, status: res.status, data };
      } catch {
        return {
          ok: false,
          status: res.status,
          data: { error: sanitizeApiErrorMessage(text, 'This option is currently updating. Please choose another country or service.') }
        };
      }
    } catch (netErr: any) {
      return {
        ok: false,
        status: 0,
        data: { error: sanitizeApiErrorMessage(netErr?.message, 'Network connection issue. Please check your connection.') }
      };
    }
  };

  // 1. Fetch Servers dynamically from backend
  useEffect(() => {
    const fetchServers = async () => {
      setServersLoading(true);
      try {
        const { ok, data } = await safeFetchJson('/api/onegridhub/servers');
        const serverList = Array.isArray(data) ? data : (data?.servers || data?.data || []);
        if (ok && serverList.length > 0) {
          setServers(serverList);
          if (!selectedServer || selectedServer === 'server_1') {
            const initial = activeTab === 'usa' 
              ? (serverList.find((s: any) => s.id?.startsWith('usa'))?.id || 'usa1')
              : (serverList.find((s: any) => s.id?.startsWith('all'))?.id || 'all1');
            setSelectedServer(initial);
          }
        } else {
          const fallback = [
            { id: 'all1', name: 'Server 1 (All Countries)', region: 'Global' },
            { id: 'all2', name: 'Server 2 (Pro Gateway)', region: 'Global' },
            { id: 'all3', name: 'Server 3 (Special / Direct)', region: 'Global' },
            { id: 'usa1', name: 'USA Server 1', region: 'USA' },
            { id: 'usa2', name: 'USA Server 2', region: 'USA' },
            { id: 'usa3', name: 'USA Server 3', region: 'USA' }
          ];
          setServers(fallback);
          if (!selectedServer || selectedServer === 'server_1') {
            setSelectedServer(activeTab === 'usa' ? 'usa1' : 'all1');
          }
        }
      } catch (err: any) {
        console.warn('OneGridHub servers fetch notice:', err);
        const fallback = [
          { id: 'all1', name: 'Server 1 (All Countries)', region: 'Global' },
          { id: 'all2', name: 'Server 2 (Pro Gateway)', region: 'Global' },
          { id: 'all3', name: 'Server 3 (Special / Direct)', region: 'Global' },
          { id: 'usa1', name: 'USA Server 1', region: 'USA' },
          { id: 'usa2', name: 'USA Server 2', region: 'USA' },
          { id: 'usa3', name: 'USA Server 3', region: 'USA' }
        ];
        setServers(fallback);
        if (!selectedServer || selectedServer === 'server_1') {
          setSelectedServer(activeTab === 'usa' ? 'usa1' : 'all1');
        }
      } finally {
        setServersLoading(false);
      }
    };
    fetchServers();
  }, []);

  // 2. Fetch Countries dynamically when Server or Tab changes
  useEffect(() => {
    if (!selectedServer) return;
    const fetchCountries = async () => {
      setCountriesLoading(true);
      try {
        const { ok, data } = await safeFetchJson(`/api/onegridhub/countries?server=${encodeURIComponent(selectedServer)}`);
        const countryList = Array.isArray(data) ? data : (data?.countries || data?.data || []);
        if (ok && countryList.length > 0) {
          // Enrich countries with dial codes if missing
          const enriched = countryList.map((c: any) => ({
            ...c,
            code: c.code || getCountryDialCode(c.id, c.name, c.code)
          }));
          setCountries(enriched);
          setSelectedCountry(prev => {
            if (prev && enriched.some((c: any) => c.id === prev)) return prev;
            if (activeTab === 'usa') {
              const usaCountry = enriched.find((c: any) => c.id === '187' || c.id === 'US' || (c.name || '').toLowerCase().includes('united states'));
              return usaCountry ? usaCountry.id : (enriched[0]?.id || '187');
            }
            return '';
          });
        } else {
          setCountries(DEFAULT_COUNTRIES);
          setSelectedCountry(activeTab === 'usa' ? '187' : (prev => prev || ''));
        }
      } catch (err: any) {
        console.warn('Countries dynamic fetch notice:', err);
        setCountries(DEFAULT_COUNTRIES);
        setSelectedCountry(activeTab === 'usa' ? '187' : (prev => prev || ''));
      } finally {
        setCountriesLoading(false);
      }
    };
    fetchCountries();
  }, [selectedServer, activeTab]);

  // 3. Fetch Services dynamically when Country changes
  useEffect(() => {
    if (!selectedServer || !selectedCountry) {
      setServices([]);
      setSelectedService('');
      return;
    }
    const fetchServices = async () => {
      setServicesLoading(true);
      try {
        const { ok, data } = await safeFetchJson(`/api/onegridhub/services?server=${encodeURIComponent(selectedServer)}&country=${encodeURIComponent(selectedCountry)}`);
        const serviceList = Array.isArray(data) ? data : (data?.services || data?.data || []);
        if (ok && serviceList.length > 0) {
          setServices(serviceList);
          setSelectedService(prev => (prev && serviceList.some((s: any) => s.id === prev) ? prev : ''));
        } else {
          setServices([]);
          setSelectedService('');
        }
      } catch (err: any) {
        console.warn('Services dynamic fetch notice:', err);
        setServices([]);
        setSelectedService('');
      } finally {
        setServicesLoading(false);
      }
    };
    fetchServices();
  }, [selectedServer, selectedCountry]);

  // 4a. Fetch Owner Pricing Settings
  const fetchPricingSettings = async () => {
    if (!isOwner) return;
    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson('/api/onegridhub/pricing-settings', { headers });
      if (ok && data?.settings) {
        setOwnerSettings(data.settings);
      }
    } catch (e) {
      console.warn('Failed to load owner pricing settings:', e);
    }
  };

  useEffect(() => {
    if (isOwner) {
      fetchPricingSettings();
    }
  }, [isOwner]);

  // 4b. Save Owner Pricing Settings
  const handleSavePricingSettings = async (newSettings?: PricingSettings) => {
    setIsSavingSettings(true);
    setSettingsSaveSuccess('');
    const payload = newSettings || ownerSettings;
    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson('/api/onegridhub/pricing-settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (ok && data?.success) {
        setOwnerSettings(data.settings);
        setSettingsSaveSuccess('Pricing engine settings updated successfully!');
        if (selectedServer && selectedCountry && selectedService) {
          fetchPrice();
        }
        setTimeout(() => setSettingsSaveSuccess(''), 3500);
      } else {
        throw new Error(data?.error || 'Failed to save settings');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update pricing settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 4c. Fetch Live Price options when Country/Service changes
  const fetchPrice = async () => {
    if (!selectedServer || !selectedCountry || !selectedService) {
      setCalculatedPrice(0);
      setProviderPrice(0);
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
      const { ok, data } = await safeFetchJson(
        `/api/onegridhub/price?server=${encodeURIComponent(selectedServer)}&country=${encodeURIComponent(selectedCountry)}&service=${encodeURIComponent(selectedService)}&callerEmail=${encodeURIComponent(callerEmail)}`,
        { headers }
      );
      
      if (ok && data?.available) {
        const rawOptions: any[] = Array.isArray(data.options) && data.options.length > 0
          ? data.options
          : [{
              optionId: 'opt_1',
              tierIndex: 0,
              tierName: 'Standard Line',
              badge: 'Popular',
              description: 'Direct carrier routing',
              customerPrice: Number(data.customerPrice || data.totalPrice || 0),
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
          customerPrice: Number(opt.customerPrice || 0),
          providerCost: opt.providerCost !== undefined ? Number(opt.providerCost) : undefined,
          markup: opt.markup !== undefined ? Number(opt.markup) : undefined,
          profit: opt.profit !== undefined ? Number(opt.profit) : undefined,
          marginPercent: opt.marginPercent !== undefined ? Number(opt.marginPercent) : undefined
        }));

        setPriceOptions(formattedOptions);

        const matched = formattedOptions.find(o => o.optionId === selectedOptionId) || formattedOptions[0];
        setSelectedOptionId(matched.optionId);
        setCalculatedPrice(matched.customerPrice);
        setProviderPrice(Number(data.providerCost || matched.providerCost || 0));
        setMarkupAmount(Number(matched.markup || (matched.customerPrice - (data.providerCost || 0))));
        setIsPriceAvailable(true);
        setPriceErrorMessage('');
      } else {
        setIsPriceAvailable(false);
        setPriceOptions([]);
        setProviderPrice(0);
        setCalculatedPrice(0);
        setPriceErrorMessage(sanitizeApiErrorMessage(data?.error, 'This option is currently unavailable. Please choose another country or service.'));
      }
    } catch (err: any) {
      console.error('Failed to get price options:', err);
      setIsPriceAvailable(false);
      setPriceOptions([]);
      setProviderPrice(0);
      setCalculatedPrice(0);
      setPriceErrorMessage('This option is currently unavailable. Please choose another country or service.');
    } finally {
      setPriceLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
  }, [selectedServer, selectedCountry, selectedService]);

  const handleSelectOption = (opt: PriceOption) => {
    setSelectedOptionId(opt.optionId);
    setCalculatedPrice(opt.customerPrice);
    if (opt.providerCost !== undefined) {
      setProviderPrice(opt.providerCost);
      setMarkupAmount(opt.markup || (opt.customerPrice - opt.providerCost));
    }
  };

  // 5. Fetch Orders List
  const fetchOrders = async () => {
    if (!userProfile?.uid) return;
    setOrdersLoading(true);
    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson(`/api/onegridhub/orders?userId=${encodeURIComponent(userProfile.uid)}`, {
        headers
      });
      if (ok && data) {
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to retrieve user orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [userProfile?.uid]);

  // 6. Handle Copy
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // 7. Buy / Rent Virtual Number
  const handleBuyNumber = async () => {
    if (!selectedServer || !selectedCountry || !selectedService) {
      setErrorMessage('Please select a Server, Country, and Service to proceed.');
      return;
    }

    const selectedOpt = priceOptions.find(o => o.optionId === selectedOptionId) || priceOptions[0];
    const effectivePrice = selectedOpt ? selectedOpt.customerPrice : calculatedPrice;

    if (walletBalance < effectivePrice) {
      setErrorMessage(`Insufficient balance. This option costs ₦${effectivePrice.toLocaleString()}, but your balance is ₦${walletBalance.toLocaleString()}. Please fund your account.`);
      return;
    }

    setErrorMessage('');
    setBuyingLoading(true);

    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson('/api/onegridhub/buy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'buy',
          userId: userProfile.uid,
          server: selectedServer,
          country: selectedCountry,
          service: selectedService,
          optionId: selectedOpt?.optionId,
          tierName: selectedOpt?.tierName,
          selectedPrice: effectivePrice
        })
      });

      if (!ok || !data || data.error) {
        const errStr = (data?.error || '').toLowerCase();
        if (data?.code === 'OUT_OF_STOCK' || errStr.includes('no number') || errStr.includes('out of stock') || errStr.includes('stock') || errStr.includes('unavailable')) {
          throw new Error('No virtual numbers currently available in stock from the provider for this service/country. Please try another server or service.');
        }
        if (data?.code === 'INSUFFICIENT_BALANCE' || errStr.includes('insufficient')) {
          throw new Error(`Insufficient wallet balance. This number costs ₦${effectivePrice.toLocaleString()}, but your balance is ₦${walletBalance.toLocaleString()}. Please fund your account.`);
        }
        throw new Error(data?.error || 'Verification purchase failed.');
      }

      setActiveOrder(data);
      setPollingStatus('WAITING');
      setVerificationCode('');
      setSmsContent('');
      setElapsedSeconds(0);
      setActiveStep('activation');
      
      onRefreshProfile();
      fetchOrders();
      startSmsPolling(data.orderId);

    } catch (err: any) {
      setErrorMessage(sanitizeApiErrorMessage(err.message, 'Verification purchase failed. Please check your connection.'));
    } finally {
      setBuyingLoading(false);
    }
  };

  // 8. Polling Mechanism
  const startSmsPolling = (orderId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const headers = await getAuthHeaders();
        const { ok, data } = await safeFetchJson(`/api/onegridhub/status?order_id=${encodeURIComponent(orderId)}&userId=${encodeURIComponent(userProfile?.uid || '')}`, {
          headers
        });

        if (ok && data) {
          if (data.status === 'SMS_RECEIVED' || data.code) {
            setPollingStatus('RECEIVED');
            setVerificationCode(data.code);
            setSmsContent(data.smsText || `Your verification code is: ${data.code}`);
            
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            
            onRefreshProfile();
            fetchOrders();
          } else if (data.status === 'CANCELLED' || data.status === 'EXPIRED') {
            setPollingStatus('CANCELLED');
            setErrorMessage('This session expired or was cancelled by the provider.');
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            fetchOrders();
          }
        }
      } catch (err) {
        console.warn('Status poll exception:', err);
      }
    }, 5000);
  };

  // 9. Cancel & Refund
  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    setErrorMessage('');
    setCancellingLoading(true);

    try {
      const headers = await getAuthHeaders();
      const { ok, data } = await safeFetchJson('/api/onegridhub/cancel', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'cancel',
          userId: userProfile.uid,
          orderId: activeOrder.orderId
        })
      });

      if (!ok || !data || data.error) {
        throw new Error(data?.error || 'Cancellation declined.');
      }

      setPollingStatus('CANCELLED');
      setInfoMessage('Order cancelled successfully! Your funds have been returned to your wallet.');
      setActiveStep('selection');
      
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      onRefreshProfile();
      fetchOrders();
    } catch (err: any) {
      setErrorMessage(sanitizeApiErrorMessage(err.message, 'Failed to cancel order.'));
    } finally {
      setCancellingLoading(false);
    }
  };

  // 10. Repeat Purchase Action (+ Buy Again)
  const handleBuyAgain = (historicalOrder: any) => {
    setSelectedServer(historicalOrder.server || (servers[0]?.id || 'server_1'));
    setSelectedCountry(historicalOrder.country || 'US');
    setSelectedService(historicalOrder.service || 'whatsapp');
    
    if (historicalOrder.country === 'US' || historicalOrder.country === '187') {
      setActiveTab('usa');
    } else {
      setActiveTab('all');
    }

    setActiveStep('selection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setInfoMessage(`Configured to: ${historicalOrder.service.toUpperCase()} in ${getCountryDisplayName(historicalOrder.country)}. Ready to purchase!`);
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const formatDateSimple = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const day = d.getDate();
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${day} ${month} • ${hours}:${mins}`;
    } catch {
      return 'Today';
    }
  };

  // Filtered lists for modals
  const filteredCountries = countries.filter(c => {
    if (!countrySearchQuery.trim()) return true;
    const q = countrySearchQuery.toLowerCase().trim();
    const name = (c.name || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    const code = (c.code || '').toLowerCase();
    const dialCode = getCountryDialCode(c.id, c.name, c.code).toLowerCase();
    const nameMatch = name.includes(q);
    const idMatch = id.includes(q);
    const codeMatch = code.includes(q);
    const dialMatch = dialCode.includes(q);
    const aliasMatch = 
      (q === 'uk' && (id === 'gb' || name.includes('united kingdom'))) ||
      (q === 'usa' && (id === 'us' || id === '187' || name.includes('united states'))) ||
      (q === 'us' && (id === 'us' || id === '187' || name.includes('united states'))) ||
      (q === 'uae' && (id === 'ae' || name.includes('emirates')));
    return nameMatch || idMatch || codeMatch || dialMatch || aliasMatch;
  });

  const filteredServices = services.filter(s => {
    if (!serviceSearchQuery.trim()) return true;
    const q = serviceSearchQuery.toLowerCase().trim();
    const displayName = getServiceDisplayName(s.id, s.name).toLowerCase();
    const idMatch = (s.id || '').toLowerCase().includes(q);
    const nameMatch = (s.name || '').toLowerCase().includes(q);
    return displayName.includes(q) || idMatch || nameMatch;
  });

  const currentCountryObj = countries.find(c => c.id === selectedCountry);
  const currentServiceObj = services.find(s => s.id === selectedService);

  // Dynamic Card & Theme Settings based on active tab and selected server
  const isUsaMode = activeTab === 'usa';

  // Server styling configurations matching the reference screenshots
  const getServerConfig = () => {
    if (isUsaMode) {
      // USA Mode Theme (Screenshot IMG_2194 - magenta/pink accent header, dark selected pills)
      const serverNum = selectedServer.includes('2') ? '2' : selectedServer.includes('3') ? '3' : '1';
      return {
        headerBg: 'bg-[#9d174d] bg-gradient-to-r from-[#be185d] to-[#9d174d]',
        dotColor: 'bg-[#f472b6]',
        headerTitle: `🇺🇸 USA Server ${serverNum} — USA Numbers`,
        iconBg: 'bg-[#be185d]',
        buttonBg: 'bg-gradient-to-r from-[#be185d] to-[#9d174d] hover:from-[#db2777] hover:to-[#be185d] text-white shadow-[0_4px_20px_rgba(190,24,93,0.35)]',
        buttonText: 'Buy Number',
        buttonIcon: <CreditCard className="w-4 h-4 mr-2 inline" />,
        badgeText: `USA SV${serverNum}`
      };
    } else {
      // All Countries Theme (Screenshot IMG_2193 - warm orange/amber header for SV1, blue for SV2, teal for SV3)
      if (selectedServer === 'all2' || selectedServer === 'server_2') {
        return {
          headerBg: 'bg-gradient-to-r from-blue-600 to-sky-600',
          dotColor: 'bg-sky-300',
          headerTitle: '🌐 All Countries Server 2 (Pro Gateway)',
          iconBg: 'bg-blue-600',
          buttonBg: 'bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)]',
          buttonText: 'Rent Number',
          buttonIcon: <FileText className="w-4 h-4 mr-2 inline" />,
          badgeText: 'ALL SV2'
        };
      } else if (selectedServer === 'all3' || selectedServer === 'server_3') {
        return {
          headerBg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
          dotColor: 'bg-emerald-300',
          headerTitle: '🌐 All Countries Server 3 (Direct / Special)',
          iconBg: 'bg-emerald-600',
          buttonBg: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_4px_20px_rgba(5,150,105,0.35)]',
          buttonText: 'Rent Number',
          buttonIcon: <FileText className="w-4 h-4 mr-2 inline" />,
          badgeText: 'ALL SV3'
        };
      } else {
        // Default Server 1 (All Countries) - Warm Orange
        return {
          headerBg: 'bg-[#c2410c] bg-gradient-to-r from-[#ea580c] to-[#c2410c]',
          dotColor: 'bg-[#fb923c]',
          headerTitle: '🌐 All Countries Server 1',
          iconBg: 'bg-[#ea580c]',
          buttonBg: 'bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] text-white shadow-[0_4px_20px_rgba(234,88,12,0.35)]',
          buttonText: 'Rent Number',
          buttonIcon: <FileText className="w-4 h-4 mr-2 inline" />,
          badgeText: 'ALL SV1'
        };
      }
    }
  };

  const serverConfig = getServerConfig();

  const displayedServers = isUsaMode
    ? (servers.filter(s => s.id?.startsWith('usa') || (s as any).region === 'USA').length > 0
        ? servers.filter(s => s.id?.startsWith('usa') || (s as any).region === 'USA')
        : [{ id: 'usa1', name: 'USA Server 1', region: 'USA' }, { id: 'usa2', name: 'USA Server 2', region: 'USA' }, { id: 'usa3', name: 'USA Server 3', region: 'USA' }])
    : (servers.filter(s => s.id?.startsWith('all') || (s as any).region === 'Global').length > 0
        ? servers.filter(s => s.id?.startsWith('all') || (s as any).region === 'Global')
        : [{ id: 'all1', name: 'Server 1 (All Countries)', region: 'Global' }, { id: 'all2', name: 'Server 2 (Pro Gateway)', region: 'Global' }, { id: 'all3', name: 'Server 3 (Special / Direct)', region: 'Global' }]);

  return (
    <div className="w-full max-w-xl mx-auto px-2 sm:px-0">
      
      {/* 1. TOP HEADER (Matching Screenshots) */}
      <div className="flex items-center justify-between bg-[#080d1f]/90 text-white px-4 py-3.5 rounded-2xl mb-6 shadow-md border border-purple-950/40">
        <button
          type="button"
          onClick={activeStep === 'activation' ? () => setActiveStep('selection') : onBackToMarketplace}
          className="p-2 bg-[#160c2d] hover:bg-[#251347] text-white rounded-xl transition cursor-pointer border border-purple-900/40 flex items-center justify-center"
          title="Back to Marketplace"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <h1 className="text-base sm:text-lg font-black tracking-wide text-[#38bdf8] flex items-center space-x-1.5">
          <span>Global Virtual Numbers</span>
        </h1>

        <div className="flex items-center space-x-2">
          {isOwner && (
            <button
              onClick={() => setIsOwnerSettingsOpen(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:text-white rounded-lg text-[11px] font-black transition cursor-pointer"
              title="Configure Pricing Engine"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

          <div className="relative p-2 bg-[#160c2d] text-purple-200 rounded-xl border border-purple-900/40 flex items-center justify-center">
            <Bell className="w-5 h-5 text-purple-200" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {infoMessage && (
        <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold p-3.5 rounded-2xl flex items-center justify-between">
          <span>{infoMessage}</span>
          <button onClick={() => setInfoMessage('')} className="text-emerald-400 hover:text-white font-extrabold cursor-pointer">×</button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold p-3.5 rounded-2xl flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-white font-extrabold cursor-pointer">×</button>
        </div>
      )}

      {/* STEP 1: SELECTION FLOW */}
      {activeStep === 'selection' && (
        <div className="space-y-6">
          
          {/* 2. COUNTRY TYPE SWITCH (Large Segmented Control) */}
          <div className="bg-[#0c061d] p-1.5 rounded-[28px] border border-[#27144d] shadow-sm flex items-center">
            <button
              type="button"
              onClick={() => {
                setActiveTab('usa');
                const usaSrv = servers.find(s => s.id?.startsWith('usa'))?.id || 'usa1';
                setSelectedServer(usaSrv);
                setSelectedCountry('187');
                setSelectedService('');
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-[22px] text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
                isUsaMode
                  ? 'bg-[#220f4b] text-white border border-purple-500/50 shadow-md shadow-purple-950/50'
                  : 'text-purple-300/70 hover:text-white hover:bg-purple-950/30'
              }`}
            >
              <span>🇺🇸 USA Numbers</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                const allSrv = servers.find(s => s.id?.startsWith('all'))?.id || 'all1';
                setSelectedServer(allSrv);
                setSelectedCountry('');
                setSelectedService('');
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-[22px] text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
                !isUsaMode
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-purple-300/70 hover:text-white hover:bg-purple-950/30'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>🌐 All Countries</span>
            </button>
          </div>

          {/* 3. SMS SERVER SELECTION */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest block pl-1">
              CHOOSE SMS SERVER
            </span>

            <div className="grid grid-cols-3 gap-2.5">
              {serversLoading ? (
                <div className="col-span-3 text-xs text-purple-400 flex items-center justify-center space-x-2 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  <span>Loading servers...</span>
                </div>
              ) : displayedServers.length === 0 ? (
                <div className="col-span-3 text-xs text-purple-400 text-center py-2">
                  No servers available.
                </div>
              ) : (
                displayedServers.slice(0, 3).map((s, idx) => {
                  const isSelected = selectedServer === s.id;
                  
                  const buttonStyle = isSelected
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                    : 'bg-[#12082b] text-purple-200 border-[#27144d] hover:border-purple-500/50 hover:bg-[#1a0c3b]';

                  const iconPrefix = isUsaMode ? '🇺🇸' : <Globe className="w-3.5 h-3.5 inline mr-1" />;

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedServer(s.id);
                        setSelectedService('');
                      }}
                      className={`flex items-center justify-center py-3 px-3 rounded-full text-xs font-black transition-all border cursor-pointer ${buttonStyle}`}
                    >
                      <span className="truncate flex items-center justify-center">
                        <span className="mr-1.5">{typeof iconPrefix === 'string' ? iconPrefix : iconPrefix}</span>
                        <span>Server {idx + 1}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. SERVER CONTENT CARD */}
          <div className="bg-[#0c061d] border border-[#251347] rounded-[30px] shadow-xl relative z-10">
            
            {/* Header Banner */}
            <div className={`${serverConfig.headerBg} rounded-t-[29px] px-5 py-3.5 flex items-center justify-between text-white`}>
              <div className="flex items-center space-x-2.5">
                <span className={`w-2.5 h-2.5 ${serverConfig.dotColor} rounded-full animate-ping shrink-0`} />
                <span className="text-xs sm:text-sm font-black tracking-wide uppercase">
                  {serverConfig.headerTitle}
                </span>
              </div>
            </div>

            {/* Card Content & Fields */}
            <div className="p-5 sm:p-6 space-y-4">
              
              {/* Field 1: COUNTRY */}
              <div className={`relative ${isCountryModalOpen ? 'z-50' : 'z-20'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIsCountryModalOpen(!isCountryModalOpen);
                    setIsServiceModalOpen(false);
                    setCountrySearchQuery('');
                  }}
                  className="w-full flex items-center justify-between space-x-4 bg-[#120826] border border-[#271448] hover:border-purple-500/50 p-4 rounded-2xl transition cursor-pointer text-left focus:outline-none group"
                >
                  <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-xl ${serverConfig.iconBg} text-white shrink-0 flex items-center justify-center shadow-sm`}>
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest block mb-0.5">
                        COUNTRY
                      </span>
                      {countriesLoading ? (
                        <div className="text-xs text-purple-400 font-medium flex items-center space-x-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading countries...</span>
                        </div>
                      ) : selectedCountry && currentCountryObj ? (
                        <span className="text-sm font-black text-white truncate block">
                          {`${getCountryFlagEmoji(currentCountryObj.id || currentCountryObj.code || currentCountryObj.name)} ${currentCountryObj.name || currentCountryObj.id}${getCountryDialCode(currentCountryObj.id, currentCountryObj.name, currentCountryObj.code) ? ` (${getCountryDialCode(currentCountryObj.id, currentCountryObj.name, currentCountryObj.code)})` : ''}`}
                        </span>
                      ) : selectedCountry ? (
                        <span className="text-sm font-black text-white truncate block">
                          {getCountryDisplayName(selectedCountry)}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-purple-300/60 truncate block">
                          Select Country
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-purple-400 shrink-0 transition-transform ${isCountryModalOpen ? 'rotate-90' : ''}`} />
                </button>

                {/* Country Dropdown / Modal */}
                {isCountryModalOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#120826] border border-purple-500/50 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-3.5 backdrop-blur-xl">
                    <div className="relative mb-3">
                      <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={countrySearchQuery}
                        onChange={(e) => setCountrySearchQuery(e.target.value)}
                        placeholder="Search country (e.g. United, UK, Nigeria, Ghana)..."
                        autoFocus
                        className="w-full bg-[#180d33] border border-purple-900/60 focus:border-purple-400 rounded-xl pl-9.5 pr-8 py-2.5 text-xs text-white placeholder-purple-300/40 font-bold focus:outline-none transition shadow-inner"
                      />
                      {countrySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCountrySearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white cursor-pointer p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Scrollable list displaying ~5 country rows with smooth vertical scrolling */}
                    <div 
                      className="max-h-[250px] overflow-y-auto overflow-x-hidden space-y-1.5 pr-1.5 custom-scrollbar touch-pan-y overscroll-contain"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {filteredCountries.length === 0 ? (
                        <div className="py-8 text-center text-xs text-purple-300/40 font-bold">
                          No matching country found
                        </div>
                      ) : (
                        filteredCountries.map((c) => {
                          const isSelected = selectedCountry === c.id;
                          const flag = getCountryFlagEmoji(c.code || c.id || c.name);
                          const dialCode = getCountryDialCode(c.id, c.name, c.code);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c.id);
                                setSelectedService('');
                                setIsCountryModalOpen(false);
                                setCountrySearchQuery('');
                              }}
                              className={`w-full min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer touch-manipulation select-none ${
                                isSelected
                                  ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400'
                                  : 'text-purple-200 hover:bg-purple-950/60 hover:text-white bg-[#160a2f]/70 active:bg-purple-900/60'
                              }`}
                            >
                              <div className="flex items-center space-x-3 truncate">
                                <span className="text-lg shrink-0 select-none">{flag}</span>
                                <span className="truncate font-semibold">{c.name || c.id}</span>
                              </div>
                              {dialCode && (
                                <span className={`text-[11px] font-mono font-bold shrink-0 ml-2 px-2 py-0.5 rounded-md ${
                                  isSelected
                                    ? 'bg-purple-700 text-white'
                                    : 'bg-purple-950/80 text-purple-300 border border-purple-800/40'
                                }`}>
                                  {dialCode}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Field 2: SERVICE */}
              <div className={`relative ${isServiceModalOpen ? 'z-50' : 'z-10'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIsServiceModalOpen(!isServiceModalOpen);
                    setIsCountryModalOpen(false);
                    setServiceSearchQuery('');
                  }}
                  className="w-full flex items-center justify-between space-x-4 bg-[#120826] border border-[#271448] hover:border-purple-500/50 p-4 rounded-2xl transition cursor-pointer text-left focus:outline-none group"
                >
                  <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-xl ${serverConfig.iconBg} text-white shrink-0 flex items-center justify-center shadow-sm`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest block mb-0.5">
                        SERVICE
                      </span>
                      {!selectedCountry ? (
                        <span className="text-sm font-bold text-purple-300/40 truncate block">
                          Select Country First
                        </span>
                      ) : servicesLoading ? (
                        <div className="text-xs text-purple-400 font-medium flex items-center space-x-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading services...</span>
                        </div>
                      ) : currentServiceObj ? (
                        <span className="text-sm font-black text-white truncate block">
                          {getServiceDisplayName(currentServiceObj.id, currentServiceObj.name)}
                        </span>
                      ) : selectedService ? (
                        <span className="text-sm font-black text-white truncate block">
                          {getServiceDisplayName(selectedService)}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-purple-300/60 truncate block">
                          Select Service
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-purple-400 shrink-0 transition-transform ${isServiceModalOpen ? 'rotate-90' : ''}`} />
                </button>

                {/* Service Dropdown / Modal */}
                {isServiceModalOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#120826] border border-purple-500/50 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-3.5 backdrop-blur-xl">
                    {!selectedCountry ? (
                      <div className="py-6 text-center text-xs text-purple-300/60 font-bold">
                        Please select a country first to view available services
                      </div>
                    ) : (
                      <>
                        <div className="relative mb-3">
                          <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={serviceSearchQuery}
                            onChange={(e) => setServiceSearchQuery(e.target.value)}
                            placeholder="Search service (e.g. WhatsApp, Telegram, Google, TikTok)..."
                            autoFocus
                            className="w-full bg-[#180d33] border border-purple-900/60 focus:border-purple-400 rounded-xl pl-9.5 pr-8 py-2.5 text-xs text-white placeholder-purple-300/40 font-bold focus:outline-none transition shadow-inner"
                          />
                          {serviceSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setServiceSearchQuery('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white cursor-pointer p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div 
                          className="max-h-[250px] overflow-y-auto overflow-x-hidden space-y-1.5 pr-1.5 custom-scrollbar touch-pan-y overscroll-contain"
                          style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                          {filteredServices.length === 0 ? (
                            <div className="py-8 text-center text-xs text-purple-300/40 font-bold">
                              {servicesLoading ? 'Loading services...' : 'No service available for this country'}
                            </div>
                          ) : (
                            filteredServices.map((s) => {
                              const isSelected = selectedService === s.id;
                              const displayName = getServiceDisplayName(s.id, s.name);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedService(s.id);
                                    setIsServiceModalOpen(false);
                                    setServiceSearchQuery('');
                                  }}
                                  className={`w-full min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer touch-manipulation select-none ${
                                    isSelected
                                      ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400'
                                      : 'text-purple-200 hover:bg-purple-950/60 hover:text-white bg-[#160a2f]/70 active:bg-purple-900/60'
                                  }`}
                                >
                                  <span className="truncate font-semibold">{displayName}</span>
                                  {s.price ? (
                                    <span className={`text-[10px] font-black shrink-0 ml-2 px-2 py-0.5 rounded-md ${
                                      isSelected
                                        ? 'bg-purple-700 text-white'
                                        : 'bg-purple-950/80 text-emerald-300 border border-purple-800/40'
                                    }`}>
                                      ₦{(Number(s.price) + 300).toLocaleString()}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Price Options Preview when Country & Service are Selected */}
              {selectedCountry && selectedService && (
                <div className="bg-[#120826] border border-[#271448] p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest">
                      {priceOptions.length > 1 ? 'Select Line Quality / Tier' : 'Line Price'}
                    </span>
                    {isPriceAvailable && (
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        ₦{calculatedPrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Owner Pricing Breakdown - OneGridHub Original Price -> My Markup -> Final Customer Price */}
                  {isOwner && isPriceAvailable && (
                    <div className="bg-gradient-to-r from-amber-950/40 via-purple-950/60 to-amber-950/40 border border-amber-500/40 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-black text-amber-300">
                        <span className="flex items-center gap-1.5">
                          <span>👑 Owner Pricing Breakdown</span>
                        </span>
                        <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 uppercase tracking-wider">
                          OneGridHub Upstream
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                        <div className="bg-[#110524] p-2 rounded-lg border border-purple-900/50">
                          <span className="text-[9px] font-bold text-purple-300/70 block uppercase font-sans tracking-wide">
                            OneGridHub Price
                          </span>
                          <span className="text-xs sm:text-sm font-black text-white">
                            ₦{providerPrice.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="bg-[#110524] p-2 rounded-lg border border-amber-500/30">
                          <span className="text-[9px] font-bold text-amber-300/80 block uppercase font-sans tracking-wide">
                            My Markup
                          </span>
                          <span className="text-xs sm:text-sm font-black text-amber-400">
                            +₦{markupAmount.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="bg-[#110524] p-2 rounded-lg border border-emerald-500/30">
                          <span className="text-[9px] font-bold text-emerald-300/80 block uppercase font-sans tracking-wide">
                            Customer Price
                          </span>
                          <span className="text-xs sm:text-sm font-black text-emerald-400">
                            ₦{calculatedPrice.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {priceLoading ? (
                    <div className="flex items-center space-x-2 py-2 text-xs text-purple-300">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      <span>Checking real-time carrier rates...</span>
                    </div>
                  ) : isPriceAvailable && priceOptions.length > 1 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {priceOptions.map((opt) => {
                        const isSelected = selectedOptionId === opt.optionId;
                        return (
                          <div
                            key={opt.optionId}
                            onClick={() => handleSelectOption(opt)}
                            className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-purple-950/60 border-purple-500 shadow ring-1 ring-purple-500'
                                : 'bg-[#150a2b]/80 border-[#271448] hover:border-purple-800/60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-white">{opt.tierName}</span>
                              {opt.badge && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-black text-emerald-400 font-mono mt-1">
                              ₦{opt.customerPrice.toLocaleString()}
                            </span>
                            {isOwner && opt.providerCost !== undefined && (
                              <span className="text-[9px] text-amber-300/80 font-mono block mt-0.5">
                                Cost: ₦{opt.providerCost.toLocaleString()} • +₦{(opt.markup !== undefined ? opt.markup : (opt.customerPrice - opt.providerCost)).toLocaleString()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : !isPriceAvailable && (
                    <div className="py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 font-bold flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{priceErrorMessage || 'This service is currently unavailable for the chosen country.'}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-purple-900/30 text-purple-300/70">
                    <span>Wallet Balance:</span>
                    <span className="font-mono font-bold text-white">₦{walletBalance.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Action Button: Rent Number vs Buy Number */}
              {!selectedCountry || !selectedService ? (
                <button
                  type="button"
                  disabled
                  className={`w-full py-4 px-6 rounded-[22px] font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center shadow-lg ${serverConfig.buttonBg} opacity-50 cursor-not-allowed`}
                >
                  {serverConfig.buttonIcon}
                  <span>{serverConfig.buttonText}</span>
                </button>
              ) : walletBalance < calculatedPrice && isPriceAvailable && calculatedPrice > 0 ? (
                <button
                  type="button"
                  onClick={onOpenWallet}
                  className="w-full py-4 px-6 rounded-[22px] font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg active:scale-95 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  <span>FUND ACCOUNT (₦{(calculatedPrice - walletBalance).toLocaleString()} Needed)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBuyNumber}
                  disabled={buyingLoading || priceLoading || !isPriceAvailable || calculatedPrice <= 0}
                  className={`w-full py-4 px-6 rounded-[22px] font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center shadow-lg active:scale-95 cursor-pointer ${serverConfig.buttonBg} disabled:opacity-50 disabled:pointer-events-none`}
                >
                  {buyingLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span>Provisioning Number...</span>
                    </>
                  ) : !isPriceAvailable ? (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      <span>Unavailable for Selection</span>
                    </>
                  ) : (
                    <>
                      {serverConfig.buttonIcon}
                      <span>{serverConfig.buttonText}</span>
                    </>
                  )}
                </button>
              )}

            </div>
          </div>

          {/* 5. MY ORDERS SECTION (Matching Screenshots) */}
          <div className="space-y-4 pt-4">
            
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white text-base tracking-wide flex items-center space-x-2">
                <Clock className="w-4.5 h-4.5 text-[#38bdf8]" />
                <span>My Orders</span>
              </h3>
              <span className="text-xs font-black bg-sky-500/20 text-sky-300 px-3 py-1 rounded-full">
                {orders.length} {orders.length === 1 ? 'orders' : 'orders'}
              </span>
            </div>

            {ordersLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-purple-300/40 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500 mb-2" />
                Loading your orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-10 bg-[#0c061d] border border-[#251347] rounded-[28px]">
                <Phone className="w-8 h-8 text-purple-300/20 mx-auto mb-2" />
                <p className="text-xs font-bold text-purple-300/50">No virtual numbers purchased yet</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {orders.map((o) => {
                  const isCompleted = o.status === 'SMS_RECEIVED' || o.code;
                  const isWaiting = o.status === 'WAITING';
                  const isCancelled = o.status === 'CANCELLED' || o.status === 'EXPIRED';

                  // Tag determination
                  const isUsaOrder = (o.country === 'US' || o.country === '187' || (o.server || '').includes('usa'));
                  const serverPill = isUsaOrder ? 'USA SV3' : (o.server === 'server_2' ? 'ALL SV2' : o.server === 'server_3' ? 'ALL SV3' : 'ALL SV1');
                  const serverPillBg = isUsaOrder ? 'bg-[#be185d]' : (o.server === 'server_2' ? 'bg-blue-600' : o.server === 'server_3' ? 'bg-emerald-600' : 'bg-[#ea580c]');

                  return (
                    <div 
                      key={o.orderId}
                      className="bg-[#0c061d] border border-[#251347] rounded-[26px] overflow-hidden shadow-lg p-4 space-y-3"
                    >
                      {/* Top Row */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full text-white ${serverPillBg} uppercase`}>
                            {serverPill}
                          </span>
                          <span className="font-black text-white truncate max-w-[180px]">
                            {getServiceDisplayName(o.service, o.serviceName || o.service)}
                          </span>
                        </div>
                        <span className="text-[11px] text-purple-300/60 font-semibold">
                          {formatDateSimple(o.createdAt)}
                        </span>
                      </div>

                      {/* Number & Copy Row */}
                      <div className="flex items-center space-x-3">
                        <span className="text-base sm:text-lg font-black text-[#009ee2] tracking-wider underline cursor-pointer">
                          {o.phoneNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(o.phoneNumber, o.orderId)}
                          className="flex items-center space-x-1 px-2.5 py-1 bg-[#1a0e36] hover:bg-[#25144d] border border-purple-900/40 text-purple-200 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          {copiedText === o.orderId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Info & Status Badges Row */}
                      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-purple-950/40 text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="text-purple-300/80 font-bold flex items-center space-x-1">
                            <Globe className="w-3.5 h-3.5 mr-1 inline" />
                            <span>{getCountryDisplayName(o.country)}</span>
                          </span>
                          <span className="bg-sky-500/10 text-[#38bdf8] font-black px-2 py-0.5 rounded-lg">
                            ₦{(Number(o.customerPrice || o.price || 0)).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          {isCompleted ? (
                            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                              COMPLETED
                            </span>
                          ) : isWaiting ? (
                            <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase animate-pulse">
                              AWAITING SMS
                            </span>
                          ) : (
                            <span className="bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                              {o.status || 'EXPIRED'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Received OTP Box */}
                      {isCompleted && o.code && (
                        <div className="bg-sky-500/10 border border-sky-400/20 rounded-xl p-3 text-center space-y-1">
                          <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider block">OTP RECEIVED</span>
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-xl font-black text-sky-200 tracking-widest">{o.code}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(o.code, `${o.orderId}-code`)}
                              className="p-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-lg transition"
                              title="Copy OTP"
                            >
                              {copiedText === `${o.orderId}-code` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Buy Again Button */}
                      <button
                        type="button"
                        onClick={() => handleBuyAgain(o)}
                        className="w-full py-2 bg-[#160c2d] hover:bg-[#251347] border border-purple-900/40 text-purple-300 hover:text-white text-xs font-black rounded-xl transition flex items-center justify-center cursor-pointer"
                      >
                        + Buy Again
                      </button>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>
      )}

      {/* STEP 2: ACTIVE ACTIVATION SCREEN */}
      {activeStep === 'activation' && activeOrder && (
        <div className="bg-[#0c061d] border border-[#251347] rounded-[30px] overflow-hidden shadow-2xl space-y-5 p-6">
          
          <div className="text-center space-y-1">
            <h3 className="font-black text-lg text-white tracking-wide uppercase">Active SMS Verification</h3>
            <p className="text-xs text-purple-200/70 font-semibold">
              Order ID: <span className="font-mono text-[11px] bg-purple-950/60 px-2 py-0.5 rounded text-white">{activeOrder.orderId}</span>
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-[#120826] rounded-2xl border border-[#271448] text-center space-y-3">
            {pollingStatus === 'WAITING' ? (
              <>
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
                    {formatTime(elapsedSeconds)}
                  </span>
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider animate-pulse">Awaiting SMS Code...</h4>
                <p className="text-[11px] text-purple-300/60 leading-relaxed max-w-sm">
                  Please use the virtual phone number below to request your verification code. This screen will automatically update as soon as the SMS is received.
                </p>
              </>
            ) : pollingStatus === 'RECEIVED' ? (
              <>
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 animate-bounce" />
                </div>
                <h4 className="text-sm font-black text-emerald-400 uppercase tracking-wider">Verification Complete!</h4>
                <p className="text-xs text-purple-300/80">The carrier gateway has delivered your OTP successfully.</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-red-400 uppercase tracking-wider">Session Terminated</h4>
                <p className="text-xs text-purple-300/80">This purchase session was cancelled or timed out.</p>
              </>
            )}
          </div>

          {/* Virtual Phone Number Box */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-purple-300/50 uppercase tracking-widest block">Your Virtual Phone Number</span>
            <div className="flex items-center justify-between bg-[#150a2b] border border-[#271448] p-4 rounded-2xl">
              <span className="text-lg sm:text-xl font-black text-white tracking-wider font-mono">
                {activeOrder.phoneNumber}
              </span>
              <button
                onClick={() => handleCopy(activeOrder.phoneNumber, 'number')}
                className="flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-xl transition cursor-pointer"
              >
                {copiedText === 'number' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText === 'number' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* OTP Code Box */}
          {pollingStatus === 'RECEIVED' && verificationCode && (
            <div className="space-y-4 pt-2">
              <span className="text-[10px] font-black text-purple-300/50 uppercase tracking-widest block">Delivered Verification Code</span>
              
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-6 text-center space-y-4">
                <span className="text-xs font-black text-sky-400 uppercase tracking-wider block">OTP RECEIVED ✓</span>
                
                <span className="text-4xl sm:text-5xl font-black text-sky-300 tracking-[0.4em] block pl-4 font-mono">
                  {verificationCode.split('').join(' ')}
                </span>

                <button
                  onClick={() => handleCopy(verificationCode, 'code')}
                  className="mx-auto flex items-center space-x-2 px-5 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-black rounded-xl border border-sky-400/40 transition cursor-pointer"
                >
                  {copiedText === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText === 'code' ? 'Copied OTP' : 'Copy OTP'}</span>
                </button>

                <span className="text-[10px] text-purple-300/50 block">Message: "{smsContent}"</span>
              </div>
            </div>
          )}

          {/* Control Actions */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-2">
            {pollingStatus === 'WAITING' && (
              <button
                onClick={handleCancelOrder}
                disabled={cancellingLoading}
                className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg"
              >
                {cancellingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    <span>Cancelling & Refunding...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-1" />
                    <span>Cancel & Refund</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => {
                setActiveStep('selection');
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              }}
              className="w-full py-3.5 px-4 bg-[#1a0f34] hover:bg-[#231542] text-purple-300 hover:text-white text-xs font-black uppercase tracking-wider rounded-xl border border-purple-900/40 transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Back to Selection</span>
            </button>
          </div>

        </div>
      )}

      {/* OWNER PRICING ENGINE MODAL */}
      {isOwner && isOwnerSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f0721] border border-purple-700/40 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 text-white">
            
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-amber-500 to-purple-600 rounded-2xl shadow-lg">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white tracking-wide">
                    Virtual Number Pricing Engine
                  </h3>
                  <p className="text-xs text-purple-300/70">
                    Control dynamic pricing generated from OneGridHub
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOwnerSettingsOpen(false)}
                className="p-2 bg-purple-950/40 hover:bg-purple-900 text-purple-300 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settingsSaveSuccess && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{settingsSaveSuccess}</span>
              </div>
            )}

            <div className="space-y-5 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-purple-200">Customer Options per Service:</span>
                  <span className="font-mono text-amber-300 font-extrabold">{ownerSettings.optionsCount} Tiers</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={ownerSettings.optionsCount}
                  onChange={(e) => setOwnerSettings(prev => ({ ...prev, optionsCount: Number(e.target.value) }))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-purple-200">Minimum Baseline Markup (Tier 1):</span>
                  <span className="font-mono text-emerald-400 font-extrabold">₦{ownerSettings.minMarkup.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="3000"
                  step="50"
                  value={ownerSettings.minMarkup}
                  onChange={(e) => setOwnerSettings(prev => ({ ...prev, minMarkup: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-purple-200">Maximum Top-Tier Markup:</span>
                  <span className="font-mono text-indigo-300 font-extrabold">₦{ownerSettings.maxMarkup.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="1500"
                  max="15000"
                  step="100"
                  value={ownerSettings.maxMarkup}
                  onChange={(e) => setOwnerSettings(prev => ({ ...prev, maxMarkup: Number(e.target.value) }))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <span className="text-purple-200 font-bold block">Pricing Aesthetic Style:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOwnerSettings(prev => ({ ...prev, pricingStyle: 'natural' }))}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      ownerSettings.pricingStyle === 'natural'
                        ? 'bg-purple-600 text-white border-purple-400 font-extrabold shadow'
                        : 'bg-[#170c30] text-purple-300 border-purple-900/40 hover:bg-[#251347]'
                    }`}
                  >
                    <div className="font-bold">Natural / Organic</div>
                    <div className="text-[9px] opacity-75 mt-0.5 font-mono">e.g. ₦1,249</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOwnerSettings(prev => ({ ...prev, pricingStyle: 'clean' }))}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      ownerSettings.pricingStyle === 'clean'
                        ? 'bg-purple-600 text-white border-purple-400 font-extrabold shadow'
                        : 'bg-[#170c30] text-purple-300 border-purple-900/40 hover:bg-[#251347]'
                    }`}
                  >
                    <div className="font-bold">Clean 50s</div>
                    <div className="text-[9px] opacity-75 mt-0.5 font-mono">e.g. ₦1,500</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOwnerSettings(prev => ({ ...prev, pricingStyle: 'tiered' }))}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      ownerSettings.pricingStyle === 'tiered'
                        ? 'bg-purple-600 text-white border-purple-400 font-extrabold shadow'
                        : 'bg-[#170c30] text-purple-300 border-purple-900/40 hover:bg-[#251347]'
                    }`}
                  >
                    <div className="font-bold">Tiered Standard</div>
                    <div className="text-[9px] opacity-75 mt-0.5 font-mono">Fixed steps</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-purple-900/40">
              <button
                type="button"
                onClick={() => setIsOwnerSettingsOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-[#170c30] hover:bg-[#251347] text-purple-300 text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleSavePricingSettings()}
                disabled={isSavingSettings}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition cursor-pointer shadow-lg flex items-center space-x-2 disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save & Apply Live</span>
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
