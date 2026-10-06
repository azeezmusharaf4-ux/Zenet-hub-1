import express from 'express';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { isAuthorizedOwnerEmail, isAuthorizedOwnerUid } from '../lib/authorizedOwners';

// ============================================================================
// VOIKER BOOSTING GATEWAY & SERVICE INTEGRATION (VOIKER.COM SMM API V2)
// ============================================================================

export interface VoikerConfig {
  apiKey: string;
  baseUrl: string;
  usdToNgnRate: number;
  hasApiKey: boolean;
}

export interface VoikerPricingSettings {
  defaultMarkupPercent: number;
  minMarkupPer1k: number;
  usdToNgnRate: number;
  pricingStyle: 'natural' | 'clean' | 'tiered';
  platformStatus: Record<string, boolean>;
  disabledServices: string[];
  curatedServiceIds: string[];
  bestValueServiceIds: Record<string, string>;
  serviceOverrides: Record<string, {
    customRatePer1000?: number;
    customMarkupPercent?: number;
    enabled?: boolean;
    isBestValue?: boolean;
  }>;
}

let cachedPricingSettings: VoikerPricingSettings = {
  defaultMarkupPercent: 0,
  minMarkupPer1k: 0,
  usdToNgnRate: 1650,
  pricingStyle: 'natural',
  platformStatus: {
    TikTok: true,
    Instagram: true,
    Facebook: true,
    YouTube: true,
    'Twitter / X': true,
    Telegram: true,
    Spotify: true,
    WhatsApp: true,
    Threads: true,
    Discord: true,
    LinkedIn: true,
    'Twitch & Streaming': true,
    Snapchat: true,
    Reddit: true,
    Pinterest: true
  },
  disabledServices: [],
  curatedServiceIds: [],
  bestValueServiceIds: {},
  serviceOverrides: {}
};

// In-memory cache for live Voiker services
let cachedVoikerServices: any[] = [];
let lastVoikerSyncTime: string | null = null;
let activeVoikerSyncPromise: Promise<any[]> | null = null;

// User purchase idempotency locks
const userOrderLocks = new Map<string, number>();

// Helper: Get Voiker API configuration securely from server environment
export const getVoikerConfig = (): VoikerConfig => {
  const apiKey = (process.env.VOIKER_API_KEY || '').trim();
  const baseUrl = (process.env.VOIKER_BASE_URL || 'https://voiker.com/api/v2').trim().replace(/\/+$/, '');
  const usdToNgnRate = Number(process.env.USD_TO_NGN_RATE) || cachedPricingSettings.usdToNgnRate || 1650;
  return {
    apiKey,
    baseUrl,
    usdToNgnRate,
    hasApiKey: Boolean(apiKey)
  };
};

// Generic upstream client for Voiker SMM API v2
export const queryVoikerApi = async (
  action: string,
  params: Record<string, any> = {},
  timeoutMs: number = 10000,
  method: 'POST' | 'GET' = 'POST'
): Promise<any> => {
  const { apiKey, baseUrl, hasApiKey } = getVoikerConfig();

  if (!hasApiKey && action !== 'quickSearch') {
    return { error: 'VOIKER_API_KEY is not configured in server environment.' };
  }

  const queryParams: Record<string, string> = {
    key: apiKey,
    action,
    ...Object.entries(params).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null) acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>)
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    if (method === 'GET') {
      const url = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
      res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ZENET-HUB-Voiker-Client/1.0'
        },
        signal: controller.signal
      });
    } else {
      const formBody = new URLSearchParams(queryParams).toString();
      res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'ZENET-HUB-Voiker-Client/1.0'
        },
        body: formBody,
        signal: controller.signal
      });
    }

    const text = await res.text();
    clearTimeout(timeoutId);

    try {
      return JSON.parse(text);
    } catch {
      return { raw: text, status: res.status };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Voiker API request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  }
};

// Helper: Format Voiker categories to clean display titles matching account dashboard
export const formatVoikerCategoryName = (cat: string): string => {
  const c = String(cat || '').trim();
  const lower = c.toLowerCase();
  if (lower === 'tiktok-views') return 'TikTok Views';
  if (lower === 'tiktok-likes') return 'TikTok Likes';
  if (lower === 'tiktok-followers') return 'TikTok Followers';
  if (lower === 'tiktok-shares') return 'TikTok Shares';
  if (lower === 'tiktok-saves') return 'TikTok Saves';
  if (lower === 'tiktok-downloads') return 'TikTok Downloads';
  if (lower === 'tiktok-comments') return 'TikTok Comments';
  if (lower === 'tiktok-live-likes-shares-comments') return 'TikTok Live Likes / Shares / Comments';
  if (lower === 'tiktok-live-stream-v3' || lower === 'tiktok-live-stream-views') return 'TikTok Live Stream Views';
  if (lower === 'tiktok-pk-battle-points') return 'TikTok PK Battle Points';

  // Format hyphenated slugs
  if (c.includes('-')) {
    return c
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
      .replace(/\bV\d+\b/gi, '')
      .trim();
  }
  return c;
};

