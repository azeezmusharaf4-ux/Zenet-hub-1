import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  ChevronRight, 
  TrendingUp, 
  Wallet, 
  Search, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RefreshCw, 
  Copy, 
  Check, 
  Users, 
  Heart, 
  Eye, 
  Share2, 
  MessageSquare, 
  Bookmark,
  Zap,
  ShoppingBag,
  Settings,
  Sliders,
  Save
} from 'lucide-react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile, SocialBoostService, SocialBoostOrder } from '../types';
import { auth, db, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch, sanitizeApiErrorMessage } from '../utils/api';
import { copyToClipboard } from '../utils/clipboard';
import { isAuthorizedOwner, isAuthorizedOwnerEmail } from '../lib/authorizedOwners';

export interface TikTokServiceSetting {
  id: string;
  name: string;
  minQuantity: number;
  maxQuantity: number;
  pricePer1k: number;
}

export const SETTINGS_SERVICES_LIST = [
  { id: 'tt-followers', name: 'TikTok Followers', type: 'Followers', defaultMin: 10, defaultMax: 1000000, defaultPrice: 2400 },
  { id: 'tt-likes', name: 'TikTok Likes', type: 'Likes', defaultMin: 50, defaultMax: 500000, defaultPrice: 850 },
  { id: 'tt-comments', name: 'TikTok Comments', type: 'Comments', defaultMin: 10, defaultMax: 10000, defaultPrice: 4500 },
  { id: 'tt-shares', name: 'TikTok Shares', type: 'Shares', defaultMin: 50, defaultMax: 200000, defaultPrice: 650 },
  { id: 'tt-views', name: 'TikTok Views', type: 'Views', defaultMin: 500, defaultMax: 2000000, defaultPrice: 250 }
];

// TikTok Vector Icon Component
export const TikTokIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6 text-white" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .56.04.83.12V9.3a6.33 6.33 0 0 0-1-.08 6.26 6.26 0 1 0 6.26 6.26V9.05a8.21 8.21 0 0 0 5.02 1.74V7.33a4.84 4.84 0 0 1-1-.64z" />
  </svg>
);

// High-speed fallback TikTok services catalogue - strictly 6 verified services in exact order
const DEFAULT_TIKTOK_SERVICES: SocialBoostService[] = [
  {
    id: 'tt-followers',
    platform: 'TikTok',
    category: 'TikTok Followers',
    name: 'Real TikTok Followers',
    type: 'Followers',
    ratePer1000: 2400,
    min: 100,
    max: 50000,
    deliverySpeed: '5,000 - 10,000 / day',
    refill: true,
    quality: 'High-Retention Profile Accounts',
    description: 'Intended for genuine audience growth with steady profile followers, gradual automated delivery, and retention stability.',
    inputLabel: 'TikTok Profile Link or @Username',
    inputPlaceholder: 'https://www.tiktok.com/@username or @username',
    inputType: 'link',
    isActive: true,
    isBestValue: true
  },
  {
    id: 'tt-likes',
    platform: 'TikTok',
    category: 'TikTok Likes',
    name: 'Real TikTok Likes',
    type: 'Likes',
    ratePer1000: 850,
    min: 50,
    max: 100000,
    deliverySpeed: '20,000 - 50,000 / day',
    refill: true,
    quality: 'High-Retention Video Likes',
    description: 'Designed to deliver genuine engagement signals to your TikTok videos, enhancing post visibility and interaction.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link',
    isActive: true,
    isCheapest: true
  },
  {
    id: 'tt-comments',
    platform: 'TikTok',
    category: 'TikTok Comments',
    name: 'Real TikTok Comments',
    type: 'Comments',
    ratePer1000: 4500,
    min: 10,
    max: 2000,
    deliverySpeed: '1,000 - 3,000 / day',
    refill: false,
    quality: 'Custom Contextual Comments',
    description: 'Real custom written comments posted on your TikTok video. You define the exact comment text to maintain authentic relevance.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'custom_comments',
    isActive: true,
    isBestValue: false
  },
  {
    id: 'tt-shares',
    platform: 'TikTok',
    category: 'TikTok Shares',
    name: 'Real TikTok Shares',
    type: 'Shares',
    ratePer1000: 650,
    min: 50,
    max: 50000,
    deliverySpeed: '10,000 - 30,000 / day',
    refill: true,
    quality: 'High-Retention Shares',
    description: 'Increases the post share count to simulate genuine content redistribution across the TikTok recommendation ecosystem.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'tt-favorites',
    platform: 'TikTok',
    category: 'TikTok Favorites',
    name: 'Real TikTok Favorites',
    type: 'Favorites',
    ratePer1000: 750,
    min: 50,
    max: 50000,
    deliverySpeed: '10,000 - 25,000 / day',
    refill: true,
    quality: 'High-Retention Video Favorites',
    description: 'Authentic TikTok bookmark favorites to strengthen video recommendation signals and ranking performance.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link',
    isActive: true
  },
  {
    id: 'tt-views',
    platform: 'TikTok',
    category: 'TikTok Views',
    name: 'Real TikTok Views',
    type: 'Views',
    ratePer1000: 250,
    min: 500,
    max: 2000000,
    deliverySpeed: '50,000 - 200,000 / day',
    refill: true,
    quality: 'High-Retention Video Impressions',
    description: 'Designed to deliver organic watch-time signals and video play impressions, helping trigger natural discovery and algorithmic reach.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link',
    isActive: true,
    isBestValue: true
  }
];

