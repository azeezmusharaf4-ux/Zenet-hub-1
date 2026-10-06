import express from 'express';
import crypto from 'crypto';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { isAuthorizedOwnerEmail, isAuthorizedOwnerUid } from '../lib/authorizedOwners';

// =========================================================================
// VIRTUALSMSNUMBERS INTEGRATION GATEWAY (SERVER-SIDE PROXY)
// Base URL: https://virtualsmsnumbers.com/api/v1
// Auth: Authorization: Bearer <VSN_API_KEY>
// =========================================================================

export interface VirtualNumberPricingSettings {
  optionsCount: number;
  minMarkup: number;
  maxMarkup: number;
  pricingStyle: 'natural' | 'clean' | 'tiered';
  eurToNgnRate?: number;
}

// In-memory cache
let cachedVsnCountries: any[] | null = null;
let lastVsnCountriesFetch = 0;
let cachedVsnServices: any[] | null = null;
let lastVsnServicesFetch = 0;
let cachedPricingSettings: VirtualNumberPricingSettings = {
  optionsCount: 4,
  minMarkup: 500,
  maxMarkup: 4500,
  pricingStyle: 'natural',
  eurToNgnRate: 1750
};

// Purchase idempotency locks
const userOrderLocks = new Map<string, number>();

let lastPricingSettingsFetch = 0;
export const loadPricingSettingsFromDb = async (db: Firestore | null) => {
  if (!db || (Date.now() - lastPricingSettingsFetch < 60000)) return cachedPricingSettings;
  try {
    const sRef = doc(db, 'system_settings', 'virtual_number_pricing');
    const sSnap = await getDoc(sRef);
    if (sSnap.exists()) {
      const data = sSnap.data() as Partial<VirtualNumberPricingSettings>;
      cachedPricingSettings = {
        optionsCount: Math.min(Math.max(Number(data.optionsCount) || 4, 2), 6),
        minMarkup: Math.max(Number(data.minMarkup) || 500, 100),
        maxMarkup: Math.max(Number(data.maxMarkup) || 4500, 500),
        pricingStyle: (['natural', 'clean', 'tiered'].includes(data.pricingStyle as any) ? data.pricingStyle : 'natural') as any,
        eurToNgnRate: Number(data.eurToNgnRate) || Number(process.env.EUR_TO_NGN_RATE) || cachedPricingSettings.eurToNgnRate || 1750
      };
      lastPricingSettingsFetch = Date.now();
    }
  } catch (err: any) {
    console.warn('[VirtualSMSNumbers] Pricing settings load notice:', err?.message || err);
  }
  return cachedPricingSettings;
};

export const getVirtualSMSNumbersConfig = () => {
  const candidates = [
    process.env.VSN_API_KEY,
    process.env.VIRTUALSMSNUMBERS_API_KEY,
    process.env.VIRTUAL_SMS_NUMBERS_API_KEY,
    process.env.VSN_KEY
  ];
  let apiKey = '';
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      const clean = c.trim().replace(/^['"`]|['"`]$/g, '').trim();
      if (clean && clean !== 'undefined' && clean !== 'null' && !clean.startsWith('MY_')) {
        apiKey = clean;
        break;
      }
    }
  }
  const baseUrl = (process.env.VSN_BASE_URL || 'https://virtualsmsnumbers.com/api/v1').trim().replace(/\/+$/, '');
  const eurToNgnRate = Number(process.env.EUR_TO_NGN_RATE) || cachedPricingSettings.eurToNgnRate || 1750;
  // Markups are temporarily disabled for VirtualSMSNumbers (zero markup, exact provider cost only)
  return { apiKey, baseUrl, hasApiKey: Boolean(apiKey), eurToNgnRate, markup: 0 };
};