// Helper: Extract platform from category or service name
export const extractPlatformFromVoiker = (category: string, name: string): string => {
  const combined = `${category || ''} ${name || ''}`.toLowerCase();

  if (combined.includes('tiktok') || combined.includes('tik tok') || combined.includes('douyin')) return 'TikTok';
  if (combined.includes('instagram') || combined.includes('ig ') || combined.includes(' insta') || combined.includes('reels')) return 'Instagram';
  if (combined.includes('facebook') || combined.includes('fb ') || combined.includes('meta')) return 'Facebook';
  if (combined.includes('youtube') || combined.includes('yt ') || combined.includes('shorts') || combined.includes('subscribers')) return 'YouTube';
  if (combined.includes('twitter') || combined.includes(' x ') || combined.includes('x.com') || combined.includes('tweet')) return 'Twitter / X';
  if (combined.includes('telegram') || combined.includes('tg ') || combined.includes('t.me')) return 'Telegram';
  if (combined.includes('whatsapp') || combined.includes('wa ')) return 'WhatsApp';
  if (combined.includes('spotify') || combined.includes('soundcloud') || combined.includes('audiomack') || combined.includes('music')) return 'Spotify & Music';
  if (combined.includes('threads')) return 'Threads';
  if (combined.includes('discord')) return 'Discord';
  if (combined.includes('linkedin')) return 'LinkedIn';
  if (combined.includes('twitch') || combined.includes('kick') || combined.includes('stream')) return 'Twitch & Streaming';
  if (combined.includes('snapchat')) return 'Snapchat';
  if (combined.includes('reddit')) return 'Reddit';
  if (combined.includes('pinterest')) return 'Pinterest';
  if (combined.includes('quora')) return 'Quora';
  if (combined.includes('traffic') || combined.includes('visitor') || combined.includes('seo')) return 'Website Traffic & SEO';
  if (combined.includes('review') || combined.includes('rating') || combined.includes('google maps')) return 'Reviews & Ratings';

  return 'Other Services';
};

// Helper: Extract service engagement type
export const extractServiceType = (name: string, category: string): string => {
  const combined = `${category || ''} ${name || ''}`.toLowerCase();

  if (combined.includes('follower')) return 'Followers';
  if (combined.includes('like') || combined.includes('reaction') || combined.includes('upvote')) return 'Likes';
  if (combined.includes('view') || combined.includes('play') || combined.includes('stream') || combined.includes('impression')) return 'Views';
  if (combined.includes('comment')) return 'Comments';
  if (combined.includes('share') || combined.includes('repost') || combined.includes('retweet')) return 'Shares';
  if (combined.includes('subscriber') || combined.includes('sub ')) return 'Subscribers';
  if (combined.includes('member')) return 'Members';
  if (combined.includes('watch hour') || combined.includes('watchtime')) return 'Watch Hours';
  if (combined.includes('save') || combined.includes('favorite') || combined.includes('bookmark')) return 'Favorites & Saves';
  if (combined.includes('download')) return 'Downloads';
  if (combined.includes('battle') || combined.includes('pk')) return 'PK Battle Points';
  if (combined.includes('vote') || combined.includes('poll')) return 'Poll Votes';
  if (combined.includes('review') || combined.includes('rating')) return 'Reviews';
  if (combined.includes('traffic') || combined.includes('visit')) return 'Website Visits';

  return 'Engagement';
};

// Helper: Determine input requirement
export const determineInputConfig = (name: string, category: string, type: string, platform: string) => {
  const combined = `${name || ''} ${category || ''} ${type || ''}`.toLowerCase();
  const isCustomComments = type === 'Comments' || combined.includes('custom comment');

  if (isCustomComments) {
    return {
      inputType: 'custom_comments' as const,
      inputLabel: `${platform} Target URL & Custom Comments (1 per line)`,
      inputPlaceholder: 'https://...\nGreat content!\nAwesome post!'
    };
  }

  if (type === 'Followers' || type === 'Subscribers' || type === 'Members' || combined.includes('profile') || combined.includes('channel') || combined.includes('account')) {
    return {
      inputType: 'link' as const,
      inputLabel: `${platform} Profile Link or @Username`,
      inputPlaceholder: `https://${platform.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/username or @username`
    };
  }

  return {
    inputType: 'link' as const,
    inputLabel: `${platform} Target URL / Link`,
    inputPlaceholder: `https://${platform.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/...`
  };
};

// Helper: Normalize upstream Voiker service into ZENET HUB SocialBoostService format
export const normalizeVoikerService = (
  raw: any,
  usdRate: number
) => {
  const serviceId = String(raw.service || raw.id || raw.slug);
  const name = String(raw.name || 'Voiker Boosting Service').trim();
  const rawCategory = String(raw.category?.name || raw.category?.slug || raw.category || 'General').trim();
  const category = formatVoikerCategoryName(rawCategory);
  const platform = extractPlatformFromVoiker(rawCategory, name);
  const type = extractServiceType(name, rawCategory);
  
  // Voiker rates are USD per 1,000 units
  const priceUsd = Number(raw.rate || raw.price || raw.price_original || 0);
  const providerRateNgn = Math.max(1, Math.round(priceUsd * usdRate));

  const min = Math.max(1, Number(raw.min) || (type === 'Comments' ? 10 : type === 'Views' ? 100 : 50));
  const max = Math.max(min, Number(raw.max) || (type === 'Views' ? 10000000 : 500000));

  const inputCfg = determineInputConfig(name, rawCategory, type, platform);

  return {
    id: `vk-${serviceId}`,
    provider: 'Voiker',
    providerServiceId: serviceId,
    platform,
    category,
    name,
    type,
    rateUsd: priceUsd,
    rawRate: String(raw.rate ?? priceUsd),
    providerRatePer1000: providerRateNgn,
    ratePer1000: providerRateNgn,
    min,
    max,
    refill: Boolean(raw.refill && raw.refill !== '0' && raw.refill !== 'false' && raw.refill !== false),
    cancel: Boolean(raw.cancel && raw.cancel !== '0' && raw.cancel !== 'false' && raw.cancel !== false),
    deliverySpeed: raw.dripfeed ? 'Drip-feed Supported' : 'Instant Automated Start',
    quality: 'High-Retention Delivery',
    description: `Automated fast boosting for ${name}. Directly routed through Voiker network.`,
    ...inputCfg
  };
};

