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
import { copyToClipboard } from '../utils/clipboard';
import { ServiceUnavailableView } from './ServiceUnavailableView';

interface SocialBoostViewProps {
  userProfile: UserProfile | null;
  walletBalance: number;
  onRefreshProfile?: () => Promise<void> | void;
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
  if (p.includes('linkedin') || p.includes('member')) {
    return { 
      icon: Users, 
      iconColor: 'text-[#0A66C2]',
      iconBg: 'bg-[#0A66C2]/15 border-[#0A66C2]/30',
      accentColor: 'from-[#0A66C2] to-[#084e96]',
      displayName: 'LINKEDIN',
      tagline: 'Connections, Followers & Post Likes'
    };
  }
  if (p.includes('spotify') || p.includes('music') || p.includes('audiomack') || p.includes('soundcloud')) {
    return { 
      icon: Music2, 
      iconColor: 'text-[#1DB954]',
      iconBg: 'bg-[#1DB954]/15 border-[#1DB954]/30',
      accentColor: 'from-[#1DB954] to-[#15883e]',
      displayName: 'SPOTIFY & MUSIC',
      tagline: 'Streams, Monthly Listeners & Saves'
    };
  }
  if (p.includes('threads')) {
    return { 
      icon: Share2, 
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15 border-amber-500/30',
      accentColor: 'from-amber-500 to-orange-600',
      displayName: 'THREADS',
      tagline: 'Followers, Likes & Reposts'
    };
  }
  if (p.includes('discord')) {
    return { 
      icon: MessageSquare, 
      iconColor: 'text-[#5865F2]',
      iconBg: 'bg-[#5865F2]/15 border-[#5865F2]/30',
      accentColor: 'from-[#5865F2] to-[#4752c4]',
      displayName: 'DISCORD',
      tagline: 'Server Members & Online Boosts'
    };
  }
  if (p.includes('twitch') || p.includes('kick') || p.includes('stream') || p.includes('rumble') || p.includes('vimeo')) {
    return { 
      icon: Video, 
      iconColor: 'text-[#9146FF]',
      iconBg: 'bg-[#9146FF]/15 border-[#9146FF]/30',
      accentColor: 'from-[#9146FF] to-[#772ce8]',
      displayName: 'STREAMING (TWITCH/KICK)',
      tagline: 'Live Viewers & Followers'
    };
  }
  if (p.includes('snapchat')) {
    return { 
      icon: Sparkles, 
      iconColor: 'text-[#FFFC00]',
      iconBg: 'bg-[#FFFC00]/15 border-[#FFFC00]/30',
      accentColor: 'from-[#FFFC00] to-[#E6E200]',
      displayName: 'SNAPCHAT',
      tagline: 'Score Boost, Followers & Views'
    };
  }
  if (p.includes('reddit')) {
    return { 
      icon: MessageSquare, 
      iconColor: 'text-[#FF4500]',
      iconBg: 'bg-[#FF4500]/15 border-[#FF4500]/30',
      accentColor: 'from-[#FF4500] to-[#CC3700]',
      displayName: 'REDDIT',
      tagline: 'Upvotes, Karma & Subscribers'
    };
  }
  if (p.includes('pinterest')) {
    return { 
      icon: Bookmark, 
      iconColor: 'text-[#BD081C]',
      iconBg: 'bg-[#BD081C]/15 border-[#BD081C]/30',
      accentColor: 'from-[#BD081C] to-[#990616]',
      displayName: 'PINTEREST',
      tagline: 'Followers, Repins & Board Saves'
    };
  }
  if (p.includes('quora')) {
    return { 
      icon: Info, 
      iconColor: 'text-[#B92B27]',
      iconBg: 'bg-[#B92B27]/15 border-[#B92B27]/30',
      accentColor: 'from-[#B92B27] to-[#911D1A]',
      displayName: 'QUORA',
      tagline: 'Upvotes, Views & Followers'
    };
  }
  if (p.includes('review') || p.includes('trustpilot') || p.includes('rating')) {
    return { 
      icon: Star, 
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15 border-amber-500/30',
      accentColor: 'from-amber-500 to-yellow-600',
      displayName: 'REVIEWS & RATINGS',
      tagline: 'Trustpilot, Google & Store Reviews'
    };
  }
  if (p.includes('whatsapp')) {
    return { 
      icon: Send, 
      iconColor: 'text-[#25D366]',
      iconBg: 'bg-[#25D366]/15 border-[#25D366]/30',
      accentColor: 'from-[#25D366] to-[#128C7E]',
      displayName: 'WHATSAPP',
      tagline: 'Channel Members & Community Views'
    };
  }
  if (p.includes('bluesky')) {
    return { 
      icon: Cloud, 
      iconColor: 'text-[#0285FF]',
      iconBg: 'bg-[#0285FF]/15 border-[#0285FF]/30',
      accentColor: 'from-[#0285FF] to-[#0060df]',
      displayName: 'BLUESKY',
      tagline: 'Followers, Likes, Reposts & Comments'
    };
  }
  if (p.includes('gaming') || p.includes('steam') || p.includes('roblox') || p.includes('pubg') || p.includes('riot')) {
    return { 
      icon: Gamepad2, 
      iconColor: 'text-[#66c0f4]',
      iconBg: 'bg-[#66c0f4]/15 border-[#66c0f4]/30',
      accentColor: 'from-[#1b2838] to-[#2a475e]',
      displayName: 'GAMING & ACCOUNTS',
      tagline: 'Steam, Roblox, PUBG & Game Boosts'
    };
  }
  if (p.includes('design') || p.includes('behance') || p.includes('dribbble') || p.includes('canva')) {
    return { 
      icon: Palette, 
      iconColor: 'text-pink-400',
      iconBg: 'bg-pink-500/15 border-pink-500/30',
      accentColor: 'from-pink-500 to-rose-600',
      displayName: 'DESIGN & CREATIVE',
      tagline: 'Behance, Dribbble & Creative Assets'
    };
  }
  if (p.includes('traffic') || p.includes('web') || p.includes('website') || p.includes('google') || p.includes('seo')) {
    return { 
      icon: Globe, 
      iconColor: 'text-teal-400',
      iconBg: 'bg-teal-500/15 border-teal-500/30',
      accentColor: 'from-teal-500 to-emerald-600',
      displayName: 'WEBSITE TRAFFIC & SEO',
      tagline: 'Organic Direct & Search Visits'
    };
  }
  
  return { 
    icon: Compass, 
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/15 border-purple-500/30',
    accentColor: 'from-purple-600 to-pink-600',
    displayName: platformName.toUpperCase(),
    tagline: 'Social Media Growth Services'
  };
};

