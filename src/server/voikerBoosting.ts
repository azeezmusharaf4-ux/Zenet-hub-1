import express from 'express';
import fs from 'fs';
import path from 'path';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { isAuthorizedOwnerEmail, isAuthorizedOwnerUid } from '../lib/authorizedOwners.ts';
import { sendSocialBoostOrderSuccessEmail } from './emailService.ts';

// ============================================================================
// VOIKER BOOSTING GATEWAY & SERVICE INTEGRATION (VOIKER.COM SMM API V2)
// ============================================================================

export interface VoikerConfig {
  apiKey: string;
  baseUrl: string;
  usdToNgnRate: number;
  hasApiKey: boolean;
}

export interface CategoryMarkupSetting {
  markupFixedNgn?: number; // Markup amount in Naira per 1k
  markupPercent?: number;  // Optional percentage markup
}

export interface VoikerPricingSettings {
  apiKey?: string;
  defaultMarkupPercent: number;
  defaultMarkupFixedNgn?: number; // Global default markup in Naira per 1k
  minMarkupPer1k: number;
  usdToNgnRate: number;
  pricingStyle: 'natural' | 'clean' | 'tiered';
  platformStatus: Record<string, boolean>;
  disabledServices: string[];
  curatedServiceIds: string[];
  bestValueServiceIds: Record<string, string>;
  categoryMarkups?: Record<string, CategoryMarkupSetting>; // Per-category markups: Followers, Views, Likes, Comments, Shares, Subscribers, Other
  serviceOverrides: Record<string, {
    customRatePer1000?: number;
    customMarkupFixedNgn?: number; // Individual service markup in Naira per 1k
    customMarkupPercent?: number;
    enabled?: boolean;
    isBestValue?: boolean;
  }>;
}

let cachedPricingSettings: VoikerPricingSettings = {
  defaultMarkupPercent: 0,
  defaultMarkupFixedNgn: 0,
  minMarkupPer1k: 0,
  usdToNgnRate: 1348.45,
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
  categoryMarkups: {
    Followers: { markupFixedNgn: 0, markupPercent: 0 },
    Views: { markupFixedNgn: 0, markupPercent: 0 },
    Likes: { markupFixedNgn: 0, markupPercent: 0 },
    Comments: { markupFixedNgn: 0, markupPercent: 0 },
    Shares: { markupFixedNgn: 0, markupPercent: 0 },
    Subscribers: { markupFixedNgn: 0, markupPercent: 0 },
    Other: { markupFixedNgn: 0, markupPercent: 0 }
  },
  serviceOverrides: {}
};

// ============================================================================
// LIVE EXCHANGE RATE ENGINE (REAL-TIME USD -> NGN CONVERSION WITH AUDIT TRAIL)
// ============================================================================

export interface LiveExchangeRateRecord {
  rate: number;
  baseCurrency: string;
  targetCurrency: string;
  source: string;
  retrievedAt: string;
  timeLastUpdateUtc?: string;
  isLive: boolean;
}

let cachedLiveExchangeRate: LiveExchangeRateRecord | null = null;
let lastExchangeRateFetchTime = 0;
const EXCHANGE_RATE_TTL_MS = 15 * 60 * 1000; // 15-minute live rate freshness cache