// Load Pricing Settings from Firestore
export const loadVoikerPricingSettings = async (db: Firestore | null): Promise<VoikerPricingSettings> => {
  if (!db) return cachedPricingSettings;
  try {
    const docSnap = await getDoc(doc(db, 'system_settings', 'voiker_pricing'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      cachedPricingSettings = {
        ...cachedPricingSettings,
        ...data
      };
    } else {
      // Fallback check social_boost_pricing
      const sbSnap = await getDoc(doc(db, 'system_settings', 'social_boost_pricing'));
      if (sbSnap.exists()) {
        const sbData = sbSnap.data();
        cachedPricingSettings = {
          ...cachedPricingSettings,
          ...sbData
        };
      }
    }
  } catch (err: any) {
    console.warn('[Voiker] Notice loading pricing settings:', err.message);
  }
  return cachedPricingSettings;
};

// Fetch full catalogue of Voiker services with fallback to quickSearch endpoint and Firestore caching
export const fetchVoikerServicesCatalogue = async (
  db: Firestore | null = null,
  forceRefresh: boolean = false
): Promise<any[]> => {
  const now = Date.now();
  const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

  if (!forceRefresh && cachedVoikerServices.length > 0 && lastVoikerSyncTime) {
    const elapsed = now - new Date(lastVoikerSyncTime).getTime();
    if (elapsed < CACHE_TTL_MS) {
      return cachedVoikerServices;
    }
  }

  if (activeVoikerSyncPromise) {
    return activeVoikerSyncPromise;
  }

  activeVoikerSyncPromise = (async () => {
    try {
      const { hasApiKey, usdToNgnRate } = getVoikerConfig();
      let rawServices: any[] = [];

      // 1. Try authenticated API v2 services endpoint if API key exists
      if (hasApiKey) {
        try {
          const apiRes = await queryVoikerApi('services', {}, 10000, 'GET');
          if (Array.isArray(apiRes) && apiRes.length > 0) {
            rawServices = apiRes;
            console.log(`[Voiker] Fetched ${rawServices.length} live services from Voiker API v2 (action=services).`);
          }
        } catch (e: any) {
          console.warn('[Voiker] Authenticated services fetch note:', e.message);
        }
      }

      // 2. If authenticated endpoint is unavailable or returned an error (e.g. key inactive),
      // fetch real live services from Voiker quickSearch endpoint (1,636 real Voiker services)
      if (rawServices.length === 0) {
        try {
          const qsRes = await fetch('https://voiker.com/api/services/quickSearch', {
            headers: {
              'User-Agent': 'ZENET-HUB-Voiker-Client/1.0',
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(8000)
          });
          if (qsRes.ok) {
            const data: any = await qsRes.json();
            if (data && Array.isArray(data.services) && data.services.length > 0) {
              rawServices = data.services;
              console.log(`[Voiker] Fetched ${rawServices.length} live services from Voiker quickSearch endpoint.`);
            }
          }
        } catch (qsErr: any) {
          console.warn('[Voiker] quickSearch endpoint fetch note:', qsErr.message);
        }
      }

      if (rawServices.length > 0) {
        const normalized = rawServices.map(item => normalizeVoikerService(item, usdToNgnRate));
        cachedVoikerServices = normalized;
        lastVoikerSyncTime = new Date().toISOString();

        // Persist to Firestore cache as resilient snapshot
        if (db) {
          try {
            await setDoc(doc(db, 'system_settings', 'voiker_catalogue'), {
              totalCount: normalized.length,
              lastSyncedAt: lastVoikerSyncTime,
              provider: 'Voiker',
              services: normalized
            }, { merge: true });
          } catch (dbErr: any) {
            console.warn('[Voiker] Firestore catalogue save note:', dbErr.message);
          }
        }

        return normalized;
      }

      // 3. Fallback: If network failed, load from Firestore backup cache
      if (db && cachedVoikerServices.length === 0) {
        try {
          const snap = await getDoc(doc(db, 'system_settings', 'voiker_catalogue'));
          if (snap.exists() && Array.isArray(snap.data()?.services) && snap.data().services.length > 0) {
            cachedVoikerServices = snap.data().services;
            lastVoikerSyncTime = snap.data().lastSyncedAt || new Date().toISOString();
            console.log(`[Voiker] Loaded ${cachedVoikerServices.length} services from Firestore backup cache.`);
            return cachedVoikerServices;
          }
        } catch (dbReadErr: any) {
          console.warn('[Voiker] Firestore backup read note:', dbReadErr.message);
        }
      }

      return cachedVoikerServices;
    } catch (err: any) {
      console.warn('[Voiker] Service catalogue fetch error:', err.message);
      return cachedVoikerServices;
    } finally {
      activeVoikerSyncPromise = null;
    }
  })();

  return activeVoikerSyncPromise;
};

// Calculate customer price in accordance with ZENET HUB pricing engine rules
// Zero-markup direct Voiker pricing mode: Voiker price -> ZENET HUB SMM service price directly
export const calculateCustomerPrice = (
  providerRatePer1000: number,
  _settings?: VoikerPricingSettings,
  _serviceId?: string
) => {
  return {
    customerRatePer1000: Math.max(1, providerRatePer1000),
    markupPer1000: 0
  };
};

// ============================================================================
// MAIN EXPRESS ROUTE HANDLER FOR VOIKER BOOSTING GATEWAY
// ============================================================================

export const handleVoikerGateway = async (
  req: express.Request,
  res: express.Response,
  db: Firestore | null,
  firebaseProjectId: string,
  verifyFirebaseIdToken: (authHeader: string | undefined, projectId: string) => string | null,
  explicitAction?: string
) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    const method = req.method;
    const action = (explicitAction || req.query.action || req.body.action || '').toString().toLowerCase();

    const config = getVoikerConfig();
    const settings = await loadVoikerPricingSettings(db);

    // Helper: Determine if caller is an authorized owner or admin
    const isOwnerRequest = async (): Promise<boolean> => {
      try {
        const authHeader = req.headers.authorization;
        let authUid = authHeader ? verifyFirebaseIdToken(authHeader, firebaseProjectId) : null;
        if (!authUid) {
          authUid = (req.body?.userId || req.query?.userId || '').toString() || null;
        }
        const emailCandidate = (req.body?.callerEmail || req.query?.callerEmail || req.headers['x-caller-email'] || req.headers['x-admin-email'] || '').toString().toLowerCase().trim();
        if (isAuthorizedOwnerEmail(emailCandidate) || (authUid && isAuthorizedOwnerUid(authUid))) {
          return true;
        }
        if (authUid && db) {
          const userRef = doc(db, 'users', authUid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const udata = userSnap.data();
            const uemail = (udata.email || '').toString().toLowerCase().trim();
            if (isAuthorizedOwnerEmail(uemail) || isAuthorizedOwnerUid(udata.uid) || udata.role === 'owner' || udata.role === 'admin') {
              return true;
            }
          }
        }
      } catch (err: any) {
        console.warn('[Voiker] isOwnerRequest notice:', err.message);
      }
      return false;
    };

    // ------------------------------------------------------------------------
    // 1. GET / CATALOGUE & SERVICES (action=services)
    // ------------------------------------------------------------------------
    if (action === 'services' || action === 'catalogue' || action === 'list' || action === 'sync-catalogue') {
      const isOwner = await isOwnerRequest();
      const forceRefresh = req.query.refresh === 'true' || action === 'sync-catalogue';

      if (cachedVoikerServices.length === 0 || forceRefresh) {
        await fetchVoikerServicesCatalogue(db, forceRefresh);
      }

      const services = cachedVoikerServices.map(svc => {
        const { customerRatePer1000, markupPer1000 } = calculateCustomerPrice(svc.providerRatePer1000, settings, svc.id);
        const isPlatformActive = settings.platformStatus[svc.platform] !== false;
        const isSvcDisabled = settings.disabledServices.includes(svc.id) || settings.serviceOverrides[svc.id]?.enabled === false;
        const isActive = isPlatformActive && !isSvcDisabled;

        if (isOwner) {
          return {
            ...svc,
            ratePer1000: customerRatePer1000,
            markupPer1000,
            isActive
          };
        } else {
          return {
            ...svc,
            ratePer1000: customerRatePer1000,
            markupPer1000: 0,
            isActive
          };
        }
      });

      const platforms = Array.from(new Set(services.map(s => s.platform)));
      const categoriesByPlatform: Record<string, string[]> = {};
      platforms.forEach(plat => {
        categoriesByPlatform[plat] = Array.from(new Set(services.filter(s => s.platform === plat).map(s => s.category)));
      });

      return res.json({
        success: true,
        provider: 'Voiker',
        hasApiKey: config.hasApiKey,
        services,
        platforms,
        categoriesByPlatform,
        totalCount: services.length,
        lastSyncedAt: lastVoikerSyncTime,
        isOwner
      });
    }

    // ------------------------------------------------------------------------
    // 2. GET / PROVIDER BALANCE (OWNER ONLY) (action=balance)
    // ------------------------------------------------------------------------
    if (action === 'balance') {
      const isOwner = await isOwnerRequest();
      if (!isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
      }

      if (!config.hasApiKey) {
        return res.json({
          success: true,
          provider: 'Voiker',
          hasApiKey: false,
          balanceUsd: 0,
          balanceNgn: 0,
          message: 'VOIKER_API_KEY environment variable is not set.'
        });
      }

      try {
        const balRes = await queryVoikerApi('balance', {}, 10000, 'GET');
        const balanceUsd = Number(balRes.balance || 0);
        const balanceNgn = Math.round(balanceUsd * config.usdToNgnRate);

        return res.json({
          success: true,
          provider: 'Voiker',
          hasApiKey: true,
          balanceUsd,
          balanceNgn,
          currency: balRes.currency || 'USD',
          raw: balRes
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // ------------------------------------------------------------------------
    // 3. POST / CREATE ORDER (ATOMIC WALLET DEDUCTION & VOIKER DISPATCH) (action=add)
    // ------------------------------------------------------------------------
    if (action === 'order' || action === 'add' || action === 'buy') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Please sign in to place a boosting order.' });
      }
      const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
      if (!uid || !db) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
      }

      const { serviceId, target, quantity, comments } = req.body;
      if (!serviceId || !target || !quantity || Number(quantity) <= 0) {
        return res.status(400).json({ success: false, error: 'serviceId, target URL or username, and quantity are required.' });
      }

      // Check user order lock (prevent double click / duplicate submission within 5 seconds)
      const now = Date.now();
      const lastLock = userOrderLocks.get(uid);
      if (lastLock && (now - lastLock < 5000)) {
        return res.status(429).json({ success: false, error: 'An order is already processing. Please wait a moment.' });
      }
      userOrderLocks.set(uid, now);

      if (cachedVoikerServices.length === 0) {
        await fetchVoikerServicesCatalogue();
      }

      // Match service
      const matchedSvc = cachedVoikerServices.find(s => 
        s.id === serviceId || 
        s.providerServiceId === serviceId ||
        `vk-${s.providerServiceId}` === serviceId
      );

      if (!matchedSvc) {
        return res.status(404).json({ success: false, error: 'Selected boosting service not found in catalogue.' });
      }

      const orderQty = Math.round(Number(quantity));
      if (orderQty < matchedSvc.min || orderQty > matchedSvc.max) {
        return res.status(400).json({
          success: false,
          error: `Quantity must be between ${matchedSvc.min.toLocaleString()} and ${matchedSvc.max.toLocaleString()} for this service.`
        });
      }

      // Calculate customer price using verified ZENET HUB pricing engine
      const { customerRatePer1000 } = calculateCustomerPrice(matchedSvc.providerRatePer1000, settings, matchedSvc.id);
      const totalCharge = Math.max(10, Math.round((customerRatePer1000 / 1000) * orderQty));
      const providerWholesaleCost = Math.round((matchedSvc.providerRatePer1000 / 1000) * orderQty);
      const profit = Math.max(0, totalCharge - providerWholesaleCost);

      // 3a. USER WALLET BALANCE PRE-CHECK
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return res.status(404).json({ success: false, error: 'User profile not found.' });
      }
      const uData = userSnap.data();
      const userEmail = uData.email || '';
      const userName = uData.displayName || uData.name || '';
      const currentBal = Number(uData.walletBalance ?? uData.balance ?? 0);

      if (currentBal < totalCharge) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          error: `Insufficient wallet balance. This order costs ₦${totalCharge.toLocaleString()}, but your balance is ₦${currentBal.toLocaleString()}. Please fund your wallet.`
        });
      }

      // 3b. DISPATCH ORDER TO VOIKER SMM API (action=add)
      // Check provider first: if provider rejects (e.g. insufficient_funds), customer wallet is NEVER deducted!
      let providerOrderId = '';
      let initialStatus = 'in_progress';
      const orderId = `ORD-VK-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const txId = `TX-BOOST-${Date.now()}`;

      if (config.hasApiKey) {
        try {
          const addParams: Record<string, any> = {
            service: matchedSvc.providerServiceId,
            link: target.trim(),
            quantity: orderQty
          };
          if (comments) {
            addParams.comments = String(comments);
          }

          const voikerRes = await queryVoikerApi('add', addParams, 12000, 'POST');

          if (voikerRes && (voikerRes.order || voikerRes.order_id)) {
            providerOrderId = String(voikerRes.order || voikerRes.order_id);
            initialStatus = 'in_progress';
          } else if (voikerRes && (voikerRes.error || voikerRes.message)) {
            // Upstream rejected order (e.g. insufficient_funds) -> Customer wallet was NOT debited!
            const errMsg = voikerRes.error || voikerRes.message;
            console.warn('[Voiker] Order dispatch rejected by provider:', errMsg);
            return res.status(422).json({
              success: false,
              code: voikerRes.error || 'PROVIDER_REJECTED',
              error: 'Social Media Boosting is coming soon. The service is currently undergoing provider setup and will be enabled shortly. Your wallet balance was not charged.'
            });
          } else {
            return res.status(422).json({
              success: false,
              code: 'PROVIDER_ERROR',
              error: 'Social Media Boosting is coming soon. The service is currently undergoing provider setup and will be enabled shortly. Your wallet balance was not charged.'
            });
          }
        } catch (upstreamErr: any) {
          console.warn('[Voiker] Order upstream communication error:', upstreamErr.message);
          return res.status(502).json({
            success: false,
            code: 'PROVIDER_UNAVAILABLE',
            error: 'Social Media Boosting is coming soon. The service is currently undergoing provider setup and will be enabled shortly. Your wallet was not charged.'
          });
        }
      } else {
        return res.status(503).json({
          success: false,
          code: 'API_KEY_REQUIRED',
          error: 'Voiker API key is not configured on the server yet. Funds were not deducted.'
        });
      }

      // 3c. PROVIDER CONFIRMED ALLOCATION -> ATOMICALLY DEBIT USER WALLET & SAVE ORDER
      try {
        await runTransaction(db, async (tx) => {
          const uSnap = await tx.get(userRef);
          if (!uSnap.exists()) throw new Error('User profile not found.');
          const cur = Number(uSnap.data().walletBalance ?? 0);
          if (cur < totalCharge) {
            throw new Error(`Insufficient wallet balance. Order costs ₦${totalCharge.toLocaleString()}`);
          }

          const newBal = cur - totalCharge;
          tx.update(userRef, {
            walletBalance: newBal,
            balance: newBal,
            updatedAt: new Date().toISOString()
          });
          tx.set(doc(db, 'wallets', uid), {
            userId: uid,
            userEmail,
            walletBalance: newBal,
            balance: newBal,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          // Record transaction
          tx.set(doc(db, 'transactions', txId), {
            id: txId,
            userId: uid,
            userEmail,
            type: 'purchase',
            category: 'boost',
            amount: totalCharge,
            currency: 'NGN',
            status: 'completed',
            description: `Social Boost: ${orderQty.toLocaleString()} ${matchedSvc.name} (${matchedSvc.platform})`,
            metadata: {
              orderId,
              provider: 'Voiker',
              providerOrderId,
              serviceId: matchedSvc.id,
              target: target.trim(),
              quantity: orderQty
            },
            createdAt: new Date().toISOString()
          });

          // Record order in Firestore
          tx.set(doc(db, 'social_boost_orders', orderId), {
            id: orderId,
            orderId,
            transactionId: txId,
            userId: uid,
            userEmail,
            userName,
            provider: 'Voiker',
            providerOrderId,
            platform: matchedSvc.platform,
            serviceId: matchedSvc.id,
            providerServiceId: matchedSvc.providerServiceId,
            serviceName: matchedSvc.name,
            serviceType: matchedSvc.type,
            category: matchedSvc.category,
            target: target.trim(),
            quantity: orderQty,
            comments: comments || null,
            ratePer1000: customerRatePer1000,
            providerRatePer1000: matchedSvc.providerRatePer1000,
            price: totalCharge,
            totalCharge,
            profit,
            currency: 'NGN',
            status: initialStatus,
            refill: matchedSvc.refill,
            cancel: matchedSvc.cancel,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
      } catch (txErr: any) {
        console.error('[Voiker] Post-allocation wallet deduction error:', txErr);
        return res.status(500).json({ success: false, error: txErr.message });
      }

      return res.json({
        success: true,
        message: 'Boosting order placed successfully!',
        order: {
          id: orderId,
          orderId,
          providerOrderId,
          serviceName: matchedSvc.name,
          platform: matchedSvc.platform,
          quantity: orderQty,
          totalCharge,
          status: initialStatus
        }
      });
    }

    // ------------------------------------------------------------------------
    // 4. GET & POST / ORDER STATUS (INDIVIDUAL & BATCH) (action=status)
    // ------------------------------------------------------------------------
    if (action === 'status') {
      const authHeader = req.headers.authorization;
      let callerUid: string | null = null;
      if (authHeader) {
        callerUid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
      }
      const isOwner = await isOwnerRequest();

      const orderParam = (req.query.order || req.body.order || req.query.orderId || req.body.orderId || '').toString().trim();
      const ordersParam = (req.query.orders || req.body.orders || '').toString().trim();

      // 4a. Batch status query (action=status&orders=1,2,3)
      if (ordersParam) {
        if (!config.hasApiKey) {
          return res.status(503).json({ success: false, error: 'VOIKER_API_KEY is not configured.' });
        }
        try {
          const batchRes = await queryVoikerApi('status', { orders: ordersParam }, 10000, 'GET');
          return res.json({ success: true, statuses: batchRes });
        } catch (e: any) {
          return res.status(500).json({ success: false, error: e.message });
        }
      }

      // 4b. Single order status query (action=status&order=ORDER_ID)
      if (!orderParam) {
        return res.status(400).json({ success: false, error: 'order or orderId parameter required.' });
      }

      // Check if orderParam is internal ZENET HUB order ID or Voiker provider order ID
      let matchedOrderDoc: any = null;
      if (db) {
        const orderSnap = await getDoc(doc(db, 'social_boost_orders', orderParam));
        if (orderSnap.exists()) {
          matchedOrderDoc = orderSnap.data();
        } else {
          // Search by providerOrderId
          const qSnap = await getDocs(query(collection(db, 'social_boost_orders'), where('providerOrderId', '==', orderParam)));
          if (!qSnap.empty) {
            matchedOrderDoc = qSnap.docs[0].data();
          }
        }
      }

      if (matchedOrderDoc && !isOwner && callerUid && matchedOrderDoc.userId !== callerUid) {
        return res.status(403).json({ success: false, error: 'Unauthorized to view this order.' });
      }

      const voikerOrderId = matchedOrderDoc?.providerOrderId || orderParam;

      if (!config.hasApiKey || !voikerOrderId || voikerOrderId.startsWith('SIM-')) {
        return res.json({
          success: true,
          order: matchedOrderDoc || { orderId: orderParam, status: 'pending' },
          status: matchedOrderDoc?.status || 'pending'
        });
      }

      try {
        const vStatus = await queryVoikerApi('status', { order: voikerOrderId }, 8000, 'GET');

        if (vStatus && vStatus.status && matchedOrderDoc && db) {
          const rawStat = String(vStatus.status).toLowerCase();
          let newStatus = matchedOrderDoc.status;

          if (rawStat.includes('completed')) {
            newStatus = 'completed';
          } else if (rawStat.includes('in progress') || rawStat.includes('processing')) {
            newStatus = 'in_progress';
          } else if (rawStat.includes('awaiting')) {
            newStatus = 'awaiting';
          } else if (rawStat.includes('cancel') || rawStat.includes('fail')) {
            newStatus = 'cancelled';
            // Auto refund if cancelled by provider
            if (!matchedOrderDoc.refunded) {
              const uRef = doc(db, 'users', matchedOrderDoc.userId);
              const refundAmount = Number(matchedOrderDoc.price || matchedOrderDoc.totalCharge || 0);
              await runTransaction(db, async (tx) => {
                const uSnap = await tx.get(uRef);
                if (uSnap.exists()) {
                  const cur = Number(uSnap.data().walletBalance || 0);
                  tx.update(uRef, { walletBalance: cur + refundAmount });
                }
                tx.update(doc(db, 'social_boost_orders', matchedOrderDoc.id), {
                  status: 'cancelled',
                  refunded: true,
                  refundedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
              });
              matchedOrderDoc.refunded = true;
            }
          }

          if (newStatus !== matchedOrderDoc.status || vStatus.start_count || vStatus.remains) {
            matchedOrderDoc.status = newStatus;
            matchedOrderDoc.startCount = vStatus.start_count ?? matchedOrderDoc.startCount;
            matchedOrderDoc.remains = vStatus.remains ?? matchedOrderDoc.remains;
            await updateDoc(doc(db, 'social_boost_orders', matchedOrderDoc.id), {
              status: newStatus,
              startCount: vStatus.start_count ?? null,
              remains: vStatus.remains ?? null,
              updatedAt: new Date().toISOString()
            });
          }
        }

        return res.json({
          success: true,
          provider: 'Voiker',
          status: matchedOrderDoc?.status || vStatus.status,
          upstream: vStatus,
          order: matchedOrderDoc
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // ------------------------------------------------------------------------
    // 5. POST / ORDER REFILL (action=refill)
    // ------------------------------------------------------------------------
    if (action === 'refill') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
      if (!uid || !db) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const isOwner = await isOwnerRequest();
      const orderParam = (req.body?.orderId || req.body?.order || req.query?.orderId || '').toString().trim();

      if (!orderParam) {
        return res.status(400).json({ success: false, error: 'Order ID is required.' });
      }

      const orderRef = doc(db, 'social_boost_orders', orderParam);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: 'Boosting order not found.' });
      }
      const orderData = orderSnap.data();

      if (!isOwner && orderData.userId !== uid) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not own this order.' });
      }

      if (!orderData.providerOrderId) {
        return res.status(400).json({ success: false, error: 'This order does not have an active upstream provider order.' });
      }

      if (!config.hasApiKey) {
        return res.status(503).json({ success: false, error: 'VOIKER_API_KEY is not configured.' });
      }

      try {
        let refillRes = await queryVoikerApi('refill', { order: orderData.providerOrderId }, 10000, 'GET');
        if (!refillRes || refillRes.error) {
          try {
            const postRes = await queryVoikerApi('refill', { order: orderData.providerOrderId }, 10000, 'POST');
            if (postRes && !postRes.error) refillRes = postRes;
          } catch {}
        }

        if (refillRes && (refillRes.refill !== undefined && refillRes.refill !== null && !refillRes.error)) {
          const refillId = String(refillRes.refill);
          await updateDoc(orderRef, {
            refillId,
            refillStatus: 'requested',
            refillRequestedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          return res.json({
            success: true,
            message: 'Refill requested successfully from Voiker.',
            refillId
          });
        } else {
          return res.status(422).json({
            success: false,
            error: refillRes?.error || 'Provider rejected refill request.'
          });
        }
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // ------------------------------------------------------------------------
    // 6. POST / CANCEL ORDER (action=cancel)
    // ------------------------------------------------------------------------
    if (action === 'cancel') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
      if (!uid || !db) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const isOwner = await isOwnerRequest();
      const orderParam = (req.body?.orderId || req.body?.order || req.query?.orderId || '').toString().trim();

      if (!orderParam) {
        return res.status(400).json({ success: false, error: 'Order ID is required.' });
      }

      const orderRef = doc(db, 'social_boost_orders', orderParam);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: 'Boosting order not found.' });
      }
      const orderData = orderSnap.data();

      if (!isOwner && orderData.userId !== uid) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not own this order.' });
      }

      if (['completed', 'cancelled'].includes((orderData.status || '').toLowerCase())) {
        return res.status(400).json({ success: false, error: `Order is already ${orderData.status} and cannot be cancelled.` });
      }

      if (!config.hasApiKey) {
        return res.status(503).json({ success: false, error: 'VOIKER_API_KEY is not configured.' });
      }

      try {
        // Voiker API accepts GET and POST with key, action=cancel, order
        let cancelRes = await queryVoikerApi('cancel', { order: orderData.providerOrderId }, 10000, 'GET');
        if (!cancelRes || cancelRes.error) {
          // Retry with POST if GET returned error
          try {
            const postRes = await queryVoikerApi('cancel', { order: orderData.providerOrderId }, 10000, 'POST');
            if (postRes && !postRes.error) cancelRes = postRes;
          } catch {}
        }

        const isCancelSuccess = Boolean(
          cancelRes &&
          !cancelRes.error &&
          !cancelRes.message &&
          (
            cancelRes.cancel !== undefined ||
            cancelRes.ok === true ||
            cancelRes.ok === 'true' ||
            cancelRes.status === 'ok' ||
            (Array.isArray(cancelRes) && cancelRes.length > 0 && !cancelRes[0].error)
          )
        );

        if (isCancelSuccess) {
          // Atomic refund to customer wallet
          const refundAmount = Number(orderData.price || orderData.totalCharge || 0);
          if (!orderData.refunded && refundAmount > 0) {
            const userRef = doc(db, 'users', orderData.userId);
            await runTransaction(db, async (tx) => {
              const uSnap = await tx.get(userRef);
              if (uSnap.exists()) {
                const cur = Number(uSnap.data().walletBalance || 0);
                tx.update(userRef, { walletBalance: cur + refundAmount });
              }
              tx.update(orderRef, {
                status: 'cancelled',
                refunded: true,
                refundedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            });
          }
          return res.json({
            success: true,
            message: 'Order cancelled successfully. Wallet funds refunded.',
            orderId: orderParam
          });
        } else {
          return res.status(422).json({
            success: false,
            error: cancelRes?.error || 'Provider rejected cancellation request. Order may have already started delivery.'
          });
        }
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // ------------------------------------------------------------------------
    // 7. GET / USER ORDERS WITH BATCH VOIKER STATUS SYNC (action=orders)
    // ------------------------------------------------------------------------
    if (action === 'orders') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
      if (!uid || !db) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const isOwner = await isOwnerRequest();
      const ordersCol = collection(db, 'social_boost_orders');
      let q = query(ordersCol, where('userId', '==', uid));
      if (isOwner && req.query.all === 'true') {
        q = query(ordersCol);
      }

      const snap = await getDocs(q);
      const ordersList: any[] = [];
      snap.forEach(d => ordersList.push(d.data()));

      ordersList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      // Batch synchronize active orders with Voiker API using action=status&orders=1,2,3
      if (config.hasApiKey) {
        const activeOrders = ordersList.filter(o => 
          o.provider === 'Voiker' && 
          o.providerOrderId && 
          !o.providerOrderId.startsWith('SIM-') &&
          ['pending', 'in_progress', 'processing', 'awaiting'].includes((o.status || '').toLowerCase())
        ).slice(0, 20);

        if (activeOrders.length > 0) {
          try {
            const batchIds = activeOrders.map(o => o.providerOrderId).join(',');
            const batchStatusRes = await queryVoikerApi('status', { orders: batchIds }, 8000, 'GET');

            for (const actOrder of activeOrders) {
              const statusInfo = batchStatusRes?.[actOrder.providerOrderId] || batchStatusRes;
              if (statusInfo && statusInfo.status) {
                const rawStat = String(statusInfo.status).toLowerCase();
                let newStatus = actOrder.status;

                if (rawStat.includes('completed')) {
                  newStatus = 'completed';
                } else if (rawStat.includes('in progress') || rawStat.includes('processing')) {
                  newStatus = 'in_progress';
                } else if (rawStat.includes('awaiting')) {
                  newStatus = 'awaiting';
                } else if (rawStat.includes('cancel') || rawStat.includes('fail')) {
                  newStatus = 'cancelled';
                  // Automatic refund if canceled/failed upstream
                  if (!actOrder.refunded) {
                    const uRef = doc(db, 'users', actOrder.userId);
                    const refundAmount = Number(actOrder.price || actOrder.totalCharge || 0);
                    await runTransaction(db, async (tx) => {
                      const uSnap = await tx.get(uRef);
                      if (uSnap.exists()) {
                        const cur = Number(uSnap.data().walletBalance || 0);
                        tx.update(uRef, { walletBalance: cur + refundAmount });
                      }
                      tx.update(doc(db, 'social_boost_orders', actOrder.id), {
                        status: 'cancelled',
                        refunded: true,
                        refundedAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                      });
                    });
                    actOrder.refunded = true;
                  }
                } else if (rawStat.includes('partial')) {
                  newStatus = 'partial';
                  if (!actOrder.partialRefunded && statusInfo.remains && actOrder.quantity) {
                    const remains = Number(statusInfo.remains) || 0;
                    const refundAmount = Math.round((remains / Number(actOrder.quantity)) * Number(actOrder.price || 0));
                    if (refundAmount > 0) {
                      const uRef = doc(db, 'users', actOrder.userId);
                      await runTransaction(db, async (tx) => {
                        const uSnap = await tx.get(uRef);
                        if (uSnap.exists()) {
                          const cur = Number(uSnap.data().walletBalance || 0);
                          tx.update(uRef, { walletBalance: cur + refundAmount });
                        }
                        tx.update(doc(db, 'social_boost_orders', actOrder.id), {
                          status: 'partial',
                          partialRefunded: true,
                          partialRefundAmount: refundAmount,
                          remains,
                          updatedAt: new Date().toISOString()
                        });
                      });
                      actOrder.partialRefunded = true;
                    }
                  }
                }

                if (newStatus !== actOrder.status || statusInfo.remains || statusInfo.start_count) {
                  actOrder.status = newStatus;
                  actOrder.startCount = statusInfo.start_count ?? actOrder.startCount ?? null;
                  actOrder.remains = statusInfo.remains ?? actOrder.remains ?? null;
                  await updateDoc(doc(db, 'social_boost_orders', actOrder.id), {
                    status: newStatus,
                    startCount: actOrder.startCount,
                    remains: actOrder.remains,
                    updatedAt: new Date().toISOString()
                  });
                }
              }
            }
          } catch (batchErr: any) {
            console.warn('[Voiker] Batch status check notice:', batchErr.message);
          }
        }
      }

      return res.json({
        success: true,
        orders: ordersList,
        count: ordersList.length
      });
    }

    // ------------------------------------------------------------------------
    // 8. POST & GET / PRICING SETTINGS UPDATE (OWNER ONLY) (action=pricing-settings)
    // ------------------------------------------------------------------------
    if (action === 'pricing-settings' && method === 'POST') {
      const isOwner = await isOwnerRequest();
      if (!isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
      }
      if (!db) return res.status(500).json({ success: false, error: 'Database not ready' });

      const {
        defaultMarkupPercent,
        minMarkupPer1k,
        usdToNgnRate,
        pricingStyle,
        platformStatus,
        disabledServices,
        serviceOverrides
      } = req.body;

      const newSettings: VoikerPricingSettings = {
        defaultMarkupPercent: Math.max(5, Math.min(300, Number(defaultMarkupPercent) || 45)),
        minMarkupPer1k: Math.max(50, Number(minMarkupPer1k) || 350),
        usdToNgnRate: Math.max(500, Number(usdToNgnRate) || 1650),
        pricingStyle: ['natural', 'clean', 'tiered'].includes(pricingStyle) ? pricingStyle : 'natural',
        platformStatus: platformStatus || cachedPricingSettings.platformStatus,
        disabledServices: Array.isArray(disabledServices) ? disabledServices : (cachedPricingSettings.disabledServices || []),
        curatedServiceIds: cachedPricingSettings.curatedServiceIds || [],
        bestValueServiceIds: cachedPricingSettings.bestValueServiceIds || {},
        serviceOverrides: serviceOverrides || cachedPricingSettings.serviceOverrides || {}
      };

      await setDoc(doc(db, 'system_settings', 'voiker_pricing'), newSettings, { merge: true });
      cachedPricingSettings = newSettings;

      return res.json({
        success: true,
        message: 'Voiker boosting pricing settings updated successfully.',
        settings: newSettings
      });
    }

    if (action === 'pricing-settings' && method === 'GET') {
      return res.json({
        success: true,
        settings: cachedPricingSettings
      });
    }

    return res.status(400).json({ success: false, error: `Unsupported action: ${action}` });

  } catch (err: any) {
    console.error('Voiker Boosting Gateway Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Voiker Boosting Gateway service error' });
  }
};
