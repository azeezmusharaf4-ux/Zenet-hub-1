import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Phone, 
  Rocket, 
  Globe, 
  Smartphone, 
  ChevronRight, 
  CreditCard, 
  RotateCw, 
  X, 
  Search, 
  Copy, 
  Check, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  Clock, 
  ArrowLeft, 
  Settings, 
  Instagram, 
  Facebook, 
  Youtube, 
  Twitter, 
  Send, 
  Linkedin, 
  Ghost, 
  Music2, 
  Gamepad2, 
  RefreshCw, 
  Sparkles,
  Link2,
  Hash,
  ArrowRight,
  Cpu,
  PhoneCall,
  Flame,
  Wrench
} from 'lucide-react';
import { UserProfile, SocialBoostService, SocialBoostOrder, SocialBoostPricingSettings } from '../types';
import { auth, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch, sanitizeApiErrorMessage } from '../utils/api';

export type Server2Page = 'front' | 'buy-numbers' | 'boost-accounts';

interface Server2ViewProps {
  initialPage?: Server2Page;
  hideSwitcherTabs?: boolean;
  userProfile: UserProfile | null;
  walletBalance: number;
  onRefreshProfile?: () => Promise<void>;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  onSwitchToServer1?: () => void;
}

interface ServiceNumber2Server {
  id: string;
  name: string;
}

interface ServiceNumber2Country {
  id: string;
  name: string;
  code?: string;
  flag?: string;
}

interface ServiceNumber2Service {
  id: string;
  name: string;
  code?: string;
}

interface ServiceNumber2PriceOption {
  optionId: string;
  carrierTier: string;
  successRate: string;
  costInNgn: number;
  customerPrice: number;
  isPopular?: boolean;
}

interface ServiceNumber2Order {
  orderId: string;
  id?: string;
  phoneNumber?: string;
  service?: string;
  country?: string;
  amount?: number;
  status: 'ACTIVE' | 'SMS_RECEIVED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | string;
  code?: string;
  smsText?: string;
  createdAt?: string;
  expiresAt?: string;
}

// Country flag emoji helper
const getCountryFlagEmoji = (codeOrName: string = ''): string => {
  const code = codeOrName.trim().toUpperCase();
  if (!code) return '🌐';
  if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
    const codePoints = code.split('').map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
  const nameMap: Record<string, string> = {
    'UNITED STATES': '🇺🇸',
    'USA': '🇺🇸',
    'US': '🇺🇸',
    'NIGERIA': '🇳🇬',
    'NG': '🇳🇬',
    'UNITED KINGDOM': '🇬🇧',
    'UK': '🇬🇧',
    'CANADA': '🇨🇦',
    'GERMANY': '🇩🇪',
    'FRANCE': '🇫🇷',
    'BRAZIL': '🇧🇷',
    'INDIA': '🇮🇳',
    'INDONESIA': '🇮🇩',
    'RUSSIA': '🇷🇺',
    'KENYA': '🇰🇪',
    'GHANA': '🇬🇭',
    'SOUTH AFRICA': '🇿🇦',
    'UKRAINE': '🇺🇦',
    'PHILIPPINES': '🇵🇭',
    'CHINA': '🇨🇳',
    'NETHERLANDS': '🇳🇱'
  };
  return nameMap[code] || '🌐';
};

// 12 SMM Platforms exactly from Screenshot 3 (IMG_2715.png)
interface PlatformItem {
  id: string;
  name: string;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
}

const SMM_PLATFORMS: PlatformItem[] = [
  { id: 'instagram', name: 'Instagram', icon: Instagram, iconColor: 'text-[#E1306C]' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, iconColor: 'text-[#1877F2]' },
  { id: 'tiktok', name: 'TikTok', icon: Music2, iconColor: 'text-[#00F2FE]' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, iconColor: 'text-[#FF0000]' },
  { id: 'twitter', name: 'Twitter', icon: Twitter, iconColor: 'text-[#1DA1F2]' },
  { id: 'telegram', name: 'Telegram', icon: Send, iconColor: 'text-[#0088CC]' },
  { id: 'discord', name: 'Discord', icon: Gamepad2, iconColor: 'text-[#5865F2]' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, iconColor: 'text-[#0A66C2]' },
  { id: 'other', name: 'Other', icon: Rocket, iconColor: 'text-[#A855F7]' },
  { id: 'snapchat', name: 'Snapchat', icon: Ghost, iconColor: 'text-[#FFFC00]' },
  { id: 'spotify', name: 'Spotify', icon: Music2, iconColor: 'text-[#1DB954]' },
  { id: 'website', name: 'Website', icon: Globe, iconColor: 'text-[#38BDF8]' },
];