export const fetchLiveUsdToNgnRate = async (
  db?: Firestore | null,
  forceRefresh: boolean = false
): Promise<LiveExchangeRateRecord> => {
  const now = Date.now();
  if (!forceRefresh && cachedLiveExchangeRate && (now - lastExchangeRateFetchTime < EXCHANGE_RATE_TTL_MS)) {
    return cachedLiveExchangeRate;
  }

  const apis = [
    {
      name: 'open.er-api.com',
      url: 'https://open.er-api.com/v6/latest/USD',
      parse: (data: any) => ({
        rate: Number(data?.rates?.NGN),
        timeUtc: data?.time_last_update_utc
      })
    },
    {
      name: 'api.exchangerate-api.com',
      url: 'https://api.exchangerate-api.com/v4/latest/USD',
      parse: (data: any) => ({
        rate: Number(data?.rates?.NGN),
        timeUtc: data?.date
      })
    },
    {
      name: 'fawazahmed0/currency-api',
      url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      parse: (data: any) => ({
        rate: Number(data?.usd?.ngn),
        timeUtc: data?.date
      })
    }
  ];

  let fetchedRecord: LiveExchangeRateRecord | null = null;
  let lastError: string | null = null;

  for (const api of apis) {
    try {
      const res = await fetch(api.url, {
        headers: { 'User-Agent': 'ZENET-HUB-LiveExchange/1.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) {
        lastError = `${api.name} HTTP ${res.status}`;
        continue;
      }
      const data: any = await res.json();
      const parsed = api.parse(data);
      if (typeof parsed.rate === 'number' && parsed.rate > 500 && parsed.rate < 5000 && !isNaN(parsed.rate)) {
        const roundedRate = Math.round(parsed.rate * 100) / 100;
        fetchedRecord = {
          rate: roundedRate,
          baseCurrency: 'USD',
          targetCurrency: 'NGN',
          source: api.name,
          retrievedAt: new Date().toISOString(),
          timeLastUpdateUtc: parsed.timeUtc ? String(parsed.timeUtc) : new Date().toUTCString(),
          isLive: true
        };
        break;
      }
    } catch (err: any) {
      lastError = `${api.name}: ${err.message}`;
    }
  }

  if (fetchedRecord) {
    cachedLiveExchangeRate = fetchedRecord;
    lastExchangeRateFetchTime = now;
    cachedPricingSettings.usdToNgnRate = fetchedRecord.rate;

    if (db) {
      try {
        await setDoc(doc(db, 'system_settings', 'live_exchange_rate'), fetchedRecord, { merge: true });
        await setDoc(doc(db, 'system_settings', 'voiker_pricing'), {
          usdToNgnRate: fetchedRecord.rate,
          defaultMarkupPercent: 0,
          minMarkupPer1k: 0,
          pricingStyle: 'natural',
          exchangeRateRetrievedAt: fetchedRecord.retrievedAt,
          exchangeRateSource: fetchedRecord.source,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`[ExchangeRate] Live USD/NGN rate ${fetchedRecord.rate} (${fetchedRecord.source}) persisted to Firestore.`);
      } catch (dbErr: any) {
        console.warn('[ExchangeRate] Firestore save notice:', dbErr.message);
      }
    }
    return fetchedRecord;
  }

  // If live fetch failed: check Firestore backup to preserve last verified exchange rate
  if (db && !cachedLiveExchangeRate) {
    try {
      const savedSnap = await getDoc(doc(db, 'system_settings', 'live_exchange_rate'));
      if (savedSnap.exists()) {
        const d = savedSnap.data() as LiveExchangeRateRecord;
        if (d && d.rate > 500) {
          cachedLiveExchangeRate = {
            ...d,
            isLive: false
          };
          console.warn(`[ExchangeRate] Live exchange API notice (${lastError}). Preserved last verified rate ${d.rate} from ${d.retrievedAt}`);
          return cachedLiveExchangeRate;
        }
      }
    } catch {}
  }

  if (cachedLiveExchangeRate) {
    return {
      ...cachedLiveExchangeRate,
      isLive: false
    };
  }

  throw new Error(`Unable to retrieve live USD-to-NGN exchange rate: ${lastError || 'All exchange-rate APIs unreachable.'}`);
};

// In-memory cache for live Voiker services & counts
const CACHE_VOIKER_CATALOGUE_FILE = path.join(process.cwd(), '.cache_voiker_catalogue.json');
let cachedVoikerServices: any[] = [];
let cachedPlatformCounts: Record<string, number> | null = null;
let cachedPlatformOrder: string[] = [];
let lastVoikerSyncTime: string | null = null;
let activeVoikerSyncPromise: Promise<any[]> | null = null;
let lastPricingSettingsLoadTime = 0;
const PRICING_SETTINGS_CACHE_TTL_MS = 60 * 1000; // 60s in-memory cache for Firestore system settings

export const computeAndCacheCounts = (services: any[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  const order: string[] = [];
  for (const svc of services) {
    const plat = svc.platform || 'Other Services';
    if (counts[plat] === undefined) {
      order.push(plat);
      counts[plat] = 0;
    }
    counts[plat]++;
  }
  cachedPlatformCounts = counts;
  cachedPlatformOrder = order;
  return counts;
};

// User purchase idempotency locks
const userOrderLocks = new Map<string, number>();

// Helper: Get Voiker API configuration securely from server environment or admin pricing settings
export const getVoikerConfig = (): VoikerConfig => {
  const apiKey = (process.env.VOIKER_API_KEY || process.env.VOIKA_API_KEY || cachedPricingSettings.apiKey || '').trim();
  const baseUrl = (process.env.VOIKER_BASE_URL || process.env.VOIKA_BASE_URL || 'https://voiker.com/api/v2').trim().replace(/\/+$/, '');
  const usdToNgnRate = cachedLiveExchangeRate?.rate || cachedPricingSettings.usdToNgnRate || 1348.45;
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

// Helper: Identify whether a service is a Views service
export const isViewsService = (service: { type?: string; category?: string; name?: string; id?: string } | null | undefined): boolean => {
  if (!service) return false;
  const t = (service.type || '').toLowerCase();
  const c = (service.category || '').toLowerCase();
  const n = (service.name || '').toLowerCase();
  const id = (service.id || '').toLowerCase();
  return (
    t.includes('view') || c.includes('view') || n.includes('view') || id.includes('view') ||
    t.includes('play') || c.includes('play') || n.includes('play') ||
    t.includes('stream') || c.includes('stream') || n.includes('stream') ||
    t.includes('retention') || c.includes('retention') || n.includes('retention') ||
    t.includes('watch') || c.includes('watch') || n.includes('watch')
  );
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

  // Strict requested limits: Views: Min 1,000 / Max 1,000,000 | Regular: Min 100 / Max 100,000
  const isViews = isViewsService({ type, category: rawCategory, name, id: serviceId });
  const min = isViews ? 1000 : 100;
  const max = isViews ? 1000000 : 100000;

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

// Load Pricing Settings from Firestore with 60s in-memory caching
export const loadVoikerPricingSettings = async (db: Firestore | null, forceRefresh: boolean = false): Promise<VoikerPricingSettings> => {
  if (!db) return cachedPricingSettings;
  const now = Date.now();
  if (!forceRefresh && lastPricingSettingsLoadTime > 0 && (now - lastPricingSettingsLoadTime < PRICING_SETTINGS_CACHE_TTL_MS)) {
    return cachedPricingSettings;
  }
  try {
    const docSnap = await getDoc(doc(db, 'system_settings', 'voiker_pricing'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      cachedPricingSettings = {
        ...cachedPricingSettings,
        ...data,
        defaultMarkupFixedNgn: typeof data.defaultMarkupFixedNgn === 'number' ? Math.max(0, data.defaultMarkupFixedNgn) : (cachedPricingSettings.defaultMarkupFixedNgn || 0),
        defaultMarkupPercent: typeof data.defaultMarkupPercent === 'number' ? Math.max(0, data.defaultMarkupPercent) : (cachedPricingSettings.defaultMarkupPercent || 0),
        categoryMarkups: data.categoryMarkups || cachedPricingSettings.categoryMarkups || {},
        serviceOverrides: data.serviceOverrides || cachedPricingSettings.serviceOverrides || {}
      };
      if (data?.apiKey) {
        const cleanKey = String(data.apiKey).trim();
        cachedPricingSettings.apiKey = cleanKey;
        process.env.VOIKER_API_KEY = cleanKey;
      }
    } else {
      // Fallback check social_boost_pricing
      const sbSnap = await getDoc(doc(db, 'system_settings', 'social_boost_pricing'));
      if (sbSnap.exists()) {
        const sbData = sbSnap.data();
        cachedPricingSettings = {
          ...cachedPricingSettings,
          ...sbData,
          defaultMarkupFixedNgn: typeof sbData.defaultMarkupFixedNgn === 'number' ? Math.max(0, sbData.defaultMarkupFixedNgn) : (cachedPricingSettings.defaultMarkupFixedNgn || 0),
          defaultMarkupPercent: typeof sbData.defaultMarkupPercent === 'number' ? Math.max(0, sbData.defaultMarkupPercent) : (cachedPricingSettings.defaultMarkupPercent || 0),
          serviceOverrides: sbData.serviceOverrides || cachedPricingSettings.serviceOverrides || {}
        };
        if (sbData?.apiKey) {
          const cleanKey = String(sbData.apiKey).trim();
          cachedPricingSettings.apiKey = cleanKey;
          process.env.VOIKER_API_KEY = cleanKey;
        }
      }
    }
    lastPricingSettingsLoadTime = Date.now();
  } catch (err: any) {
    console.warn('[Voiker] Notice loading pricing settings:', err.message);
  }
  return cachedPricingSettings;
};

// Firestore catalogue partitioning helpers (prevents 1MB limit document size errors)
const VOIKER_CHUNK_SIZE = 400;

export const loadVoikerCatalogueFromFirestore = async (
  db: Firestore
): Promise<{ services: any[]; lastSyncedAt: string } | null> => {
  try {
    const metaSnap = await getDoc(doc(db, 'system_settings', 'voiker_catalogue'));
    if (!metaSnap.exists()) return null;
    const meta = metaSnap.data();
    const lastSyncedAt = meta?.lastSyncedAt || new Date().toISOString();

    // 1. If partitioned chunks exist, fetch and assemble them in parallel
    if (typeof meta?.chunkCount === 'number' && meta.chunkCount > 0) {
      const chunkPromises: Promise<any>[] = [];
      for (let i = 0; i < meta.chunkCount; i++) {
        chunkPromises.push(getDoc(doc(db, 'system_settings', `voiker_cat_part_${i}`)));
      }
      const chunkSnaps = await Promise.all(chunkPromises);
      const combined: any[] = [];
      for (const cSnap of chunkSnaps) {
        if (cSnap.exists() && Array.isArray(cSnap.data()?.services)) {
          combined.push(...cSnap.data().services);
        }
      }
      if (combined.length > 0) {
        return { services: combined, lastSyncedAt };
      }
    }

    // 2. Legacy fallback for single document format
    if (Array.isArray(meta?.services) && meta.services.length > 0) {
      return { services: meta.services, lastSyncedAt };
    }
  } catch (err: any) {
    console.warn('[Voiker] Notice loading catalogue from Firestore:', err.message);
  }
  return null;
};

export const saveVoikerCatalogueToFirestore = async (
  db: Firestore,
  normalized: any[],
  syncTime: string
): Promise<void> => {
  try {
    try {
      const auth = getAuth();
      if (!auth.currentUser) {
        await signInWithEmailAndPassword(
          auth,
          'zenet-backend-service@zenetmarketplace.internal',
          'ZenetSecureSystemBackend2026!#'
        ).catch(() => {});
      }
    } catch {}

    const chunkCount = Math.ceil(normalized.length / VOIKER_CHUNK_SIZE);

    // Save each chunk partition in parallel
    const writePromises: Promise<any>[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const slice = normalized.slice(i * VOIKER_CHUNK_SIZE, (i + 1) * VOIKER_CHUNK_SIZE);
      writePromises.push(
        setDoc(doc(db, 'system_settings', `voiker_cat_part_${i}`), {
          partIndex: i,
          count: slice.length,
          lastSyncedAt: syncTime,
          services: slice
        })
      );
    }
    await Promise.all(writePromises);

    // Write master manifest doc with live rate metadata (stays ~200 bytes, well under 1MB limit)
    await setDoc(doc(db, 'system_settings', 'voiker_catalogue'), {
      totalCount: normalized.length,
      lastSyncedAt: syncTime,
      provider: 'Voiker',
      chunkCount,
      chunkSize: VOIKER_CHUNK_SIZE,
      liveExchangeRate: cachedLiveExchangeRate?.rate || 1348.45,
      exchangeRateRetrievedAt: cachedLiveExchangeRate?.retrievedAt || syncTime,
      exchangeRateSource: cachedLiveExchangeRate?.source || 'open.er-api.com',
      markupPercent: 0,
      services: [] // Empty placeholder prevents oversized document errors
    });

    console.log(`[Voiker] Persisted ${normalized.length} services across ${chunkCount} Firestore partitions with live rate ${cachedLiveExchangeRate?.rate || 1348.45}.`);
  } catch (saveErr: any) {
    console.warn('[Voiker] Notice saving catalogue to Firestore:', saveErr.message);
  }
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
    // Stale-while-revalidate: return existing data immediately and revalidate in background
    if (!activeVoikerSyncPromise) {
      activeVoikerSyncPromise = (async (): Promise<any[]> => {
        try {
          return await fetchVoikerServicesCatalogue(db, true);
        } catch {
          return cachedVoikerServices;
        }
      })().finally(() => {
        activeVoikerSyncPromise = null;
      });
    }
    return cachedVoikerServices;
  }

  if (activeVoikerSyncPromise) {
    return activeVoikerSyncPromise;
  }

  activeVoikerSyncPromise = (async () => {
    try {
      // On cold start, check local disk snapshot first for 0ms startup
      if (cachedVoikerServices.length === 0 && !forceRefresh) {
        try {
          if (fs.existsSync(CACHE_VOIKER_CATALOGUE_FILE)) {
            const diskRaw = fs.readFileSync(CACHE_VOIKER_CATALOGUE_FILE, 'utf-8');
            const diskData = JSON.parse(diskRaw);
            if (Array.isArray(diskData?.services) && diskData.services.length > 0) {
              cachedVoikerServices = diskData.services;
              lastVoikerSyncTime = diskData.lastSyncedAt || new Date().toISOString();
              computeAndCacheCounts(cachedVoikerServices);
              console.log(`[Voiker] Instant disk-cache load: ${cachedVoikerServices.length} services ready.`);
              // Revalidate live in background if older than 5 mins
              setTimeout(() => {
                fetchVoikerServicesCatalogue(db, true).catch(() => {});
              }, 1000);
              return cachedVoikerServices;
            }
          }
        } catch (diskErr: any) {
          console.warn('[Voiker] Disk cache read notice:', diskErr.message);
        }
      }

      // On cold start, if Firestore has a saved snapshot, load it immediately to avoid blocking client
      if (db && cachedVoikerServices.length === 0 && !forceRefresh) {
        try {
          const loaded = await loadVoikerCatalogueFromFirestore(db);
          if (loaded && loaded.services.length > 0) {
            cachedVoikerServices = loaded.services;
            lastVoikerSyncTime = loaded.lastSyncedAt;
            computeAndCacheCounts(cachedVoikerServices);
            console.log(`[Voiker] Instant cold-start load: ${cachedVoikerServices.length} services loaded from Firestore snapshot.`);
            // Sync live in background
            setTimeout(() => {
              fetchVoikerServicesCatalogue(db, true).catch(() => {});
            }, 100);
            return cachedVoikerServices;
          }
        } catch (dbReadErr: any) {
          console.warn('[Voiker] Firestore cold-start read note:', dbReadErr.message);
        }
      }

      // Automatically retrieve current USD-to-NGN exchange rate from reliable live API
      let liveRateRecord: LiveExchangeRateRecord;
      try {
        liveRateRecord = await fetchLiveUsdToNgnRate(db, forceRefresh);
      } catch (rateErr: any) {
        console.error('[Voiker] Live exchange rate fetch error:', rateErr.message);
        if (cachedVoikerServices.length > 0) {
          // Preserve last verified prices
          return cachedVoikerServices;
        }
        throw rateErr;
      }

      const usdToNgnRate = liveRateRecord.rate;
      const { hasApiKey } = getVoikerConfig();
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
        computeAndCacheCounts(normalized);

        // Save local disk snapshot for instant restart
        try {
          fs.writeFileSync(CACHE_VOIKER_CATALOGUE_FILE, JSON.stringify({
            services: normalized,
            lastSyncedAt: lastVoikerSyncTime,
            totalCount: normalized.length,
            liveExchangeRate: usdToNgnRate,
            exchangeRateRetrievedAt: liveRateRecord.retrievedAt,
            exchangeRateSource: liveRateRecord.source
          }), 'utf-8');
        } catch (diskWriteErr: any) {
          console.warn('[Voiker] Disk cache save notice:', diskWriteErr.message);
        }

        // Persist to Firestore cache partitioned into safe chunks under 1MB
        if (db) {
          await saveVoikerCatalogueToFirestore(db, normalized, lastVoikerSyncTime);
        }

        return normalized;
      }

      // 3. Fallback: If network failed, load from Firestore backup cache
      if (db && cachedVoikerServices.length === 0) {
        try {
          const loaded = await loadVoikerCatalogueFromFirestore(db);
          if (loaded && loaded.services.length > 0) {
            cachedVoikerServices = loaded.services;
            lastVoikerSyncTime = loaded.lastSyncedAt;
            computeAndCacheCounts(cachedVoikerServices);
            console.log(`[Voiker] Loaded ${cachedVoikerServices.length} services from Firestore backup cache.`);
            return cachedVoikerServices;
          }
        } catch (dbReadErr: any) {
          console.warn('[Voiker] Firestore backup read note:', dbReadErr.message);
        }
      }

      if (cachedVoikerServices.length > 0) {
        computeAndCacheCounts(cachedVoikerServices);
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
export const calculateCustomerPrice = (
  providerRatePer1000: number,
  settings?: VoikerPricingSettings,
  serviceId?: string,
  serviceName?: string,
  serviceCategory?: string,
  serviceType?: string
) => {
  const providerRate = Math.max(1, providerRatePer1000);
  if (!settings) {
    return {
      customerRatePer1000: providerRate,
      markupPer1000: 0
    };
  }

  const override = (settings.serviceOverrides && serviceId && settings.serviceOverrides[serviceId]) || {};
  
  // 1. Explicit direct rate override
  if (typeof override.customRatePer1000 === 'number' && override.customRatePer1000 > 0) {
    const customerRate = Math.max(providerRate, override.customRatePer1000);
    return {
      customerRatePer1000: customerRate,
      markupPer1000: Math.max(0, customerRate - providerRate)
    };
  }

  // 2. Individual service markup in Naira per 1,000 units (highest precedence)
  if (typeof override.customMarkupFixedNgn === 'number' && override.customMarkupFixedNgn >= 0) {
    const markup = Math.max(0, Math.round(override.customMarkupFixedNgn));
    return {
      customerRatePer1000: providerRate + markup,
      markupPer1000: markup
    };
  }

  // 3. Category markup (Followers, Views, Likes, Comments, Shares, Subscribers, Other)
  const resolvedCategory = serviceType || extractServiceType(serviceName || '', serviceCategory || '');
  const standardCategories = ['Followers', 'Views', 'Likes', 'Comments', 'Shares', 'Subscribers'];
  const catKey = standardCategories.includes(resolvedCategory) ? resolvedCategory : 'Other';

  const catSetting = settings.categoryMarkups?.[catKey] || settings.categoryMarkups?.[resolvedCategory];
  if (catSetting) {
    let catMarkup = 0;
    if (typeof catSetting.markupFixedNgn === 'number' && catSetting.markupFixedNgn > 0) {
      catMarkup += Math.round(catSetting.markupFixedNgn);
    }
    if (typeof catSetting.markupPercent === 'number' && catSetting.markupPercent > 0) {
      catMarkup += Math.round(providerRate * (catSetting.markupPercent / 100));
    }
    if (catMarkup > 0) {
      return {
        customerRatePer1000: providerRate + catMarkup,
        markupPer1000: catMarkup
      };
    }
  }

  // 4. Global default markup in Naira per 1,000 units
  if (typeof settings.defaultMarkupFixedNgn === 'number' && settings.defaultMarkupFixedNgn > 0) {
    const markup = Math.max(0, Math.round(settings.defaultMarkupFixedNgn));
    return {
      customerRatePer1000: providerRate + markup,
      markupPer1000: markup
    };
  }

  // 5. Percentage markup fallback (if configured)
  const markupPercent = typeof override.customMarkupPercent === 'number'
    ? override.customMarkupPercent
    : (settings.defaultMarkupPercent ?? 0);

  if (markupPercent <= 0) {
    return {
      customerRatePer1000: providerRate,
      markupPer1000: 0
    };
  }

  let customerRate = Math.round(providerRate * (1 + markupPercent / 100));
  const minMarkup = settings.minMarkupPer1k ?? 0;
  if (markupPercent > 0 && customerRate - providerRate < minMarkup) {
    customerRate = providerRate + minMarkup;
  }

  if (settings.pricingStyle === 'clean') {
    customerRate = Math.round(customerRate / 100) * 100;
  } else if (settings.pricingStyle === 'tiered') {
    customerRate = Math.ceil(customerRate / 50) * 50;
  }

  return {
    customerRatePer1000: Math.max(1, customerRate),
    markupPer1000: Math.max(0, customerRate - providerRate)
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

    // Helper: Determine if caller is an authorized owner (Super Admin)
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
            // STRICT OWNER ONLY: Normal admins (role === 'admin') are NOT authorized owners
            if (isAuthorizedOwnerEmail(uemail) || isAuthorizedOwnerUid(udata.uid) || udata.role === 'owner') {
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
    // 0. FAST PATH: PLATFORM COUNTS ONLY (action=counts | action=summary | countsOnly=true)
    // Lightweight public endpoint returning ~600 bytes in 1-3ms without owner check or margin calculation
    // ------------------------------------------------------------------------
    if (action === 'counts' || action === 'summary' || req.query.countsOnly === 'true' || req.query.summary === 'true') {
      const forceRefresh = req.query.refresh === 'true';
      if (!cachedPlatformCounts || cachedVoikerServices.length === 0 || forceRefresh) {
        await fetchVoikerServicesCatalogue(db, forceRefresh);
      }
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
      return res.json({
        success: true,
        provider: 'Voiker',
        platformCounts: cachedPlatformCounts || {},
        platforms: cachedPlatformOrder || [],
        totalCount: cachedVoikerServices.length,
        lastSyncedAt: lastVoikerSyncTime
      });
    }

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
        const { customerRatePer1000, markupPer1000 } = calculateCustomerPrice(
          svc.providerRatePer1000,
          settings,
          svc.id,
          svc.name,
          svc.category,
          svc.type
        );
        const isPlatformActive = settings.platformStatus[svc.platform] !== false;
        const isSvcDisabled = settings.disabledServices.includes(svc.id) || settings.serviceOverrides[svc.id]?.enabled === false;
        const isActive = isPlatformActive && !isSvcDisabled;
        const override = settings.serviceOverrides?.[svc.id];
        const hasCustomMarkup = typeof override?.customMarkupFixedNgn === 'number';

        if (isOwner) {
          return {
            ...svc,
            ratePer1000: customerRatePer1000,
            customerRatePer1000,
            providerRatePer1000: svc.providerRatePer1000,
            rateUsd: svc.rateUsd,
            markupPer1000,
            customMarkupFixedNgn: override?.customMarkupFixedNgn,
            hasCustomMarkup,
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

      const platformCounts: Record<string, number> = {};
      const platformOrder: string[] = [];
      const categoriesMap: Record<string, Set<string>> = {};

      for (const svc of services) {
        const plat = svc.platform || 'Other';
        if (!categoriesMap[plat]) {
          platformOrder.push(plat);
          categoriesMap[plat] = new Set();
          platformCounts[plat] = 0;
        }
        platformCounts[plat]++;
        if (svc.category) {
          categoriesMap[plat].add(svc.category);
        }
      }

      const categoriesByPlatform: Record<string, string[]> = {};
      for (const [p, set] of Object.entries(categoriesMap)) {
        categoriesByPlatform[p] = Array.from(set);
      }

      // Fast summary/counts endpoint support
      if (req.query.countsOnly === 'true' || req.query.summary === 'true') {
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return res.json({
          success: true,
          provider: 'Voiker',
          platformCounts,
          platforms: platformOrder,
          totalCount: services.length,
          lastSyncedAt: lastVoikerSyncTime
        });
      }

      const liveRate = cachedLiveExchangeRate?.rate || config.usdToNgnRate || 1348.45;
      const liveRateRecord = cachedLiveExchangeRate || {
        rate: liveRate,
        baseCurrency: 'USD',
        targetCurrency: 'NGN',
        source: 'open.er-api.com',
        retrievedAt: lastVoikerSyncTime || new Date().toISOString(),
        isLive: true
      };

      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.json({
        success: true,
        provider: 'Voiker',
        hasApiKey: config.hasApiKey,
        liveExchangeRate: liveRate,
        exchangeRate: liveRate,
        exchangeRateRetrievedAt: liveRateRecord.retrievedAt,
        exchangeRateSource: liveRateRecord.source,
        defaultMarkupFixedNgn: settings.defaultMarkupFixedNgn || 0,
        defaultMarkupPercent: settings.defaultMarkupPercent || 0,
        services,
        platforms: platformOrder,
        platformCounts,
        categoriesByPlatform,
        totalCount: services.length,
        lastSyncedAt: lastVoikerSyncTime,
        isOwner
      });
    }

    // ------------------------------------------------------------------------
    // 1b. GET / LIVE USD-TO-NGN EXCHANGE RATE (action=exchange-rate | action=rate)
    // ------------------------------------------------------------------------
    if (action === 'exchange-rate' || action === 'rate') {
      try {
        const forceRefresh = req.query.refresh === 'true';
        const rateRecord = await fetchLiveUsdToNgnRate(db, forceRefresh);
        return res.json({
          success: true,
          provider: 'Voiker',
          ...rateRecord
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
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
          message: 'Voiker SMM API key is not configured yet. Configure key in Admin Controls or environment.'
        });
      }

      try {
        let balRes = await queryVoikerApi('balance', {}, 10000, 'POST');
        if (!balRes || balRes.error || balRes.balance === undefined) {
          try {
            const getRes = await queryVoikerApi('balance', {}, 10000, 'GET');
            if (getRes && getRes.balance !== undefined) {
              balRes = getRes;
            }
          } catch {}
        }

        if (balRes && balRes.error) {
          return res.status(422).json({
            success: false,
            hasApiKey: true,
            error: balRes.error || 'Voiker rejected balance query.',
            raw: balRes
          });
        }

        const balanceUsd = Number(balRes?.balance ?? 0);
        const balanceNgn = Math.round(balanceUsd * config.usdToNgnRate);

        return res.json({
          success: true,
          provider: 'Voiker',
          hasApiKey: true,
          balanceUsd,
          balanceNgn,
          currency: balRes?.currency || 'USD',
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
      let uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);

      // Robust fallback: if header decoding needs claim check against req.body.userId
      if (!uid && req.body?.userId && typeof req.body.userId === 'string') {
        const candidateUid = req.body.userId.trim();
        if (authHeader.startsWith('Bearer ')) {
          try {
            const raw = authHeader.substring(7).split('.')[1];
            let b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            const p = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
            const sub = p.sub || p.user_id;
            const now = Math.floor(Date.now() / 1000);
            if (sub === candidateUid && (!p.exp || (p.exp + 300) > now)) {
              uid = candidateUid;
            }
          } catch {}
        }
      }

      if (!uid) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token. Please sign in again.' });
      }

      if (!db) {
        return res.status(503).json({ success: false, error: 'Database service is currently initializing. Please try again in a moment.' });
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

      // Strict requested limits: Views 1,000 to 1,000,000 | Regular 100 to 100,000
      const isViews = isViewsService(matchedSvc);
      const effectiveMin = isViews ? 1000 : 100;
      const effectiveMax = isViews ? 1000000 : 100000;

      const orderQty = Math.round(Number(quantity));
      if (orderQty < effectiveMin || orderQty > effectiveMax) {
        return res.status(400).json({
          success: false,
          error: `Quantity must be between ${effectiveMin.toLocaleString()} and ${effectiveMax.toLocaleString()} for this service.`
        });
      }

      // Calculate customer price using verified ZENET HUB pricing engine
      const { customerRatePer1000 } = calculateCustomerPrice(
        matchedSvc.providerRatePer1000,
        settings,
        matchedSvc.id,
        matchedSvc.name,
        matchedSvc.category,
        matchedSvc.type
      );
      const totalCharge = Math.max(1, Math.round((customerRatePer1000 / 1000) * orderQty));
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
            const errMsg = String(voikerRes.error || voikerRes.message);
            console.warn('[Voiker] Order dispatch rejected by provider:', errMsg);
            let friendlyError = errMsg;
            if (/insufficient_funds|not enough funds|balance/i.test(errMsg)) {
              friendlyError = 'The SMM provider account balance is awaiting funding. Your wallet balance was not charged. Please try again shortly or contact support.';
            } else if (/link|url/i.test(errMsg)) {
              friendlyError = `Target link or username rejected by provider: ${errMsg}. Your wallet balance was not charged.`;
            } else if (/quantity|min|max/i.test(errMsg)) {
              friendlyError = `Order quantity rejected by provider: ${errMsg}. Your wallet balance was not charged.`;
            } else {
              friendlyError = `Provider notice: ${errMsg}. Your wallet balance was not charged.`;
            }
            return res.status(422).json({
              success: false,
              code: voikerRes.error || 'PROVIDER_REJECTED',
              error: friendlyError
            });
          } else {
            return res.status(422).json({
              success: false,
              code: 'PROVIDER_ERROR',
              error: 'The SMM provider network encountered an issue processing this order. Your wallet balance was not charged.'
            });
          }
        } catch (upstreamErr: any) {
          console.warn('[Voiker] Order upstream communication error:', upstreamErr.message);
          return res.status(502).json({
            success: false,
            code: 'PROVIDER_UNAVAILABLE',
            error: `Unable to connect to the SMM provider network (${upstreamErr.message}). Your wallet was not charged.`
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
      let finalNewBalance = currentBal - totalCharge;
      try {
        await runTransaction(db, async (tx) => {
          const uSnap = await tx.get(userRef);
          if (!uSnap.exists()) throw new Error('User profile not found.');
          const cur = Number(uSnap.data().walletBalance ?? uSnap.data().balance ?? 0);
          if (cur < totalCharge) {
            throw new Error(`Insufficient wallet balance. Order costs ₦${totalCharge.toLocaleString()}`);
          }

          finalNewBalance = cur - totalCharge;
          tx.update(userRef, {
            walletBalance: finalNewBalance,
            balance: finalNewBalance,
            updatedAt: new Date().toISOString()
          });
          tx.set(doc(db, 'wallets', uid), {
            userId: uid,
            userEmail,
            walletBalance: finalNewBalance,
            balance: finalNewBalance,
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
            charge: totalCharge,
            profit,
            currency: 'NGN',
            status: initialStatus,
            refill: matchedSvc.refill,
            cancel: matchedSvc.cancel,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });

        // Trigger confirmation email notification
        if (userEmail) {
          sendSocialBoostOrderSuccessEmail({
            to: userEmail,
            name: userName || undefined,
            serviceName: matchedSvc.name,
            targetUrl: target.trim(),
            quantity: orderQty,
            amount: totalCharge,
            orderId,
            db
          }).catch(e => console.warn('[Voiker] Order success email notice:', e.message));
        }
      } catch (txErr: any) {
        console.error('[Voiker] Post-allocation wallet deduction error:', txErr);
        return res.status(500).json({ success: false, error: txErr.message });
      }

      return res.json({
        success: true,
        message: 'Boosting order placed successfully and sent to Voiker provider!',
        newBalance: finalNewBalance,
        order: {
          id: orderId,
          orderId,
          providerOrderId,
          serviceName: matchedSvc.name,
          platform: matchedSvc.platform,
          target: target.trim(),
          quantity: orderQty,
          totalCharge,
          status: initialStatus,
          createdAt: new Date().toISOString()
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
      let uid = authHeader ? verifyFirebaseIdToken(authHeader, firebaseProjectId) : null;
      if (!uid) {
        const candidateUid = (req.query.userId || req.body.userId || '').toString().trim();
        if (candidateUid) {
          uid = candidateUid;
        }
      }
      if (!uid || !db) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const isOwner = await isOwnerRequest();
      const ordersCol = collection(db, 'social_boost_orders');
      let q = query(ordersCol, where('userId', '==', uid));
      if (isOwner && req.query.all === 'true') {
        q = query(ordersCol);
      }

      const snap = await getDocs(q);
      const ordersList: any[] = [];
      snap.forEach(d => {
        const orderData = d.data();
        if (!isOwner) {
          delete orderData.profit;
          delete orderData.providerRatePer1000;
        }
        ordersList.push(orderData);
      });

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
        defaultMarkupFixedNgn,
        minMarkupPer1k,
        usdToNgnRate,
        pricingStyle,
        platformStatus,
        disabledServices,
        categoryMarkups,
        serviceOverrides,
        apiKey
      } = req.body;

      const newSettings: VoikerPricingSettings = {
        defaultMarkupPercent: Math.max(0, Math.min(300, Number(defaultMarkupPercent) || 0)),
        defaultMarkupFixedNgn: typeof defaultMarkupFixedNgn === 'number'
          ? Math.max(0, Math.round(defaultMarkupFixedNgn))
          : (cachedPricingSettings.defaultMarkupFixedNgn ?? 0),
        minMarkupPer1k: Math.max(0, Number(minMarkupPer1k) || 0),
        usdToNgnRate: Math.max(500, Number(usdToNgnRate) || 1650),
        pricingStyle: ['natural', 'clean', 'tiered'].includes(pricingStyle) ? pricingStyle : 'natural',
        platformStatus: platformStatus || cachedPricingSettings.platformStatus,
        disabledServices: Array.isArray(disabledServices) ? disabledServices : (cachedPricingSettings.disabledServices || []),
        curatedServiceIds: cachedPricingSettings.curatedServiceIds || [],
        bestValueServiceIds: cachedPricingSettings.bestValueServiceIds || {},
        categoryMarkups: categoryMarkups || cachedPricingSettings.categoryMarkups || {},
        serviceOverrides: serviceOverrides || cachedPricingSettings.serviceOverrides || {}
      };

      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        const cleanKey = apiKey.trim();
        newSettings.apiKey = cleanKey;
        process.env.VOIKER_API_KEY = cleanKey;
      } else if (cachedPricingSettings.apiKey) {
        newSettings.apiKey = cachedPricingSettings.apiKey;
      }

      await setDoc(doc(db, 'system_settings', 'voiker_pricing'), newSettings, { merge: true });
      cachedPricingSettings = newSettings;
      lastPricingSettingsLoadTime = Date.now();

      const effectiveCfg = getVoikerConfig();
      const maskedKey = effectiveCfg.apiKey ? `${effectiveCfg.apiKey.substring(0, 4)}••••••••${effectiveCfg.apiKey.substring(Math.max(0, effectiveCfg.apiKey.length - 4))}` : '';

      return res.json({
        success: true,
        message: 'Voiker boosting pricing and configuration updated successfully.',
        settings: {
          ...newSettings,
          apiKey: undefined,
          hasApiKey: effectiveCfg.hasApiKey,
          maskedApiKey: maskedKey
        }
      });
    }

    if (action === 'pricing-settings' && method === 'GET') {
      const effectiveCfg = getVoikerConfig();
      const maskedKey = effectiveCfg.apiKey ? `${effectiveCfg.apiKey.substring(0, 4)}••••••••${effectiveCfg.apiKey.substring(Math.max(0, effectiveCfg.apiKey.length - 4))}` : '';
      return res.json({
        success: true,
        settings: {
          ...cachedPricingSettings,
          categoryMarkups: cachedPricingSettings.categoryMarkups || {
            Followers: { markupFixedNgn: 0, markupPercent: 0 },
            Views: { markupFixedNgn: 0, markupPercent: 0 },
            Likes: { markupFixedNgn: 0, markupPercent: 0 },
            Comments: { markupFixedNgn: 0, markupPercent: 0 },
            Shares: { markupFixedNgn: 0, markupPercent: 0 },
            Subscribers: { markupFixedNgn: 0, markupPercent: 0 },
            Other: { markupFixedNgn: 0, markupPercent: 0 }
          },
          apiKey: undefined,
          hasApiKey: effectiveCfg.hasApiKey,
          maskedApiKey: maskedKey
        }
      });
    }

    // ------------------------------------------------------------------------
    // 9. POST / SAVE MARKUP (SINGLE SERVICE OR GLOBAL DEFAULT) (action=save-markup)
    // ------------------------------------------------------------------------
    if (action === 'save-markup' && method === 'POST') {
      const isOwner = await isOwnerRequest();
      if (!isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
      }
      if (!db) return res.status(500).json({ success: false, error: 'Database not ready' });

      const { serviceId, customMarkupFixedNgn, defaultMarkupFixedNgn } = req.body;
      const currentOverrides = { ...(cachedPricingSettings.serviceOverrides || {}) };

      if (serviceId) {
        if (customMarkupFixedNgn === null || customMarkupFixedNgn === undefined || customMarkupFixedNgn === '' || customMarkupFixedNgn === 'reset') {
          // Reset to global markup
          if (currentOverrides[serviceId]) {
            const copy = { ...currentOverrides[serviceId] };
            delete copy.customMarkupFixedNgn;
            if (Object.keys(copy).length === 0) {
              delete currentOverrides[serviceId];
            } else {
              currentOverrides[serviceId] = copy;
            }
          }
        } else {
          const markupVal = Math.max(0, Math.round(Number(customMarkupFixedNgn) || 0));
          currentOverrides[serviceId] = {
            ...(currentOverrides[serviceId] || {}),
            customMarkupFixedNgn: markupVal
          };
        }
      }

      let newDefaultMarkup = cachedPricingSettings.defaultMarkupFixedNgn || 0;
      if (typeof defaultMarkupFixedNgn === 'number') {
        newDefaultMarkup = Math.max(0, Math.round(defaultMarkupFixedNgn));
      }

      cachedPricingSettings = {
        ...cachedPricingSettings,
        defaultMarkupFixedNgn: newDefaultMarkup,
        serviceOverrides: currentOverrides
      };

      await setDoc(doc(db, 'system_settings', 'voiker_pricing'), {
        defaultMarkupFixedNgn: newDefaultMarkup,
        serviceOverrides: currentOverrides,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      lastPricingSettingsLoadTime = Date.now();

      return res.json({
        success: true,
        message: serviceId ? `Markup saved for ${serviceId}` : 'Default markup updated',
        defaultMarkupFixedNgn: newDefaultMarkup,
        serviceOverrides: currentOverrides
      });
    }

    // ------------------------------------------------------------------------
    // 10. POST / SAVE BULK MARKUPS (SERVICES, CATEGORIES, & GLOBAL) (action=save-bulk-markups)
    // ------------------------------------------------------------------------
    if ((action === 'save-bulk-markups' || action === 'bulk-markup') && method === 'POST') {
      const isOwner = await isOwnerRequest();
      if (!isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
      }
      if (!db) return res.status(500).json({ success: false, error: 'Database not ready' });

      const { markups, categoryMarkups, defaultMarkupFixedNgn, defaultMarkupPercent } = req.body;
      const currentOverrides = { ...(cachedPricingSettings.serviceOverrides || {}) };

      if (markups && typeof markups === 'object') {
        for (const [svcId, markupVal] of Object.entries(markups)) {
          if (markupVal === null || markupVal === undefined || markupVal === '' || markupVal === 'reset') {
            if (currentOverrides[svcId]) {
              const copy = { ...currentOverrides[svcId] };
              delete copy.customMarkupFixedNgn;
              if (Object.keys(copy).length === 0) {
                delete currentOverrides[svcId];
              } else {
                currentOverrides[svcId] = copy;
              }
            }
          } else {
            const num = Math.max(0, Math.round(Number(markupVal) || 0));
            currentOverrides[svcId] = {
              ...(currentOverrides[svcId] || {}),
              customMarkupFixedNgn: num
            };
          }
        }
      }

      const currentCategoryMarkups = { ...(cachedPricingSettings.categoryMarkups || {}) };
      if (categoryMarkups && typeof categoryMarkups === 'object') {
        for (const [cat, val] of Object.entries(categoryMarkups)) {
          if (val && typeof val === 'object') {
            currentCategoryMarkups[cat] = {
              markupFixedNgn: Math.max(0, Math.round(Number((val as any).markupFixedNgn) || 0)),
              markupPercent: Math.max(0, Math.min(500, Number((val as any).markupPercent) || 0))
            };
          }
        }
      }

      let newDefaultMarkup = cachedPricingSettings.defaultMarkupFixedNgn || 0;
      if (typeof defaultMarkupFixedNgn === 'number') {
        newDefaultMarkup = Math.max(0, Math.round(defaultMarkupFixedNgn));
      }

      let newDefaultPercent = cachedPricingSettings.defaultMarkupPercent || 0;
      if (typeof defaultMarkupPercent === 'number') {
        newDefaultPercent = Math.max(0, Math.min(300, Math.round(defaultMarkupPercent)));
      }

      cachedPricingSettings = {
        ...cachedPricingSettings,
        categoryMarkups: currentCategoryMarkups,
        defaultMarkupFixedNgn: newDefaultMarkup,
        defaultMarkupPercent: newDefaultPercent,
        serviceOverrides: currentOverrides
      };

      await setDoc(doc(db, 'system_settings', 'voiker_pricing'), {
        categoryMarkups: currentCategoryMarkups,
        defaultMarkupFixedNgn: newDefaultMarkup,
        defaultMarkupPercent: newDefaultPercent,
        serviceOverrides: currentOverrides,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      lastPricingSettingsLoadTime = Date.now();

      return res.json({
        success: true,
        message: 'All pricing markups and category settings permanently saved to database',
        defaultMarkupFixedNgn: newDefaultMarkup,
        defaultMarkupPercent: newDefaultPercent,
        categoryMarkups: currentCategoryMarkups,
        serviceOverrides: currentOverrides
      });
    }

    // ------------------------------------------------------------------------
    // 11. POST / SAVE CATEGORY MARKUPS (action=save-category-markups)
    // ------------------------------------------------------------------------
    if (action === 'save-category-markups' && method === 'POST') {
      const isOwner = await isOwnerRequest();
      if (!isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
      }
      if (!db) return res.status(500).json({ success: false, error: 'Database not ready' });

      const { categoryMarkups, defaultMarkupFixedNgn } = req.body;
      const currentCategoryMarkups = { ...(cachedPricingSettings.categoryMarkups || {}) };
      if (categoryMarkups && typeof categoryMarkups === 'object') {
        for (const [cat, val] of Object.entries(categoryMarkups)) {
          if (val && typeof val === 'object') {
            currentCategoryMarkups[cat] = {
              markupFixedNgn: Math.max(0, Math.round(Number((val as any).markupFixedNgn) || 0)),
              markupPercent: Math.max(0, Math.min(500, Number((val as any).markupPercent) || 0))
            };
          }
        }
      }

      let newDefaultMarkup = cachedPricingSettings.defaultMarkupFixedNgn || 0;
      if (typeof defaultMarkupFixedNgn === 'number') {
        newDefaultMarkup = Math.max(0, Math.round(defaultMarkupFixedNgn));
      }

      cachedPricingSettings = {
        ...cachedPricingSettings,
        categoryMarkups: currentCategoryMarkups,
        defaultMarkupFixedNgn: newDefaultMarkup
      };

      await setDoc(doc(db, 'system_settings', 'voiker_pricing'), {
        categoryMarkups: currentCategoryMarkups,
        defaultMarkupFixedNgn: newDefaultMarkup,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      lastPricingSettingsLoadTime = Date.now();

      return res.json({
        success: true,
        message: 'Category markups saved successfully',
        categoryMarkups: currentCategoryMarkups,
        defaultMarkupFixedNgn: newDefaultMarkup
      });
    }

    return res.status(400).json({ success: false, error: `Unsupported action: ${action}` });

  } catch (err: any) {
    console.error('Voiker Boosting Gateway Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Voiker Boosting Gateway service error' });
  }
};