// Generic upstream client
export const queryVirtualSMSNumbers = async (
  endpoint: string,
  params: Record<string, any> = {},
  method: 'GET' | 'POST' = 'GET',
  customTimeoutMs: number = 15000
) => {
  const { apiKey, baseUrl } = getVirtualSMSNumbersConfig();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let url = `${baseUrl}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'ZENET-Hub-VirtualSMSNumbers/1.0'
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let body: any = undefined;
  if (method === 'GET') {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        q.set(k, String(v));
      }
    }
    const qs = q.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  } else {
    headers['Content-Type'] = 'application/json';
    headers['Idempotency-Key'] = params['Idempotency-Key'] || crypto.randomUUID();
    const cleanBodyParams = { ...params };
    delete cleanBodyParams['Idempotency-Key'];
    body = JSON.stringify(cleanBodyParams);
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(customTimeoutMs)
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawText: text };
  }

  if (!response.ok) {
    const errCode = json?.error?.code || 'upstream_error';
    const errMsg = json?.error?.message || `VirtualSMSNumbers HTTP ${response.status}: ${text.slice(0, 150)}`;
    const error: any = new Error(errMsg);
    error.status = response.status;
    error.code = errCode;
    error.data = json;
    throw error;
  }

  return json;
};

// Cached countries fetcher
export const getVsnCountriesList = async () => {
  if (cachedVsnCountries && Date.now() - lastVsnCountriesFetch < 10 * 60 * 1000) {
    return cachedVsnCountries;
  }
  try {
    const res = await queryVirtualSMSNumbers('/countries');
    if (res && Array.isArray(res.data)) {
      cachedVsnCountries = res.data;
      lastVsnCountriesFetch = Date.now();
      return cachedVsnCountries;
    }
  } catch (err: any) {
    console.warn('[VirtualSMSNumbers] Countries fetch notice:', err.message);
  }
  return cachedVsnCountries || [
    { id: 12, code: 'US', name: 'United States', dial_code: '+1', region: 'North America', flag: '🇺🇸' },
    { id: 16, code: 'GB', name: 'United Kingdom', dial_code: '+44', region: 'Europe', flag: '🇬🇧' },
    { id: 36, code: 'CA', name: 'Canada', dial_code: '+1', region: 'North America', flag: '🇨🇦' },
    { id: 19, code: 'NG', name: 'Nigeria', dial_code: '+234', region: 'Africa', flag: '🇳🇬' },
    { id: 117, code: 'PT', name: 'Portugal', dial_code: '+351', region: 'Europe', flag: '🇵🇹' },
    { id: 77, code: 'FR', name: 'France', dial_code: '+33', region: 'Europe', flag: '🇫🇷' },
    { id: 43, code: 'DE', name: 'Germany', dial_code: '+49', region: 'Europe', flag: '🇩🇪' },
    { id: 48, code: 'NL', name: 'Netherlands', dial_code: '+31', region: 'Europe', flag: '🇳🇱' },
    { id: 73, code: 'BR', name: 'Brazil', dial_code: '+55', region: 'South America', flag: '🇧🇷' },
    { id: 22, code: 'IN', name: 'India', dial_code: '+91', region: 'Asia', flag: '🇮🇳' },
    { id: 6, code: 'ID', name: 'Indonesia', dial_code: '+62', region: 'Asia', flag: '🇮🇩' },
    { id: 4, code: 'PH', name: 'Philippines', dial_code: '+63', region: 'Asia', flag: '🇵🇭' },
    { id: 31, code: 'ZA', name: 'South Africa', dial_code: '+27', region: 'Africa', flag: '🇿🇦' },
    { id: 38, code: 'GH', name: 'Ghana', dial_code: '+233', region: 'Africa', flag: '🇬🇭' },
    { id: 8, code: 'KE', name: 'Kenya', dial_code: '+254', region: 'Africa', flag: '🇰🇪' }
  ];
};

// Cached services fetcher
export const getVsnServicesList = async () => {
  if (cachedVsnServices && Date.now() - lastVsnServicesFetch < 10 * 60 * 1000) {
    return cachedVsnServices;
  }
  try {
    const res = await queryVirtualSMSNumbers('/services');
    if (res && Array.isArray(res.data)) {
      cachedVsnServices = res.data;
      lastVsnServicesFetch = Date.now();
      return cachedVsnServices;
    }
  } catch (err: any) {
    console.warn('[VirtualSMSNumbers] Services fetch notice:', err.message);
  }
  return cachedVsnServices || [
    { id: 1, slug: 'telegram', code: 'tg', name: 'Telegram', category: 'messaging' },
    { id: 2, slug: 'whatsapp', code: 'wa', name: 'WhatsApp & WA Business', category: 'messaging' },
    { id: 3, slug: 'google', code: 'go', name: 'Google / Gmail / YouTube', category: 'social' },
    { id: 4, slug: 'openai', code: 'oi', name: 'OpenAI / ChatGPT', category: 'ai' },
    { id: 5, slug: 'instagram', code: 'ig', name: 'Instagram & Threads', category: 'social' },
    { id: 6, slug: 'facebook', code: 'fb', name: 'Facebook & Messenger', category: 'social' },
    { id: 7, slug: 'twitter', code: 'tw', name: 'Twitter / X', category: 'social' },
    { id: 8, slug: 'tiktok', code: 'tk', name: 'TikTok', category: 'social' },
    { id: 9, slug: 'netflix', code: 'nf', name: 'Netflix', category: 'entertainment' },
    { id: 10, slug: 'apple', code: 'wx', name: 'Apple / iCloud', category: 'tech' },
    { id: 11, slug: 'discord', code: 'ds', name: 'Discord', category: 'gaming' },
    { id: 12, slug: 'snapchat', code: 'fu', name: 'Snapchat', category: 'social' },
    { id: 13, slug: 'paypal', code: 'ts', name: 'PayPal Verification', category: 'finance' },
    { id: 14, slug: 'binance', code: 'wb', name: 'Binance / Crypto', category: 'finance' }
  ];
};

// Resolver from user input (numeric legacy ID, ISO code, or country name) to ISO 2-letter code
export const resolveToVsnCountryCode = (countryInput: string, countriesList: any[] = []): string => {
  if (!countryInput) return 'US';
  const clean = countryInput.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(clean)) {
    return clean;
  }
  const lower = countryInput.trim().toLowerCase();
  const commonCountryMap: Record<string, string> = {
    'united states': 'US',
    'usa': 'US',
    'united kingdom': 'GB',
    'uk': 'GB',
    'canada': 'CA',
    'nigeria': 'NG',
    'portugal': 'PT',
    'france': 'FR',
    'germany': 'DE',
    'netherlands': 'NL',
    'brazil': 'BR',
    'india': 'IN',
    'indonesia': 'ID',
    'philippines': 'PH',
    'south africa': 'ZA',
    'ghana': 'GH',
    'kenya': 'KE'
  };
  if (commonCountryMap[lower]) {
    return commonCountryMap[lower];
  }
  for (const c of countriesList) {
    if (String(c.id) === countryInput || c.code?.toUpperCase() === clean || c.name?.toLowerCase() === lower) {
      return (c.code || 'US').toUpperCase();
    }
  }
  return clean.slice(0, 2);
};

// Resolver from user input (short code or service name) to canonical VirtualSMSNumbers service slug
export const resolveToVsnServiceSlug = (serviceInput: string, servicesList: any[] = []): string => {
  if (!serviceInput) return 'telegram';
  const clean = serviceInput.trim().toLowerCase();
  for (const s of servicesList) {
    if (s.slug?.toLowerCase() === clean || s.code?.toLowerCase() === clean || s.name?.toLowerCase() === clean) {
      return s.slug || clean;
    }
  }
  const commonMap: Record<string, string> = {
    tg: 'telegram',
    wa: 'whatsapp',
    go: 'google',
    oi: 'openai',
    ig: 'instagram',
    fb: 'facebook',
    tw: 'twitter',
    tk: 'tiktok',
    tt: 'tiktok',
    nf: 'netflix',
    wx: 'apple',
    ap: 'apple',
    ds: 'discord',
    fu: 'snapchat',
    sc: 'snapchat',
    ts: 'paypal',
    pp: 'paypal',
    wb: 'binance',
    bn: 'binance',
    am: 'amazon',
    st: 'steam',
    ub: 'uber',
    ti: 'tinder',
    vi: 'viber',
    mb: 'yahoo'
  };
  return commonMap[clean] || clean;
};

// Generate tier price options
// Generate tier price options with ZERO markup for VirtualSMSNumbers
export const generateVsnPriceOptions = (
  providerCost: number,
  settings: VirtualNumberPricingSettings,
  isOwner: boolean
) => {
  const pCost = Math.round(Number(providerCost) || 0);
  if (pCost <= 0) return [];

  // Temporarily disable ALL profit margins and markups for VirtualSMSNumbers.
  // Customers see the converted provider cost only, with no additional profit percentage,
  // fixed fee, tier markup, or hidden charge.
  // Both Standard Line and Fast Priority options use the exact documented provider price.
  const defaultTiers = [
    { id: 'opt_1', name: 'Standard Line', badge: 'Standard', desc: 'Direct carrier routing (Exact provider cost)' },
    { id: 'opt_2', name: 'Fast Priority', badge: 'Fast', desc: 'Direct carrier routing (Exact provider cost)' }
  ];

  return defaultTiers.map((tierMeta, i) => {
    const opt: any = {
      optionId: tierMeta.id,
      tierIndex: i,
      tierName: tierMeta.name,
      badge: tierMeta.badge,
      description: tierMeta.desc,
      customerPrice: pCost, // Exact converted provider cost, ZERO markup
      currency: 'NGN'
    };

    if (isOwner) {
      opt.providerCost = pCost;
      opt.markup = 0;
      opt.profit = 0;
      opt.marginPercent = 0;
    }

    return opt;
  });
};

/**
 * Dedicated VirtualSMSNumbers Webhook Handler
 * Endpoint: POST /hooks/virtualsmsnumbers
 * 
 * Requirements:
 * 1. Accept JSON webhook requests from VirtualSMSNumbers.
 * 2. Preserve raw request body for HMAC-SHA256 signature verification.
 * 3. Read the X-VSN-Signature header.
 * 4. Verify signature using server environment variable VSN_WEBHOOK_SECRET.
 * 5. Reject invalid signatures with HTTP 401.
 * 6. Reject webhook timestamps older than 5 minutes.
 * 7. Parse valid webhook events.
 * 8. Return HTTP 200 for successfully processed events.
 * 9. Never expose VSN_WEBHOOK_SECRET or any API key to the frontend.
 */
export const handleVirtualSMSNumbersWebhook = async (
  req: express.Request,
  res: express.Response,
  db: Firestore | null
) => {
  try {
    const rawSignatureHeader = (
      req.headers['x-vsn-signature'] ||
      req.headers['x-signature'] ||
      req.get('X-VSN-Signature') ||
      req.get('x-vsn-signature') ||
      ''
    ).toString().trim();

    // 1. Signature presence check: Reject missing signature with 401
    if (!rawSignatureHeader) {
      console.warn('[VirtualSMSNumbers Webhook] Rejected: Missing X-VSN-Signature header.');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing X-VSN-Signature header.'
      });
    }

    // 2. Secret presence check: Verify using server environment variable VSN_WEBHOOK_SECRET
    const webhookSecret = (process.env.VSN_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      console.warn('[VirtualSMSNumbers Webhook] Rejected: VSN_WEBHOOK_SECRET is not configured on server.');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Webhook verification secret not configured on server.'
      });
    }

    // 3. Preserve raw request body for HMAC-SHA256 signature verification
    const rawBodyBuffer: Buffer = (req as any).rawBody || Buffer.from(
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    );
    const rawBodyStr = rawBodyBuffer.toString('utf8');

    // 4. Extract timestamp and signature hash
    // Standard formats: "t=1727900000,v1=abcdef..." or "t=1727900000,s=..." or raw hex "abcdef..."
    let timestampValue: string | null = null;
    let signatureHash = rawSignatureHeader;

    if (rawSignatureHeader.includes('t=') || rawSignatureHeader.includes('v1=') || rawSignatureHeader.includes('s=')) {
      const parts = rawSignatureHeader.split(/[,;]\s*/);
      for (const part of parts) {
        const [k, ...vArr] = part.split('=');
        const key = k.trim().toLowerCase();
        const val = vArr.join('=').trim();
        if (key === 't') {
          timestampValue = val;
        } else if (key === 'v1' || key === 's' || key === 'sha256') {
          signatureHash = val;
        }
      }
    } else {
      signatureHash = rawSignatureHeader.replace(/^sha256=/i, '').trim();
    }

    // Fallback timestamp extraction from headers or payload
    if (!timestampValue) {
      const tsHeader = (
        req.headers['x-vsn-timestamp'] ||
        req.headers['x-timestamp'] ||
        req.headers['x-webhook-timestamp'] ||
        req.get('X-VSN-Timestamp') ||
        ''
      ).toString().trim();
      if (tsHeader) {
        timestampValue = tsHeader;
      } else if (req.body && (req.body.timestamp || req.body.created_at || req.body.event_timestamp || req.body.time)) {
        timestampValue = String(req.body.timestamp || req.body.created_at || req.body.event_timestamp || req.body.time).trim();
      }
    }

    // 5. Reject webhook timestamps older than 5 minutes (300 seconds)
    if (timestampValue) {
      let eventTimeMs = 0;
      const numTs = Number(timestampValue);
      if (!isNaN(numTs) && numTs > 0) {
        eventTimeMs = numTs < 1e11 ? numTs * 1000 : numTs;
      } else {
        const parsed = Date.parse(timestampValue);
        if (!isNaN(parsed) && parsed > 0) {
          eventTimeMs = parsed;
        }
      }

      if (eventTimeMs > 0) {
        const ageMs = Date.now() - eventTimeMs;
        const maxAgeMs = 5 * 60 * 1000; // 5 minutes
        if (ageMs > maxAgeMs || ageMs < -maxAgeMs) {
          console.warn(`[VirtualSMSNumbers Webhook] Rejected: Timestamp older than 5 minutes (age: ${Math.round(ageMs / 1000)}s).`);
          return res.status(401).json({
            success: false,
            error: 'Unauthorized: Webhook timestamp older than 5 minutes.'
          });
        }
      }
    }

    // 6. Compute HMAC-SHA256 signature verification
    const cleanSig = signatureHash.trim().toLowerCase();
    const candidatePayloads: string[] = [];
    if (timestampValue) {
      candidatePayloads.push(`${timestampValue}.${rawBodyStr}`);
      candidatePayloads.push(`${timestampValue}${rawBodyStr}`);
    }
    candidatePayloads.push(rawBodyStr);

    let signatureValid = false;
    for (const testPayload of candidatePayloads) {
      const computedHex = crypto.createHmac('sha256', webhookSecret).update(testPayload).digest('hex').toLowerCase();
      if (computedHex.length === cleanSig.length) {
        try {
          if (crypto.timingSafeEqual(Buffer.from(computedHex), Buffer.from(cleanSig))) {
            signatureValid = true;
            break;
          }
        } catch {
          // continue
        }
      }
    }

    if (!signatureValid) {
      console.warn('[VirtualSMSNumbers Webhook] Rejected: Invalid HMAC-SHA256 signature.');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid signature.'
      });
    }

    // 7. Parse valid webhook event
    let payload: any = {};
    try {
      payload = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBodyStr || '{}');
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON payload.' });
    }

    const eventName = (payload.event || payload.type || payload.action || payload.status || '').toString().toLowerCase();
    console.log(`[VirtualSMSNumbers Webhook] Verified event received: "${eventName}"`);

    // 8. Process valid webhook event in Firestore
    if (db) {
      const dataObj = (payload.data && typeof payload.data === 'object') ? payload.data : payload;
      const providerActivationId = (
        dataObj.activation_id ||
        dataObj.activationId ||
        dataObj.id ||
        dataObj.order_id ||
        dataObj.orderId ||
        payload.activation_id ||
        payload.id ||
        ''
      ).toString().trim();

      const code = (dataObj.code || dataObj.otp || dataObj.sms_code || dataObj.smsCode || payload.code || '').toString().trim();
      const smsText = (dataObj.text || dataObj.sms || dataObj.message || payload.text || payload.sms || '').toString().trim();
      const statusUpper = (dataObj.status || payload.status || '').toString().toUpperCase();

      if (providerActivationId) {
        let orderDocId = '';
        let orderData: any = null;

        const qSnap1 = await getDocs(query(collection(db, 'virtual_number_orders'), where('providerOrderId', '==', providerActivationId)));
        if (!qSnap1.empty) {
          orderDocId = qSnap1.docs[0].id;
          orderData = qSnap1.docs[0].data();
        } else {
          const qSnap2 = await getDocs(query(collection(db, 'virtual_number_orders'), where('providerActivationId', '==', providerActivationId)));
          if (!qSnap2.empty) {
            orderDocId = qSnap2.docs[0].id;
            orderData = qSnap2.docs[0].data();
          } else {
            const directSnap = await getDoc(doc(db, 'virtual_number_orders', providerActivationId));
            if (directSnap.exists()) {
              orderDocId = directSnap.id;
              orderData = directSnap.data();
            }
          }
        }

        if (orderDocId && orderData) {
          const nowIso = new Date().toISOString();
          const isSmsReceived = Boolean(code) || eventName.includes('received') || statusUpper === 'RECEIVED' || statusUpper === 'SMS_RECEIVED' || statusUpper === 'SUCCESS' || statusUpper === 'COMPLETED';

          if (isSmsReceived) {
            const updates: Record<string, any> = {
              status: 'RECEIVED',
              receivedAt: nowIso,
              updatedAt: nowIso
            };
            if (code) updates.code = code;
            if (smsText) updates.smsText = smsText;

            await updateDoc(doc(db, 'virtual_number_orders', orderDocId), updates);

            try {
              const pRef = doc(db, 'purchases', orderDocId);
              const pSnap = await getDoc(pRef);
              if (pSnap.exists()) {
                await updateDoc(pRef, {
                  status: 'completed',
                  fulfillmentData: {
                    ...(pSnap.data().fulfillmentData || {}),
                    code: code || pSnap.data().fulfillmentData?.code,
                    smsText: smsText || pSnap.data().fulfillmentData?.smsText,
                    completedAt: nowIso
                  }
                });
              }
            } catch (err: any) {
              console.warn('[VirtualSMSNumbers Webhook] Purchases sync notice:', err.message);
            }

            console.log(`[VirtualSMSNumbers Webhook] Order ${orderDocId} updated with received SMS code.`);
          } else if (eventName.includes('expired') || eventName.includes('timeout') || statusUpper === 'EXPIRED') {
            if (!orderData.refunded && orderData.status !== 'RECEIVED' && !orderData.code) {
              const refundAmount = Number(orderData.price || orderData.totalCharge || 0);
              const userRef = doc(db, 'users', orderData.userId);
              const refundTxId = `REF-VSN-${Date.now()}`;

              await runTransaction(db, async (tx) => {
                const uSnap = await tx.get(userRef);
                if (uSnap.exists()) {
                  const curBal = Number(uSnap.data().walletBalance || 0);
                  tx.update(userRef, { walletBalance: curBal + refundAmount });
                }
                tx.update(doc(db, 'virtual_number_orders', orderDocId), {
                  status: 'EXPIRED',
                  refunded: true,
                  refundedAt: nowIso,
                  updatedAt: nowIso
                });
                tx.set(doc(db, 'transactions', refundTxId), {
                  id: refundTxId,
                  userId: orderData.userId,
                  userEmail: orderData.userEmail || '',
                  type: 'refund',
                  amount: refundAmount,
                  currency: 'NGN',
                  status: 'completed',
                  description: `Automatic Refund: Expired Virtual Number activation (${orderDocId})`,
                  metadata: { orderId: orderDocId, providerActivationId, provider: 'VirtualSMSNumbers' },
                  createdAt: nowIso
                });
              });
              console.log(`[VirtualSMSNumbers Webhook] Order ${orderDocId} expired; refunded ₦${refundAmount} to user ${orderData.userId}`);
            } else {
              await updateDoc(doc(db, 'virtual_number_orders', orderDocId), {
                status: 'EXPIRED',
                updatedAt: nowIso
              });
            }
          } else if (eventName.includes('cancel') || statusUpper === 'CANCELLED') {
            await updateDoc(doc(db, 'virtual_number_orders', orderDocId), {
              status: 'CANCELLED',
              updatedAt: nowIso
            });
          }
        }
      }
    }

    // 9. Return HTTP 200 for successfully processed events
    return res.status(200).json({
      success: true,
      received: true,
      event: eventName || 'processed'
    });

  } catch (err: any) {
    console.error('[VirtualSMSNumbers Webhook] Processing error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing webhook'
    });
  }
};

// Express handler adapter
export const handleVirtualSMSNumbersGateway = async (
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

    if (!action) {
      return res.status(400).json({ success: false, error: 'Action parameter or subpath is required (e.g. servers, countries, services, price, buy, status, cancel, orders, balance, webhook).' });
    }

    const { apiKey, hasApiKey, eurToNgnRate } = getVirtualSMSNumbersConfig();

    const isOwnerRequest = async (): Promise<boolean> => {
      try {
        const authHeader = req.headers.authorization;
        let authUid = authHeader ? verifyFirebaseIdToken(authHeader, firebaseProjectId) : null;
        if (!authUid) {
          authUid = (req.body?.userId || req.query?.userId || '').toString() || null;
        }
        const emailCandidate = (req.body?.callerEmail || req.query?.callerEmail || req.body?.userEmail || req.query?.userEmail || '').toString().toLowerCase().trim();
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
      } catch (err) {
        console.error('[VirtualSMSNumbers] isOwnerRequest notice:', err);
      }
      return false;
    };

    // Enforce auth on stateful actions
    const statefulActions = ['buy', 'cancel', 'status', 'orders', 'complete'];
    if (statefulActions.includes(action)) {
      const authHeader = req.headers.authorization;
      let authUid = authHeader ? verifyFirebaseIdToken(authHeader, firebaseProjectId) : null;
      if (!authUid) {
        authUid = (req.body?.userId || req.query?.userId || '').toString() || null;
      }
      if (!authUid) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Valid user authentication is required.' });
      }
      (req as any).authUid = authUid;
    }

    // --- 1. WEBHOOK ENDPOINT (POST /hooks/virtualsmsnumbers) ---
    if (action === 'webhook') {
      return handleVirtualSMSNumbersWebhook(req, res, db);
    }

    // --- 2. GET REQUESTS ---
    if (method === 'GET') {
      // 2a. SERVERS
      if (action === 'servers') {
        const servers = [
          { id: 'all1', name: 'Global Direct Pool (225 Countries)', region: 'Global' },
          { id: 'usa1', name: 'USA & North America Dedicated Pool', region: 'USA' }
        ];
        return res.json({
          success: true,
          provider: 'VirtualSMSNumbers',
          hasApiKey,
          servers
        });
      }

      // 2b. COUNTRIES
      if (action === 'countries') {
        const server = (req.query.server || '').toString().toLowerCase();
        const vsnCountries = await getVsnCountriesList();

        let filtered = vsnCountries;
        if (server === 'usa1' || server === 'usa') {
          filtered = vsnCountries.filter((c: any) => c.code === 'US' || c.code === 'CA' || c.region === 'North America');
        }

        const mapped = filtered.map((c: any) => ({
          id: c.code,
          code: c.dial_code || '+1',
          name: c.name,
          flag: c.flag || '🌐',
          region: c.region || 'Global'
        }));

        return res.json({
          success: true,
          provider: 'VirtualSMSNumbers',
          hasApiKey,
          countries: mapped
        });
      }

      // 2c. SERVICES
      if (action === 'services') {
        const vsnServices = await getVsnServicesList();
        const mapped = vsnServices.map((s: any) => ({
          id: s.slug || s.code,
          code: s.code,
          slug: s.slug,
          name: s.name,
          category: s.category || 'general'
        }));

        return res.json({
          success: true,
          provider: 'VirtualSMSNumbers',
          hasApiKey,
          services: mapped
        });
      }

      // 2d. PRICE
      if (action === 'price') {
        const rawCountry = (req.query.country || '').toString();
        const rawService = (req.query.service || '').toString();

        if (!rawService) {
          return res.status(400).json({ success: false, error: 'Service parameter is required.' });
        }

        await loadPricingSettingsFromDb(db);
        const vsnCountries = await getVsnCountriesList();
        const vsnServices = await getVsnServicesList();
        const cleanService = resolveToVsnServiceSlug(rawService, vsnServices);
        const isCheapestQuery = !rawCountry || rawCountry.toLowerCase() === 'cheapest' || rawCountry.toLowerCase() === 'cheapest_available' || rawCountry.toLowerCase() === 'any';
        const countryIso = isCheapestQuery ? '' : resolveToVsnCountryCode(rawCountry, vsnCountries);

        let resolvedCountry = countryIso || 'US';
        let resolvedCountryName = 'United States';
        let resolvedFlag = '🇺🇸';
        let resolvedDialCode = '+1';

        let providerCostNgn = 350;
        let providerCostEur = 0.20;
        let stock = 100;
        let successRate = 0.90;

        try {
          const priceQueryParams: Record<string, any> = {
            service: cleanService,
            per_page: 5
          };
          if (!isCheapestQuery && countryIso) {
            priceQueryParams.country = countryIso;
          }

          const priceRes = await queryVirtualSMSNumbers('/prices', priceQueryParams);

          const itemsList = Array.isArray(priceRes?.data)
            ? priceRes.data
            : Array.isArray(priceRes?.prices)
            ? priceRes.prices
            : Array.isArray(priceRes)
            ? priceRes
            : [];

          if (itemsList.length > 0) {
            const item = itemsList[0];
            const priceCents = Number(item.price_cents) !== undefined && item.price_cents !== null && !isNaN(Number(item.price_cents))
              ? Number(item.price_cents)
              : Math.round((Number(item.price) || 0) * 100);
            providerCostEur = priceCents / 100;
            const currentEurRate = Number(cachedPricingSettings.eurToNgnRate) || Number(process.env.EUR_TO_NGN_RATE) || eurToNgnRate;
            // Customer price is exact provider cost in EUR * EUR_TO_NGN_RATE rounded to whole naira
            providerCostNgn = Math.round(providerCostEur * currentEurRate);
            stock = Number(item.available ?? item.stock ?? item.count ?? 0);
            if (isNaN(stock) || stock < 0) stock = 0;
            successRate = Number(item.success_rate ?? item.rate) || 0.90;

            const cCode = (item.country || item.country_code || item.code || countryIso || 'US').toString().toUpperCase();
            resolvedCountry = cCode;
            const matched = vsnCountries.find((c: any) => c.code?.toUpperCase() === cCode || String(c.id) === cCode);
            resolvedCountryName = matched?.name || item.country_name || cCode;
            resolvedFlag = matched?.flag || '🌐';
            resolvedDialCode = matched?.dial_code || '+1';
          }
        } catch (err: any) {
          console.warn(`[VirtualSMSNumbers Price Notice] (${countryIso || 'cheapest'}/${cleanService}):`, err.message);
        }

        const isOwner = await isOwnerRequest();
        const options = generateVsnPriceOptions(providerCostNgn, cachedPricingSettings, isOwner);
        const customerPrice = providerCostNgn; // Converted provider cost ONLY, ZERO markup

        return res.json({
          success: true,
          provider: 'VirtualSMSNumbers',
          hasApiKey,
          available: stock > 0,
          resolvedCountry,
          resolvedCountryName,
          resolvedFlag,
          resolvedDialCode,
          isCheapest: isCheapestQuery,
          options,
          priceOptions: options,
          customerPrice: providerCostNgn,
          totalPrice: providerCostNgn,
          price: providerCostNgn,
          providerCost: providerCostNgn,
          providerCostEur,
          availableStock: stock,
          successRate,
          currency: 'NGN',
          markup: 0,
          profit: 0
        });
      }

      // 2e. PRICING SETTINGS (Owner)
      if (action === 'pricing-settings') {
        const isOwner = await isOwnerRequest();
        if (!isOwner) {
          return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
        }
        await loadPricingSettingsFromDb(db);
        return res.json({
          success: true,
          provider: 'VirtualSMSNumbers',
          settings: {
            ...cachedPricingSettings,
            eurToNgnRate: cachedPricingSettings.eurToNgnRate || eurToNgnRate
          }
        });
      }

      // 2f. PROVIDER BALANCE (Owner)
      if (action === 'balance') {
        const isOwner = await isOwnerRequest();
        if (!isOwner) {
          return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
        }

        if (!hasApiKey) {
          return res.json({
            success: true,
            provider: 'VirtualSMSNumbers',
            hasApiKey: false,
            message: 'VSN_API_KEY is not configured yet. Add VSN_API_KEY to server environment.'
          });
        }

        try {
          const balanceRes = await queryVirtualSMSNumbers('/balance');
          const accountRes = await queryVirtualSMSNumbers('/me').catch(() => null);
          return res.json({
            success: true,
            provider: 'VirtualSMSNumbers',
            hasApiKey: true,
            balanceEur: balanceRes.balance || (balanceRes.balance_cents / 100),
            balanceCents: balanceRes.balance_cents,
            canPurchase: Boolean(balanceRes.can_purchase),
            requiresTopUp: !balanceRes.can_purchase,
            accountEmail: accountRes?.email || 'zenethubofficial@gmail.com'
          });
        } catch (err: any) {
          return res.status(500).json({ success: false, error: err.message });
        }
      }

      // 2g. STATUS CHECK / LONG POLL
      if (action === 'status') {
        const orderId = (req.query.order_id || req.query.orderId || req.query.id || req.body?.order_id || req.body?.orderId || req.body?.id || '').toString();
        const authUid = (req as any).authUid;

        if (!orderId || !db) {
          return res.status(400).json({ success: false, error: 'Order ID is required.' });
        }

        const orderRef = doc(db, 'virtual_number_orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
          return res.status(404).json({ success: false, error: 'Order not found.' });
        }

        const orderData = orderSnap.data();
        if (orderData.userId !== authUid && !(await isOwnerRequest())) {
          return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        // 1. If already code received / completed
        if (orderData.status === 'RECEIVED' || orderData.status === 'COMPLETED' || orderData.code) {
          return res.json({
            success: true,
            status: 'RECEIVED',
            code: orderData.code || '',
            smsText: orderData.smsText || '',
            order: orderData
          });
        }

        // 2. If already cancelled / refunded
        if (orderData.status === 'CANCELLED' || orderData.status === 'EXPIRED' || orderData.refunded) {
          return res.json({
            success: true,
            status: orderData.status || 'CANCELLED',
            code: '',
            smsText: '',
            refunded: true,
            order: orderData
          });
        }

        // 3. For WAITING orders: check upstream provider API
        if (orderData.status === 'WAITING' && orderData.providerOrderId && hasApiKey) {
          const createdAtMs = new Date(orderData.createdAt || Date.now()).getTime();
          const orderAgeMs = Date.now() - createdAtMs;
          const isPast20Min = orderAgeMs >= 20 * 60 * 1000;

          try {
            const waitSeconds = Math.min(Math.max(Number(req.query.wait) || 0, 0), 20);
            const upstreamStatus = await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}`, {
              wait: waitSeconds
            }, 'GET', (waitSeconds + 5) * 1000);

            if (upstreamStatus) {
              const dataObj = upstreamStatus.data || upstreamStatus;
              const uStatus = String(dataObj.status || upstreamStatus.status || '').toLowerCase();
              let extractedCode = dataObj.code || upstreamStatus.code || null;
              let extractedText = dataObj.smsText || dataObj.sms_text || dataObj.text || upstreamStatus.smsText || '';

              const messagesList = Array.isArray(dataObj.messages)
                ? dataObj.messages
                : (Array.isArray(upstreamStatus.messages) ? upstreamStatus.messages : []);

              if (!extractedCode && messagesList.length > 0) {
                extractedCode = messagesList[0].code || null;
                extractedText = messagesList[0].text || messagesList[0].message || '';
              }

              if (!extractedCode && extractedText) {
                const match = extractedText.match(/\b\d{4,8}\b/);
                if (match) {
                  extractedCode = match[0];
                }
              }

              const isReceived = uStatus === 'code_received' || uStatus === 'received' || uStatus === 'success' || uStatus === 'completed' || uStatus === '2' || Boolean(extractedCode);

              // Code received = successful order = cancellation disabled!
              if (isReceived && extractedCode) {
                const nowIso = new Date().toISOString();
                await updateDoc(orderRef, {
                  status: 'RECEIVED',
                  code: extractedCode,
                  smsText: extractedText || `Verification code: ${extractedCode}`,
                  receivedAt: nowIso,
                  updatedAt: nowIso
                });

                return res.json({
                  success: true,
                  status: 'RECEIVED',
                  code: extractedCode,
                  smsText: extractedText || `Verification code: ${extractedCode}`,
                  order: { ...orderData, status: 'RECEIVED', code: extractedCode, smsText: extractedText }
                });
              }

              // Automatic 20-minute timeout:
              // If no code is received after 20 minutes, automatically attempt provider cancellation and refund
              if (isPast20Min) {
                let providerCancelConfirmed = false;
                try {
                  const cancelRes = await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}/cancel`, {}, 'POST');
                  if (cancelRes && (cancelRes.success !== false && !cancelRes.error)) {
                    providerCancelConfirmed = true;
                  }
                } catch (cancelErr: any) {
                  const msg = (cancelErr.message || '').toLowerCase();
                  if (msg.includes('expired') || msg.includes('cancel') || msg.includes('not found') || cancelErr.status === 404 || cancelErr.status === 400) {
                    providerCancelConfirmed = true;
                  }
                }

                if (providerCancelConfirmed) {
                  const nowIso = new Date().toISOString();
                  const refundAmount = Number(orderData.price || orderData.customerPrice || 0);
                  const userRef = doc(db, 'users', orderData.userId);
                  const refundTxId = `REF-VSN-${orderData.orderId || orderId}`;

                  await runTransaction(db, async (tx) => {
                    const oSnap = await tx.get(orderRef);
                    if (!oSnap.exists()) return;
                    const oData = oSnap.data();
                    // Race-condition guard: never refund if code arrived or already refunded!
                    if (oData.refunded || oData.status === 'RECEIVED' || oData.code) {
                      return;
                    }
                    const uSnap = await tx.get(userRef);
                    if (uSnap.exists()) {
                      const cur = Number(uSnap.data().walletBalance ?? 0);
                      tx.update(userRef, { walletBalance: cur + refundAmount, updatedAt: nowIso });
                    }
                    tx.update(orderRef, {
                      status: 'EXPIRED',
                      refunded: true,
                      refundedAt: nowIso,
                      cancelReason: '20_minute_timeout',
                      updatedAt: nowIso
                    });
                    tx.set(doc(db, 'transactions', refundTxId), {
                      id: refundTxId,
                      userId: orderData.userId,
                      userEmail: orderData.userEmail || '',
                      type: 'refund',
                      amount: refundAmount,
                      currency: 'NGN',
                      status: 'completed',
                      description: `Automatic 20-Minute Timeout Refund: Virtual Number ${orderData.phoneNumber || orderId}`,
                      metadata: { orderId, providerActivationId: orderData.providerOrderId, provider: 'VirtualSMSNumbers' },
                      createdAt: nowIso
                    });
                  });

                  return res.json({
                    success: true,
                    status: 'EXPIRED',
                    message: '20-minute waiting period elapsed without receiving an SMS code. Order cancelled and full refund credited to your wallet.',
                    refunded: true,
                    order: { ...orderData, status: 'EXPIRED', refunded: true }
                  });
                }
              }

              // Upstream reported expired or cancelled before 20 minutes
              if (uStatus === 'expired' || uStatus === 'refunded' || uStatus === 'canceled' || uStatus === 'cancelled' || uStatus === 'timeout' || uStatus === '3' || uStatus === '4') {
                const nowIso = new Date().toISOString();
                const refundAmount = Number(orderData.price || orderData.customerPrice || 0);
                const userRef = doc(db, 'users', orderData.userId);
                const refundTxId = `REF-VSN-${orderData.orderId || orderId}`;

                await runTransaction(db, async (tx) => {
                  const oSnap = await tx.get(orderRef);
                  if (!oSnap.exists()) return;
                  const oData = oSnap.data();
                  if (oData.refunded || oData.status === 'RECEIVED' || oData.code) {
                    return;
                  }
                  const uSnap = await tx.get(userRef);
                  if (uSnap.exists()) {
                    const cur = Number(uSnap.data().walletBalance ?? 0);
                    tx.update(userRef, { walletBalance: cur + refundAmount, updatedAt: nowIso });
                  }
                  tx.update(orderRef, {
                    status: 'CANCELLED',
                    refunded: true,
                    refundedAt: nowIso,
                    cancelReason: 'carrier_cancelled',
                    updatedAt: nowIso
                  });
                  tx.set(doc(db, 'transactions', refundTxId), {
                    id: refundTxId,
                    userId: orderData.userId,
                    userEmail: orderData.userEmail || '',
                    type: 'refund',
                    amount: refundAmount,
                    currency: 'NGN',
                    status: 'completed',
                    description: `Carrier Cancellation Refund: Virtual Number ${orderData.phoneNumber || orderId}`,
                    metadata: { orderId, providerActivationId: orderData.providerOrderId, provider: 'VirtualSMSNumbers' },
                    createdAt: nowIso
                  });
                });

                return res.json({
                  success: true,
                  status: 'CANCELLED',
                  message: 'Activation expired without receiving an SMS code. Full refund credited to your wallet.',
                  refunded: true,
                  order: { ...orderData, status: 'CANCELLED', refunded: true }
                });
              }
            }
          } catch (pollErr: any) {
            console.warn('[VirtualSMSNumbers Status Poll Notice]:', pollErr.message);
          }
        }

        return res.json({
          success: true,
          status: orderData.status || 'WAITING',
          code: orderData.code || '',
          smsText: orderData.smsText || '',
          order: orderData
        });
      }

      // 2h. ORDERS HISTORY
      if (action === 'orders') {
        const authUid = (req as any).authUid;
        if (!db) return res.status(500).json({ success: false, error: 'Database not initialized' });

        const isOwner = await isOwnerRequest();
        let ordersQuery;
        if (isOwner && req.query.all === 'true') {
          ordersQuery = query(collection(db, 'virtual_number_orders'));
        } else {
          ordersQuery = query(collection(db, 'virtual_number_orders'), where('userId', '==', authUid));
        }

        const snap = await getDocs(ordersQuery);
        const ordersList = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) }));
        ordersList.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        return res.json({
          success: true,
          provider: 'VirtualSMSNumbers',
          orders: ordersList
        });
      }
    }

    // --- 3. POST REQUESTS ---
    if (method === 'POST') {
      // 3a. PRICING SETTINGS UPDATE (Owner)
      if (action === 'pricing-settings') {
        const isOwner = await isOwnerRequest();
        if (!isOwner) {
          return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
        }
        if (!db) return res.status(500).json({ success: false, error: 'Database not ready' });

        const { optionsCount, minMarkup, maxMarkup, pricingStyle, eurToNgnRate: newRate } = req.body;
        const newSettings: VirtualNumberPricingSettings = {
          optionsCount: Math.min(Math.max(Number(optionsCount) || 4, 2), 6),
          minMarkup: Math.max(Number(minMarkup) || 500, 100),
          maxMarkup: Math.max(Number(maxMarkup) || 4500, 500),
          pricingStyle: ['natural', 'clean', 'tiered'].includes(pricingStyle) ? pricingStyle : 'natural',
          eurToNgnRate: Number(newRate) || eurToNgnRate
        };

        await setDoc(doc(db, 'system_settings', 'virtual_number_pricing'), newSettings, { merge: true });
        cachedPricingSettings = newSettings;

        return res.json({
          success: true,
          message: 'Virtual number pricing settings updated successfully.',
          settings: newSettings
        });
      }

      // 3b. BUY NUMBER
      if (action === 'buy') {
        const authUid = (req as any).authUid;
        if (!authUid) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Please sign in.' });
        }
        if (!db) {
          return res.status(500).json({ success: false, error: 'Firestore database is not initialized.' });
        }

        const { country, service, optionId, selectedPrice } = req.body;
        if (!service) {
          return res.status(400).json({ success: false, error: 'Service parameter is required.' });
        }

        // Idempotency lock on user buy requests (5 seconds window)
        const now = Date.now();
        const userBuyLockKey = `buy_${authUid}`;
        const lastBuyAttempt = userOrderLocks.get(userBuyLockKey);
        if (lastBuyAttempt && (now - lastBuyAttempt < 5000)) {
          return res.status(429).json({ success: false, error: 'An allocation transaction is already processing. Please wait.' });
        }
        userOrderLocks.set(userBuyLockKey, now);

        try {
          // 1. Resolve canonical service and country
          await loadPricingSettingsFromDb(db);
          const vsnCountries = await getVsnCountriesList();
          const vsnServices = await getVsnServicesList();
          const cleanService = resolveToVsnServiceSlug(service, vsnServices);
          const isCheapestQuery = !country || country.toLowerCase() === 'cheapest' || country.toLowerCase() === 'any';
          let countryIso = isCheapestQuery ? '' : resolveToVsnCountryCode(country, vsnCountries);

          // 2. Resolve price in EUR from upstream provider API
          let providerEurCost = 0.50; // default baseline EUR
          try {
            if (hasApiKey) {
              const priceRes = await queryVirtualSMSNumbers('/prices', {
                country: countryIso || undefined,
                service: cleanService
              });
              const pData = priceRes?.data || priceRes;
              if (pData) {
                if (Array.isArray(pData) && pData.length > 0) {
                  // Find matching or cheapest
                  const match = countryIso ? pData.find((p: any) => p.country === countryIso) : pData[0];
                  if (match) {
                    providerEurCost = Number(match.price || match.cost || 0.50);
                    if (!countryIso && match.country) countryIso = match.country;
                  }
                } else if (pData.price || pData.cost) {
                  providerEurCost = Number(pData.price || pData.cost || 0.50);
                }
              }
            }
          } catch (pErr: any) {
            console.warn('[VirtualSMSNumbers Buy] Price lookup note:', pErr.message);
          }

          if (!countryIso) countryIso = 'US'; // default canonical fallback country

          // Convert exact provider rate to NGN with ZERO markup
          let customerPrice = Math.max(1, Math.round(providerEurCost * eurToNgnRate));
          if (selectedPrice && Number(selectedPrice) > 0) {
            customerPrice = Math.round(Number(selectedPrice));
          }

          // 3. User Wallet Balance Pre-Check (Reject immediately if balance insufficient)
          const userRef = doc(db, 'users', authUid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            return res.status(404).json({ success: false, error: 'User profile not found.' });
          }
          const userData = userSnap.data();
          const currentBal = Number(userData.walletBalance ?? userData.balance ?? 0);

          if (currentBal < customerPrice) {
            return res.status(400).json({
              success: false,
              code: 'INSUFFICIENT_BALANCE',
              error: `Insufficient wallet balance. This number requires ₦${customerPrice.toLocaleString()}, but your balance is ₦${currentBal.toLocaleString()}. Please top up your wallet.`
            });
          }

          // 4. Provider Account & Key Verification
          if (!hasApiKey) {
            return res.status(503).json({
              success: false,
              code: 'PROVIDER_KEY_MISSING',
              error: 'Virtual SMS provider API key is not configured in the server environment.'
            });
          }

          // 5. CALL PROVIDER ACTIVATION API (POST /activations)
          // Note: If provider account is unfunded or fails, catch and handle error cleanly.
          // The customer wallet is NOT charged for failed creations!
          let activationResult: any = null;
          try {
            activationResult = await queryVirtualSMSNumbers('/activations', {
              country: countryIso,
              service: cleanService
            }, 'POST');
          } catch (supplierError: any) {
            console.warn('[VirtualSMSNumbers Buy] Provider activation declined:', supplierError.message);
            // User is NOT debited! Return provider error directly
            const errCode = supplierError.code || supplierError.data?.error?.code || 'PROVIDER_DECLINED';
            const errMsg = supplierError.message || supplierError.data?.error?.message || 'Provider reported insufficient provider balance or allocation error.';
            const isTopUpReq = String(errCode).toLowerCase().includes('top_up') || String(errMsg).toLowerCase().includes('top-up') || String(errMsg).toLowerCase().includes('€20');
            return res.status(422).json({
              success: false,
              code: errCode,
              error: isTopUpReq
                ? 'Virtual SMS / Service Numbers is coming soon. The service is currently undergoing provider setup and will be enabled shortly. Your wallet balance was not charged.'
                : `Service notice: ${errMsg}. Your wallet balance was not charged.`
            });
          }

          if (!activationResult || activationResult.error || (!activationResult.id && !activationResult.phone_number && !activationResult.phone)) {
            const errCode = activationResult?.error?.code || 'PROVIDER_DECLINED';
            const errMsg = activationResult?.error?.message || activationResult?.message || 'Provider reported no available numbers or insufficient balance.';
            const isTopUpReq = String(errCode).toLowerCase().includes('top_up') || String(errMsg).toLowerCase().includes('top-up') || String(errMsg).toLowerCase().includes('€20');
            return res.status(422).json({
              success: false,
              code: errCode,
              error: isTopUpReq
                ? 'Virtual SMS / Service Numbers is coming soon. The service is currently undergoing provider setup and will be enabled shortly. Your wallet balance was not charged.'
                : `Service notice: ${errMsg}. Your wallet balance was not charged.`
            });
          }

          // 6. PROVIDER CONFIRMED ALLOCATION -> ATOMICALLY DEBIT USER WALLET & SAVE ORDER
          const providerActivationId = String(activationResult.id || activationResult.activation_id || activationResult.order_id);
          const rawPhone = String(activationResult.phone_number || activationResult.phoneNumber || activationResult.phone || '');
          const cleanPhone = rawPhone.replace(/^\+/, '');
          const nowIso = new Date().toISOString();
          const expiresAtIso = new Date(Date.now() + 20 * 60 * 1000).toISOString(); // 20-minute maximum waiting period
          const orderId = `ORD-VSN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const txId = `TX-NUM-${Date.now()}`;

          await runTransaction(db, async (tx) => {
            const uSnap = await tx.get(userRef);
            if (!uSnap.exists()) throw new Error('User profile not found');
            const uData = uSnap.data();
            const cur = Number(uData.walletBalance ?? uData.balance ?? 0);
            if (cur < customerPrice) {
              throw new Error(`Insufficient wallet balance. Order requires ₦${customerPrice.toLocaleString()}`);
            }

            const newBal = cur - customerPrice;
            tx.update(userRef, {
              walletBalance: newBal,
              balance: newBal,
              updatedAt: nowIso
            });
            tx.set(doc(db, 'wallets', authUid), {
              userId: authUid,
              userEmail: userData.email || '',
              walletBalance: newBal,
              balance: newBal,
              updatedAt: nowIso
            }, { merge: true });

            tx.set(doc(db, 'transactions', txId), {
              id: txId,
              userId: authUid,
              userEmail: userData.email || '',
              type: 'purchase',
              amount: customerPrice,
              currency: 'NGN',
              status: 'completed',
              description: `Virtual Number: ${cleanService.toUpperCase()} (${countryIso}) - +${cleanPhone}`,
              metadata: {
                orderId,
                providerActivationId,
                phoneNumber: cleanPhone,
                provider: 'VirtualSMSNumbers'
              },
              createdAt: nowIso
            });

            tx.set(doc(db, 'virtual_number_orders', orderId), {
              id: orderId,
              orderId,
              transactionId: txId,
              userId: authUid,
              userEmail: userData.email || '',
              provider: 'VirtualSMSNumbers',
              providerOrderId: providerActivationId,
              phoneNumber: cleanPhone,
              country: countryIso,
              countryCode: countryIso,
              service: cleanService,
              serviceSlug: cleanService,
              price: customerPrice,
              customerPrice,
              providerCost: Math.round(providerEurCost * eurToNgnRate),
              currency: 'NGN',
              status: 'WAITING',
              code: null,
              smsText: null,
              refunded: false,
              createdAt: nowIso,
              expiresAt: expiresAtIso,
              timeoutAt: Date.now() + 20 * 60 * 1000,
              updatedAt: nowIso
            });
          });

          return res.json({
            success: true,
            message: `Allocated +${cleanPhone} successfully. Maximum waiting period: 20 minutes.`,
            orderId,
            order: {
              id: orderId,
              orderId,
              providerOrderId: providerActivationId,
              phoneNumber: cleanPhone,
              country: countryIso,
              service: cleanService,
              status: 'WAITING',
              price: customerPrice,
              expiresAt: expiresAtIso,
              createdAt: nowIso
            }
          });

        } catch (buyErr: any) {
          console.error('[VirtualSMSNumbers Buy Error]:', buyErr);
          return res.status(500).json({ success: false, error: buyErr.message || 'Purchase transaction failed.' });
        }
      }

      // 3c. CANCEL AND REFUND ORDER (With race-condition protection & provider verification)
      if (action === 'cancel') {
        const orderId = (req.body?.order_id || req.body?.orderId || req.body?.id || req.query?.order_id || req.query?.orderId || req.query?.id || '').toString();
        const authUid = (req as any).authUid;

        if (!orderId || !db) {
          return res.status(400).json({ success: false, error: 'Order ID is required.' });
        }

        const orderRef = doc(db, 'virtual_number_orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
          return res.status(404).json({ success: false, error: 'Order not found.' });
        }

        const orderData = orderSnap.data();
        if (orderData.userId !== authUid && !(await isOwnerRequest())) {
          return res.status(403).json({ success: false, error: 'Forbidden: You do not own this order.' });
        }

        // 1. If code already received locally: REJECT CANCELLATION
        if (orderData.status === 'RECEIVED' || orderData.status === 'COMPLETED' || orderData.code) {
          return res.status(400).json({
            success: false,
            code: 'CODE_ALREADY_RECEIVED',
            error: 'Cannot cancel order: The SMS verification code has already arrived. No refund can be issued.'
          });
        }

        // 2. If already refunded/cancelled: REJECT DUPLICATE CANCELLATION
        if (orderData.status === 'CANCELLED' || orderData.status === 'EXPIRED' || orderData.refunded) {
          return res.status(400).json({
            success: false,
            code: 'ALREADY_CANCELLED',
            error: 'Order has already been cancelled and refunded.'
          });
        }

        // 3. Race Condition Protection: Verify provider state before cancelling or refunding!
        // If code arrived at the same time customer pressed Cancel, verify provider state first.
        if (orderData.providerOrderId && hasApiKey) {
          try {
            const providerCheck = await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}`);
            if (providerCheck) {
              const dataObj = providerCheck.data || providerCheck;
              const uStatus = String(dataObj.status || providerCheck.status || '').toLowerCase();
              let extractedCode = dataObj.code || providerCheck.code || null;
              if (!extractedCode && Array.isArray(dataObj.messages) && dataObj.messages.length > 0) {
                extractedCode = dataObj.messages[0].code || null;
              }

              // Code received from provider API -> Save code, mark received, REJECT cancellation and refund!
              if (extractedCode || uStatus === 'code_received' || uStatus === 'received' || uStatus === 'completed') {
                const nowIso = new Date().toISOString();
                await updateDoc(orderRef, {
                  status: 'RECEIVED',
                  code: extractedCode,
                  smsText: dataObj.smsText || dataObj.text || `Verification code: ${extractedCode}`,
                  receivedAt: nowIso,
                  updatedAt: nowIso
                });

                return res.status(400).json({
                  success: false,
                  code: 'CODE_ALREADY_RECEIVED',
                  error: 'Cannot cancel order: The verification code arrived from the carrier. Cancellation and refund are disabled.',
                  receivedCode: extractedCode
                });
              }
            }
          } catch (checkErr: any) {
            console.warn('[VirtualSMSNumbers Cancel Pre-Check Notice]:', checkErr.message);
          }

          // 4. Provider confirmed NO code has arrived. Now attempt provider cancellation/release:
          try {
            const cancelResult = await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}/cancel`, {}, 'POST');
            if (cancelResult && cancelResult.error) {
              return res.status(400).json({
                success: false,
                code: cancelResult.error.code || 'PROVIDER_DECLINED',
                error: `Provider declined cancellation: ${cancelResult.error.message || 'Carrier release failed'}.`
              });
            }
          } catch (cancelErr: any) {
            const msg = (cancelErr.message || '').toLowerCase();
            // If already canceled upstream or 404, proceed to refund; otherwise if provider rejected, abort refund
            if (!msg.includes('already') && !msg.includes('canceled') && !msg.includes('cancelled') && !msg.includes('expired') && cancelErr.status !== 404) {
              return res.status(400).json({
                success: false,
                code: cancelErr.code || 'PROVIDER_DECLINED',
                error: `Provider declined cancellation: ${cancelErr.message}.`
              });
            }
          }
        }

        // 5. Provider cancellation confirmed -> Atomic refund to customer in Firestore transaction
        // Prevents duplicate cancellations and duplicate refunds atomically.
        const refundPrice = Number(orderData.price || orderData.customerPrice || 0);
        const userRef = doc(db, 'users', orderData.userId);
        const nowIso = new Date().toISOString();
        const refundTxId = `REF-VSN-${orderData.orderId || orderId}`;

        await runTransaction(db, async (tx) => {
          const oSnap = await tx.get(orderRef);
          if (!oSnap.exists()) throw new Error('Order not found');
          const oData = oSnap.data();

          if (oData.refunded || oData.status === 'RECEIVED' || oData.code) {
            throw new Error('Order was already processed, refunded, or code received.');
          }

          const uSnap = await tx.get(userRef);
          if (uSnap.exists()) {
            const curBal = Number(uSnap.data().walletBalance ?? 0);
            tx.update(userRef, {
              walletBalance: curBal + refundPrice,
              balance: curBal + refundPrice,
              updatedAt: nowIso
            });
            tx.set(doc(db, 'wallets', orderData.userId), {
              userId: orderData.userId,
              userEmail: orderData.userEmail || '',
              walletBalance: curBal + refundPrice,
              balance: curBal + refundPrice,
              updatedAt: nowIso
            }, { merge: true });
          }

          tx.update(orderRef, {
            status: 'CANCELLED',
            refunded: true,
            refundedAt: nowIso,
            cancelReason: 'customer_cancelled',
            updatedAt: nowIso
          });

          tx.set(doc(db, 'transactions', refundTxId), {
            id: refundTxId,
            userId: orderData.userId,
            userEmail: orderData.userEmail || '',
            type: 'refund',
            amount: refundPrice,
            currency: 'NGN',
            status: 'completed',
            description: `Manual Refund: Cancelled Virtual Number ${orderData.phoneNumber || orderId}`,
            metadata: {
              orderId,
              providerActivationId: orderData.providerOrderId,
              provider: 'VirtualSMSNumbers'
            },
            createdAt: nowIso
          });
        });

        return res.json({
          success: true,
          status: 'CANCELLED',
          message: `Order cancelled successfully. ₦${refundPrice.toLocaleString()} has been refunded to your wallet.`,
          refunded: true,
          refundAmount: refundPrice
        });
      }

      // 3d. COMPLETE ORDER
      if (action === 'complete') {
        const orderId = (req.body?.order_id || req.body?.orderId || req.body?.id || req.query?.order_id || req.query?.orderId || req.query?.id || '').toString();
        const authUid = (req as any).authUid;

        if (!orderId || !db) {
          return res.status(400).json({ success: false, error: 'Order ID is required.' });
        }

        const orderRef = doc(db, 'virtual_number_orders', orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          return res.status(404).json({ success: false, error: 'Order not found.' });
        }

        const orderData = orderSnap.data();
        if (orderData.userId !== authUid && !(await isOwnerRequest())) {
          return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        if (orderData.providerOrderId && !orderData.providerOrderId.startsWith('SIM-') && hasApiKey) {
          try {
            await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}/complete`, {}, 'POST');
          } catch (e: any) {
            try {
              await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}/finish`, {}, 'POST');
            } catch (e2: any) {
              console.warn('[VirtualSMSNumbers Complete Notice]:', e?.message || e2?.message);
            }
          }
        }

        await updateDoc(orderRef, {
          status: 'COMPLETED',
          completedAt: new Date().toISOString()
        });

        return res.json({ success: true, message: 'Order completed.' });
      }

      return res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
    }

    return res.status(405).json({ success: false, error: `Method ${method} not allowed.` });

  } catch (err: any) {
    console.error('VirtualSMSNumbers API Proxy Error:', err);
    res.status(500).json({ success: false, error: err.message || 'VirtualSMSNumbers Proxy Gateway service error' });
  }
};