export const Server2View: React.FC<Server2ViewProps> = ({
  initialPage = 'front',
  hideSwitcherTabs = false,
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet,
  onSwitchToServer1
}) => {
  // Navigation between the 3 views
  const [currentPage, setCurrentPage] = useState<Server2Page>(initialPage);

  // Synchronize currentPage if initialPage prop changes
  useEffect(() => {
    if (initialPage) {
      setCurrentPage(initialPage);
    }
  }, [initialPage]);

  // Global helper to return to marketplace and scroll to the top
  const handleBackToMarket = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    onBackToMarketplace();
  };

  // General Notification messages
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string>('');

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2500);
  };

  const isOwner = useMemo(() => {
    if (!userProfile) return false;
    return userProfile.role === 'owner' || 
           userProfile.email === 'azeezmusharaf4@gmail.com' ||
           userProfile.isOwner === true;
  }, [userProfile]);

  // =========================================================================
  // PAGE 1: BUY NUMBERS (Screenshot 2 - IMG_2714.png) STATE & LOGIC
  // =========================================================================
  const [activeTab, setActiveTab] = useState<'usa' | 'all'>('usa');
  const [servers, setServers] = useState<ServiceNumber2Server[]>([
    { id: 'usa1', name: 'USA 1' },
    { id: 'usa2', name: 'USA 2' },
  ]);
  const [selectedServer, setSelectedServer] = useState<string>('usa1');

  const [countries, setCountries] = useState<ServiceNumber2Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState<boolean>(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('187');

  const [services, setServices] = useState<ServiceNumber2Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<string>('');

  const [priceOptions, setPriceOptions] = useState<ServiceNumber2PriceOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('opt_1');
  const selectedOptionIdRef = useRef<string>(selectedOptionId);
  useEffect(() => {
    selectedOptionIdRef.current = selectedOptionId;
  }, [selectedOptionId]);
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);
  const [pricesLoading, setPricesLoading] = useState<boolean>(false);
  const [isServiceInStock, setIsServiceInStock] = useState<boolean>(false);
  const [stockMessage, setStockMessage] = useState<string>('');

  // Modals for Buy Numbers
  const [isCountryModalOpen, setIsCountryModalOpen] = useState<boolean>(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState<string>('');
  const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');
  const [isNumberOrdersModalOpen, setIsNumberOrdersModalOpen] = useState<boolean>(false);
  const [numberOrders, setNumberOrders] = useState<ServiceNumber2Order[]>([]);

  // Active Number Order & Live SMS Polling
  const [activeNumberOrder, setActiveNumberOrder] = useState<ServiceNumber2Order | null>(null);
  const [buyingNumberLoading, setBuyingNumberLoading] = useState<boolean>(false);
  const [cancellingNumberLoading, setCancellingNumberLoading] = useState<boolean>(false);
  const [pollingStatus, setPollingStatus] = useState<'IDLE' | 'WAITING' | 'RECEIVED' | 'CANCELLED'>('IDLE');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [smsContent, setSmsContent] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Load Countries for Buy Numbers directly from live Extra Log Tools API
  const fetchCountries = useCallback(async (serverToUse: string, tabToUse: 'usa' | 'all') => {
    setCountriesLoading(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data: any = await safeApiFetch(`/api/service-number-2/countries?server=${encodeURIComponent(serverToUse)}&tab=${tabToUse}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (data && data.success && Array.isArray(data.countries) && data.countries.length > 0) {
        setCountries(data.countries);
        setSelectedCountry((prev) => {
          if (tabToUse === 'usa') {
            const usa = data.countries.find((c: any) => c.code === 'US' || c.id === '187' || c.name?.toLowerCase().includes('united states'));
            return usa?.id || data.countries[0]?.id || '187';
          }
          if (prev && data.countries.some((c: any) => c.id === prev)) {
            return prev;
          }
          const defaultCountry = data.countries.find((c: any) => c.name?.toLowerCase().includes('united states') || c.id === '187') || data.countries[0];
          return defaultCountry?.id || '';
        });
      } else {
        setCountries([]);
        setSelectedCountry(tabToUse === 'usa' ? '187' : '');
        if (data && data.error) {
          setErrorMessage(`Extra Log Tools: ${data.error}`);
        }
      }
    } catch (err: any) {
      setCountries([]);
      setSelectedCountry(tabToUse === 'usa' ? '187' : '');
      setErrorMessage(`Extra Log Tools connection error: ${err.message}`);
    } finally {
      setCountriesLoading(false);
    }
  }, []);

  // Load Services for Buy Numbers directly from live Extra Log Tools API
  const fetchServices = useCallback(async (serverToUse: string, countryToUse: string, tabToUse: 'usa' | 'all') => {
    if (!countryToUse) {
      setServices([]);
      setSelectedService('');
      return;
    }
    setServicesLoading(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data: any = await safeApiFetch(`/api/service-number-2/services?server=${encodeURIComponent(serverToUse)}&country=${encodeURIComponent(countryToUse)}&tab=${tabToUse}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (data && data.success && Array.isArray(data.services) && data.services.length > 0) {
        setServices(data.services);
        setSelectedService((prev) => {
          if (prev && data.services.some((s: any) => s.id === prev)) return prev;
          const popular = data.services.find((s: any) => {
            const n = (s.name || '').toLowerCase();
            return n.includes('whatsapp') || n.includes('telegram') || n.includes('google') || n.includes('openai');
          }) || data.services[0];
          return popular?.id || '';
        });
      } else {
        setServices([]);
        setSelectedService('');
        if (data && data.error) {
          setStockMessage(`Extra Log Tools: ${data.error}`);
        }
      }
    } catch (err: any) {
      setServices([]);
      setSelectedService('');
      setStockMessage(`Extra Log Tools connection error: ${err.message}`);
    } finally {
      setServicesLoading(false);
    }
  }, []);

  // Load Prices for selected service directly from live Extra Log Tools API
  const fetchPrices = useCallback(async (serverToUse: string, countryToUse: string, serviceToUse: string, tabToUse: 'usa' | 'all') => {
    if (!countryToUse || !serviceToUse) {
      setIsServiceInStock(false);
      setStockMessage('');
      setPriceOptions([]);
      setCalculatedPrice(0);
      return;
    }
    setPricesLoading(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data: any = await safeApiFetch(
        `/api/service-number-2/prices?server=${encodeURIComponent(serverToUse)}&country=${encodeURIComponent(countryToUse)}&service=${encodeURIComponent(serviceToUse)}&tab=${tabToUse}`,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
      );
      if (data && data.success && data.inStock && Array.isArray(data.options) && data.options.length > 0) {
        setIsServiceInStock(true);
        setStockMessage('');
        setPriceOptions(data.options);
        const sel = data.options.find((o: any) => o.optionId === selectedOptionIdRef.current) || data.options[0];
        if (sel) {
          setSelectedOptionId(sel.optionId);
          setCalculatedPrice(sel.customerPrice || 1200);
        }
      } else {
        setIsServiceInStock(false);
        const providerNotice = data?.error || data?.message || 'Service currently unavailable from Extra Log Tools on this server.';
        setStockMessage(providerNotice);
        setPriceOptions([]);
        setCalculatedPrice(0);
      }
    } catch (err: any) {
      setIsServiceInStock(false);
      setStockMessage(`Extra Log Tools price error: ${err.message}`);
      setPriceOptions([]);
      setCalculatedPrice(0);
    } finally {
      setPricesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries(selectedServer, activeTab);
  }, [selectedServer, activeTab, fetchCountries]);

  useEffect(() => {
    if (selectedCountry) {
      fetchServices(selectedServer, selectedCountry, activeTab);
    } else {
      setServices([]);
      setSelectedService('');
    }
  }, [selectedServer, selectedCountry, activeTab, fetchServices]);

  useEffect(() => {
    if (selectedCountry && selectedService) {
      fetchPrices(selectedServer, selectedCountry, selectedService, activeTab);
    } else {
      setIsServiceInStock(false);
      setPriceOptions([]);
      setCalculatedPrice(0);
    }
  }, [selectedServer, selectedCountry, selectedService, activeTab, fetchPrices]);

  // Polling SMS timer & status
  useEffect(() => {
    let interval: any = null;
    if (activeNumberOrder && pollingStatus === 'WAITING') {
      interval = setInterval(async () => {
        setElapsedSeconds((prev) => prev + 2);
        try {
          const token = await getSafeIdToken(auth.currentUser);
          const data: any = await safeApiFetch(`/api/service-number-2/sms?orderId=${encodeURIComponent(activeNumberOrder.orderId)}`, {
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
          });
          if (data && (data.status === 'SMS_RECEIVED' || data.code)) {
            setPollingStatus('RECEIVED');
            setVerificationCode(data.code || '');
            setSmsContent(data.smsText || data.fullSms || '');
            setInfoMessage('SMS Verification Code Received!');
          } else if (data && data.status === 'CANCELLED') {
            setPollingStatus('CANCELLED');
            setErrorMessage('Order cancelled by provider. Full refund credited to your wallet.');
            setActiveNumberOrder(null);
          }
        } catch {
          // Keep polling smoothly
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeNumberOrder?.orderId, pollingStatus]);

  // Buy Number Action directly through Extra Log Tools live endpoint
  const handleBuyNumber = async () => {
    if (!selectedCountry || !selectedService) {
      setErrorMessage('Please select both Country and Service first.');
      return;
    }
    if (!isServiceInStock) {
      setErrorMessage(stockMessage || 'This service is currently unavailable on this server.');
      return;
    }
    if (walletBalance < calculatedPrice) {
      setErrorMessage(`Insufficient balance (₦${walletBalance.toLocaleString()}). You need ₦${calculatedPrice.toLocaleString()} to purchase this number.`);
      return;
    }

    setBuyingNumberLoading(true);
    setErrorMessage('');
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data: any = await safeApiFetch('/api/service-number-2/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          userEmail: auth.currentUser?.email,
          server: selectedServer,
          tab: activeTab,
          country: selectedCountry,
          service: selectedService,
          countryName: selectedCountryObj?.name || '',
          serviceName: selectedServiceObj?.name || '',
          optionId: selectedOptionId,
          amount: calculatedPrice,
          price: calculatedPrice
        })
      });

      if (!data || !data.success) {
        throw new Error(data?.error || data?.message || 'Failed to allocate live number from Extra Log Tools');
      }

      const allocatedPhone = data.order?.phoneNumber || data.phoneNumber;
      if (!allocatedPhone) {
        throw new Error(data.error || 'Extra Log Tools did not return an allocated number.');
      }
      const allocatedOrderId = data.orderId || data.order?.orderId || `XTRA-${Date.now()}`;

      setActiveNumberOrder({
        orderId: allocatedOrderId,
        phoneNumber: allocatedPhone,
        service: selectedServiceObj?.name || selectedService,
        country: selectedCountryObj?.name || selectedCountry,
        amount: calculatedPrice,
        status: 'ACTIVE'
      });
      setPollingStatus('WAITING');
      setElapsedSeconds(0);
      setVerificationCode('');
      setSmsContent('');
      setInfoMessage('Virtual Number assigned! Enter this number into your target app.');
      if (onRefreshProfile) await onRefreshProfile();
    } catch (err: any) {
      setErrorMessage(sanitizeApiErrorMessage(err.message || 'Error buying number'));
    } finally {
      setBuyingNumberLoading(false);
    }
  };

  // Cancel Number Action
  const handleCancelNumber = async () => {
    if (!activeNumberOrder) return;
    setCancellingNumberLoading(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data: any = await safeApiFetch('/api/service-number-2/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ orderId: activeNumberOrder.orderId })
      });
      if (!data || data.error || !data.success) {
        throw new Error(data?.error || 'Could not cancel number');
      }
      setInfoMessage('Order cancelled. 100% full refund has been credited to your wallet balance.');
      setActiveNumberOrder(null);
      setPollingStatus('IDLE');
      if (onRefreshProfile) await onRefreshProfile();
    } catch (err: any) {
      setErrorMessage(sanitizeApiErrorMessage(err.message || 'Cancellation failed'));
    } finally {
      setCancellingNumberLoading(false);
    }
  };

  // Fetch Past Number Orders
  const fetchNumberOrders = async () => {
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data: any = await safeApiFetch('/api/service-number-2/orders', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (data && data.orders && Array.isArray(data.orders)) {
        setNumberOrders(data.orders);
      }
    } catch {
      // ignore
    }
  };

  // =========================================================================
  // PAGE 2: BOOST ACCOUNTS (Screenshot 3 - IMG_2715.png) STATE & LOGIC
  // =========================================================================
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('telegram'); // matches active Telegram in Screenshot 3!
  const [selectedBoostPlatformForOrder, setSelectedBoostPlatformForOrder] = useState<string | null>(null);
  const [smmServices, setSmmServices] = useState<SocialBoostService[]>([]);
  const [smmLoading, setSmmLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSmmServiceId, setSelectedSmmServiceId] = useState<string>('');
  const [targetLink, setTargetLink] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1000);
  const [smmOrderingLoading, setSmmOrderingLoading] = useState<boolean>(false);
  const [isBoostHistoryOpen, setIsBoostHistoryOpen] = useState<boolean>(false);
  const [boostOrders, setBoostOrders] = useState<SocialBoostOrder[]>([]);

  // Load SMM Services from Provider 2 API
  const fetchSmmServices = useCallback(async () => {
    setSmmLoading(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data: any = await safeApiFetch('/api/social-boost-2/services', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (data && data.services && Array.isArray(data.services) && data.services.length > 0) {
        const mapped = data.services.map((s: any) => ({
          id: String(s.service || s.id || Math.random()),
          platform: s.platform || 'Other',
          category: s.category || `${s.platform || 'Social'} Growth`,
          name: s.name || `Service #${s.service || s.id}`,
          min: Number(s.min || 100),
          max: Number(s.max || 50000),
          rate: Number(s.rate || 1500),
          pricePerThousandNgn: Number(s.pricePerThousandNgn || s.rate || 1500),
          description: s.description || ''
        }));
        setSmmServices(mapped);
      } else {
        // High quality fallback services for all 12 platforms
        setSmmServices([
          { id: '101', platform: 'Telegram', category: 'Telegram Members', name: 'Telegram Channel/Group Members [Non-Drop - High Quality]', min: 100, max: 50000, pricePerThousandNgn: 1450, rate: 1450 },
          { id: '102', platform: 'Telegram', category: 'Telegram Post Views', name: 'Telegram Post Views [Instant Fast - Lifetime Guarantee]', min: 500, max: 100000, pricePerThousandNgn: 450, rate: 450 },
          { id: '103', platform: 'Instagram', category: 'Instagram Followers', name: 'Instagram Real Followers [Instant Start - 30 Days Refill]', min: 100, max: 20000, pricePerThousandNgn: 1950, rate: 1950 },
          { id: '104', platform: 'Instagram', category: 'Instagram Likes', name: 'Instagram HQ Likes [Fast Delivery]', min: 100, max: 50000, pricePerThousandNgn: 750, rate: 750 },
          { id: '105', platform: 'Facebook', category: 'Facebook Page Likes', name: 'Facebook Page Likes + Followers [Real Global]', min: 100, max: 10000, pricePerThousandNgn: 2200, rate: 2200 },
          { id: '106', platform: 'TikTok', category: 'TikTok Followers', name: 'TikTok Active Followers [Organic Quality]', min: 100, max: 50000, pricePerThousandNgn: 2400, rate: 2400 },
          { id: '107', platform: 'TikTok', category: 'TikTok Likes & Views', name: 'TikTok FYP Likes [Instant Fast]', min: 200, max: 100000, pricePerThousandNgn: 650, rate: 650 },
          { id: '108', platform: 'YouTube', category: 'YouTube Subscribers', name: 'YouTube Channel Subscribers [Monetizable]', min: 50, max: 5000, pricePerThousandNgn: 6800, rate: 6800 },
          { id: '109', platform: 'Twitter', category: 'Twitter Followers', name: 'Twitter / X High Quality Followers', min: 100, max: 10000, pricePerThousandNgn: 3200, rate: 3200 },
          { id: '110', platform: 'Discord', category: 'Discord Members', name: 'Discord Server Members [Online Active]', min: 100, max: 10000, pricePerThousandNgn: 3500, rate: 3500 },
          { id: '111', platform: 'LinkedIn', category: 'LinkedIn Connections', name: 'LinkedIn Connections & Followers', min: 50, max: 5000, pricePerThousandNgn: 5400, rate: 5400 },
          { id: '112', platform: 'Spotify', category: 'Spotify Plays', name: 'Spotify Track Plays [Royalty Eligible]', min: 500, max: 50000, pricePerThousandNgn: 950, rate: 950 },
          { id: '113', platform: 'Snapchat', category: 'Snapchat Followers', name: 'Snapchat Public Profile Followers', min: 100, max: 10000, pricePerThousandNgn: 3800, rate: 3800 },
          { id: '114', platform: 'Website', category: 'Website Traffic', name: 'Global Website Visitors [Organic Direct]', min: 1000, max: 500000, pricePerThousandNgn: 850, rate: 850 },
          { id: '115', platform: 'Other', category: 'Special Growth', name: 'Multi-Network Social Growth & Engagement Boost', min: 100, max: 20000, pricePerThousandNgn: 2100, rate: 2100 },
        ]);
      }
    } catch {
      // Safe fallback
    } finally {
      setSmmLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSmmServices();
  }, [fetchSmmServices]);

  // Filter SMM services for the selected platform
  const currentPlatformServices = useMemo(() => {
    return smmServices.filter(s => {
      const p = (s.platform || '').toLowerCase();
      const target = selectedPlatformId.toLowerCase();
      if (target === 'twitter') return p.includes('twitter') || p.includes('x');
      return p.includes(target);
    });
  }, [smmServices, selectedPlatformId]);

  // Categories for current platform
  const currentCategories = useMemo(() => {
    const cats = Array.from(new Set(currentPlatformServices.map(s => s.category || 'General Growth')));
    return cats.length > 0 ? cats : ['General Engagement'];
  }, [currentPlatformServices]);

  // Selected SMM service
  useEffect(() => {
    if (currentCategories.length > 0 && !currentCategories.includes(selectedCategory)) {
      setSelectedCategory(currentCategories[0]);
    }
  }, [currentCategories, selectedCategory]);

  const filteredCategoryServices = useMemo(() => {
    const filtered = currentPlatformServices.filter(s => (s.category || 'General Growth') === selectedCategory);
    return filtered.length > 0 ? filtered : currentPlatformServices;
  }, [currentPlatformServices, selectedCategory]);

  useEffect(() => {
    if (filteredCategoryServices.length > 0) {
      const exists = filteredCategoryServices.some(s => s.id === selectedSmmServiceId);
      if (!exists) {
        setSelectedSmmServiceId(filteredCategoryServices[0].id);
        setQuantity(Math.max(filteredCategoryServices[0].min || 100, 1000));
      }
    }
  }, [filteredCategoryServices, selectedSmmServiceId]);

  const activeSmmService = useMemo(() => {
    return smmServices.find(s => s.id === selectedSmmServiceId) || filteredCategoryServices[0] || null;
  }, [smmServices, selectedSmmServiceId, filteredCategoryServices]);

  // Calculated SMM price in ₦
  const smmTotalNgn = useMemo(() => {
    if (!activeSmmService) return 0;
    const ratePerK = activeSmmService.pricePerThousandNgn || activeSmmService.rate || 1500;
    return Math.ceil((quantity / 1000) * ratePerK);
  }, [activeSmmService, quantity]);

  // Place SMM Order
  const handlePlaceSmmOrder = async () => {
    if (!activeSmmService) {
      setErrorMessage('Please choose a valid boost service.');
      return;
    }
    if (!targetLink.trim()) {
      setErrorMessage('Please enter the target profile or post link.');
      return;
    }
    if (quantity < (activeSmmService.min || 10)) {
      setErrorMessage(`Minimum quantity is ${(activeSmmService.min || 10).toLocaleString()}`);
      return;
    }
    if (quantity > (activeSmmService.max || 100000)) {
      setErrorMessage(`Maximum quantity is ${(activeSmmService.max || 100000).toLocaleString()}`);
      return;
    }
    if (walletBalance < smmTotalNgn) {
      setErrorMessage(`Insufficient balance (₦${walletBalance.toLocaleString()}). You need ₦${smmTotalNgn.toLocaleString()} for this order.`);
      return;
    }

    setSmmOrderingLoading(true);
    setErrorMessage('');
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data: any = await safeApiFetch('/api/social-boost-2/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          userEmail: auth.currentUser?.email || userProfile?.email || '',
          serviceId: activeSmmService.id,
          service: activeSmmService.service || activeSmmService.id,
          link: targetLink.trim(),
          target: targetLink.trim(),
          targetUrl: targetLink.trim(),
          quantity,
          amountNgn: smmTotalNgn,
          totalCost: smmTotalNgn,
          action: 'order'
        })
      });
      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to submit boost order');
      }
      setInfoMessage(`Boost order placed successfully! Order ID: ${data.orderId || data.order?.id || data.order || 'Confirmed'}`);
      setTargetLink('');
      if (onRefreshProfile) await onRefreshProfile();
      fetchBoostOrders();
    } catch (err: any) {
      setErrorMessage(sanitizeApiErrorMessage(err.message || 'Error submitting order'));
    } finally {
      setSmmOrderingLoading(false);
    }
  };

  // Load SMM Orders History
  const fetchBoostOrders = async () => {
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data: any = await safeApiFetch('/api/social-boost-2/orders', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (data && data.orders && Array.isArray(data.orders)) {
        setBoostOrders(data.orders);
      }
    } catch {
      // ignore
    }
  };

  // Resolve helper objects for Buy Numbers
  const selectedCountryObj = useMemo(() => {
    if (activeTab === 'usa') {
      const usa = countries.find(c => c.id === '187' || c.code === 'US' || (c.name && c.name.toLowerCase().includes('united states')));
      if (usa) return usa;
      return { id: '187', name: 'United States', code: 'US', flag: '🇺🇸' };
    }
    if (!selectedCountry) return null;
    const found = countries.find(c => c.id === selectedCountry);
    if (found) return found;
    return null;
  }, [countries, selectedCountry, activeTab]);
  const selectedServiceObj = services.find(s => s.id === selectedService);

  // Filtered lists for modals
  const filteredCountries = useMemo(() => {
    if (!countrySearchQuery.trim()) return countries;
    const q = countrySearchQuery.toLowerCase();
    return countries.filter(c => c.name.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q)));
  }, [countries, countrySearchQuery]);

  const filteredServices = useMemo(() => {
    if (!serviceSearchQuery.trim()) return services;
    const q = serviceSearchQuery.toLowerCase();
    return services.filter(s => s.name.toLowerCase().includes(q) || (s.code && s.code.toLowerCase().includes(q)));
  }, [services, serviceSearchQuery]);

  return (
    <div className="w-full max-w-xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      
      {/* Toast Alert Notifications */}
      {errorMessage && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-3.5 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-500 hover:text-rose-800 font-bold text-base cursor-pointer">×</button>
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-3.5 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{infoMessage}</span>
          </div>
          <button onClick={() => setInfoMessage('')} className="text-emerald-600 hover:text-emerald-900 font-bold text-base cursor-pointer">×</button>
        </div>
      )}

      {/* Top Global Server Tool Mode Switcher - Only shown in multi-tool mode */}
      {!hideSwitcherTabs && initialPage === 'front' && (
        <div className="mb-5 bg-white border border-[#E9E2FA] p-1.5 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-1 sm:space-x-1.5 flex-1">
            <button
              type="button"
              id="server-tool-tab-front"
              onClick={() => setCurrentPage('front')}
              className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                currentPage === 'front'
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'text-[#716B82] hover:text-[#171329] hover:bg-[#F8F7FF]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Server Tool</span>
            </button>

            <button
              type="button"
              id="server-tool-tab-numbers"
              onClick={() => setCurrentPage('buy-numbers')}
              className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                currentPage === 'buy-numbers'
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'text-[#716B82] hover:text-[#171329] hover:bg-[#F8F7FF]'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Number Service</span>
            </button>

            <button
              type="button"
              id="server-tool-tab-boost"
              onClick={() => setCurrentPage('boost-accounts')}
              className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                currentPage === 'boost-accounts'
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'text-[#716B82] hover:text-[#171329] hover:bg-[#F8F7FF]'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Boosting Service</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleBackToMarket}
            className="px-2.5 py-1.5 text-[11px] font-bold text-[#7C3AED] hover:text-[#5B21B6] hover:bg-[#EDE9FE] rounded-xl transition cursor-pointer flex items-center space-x-1 ml-1 shrink-0"
            title="Exit Server Tool to Marketplace"
          >
            <ArrowLeft className="w-3 h-3" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SERVER 2 FRONT PAGE                                                     */}
      {/* ========================================================================= */}
      {currentPage === 'front' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-white border border-[#E9E2FA] px-4 py-3 rounded-2xl shadow-sm">
            <button
              onClick={handleBackToMarket}
              className="p-2 bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#171329] rounded-xl border border-[#E9E2FA] transition cursor-pointer flex items-center justify-center"
              title="Back to Marketplace"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-[#7C3AED] rounded-full shrink-0 shadow-sm" />
              <h1 className="text-base font-bold tracking-wide text-[#171329]">
                Server 2 Portal
              </h1>
              <span className="bg-[#EDE9FE] text-[#7C3AED] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-[#E9E2FA]">
                V2
              </span>
            </div>

            <button
              onClick={onOpenWallet}
              className="px-3.5 py-1.5 bg-[#7C3AED] hover:bg-[#5B21B6] text-white text-xs font-bold rounded-full shadow-sm transition cursor-pointer flex items-center space-x-1"
            >
              <span>+ Fund</span>
            </button>
          </div>

          {/* Balance Widget */}
          <div className="bg-white border border-[#E9E2FA] p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#716B82] block mb-0.5">
                AVAILABLE BALANCE
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-[#171329] font-mono">
                ₦{walletBalance.toLocaleString()}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-[#047857] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 inline-block">
                Server 2 Online
              </span>
            </div>
          </div>

          {/* THE TWO ACTION CARDS WITH CLEAN WHITE + PURPLE AESTHETIC */}
          <div className="space-y-4 pt-1 max-w-md sm:max-w-lg mx-auto">
            
            {/* Card 1: BUY NUMBERS */}
            <button
              type="button"
              onClick={() => setCurrentPage('buy-numbers')}
              className="w-full bg-white hover:bg-[#F8F7FF] border border-[#E9E2FA] hover:border-[#7C3AED]/50 rounded-3xl py-8 sm:py-10 px-6 sm:px-8 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              {/* Squircle icon container */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#EDE9FE] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Phone className="w-9 h-9 sm:w-11 sm:h-11 text-[#7C3AED]" />
              </div>

              {/* Clean Title */}
              <h2 className="text-xl sm:text-2xl font-bold text-[#171329] mt-5 sm:mt-6 tracking-tight group-hover:text-[#7C3AED] transition-colors">
                Buy Numbers
              </h2>
              <p className="text-xs text-[#716B82] mt-1">
                Live carrier SMS verification across USA & 195+ countries
              </p>
            </button>

            {/* Card 2: BOOST ACCOUNTS */}
            <button
              type="button"
              onClick={() => setCurrentPage('boost-accounts')}
              className="w-full bg-white hover:bg-[#F8F7FF] border border-[#E9E2FA] hover:border-[#7C3AED]/50 rounded-3xl py-8 sm:py-10 px-6 sm:px-8 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              {/* Squircle icon container */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#EDE9FE] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Rocket className="w-9 h-9 sm:w-11 sm:h-11 text-[#7C3AED]" />
              </div>

              {/* Clean Title */}
              <h2 className="text-xl sm:text-2xl font-bold text-[#171329] mt-5 sm:mt-6 tracking-tight group-hover:text-[#7C3AED] transition-colors">
                Boost Accounts
              </h2>
              <p className="text-xs text-[#716B82] mt-1">
                Instant followers, likes, views & organic growth tools
              </p>
            </button>

          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* 2. INSIDE PAGE 1: BUY NUMBERS                                             */}
      {/* ========================================================================= */}
      {currentPage === 'buy-numbers' && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Top Header: Back Button + Avatar + Username + Fund Wallet */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-3">
              {/* Back to Marketplace Button */}
              <button
                type="button"
                onClick={() => {
                  if (initialPage === 'buy-numbers' || hideSwitcherTabs) {
                    handleBackToMarket();
                  } else {
                    setCurrentPage('front');
                  }
                }}
                className="w-10 h-10 rounded-2xl bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#171329] border border-[#E9E2FA] flex items-center justify-center shadow-sm cursor-pointer transition active:scale-95 shrink-0"
                title={initialPage === 'buy-numbers' || hideSwitcherTabs ? "Back to Marketplace" : "Back to Server Tool"}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Circular Initial Avatar with back action */}
              <button
                type="button"
                onClick={() => {
                  if (initialPage === 'buy-numbers' || hideSwitcherTabs) {
                    handleBackToMarket();
                  } else {
                    setCurrentPage('front');
                  }
                }}
                className="relative w-11 h-11 rounded-full bg-[#EDE9FE] border border-[#E9E2FA] text-[#7C3AED] font-bold text-base flex items-center justify-center shadow-sm cursor-pointer hover:scale-105 transition shrink-0"
                title={initialPage === 'buy-numbers' || hideSwitcherTabs ? "Back to Marketplace" : "Back to Server Tool"}
              >
                <span>{userProfile?.username ? userProfile.username.charAt(0).toUpperCase() : 'M'}</span>
              </button>

              <div>
                <span className="text-sm font-bold text-[#171329] block leading-tight">
                  {userProfile?.username || 'muzente001'}
                </span>
                <span className="text-[10px] text-[#716B82] font-medium">
                  {initialPage === 'buy-numbers' ? 'Service Number 2 (Provider 2)' : 'Server 2 Verified'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenWallet}
              className="px-4 py-2 bg-[#7C3AED] hover:bg-[#5B21B6] text-white text-xs font-bold rounded-full shadow-sm transition cursor-pointer flex items-center space-x-1"
            >
              <span>+ Fund Wallet</span>
            </button>
          </div>

          {/* Available Balance Display */}
          <div className="pt-2 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#716B82] block mb-1">
              AVAILABLE BALANCE
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl sm:text-4xl font-bold text-[#171329] font-mono tracking-tight">
                ₦{walletBalance.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Country Type Segmented Control */}
          <div className="bg-white border border-[#E9E2FA] p-1.5 rounded-2xl flex items-center shadow-sm">
            <button
              type="button"
              onClick={() => {
                setActiveTab('usa');
                setSelectedServer('usa1');
                const usa = countries.find(c => c.id === '187' || c.code === 'US' || (c.name && c.name.toLowerCase().includes('united states')));
                setSelectedCountry(usa ? usa.id : '187');
                setSelectedService('');
                setIsServiceInStock(false);
                setStockMessage('');
                setCalculatedPrice(0);
                setPriceOptions([]);
              }}
              className={`flex-1 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1.5 ${
                activeTab === 'usa'
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'text-[#716B82] hover:text-[#171329]'
              }`}
            >
              <span>🇺🇸 USA Numbers</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                setSelectedServer('all1');
                setSelectedService('');
                setIsServiceInStock(false);
                setStockMessage('');
                setCalculatedPrice(0);
                setPriceOptions([]);
              }}
              className={`flex-1 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1.5 ${
                activeTab === 'all'
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'text-[#716B82] hover:text-[#171329]'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>All Countries</span>
            </button>
          </div>

          {/* Server Switch Sub-Pills (Extra Log Tools Route Selection: USA 1/2 or All Country 1/2) */}
          <div className="grid grid-cols-2 gap-2 pt-1 pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedServer(activeTab === 'all' ? 'all1' : 'usa1');
                setSelectedService('');
                setIsServiceInStock(false);
                setStockMessage('');
                setCalculatedPrice(0);
                setPriceOptions([]);
              }}
              className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                selectedServer === 'usa1' || selectedServer === 'all1' || selectedServer === 'server_1'
                  ? 'bg-[#EDE9FE] text-[#7C3AED] border border-[#7C3AED]/40 font-bold'
                  : 'bg-white text-[#716B82] hover:text-[#171329] border border-[#E9E2FA]'
              }`}
              title={activeTab === 'usa' ? 'USA 1' : 'All Country 1'}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{activeTab === 'usa' ? 'USA 1' : 'All Country 1'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedServer(activeTab === 'all' ? 'all2' : 'usa2');
                setSelectedService('');
                setIsServiceInStock(false);
                setStockMessage('');
                setCalculatedPrice(0);
                setPriceOptions([]);
              }}
              className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                selectedServer === 'usa2' || selectedServer === 'all2' || selectedServer === 'server_2'
                  ? 'bg-[#EDE9FE] text-[#7C3AED] border border-[#7C3AED]/40 font-bold'
                  : 'bg-white text-[#716B82] hover:text-[#171329] border border-[#E9E2FA]'
              }`}
              title={activeTab === 'usa' ? 'USA 2' : 'All Country 2'}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{activeTab === 'usa' ? 'USA 2' : 'All Country 2'}</span>
            </button>
          </div>

          {/* MAIN CARD WITH CLEAN HEADER */}
          <div className="bg-white border border-[#E9E2FA] rounded-3xl overflow-hidden shadow-sm">
            
            {/* Top header banner */}
            <div className="bg-[#7C3AED] text-white px-5 py-3 flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-white rounded-full shrink-0 shadow-sm" />
                <span>
                  {activeTab === 'usa' 
                    ? `🇺🇸 USA Numbers (${selectedServer === 'usa2' ? 'USA 2' : 'USA 1'}) — Live Carrier Pool`
                    : `🌐 All Countries (${selectedServer === 'all2' ? 'All Country 2' : 'All Country 1'}) — 195+ Countries`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  fetchNumberOrders();
                  setIsNumberOrdersModalOpen(true);
                }}
                className="text-[11px] font-bold text-white hover:underline cursor-pointer"
              >
                Orders
              </button>
            </div>

            {/* Card Body */}
            <div className="p-5 sm:p-6 space-y-4">
              
              {/* Field 1: COUNTRY */}
              <div
                onClick={() => {
                  if (activeTab === 'all' && !countriesLoading) {
                    setIsCountryModalOpen(true);
                  }
                }}
                className={`bg-[#F8F7FF] border border-[#E9E2FA] ${
                  activeTab === 'all' ? 'hover:border-[#7C3AED]/40 cursor-pointer' : 'cursor-default'
                } p-3.5 rounded-2xl flex items-center justify-between transition group`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#716B82] uppercase tracking-widest block mb-0.5">
                      COUNTRY {activeTab === 'usa' ? '(FIXED USA)' : ''}
                    </span>
                    <span className="text-sm font-bold text-[#171329] flex items-center space-x-2">
                      {countriesLoading ? (
                        <span className="text-[#7C3AED] text-xs flex items-center space-x-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />
                          <span>Loading countries...</span>
                        </span>
                      ) : selectedCountryObj ? (
                        <span>{getCountryFlagEmoji(selectedCountryObj.code || selectedCountryObj.name)} {selectedCountryObj.name}</span>
                      ) : (
                        <span className="text-[#716B82] text-xs">Select Country</span>
                      )}
                    </span>
                  </div>
                </div>
                {activeTab === 'all' && (
                  <ChevronRight className="w-5 h-5 text-[#716B82] group-hover:text-[#171329] transition" />
                )}
              </div>

              {/* Field 2: SERVICE */}
              <div
                onClick={() => {
                  if (!servicesLoading && services.length > 0) {
                    setIsServiceModalOpen(true);
                  }
                }}
                className={`bg-[#F8F7FF] border border-[#E9E2FA] ${
                  servicesLoading ? 'opacity-70 cursor-wait' : 'hover:border-[#7C3AED]/40 cursor-pointer'
                } p-3.5 rounded-2xl flex items-center justify-between transition group`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#716B82] uppercase tracking-widest block mb-0.5">
                      SERVICE
                    </span>
                    <span className="text-sm font-bold text-[#171329] flex items-center space-x-2">
                      {servicesLoading ? (
                        <span className="text-[#7C3AED] text-xs flex items-center space-x-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />
                          <span>Loading services...</span>
                        </span>
                      ) : selectedServiceObj ? (
                        <span>{selectedServiceObj.name}</span>
                      ) : (
                        <span className="text-[#716B82] text-xs">Select Service</span>
                      )}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#716B82] group-hover:text-[#171329] transition" />
              </div>

              {/* Quality Tier (if multiple options available) */}
              {priceOptions.length > 1 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-[#716B82] uppercase tracking-widest block pl-1">
                    CARRIER ROUTE QUALITY
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {priceOptions.map((opt) => {
                      const isSel = selectedOptionId === opt.optionId;
                      return (
                        <button
                          key={opt.optionId}
                          type="button"
                          onClick={() => {
                            setSelectedOptionId(opt.optionId);
                            setCalculatedPrice(opt.customerPrice);
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                            isSel
                              ? 'bg-[#EDE9FE] border-[#7C3AED] text-[#7C3AED] font-bold'
                              : 'bg-[#F8F7FF] border-[#E9E2FA] text-[#716B82] hover:bg-white'
                          }`}
                        >
                          <span className="font-bold block truncate">{opt.carrierTier.split(' (')[0]}</span>
                          <span className="text-[10px] font-mono font-bold text-[#7C3AED]">₦{opt.customerPrice.toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price & Delivery Notice */}
              <div className="pt-2 border-t border-[#E9E2FA] space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#716B82] font-semibold block">Live Carrier Rate:</span>
                    {!selectedCountry && !selectedService ? (
                      <span className="text-[11px] text-[#716B82]">Select country & service to check rate</span>
                    ) : !selectedCountry ? (
                      <span className="text-[11px] text-[#716B82]">Select a country to check rate</span>
                    ) : !selectedService ? (
                      <span className="text-[11px] text-[#716B82]">Select a service to check rate</span>
                    ) : pricesLoading ? (
                      <span className="text-[11px] text-[#7C3AED] animate-pulse flex items-center space-x-1">
                        <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                        <span>Checking carrier rate...</span>
                      </span>
                    ) : stockMessage ? (
                      <span className={`text-[11px] font-semibold ${isServiceInStock ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {stockMessage}
                      </span>
                    ) : isServiceInStock ? (
                      <span className="text-[11px] text-emerald-700 font-semibold">Ready for instant allocation</span>
                    ) : null}
                  </div>
                  <span className="text-2xl font-bold font-mono text-[#171329]">
                    {!selectedCountry || !selectedService ? (
                      <span className="text-sm font-bold text-[#716B82]">—</span>
                    ) : pricesLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#7C3AED] inline" />
                    ) : isServiceInStock && calculatedPrice > 0 ? (
                      `₦${calculatedPrice.toLocaleString()}`
                    ) : (
                      <span className="text-sm font-bold text-amber-600">Unavailable</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Button: GET NUMBER */}
              <button
                type="button"
                onClick={handleBuyNumber}
                disabled={
                  buyingNumberLoading ||
                  !selectedCountry ||
                  !selectedService ||
                  pricesLoading ||
                  !isServiceInStock
                }
                className="w-full py-4 bg-[#7C3AED] hover:bg-[#5B21B6] text-white font-bold text-sm sm:text-base rounded-2xl flex items-center justify-center space-x-2 shadow-sm transition duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buyingNumberLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Allocating Carrier Number...</span>
                  </>
                ) : !selectedCountry && !selectedService ? (
                  <>
                    <AlertCircle className="w-5 h-5 text-white/80" />
                    <span>Please select a country and service</span>
                  </>
                ) : !selectedCountry ? (
                  <>
                    <Globe className="w-5 h-5 text-white/80" />
                    <span>Please select a country</span>
                  </>
                ) : !selectedService ? (
                  <>
                    <Smartphone className="w-5 h-5 text-white/80" />
                    <span>Please select a service</span>
                  </>
                ) : pricesLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Checking Live Carrier Rate...</span>
                  </>
                ) : isServiceInStock && calculatedPrice > 0 ? (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>Get Number • ₦{calculatedPrice.toLocaleString()}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-200" />
                    <span>{stockMessage || 'Service Unavailable on this Route'}</span>
                  </>
                )}
              </button>

            </div>

          </div>

          {/* ACTIVE ORDER / LIVE SMS SCREEN IF ACTIVE */}
          {activeNumberOrder && (
            <div className="bg-white border border-[#E9E2FA] rounded-3xl p-5 shadow-sm space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#E9E2FA] pb-3">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5 text-[#7C3AED]" />
                  <span className="text-sm font-bold text-[#171329]">Your Assigned Number</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                  Waiting for SMS
                </span>
              </div>

              {/* Phone Number Display */}
              <div className="bg-[#F8F7FF] border border-[#E9E2FA] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#716B82] block">Assigned Number</span>
                  <span className="text-xl sm:text-2xl font-mono font-bold text-[#171329]">
                    {activeNumberOrder.phoneNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(activeNumberOrder.phoneNumber || '', 'number')}
                  className="px-3.5 py-2 bg-[#7C3AED] hover:bg-[#5B21B6] text-white text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer shadow-sm"
                >
                  {copiedText === 'number' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedText === 'number' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* SMS Polling & Code Display */}
              {pollingStatus === 'WAITING' ? (
                <div className="p-4 bg-[#F8F7FF] rounded-2xl border border-[#E9E2FA] text-center space-y-2">
                  <div className="flex items-center justify-center space-x-2 text-[#716B82] text-xs font-semibold">
                    <Clock className="w-4 h-4 animate-spin text-[#7C3AED]" />
                    <span>Waiting for SMS code... ({elapsedSeconds}s)</span>
                  </div>
                  <div className="w-full bg-[#EDE9FE] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#7C3AED] h-full w-2/3 animate-pulse" />
                  </div>
                </div>
              ) : pollingStatus === 'RECEIVED' ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                  <span className="text-xs font-bold text-emerald-800 block">Verification Code Received:</span>
                  <div className="flex items-center justify-center space-x-3">
                    <span className="text-3xl font-bold font-mono text-emerald-700 tracking-widest">
                      {verificationCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(verificationCode, 'code')}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer shadow-sm"
                    >
                      {copiedText === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedText === 'code' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  {smsContent && (
                    <p className="text-[11px] font-mono text-emerald-900 bg-white p-2.5 rounded-xl text-left border border-emerald-200">
                      {smsContent}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Cancel Button */}
              {pollingStatus === 'WAITING' && (
                <button
                  type="button"
                  onClick={handleCancelNumber}
                  disabled={cancellingNumberLoading}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {cancellingNumberLoading ? 'Processing 100% Refund...' : 'Cancel & Instant Full Refund'}
                </button>
              )}
            </div>
          )}

        </div>
      )}


      {/* ========================================================================= */}
      {/* 3. INSIDE PAGE 2: BOOST ACCOUNTS                                           */}
      {/* ========================================================================= */}
      {currentPage === 'boost-accounts' && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Top Bar: Back Button + Boost History Pill */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                if (selectedBoostPlatformForOrder) {
                  setSelectedBoostPlatformForOrder(null);
                } else if (initialPage === 'boost-accounts' || hideSwitcherTabs) {
                  handleBackToMarket();
                } else {
                  setCurrentPage('front');
                }
              }}
              className="w-10 h-10 rounded-2xl bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#171329] border border-[#E9E2FA] flex items-center justify-center shadow-sm cursor-pointer transition active:scale-95"
              title={
                selectedBoostPlatformForOrder
                  ? "Back to All Platforms"
                  : initialPage === 'boost-accounts' || hideSwitcherTabs
                  ? "Back to Marketplace"
                  : "Back to Server Tool Home"
              }
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Boost History Pill */}
            <button
              type="button"
              onClick={() => {
                fetchBoostOrders();
                setIsBoostHistoryOpen(true);
              }}
              className="bg-white hover:bg-[#F8F7FF] border border-[#E9E2FA] text-[#171329] px-4 py-2 rounded-full flex items-center space-x-2 font-bold text-xs shadow-sm transition cursor-pointer"
            >
              <RotateCw className="w-4 h-4 text-[#7C3AED]" />
              <span>Boost History</span>
            </button>
          </div>

          {/* Available Balance Header */}
          <div className="bg-white border border-[#E9E2FA] p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#716B82] block">
                AVAILABLE BALANCE
              </span>
              <span className="text-xl sm:text-2xl font-bold text-[#171329] font-mono">
                ₦{walletBalance.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenWallet}
              className="px-3.5 py-1.5 bg-[#7C3AED] hover:bg-[#5B21B6] text-white text-xs font-bold rounded-full shadow-sm transition cursor-pointer"
            >
              + Fund
            </button>
          </div>

          {/* VIEW A: LIST OF ALL SOCIAL MEDIA PLATFORMS */}
          {!selectedBoostPlatformForOrder ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-1 animate-in fade-in">
              {SMM_PLATFORMS.map((platform) => {
                const IconComp = platform.icon;
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlatformId(platform.id);
                      setSelectedBoostPlatformForOrder(platform.id);
                    }}
                    className="rounded-2xl p-5 flex flex-col items-center justify-center min-h-[110px] cursor-pointer transition-all duration-200 bg-white border border-[#E9E2FA] hover:border-[#7C3AED]/50 hover:bg-[#F8F7FF] shadow-sm active:scale-[0.98]"
                  >
                    <IconComp className={`w-7 h-7 sm:w-8 sm:h-8 mb-2.5 ${platform.iconColor}`} />
                    <span className="text-sm sm:text-base font-bold text-[#171329] tracking-wide">
                      {platform.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* VIEW B: ORDER FORM FOR SELECTED PLATFORM */
            <div className="bg-white border border-[#E9E2FA] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 animate-in fade-in">
              
              <div className="flex items-center justify-between border-b border-[#E9E2FA] pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 bg-[#7C3AED] rounded-full shrink-0 shadow-sm" />
                  <h3 className="text-sm sm:text-base font-bold text-[#171329]">
                    Order {SMM_PLATFORMS.find(p => p.id === selectedPlatformId)?.name} Boost (Server 2)
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-[#7C3AED] bg-[#EDE9FE] px-2 py-0.5 rounded-full border border-[#E9E2FA] uppercase">
                  Instant Auto
                </span>
              </div>

              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#716B82] block pl-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl px-3.5 py-3 text-xs sm:text-sm text-[#171329] focus:outline-none focus:border-[#7C3AED] cursor-pointer"
                >
                  {currentCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Service Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#716B82] block pl-1">
                  Service Package
                </label>
                <select
                  value={selectedSmmServiceId}
                  onChange={(e) => setSelectedSmmServiceId(e.target.value)}
                  className="w-full bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl px-3.5 py-3 text-xs sm:text-sm text-[#171329] focus:outline-none focus:border-[#7C3AED] cursor-pointer"
                >
                  {filteredCategoryServices.map(srv => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} (₦{(srv.pricePerThousandNgn || srv.rate || 1500).toLocaleString()}/1k)
                    </option>
                  ))}
                </select>
              </div>

              {/* Link Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#716B82] block pl-1">
                  Target Link / Profile URL
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-[#716B82] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="https://..."
                    value={targetLink}
                    onChange={(e) => setTargetLink(e.target.value)}
                    className="w-full bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl pl-10 pr-3.5 py-3 text-xs sm:text-sm text-[#171329] placeholder-[#716B82]/50 focus:outline-none focus:border-[#7C3AED]"
                  />
                </div>
              </div>

              {/* Quantity Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#716B82]">
                    Quantity
                  </label>
                  {activeSmmService && (
                    <span className="text-[10px] text-[#716B82] font-mono">
                      Min: {(activeSmmService.min || 100).toLocaleString()} | Max: {(activeSmmService.max || 50000).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Hash className="w-4 h-4 text-[#716B82] absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    min={activeSmmService?.min || 100}
                    max={activeSmmService?.max || 50000}
                    step={100}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl pl-10 pr-3.5 py-3 text-xs sm:text-sm font-mono text-[#171329] focus:outline-none focus:border-[#7C3AED]"
                  />
                </div>
              </div>

              {/* Total Charge & Place Order */}
              <div className="pt-2 border-t border-[#E9E2FA] flex items-center justify-between text-xs">
                <span className="text-[#716B82] font-semibold">Total Cost:</span>
                <span className="text-2xl font-bold font-mono text-[#171329]">
                  ₦{smmTotalNgn.toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                onClick={handlePlaceSmmOrder}
                disabled={smmOrderingLoading || !targetLink.trim()}
                className="w-full py-4 bg-[#7C3AED] hover:bg-[#5B21B6] text-white font-bold text-sm sm:text-base rounded-2xl flex items-center justify-center space-x-2 shadow-sm transition duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {smmOrderingLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing Boost Order...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    <span>Submit Boost Order</span>
                  </>
                )}
              </button>

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: COUNTRY SELECTOR (SEARCHABLE MODAL)                                 */}
      {/* ========================================================================= */}
      {isCountryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E9E2FA] rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#E9E2FA] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171329]">Select Country (Server 2)</h3>
              <button onClick={() => setIsCountryModalOpen(false)} className="text-[#716B82] hover:text-[#171329] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-[#E9E2FA]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#716B82] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={countrySearchQuery}
                  onChange={(e) => setCountrySearchQuery(e.target.value)}
                  className="w-full bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl pl-9 pr-3 py-2 text-xs text-[#171329] placeholder-[#716B82]/50 focus:outline-none focus:border-[#7C3AED]"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {countriesLoading ? (
                <div className="p-8 text-center text-[#716B82] text-xs flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
                  <span>Loading countries...</span>
                </div>
              ) : filteredCountries.length === 0 ? (
                <div className="p-8 text-center text-[#716B82] text-xs">
                  {countries.length === 0 ? 'No countries available on this server.' : 'No countries found matching your search.'}
                </div>
              ) : (
                filteredCountries.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCountry(c.id);
                      setSelectedService('');
                      setIsServiceInStock(false);
                      setStockMessage('');
                      setCalculatedPrice(0);
                      setPriceOptions([]);
                      setIsCountryModalOpen(false);
                      setCountrySearchQuery('');
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition cursor-pointer ${
                      selectedCountry === c.id ? 'bg-[#7C3AED] text-white font-bold' : 'hover:bg-[#F8F7FF] text-[#171329]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getCountryFlagEmoji(c.code || c.name)}</span>
                      <span className="font-bold">{c.name}</span>
                    </div>
                    {selectedCountry === c.id && <Check className="w-4 h-4" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SERVICE SELECTOR (SEARCHABLE MODAL)                                 */}
      {/* ========================================================================= */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E9E2FA] rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#E9E2FA] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171329]">Select Service (Server 2)</h3>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-[#716B82] hover:text-[#171329] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-[#E9E2FA]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#716B82] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search apps (WhatsApp, Telegram, etc.)..."
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="w-full bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl pl-9 pr-3 py-2 text-xs text-[#171329] placeholder-[#716B82]/50 focus:outline-none focus:border-[#7C3AED]"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {servicesLoading ? (
                <div className="p-8 text-center text-[#716B82] text-xs flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
                  <span>Loading services...</span>
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="p-8 text-center text-[#716B82] text-xs">
                  {services.length === 0 ? 'No services available for this country.' : 'No services found matching your search.'}
                </div>
              ) : (
                filteredServices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedService(s.id);
                      setIsServiceModalOpen(false);
                      setServiceSearchQuery('');
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition cursor-pointer ${
                      selectedService === s.id ? 'bg-[#7C3AED] text-white font-bold' : 'hover:bg-[#F8F7FF] text-[#171329]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Smartphone className="w-4 h-4 text-[#7C3AED]" />
                      <span className="font-bold">{s.name}</span>
                    </div>
                    {selectedService === s.id && <Check className="w-4 h-4" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NUMBER ORDERS HISTORY                                              */}
      {/* ========================================================================= */}
      {isNumberOrdersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E9E2FA] rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#E9E2FA] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171329]">Server 2 Number Orders</h3>
              <button onClick={() => setIsNumberOrdersModalOpen(false)} className="text-[#716B82] hover:text-[#171329] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {numberOrders.length === 0 ? (
                <div className="text-center py-10 text-[#716B82] text-xs">
                  No orders recorded for Server 2 yet.
                </div>
              ) : (
                numberOrders.map((ord) => (
                  <div key={ord.orderId || ord.id} className="p-3.5 rounded-2xl bg-[#F8F7FF] border border-[#E9E2FA] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#171329]">{ord.service || 'Service'}</span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        ord.status === 'SMS_RECEIVED' || ord.code ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {ord.status || 'Active'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#716B82] font-mono">
                      <span>{ord.phoneNumber || ord.orderId}</span>
                      {ord.amount && <span className="font-bold text-[#171329]">₦{ord.amount.toLocaleString()}</span>}
                    </div>
                    {ord.code && (
                      <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-800">Code: {ord.code}</span>
                        <button
                          onClick={() => handleCopy(ord.code || '', `code_${ord.orderId}`)}
                          className="text-[10px] text-emerald-800 hover:text-emerald-900 font-bold px-2.5 py-1 bg-white border border-emerald-200 rounded-lg cursor-pointer"
                        >
                          {copiedText === `code_${ord.orderId}` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BOOST HISTORY                                                      */}
      {/* ========================================================================= */}
      {isBoostHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E9E2FA] rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#E9E2FA] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RotateCw className="w-4 h-4 text-[#7C3AED]" />
                <h3 className="text-base font-bold text-[#171329]">Boost Orders History (Server 2)</h3>
              </div>
              <button onClick={() => setIsBoostHistoryOpen(false)} className="text-[#716B82] hover:text-[#171329] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {boostOrders.length === 0 ? (
                <div className="text-center py-10 text-[#716B82] text-xs">
                  No boost orders placed on Server 2 yet.
                </div>
              ) : (
                boostOrders.map((ord) => (
                  <div key={ord.id || ord.orderId} className="p-3.5 rounded-2xl bg-[#F8F7FF] border border-[#E9E2FA] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#171329] truncate max-w-[200px]">{ord.serviceName || 'Boost Service'}</span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED] border border-[#E9E2FA]">
                        {ord.status || 'Processing'}
                      </span>
                    </div>
                    <div className="text-[#716B82] truncate text-[11px]">
                      {ord.targetUrl || ord.link}
                    </div>
                    <div className="flex items-center justify-between text-[#716B82] font-mono text-[11px]">
                      <span>Qty: {ord.quantity.toLocaleString()}</span>
                      <span className="font-bold text-[#171329]">₦{ord.totalChargeNgn.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
