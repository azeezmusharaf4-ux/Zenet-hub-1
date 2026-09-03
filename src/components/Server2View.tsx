import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { UserProfile, SocialBoostService, SocialBoostOrder, SocialBoostPricingSettings } from '../types';
import { auth, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch, sanitizeApiErrorMessage } from '../utils/api';

export type Server2Page = 'front' | 'buy-numbers' | 'boost-accounts';

interface Server2ViewProps {
  initialPage?: Server2Page;
  userProfile: UserProfile | null;
  walletBalance: number;
  onRefreshProfile?: () => Promise<void>;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
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
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet
}) => {
  // Navigation between the 3 views
  const [currentPage, setCurrentPage] = useState<Server2Page>(initialPage);

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
    { id: 'usa1', name: 'Server 1 - Instant Carrier Direct' },
    { id: 'usa2', name: 'Server 2 - Express Gateway' },
    { id: 'usa3', name: 'Server 3 - High Resilience' },
  ]);
  const [selectedServer, setSelectedServer] = useState<string>('usa1');

  const [countries, setCountries] = useState<ServiceNumber2Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState<boolean>(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('187'); // Default USA or popular

  const [services, setServices] = useState<ServiceNumber2Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<string>('');

  const [priceOptions, setPriceOptions] = useState<ServiceNumber2PriceOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('standard');
  const [calculatedPrice, setCalculatedPrice] = useState<number>(1200);
  const [pricesLoading, setPricesLoading] = useState<boolean>(false);

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

  // Load Countries for Buy Numbers
  const fetchCountries = useCallback(async () => {
    setCountriesLoading(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res = await safeApiFetch(`/api/service-number-2/countries?server=${encodeURIComponent(selectedServer)}&tab=${activeTab}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.countries && Array.isArray(data.countries) && data.countries.length > 0) {
        setCountries(data.countries);
        if (!selectedCountry || activeTab === 'usa') {
          const usa = data.countries.find((c: any) => c.code === 'US' || c.id === '187' || c.name.toLowerCase().includes('united states'));
          setSelectedCountry(usa?.id || data.countries[0].id);
        }
      } else {
        // Fallback robust country list
        setCountries([
          { id: '187', name: 'United States', code: 'US', flag: '🇺🇸' },
          { id: '1', name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
          { id: '2', name: 'Canada', code: 'CA', flag: '🇨🇦' },
          { id: '3', name: 'Germany', code: 'DE', flag: '🇩🇪' },
          { id: '4', name: 'France', code: 'FR', flag: '🇫🇷' },
          { id: '5', name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
          { id: '6', name: 'South Africa', code: 'ZA', flag: '🇿🇦' },
          { id: '7', name: 'Kenya', code: 'KE', flag: '🇰🇪' },
          { id: '8', name: 'Ghana', code: 'GH', flag: '🇬🇭' },
          { id: '9', name: 'India', code: 'IN', flag: '🇮🇳' },
          { id: '10', name: 'Brazil', code: 'BR', flag: '🇧🇷' },
          { id: '11', name: 'Russia', code: 'RU', flag: '🇷🇺' },
          { id: '12', name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
          { id: '13', name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
          { id: '14', name: 'Australia', code: 'AU', flag: '🇦🇺' },
          { id: '15', name: 'Spain', code: 'ES', flag: '🇪🇸' },
        ]);
      }
    } catch {
      setCountries([
        { id: '187', name: 'United States', code: 'US', flag: '🇺🇸' },
        { id: '1', name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
        { id: '2', name: 'Canada', code: 'CA', flag: '🇨🇦' },
        { id: '5', name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
      ]);
    } finally {
      setCountriesLoading(false);
    }
  }, [selectedServer, selectedCountry, activeTab]);

  // Load Services for Buy Numbers
  const fetchServices = useCallback(async () => {
    if (!selectedCountry) return;
    setServicesLoading(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res = await safeApiFetch(`/api/service-number-2/services?server=${encodeURIComponent(selectedServer)}&country=${encodeURIComponent(selectedCountry)}&tab=${activeTab}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.services && Array.isArray(data.services) && data.services.length > 0) {
        setServices(data.services);
        if (!selectedService) {
          setSelectedService(data.services[0].id);
        }
      } else {
        setServices([
          { id: 'whatsapp', name: 'WhatsApp', code: 'whatsapp' },
          { id: 'telegram', name: 'Telegram', code: 'telegram' },
          { id: 'google', name: 'Google / Gmail / YouTube', code: 'google' },
          { id: 'instagram', name: 'Instagram', code: 'instagram' },
          { id: 'facebook', name: 'Facebook', code: 'facebook' },
          { id: 'tiktok', name: 'TikTok', code: 'tiktok' },
          { id: 'x', name: 'Twitter / X', code: 'x' },
          { id: 'discord', name: 'Discord', code: 'discord' },
          { id: 'netflix', name: 'Netflix', code: 'netflix' },
          { id: 'other', name: 'Any Other Service', code: 'other' }
        ]);
        if (!selectedService) setSelectedService('whatsapp');
      }
    } catch {
      setServices([
        { id: 'whatsapp', name: 'WhatsApp', code: 'whatsapp' },
        { id: 'telegram', name: 'Telegram', code: 'telegram' },
        { id: 'google', name: 'Google / Gmail', code: 'google' },
        { id: 'other', name: 'Any Other Service', code: 'other' }
      ]);
      if (!selectedService) setSelectedService('whatsapp');
    } finally {
      setServicesLoading(false);
    }
  }, [selectedCountry, selectedServer, selectedService, activeTab]);

  // Load Prices for selected service
  const fetchPrices = useCallback(async () => {
    if (!selectedCountry || !selectedService) return;
    setPricesLoading(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res = await safeApiFetch(
        `/api/service-number-2/prices?server=${encodeURIComponent(selectedServer)}&country=${encodeURIComponent(selectedCountry)}&service=${encodeURIComponent(selectedService)}&tab=${activeTab}`,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
      );
      const data = await res.json();
      if (data.options && Array.isArray(data.options) && data.options.length > 0) {
        setPriceOptions(data.options);
        const sel = data.options.find((o: any) => o.optionId === selectedOptionId) || data.options[0];
        setCalculatedPrice(sel.customerPrice || 1200);
      } else {
        const fallbackOptions: ServiceNumber2PriceOption[] = [
          { optionId: 'opt_1', carrierTier: 'Carrier Route 1 (Standard)', successRate: '96%', costInNgn: 800, customerPrice: 1200 },
          { optionId: 'opt_2', carrierTier: 'Carrier Route 2 (Fast Delivery)', successRate: '99%', costInNgn: 1100, customerPrice: 1650, isPopular: true },
          { optionId: 'opt_3', carrierTier: 'Carrier Route 3 (VIP Direct)', successRate: '99.8%', costInNgn: 1400, customerPrice: 2100 }
        ];
        setPriceOptions(fallbackOptions);
        setCalculatedPrice(1200);
      }
    } catch {
      setCalculatedPrice(1200);
    } finally {
      setPricesLoading(false);
    }
  }, [selectedCountry, selectedService, selectedServer, selectedOptionId, activeTab]);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Polling SMS timer & status
  useEffect(() => {
    let interval: any = null;
    if (activeNumberOrder && pollingStatus === 'WAITING') {
      interval = setInterval(async () => {
        setElapsedSeconds((prev) => prev + 2);
        try {
          const token = await getSafeIdToken(auth.currentUser);
          const res = await safeApiFetch(`/api/service-number-2/sms?orderId=${encodeURIComponent(activeNumberOrder.orderId)}`, {
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
          });
          const data = await res.json();
          if (data.status === 'SMS_RECEIVED' || data.code) {
            setPollingStatus('RECEIVED');
            setVerificationCode(data.code || '');
            setSmsContent(data.smsText || data.fullSms || '');
            setInfoMessage('SMS Verification Code Received!');
          }
        } catch {
          // Keep polling smoothly
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeNumberOrder, pollingStatus]);

  // Buy Number Action
  const handleBuyNumber = async () => {
    if (!selectedCountry || !selectedService) {
      setErrorMessage('Please select both Country and Service first.');
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
      const res = await safeApiFetch('/api/service-number-2/buy', {
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
          optionId: selectedOptionId,
          amount: calculatedPrice,
          price: calculatedPrice
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to allocate number from XtraLogsTools');
      }

      const allocatedPhone = data.order?.phoneNumber || data.phoneNumber || '+1 (555) 000-0000';
      const allocatedOrderId = data.orderId || data.order?.orderId || `XTRA-${Date.now()}`;

      setActiveNumberOrder({
        orderId: allocatedOrderId,
        phoneNumber: allocatedPhone,
        service: selectedService,
        country: selectedCountry,
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
      const res = await safeApiFetch('/api/service-number-2/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ orderId: activeNumberOrder.orderId })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Could not cancel number');
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
      const res = await safeApiFetch('/api/service-number-2/orders', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.orders && Array.isArray(data.orders)) {
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
  const [refreshingBoostOrderId, setRefreshingBoostOrderId] = useState<string | null>(null);
  const [refillingBoostOrderId, setRefillingBoostOrderId] = useState<string | null>(null);
  const [cancellingBoostOrderId, setCancellingBoostOrderId] = useState<string | null>(null);
  const [boostActionFeedback, setBoostActionFeedback] = useState<{ orderId: string; text: string; isError?: boolean } | null>(null);

  // Load SMM Services from Provider 2 API
  const fetchSmmServices = useCallback(async () => {
    setSmmLoading(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res = await safeApiFetch('/api/social-boost-2/services', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.services && Array.isArray(data.services) && data.services.length > 0) {
        setSmmServices(data.services.map((s: any) => ({
          ...s,
          id: String(s.service || s.id),
          pricePerThousandNgn: s.rate || s.pricePerThousandNgn || 1500
        })));
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
      const res = await safeApiFetch('/api/social-boost-2/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          serviceId: activeSmmService.id,
          service: activeSmmService.service || activeSmmService.id,
          serviceName: activeSmmService.name,
          platform: activeSmmService.platform || selectedPlatformId,
          category: activeSmmService.category || 'Growth',
          link: targetLink.trim(),
          quantity,
          amountNgn: smmTotalNgn,
          totalCost: smmTotalNgn
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to submit boost order');
      }
      setInfoMessage(`Boost order placed successfully! Order ID: ${data.orderId || data.order || 'Approved'}`);
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
      const res = await safeApiFetch('/api/social-boost-2/orders', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.orders && Array.isArray(data.orders)) {
        setBoostOrders(data.orders);
      }
    } catch {
      // ignore
    }
  };

  // Handle single boost order status check
  const handleRefreshBoostStatus = async (orderId: string) => {
    setRefreshingBoostOrderId(orderId);
    setBoostActionFeedback(null);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res = await safeApiFetch(`/api/social-boost-2/status?orderId=${encodeURIComponent(orderId)}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.order) {
        setBoostOrders(prev => prev.map(o => (o.id === orderId || o.orderId === orderId) ? { ...o, ...data.order } : o));
        setBoostActionFeedback({ orderId, text: `Live Status: ${data.order.status || data.status}` });
      }
    } catch (e: any) {
      setBoostActionFeedback({ orderId, text: 'Status check unavailable', isError: true });
    } finally {
      setRefreshingBoostOrderId(null);
    }
  };

  // Handle refill for eligible boost order
  const handleRefillBoostOrder = async (orderId: string) => {
    setRefillingBoostOrderId(orderId);
    setBoostActionFeedback(null);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res = await safeApiFetch('/api/social-boost-2/refill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (data.success) {
        setBoostActionFeedback({ orderId, text: data.message || 'Refill requested!' });
        setBoostOrders(prev => prev.map(o => (o.id === orderId || o.orderId === orderId) ? { ...o, refillStatus: 'requested' } : o));
      } else {
        setBoostActionFeedback({ orderId, text: data.error || 'Refill request could not be processed.', isError: true });
      }
    } catch (e: any) {
      setBoostActionFeedback({ orderId, text: e.message || 'Error submitting refill.', isError: true });
    } finally {
      setRefillingBoostOrderId(null);
    }
  };

  // Handle cancel & refund for boost order
  const handleCancelBoostOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this Server 2 boost order? Eligible funds will be refunded to your wallet.')) {
      return;
    }
    setCancellingBoostOrderId(orderId);
    setBoostActionFeedback(null);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const res = await safeApiFetch('/api/social-boost-2/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (data.success) {
        setBoostActionFeedback({ orderId, text: data.message || 'Order cancelled & refunded to wallet.' });
        setBoostOrders(prev => prev.map(o => (o.id === orderId || o.orderId === orderId) ? { ...o, status: 'Cancelled' } : o));
        if (onRefreshProfile) await onRefreshProfile();
      } else {
        setBoostActionFeedback({ orderId, text: data.error || 'Order could not be cancelled.', isError: true });
      }
    } catch (e: any) {
      setBoostActionFeedback({ orderId, text: e.message || 'Error cancelling order.', isError: true });
    } finally {
      setCancellingBoostOrderId(null);
    }
  };

  // Resolve helper objects for Buy Numbers
  const selectedCountryObj = useMemo(() => {
    if (activeTab === 'usa') {
      const usa = countries.find(c => c.id === '187' || c.code === 'US' || (c.name && c.name.toLowerCase().includes('united states')));
      if (usa) return usa;
      return { id: '187', name: 'United States', code: 'US', flag: '🇺🇸' };
    }
    const found = countries.find(c => c.id === selectedCountry);
    if (found) return found;
    return countries[0] || { id: '187', name: 'United States', code: 'US', flag: '🇺🇸' };
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
        <div className="mb-4 bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-bold p-3.5 rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-white font-extrabold text-base cursor-pointer">×</button>
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold p-3.5 rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{infoMessage}</span>
          </div>
          <button onClick={() => setInfoMessage('')} className="text-emerald-400 hover:text-white font-extrabold text-base cursor-pointer">×</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SERVER 2 FRONT PAGE (SCREENSHOT 1: IMG_2713.jpeg)                       */}
      {/* ========================================================================= */}
      {currentPage === 'front' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-[#12082b] border border-[#27134d] px-4 py-3 rounded-2xl shadow-md">
            <button
              onClick={onBackToMarketplace}
              className="p-2 bg-[#1a0c3b] hover:bg-[#251252] text-white rounded-xl border border-purple-800/40 transition cursor-pointer flex items-center justify-center"
              title="Back to Marketplace"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <h1 className="text-base font-black tracking-wide text-white">
                Server 2 Portal
              </h1>
              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                V2
              </span>
            </div>

            <button
              onClick={onOpenWallet}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-full shadow-md shadow-red-600/30 transition cursor-pointer flex items-center space-x-1"
            >
              <span>+ Fund</span>
            </button>
          </div>

          {/* Balance Widget */}
          <div className="bg-[#0e0622] border border-[#261352] p-4 rounded-2xl shadow-inner flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-300/60 block mb-0.5">
                AVAILABLE BALANCE
              </span>
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                ₦{walletBalance.toLocaleString()}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30 inline-block">
                Server 2 Online
              </span>
            </div>
          </div>

          {/* THE TWO ACTION CARDS MATCHING SCREENSHOT LAYOUT & STYLING */}
          <div className="space-y-5 pt-1 max-w-md sm:max-w-lg mx-auto">
            
            {/* Card 1: BUY NUMBERS (Red Squircle with Solid White Phone Icon) */}
            <button
              type="button"
              onClick={() => setCurrentPage('buy-numbers')}
              className="w-full bg-[#12082b] hover:bg-[#180b38] border border-[#281452] hover:border-red-500/50 rounded-[30px] sm:rounded-[34px] py-10 sm:py-12 px-6 sm:px-8 flex flex-col items-center justify-center text-center shadow-xl shadow-[#080216]/60 transition-all duration-300 transform active:scale-[0.98] cursor-pointer group"
            >
              {/* Red squircle icon container with solid white phone */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[26px] sm:rounded-[28px] bg-gradient-to-b from-[#c91823] to-[#991018] flex items-center justify-center shadow-lg shadow-red-900/40 group-hover:scale-105 transition-transform duration-300">
                <Phone className="w-11 h-11 sm:w-13 sm:h-13 text-white fill-white stroke-none" />
              </div>

              {/* Bold Clean Title matching screenshot */}
              <h2 className="text-2xl sm:text-[28px] font-bold text-white mt-6 sm:mt-7 tracking-tight group-hover:text-red-200 transition-colors">
                Buy Numbers
              </h2>
            </button>

            {/* Card 2: BOOST ACCOUNTS (Purple Squircle with Solid White Rocket Icon) */}
            <button
              type="button"
              onClick={() => setCurrentPage('boost-accounts')}
              className="w-full bg-[#12082b] hover:bg-[#180b38] border border-[#281452] hover:border-purple-500/50 rounded-[30px] sm:rounded-[34px] py-10 sm:py-12 px-6 sm:px-8 flex flex-col items-center justify-center text-center shadow-xl shadow-[#080216]/60 transition-all duration-300 transform active:scale-[0.98] cursor-pointer group"
            >
              {/* Purple squircle icon container with solid white rocket */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[26px] sm:rounded-[28px] bg-gradient-to-b from-[#8545f5] to-[#6725dc] flex items-center justify-center shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform duration-300">
                <Rocket className="w-11 h-11 sm:w-13 sm:h-13 text-white fill-white stroke-none" />
              </div>

              {/* Bold Clean Title matching screenshot */}
              <h2 className="text-2xl sm:text-[28px] font-bold text-white mt-6 sm:mt-7 tracking-tight group-hover:text-purple-200 transition-colors">
                Boost Accounts
              </h2>
            </button>

          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* 2. INSIDE PAGE 1: BUY NUMBERS (SCREENSHOT 2: IMG_2714.png)                */}
      {/* ========================================================================= */}
      {currentPage === 'buy-numbers' && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Top Header: Avatar + Username + Fund Wallet */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-3">
              {/* Red Circular Initial Avatar with back action */}
              <button
                type="button"
                onClick={() => {
                  if (initialPage === 'buy-numbers') {
                    onBackToMarketplace();
                  } else {
                    setCurrentPage('front');
                  }
                }}
                className="relative w-11 h-11 rounded-full bg-gradient-to-b from-red-600 to-red-800 border border-red-400/40 text-white font-black text-base flex items-center justify-center shadow-md shadow-red-600/30 cursor-pointer hover:scale-105 transition"
                title={initialPage === 'buy-numbers' ? "Back to Homepage" : "Back to Server 2 Front Page"}
              >
                <span>{userProfile?.username ? userProfile.username.charAt(0).toUpperCase() : 'M'}</span>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#180c38] rounded-full border border-purple-800 flex items-center justify-center text-[10px] text-purple-300">
                  <ArrowLeft className="w-3 h-3" />
                </span>
              </button>

              <div>
                <span className="text-sm font-black text-white block leading-tight">
                  {userProfile?.username || 'muzente001'}
                </span>
                <span className="text-[10px] text-purple-300/60 font-semibold">
                  Server 2 Verified
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenWallet}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-full shadow-md shadow-red-600/30 transition cursor-pointer flex items-center space-x-1"
            >
              <span>+ Fund Wallet</span>
            </button>
          </div>

          {/* Available Balance Display */}
          <div className="pt-2 pb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-300/60 block mb-1">
              AVAILABLE BALANCE
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                ₦{walletBalance.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Country Type Segmented Control (Large Pill from IMG_2714.png) */}
          <div className="bg-[#12082b] border border-[#27134d] p-1.5 rounded-2xl flex items-center shadow-inner">
            <button
              type="button"
              onClick={() => {
                setActiveTab('usa');
                setSelectedServer('usa1');
                const usa = countries.find(c => c.id === '187' || c.code === 'US' || (c.name && c.name.toLowerCase().includes('united states')));
                setSelectedCountry(usa ? usa.id : '187');
              }}
              className={`flex-1 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1.5 ${
                activeTab === 'usa'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-purple-300/70 hover:text-white'
              }`}
            >
              <span>🇺🇸 USA Numbers</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                setSelectedServer('all1');
              }}
              className={`flex-1 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1.5 ${
                activeTab === 'all'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-purple-300/70 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>All Countries</span>
            </button>
          </div>

          {/* Server Switch Sub-Pills (Internal Server 2 Route Selection - Stays strictly on Server 2) */}
          <div className="flex items-center space-x-2 pt-1 pb-1">
            <button
              type="button"
              onClick={() => setSelectedServer(activeTab === 'all' ? 'all1' : 'usa1')}
              className={`flex-1 py-2.5 px-2.5 rounded-full text-xs font-black transition cursor-pointer flex items-center justify-center space-x-1 ${
                selectedServer === 'usa1' || selectedServer === 'all1' || selectedServer === 'server_1'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30 border border-red-500'
                  : 'bg-[#12082b] text-purple-300/80 hover:bg-[#1a0c3b] hover:text-white border border-[#27134d]'
              }`}
              title="Server 1 Direct Route"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Server 1</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedServer(activeTab === 'all' ? 'all2' : 'usa2')}
              className={`flex-1 py-2.5 px-2.5 rounded-full text-xs font-black transition cursor-pointer flex items-center justify-center space-x-1 ${
                selectedServer === 'usa2' || selectedServer === 'all2' || selectedServer === 'server_2'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30 border border-red-500'
                  : 'bg-[#12082b] text-purple-300/80 hover:bg-[#1a0c3b] hover:text-white border border-[#27134d]'
              }`}
              title="Server 2 Express Route"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Server 2</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedServer(activeTab === 'all' ? 'all3' : 'usa3')}
              className={`flex-1 py-2.5 px-2.5 rounded-full text-xs font-black transition cursor-pointer flex items-center justify-center space-x-1 ${
                selectedServer === 'usa3' || selectedServer === 'all3' || selectedServer === 'server_3'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30 border border-red-500'
                  : 'bg-[#12082b] text-purple-300/80 hover:bg-[#1a0c3b] hover:text-white border border-[#27134d]'
              }`}
              title="Server 3 High Resilience Route"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Server 3</span>
            </button>
          </div>

          {/* MAIN CARD WITH RED HEADER STRIP (EXACTLY AS SEEN IN IMG_2714.png) */}
          <div className="bg-[#100726] border border-[#261352] rounded-3xl overflow-hidden shadow-2xl">
            
            {/* Red top header banner */}
            <div className="bg-red-600 text-white px-5 py-3 flex items-center justify-between text-xs font-black">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                <span>
                  {activeTab === 'usa' 
                    ? '🇺🇸 USA Numbers Server 2 — High Success'
                    : '🌐 All Countries Server 2 — 195+ Countries'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  fetchNumberOrders();
                  setIsNumberOrdersModalOpen(true);
                }}
                className="text-[11px] font-bold text-white/90 hover:text-white underline cursor-pointer"
              >
                Orders
              </button>
            </div>

            {/* Card Body */}
            <div className="p-5 sm:p-6 space-y-4">
              
              {/* Field 1: COUNTRY */}
              <div
                onClick={() => {
                  if (activeTab === 'all') {
                    setIsCountryModalOpen(true);
                  }
                }}
                className={`bg-[#160b33] border border-[#2b1756] ${
                  activeTab === 'all' ? 'hover:border-red-500/50 cursor-pointer' : 'cursor-default'
                } p-3.5 rounded-2xl flex items-center justify-between transition group`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-600/20">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest block mb-0.5">
                      COUNTRY {activeTab === 'usa' ? '(FIXED USA)' : ''}
                    </span>
                    <span className="text-sm font-black text-white">
                      {selectedCountryObj ? `${getCountryFlagEmoji(selectedCountryObj.code || selectedCountryObj.name)} ${selectedCountryObj.name}` : '🇺🇸 United States'}
                    </span>
                  </div>
                </div>
                {activeTab === 'all' && (
                  <ChevronRight className="w-5 h-5 text-purple-400 group-hover:text-white transition" />
                )}
              </div>

              {/* Field 2: SERVICE */}
              <div
                onClick={() => setIsServiceModalOpen(true)}
                className="bg-[#160b33] border border-[#2b1756] hover:border-red-500/50 p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition group"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-600/20">
                    <Smartphone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest block mb-0.5">
                      SERVICE
                    </span>
                    <span className="text-sm font-black text-white">
                      {selectedServiceObj ? selectedServiceObj.name : 'Select Service'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-purple-400 group-hover:text-white transition" />
              </div>

              {/* Quality Tier (if multiple options available) */}
              {priceOptions.length > 1 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest block pl-1">
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
                              ? 'bg-red-950/60 border-red-500 text-white'
                              : 'bg-[#150a2e] border-[#291452] text-purple-300/70 hover:bg-[#1a0c3b]'
                          }`}
                        >
                          <span className="font-extrabold block truncate">{opt.carrierTier.split(' (')[0]}</span>
                          <span className="text-[10px] font-mono font-bold text-red-300">₦{opt.customerPrice.toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price & Delivery Notice */}
              <div className="pt-2 border-t border-[#231248] flex items-center justify-between text-xs">
                <span className="text-purple-300/80 font-bold">Allocation Price:</span>
                <span className="text-2xl font-black font-mono text-white">
                  ₦{calculatedPrice.toLocaleString()}
                </span>
              </div>

              {/* Action Button: GET NUMBER (Red Rounded Button from IMG_2714.png) */}
              <button
                type="button"
                onClick={handleBuyNumber}
                disabled={buyingNumberLoading || !selectedService}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-sm sm:text-base rounded-2xl flex items-center justify-center space-x-2 shadow-xl shadow-red-600/30 transition duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buyingNumberLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Allocating Number...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>Get Number</span>
                  </>
                )}
              </button>

            </div>

          </div>

          {/* ACTIVE ORDER / LIVE SMS SCREEN IF ACTIVE */}
          {activeNumberOrder && (
            <div className="bg-[#12082b] border border-red-500/40 rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#231248] pb-3">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-black text-white">Your Server 2 Number</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full">
                  Waiting for SMS
                </span>
              </div>

              {/* Phone Number Display */}
              <div className="bg-[#180c38] border border-[#2e1762] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-purple-300/60 block">Assigned Number</span>
                  <span className="text-xl sm:text-2xl font-mono font-black text-white">
                    {activeNumberOrder.phoneNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(activeNumberOrder.phoneNumber || '', 'number')}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer"
                >
                  {copiedText === 'number' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedText === 'number' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* SMS Polling & Code Display */}
              {pollingStatus === 'WAITING' ? (
                <div className="p-4 bg-[#100726] rounded-2xl border border-[#261352] text-center space-y-2">
                  <div className="flex items-center justify-center space-x-2 text-amber-300 text-xs font-bold">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Waiting for SMS code... ({elapsedSeconds}s)</span>
                  </div>
                  <div className="w-full bg-[#1b0d3d] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full w-2/3 animate-pulse" />
                  </div>
                </div>
              ) : pollingStatus === 'RECEIVED' ? (
                <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-center space-y-3">
                  <span className="text-xs font-bold text-emerald-400 block">Verification Code Received:</span>
                  <div className="flex items-center justify-center space-x-3">
                    <span className="text-3xl font-black font-mono text-emerald-300 tracking-widest">
                      {verificationCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(verificationCode, 'code')}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedText === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedText === 'code' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  {smsContent && (
                    <p className="text-[11px] font-mono text-purple-200/80 bg-[#12082b] p-2.5 rounded-xl text-left border border-purple-900/40">
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
                  className="w-full py-2.5 bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-200 text-xs font-black rounded-xl transition cursor-pointer"
                >
                  {cancellingNumberLoading ? 'Processing 100% Refund...' : 'Cancel & Instant Full Refund'}
                </button>
              )}
            </div>
          )}

        </div>
      )}


      {/* ========================================================================= */}
      {/* 3. INSIDE PAGE 2: BOOST ACCOUNTS (SCREENSHOT 3: IMG_2715.png & IMG_2718.jpeg) */}
      {/* ========================================================================= */}
      {currentPage === 'boost-accounts' && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Top Bar: Red Back Button + Boost History Dark Pill */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                if (selectedBoostPlatformForOrder) {
                  setSelectedBoostPlatformForOrder(null);
                } else if (initialPage === 'boost-accounts') {
                  onBackToMarketplace();
                } else {
                  setCurrentPage('front');
                }
              }}
              className="w-10 h-10 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-600/30 cursor-pointer transition"
              title={
                selectedBoostPlatformForOrder
                  ? "Back to All Platforms"
                  : initialPage === 'boost-accounts'
                  ? "Back to Homepage"
                  : "Back to Server 2 Front Page"
              }
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            {/* Dark Pill Bar: Boost History with Yellow RotateCw Icon */}
            <button
              type="button"
              onClick={() => {
                fetchBoostOrders();
                setIsBoostHistoryOpen(true);
              }}
              className="bg-[#180d38] hover:bg-[#23124f] border border-[#2b1656] text-white px-5 py-2.5 rounded-full flex items-center space-x-2 font-bold text-xs shadow-md transition cursor-pointer"
            >
              <RotateCw className="w-4 h-4 text-yellow-400" />
              <span>Boost History</span>
            </button>
          </div>

          {/* Available Balance Header */}
          <div className="bg-[#0e0622] border border-[#261352] p-3.5 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-300/60 block">
                AVAILABLE BALANCE
              </span>
              <span className="text-xl sm:text-2xl font-black text-white font-mono">
                ₦{walletBalance.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenWallet}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-full shadow-md shadow-red-600/30 transition cursor-pointer"
            >
              + Fund
            </button>
          </div>

          {/* VIEW A: LIST OF ALL 12 SOCIAL MEDIA PLATFORMS (Shown initially, NO order form underneath) */}
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
                    className="rounded-2xl p-5 flex flex-col items-center justify-center min-h-[110px] cursor-pointer transition-all duration-200 bg-[#12082b] border border-[#27134d] hover:border-red-500 hover:bg-[#1a0c38] active:scale-[0.98]"
                  >
                    <IconComp className={`w-7 h-7 sm:w-8 sm:h-8 mb-2.5 ${platform.iconColor}`} />
                    <span className="text-sm sm:text-base font-black text-white tracking-wide">
                      {platform.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* VIEW B: ORDER FORM FOR SELECTED PLATFORM (Shown only after clicking a platform, Screenshot IMG_2718.jpeg) */
            <div className="bg-[#100726] border border-[#261352] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 animate-in fade-in">
              
              <div className="flex items-center justify-between border-b border-[#221045] pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Order {SMM_PLATFORMS.find(p => p.id === selectedPlatformId)?.name} Boost (Server 2)
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-red-400 bg-red-950/50 px-2 py-0.5 rounded-full border border-red-500/30 uppercase">
                  Instant Auto
                </span>
              </div>

              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-purple-300/60 block pl-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-[#160b33] border border-[#2b1756] rounded-xl px-3.5 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  {currentCategories.map(cat => (
                    <option key={cat} value={cat} className="bg-[#12082b] text-white">{cat}</option>
                  ))}
                </select>
              </div>

              {/* Service Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-purple-300/60 block pl-1">
                  Service Package
                </label>
                <select
                  value={selectedSmmServiceId}
                  onChange={(e) => setSelectedSmmServiceId(e.target.value)}
                  className="w-full bg-[#160b33] border border-[#2b1756] rounded-xl px-3.5 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  {filteredCategoryServices.map(srv => (
                    <option key={srv.id} value={srv.id} className="bg-[#12082b] text-white">
                      {srv.name} (₦{(srv.pricePerThousandNgn || srv.rate || 1500).toLocaleString()}/1k)
                    </option>
                  ))}
                </select>
              </div>

              {/* Link Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-purple-300/60 block pl-1">
                  Target Link / Profile URL
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="https://..."
                    value={targetLink}
                    onChange={(e) => setTargetLink(e.target.value)}
                    className="w-full bg-[#160b33] border border-[#2b1756] rounded-xl pl-10 pr-3.5 py-3 text-xs sm:text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Quantity Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-purple-300/60">
                    Quantity
                  </label>
                  {activeSmmService && (
                    <span className="text-[10px] text-purple-300/60 font-mono">
                      Min: {(activeSmmService.min || 100).toLocaleString()} | Max: {(activeSmmService.max || 50000).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Hash className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    min={activeSmmService?.min || 100}
                    max={activeSmmService?.max || 50000}
                    step={100}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-[#160b33] border border-[#2b1756] rounded-xl pl-10 pr-3.5 py-3 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Total Charge & Place Order */}
              <div className="pt-2 border-t border-[#231248] flex items-center justify-between text-xs">
                <span className="text-purple-300/80 font-bold">Total Cost:</span>
                <span className="text-2xl font-black font-mono text-white">
                  ₦{smmTotalNgn.toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                onClick={handlePlaceSmmOrder}
                disabled={smmOrderingLoading || !targetLink.trim()}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-sm sm:text-base rounded-2xl flex items-center justify-center space-x-2 shadow-xl shadow-red-600/30 transition duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0721] border border-[#2b1756] rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#231248] flex items-center justify-between">
              <h3 className="text-base font-black text-white">Select Country (Server 2)</h3>
              <button onClick={() => setIsCountryModalOpen(false)} className="text-purple-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-[#231248]">
              <div className="relative">
                <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={countrySearchQuery}
                  onChange={(e) => setCountrySearchQuery(e.target.value)}
                  className="w-full bg-[#140b2b] border border-[#2b1756] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-purple-400/50 focus:outline-none focus:border-red-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredCountries.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCountry(c.id);
                    setIsCountryModalOpen(false);
                    setCountrySearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition cursor-pointer ${
                    selectedCountry === c.id ? 'bg-red-600 text-white font-black' : 'hover:bg-[#160b33] text-purple-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getCountryFlagEmoji(c.code || c.name)}</span>
                    <span className="font-extrabold">{c.name}</span>
                  </div>
                  {selectedCountry === c.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SERVICE SELECTOR (SEARCHABLE MODAL)                                 */}
      {/* ========================================================================= */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0721] border border-[#2b1756] rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#231248] flex items-center justify-between">
              <h3 className="text-base font-black text-white">Select Service (Server 2)</h3>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-purple-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-[#231248]">
              <div className="relative">
                <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search apps (WhatsApp, Telegram, etc.)..."
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="w-full bg-[#140b2b] border border-[#2b1756] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-purple-400/50 focus:outline-none focus:border-red-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredServices.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedService(s.id);
                    setIsServiceModalOpen(false);
                    setServiceSearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition cursor-pointer ${
                    selectedService === s.id ? 'bg-red-600 text-white font-black' : 'hover:bg-[#160b33] text-purple-200'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Smartphone className="w-4 h-4 text-purple-400" />
                    <span className="font-extrabold">{s.name}</span>
                  </div>
                  {selectedService === s.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NUMBER ORDERS HISTORY                                              */}
      {/* ========================================================================= */}
      {isNumberOrdersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0721] border border-[#2b1756] rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#231248] flex items-center justify-between">
              <h3 className="text-base font-black text-white">Server 2 Number Orders</h3>
              <button onClick={() => setIsNumberOrdersModalOpen(false)} className="text-purple-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {numberOrders.length === 0 ? (
                <div className="text-center py-10 text-purple-300/60 text-xs">
                  No orders recorded for Server 2 yet.
                </div>
              ) : (
                numberOrders.map((ord) => (
                  <div key={ord.orderId || ord.id} className="p-3 rounded-2xl bg-[#140b2b] border border-[#27134f] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white">{ord.service || 'Service'}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        ord.status === 'SMS_RECEIVED' || ord.code ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {ord.status || 'Active'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-purple-300/80 font-mono">
                      <span>{ord.phoneNumber || ord.orderId}</span>
                      {ord.amount && <span className="font-bold text-white">₦{ord.amount.toLocaleString()}</span>}
                    </div>
                    {ord.code && (
                      <div className="bg-[#1a0f38] p-2 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                        <span className="font-mono font-black text-emerald-300">Code: {ord.code}</span>
                        <button
                          onClick={() => handleCopy(ord.code || '', `code_${ord.orderId}`)}
                          className="text-[10px] text-emerald-400 hover:text-white font-bold px-2 py-1 bg-emerald-500/20 rounded cursor-pointer"
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
      {/* MODAL: BOOST HISTORY (CLICKED FROM DARK PILL IN SCREENSHOT 3)              */}
      {/* ========================================================================= */}
      {isBoostHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0721] border border-[#2b1756] rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#231248] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RotateCw className="w-4 h-4 text-yellow-400" />
                <h3 className="text-base font-black text-white">Boost Orders History (Server 2)</h3>
              </div>
              <button onClick={() => setIsBoostHistoryOpen(false)} className="text-purple-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {boostOrders.length === 0 ? (
                <div className="text-center py-10 text-purple-300/60 text-xs">
                  No boost orders placed on Server 2 yet.
                </div>
              ) : (
                boostOrders.map((ord) => {
                  const currentOrderId = ord.orderId || ord.id || '';
                  const isRefreshing = refreshingBoostOrderId === currentOrderId;
                  const isRefilling = refillingBoostOrderId === currentOrderId;
                  const isCancelling = cancellingBoostOrderId === currentOrderId;
                  const statusStr = (ord.status || 'Processing').toLowerCase();
                  const isCancelled = statusStr === 'cancelled' || statusStr === 'canceled';
                  const isCompleted = statusStr === 'completed';

                  return (
                    <div key={currentOrderId} className="p-4 rounded-2xl bg-[#140b2b] border border-[#27134f] text-xs space-y-3 shadow-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-black text-white text-sm block truncate max-w-[220px]">
                            {ord.serviceName || `Service #${ord.serviceId || ord.service}`}
                          </span>
                          <span className="text-[10px] text-purple-400/70 font-mono">
                            ID: {currentOrderId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                            isCompleted
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                              : isCancelled
                              ? 'bg-red-950/60 border-red-500/40 text-red-300'
                              : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                          }`}>
                            {ord.status || 'Processing'}
                          </span>
                          <button
                            onClick={() => handleRefreshBoostStatus(currentOrderId)}
                            disabled={isRefreshing}
                            className="p-1.5 bg-[#1e0f3d] hover:bg-[#2c1559] text-purple-300 hover:text-white rounded-lg border border-[#3b1c73] transition cursor-pointer"
                            title="Check Live Status"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>

                      <div className="bg-[#0f0724] p-2.5 rounded-xl border border-[#221045] space-y-1">
                        <div className="text-purple-300/70 truncate text-[11px] flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate">{ord.targetUrl || ord.link || ord.target}</span>
                        </div>
                        <div className="flex items-center justify-between text-purple-300/80 font-mono text-[11px] pt-1 border-t border-[#1c0c38]">
                          <span>Qty: {Number(ord.quantity || 0).toLocaleString()}</span>
                          <span className="font-bold text-emerald-400">₦{Number(ord.totalChargeNgn || ord.charge || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Feedback Alert for this order */}
                      {boostActionFeedback && boostActionFeedback.orderId === currentOrderId && (
                        <div className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                          boostActionFeedback.isError ? 'bg-red-950/60 text-red-300 border border-red-500/30' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {boostActionFeedback.text}
                        </div>
                      )}

                      {/* Action buttons: Refill & Cancel where supported */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#231248]">
                        {!isCancelled && !isCompleted && (
                          <button
                            onClick={() => handleCancelBoostOrder(currentOrderId)}
                            disabled={isCancelling}
                            className="px-3 py-1 text-[11px] font-bold text-red-300 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 rounded-lg transition cursor-pointer disabled:opacity-50"
                          >
                            {isCancelling ? 'Cancelling...' : 'Cancel & Refund'}
                          </button>
                        )}
                        {(ord.refill || isCompleted) && !isCancelled && (
                          <button
                            onClick={() => handleRefillBoostOrder(currentOrderId)}
                            disabled={isRefilling || ord.refillStatus === 'requested'}
                            className="px-3 py-1 text-[11px] font-bold text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 rounded-lg transition cursor-pointer disabled:opacity-50"
                          >
                            {isRefilling ? 'Refilling...' : ord.refillStatus === 'requested' ? 'Refill Pending' : 'Request Refill'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
