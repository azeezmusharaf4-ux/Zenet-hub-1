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
import { sanitizeApiErrorMessage, isValidOtpCode, isInvalidOtpCode, resolveCountryInfo } from '../utils/api';
import { copyToClipboard } from '../utils/clipboard';
import { CountrySelectModal } from './CountrySelectModal';
import { ServiceSelectModal } from './ServiceSelectModal';
import { ServiceUnavailableView } from './ServiceUnavailableView';

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
  initialServer?: string;
}

export const VirtualNumbersView: React.FC<VirtualNumbersViewProps> = ({
  onBackToMarketplace
}) => {
  return (
    <ServiceUnavailableView
      serviceType="service-number"
      onBackToMarketplace={onBackToMarketplace}
    />
  );
};

export const _OldVirtualNumbersView: React.FC<VirtualNumbersViewProps> = ({
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet,
  initialServer
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
  const [selectedServer, setSelectedServer] = useState<string>(initialServer || 'all1');
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

  // Clear running intervals on unmount to prevent background leaks and unmounted state updates
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

  // Helper to format country names + flags + dials using reliable prefix matcher
  const getCountryDisplayName = (countryId: string, fallbackName?: string, dialCode?: string, phoneNumber?: string) => {
    if (!countryId && !phoneNumber) return 'Select Country';
    const resolved = resolveCountryInfo(countryId || fallbackName, phoneNumber, dialCode);
    return resolved.displayName;
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
        const { ok, data } = await safeFetchJson('/api/onegridhub/servers?action=servers');
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
        const { ok, data } = await safeFetchJson(`/api/onegridhub/countries?action=countries&server=${encodeURIComponent(selectedServer)}`);
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
        const { ok, data } = await safeFetchJson(`/api/onegridhub/services?action=services&server=${encodeURIComponent(selectedServer)}&country=${encodeURIComponent(selectedCountry)}`);
        const serviceList = Array.isArray(data) ? data : (data?.services || data?.data || []);
        if (ok && serviceList.length > 0) {
          setServices(serviceList);
          setSelectedService(prev => {
            if (prev && serviceList.some((s: any) => s.id === prev)) return prev;
            const popular = serviceList.find((s: any) => {
              const n = (s.name || '').toLowerCase();
              return n.includes('whatsapp') || n.includes('telegram') || n.includes('google') || n.includes('openai');
            }) || serviceList[0];
            return popular?.id || '';
          });
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
        `/api/onegridhub/price?action=price&server=${encodeURIComponent(selectedServer)}&country=${encodeURIComponent(selectedCountry)}&service=${encodeURIComponent(selectedService)}&callerEmail=${encodeURIComponent(callerEmail)}`,
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
      const { ok, data } = await safeFetchJson(`/api/onegridhub/orders?action=orders&userId=${encodeURIComponent(userProfile.uid)}`, {
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
    copyToClipboard(text);
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
        const { ok, data } = await safeFetchJson(`/api/onegridhub/status?action=status&order_id=${encodeURIComponent(orderId)}&userId=${encodeURIComponent(userProfile?.uid || '')}`, {
          headers
        });

        if (ok && data) {
          const rawCode = data.code || data.smsCode || data.otp;
          const hasValidOtp = isValidOtpCode(rawCode);

          if (hasValidOtp) {
            setPollingStatus('RECEIVED');
            setVerificationCode(rawCode);
            setSmsContent(data.smsText || `Your verification code is: ${rawCode}`);
            
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            
            onRefreshProfile();
            fetchOrders();
          } else if (data.status === 'CANCELLED' || data.status === 'cancelled' || data.status === 'EXPIRED' || data.status === 'expired') {
            setPollingStatus('CANCELLED');
            setErrorMessage('This session expired or was cancelled by the provider.');
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            fetchOrders();
          } else {
            // Still waiting for real carrier OTP
            setPollingStatus('WAITING');
            setVerificationCode('');
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

  const getServerIndex = (serverId: string) => {
    if (serverId.includes('1') || serverId.endsWith('1')) return '1';
    if (serverId.includes('2') || serverId.endsWith('2')) return '2';
    if (serverId.includes('3') || serverId.endsWith('3')) return '3';
    return '1';
  };

  const selectedServerNumber = getServerIndex(selectedServer);

  const displayedServers = isUsaMode
    ? (servers.filter(s => s.id?.startsWith('usa') || (s as any).region === 'USA').length > 0
        ? servers.filter(s => s.id?.startsWith('usa') || (s as any).region === 'USA')
        : [{ id: 'usa1', name: 'USA Server 1', region: 'USA' }, { id: 'usa2', name: 'USA Server 2', region: 'USA' }, { id: 'usa3', name: 'USA Server 3', region: 'USA' }])
    : (servers.filter(s => s.id?.startsWith('all') || (s as any).region === 'Global').length > 0
        ? servers.filter(s => s.id?.startsWith('all') || (s as any).region === 'Global')
        : [{ id: 'all1', name: 'Server 1 (All Countries)', region: 'Global' }, { id: 'all2', name: 'Server 2 (Pro Gateway)', region: 'Global' }, { id: 'all3', name: 'Server 3 (Special / Direct)', region: 'Global' }]);

  return (
    <div className="w-full max-w-md mx-auto px-3 sm:px-0 space-y-4">
      
      {/* 1. TOP HEADER (Matching Reference Image) */}
      <div className="flex items-center justify-between bg-white text-[#171329] px-4 py-3 rounded-2xl shadow-xs border border-[#E9E2FA]">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={activeStep === 'activation' ? () => setActiveStep('selection') : onBackToMarketplace}
            className="w-9 h-9 bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#171329] rounded-xl transition cursor-pointer border border-[#E9E2FA] flex items-center justify-center shrink-0 active:scale-95"
            title="Back to Marketplace"
          >
            <ArrowLeft className="w-5 h-5 text-[#171329]" />
          </button>

          <h1 className="text-base sm:text-lg font-black tracking-tight text-[#171329]">
            Global Virtual Numbers
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          {isOwner && (
            <button
              onClick={() => setIsOwnerSettingsOpen(true)}
              className="w-9 h-9 bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#171329] rounded-xl border border-[#E9E2FA] flex items-center justify-center transition cursor-pointer shrink-0"
              title="Configure Pricing Engine"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          )}

          <div className="relative w-9 h-9 bg-[#F8F7FF] text-[#716B82] rounded-xl border border-[#E9E2FA] flex items-center justify-center shrink-0">
            <Bell className="w-4.5 h-4.5 text-[#716B82]" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          </div>
        </div>
      </div>

      {infoMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
          <span>{infoMessage}</span>
          <button onClick={() => setInfoMessage('')} className="text-emerald-700 hover:text-emerald-900 font-extrabold cursor-pointer">×</button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-rose-700 hover:text-rose-900 font-extrabold cursor-pointer">×</button>
        </div>
      )}

      {/* STEP 1: SELECTION FLOW */}
      {activeStep === 'selection' && (
        <div className="space-y-4">
          
          {/* 2. REGION SWITCHER (USA Numbers vs All Countries) */}
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('usa');
                const usaSrv = servers.find(s => s.id?.startsWith('usa'))?.id || 'usa1';
                setSelectedServer(usaSrv);
                setSelectedCountry('187');
                setSelectedService('');
              }}
              className={`flex-1 py-2.5 px-4 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-between shadow-xs ${
                isUsaMode
                  ? 'bg-[#6D28D9] text-white shadow-purple-600/20'
                  : 'bg-white text-[#171329] border border-[#E9E2FA] hover:border-[#6D28D9]/40 hover:bg-[#FAF8FE]'
              }`}
            >
              <span className="flex items-center space-x-1.5 truncate">
                <span>🇺🇸</span>
                <span>USA Numbers</span>
              </span>
              <ChevronDown className={`w-4 h-4 ml-1.5 shrink-0 transition-transform ${isUsaMode ? 'text-white' : 'text-[#716B82]'}`} />
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
              className={`py-2.5 px-5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs shrink-0 ${
                !isUsaMode
                  ? 'bg-[#6D28D9] text-white shadow-purple-600/20'
                  : 'bg-white text-[#171329] border border-[#E9E2FA] hover:border-[#6D28D9]/40 hover:bg-[#FAF8FE]'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>All Countries</span>
            </button>
          </div>

          {/* 3. SMS SERVER SELECTION */}
          <div className="space-y-2">
            <span className="text-[11px] font-black text-[#64748B] uppercase tracking-wider block pl-1">
              CHOOSE SMS SERVER
            </span>

            <div className="grid grid-cols-3 gap-2.5">
              {serversLoading ? (
                <div className="col-span-3 text-xs text-[#6D28D9] font-bold flex items-center justify-center space-x-2 py-3 bg-white border border-[#E9E2FA] rounded-2xl shadow-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-[#6D28D9]" />
                  <span>Loading servers...</span>
                </div>
              ) : displayedServers.length === 0 ? (
                <div className="col-span-3 text-xs text-[#716B82] text-center py-3 bg-white border border-[#E9E2FA] rounded-2xl shadow-xs">
                  No servers available.
                </div>
              ) : (
                displayedServers.slice(0, 3).map((s, idx) => {
                  const isSelected = selectedServer === s.id;
                  
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedServer(s.id);
                        setSelectedService('');
                      }}
                      className={`flex items-center justify-center py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all border cursor-pointer shadow-xs space-x-1.5 ${
                        isSelected
                          ? 'bg-[#6D28D9] text-white border-[#6D28D9] shadow-purple-600/20'
                          : 'bg-white text-[#475569] border-[#E9E2FA] hover:border-[#6D28D9]/40 hover:bg-[#FAF8FE] hover:text-[#171329]'
                      }`}
                    >
                      <Server className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-[#475569]'}`} />
                      <span>Server {idx + 1}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. SERVER CONTENT CARD */}
          <div className="bg-white border border-[#E9E2FA] rounded-3xl shadow-sm relative z-10 overflow-hidden">
            
            {/* Header Banner */}
            <div className="bg-[#6D28D9] px-4 py-3 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-white shrink-0 shadow-xs" />
                <Server className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="text-xs sm:text-sm font-black tracking-wider uppercase">
                  {isUsaMode ? 'USA' : 'ALL COUNTRIES'} SERVER {selectedServerNumber}
                </span>
              </div>
              <span className="text-[10px] font-bold bg-white/15 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Online
              </span>
            </div>

            {/* Card Content & Fields */}
            <div className="p-4 sm:p-5 space-y-3">
              
              {/* Field 1: COUNTRY */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (isUsaMode) return;
                    setIsCountryModalOpen(true);
                  }}
                  className={`w-full flex items-center justify-between space-x-3 bg-[#F8F7FF] hover:bg-[#F3F0FA] border border-[#E9E2FA] hover:border-[#6D28D9]/40 p-3.5 rounded-2xl transition text-left focus:outline-none group shadow-2xs ${
                    isUsaMode ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#6D28D9] text-white shrink-0 flex items-center justify-center shadow-xs">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest block mb-0.5">
                        COUNTRY {isUsaMode ? '(USA)' : ''}
                      </span>
                      {countriesLoading ? (
                        <div className="text-xs text-[#6D28D9] font-bold flex items-center space-x-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading countries...</span>
                        </div>
                      ) : selectedCountry && currentCountryObj ? (
                        <span className="text-sm font-black text-[#171329] truncate block">
                          {`${getCountryFlagEmoji(currentCountryObj.id || currentCountryObj.code || currentCountryObj.name)} ${currentCountryObj.name || currentCountryObj.id}${getCountryDialCode(currentCountryObj.id, currentCountryObj.name, currentCountryObj.code) ? ` (${getCountryDialCode(currentCountryObj.id, currentCountryObj.name, currentCountryObj.code)})` : ''}`}
                        </span>
                      ) : selectedCountry ? (
                        <span className="text-sm font-black text-[#171329] truncate block">
                          {getCountryDisplayName(selectedCountry)}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-[#64748B] truncate block">
                          Select Country
                        </span>
                      )}
                    </div>
                  </div>
                  {!isUsaMode && (
                    <ChevronRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#6D28D9] shrink-0 transition-transform" />
                  )}
                </button>
              </div>

              {/* Field 2: SERVICE */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsServiceModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between space-x-3 bg-[#F8F7FF] hover:bg-[#F3F0FA] border border-[#E9E2FA] hover:border-[#6D28D9]/40 p-3.5 rounded-2xl transition cursor-pointer text-left focus:outline-none group shadow-2xs"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#6D28D9] text-white shrink-0 flex items-center justify-center shadow-xs">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest block mb-0.5">
                        SERVICE
                      </span>
                      {!selectedCountry ? (
                        <span className="text-sm font-medium text-[#94A3B8] truncate block">
                          Select Country First
                        </span>
                      ) : servicesLoading ? (
                        <div className="text-xs text-[#6D28D9] font-bold flex items-center space-x-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading services...</span>
                        </div>
                      ) : currentServiceObj ? (
                        <span className="text-sm font-black text-[#171329] truncate block">
                          {getServiceDisplayName(currentServiceObj.id, currentServiceObj.name)}
                        </span>
                      ) : selectedService ? (
                        <span className="text-sm font-black text-[#171329] truncate block">
                          {getServiceDisplayName(selectedService)}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-[#64748B] truncate block">
                          Select Service
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#6D28D9] shrink-0 transition-transform" />
                </button>
              </div>

              {/* Price Options Preview when Country & Service are Selected */}
              {selectedCountry && selectedService && (
                <div className="bg-[#F8F7FF] border border-[#E9E2FA] p-3.5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-black text-[#716B82] uppercase tracking-widest">
                      {priceOptions.length > 1 ? 'Select Line Quality / Tier' : 'Line Price'}
                    </span>
                    {isPriceAvailable && (
                      <span className="font-mono font-bold text-[#047857] text-sm">
                        ₦{calculatedPrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Owner Pricing Breakdown - OneGridHub Original Price -> My Markup -> Final Customer Price */}
                  {isOwner && isPriceAvailable && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                        <span className="flex items-center gap-1.5">
                          <span>👑 Owner Pricing Breakdown</span>
                        </span>
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300 uppercase tracking-wider">
                          OneGridHub Upstream
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                        <div className="bg-white p-2 rounded-lg border border-amber-200 shadow-xs">
                          <span className="text-[9px] font-bold text-[#716B82] block uppercase font-sans tracking-wide">
                            OneGridHub Price
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-[#171329]">
                            ₦{providerPrice.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="bg-white p-2 rounded-lg border border-amber-200 shadow-xs">
                          <span className="text-[9px] font-bold text-amber-700 block uppercase font-sans tracking-wide">
                            My Markup
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-amber-800">
                            +₦{markupAmount.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="bg-white p-2 rounded-lg border border-emerald-200 shadow-xs">
                          <span className="text-[9px] font-bold text-[#047857] block uppercase font-sans tracking-wide">
                            Customer Price
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-[#047857]">
                            ₦{calculatedPrice.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {priceLoading ? (
                    <div className="flex items-center space-x-2 py-2 text-xs text-[#6D28D9] font-bold">
                      <Loader2 className="w-4 h-4 animate-spin text-[#6D28D9]" />
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
                                ? 'bg-[#EDE9FE] border-[#6D28D9] shadow-xs ring-1 ring-[#6D28D9]'
                                : 'bg-white border-[#E9E2FA] hover:border-[#6D28D9]/40'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#171329]">{opt.tierName}</span>
                              {opt.badge && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]">
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-[#047857] font-mono mt-1">
                              ₦{opt.customerPrice.toLocaleString()}
                            </span>
                            {isOwner && opt.providerCost !== undefined && (
                              <span className="text-[9px] text-amber-700 font-mono block mt-0.5">
                                Cost: ₦{opt.providerCost.toLocaleString()} • +₦{(opt.markup !== undefined ? opt.markup : (opt.customerPrice - opt.providerCost)).toLocaleString()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : !isPriceAvailable && (
                    <div className="py-2 px-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{priceErrorMessage || 'This service is currently unavailable for the chosen country.'}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#E9E2FA] text-[#716B82]">
                    <span>Wallet Balance:</span>
                    <span className="font-mono font-bold text-[#171329]">₦{walletBalance.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Rent Number Button (Matching Reference Image IMG_3238.png) */}
              {!selectedCountry || !selectedService ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center shadow-xs bg-[#A78BFA] text-white cursor-not-allowed opacity-90"
                >
                  <FileText className="w-4.5 h-4.5 mr-2 shrink-0" />
                  <span>RENT NUMBER</span>
                </button>
              ) : walletBalance < calculatedPrice && isPriceAvailable && calculatedPrice > 0 ? (
                <button
                  type="button"
                  onClick={onOpenWallet}
                  className="w-full py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-purple-600/20 bg-[#6D28D9] hover:bg-[#5B21B6] text-white active:scale-[0.99]"
                >
                  <CreditCard className="w-4.5 h-4.5 mr-2 shrink-0" />
                  <span>FUND WALLET (₦{(calculatedPrice - walletBalance).toLocaleString()} Needed)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBuyNumber}
                  disabled={buyingLoading || priceLoading || !isPriceAvailable || calculatedPrice <= 0}
                  className="w-full py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center shadow-md shadow-purple-600/25 active:scale-[0.99] cursor-pointer bg-[#6D28D9] hover:bg-[#5B21B6] text-white disabled:bg-[#A78BFA] disabled:opacity-90 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  {buyingLoading ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin mr-2 shrink-0" />
                      <span>Provisioning Number...</span>
                    </>
                  ) : !isPriceAvailable ? (
                    <>
                      <XCircle className="w-4.5 h-4.5 mr-2 shrink-0" />
                      <span>Unavailable for Selection</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4.5 h-4.5 mr-2 shrink-0" />
                      <span>RENT NUMBER</span>
                    </>
                  )}
                </button>
              )}

            </div>
          </div>

          {/* 5. MY ORDERS SECTION (Matching Reference Image) */}
          <div className="space-y-3 pt-2">
            
            <div className="flex items-center justify-between px-1">
              <h3 className="font-black text-[#171329] text-base tracking-tight flex items-center space-x-2">
                <Clock className="w-4.5 h-4.5 text-[#6D28D9]" />
                <span>My Orders</span>
              </h3>
              <span className="text-xs font-bold bg-[#FAF8FE] border border-[#E9E2FA] text-[#6D28D9] px-3 py-0.5 rounded-full">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'}
              </span>
            </div>

            {ordersLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-[#64748B] text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-[#6D28D9] mb-2" />
                <span>Loading your orders...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white border border-dashed border-[#E9E2FA] rounded-3xl shadow-xs">
                <div className="w-12 h-12 rounded-full bg-[#FAF8FE] border border-[#E9E2FA] flex items-center justify-center mx-auto mb-3 text-[#6D28D9]">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-sm font-black text-[#171329]">No orders yet</p>
                <p className="text-xs text-[#64748B] mt-1 font-medium">Your purchased numbers will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => {
                  const hasValidCode = isValidOtpCode(o.code);
                  const isCompleted = hasValidCode;
                  const isCancelled = o.status === 'CANCELLED' || o.status === 'cancelled' || o.status === 'EXPIRED' || o.status === 'expired';
                  const isWaiting = !hasValidCode && !isCancelled;

                  // Tag determination
                  const resolvedCountry = resolveCountryInfo(o.country || o.countryName, o.phoneNumber, o.countryCode);
                  const isUsaOrder = resolvedCountry.id === 'US' || (o.server || '').includes('usa');
                  const serverPill = isUsaOrder ? 'USA SV3' : (o.server === 'server_2' ? 'ALL SV2' : o.server === 'server_3' ? 'ALL SV3' : 'ALL SV1');

                  return (
                    <div 
                      key={o.orderId}
                      className="bg-white border border-[#E9E2FA] rounded-2xl shadow-xs p-3.5 space-y-2.5"
                    >
                      {/* Top Row */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full text-white bg-[#6D28D9] uppercase tracking-wider">
                            {serverPill}
                          </span>
                          <span className="font-bold text-[#171329] truncate max-w-[180px]">
                            {getServiceDisplayName(o.service, o.serviceName || o.service)}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#64748B] font-medium">
                          {formatDateSimple(o.createdAt)}
                        </span>
                      </div>

                      {/* Number & Copy Row */}
                      <div className="flex items-center justify-between bg-[#FAF8FE] border border-[#E9E2FA] p-2.5 rounded-xl">
                        <span className="text-base sm:text-lg font-black text-[#6D28D9] tracking-wider">
                          {o.phoneNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(o.phoneNumber, o.orderId)}
                          className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-[#EDE9FE] border border-[#E9E2FA] text-[#171329] rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                        >
                          {copiedText === o.orderId ? (
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

                      {/* Info & Status Badges Row */}
                      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[#E9E2FA] text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="text-[#64748B] font-semibold flex items-center space-x-1">
                            <Globe className="w-3.5 h-3.5 mr-1 inline text-[#6D28D9]" />
                            <span>{resolvedCountry.flag} {resolvedCountry.displayName}</span>
                          </span>
                          <span className="bg-emerald-50 border border-emerald-200 text-[#047857] font-bold px-2 py-0.5 rounded-md">
                            ₦{(Number(o.customerPrice || o.price || 0)).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          {hasValidCode ? (
                            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                              COMPLETED
                            </span>
                          ) : isWaiting ? (
                            <span className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                              WAITING FOR OTP
                            </span>
                          ) : (
                            <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                              {o.status || 'EXPIRED'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Received OTP Box or Waiting Box */}
                      {hasValidCode ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center space-y-1">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">OTP RECEIVED</span>
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-xl font-black text-emerald-900 tracking-widest">{o.code}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(o.code, `${o.orderId}-code`)}
                              className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition cursor-pointer"
                              title="Copy OTP"
                            >
                              {copiedText === `${o.orderId}-code` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      ) : isWaiting ? (
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-center space-y-1">
                          <div className="flex items-center justify-center space-x-1.5 text-amber-800">
                            <Clock className="w-3.5 h-3.5 animate-spin text-amber-600" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">WAITING FOR OTP</span>
                          </div>
                          <p className="text-xs text-amber-700 font-medium">Waiting for the verification code...</p>
                        </div>
                      ) : null}

                      {/* Buy Again Button */}
                      <button
                        type="button"
                        onClick={() => handleBuyAgain(o)}
                        className="w-full py-2 bg-[#FAF8FE] hover:bg-[#EDE9FE] border border-[#E9E2FA] text-[#6D28D9] hover:text-[#5B21B6] text-xs font-black rounded-xl transition flex items-center justify-center cursor-pointer shadow-2xs"
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
        <div className="bg-white border border-[#E9E2FA] rounded-[30px] overflow-hidden shadow-sm space-y-5 p-6">
          
          <div className="text-center space-y-1.5">
            <h3 className="font-bold text-lg text-[#171329] tracking-tight uppercase">Active SMS Verification</h3>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#6D28D9] bg-[#F5F3FF] border border-[#DDD6FE] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span>{resolveCountryInfo(activeOrder.country, activeOrder.phoneNumber).flag}</span>
                <span>{resolveCountryInfo(activeOrder.country, activeOrder.phoneNumber).displayName}</span>
              </span>
              <p className="text-xs text-[#716B82] font-semibold">
                Order ID: <span className="font-mono text-[11px] bg-[#F8F7FF] border border-[#E9E2FA] px-2 py-0.5 rounded text-[#171329]">{activeOrder.orderId}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-[#F8F7FF] rounded-2xl border border-[#E9E2FA] text-center space-y-3">
            {pollingStatus === 'WAITING' ? (
              <>
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-[#7C3AED] animate-spin" />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#171329]">
                    {formatTime(elapsedSeconds)}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#171329] uppercase tracking-wider animate-pulse">WAITING FOR OTP</h4>
                <p className="text-[11px] text-[#716B82] leading-relaxed max-w-sm">
                  Waiting for the verification code... Please use the phone number below to request your OTP. This screen will automatically update as soon as the carrier delivers the code.
                </p>
              </>
            ) : pollingStatus === 'RECEIVED' && isValidOtpCode(verificationCode) ? (
              <>
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-200">
                  <Check className="w-6 h-6 animate-bounce" />
                </div>
                <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Verification Complete!</h4>
                <p className="text-xs text-emerald-700">The carrier gateway has delivered your OTP successfully.</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-200">
                  <XCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-rose-800 uppercase tracking-wider">Session Terminated</h4>
                <p className="text-xs text-rose-700">This purchase session was cancelled or timed out.</p>
              </>
            )}
          </div>

          {/* Virtual Phone Number Box */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[#716B82] uppercase tracking-widest block">Your Virtual Phone Number</span>
            <div className="flex items-center justify-between bg-white border border-[#E9E2FA] p-4 rounded-2xl shadow-xs">
              <span className="text-lg sm:text-xl font-bold text-[#171329] tracking-wider font-mono">
                {activeOrder.phoneNumber}
              </span>
              <button
                onClick={() => handleCopy(activeOrder.phoneNumber, 'number')}
                className="flex items-center space-x-1.5 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                {copiedText === 'number' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText === 'number' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* OTP Code Box */}
          {pollingStatus === 'RECEIVED' && isValidOtpCode(verificationCode) && (
            <div className="space-y-4 pt-2">
              <span className="text-[10px] font-bold text-[#716B82] uppercase tracking-widest block">Delivered Verification Code</span>
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">OTP RECEIVED ✓</span>
                
                <span className="text-4xl sm:text-5xl font-extrabold text-emerald-900 tracking-[0.4em] block pl-4 font-mono">
                  {verificationCode.split('').join(' ')}
                </span>

                <button
                  type="button"
                  onClick={() => handleCopy(verificationCode, 'code')}
                  className="mx-auto flex items-center space-x-2 px-5 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold rounded-xl border border-emerald-300 transition cursor-pointer"
                >
                  {copiedText === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText === 'code' ? 'Copied OTP' : 'Copy OTP'}</span>
                </button>

                <span className="text-[10px] text-[#716B82] block">Message: &quot;{smsContent}&quot;</span>
              </div>
            </div>
          )}

          {/* Control Actions */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-2">
            {pollingStatus === 'WAITING' && (
              <button
                onClick={handleCancelOrder}
                disabled={cancellingLoading}
                className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
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
              className="w-full py-3.5 px-4 bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#171329] hover:text-[#7C3AED] text-xs font-bold uppercase tracking-wider rounded-xl border border-[#E9E2FA] transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Back to Selection</span>
            </button>
          </div>

        </div>
      )}

      {/* OWNER PRICING ENGINE MODAL */}
      {isOwner && isOwnerSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E9E2FA] rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 text-[#171329]">
            
            <div className="flex items-center justify-between border-b border-[#E9E2FA] pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-amber-500 to-purple-600 rounded-2xl shadow-sm text-white">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-[#171329] tracking-tight">
                    Virtual Number Pricing Engine
                  </h3>
                  <p className="text-xs text-[#716B82]">
                    Control dynamic pricing generated from OneGridHub
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOwnerSettingsOpen(false)}
                className="p-2 bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#171329] rounded-xl transition cursor-pointer border border-[#E9E2FA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settingsSaveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{settingsSaveSuccess}</span>
              </div>
            )}

            <div className="space-y-5 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-[#171329]">Customer Options per Service:</span>
                  <span className="font-mono text-amber-700 font-extrabold">{ownerSettings.optionsCount} Tiers</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={ownerSettings.optionsCount}
                  onChange={(e) => setOwnerSettings(prev => ({ ...prev, optionsCount: Number(e.target.value) }))}
                  className="w-full accent-[#7C3AED] cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-[#171329]">Minimum Baseline Markup (Tier 1):</span>
                  <span className="font-mono text-[#047857] font-extrabold">₦{ownerSettings.minMarkup.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="3000"
                  step="50"
                  value={ownerSettings.minMarkup}
                  onChange={(e) => setOwnerSettings(prev => ({ ...prev, minMarkup: Number(e.target.value) }))}
                  className="w-full accent-[#047857] cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-[#171329]">Maximum Top-Tier Markup:</span>
                  <span className="font-mono text-[#7C3AED] font-extrabold">₦{ownerSettings.maxMarkup.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="1500"
                  max="15000"
                  step="100"
                  value={ownerSettings.maxMarkup}
                  onChange={(e) => setOwnerSettings(prev => ({ ...prev, maxMarkup: Number(e.target.value) }))}
                  className="w-full accent-[#7C3AED] cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <span className="text-[#171329] font-bold block">Pricing Aesthetic Style:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOwnerSettings(prev => ({ ...prev, pricingStyle: 'natural' }))}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      ownerSettings.pricingStyle === 'natural'
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] font-bold shadow-sm'
                        : 'bg-[#F8F7FF] text-[#716B82] border-[#E9E2FA] hover:bg-white hover:text-[#171329]'
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
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] font-bold shadow-sm'
                        : 'bg-[#F8F7FF] text-[#716B82] border-[#E9E2FA] hover:bg-white hover:text-[#171329]'
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
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] font-bold shadow-sm'
                        : 'bg-[#F8F7FF] text-[#716B82] border-[#E9E2FA] hover:bg-white hover:text-[#171329]'
                    }`}
                  >
                    <div className="font-bold">Tiered Standard</div>
                    <div className="text-[9px] opacity-75 mt-0.5 font-mono">Fixed steps</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#E9E2FA]">
              <button
                type="button"
                onClick={() => setIsOwnerSettingsOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#171329] text-xs font-bold transition cursor-pointer border border-[#E9E2FA]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleSavePricingSettings()}
                disabled={isSavingSettings}
                className="px-6 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition cursor-pointer shadow-sm flex items-center space-x-2 disabled:opacity-50"
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

      {/* ========================================================================= */}
      {/* MODAL: COUNTRY SELECTOR (SEARCHABLE MODAL)                                 */}
      {/* ========================================================================= */}
      <CountrySelectModal
        isOpen={isCountryModalOpen && !isUsaMode}
        onClose={() => setIsCountryModalOpen(false)}
        countries={countries}
        selectedCountryId={selectedCountry}
        onSelectCountry={(countryId) => {
          setSelectedCountry(countryId);
          setSelectedService('');
        }}
        isLoading={countriesLoading}
      />

      {/* ========================================================================= */}
      {/* MODAL: SERVICE SELECTOR (SEARCHABLE MODAL)                                 */}
      {/* ========================================================================= */}
      <ServiceSelectModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        services={services.map(s => ({
          id: s.id,
          name: getServiceDisplayName(s.id, s.name),
          price: s.price
        }))}
        selectedServiceId={selectedService}
        onSelectService={(serviceId) => setSelectedService(serviceId)}
        isLoading={servicesLoading}
        hasSelectedCountry={!!selectedCountry}
        countryName={currentCountryObj?.name || getCountryDisplayName(selectedCountry)}
      />

    </div>
  );
};