export interface SocialBoostViewProps {
  user?: any;
  userProfile: UserProfile | null;
  walletBalance: number;
  onRefreshProfile?: () => Promise<void> | void;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
  onBalanceUpdated?: (newBal: number) => void;
}

export const SocialBoostView: React.FC<SocialBoostViewProps> = ({
  user,
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet,
  onOpenAuth,
  onBalanceUpdated
}) => {
  // Navigation mode: 'categories' (the initial clean TikTok category row) or 'tiktok-services' (the TikTok Boost services page)
  const [viewMode, setViewMode] = useState<'categories' | 'tiktok-services'>('categories');

  // TikTok Boost services catalogue
  const [services, setServices] = useState<SocialBoostService[]>(DEFAULT_TIKTOK_SERVICES);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // TikTok Sub-tab: 'browse' or 'orders'
  const [activeSubTab, setActiveSubTab] = useState<'browse' | 'orders'>('browse');

  // Order Placement Modal state
  const [selectedService, setSelectedService] = useState<SocialBoostService | null>(null);
  const [orderTarget, setOrderTarget] = useState<string>('');
  const [orderQuantity, setOrderQuantity] = useState<number>(1000);
  const [orderComments, setOrderComments] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<SocialBoostOrder | null>(null);

  // User Orders History state
  const [orders, setOrders] = useState<SocialBoostOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Admin authorization check
  const isAdmin = Boolean(
    isAuthorizedOwner(user, userProfile) ||
    isAuthorizedOwnerEmail(user?.email || auth.currentUser?.email || userProfile?.email) ||
    userProfile?.role === 'admin' ||
    userProfile?.role === 'owner'
  );

  // TikTok Admin Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<boolean>(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);

  const [configuredSettings, setConfiguredSettings] = useState<Record<string, TikTokServiceSetting>>({
    'tt-followers': { id: 'tt-followers', name: 'TikTok Followers', minQuantity: 10, maxQuantity: 1000000, pricePer1k: 2400 },
    'tt-likes': { id: 'tt-likes', name: 'TikTok Likes', minQuantity: 50, maxQuantity: 500000, pricePer1k: 850 },
    'tt-comments': { id: 'tt-comments', name: 'TikTok Comments', minQuantity: 10, maxQuantity: 10000, pricePer1k: 4500 },
    'tt-shares': { id: 'tt-shares', name: 'TikTok Shares', minQuantity: 50, maxQuantity: 200000, pricePer1k: 650 },
    'tt-views': { id: 'tt-views', name: 'TikTok Views', minQuantity: 500, maxQuantity: 2000000, pricePer1k: 250 }
  });

  // Apply saved settings to active services list
  const applySettingsToServices = (configMap: Record<string, TikTokServiceSetting>) => {
    if (!configMap || typeof configMap !== 'object') return;
    setServices((prev) =>
      prev.map((svc) => {
        const lower = (svc.type || svc.name || '').toLowerCase();
        let key = svc.id;
        if (!configMap[key]) {
          if (lower.includes('follower')) key = 'tt-followers';
          else if (lower.includes('like')) key = 'tt-likes';
          else if (lower.includes('comment')) key = 'tt-comments';
          else if (lower.includes('share')) key = 'tt-shares';
          else if (lower.includes('view') || lower.includes('play')) key = 'tt-views';
        }
        const cfg = configMap[key];
        if (cfg) {
          return {
            ...svc,
            min: typeof cfg.minQuantity === 'number' && cfg.minQuantity > 0 ? Number(cfg.minQuantity) : svc.min,
            max: typeof cfg.maxQuantity === 'number' && cfg.maxQuantity > 0 ? Number(cfg.maxQuantity) : svc.max,
            ratePer1000: typeof cfg.pricePer1k === 'number' && cfg.pricePer1k > 0 ? Number(cfg.pricePer1k) : svc.ratePer1000
          };
        }
        return svc;
      })
    );
  };

  // Realtime subscription to Firestore & API fallback for permanent persistence
  useEffect(() => {
    let isMounted = true;
    let unsub: (() => void) | undefined;

    try {
      if (db) {
        const docRef = doc(db, 'system_settings', 'tiktok_services_config');
        unsub = onSnapshot(docRef, (docSnap) => {
          if (isMounted && docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.services) {
              setConfiguredSettings((prev) => ({ ...prev, ...data.services }));
              applySettingsToServices(data.services);
            }
          }
        }, (err) => {
          console.warn('[TikTokBoost] Firestore snapshot notice:', err.message);
        });
      }
    } catch (err) {
      console.warn('[TikTokBoost] Setup snapshot notice:', err);
    }

    // API fetch fallback
    safeApiFetch('/api/tiktok-services/settings').then((res: any) => {
      if (isMounted && res && res.success && res.services) {
        setConfiguredSettings((prev) => ({ ...prev, ...res.services }));
        applySettingsToServices(res.services);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, []);

  // Save TikTok Settings Handler
  const handleSaveTikTokSettings = async () => {
    setIsSavingSettings(true);
    setSettingsSaveSuccess(false);
    setSettingsSaveError(null);

    try {
      // Validate all services
      for (const svcDef of SETTINGS_SERVICES_LIST) {
        const item = configuredSettings[svcDef.id];
        if (!item || Number(item.minQuantity) <= 0 || Number(item.maxQuantity) <= 0 || Number(item.pricePer1k) <= 0) {
          throw new Error(`Please enter valid positive numbers for ${svcDef.name}.`);
        }
        if (Number(item.minQuantity) > Number(item.maxQuantity)) {
          throw new Error(`Minimum quantity cannot exceed maximum quantity for ${svcDef.name}.`);
        }
      }

      const token = await getSafeIdToken(auth.currentUser);

      // 1. Direct Firestore setDoc if authenticated as admin
      if (db) {
        try {
          const docRef = doc(db, 'system_settings', 'tiktok_services_config');
          await setDoc(docRef, {
            services: configuredSettings,
            updatedAt: new Date().toISOString(),
            updatedBy: user?.email || auth.currentUser?.email || 'admin'
          }, { merge: true });
        } catch (dbErr) {
          console.warn('[TikTokBoost] Direct Firestore setDoc notice, using server API:', dbErr);
        }
      }

      // 2. Server API POST with admin token (ensures backend persistence)
      const res: any = await safeApiFetch('/api/tiktok-services/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ services: configuredSettings })
      });

      if (!res || !res.success) {
        throw new Error(res?.error || 'Failed to save TikTok settings on server.');
      }

      // 3. Immediately apply to active services
      applySettingsToServices(configuredSettings);

      setSettingsSaveSuccess(true);
      setTimeout(() => {
        setSettingsSaveSuccess(false);
        setIsSettingsOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Error saving TikTok settings:', err);
      setSettingsSaveError(sanitizeApiErrorMessage(err.message || 'Failed to save settings. Please verify admin privileges.'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Fetch TikTok services from backend
  useEffect(() => {
    let isMounted = true;
    const loadServices = async () => {
      setIsLoadingServices(true);
      try {
        const callerEmail = user?.email || userProfile?.email || '';
        const endpoint = `/api/social-boost/services?action=services&callerEmail=${encodeURIComponent(callerEmail)}`;
        const res: any = await safeApiFetch(endpoint);
        if (isMounted && res && res.success && Array.isArray(res.services)) {
          const apiServices = res.services;
          const usedProviderIds = new Set<string>();

          const updatedCanonical = DEFAULT_TIKTOK_SERVICES.map(canonical => {
            const lowerCanonicalType = (canonical.type || '').toLowerCase();
            const match = apiServices.find((s: SocialBoostService) => {
              if (s.id && usedProviderIds.has(s.id)) return false;
              const isTikTok = s.platform === 'TikTok' || 
                (s.category && s.category.toLowerCase().includes('tiktok')) ||
                (s.name && s.name.toLowerCase().includes('tiktok'));
              if (!isTikTok) return false;
              const combined = `${s.name || ''} ${s.category || ''} ${s.type || ''}`.toLowerCase();
              if (lowerCanonicalType === 'followers') return combined.includes('follower');
              if (lowerCanonicalType === 'likes') return combined.includes('like') && !combined.includes('favorite') && !combined.includes('save') && !combined.includes('comment') && !combined.includes('share');
              if (lowerCanonicalType === 'comments') return combined.includes('comment');
              if (lowerCanonicalType === 'shares') return combined.includes('share') || combined.includes('repost');
              if (lowerCanonicalType === 'favorites') return combined.includes('favorite') || combined.includes('save') || combined.includes('bookmark');
              if (lowerCanonicalType === 'views') return combined.includes('view') || combined.includes('play');
              return false;
            });
            if (match) {
              if (match.id) usedProviderIds.add(match.id);
              return {
                ...canonical,
                id: canonical.id, // Strictly preserve unique canonical ID to prevent duplicate keys
                providerServiceId: match.providerServiceId || match.id,
                ratePer1000: match.ratePer1000 || match.pricePerThousandNgn || canonical.ratePer1000,
                min: match.min || canonical.min,
                max: match.max || canonical.max,
                deliverySpeed: match.deliverySpeed || canonical.deliverySpeed,
              };
            }
            return canonical;
          });
          setServices(updatedCanonical);
        }
      } catch (err) {
        console.warn('[TikTokBoost] Live services fetch notice, using base catalogue:', err);
      } finally {
        if (isMounted) setIsLoadingServices(false);
      }
    };

    loadServices();
    return () => { isMounted = false; };
  }, [user?.email, userProfile?.email]);

  // Fetch User's TikTok Orders
  const fetchOrders = async () => {
    if (!auth.currentUser) return;
    setIsLoadingOrders(true);
    try {
      const res: any = await safeApiFetch(`/api/social-boost/orders?action=orders&userId=${encodeURIComponent(auth.currentUser.uid)}`);
      if (res && res.success && Array.isArray(res.orders)) {
        // Filter TikTok orders
        const tiktokOrders = res.orders.filter((o: SocialBoostOrder) => 
          !o.platform || o.platform === 'TikTok' || (o.serviceName && o.serviceName.toLowerCase().includes('tiktok'))
        );
        setOrders(tiktokOrders);
      }
    } catch (err) {
      console.warn('[TikTokBoost] Orders fetch notice:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'orders' || orderSuccess) {
      fetchOrders();
    }
  }, [activeSubTab, orderSuccess]);

  // Open Order Modal for a selected service
  const handleOpenOrderModal = (service: SocialBoostService) => {
    setSelectedService(service);
    setOrderTarget('');
    // Default quantity clamped to service min
    const initialQty = Math.max(service.min, Math.min(1000, service.max));
    setOrderQuantity(initialQty);
    setOrderComments('');
    setOrderError(null);
  };

  // Close Order Modal
  const handleCloseOrderModal = () => {
    setSelectedService(null);
    setOrderError(null);
  };

  // Calculate live order total cost
  const calculatedCost = useMemo(() => {
    if (!selectedService) return 0;
    const rate = selectedService.ratePer1000 || selectedService.pricePerThousandNgn || 1000;
    const qty = Math.max(0, orderQuantity || 0);
    return Math.max(1, Math.round((qty / 1000) * rate));
  }, [selectedService, orderQuantity]);

  // Handle Order Submission
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    if (!user && !auth.currentUser) {
      if (onOpenAuth) onOpenAuth('login');
      return;
    }

    const cleanTarget = orderTarget.trim();
    if (!cleanTarget) {
      setOrderError(selectedService.inputLabel || 'Please provide your TikTok link or username.');
      return;
    }

    if (orderQuantity < selectedService.min || orderQuantity > selectedService.max) {
      setOrderError(`Quantity must be between ${selectedService.min.toLocaleString()} and ${selectedService.max.toLocaleString()}.`);
      return;
    }

    if (walletBalance < calculatedCost) {
      setOrderError(`Insufficient wallet balance. You need ₦${(calculatedCost - walletBalance).toLocaleString()} more.`);
      return;
    }

    setIsSubmittingOrder(true);
    setOrderError(null);

    try {
      const token = await getSafeIdToken(auth.currentUser);
      if (!token) {
        throw new Error('Please sign in again to place an order.');
      }

      const payload = {
        serviceId: selectedService.id,
        target: cleanTarget,
        link: cleanTarget,
        quantity: orderQuantity,
        amountNgn: calculatedCost,
        totalCost: calculatedCost,
        comments: selectedService.inputType === 'custom_comments' ? orderComments : undefined
      };

      const data: any = await safeApiFetch('/api/social-boost/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...payload, action: 'order' })
      });

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to place TikTok boost order.');
      }

      const newOrder: SocialBoostOrder = data.order || {
        id: data.orderId || `tt-${Date.now()}`,
        serviceName: selectedService.name,
        target: cleanTarget,
        quantity: orderQuantity,
        charge: calculatedCost,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      setOrderSuccess(newOrder);
      setSelectedService(null);

      // Deduct balance locally
      const updatedBalance = Math.max(0, walletBalance - calculatedCost);
      if (onBalanceUpdated) {
        onBalanceUpdated(updatedBalance);
      }
      if (onRefreshProfile) {
        await onRefreshProfile();
      }
      fetchOrders();
    } catch (err: any) {
      console.error('[TikTokBoost] Order Error:', err);
      setOrderError(sanitizeApiErrorMessage(err.message || 'Failed to process TikTok boost order.'));
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Filtered services for TikTok Services Page - STRICTLY the 6 Real TikTok Services
  const filteredServices = useMemo(() => {
    return services
      .filter(service => {
        // Enforce customer-facing restriction: ONLY Followers, Likes, Comments, Shares, Favorites, Views
        const lowerName = (service.name || '').toLowerCase();
        const lowerCat = (service.category || '').toLowerCase();
        const lowerType = (service.type || '').toLowerCase();
        const combined = `${lowerName} ${lowerCat} ${lowerType}`;

        const isFollowers = combined.includes('follower');
        const isLikes = combined.includes('like');
        const isComments = combined.includes('comment');
        const isShares = combined.includes('share') || combined.includes('repost');
        const isFavorites = combined.includes('favorite') || combined.includes('save') || combined.includes('bookmark');
        const isViews = combined.includes('view') || combined.includes('play');

        // Discard any other unrelated/extra options
        if (!isFollowers && !isLikes && !isComments && !isShares && !isFavorites && !isViews) {
          return false;
        }

        // Active type filter pill
        if (activeTypeFilter === 'Followers' && !isFollowers) return false;
        if (activeTypeFilter === 'Likes' && !isLikes) return false;
        if (activeTypeFilter === 'Comments' && !isComments) return false;
        if (activeTypeFilter === 'Shares' && !isShares) return false;
        if (activeTypeFilter === 'Favorites' && !isFavorites) return false;
        if (activeTypeFilter === 'Views' && !isViews) return false;

        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const desc = (service.description || '').toLowerCase();
          if (!lowerName.includes(query) && !lowerCat.includes(query) && !desc.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .map(service => {
        // Guarantee clear and honest engagement descriptions
        const lower = `${service.name || ''} ${service.category || ''} ${service.type || ''}`.toLowerCase();
        let honestDesc = service.description;

        if (lower.includes('follower')) {
          honestDesc = 'Intended for genuine audience growth with steady profile followers, gradual automated delivery, and retention stability.';
        } else if (lower.includes('like')) {
          honestDesc = 'Designed to deliver genuine engagement signals to your TikTok videos, enhancing post visibility and interaction.';
        } else if (lower.includes('comment')) {
          honestDesc = 'Real custom written comments posted on your TikTok video. You define the exact comment text to maintain authentic relevance.';
        } else if (lower.includes('share') || lower.includes('repost')) {
          honestDesc = 'Increases the post share count to simulate genuine content redistribution across the TikTok recommendation ecosystem.';
        } else if (lower.includes('favorite') || lower.includes('save') || lower.includes('bookmark')) {
          honestDesc = 'Authentic TikTok bookmark favorites to strengthen video recommendation signals and ranking performance.';
        } else if (lower.includes('view') || lower.includes('play')) {
          honestDesc = 'Designed to deliver organic watch-time signals and video play impressions, helping trigger natural discovery and algorithmic reach.';
        }

        return {
          ...service,
          description: honestDesc
        };
      });
  }, [services, activeTypeFilter, searchQuery]);

  // Copy handler
  const handleCopy = (text: string, id: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for type badges
  const getTypeIcon = (type?: string) => {
    const lower = (type || '').toLowerCase();
    if (lower.includes('follower')) return <Users className="w-3.5 h-3.5 text-purple-600" />;
    if (lower.includes('like')) return <Heart className="w-3.5 h-3.5 text-rose-500" />;
    if (lower.includes('comment')) return <MessageSquare className="w-3.5 h-3.5 text-amber-500" />;
    if (lower.includes('share') || lower.includes('repost')) return <Share2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (lower.includes('favorite') || lower.includes('save') || lower.includes('bookmark')) return <Bookmark className="w-3.5 h-3.5 text-pink-500" />;
    if (lower.includes('view') || lower.includes('play')) return <Eye className="w-3.5 h-3.5 text-blue-500" />;
    return <Zap className="w-3.5 h-3.5 text-indigo-500" />;
  };

  // Helper to render the Settings Modal
  const renderTikTokSettingsModal = () => {
    if (!isSettingsOpen) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div
          className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center shrink-0">
                <span className="text-lg">⚙️</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-[#0F172A]">
                    TikTok Services Settings
                  </h3>
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
                    Admin Controls
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#64748B]">
                  Configure minimum, maximum, and amount per 1,000 for each TikTok service.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success / Error Notification */}
          {settingsSaveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>TikTok settings saved permanently to the database!</span>
            </div>
          )}

          {settingsSaveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{settingsSaveError}</span>
            </div>
          )}

          {/* Services List to Configure */}
          <div className="overflow-y-auto space-y-3 pr-1 flex-1 py-1">
            {SETTINGS_SERVICES_LIST.map((svcDef) => {
              const cfg = configuredSettings[svcDef.id] || {
                id: svcDef.id,
                name: svcDef.name,
                minQuantity: svcDef.defaultMin,
                maxQuantity: svcDef.defaultMax,
                pricePer1k: svcDef.defaultPrice
              };

              return (
                <div
                  key={svcDef.id}
                  className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl sm:rounded-2xl p-3.5 space-y-2.5 transition hover:border-[#7C3AED]/30"
                >
                  {/* Service Title & Icon */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-2xs">
                        {getTypeIcon(svcDef.type)}
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                        {svcDef.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#64748B]">
                      Amount: <strong className="text-[#7C3AED]">₦{(Number(cfg.pricePer1k) || 0).toLocaleString()}</strong> / 1,000
                    </span>
                  </div>

                  {/* Editable Fields Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Min Quantity */}
                    <div>
                      <label className="text-[10px] font-bold text-[#475569] block mb-1">
                        Minimum
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={cfg.minQuantity}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setConfiguredSettings((prev) => ({
                            ...prev,
                            [svcDef.id]: {
                              ...cfg,
                              minQuantity: val
                            }
                          }));
                        }}
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#0F172A] focus:outline-hidden focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/30"
                      />
                    </div>

                    {/* Max Quantity */}
                    <div>
                      <label className="text-[10px] font-bold text-[#475569] block mb-1">
                        Maximum
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={cfg.maxQuantity}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setConfiguredSettings((prev) => ({
                            ...prev,
                            [svcDef.id]: {
                              ...cfg,
                              maxQuantity: val
                            }
                          }));
                        }}
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#0F172A] focus:outline-hidden focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/30"
                      />
                    </div>

                    {/* Price Per 1k */}
                    <div>
                      <label className="text-[10px] font-bold text-[#475569] block mb-1">
                        Amount / 1,000 (₦)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={cfg.pricePer1k}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setConfiguredSettings((prev) => ({
                            ...prev,
                            [svcDef.id]: {
                              ...cfg,
                              pricePer1k: val
                            }
                          }));
                        }}
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-xs font-mono font-black text-[#7C3AED] focus:outline-hidden focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/30"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSavingSettings}
              onClick={handleSaveTikTokSettings}
              className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs hover:shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              {isSavingSettings ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save TikTok Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // VIEW 1: CLEAN TIKTOK CATEGORY ROW (REPLACES MAINTENANCE SCREEN ENTIRELY)
  // =========================================================================
  if (viewMode === 'categories') {
    return (
      <div className="w-full max-w-3xl mx-auto py-6 sm:py-10 px-4 sm:px-6 animate-in fade-in duration-150">
        {/* Top Back Navigation to Marketplace & Settings */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <button
            type="button"
            onClick={onBackToMarketplace}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isAdmin) {
                setIsSettingsOpen(true);
              } else {
                alert('Access restricted: Only authorized admins can configure TikTok settings.');
              }
            }}
            title="TikTok Services Settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 text-[#0F172A] hover:text-[#7C3AED] border border-[#E2E8F0] hover:border-[#7C3AED]/40 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
          >
            <span className="text-sm leading-none">⚙️</span>
            <span>Settings</span>
          </button>
        </div>

        {/* Header Section */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-[#7C3AED] border border-purple-200 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Social Boost Services</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
            Social Boost
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] font-medium mt-1">
            Select a platform below to supercharge your social media growth and viral reach.
          </p>
        </div>

        {/* Clean TikTok Category Row Card */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setViewMode('tiktok-services')}
            className="w-full bg-white hover:bg-[#FDFCFE] border border-[#E2E8F0] hover:border-[#7C3AED]/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between group cursor-pointer text-left focus:outline-hidden focus:ring-2 focus:ring-[#7C3AED]/20"
          >
            <div className="flex items-center gap-3.5 sm:gap-4">
              {/* TikTok Icon */}
              <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform duration-200">
                <TikTokIcon className="w-6 h-6 text-white" />
              </div>

              {/* Title & Description */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-[#0F172A] tracking-tight group-hover:text-[#7C3AED] transition-colors">
                    TikTok
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                    Active
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#64748B] font-medium mt-0.5">
                  Followers, Likes, Views, Comments & Shares
                </p>
              </div>
            </div>

            {/* Right arrow / chevron */}
            <div className="w-9 h-9 rounded-full bg-[#F8FAFC] group-hover:bg-[#EDE9FE] flex items-center justify-center text-[#94A3B8] group-hover:text-[#7C3AED] transition-colors shrink-0">
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
        </div>

        {/* Render TikTok Admin Settings Modal if open */}
        {renderTikTokSettingsModal()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: TIKTOK BOOST SERVICES PAGE
  // =========================================================================
  return (
    <div className="w-full max-w-5xl mx-auto py-6 sm:py-8 px-4 sm:px-6 animate-in fade-in duration-150">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => setViewMode('categories')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Platforms</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* User Wallet Balance Badge */}
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Wallet className="w-4 h-4 text-[#7C3AED]" />
            <span className="text-xs text-[#64748B] font-medium">Balance:</span>
            <span className="text-xs sm:text-sm font-black text-[#0F172A]">
              ₦{walletBalance.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={onOpenWallet}
              className="text-[10px] sm:text-xs font-black bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-2 py-0.5 rounded-md transition cursor-pointer ml-1"
            >
              + Top Up
            </button>
          </div>

          {/* ⚙️ Small Settings Button at top-right */}
          <button
            type="button"
            onClick={() => {
              if (isAdmin) {
                setIsSettingsOpen(true);
              } else {
                alert('Access restricted: Only authorized admins can configure TikTok settings.');
              }
            }}
            title="TikTok Services Settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 text-[#0F172A] hover:text-[#7C3AED] border border-[#E2E8F0] hover:border-[#7C3AED]/40 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
          >
            <span className="text-sm leading-none">⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 mb-6 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black flex items-center justify-center text-white shrink-0 shadow-sm">
              <TikTokIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                  TikTok Boost Services
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
                  Instant Start
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] font-medium mt-0.5">
                Boost your TikTok profile with real follower growth, genuine post likes, organic video views, authentic comments, and distribution shares.
              </p>
            </div>
          </div>

          {/* Subtabs: Browse Services vs My Orders */}
          <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('browse')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'browse'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Browse Services
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('orders')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'orders'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>My Orders</span>
              {orders.length > 0 && (
                <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full text-[10px] font-black">
                  {orders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ======================= SUBTAB: BROWSE SERVICES ======================= */}
      {activeSubTab === 'browse' && (
        <div className="space-y-4">
          {/* Controls: Search and Filter Pills */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search TikTok services (Followers, Likes, Comments, Shares, Favorites, Views)..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#7C3AED] focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['All', 'Followers', 'Likes', 'Comments', 'Shares', 'Favorites', 'Views'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveTypeFilter(filter)}
                  className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer ${
                    activeTypeFilter === filter
                      ? 'bg-[#7C3AED] text-white shadow-xs'
                      : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A]'
                  }`}
                >
                  {filter}
                </button>
              ))}
              <span className="text-[11px] text-[#94A3B8] ml-auto shrink-0 font-medium hidden sm:inline">
                {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'} available
              </span>
            </div>
          </div>

          {/* Services List */}
          {isLoadingServices ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 text-[#7C3AED] animate-spin mb-3" />
              <p className="text-sm font-semibold text-[#64748B]">Loading verified TikTok services...</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center flex flex-col items-center justify-center">
              <AlertCircle className="w-8 h-8 text-[#94A3B8] mb-2" />
              <h3 className="text-base font-bold text-[#0F172A]">No TikTok services found</h3>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                Try searching with a different keyword or resetting your filter.
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setActiveTypeFilter('All'); }}
                className="mt-4 px-4 py-2 bg-purple-50 text-[#7C3AED] font-bold text-xs rounded-xl hover:bg-purple-100 transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredServices.map((service, index) => {
                const rate = service.ratePer1000 || service.pricePerThousandNgn || 1000;
                return (
                  <div
                    key={`${service.id}-${index}`}
                    className="bg-white border border-[#E2E8F0] hover:border-[#7C3AED]/40 rounded-xl sm:rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4"
                  >
                    {/* Service Info */}
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-[10px] sm:text-[11px] font-bold text-[#475569]">
                          {getTypeIcon(service.type || service.category)}
                          <span>{service.type || service.category || 'TikTok'}</span>
                        </span>
                        {service.isBestValue && (
                          <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                            Best Value
                          </span>
                        )}
                        {service.isCheapest && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                            Cheapest
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs sm:text-sm font-extrabold text-[#0F172A] leading-tight">
                        {service.name}
                      </h3>

                      {service.description && (
                        <p className="text-[11px] text-[#64748B] line-clamp-1 leading-normal">
                          {service.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 sm:gap-2.5 text-[10px] sm:text-[11px] text-[#64748B] pt-0.5 flex-wrap">
                        <span>Min: <strong className="text-[#0F172A]">{service.min.toLocaleString()}</strong></span>
                        <span>•</span>
                        <span>Max: <strong className="text-[#0F172A]">{service.max.toLocaleString()}</strong></span>
                        {service.deliverySpeed && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-purple-700 font-medium">
                              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              <span>{service.deliverySpeed}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Price and Action Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F1F5F9]">
                      <div className="text-left sm:text-right">
                        <div className="text-sm sm:text-base font-black text-[#7C3AED]">
                          ₦{rate.toLocaleString()}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">
                          per 1,000 units
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenOrderModal(service)}
                        className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-black rounded-xl shadow-xs hover:shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-98"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                        <span>Boost Now</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================= SUBTAB: MY ORDERS ======================= */}
      {activeSubTab === 'orders' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0F172A]">My TikTok Boost Orders</h2>
            <button
              type="button"
              onClick={fetchOrders}
              disabled={isLoadingOrders}
              className="inline-flex items-center gap-1.5 text-xs text-[#7C3AED] hover:text-[#6D28D9] font-bold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {!user ? (
            <div className="text-center py-8">
              <p className="text-xs sm:text-sm text-[#64748B] mb-3">Please sign in to view your TikTok boost order history.</p>
              <button
                type="button"
                onClick={() => onOpenAuth && onOpenAuth('login')}
                className="px-4 py-2 bg-[#7C3AED] text-white text-xs font-bold rounded-xl"
              >
                Log In
              </button>
            </div>
          ) : isLoadingOrders ? (
            <div className="text-center py-8">
              <RefreshCw className="w-5 h-5 text-[#7C3AED] animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#64748B]">Loading your orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingBag className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-bold text-[#0F172A]">No TikTok orders placed yet</p>
              <p className="text-xs text-[#64748B] mt-1">Select any service from the Browse tab to place your first boost!</p>
              <button
                type="button"
                onClick={() => setActiveSubTab('browse')}
                className="mt-3 px-4 py-2 bg-purple-50 text-[#7C3AED] text-xs font-bold rounded-xl hover:bg-purple-100"
              >
                Browse TikTok Services
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Cost</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {orders.map((ord, ordIdx) => {
                    const statusStr = (ord.status || 'pending').toLowerCase();
                    const statusBg = 
                      statusStr === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      statusStr === 'in_progress' || statusStr === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      statusStr === 'canceled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-amber-50 text-amber-700 border-amber-200';

                    return (
                      <tr key={`${ord.id || 'ord'}-${ordIdx}`} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-3 font-mono font-bold text-[#0F172A]">
                          #{ord.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="py-3 px-3 font-medium text-[#0F172A] max-w-[200px] truncate">
                          {ord.serviceName || 'TikTok Boost'}
                        </td>
                        <td className="py-3 px-3 text-[#64748B] max-w-[150px] truncate">
                          {ord.target || ord.targetUrl || ord.link || '-'}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#0F172A]">
                          {Number(ord.quantity || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-bold text-[#7C3AED]">
                          ₦{Number(ord.charge || ord.totalChargeNgn || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${statusBg}`}>
                            {ord.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================= ORDER MODAL ======================= */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-white border border-[#E2E8F0] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white shrink-0">
                  <TikTokIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#0F172A]">
                    Place TikTok Boost Order
                  </h3>
                  <span className="text-[11px] text-[#64748B] font-medium">
                    Instant automated fulfillment
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseOrderModal}
                className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] rounded-full hover:bg-[#F1F5F9] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitOrder} className="p-5 sm:p-6 space-y-4">
              {/* Selected Service Card */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#7C3AED]">{selectedService.type || selectedService.category}</span>
                  <span className="font-black text-[#0F172A]">
                    ₦{(selectedService.ratePer1000 || selectedService.pricePerThousandNgn || 1000).toLocaleString()} / 1,000
                  </span>
                </div>
                <div className="text-xs font-semibold text-[#0F172A] leading-tight">
                  {selectedService.name}
                </div>
                <div className="text-[11px] text-[#64748B]">
                  Min: {selectedService.min.toLocaleString()} • Max: {selectedService.max.toLocaleString()}
                </div>
              </div>

              {/* Target Link or Username Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#0F172A]">
                  {selectedService.inputLabel || 'TikTok Profile URL or Video URL'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={orderTarget}
                  onChange={(e) => setOrderTarget(e.target.value)}
                  placeholder={selectedService.inputPlaceholder || 'https://www.tiktok.com/@username/video/...'}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#7C3AED] focus:bg-white transition"
                />
                <p className="text-[11px] text-[#64748B]">
                  Ensure profile or video is public before submitting.
                </p>
              </div>

              {/* Quantity Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#0F172A]">
                    Quantity <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-[#64748B]">
                    Min: {selectedService.min} • Max: {selectedService.max.toLocaleString()}
                  </span>
                </div>
                <input
                  type="number"
                  required
                  min={selectedService.min}
                  max={selectedService.max}
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Number(e.target.value))}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] focus:outline-hidden focus:border-[#7C3AED] focus:bg-white transition font-mono font-bold"
                />

                {(orderQuantity < selectedService.min || orderQuantity > selectedService.max) && (
                  <p className="text-[11px] text-rose-600 font-semibold">
                    Quantity must be between {selectedService.min.toLocaleString()} and {selectedService.max.toLocaleString()}
                  </p>
                )}

                {/* Quick Quantity Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[selectedService.min, 500, 1000, 5000, 10000]
                    .filter((q) => q >= selectedService.min && q <= selectedService.max)
                    .map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setOrderQuantity(q)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] transition cursor-pointer"
                      >
                        +{q.toLocaleString()}
                      </button>
                    ))}
                </div>
              </div>

              {/* Custom Comments textarea if required */}
              {selectedService.inputType === 'custom_comments' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#0F172A]">
                    Custom Comments (1 per line) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={orderComments}
                    onChange={(e) => setOrderComments(e.target.value)}
                    placeholder="Enter each comment on a new line..."
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] focus:outline-hidden focus:border-[#7C3AED] focus:bg-white transition"
                  />
                </div>
              )}

              {/* Total Calculation & Wallet Check */}
              <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium">Calculated Price:</span>
                  <span className="text-base sm:text-lg font-black text-[#7C3AED]">
                    ₦{calculatedCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-purple-200/60">
                  <span className="text-[#64748B] font-medium">Your Wallet Balance:</span>
                  <span className="font-bold text-[#0F172A]">
                    ₦{walletBalance.toLocaleString()}
                  </span>
                </div>

                {walletBalance < calculatedCost && (
                  <div className="pt-2 text-[11px] text-amber-700 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Insufficient balance. You need ₦{(calculatedCost - walletBalance).toLocaleString()} more to place this boost.
                    </span>
                  </div>
                )}
              </div>

              {/* Error banner */}
              {orderError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{orderError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2">
                {!user ? (
                  <button
                    type="button"
                    onClick={() => { handleCloseOrderModal(); onOpenAuth?.('login'); }}
                    className="w-full py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Log In to Order
                  </button>
                ) : walletBalance < calculatedCost ? (
                  <button
                    type="button"
                    onClick={() => { handleCloseOrderModal(); onOpenWallet(); }}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Top Up Wallet (₦{calculatedCost.toLocaleString()})</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmittingOrder}
                    className="w-full py-3 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-purple-300 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmittingOrder ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Fulfilling TikTok Boost...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current" />
                        <span>Confirm & Place Order (₦{calculatedCost.toLocaleString()})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= ORDER SUCCESS MODAL ======================= */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <div>
              <h3 className="text-lg font-black text-[#0F172A]">
                TikTok Boost Order Placed!
              </h3>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                Your order has been queued for automated delivery.
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 text-xs space-y-2 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Order ID:</span>
                <span className="font-mono font-bold text-[#0F172A]">#{orderSuccess.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Service:</span>
                <span className="font-semibold text-[#0F172A] truncate max-w-[200px]">{orderSuccess.serviceName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Quantity:</span>
                <span className="font-bold text-[#0F172A]">{Number(orderSuccess.quantity).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Amount Paid:</span>
                <span className="font-bold text-[#7C3AED]">₦{Number(orderSuccess.charge).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Status:</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                  {orderSuccess.status || 'Processing'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setOrderSuccess(null); setActiveSubTab('orders'); }}
                className="flex-1 py-2.5 bg-purple-50 hover:bg-purple-100 text-[#7C3AED] font-bold text-xs rounded-xl transition cursor-pointer"
              >
                View in Orders
              </button>
              <button
                type="button"
                onClick={() => setOrderSuccess(null)}
                className="flex-1 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Render TikTok Admin Settings Modal if open */}
      {renderTikTokSettingsModal()}
    </div>
  );
};