export const SocialBoostView: React.FC<SocialBoostViewProps> = ({
  onBackToMarketplace
}) => {
  return (
    <ServiceUnavailableView
      serviceType="social-boost"
      onBackToMarketplace={onBackToMarketplace}
    />
  );
};

export const _OldSocialBoostView: React.FC<SocialBoostViewProps> = ({
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet
}) => {
  // Navigation Tabs: 'marketplace' (main catalogue), 'orders' (user orders), 'manager' (owner pricing & curation)
  const [activeTab, setActiveTab] = useState<'marketplace' | 'orders' | 'manager'>('marketplace');
  
  // Real Live Services Catalogue from OneGridHub SMM Provider
  const [services, setServices] = useState<SocialBoostService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Search Bar Filter at Top
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expandable Platform Accordions (Set of expanded platform names)
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

  // Per-Platform Visible Service Count (for smooth responsive rendering of large catalogues)
  const [platformVisibleCounts, setPlatformVisibleCounts] = useState<Record<string, number>>({});

  // Sub-Category Filter inside each Platform (e.g. { Instagram: 'All', TikTok: 'Followers' })
  const [platformCategoryFilter, setPlatformCategoryFilter] = useState<Record<string, string>>({});

  // Active Selected Service for Order Modal
  const [orderModalService, setOrderModalService] = useState<SocialBoostService | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(1000);
  const [orderTargetUrl, setOrderTargetUrl] = useState<string>('');
  const [orderCommentsText, setOrderCommentsText] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<SocialBoostOrder | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Orders Tab State
  const [myOrders, setMyOrders] = useState<SocialBoostOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [refreshingOrderId, setRefreshingOrderId] = useState<string | null>(null);

  // Owner Manager State
  const [pricingSettings, setPricingSettings] = useState<SocialBoostPricingSettings>({
    defaultMarkupPercent: 45,
    minMarkupPer1k: 350,
    pricingStyle: 'natural',
    platformStatus: {},
    disabledServices: [],
    curatedServiceIds: [],
    bestValueServiceIds: {},
    serviceOverrides: {}
  });
  const [providerServices, setProviderServices] = useState<SocialBoostService[]>([]);
  const [isSyncingProvider, setIsSyncingProvider] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [isSavingManagerSettings, setIsSavingManagerSettings] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
  const [managerSearchQuery, setManagerSearchQuery] = useState<string>('');
  const [managerPlatformFilter, setManagerPlatformFilter] = useState<string>('All');
  const [managerVisibilityFilter, setManagerVisibilityFilter] = useState<'all' | 'curated' | 'hidden'>('all');

  // Owner Authorization
  const isOwner = useMemo(() => {
    const email = (userProfile?.email || auth?.currentUser?.email || '').toLowerCase();
    return email === 'azeezmusharaf4@gmail.com' || userProfile?.role === 'owner' || userProfile?.role === 'admin';
  }, [userProfile]);

  // Fetch real services directly from API
  const fetchServices = useCallback(async (retryCount = 0) => {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json, text/plain, */*'
      };

      const callerEmail = (userProfile?.email || auth?.currentUser?.email || '').toLowerCase().trim();
      if (callerEmail) {
        headers['x-caller-email'] = callerEmail;
      }

      if (auth.currentUser) {
        try {
          const token = await getSafeIdToken(auth.currentUser);
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        } catch {}
      }

      const endpoint = `/api/social-boost/services?action=services&callerEmail=${encodeURIComponent(callerEmail)}`;
      let data: any = null;
      try {
        const res = await fetch(endpoint, { headers });
        if (res.ok) {
          data = await res.json();
        } else {
          // Try safeApiFetch as secondary fallback
          data = await safeApiFetch(endpoint, { headers });
        }
      } catch {
        data = await safeApiFetch(endpoint, { headers });
      }

      const receivedList: SocialBoostService[] = 
        (data && Array.isArray(data.services) && data.services) ||
        (Array.isArray(data) && data) ||
        (data && Array.isArray(data.data) && data.data) ||
        [];

      if (receivedList.length > 0) {
        // Sort services by customer price from LOWEST to HIGHEST (cheapest first)
        const sortedList = [...receivedList].sort((a, b) => {
          const priceA = Number(a.ratePer1000) || 0;
          const priceB = Number(b.ratePer1000) || 0;
          if (priceA !== priceB) return priceA - priceB;
          return (a.name || '').localeCompare(b.name || '');
        });
        setServices(sortedList);
        setLastSyncedAt(data?.lastSyncedAt || new Date().toISOString());
        setServicesError(null);
        setIsLoadingServices(false);
      } else if (data && data.error) {
        if (services.length === 0) {
          setServicesError(String(data.error));
        }
        setIsLoadingServices(false);
      } else if (retryCount < 2) {
        setTimeout(() => fetchServices(retryCount + 1), 800);
      } else {
        if (services.length === 0) {
          setServicesError('Boost services provider is currently updating. Click Retry to reload.');
        }
        setIsLoadingServices(false);
      }
    } catch (err: any) {
      if (retryCount < 2) {
        setTimeout(() => fetchServices(retryCount + 1), 800);
      } else {
        console.warn('[SocialBoost] Error loading services:', err);
        if (services.length === 0) {
          setServicesError(sanitizeApiErrorMessage(err.message || 'Failed to load boost catalogue.'));
        }
        setIsLoadingServices(false);
      }
    }
  }, [services.length]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!auth.currentUser) {
      setMyOrders([]);
      return;
    }
    setIsLoadingOrders(true);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const endpoint = isOwner && activeTab === 'manager' 
        ? '/api/social-boost/orders?action=orders&all=true' 
        : `/api/social-boost/orders?action=orders&userId=${encodeURIComponent(auth.currentUser.uid)}`;
      
      const data = await safeApiFetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && Array.isArray(data.orders)) {
        setMyOrders(data.orders);
      }
    } catch (err) {
      console.warn('[SocialBoost] Failed to fetch orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [isOwner, activeTab]);

  // Initial load
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab, fetchOrders]);

  // Toggle platform expansion
  const togglePlatform = (platform: string) => {
    setExpandedPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  // Group real services by platform
  const platformsData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qTokens = q.split(/\s+/).filter(Boolean);
    const map = new Map<string, {
      platform: string;
      services: SocialBoostService[];
      subCategories: string[];
      minPrice: number;
    }>();

    // Priority ordering of platforms matching popular expectations
    const priority = [
      'Instagram',
      'Facebook',
      'TikTok',
      'YouTube',
      'Twitter / X',
      'Twitter',
      'Telegram',
      'LinkedIn',
      'Spotify & Music',
      'Spotify',
      'Threads',
      'Discord',
      'Twitch & Streaming',
      'Snapchat',
      'Reddit',
      'Pinterest',
      'Quora',
      'BlueSky',
      'Gaming & Accounts',
      'Design & Creative',
      'Reviews & Ratings',
      'Website Traffic & SEO',
      'WhatsApp',
      'Other Services'
    ];

    services.forEach(svc => {
      const plat = svc.platform || 'General';
      const svcSearchable = `${svc.name || ''} ${plat} ${svc.category || ''} ${svc.type || ''} ${svc.id || ''} ${(svc as any).providerServiceId || ''} ${svc.description || ''}`.toLowerCase();
      
      // Check search match across all tokens (all words must match)
      const matchesSearch = qTokens.length === 0 || qTokens.every(token => svcSearchable.includes(token));

      if (!matchesSearch) return;

      if (!map.has(plat)) {
        map.set(plat, {
          platform: plat,
          services: [],
          subCategories: ['All'],
          minPrice: Infinity
        });
      }

      const entry = map.get(plat)!;
      entry.services.push(svc);
      if (svc.category && !entry.subCategories.includes(svc.category)) {
        entry.subCategories.push(svc.category);
      }
      const rate = Number(svc.ratePer1000) || 0;
      if (rate > 0 && rate < entry.minPrice) {
        entry.minPrice = rate;
      }
    });

    // Convert map to sorted array
    const result = Array.from(map.values()).sort((a, b) => {
      const idxA = priority.findIndex(p => a.platform.toLowerCase().includes(p.toLowerCase()));
      const idxB = priority.findIndex(p => b.platform.toLowerCase().includes(p.toLowerCase()));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.platform.localeCompare(b.platform);
    });

    // Ensure every platform's services are sorted by customer price from LOWEST to HIGHEST (cheapest first)
    result.forEach(entry => {
      entry.services.sort((a, b) => {
        const priceA = Number(a.ratePer1000) || 0;
        const priceB = Number(b.ratePer1000) || 0;
        if (priceA !== priceB) return priceA - priceB;
        return (a.name || '').localeCompare(b.name || '');
      });
    });

    return result;
  }, [services, searchQuery]);

  // Automatically expand platforms when searching
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const newExpanded: Record<string, boolean> = {};
      platformsData.forEach(p => {
        newExpanded[p.platform] = true;
      });
      setExpandedPlatforms(newExpanded);
    }
  }, [searchQuery, platformsData]);

  // Open Order Modal for a selected service
  const handleOpenOrderModal = (service: SocialBoostService) => {
    setOrderModalService(service);
    const initialQty = service.min || 1000;
    setOrderQuantity(initialQty);
    setOrderTargetUrl('');
    setOrderCommentsText('');
    setOrderError(null);
    setOrderSuccess(null);
  };

  const handleCloseOrderModal = () => {
    setOrderModalService(null);
    setOrderError(null);
    setOrderSuccess(null);
  };

  // Calculate order price in real time
  const calculatedPrice = useMemo(() => {
    if (!orderModalService) return 0;
    const rate = Number(orderModalService.ratePer1000) || 0;
    const qty = Math.max(0, Number(orderQuantity) || 0);
    return Math.round((rate / 1000) * qty);
  }, [orderModalService, orderQuantity]);

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderModalService) return;

    if (!auth.currentUser) {
      setOrderError('Please sign in or create an account to place a boost order.');
      return;
    }

    if (walletBalance < calculatedPrice) {
      setOrderError(`Insufficient wallet balance. You need ₦${calculatedPrice.toLocaleString()} (Balance: ₦${walletBalance.toLocaleString()}). Please fund your wallet.`);
      return;
    }

    const target = orderModalService.inputType === 'custom_comments' ? orderCommentsText.trim() : orderTargetUrl.trim();
    if (!target) {
      setOrderError(orderModalService.inputType === 'custom_comments' ? 'Please enter custom comments.' : 'Please enter target URL or @username.');
      return;
    }

    const minQty = orderModalService.min || 50;
    const maxQty = orderModalService.max || 1000000;
    if (orderQuantity < minQty || orderQuantity > maxQty) {
      setOrderError(`Quantity must be between ${minQty.toLocaleString()} and ${maxQty.toLocaleString()}.`);
      return;
    }

    setIsSubmittingOrder(true);
    setOrderError(null);
    setOrderSuccess(null);

    try {
      const token = await getSafeIdToken(auth.currentUser);
      const payload = {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || userProfile?.email || '',
        serviceId: orderModalService.id,
        service: orderModalService.id,
        target,
        link: target,
        targetUrl: target,
        quantity: orderQuantity,
        amountNgn: calculatedPrice,
        totalCost: calculatedPrice,
        comments: orderModalService.inputType === 'custom_comments' ? orderCommentsText : undefined,
        customComments: orderModalService.inputType === 'custom_comments' ? orderCommentsText : undefined
      };

      const data = await safeApiFetch('/api/social-boost/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...payload, action: 'order' })
      });

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to place boosting order.');
      }

      setOrderSuccess(data.order);
      // Auto refresh orders
      fetchOrders();
      if (onRefreshProfile) {
        await onRefreshProfile();
      }
    } catch (err: any) {
      console.error('[SocialBoost Order] Error:', err);
      setOrderError(sanitizeApiErrorMessage(err.message || 'Failed to process boosting order.'));
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Refresh single order status
  const handleRefreshStatus = async (orderId: string) => {
    setRefreshingOrderId(orderId);
    try {
      const data = await safeApiFetch(`/api/social-boost/status?action=status&orderId=${encodeURIComponent(orderId)}`);
      if (data && data.order) {
        setMyOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, ...data.order } : o));
      }
    } catch (err) {
      console.warn('[SocialBoost] Error refreshing status:', err);
    } finally {
      setRefreshingOrderId(null);
    }
  };

  // Owner Sync with OneGridHub
  const handleSyncOneGridHub = async () => {
    if (!auth.currentUser) return;
    setIsSyncingProvider(true);
    setSyncStatusMessage(null);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data = await safeApiFetch('/api/social-boost/sync-provider', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ action: 'sync-provider' })
      });
      if (data && data.success) {
        setSyncStatusMessage(data.message || 'Successfully synchronized real services from OneGridHub!');
        await fetchServices();
      } else {
        throw new Error(data?.error || 'Failed to sync with OneGridHub API.');
      }
    } catch (err: any) {
      setSyncStatusMessage(`Sync notice: ${sanitizeApiErrorMessage(err.message)}`);
    } finally {
      setIsSyncingProvider(false);
    }
  };

  // Owner Save Pricing & Settings
  const handleSaveManagerSettings = async () => {
    if (!auth.currentUser) return;
    setIsSavingManagerSettings(true);
    setSaveStatusMessage(null);
    try {
      const token = await getSafeIdToken(auth.currentUser);
      const data = await safeApiFetch('/api/social-boost/pricing-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...pricingSettings, action: 'pricing-settings' })
      });
      if (data && data.success) {
        setSaveStatusMessage('Pricing rules and service visibility saved successfully!');
        await fetchServices();
        setTimeout(() => setSaveStatusMessage(null), 3000);
      }
    } catch (err: any) {
      setSaveStatusMessage(`Save error: ${sanitizeApiErrorMessage(err.message)}`);
    } finally {
      setIsSavingManagerSettings(false);
    }
  };

  const handleCopyOrderId = (id: string) => {
    copyToClipboard(id);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] text-[#171329] select-none pb-28">
      
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E9E2FA] px-4 py-3.5 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          
          {/* Back Button & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBackToMarketplace}
              className="w-10 h-10 rounded-xl bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA] flex items-center justify-center text-[#7C3AED] hover:text-[#5B21B6] transition cursor-pointer shrink-0 shadow-sm active:scale-95"
              title="Back to Marketplace"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#171329] flex items-center gap-2 truncate">
                <span>Boost Services</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED] shrink-0 border border-[#E9E2FA]">
                  Automated SMM
                </span>
              </h1>
              <p className="text-[11px] text-[#716B82] font-medium truncate">
                Instant social media growth for Instagram, TikTok, YouTube & more
              </p>
            </div>
          </div>

          {/* Wallet Balance / Fund Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenWallet}
              className="flex items-center gap-2 bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA] px-3 py-1.5 rounded-xl transition cursor-pointer shadow-sm active:scale-95"
            >
              <Wallet className="w-4 h-4 text-[#7C3AED]" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-semibold text-[#716B82] leading-none">Wallet</span>
                <span className="text-xs font-bold text-[#047857] leading-tight">
                  ₦{walletBalance.toLocaleString()}
                </span>
              </div>
              <span className="text-[10px] font-bold bg-[#7C3AED] text-white px-2 py-0.5 rounded-md ml-0.5">
                + Fund
              </span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs: Marketplace Catalogue | My Orders | Owner Manager */}
        <div className="max-w-4xl mx-auto flex items-center gap-1.5 mt-3 pt-2 border-t border-[#E9E2FA]">
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'marketplace'
                ? 'bg-[#7C3AED] text-white shadow-sm'
                : 'text-[#716B82] hover:text-[#171329] bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Services Catalogue</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'orders'
                ? 'bg-[#7C3AED] text-white shadow-sm'
                : 'text-[#716B82] hover:text-[#171329] bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>My Orders</span>
            {myOrders.length > 0 && (
              <span className="bg-[#EDE9FE] text-[#7C3AED] text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {myOrders.length}
              </span>
            )}
          </button>

          {isOwner && (
            <button
              onClick={() => setActiveTab('manager')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'manager'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Owner Suite</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        
        {/* ========================================================================= */}
        {/* TAB 1: MAIN MARKETPLACE CATALOGUE (Matching Screenshot UI/UX Structure) */}
        {/* ========================================================================= */}
        {activeTab === 'marketplace' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* 1. LARGE PROMINENT SEARCH BAR (Matching Reference Screenshot Top Search) */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-[#7C3AED]" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search for followers, likes, views, platforms..."
                className="w-full bg-white hover:bg-white focus:bg-white border border-[#E9E2FA] focus:border-[#7C3AED] text-[#171329] placeholder-[#716B82]/60 text-sm sm:text-base font-medium rounded-2xl pl-12 pr-10 py-3.5 transition shadow-sm outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#716B82] hover:text-[#171329] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Error Banner with Retry (Only shown if no services loaded) */}
            {servicesError && services.length === 0 && !isLoadingServices && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-rose-800 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{servicesError}</span>
                </div>
                <button
                  onClick={() => {
                    setIsLoadingServices(true);
                    fetchServices();
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shrink-0 cursor-pointer transition shadow-sm"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading State */}
            {isLoadingServices && (
              <div className="space-y-3 pt-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div 
                    key={i} 
                    className="h-16 rounded-2xl bg-white border border-[#E9E2FA] animate-pulse flex items-center justify-between px-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#EDE9FE]" />
                      <div className="w-32 h-4 rounded bg-[#EDE9FE]" />
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-[#EDE9FE]" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty Search Result (Only if user has typed a query that matched nothing) */}
            {!isLoadingServices && services.length > 0 && platformsData.length === 0 && searchQuery.trim() !== '' && (
              <div className="p-10 text-center bg-white border border-[#E9E2FA] rounded-3xl space-y-3 shadow-sm">
                <Flame className="w-10 h-10 text-[#7C3AED]/40 mx-auto" />
                <h3 className="text-sm sm:text-base font-bold text-[#171329]">No services found</h3>
                <p className="text-xs text-[#716B82] max-w-sm mx-auto">
                  No boost services matched "{searchQuery}". Try searching for another keyword like "followers", "likes" or "views".
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#5B21B6] text-white rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Clear Search
                </button>
              </div>
            )}

            {/* No services loaded fallback */}
            {!isLoadingServices && services.length === 0 && !servicesError && (
              <div className="p-10 text-center bg-white border border-[#E9E2FA] rounded-3xl space-y-3 shadow-sm">
                <TrendingUp className="w-10 h-10 text-[#7C3AED]/40 mx-auto" />
                <h3 className="text-sm sm:text-base font-bold text-[#171329]">Loading Boost Services</h3>
                <p className="text-xs text-[#716B82] max-w-sm mx-auto">
                  Connecting to live provider gateway...
                </p>
                <button
                  onClick={() => {
                    setIsLoadingServices(true);
                    fetchServices();
                  }}
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#5B21B6] text-white rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Refresh Services
                </button>
              </div>
            )}

            {/* 2. PLATFORM CARDS LIST (Large Rounded White Pill/Card Rows matching Reference Screenshot) */}
            {!isLoadingServices && platformsData.length > 0 && (
              <div className="space-y-3 pt-1">
                {platformsData.map(({ platform, services: platformServices, subCategories, minPrice }) => {
                  const isExpanded = Boolean(expandedPlatforms[platform]);
                  const visuals = getPlatformVisuals(platform);
                  const Icon = visuals.icon;
                  const selectedCategory = platformCategoryFilter[platform] || 'All';

                  // Filter services for this platform based on selected sub-category (guaranteed sorted by price from lowest to highest)
                  const filteredPlatformServices = (selectedCategory === 'All'
                    ? platformServices
                    : platformServices.filter(s => s.category === selectedCategory)
                  ).sort((a, b) => {
                    const priceA = Number(a.ratePer1000) || 0;
                    const priceB = Number(b.ratePer1000) || 0;
                    if (priceA !== priceB) return priceA - priceB;
                    return (a.name || '').localeCompare(b.name || '');
                  });

                  return (
                    <div
                      key={platform}
                      className="bg-white border border-[#E9E2FA] hover:border-[#7C3AED]/40 rounded-2xl overflow-hidden transition shadow-sm"
                    >
                      {/* CARD HEADER ROW: [Platform Icon] [PLATFORM NAME] [+] */}
                      <div
                        onClick={() => togglePlatform(platform)}
                        className="px-5 py-4 flex items-center justify-between cursor-pointer select-none transition bg-white hover:bg-[#F8F7FF] active:scale-[0.99]"
                      >
                        {/* Left: Icon & Platform Name */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-10 h-10 rounded-xl ${visuals.iconBg} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-5 h-5 ${visuals.iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-sm sm:text-base font-bold tracking-tight text-[#171329] uppercase truncate">
                              {visuals.displayName}
                            </h2>
                            <p className="text-[11px] text-[#716B82] font-medium truncate">
                              {platformServices.length} {platformServices.length === 1 ? 'service' : 'services'} available
                              {minPrice !== Infinity && ` • From ₦${minPrice.toLocaleString()}/1k`}
                            </p>
                          </div>
                        </div>

                        {/* Right: Plus / Minus Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlatform(platform);
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition shrink-0 ${
                            isExpanded
                              ? 'bg-[#EDE9FE] text-[#7C3AED] border border-[#E9E2FA] rotate-90'
                              : 'bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#7C3AED] border border-[#E9E2FA]'
                          }`}
                          aria-label={isExpanded ? "Collapse platform services" : "Expand platform services"}
                        >
                          {isExpanded ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </button>
                      </div>

                      {/* EXPANDED CONTENT: Real services from the API for this platform */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 bg-[#F8F7FF] border-t border-[#E9E2FA] space-y-4 animate-in fade-in duration-200">
                          
                          {/* Sub-Category Filter Chips (if more than 1 category) */}
                          {subCategories.length > 2 && (
                            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                              <span className="text-[10px] font-bold uppercase text-[#716B82] shrink-0 mr-1">
                                Filter:
                              </span>
                              {subCategories.map(cat => {
                                const isCatSelected = selectedCategory === cat;
                                return (
                                  <button
                                    key={cat}
                                    onClick={() => setPlatformCategoryFilter(prev => ({ ...prev, [platform]: cat }))}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                                      isCatSelected
                                        ? 'bg-[#7C3AED] text-white shadow-sm'
                                        : 'bg-white text-[#716B82] hover:text-[#171329] border border-[#E9E2FA]'
                                    }`}
                                  >
                                    {cat}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* List of Real Available Services */}
                          <div className="space-y-3">
                            {(() => {
                              const limit = searchQuery.trim() ? filteredPlatformServices.length : (platformVisibleCounts[platform] || 30);
                              const displayedServices = filteredPlatformServices.slice(0, limit);
                              const hasMore = filteredPlatformServices.length > displayedServices.length;

                              return (
                                <>
                                  {displayedServices.map(service => (
                                    <div
                                      key={service.id}
                                      className="bg-white hover:bg-white border border-[#E9E2FA] hover:border-[#7C3AED]/40 rounded-2xl p-4 transition space-y-3 shadow-sm"
                                    >
                                      {/* Service Header & Price Row */}
                                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                          
                                          {/* Badges */}
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EDE9FE] text-[#7C3AED] border border-[#E9E2FA]">
                                              {service.type || 'Service'}
                                            </span>
                                            {service.isCheapest && (
                                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#047857] border border-emerald-200">
                                                ⭐ Lowest Rate
                                              </span>
                                            )}
                                            {service.isBestValue && (
                                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-[#7C3AED] border border-purple-200">
                                                🔥 Best Value
                                              </span>
                                            )}
                                            {service.refill && (
                                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                                🛡️ Refill Guarantee
                                              </span>
                                            )}
                                          </div>

                                          {/* Service Name */}
                                          <h3 className="text-xs sm:text-sm font-bold text-[#171329] leading-snug break-words">
                                            {service.name}
                                          </h3>

                                          {/* Service Description */}
                                          {service.description && (
                                            <p className="text-[11px] text-[#716B82] leading-relaxed">
                                              {service.description}
                                            </p>
                                          )}
                                        </div>

                                        {/* Selling Rate */}
                                        <div className="text-left sm:text-right shrink-0 bg-[#F8F7FF] sm:bg-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-[#E9E2FA]">
                                          <span className="text-[9px] font-semibold text-[#716B82] uppercase block">
                                            Rate / 1,000 Units
                                          </span>
                                          <span className="text-base sm:text-lg font-bold text-[#047857] block">
                                            ₦{(service.ratePer1000 || 0).toLocaleString()}
                                          </span>
                                          {isOwner && (
                                            <div className="mt-1 text-[10px] font-mono text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-left sm:text-right whitespace-nowrap">
                                              <span className="text-amber-800">Cost: ₦{(service.providerRatePer1000 || Math.max(0, (service.ratePer1000 || 0) - (service.markupPer1000 || 0))).toLocaleString()}</span>
                                              <span className="mx-1 text-amber-500">→</span>
                                              <span className="text-amber-700 font-bold">+₦{(service.markupPer1000 !== undefined ? service.markupPer1000 : Math.round((service.ratePer1000 || 0) * 0.35)).toLocaleString()} markup</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Service Specs & Order Trigger Button */}
                                      <div className="pt-2.5 border-t border-[#E9E2FA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#716B82] font-medium">
                                          <span>Min: <strong className="text-[#171329] font-bold">{service.min?.toLocaleString()}</strong></span>
                                          <span>•</span>
                                          <span>Max: <strong className="text-[#171329] font-bold">{service.max?.toLocaleString()}</strong></span>
                                          <span>•</span>
                                          <span className="text-amber-700 font-semibold flex items-center gap-1">
                                            <Rocket className="w-3 h-3 text-amber-600" />
                                            {service.deliverySpeed || 'Instant Start Delivery'}
                                          </span>
                                        </div>

                                        {/* Order Button */}
                                        <button
                                          onClick={() => handleOpenOrderModal(service)}
                                          className="w-full sm:w-auto px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#5B21B6] active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                                        >
                                          <Rocket className="w-3.5 h-3.5" />
                                          <span>Order Now</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}

                                  {/* Pagination & Show More Controls */}
                                  {hasMore && (
                                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-3.5 rounded-2xl border border-[#E9E2FA]">
                                      <span className="text-xs text-[#716B82] font-medium">
                                        Showing <strong>{displayedServices.length}</strong> of <strong>{filteredPlatformServices.length}</strong> services
                                      </span>
                                      <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button
                                          type="button"
                                          onClick={() => setPlatformVisibleCounts(prev => ({
                                            ...prev,
                                            [platform]: (prev[platform] || 30) + 30
                                          }))}
                                          className="flex-1 sm:flex-initial px-4 py-1.5 rounded-xl bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#7C3AED] text-xs font-bold transition cursor-pointer border border-[#E9E2FA]"
                                        >
                                          + Show 30 More
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPlatformVisibleCounts(prev => ({
                                            ...prev,
                                            [platform]: filteredPlatformServices.length
                                          }))}
                                          className="flex-1 sm:flex-initial px-4 py-1.5 rounded-xl bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#5B21B6] text-xs font-bold transition cursor-pointer border border-[#C4B5FD]"
                                        >
                                          Show All ({filteredPlatformServices.length})
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY ORDERS & LIVE STATUS TRACKING */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#E9E2FA] shadow-sm">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[#171329]">Your Boosting Orders</h2>
                <p className="text-xs text-[#716B82]">Live status synchronized directly with provider gateway</p>
              </div>
              <button
                onClick={fetchOrders}
                disabled={isLoadingOrders}
                className="px-3.5 py-1.5 bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA] rounded-xl text-xs font-bold text-[#7C3AED] hover:text-[#5B21B6] flex items-center gap-1.5 cursor-pointer transition shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingOrders ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-white rounded-2xl border border-[#E9E2FA] animate-pulse" />
                ))}
              </div>
            ) : myOrders.length === 0 ? (
              <div className="p-12 text-center bg-white border border-[#E9E2FA] rounded-3xl space-y-3 shadow-sm">
                <Clock className="w-12 h-12 text-[#7C3AED]/30 mx-auto" />
                <h3 className="text-sm font-bold text-[#171329]">No boost orders placed yet</h3>
                <p className="text-xs text-[#716B82] max-w-sm mx-auto">
                  Choose any platform above (Instagram, TikTok, YouTube, etc.) to place your first automated growth order.
                </p>
                <button
                  onClick={() => setActiveTab('marketplace')}
                  className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#5B21B6] text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm transition"
                >
                  Browse Boost Services
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(order => {
                  const visuals = getPlatformVisuals(order.platform);
                  const Icon = visuals.icon;

                  return (
                    <div
                      key={order.id || order.orderId}
                      className="p-4 bg-white border border-[#E9E2FA] rounded-2xl space-y-3 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-[#E9E2FA]">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl ${visuals.iconBg} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-4 h-4 ${visuals.iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-[#171329] truncate">
                              {order.serviceName}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-[#716B82]">
                              <span>ID: <strong className="text-[#171329] font-mono">{order.orderId}</strong></span>
                              <button
                                onClick={() => handleCopyOrderId(order.orderId)}
                                className="text-[#7C3AED] hover:text-[#5B21B6] cursor-pointer"
                                title="Copy Order ID"
                              >
                                {copiedOrderId === order.orderId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                              <span>•</span>
                              <span>{new Date(order.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Pill */}
                        <div className="flex items-center gap-2 sm:justify-end">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            order.status === 'completed'
                              ? 'bg-emerald-50 border-emerald-200 text-[#047857]'
                              : order.status === 'in_progress' || order.status === 'processing'
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : order.status === 'canceled'
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}>
                            {order.status || 'Processing'}
                          </span>

                          <button
                            onClick={() => handleRefreshStatus(order.orderId)}
                            disabled={refreshingOrderId === order.orderId}
                            className="p-1.5 bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#7C3AED] hover:text-[#5B21B6] rounded-lg border border-[#E9E2FA] transition cursor-pointer"
                            title="Check Live Status"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingOrderId === order.orderId ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-[#F8F7FF] p-2.5 rounded-xl border border-[#E9E2FA]">
                          <span className="text-[9px] font-semibold uppercase text-[#716B82] block">Target Link / User</span>
                          <span className="text-[#171329] font-semibold truncate block">{order.target}</span>
                        </div>
                        <div className="bg-[#F8F7FF] p-2.5 rounded-xl border border-[#E9E2FA]">
                          <span className="text-[9px] font-semibold uppercase text-[#716B82] block">Quantity</span>
                          <span className="text-[#171329] font-bold block">{order.quantity.toLocaleString()}</span>
                        </div>
                        <div className="bg-[#F8F7FF] p-2.5 rounded-xl border border-[#E9E2FA]">
                          <span className="text-[9px] font-semibold uppercase text-[#716B82] block">Total Charged</span>
                          <span className="text-[#047857] font-bold block">₦{order.charge.toLocaleString()}</span>
                        </div>
                        <div className="bg-[#F8F7FF] p-2.5 rounded-xl border border-[#E9E2FA]">
                          <span className="text-[9px] font-semibold uppercase text-[#716B82] block">Start / Remains</span>
                          <span className="text-[#171329] font-medium block">
                            {order.startCount !== undefined ? order.startCount.toLocaleString() : 'N/A'} / {order.remains !== undefined ? order.remains.toLocaleString() : '0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: OWNER SERVICE MANAGER & PRICING SUITE */}
        {/* ========================================================================= */}
        {activeTab === 'manager' && isOwner && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Header & Upstream Sync */}
            <div className="bg-white border border-[#E9E2FA] rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      ONEGRIDHUB OWNER SUITE
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[#171329] mt-1">
                    Social Boosting Service & Price Controller
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncOneGridHub}
                    disabled={isSyncingProvider}
                    className="px-3.5 py-2 bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA] text-[#7C3AED] hover:text-[#5B21B6] rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingProvider ? 'animate-spin' : ''}`} />
                    <span>Sync from OneGridHub</span>
                  </button>

                  <button
                    onClick={handleSaveManagerSettings}
                    disabled={isSavingManagerSettings}
                    className="px-4 py-2 bg-[#7C3AED] hover:bg-[#5B21B6] text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save All Settings</span>
                  </button>
                </div>
              </div>

              {syncStatusMessage && (
                <div className="p-3 bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl text-xs text-[#716B82]">
                  {syncStatusMessage}
                </div>
              )}

              {saveStatusMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  {saveStatusMessage}
                </div>
              )}

              {/* Global Markup Rules */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-[#F8F7FF] p-3 rounded-xl border border-[#E9E2FA] space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#716B82] block">
                    Default Profit Markup (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={pricingSettings.defaultMarkupPercent}
                      onChange={e => setPricingSettings(prev => ({ ...prev, defaultMarkupPercent: Number(e.target.value) }))}
                      className="w-full bg-white border border-[#E9E2FA] rounded-lg px-2.5 py-1 text-xs text-[#171329] font-bold focus:border-[#7C3AED] outline-none"
                    />
                    <span className="text-xs text-[#716B82] font-bold">%</span>
                  </div>
                </div>

                <div className="bg-[#F8F7FF] p-3 rounded-xl border border-[#E9E2FA] space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#716B82] block">
                    Minimum Markup Per 1k (₦)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={100}
                      max={5000}
                      step={50}
                      value={pricingSettings.minMarkupPer1k}
                      onChange={e => setPricingSettings(prev => ({ ...prev, minMarkupPer1k: Number(e.target.value) }))}
                      className="w-full bg-white border border-[#E9E2FA] rounded-lg px-2.5 py-1 text-xs text-[#171329] font-bold focus:border-[#7C3AED] outline-none"
                    />
                    <span className="text-xs text-[#716B82] font-bold">₦</span>
                  </div>
                </div>

                <div className="bg-[#F8F7FF] p-3 rounded-xl border border-[#E9E2FA] space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#716B82] block">
                    Price Rounding
                  </label>
                  <select
                    value={pricingSettings.pricingStyle || 'natural'}
                    onChange={e => setPricingSettings(prev => ({ ...prev, pricingStyle: e.target.value as any }))}
                    className="w-full bg-white border border-[#E9E2FA] rounded-lg px-2.5 py-1 text-xs text-[#171329] font-bold focus:border-[#7C3AED] outline-none"
                  >
                    <option value="natural">Exact Calculation (e.g. ₦1,245)</option>
                    <option value="tiered">Round to ₦50 (e.g. ₦1,250)</option>
                    <option value="clean">Round to ₦100 (e.g. ₦1,300)</option>
                  </select>
                </div>
              </div>

              {/* Service Pricing Breakdown Table & Search */}
              <div className="bg-[#F8F7FF] border border-[#E9E2FA] rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E9E2FA]">
                  <div>
                    <h3 className="text-sm font-bold text-[#171329] flex items-center gap-2">
                      <span>Services Pricing Controller & Provider Cost Breakdown</span>
                      <span className="text-[10px] bg-[#EDE9FE] text-[#7C3AED] px-2 py-0.5 rounded font-mono font-bold">
                        {services.length} Services
                      </span>
                    </h3>
                    <p className="text-[11px] text-[#716B82] mt-0.5">
                      Inspect wholesale prices from OneGridHub, calculated markups, and final customer prices.
                    </p>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#7C3AED] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search service name or ID..."
                      value={managerSearchQuery}
                      onChange={e => setManagerSearchQuery(e.target.value)}
                      className="w-full bg-white border border-[#E9E2FA] rounded-xl pl-9 pr-3 py-2 text-xs text-[#171329] placeholder-[#716B82]/50 focus:outline-none focus:border-[#7C3AED]"
                    />
                  </div>

                  <select
                    value={managerPlatformFilter}
                    onChange={e => setManagerPlatformFilter(e.target.value)}
                    className="bg-white border border-[#E9E2FA] rounded-xl px-3 py-2 text-xs text-[#171329] focus:outline-none focus:border-[#7C3AED] cursor-pointer"
                  >
                    <option value="All">All Platforms ({services.length})</option>
                    {Array.from(new Set(services.map(s => s.platform).filter(Boolean))).sort().map(p => (
                      <option key={p} value={p}>
                        {p} ({services.filter(s => s.platform === p).length})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Services List Breakdown */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {services
                    .filter(s => {
                      if (managerPlatformFilter !== 'All' && s.platform !== managerPlatformFilter) return false;
                      if (managerSearchQuery.trim()) {
                        const q = managerSearchQuery.toLowerCase();
                        return (
                          (s.name || '').toLowerCase().includes(q) ||
                          (s.platform || '').toLowerCase().includes(q) ||
                          (s.id || '').toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map(svc => {
                      const providerRate = svc.providerRatePer1000 || Math.max(0, (svc.ratePer1000 || 0) - (svc.markupPer1000 || 0));
                      const sellingRate = svc.ratePer1000 || 0;
                      const markup = svc.markupPer1000 !== undefined ? svc.markupPer1000 : Math.max(0, sellingRate - providerRate);

                      return (
                        <div 
                          key={svc.id}
                          className="bg-white border border-[#E9E2FA] hover:border-[#7C3AED]/40 p-3 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#EDE9FE] text-[#7C3AED]">
                                {svc.platform}
                              </span>
                              <span className="text-[10px] font-mono text-[#716B82]">
                                ID: {svc.id}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-[#171329] leading-snug">
                              {svc.name}
                            </h4>
                            <div className="text-[10px] text-[#716B82] flex items-center gap-2">
                              <span>Min: {svc.min?.toLocaleString()}</span>
                              <span>•</span>
                              <span>Max: {svc.max?.toLocaleString()}</span>
                            </div>
                          </div>

                          {/* 3-Step Pricing Breakdown */}
                          <div className="grid grid-cols-3 gap-2 text-center shrink-0 bg-[#F8F7FF] p-2 rounded-xl border border-[#E9E2FA] sm:w-80">
                            <div className="p-1 rounded bg-white border border-[#E9E2FA]">
                              <span className="text-[9px] text-[#716B82] block font-sans uppercase">OneGridHub</span>
                              <span className="text-xs font-mono font-bold text-[#171329]">₦{providerRate.toLocaleString()}</span>
                            </div>
                            <div className="p-1 rounded bg-white border border-amber-200">
                              <span className="text-[9px] text-amber-800 block font-sans uppercase">Markup</span>
                              <span className="text-xs font-mono font-bold text-amber-700">+₦{markup.toLocaleString()}</span>
                            </div>
                            <div className="p-1 rounded bg-white border border-emerald-200">
                              <span className="text-[9px] text-emerald-800 block font-sans uppercase">Customer</span>
                              <span className="text-xs font-mono font-bold text-[#047857]">₦{sellingRate.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ORDER CONFIGURATION MODAL / DRAWER */}
      {/* ========================================================================= */}
      {orderModalService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white border border-[#E9E2FA] rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleCloseOrderModal}
              className="absolute top-4 right-4 p-2 rounded-xl bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#171329] border border-[#E9E2FA] transition cursor-pointer"
              aria-label="Close Order Dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1.5 pr-8">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#EDE9FE] text-[#7C3AED]">
                  {orderModalService.platform}
                </span>
                <span className="text-[10px] font-bold text-[#047857] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  ₦{orderModalService.ratePer1000?.toLocaleString()} / 1,000
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#171329] leading-tight">
                {orderModalService.name}
              </h3>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              
              {/* Target Link / Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#171329] flex items-center justify-between">
                  <span>{orderModalService.inputLabel || `${orderModalService.platform} Target Link or @Username`}</span>
                  <span className="text-[10px] text-[#7C3AED] font-semibold">Required</span>
                </label>
                
                {orderModalService.inputType === 'custom_comments' ? (
                  <textarea
                    rows={3}
                    value={orderCommentsText}
                    onChange={e => setOrderCommentsText(e.target.value)}
                    placeholder={orderModalService.inputPlaceholder || 'Enter comments (1 comment per line)'}
                    className="w-full bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl p-3 text-xs text-[#171329] placeholder-[#716B82]/50 focus:outline-none focus:border-[#7C3AED] transition"
                    required
                  />
                ) : (
                  <input
                    type="text"
                    value={orderTargetUrl}
                    onChange={e => setOrderTargetUrl(e.target.value)}
                    placeholder={orderModalService.inputPlaceholder || `https://${orderModalService.platform.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/... or @username`}
                    className="w-full bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl px-3.5 py-3 text-xs text-[#171329] placeholder-[#716B82]/50 focus:outline-none focus:border-[#7C3AED] transition"
                    required
                  />
                )}
              </div>

              {/* Quantity Selector with Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#171329]">
                    Order Quantity
                  </label>
                  <span className="text-[11px] text-[#716B82] font-semibold">
                    Min: {orderModalService.min?.toLocaleString()} • Max: {orderModalService.max?.toLocaleString()}
                  </span>
                </div>

                <input
                  type="number"
                  min={orderModalService.min || 50}
                  max={orderModalService.max || 1000000}
                  step={50}
                  value={orderQuantity}
                  onChange={e => setOrderQuantity(Number(e.target.value))}
                  className="w-full bg-[#F8F7FF] border border-[#E9E2FA] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#171329] focus:outline-none focus:border-[#7C3AED] transition"
                  required
                />

                {/* Quick Add Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[100, 500, 1000, 2500, 5000, 10000].map(amt => {
                    if (amt < (orderModalService.min || 0) || amt > (orderModalService.max || 1000000)) return null;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setOrderQuantity(amt)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          orderQuantity === amt
                            ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm'
                            : 'bg-[#F8F7FF] text-[#7C3AED] border-[#E9E2FA] hover:bg-[#EDE9FE]'
                        }`}
                      >
                        +{amt.toLocaleString()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price Calculation Box */}
              <div className="bg-[#F8F7FF] border border-[#E9E2FA] rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[#716B82]">
                  <span>Selling Rate:</span>
                  <span className="font-semibold text-[#171329]">₦{orderModalService.ratePer1000?.toLocaleString()} / 1,000 units</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#716B82]">
                  <span>Selected Quantity:</span>
                  <span className="font-bold text-[#171329]">{orderQuantity.toLocaleString()} units</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#716B82]">
                  <span>Your Current Wallet:</span>
                  <span className="font-bold text-[#047857]">₦{walletBalance.toLocaleString()}</span>
                </div>

                {isOwner && (
                  <div className="mt-2 pt-2 border-t border-amber-200 bg-amber-50 p-2.5 rounded-xl text-[11px] font-mono text-amber-900 space-y-1">
                    <div className="flex items-center justify-between text-amber-800 font-bold font-sans">
                      <span>👑 Owner Pricing Breakdown</span>
                      <span className="text-[9px] bg-amber-200 px-1.5 py-0.5 rounded text-amber-900">OneGridHub</span>
                    </div>
                    <div className="flex items-center justify-between text-amber-800">
                      <span>Provider Cost (Qty: {orderQuantity.toLocaleString()}):</span>
                      <span className="text-[#171329] font-bold">
                        ₦{Math.round(((orderModalService.providerRatePer1000 || Math.max(0, (orderModalService.ratePer1000 || 0) - (orderModalService.markupPer1000 || 0))) / 1000) * orderQuantity).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-amber-800">
                      <span>Your Profit Margin:</span>
                      <span className="font-bold text-amber-700">
                        +₦{Math.max(0, calculatedPrice - Math.round(((orderModalService.providerRatePer1000 || Math.max(0, (orderModalService.ratePer1000 || 0) - (orderModalService.markupPer1000 || 0))) / 1000) * orderQuantity)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-[#E9E2FA] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#171329] uppercase tracking-wider">Total Charge:</span>
                  <span className="text-xl font-bold text-[#047857]">
                    ₦{calculatedPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Error Message with clear toast/banner alert */}
              {orderError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 shadow-sm animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <span className="font-bold block">Unable to complete order</span>
                    <span className="leading-relaxed">{orderError}</span>
                  </div>
                </div>
              )}

              {/* Success Feedback */}
              {orderSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2.5 text-xs text-emerald-900 shadow-sm animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Order Placed Successfully!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                    Order ID: <strong className="font-mono">{orderSuccess.orderId}</strong>. Processing automatically via provider gateway.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseOrderModal();
                      setActiveTab('orders');
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-center shadow-sm transition cursor-pointer"
                  >
                    View in Order History
                  </button>
                </div>
              )}

              {/* Submit / Pay Button */}
              {!orderSuccess && (
                <div className="space-y-2 pt-1">
                  {walletBalance < calculatedPrice ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseOrderModal();
                        onOpenWallet();
                      }}
                      className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>Insufficient Balance — Fund Wallet (₦{walletBalance.toLocaleString()})</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmittingOrder}
                      className="w-full py-3.5 rounded-2xl bg-[#7C3AED] hover:bg-[#5B21B6] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-[#7C3AED]/20"
                    >
                      {isSubmittingOrder ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing Boost Order...</span>
                        </>
                      ) : (
                        <>
                          <Rocket className="w-4 h-4" />
                          <span>Confirm & Place Order (₦{calculatedPrice.toLocaleString()})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
