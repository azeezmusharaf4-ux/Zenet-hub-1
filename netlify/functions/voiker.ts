import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction, ensureServerAuthenticated, parseAndVerifyToken } from './_firebase';

// Helper to resolve Voiker API Key from any environment variable name variation, casing, headers, body, or Firestore
const getVoikerApiKey = (fallbackKey?: string, explicitBodyKey?: string, headerKey?: string): string => {
  // 1. Explicit caller arguments
  if (fallbackKey && typeof fallbackKey === 'string' && fallbackKey.trim().length > 0) {
    return fallbackKey.trim();
  }
  if (explicitBodyKey && typeof explicitBodyKey === 'string' && explicitBodyKey.trim().length > 0) {
    return explicitBodyKey.trim();
  }
  if (headerKey && typeof headerKey === 'string' && headerKey.trim().length > 0) {
    return headerKey.trim();
  }

  // 2. Direct exact environment variables (both standard server and Vite client prefixed)
  const candidateNames = [
    'VOIKER_API_KEY',
    'VOIKER_KEY',
    'VOIKER_API',
    'VOIKER_TOKEN',
    'VOIKER_API_TOKEN',
    'VOIKER_SECRET',
    'VOIKER_SECRET_KEY',
    'VOIKER_SMM_API_KEY',
    'VOIKER_SMM_KEY',
    'VOIKER_SMM_TOKEN',
    'VOIKER_APIKEY',
    'VOIKERAPIKEY',
    'VOIKA_API_KEY',
    'VOIKA_KEY',
    'VOIKA_API',
    'VOIKA_TOKEN',
    'SMM_API_KEY',
    'SMM_KEY',
    'SMM_TOKEN',
    'SMM_API_TOKEN',
    'SMM_PROVIDER_KEY',
    'SMM_PROVIDER_API_KEY',
    'VITE_VOIKER_API_KEY',
    'VITE_VOIKER_KEY',
    'VITE_VOIKER_TOKEN',
    'VITE_VOIKER_API',
    'VITE_SMM_API_KEY',
    'VITE_SMM_KEY',
    'VITE_VOIKA_API_KEY',
    'VITE_VOIKA_KEY',
    'BOOST_API_KEY',
    'BOOST_KEY',
    'SOCIAL_BOOST_API_KEY',
    'SOCIAL_BOOST_KEY',
    'SOCIALBOOST_API_KEY',
    'SOCIALBOOST_KEY',
    'REACT_APP_VOIKER_API_KEY',
    'REACT_APP_VOIKER_KEY'
  ];

  for (const name of candidateNames) {
    const val = process.env[name];
    if (val && typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }

  // 3. Case-insensitive and normalized search across ALL process.env keys
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || typeof value !== 'string') continue;
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isVoikerCandidate = cleanKey.includes('voik') && (
      cleanKey.includes('key') || cleanKey.includes('token') || cleanKey.includes('secret') || cleanKey.includes('api') || cleanKey.includes('auth') || cleanKey.includes('pass')
    );
    const isSmmCandidate = cleanKey.includes('smm') && (
      cleanKey.includes('key') || cleanKey.includes('token') || cleanKey.includes('secret') || cleanKey.includes('api') || cleanKey.includes('provider')
    );
    const isBoostCandidate = cleanKey.includes('boost') && (
      cleanKey.includes('key') || cleanKey.includes('token') || cleanKey.includes('api')
    );
    if ((isVoikerCandidate || isSmmCandidate || isBoostCandidate) && value.trim().length >= 6) {
      return value.trim();
    }
  }

  return '';
};

// Helper to resolve Voiker Base URL
const getVoikerBaseUrl = (): string => {
  const urlCandidates = [
    'VOIKER_BASE_URL',
    'VOIKER_API_URL',
    'VOIKER_URL',
    'VOIKA_BASE_URL',
    'SMM_BASE_URL',
    'SMM_API_URL',
    'VITE_VOIKER_BASE_URL',
    'VITE_VOIKER_API_URL'
  ];
  for (const name of urlCandidates) {
    const val = process.env[name];
    if (val && typeof val === 'string' && val.trim().length > 0) {
      return val.trim().replace(/\/+$/, '');
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || typeof value !== 'string') continue;
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if ((cleanKey.includes('voik') || cleanKey.includes('smm')) && (cleanKey.includes('url') || cleanKey.includes('base') || cleanKey.includes('endpoint'))) {
      if (value.trim().startsWith('http')) {
        return value.trim().replace(/\/+$/, '');
      }
    }
  }
  return 'https://voiker.com/api/v2';
};

// Default pricing config
const DEFAULT_PRICING: {
  apiKey?: string;
  defaultMarkupPercent: number;
  defaultMarkupFixedNgn: number;
  minMarkupPer1k: number;
  usdToNgnRate: number;
  pricingStyle: string;
  platformStatus: Record<string, boolean>;
  categoryMarkups: Record<string, { markupFixedNgn: number; markupPercent: number }>;
  disabledServices: string[];
  curatedServiceIds: string[];
  bestValueServiceIds: Record<string, string>;
  serviceOverrides: Record<string, any>;
} = {
  apiKey: '',
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
    LinkedIn: true
  },
  categoryMarkups: {
    Followers: { markupFixedNgn: 0, markupPercent: 0 },
    Views: { markupFixedNgn: 0, markupPercent: 0 },
    Likes: { markupFixedNgn: 0, markupPercent: 0 },
    Comments: { markupFixedNgn: 0, markupPercent: 0 },
    Shares: { markupFixedNgn: 0, markupPercent: 0 },
    Subscribers: { markupFixedNgn: 0, markupPercent: 0 },
    Other: { markupFixedNgn: 0, markupPercent: 0 }
  },
  disabledServices: [],
  curatedServiceIds: [],
  bestValueServiceIds: {},
  serviceOverrides: {}
};

// Platform normalizer
const extractPlatform = (category: string, name: string): string => {
  const combined = `${category || ''} ${name || ''}`.toLowerCase();
  if (combined.includes('tiktok') || combined.includes('tik tok')) return 'TikTok';
  if (combined.includes('instagram') || combined.includes('ig ') || combined.includes('insta')) return 'Instagram';
  if (combined.includes('facebook') || combined.includes('fb ') || combined.includes('meta')) return 'Facebook';
  if (combined.includes('youtube') || combined.includes('yt ')) return 'YouTube';
  if (combined.includes('twitter') || combined.includes(' x ') || combined.includes('x.com')) return 'Twitter / X';
  if (combined.includes('telegram') || combined.includes('tg ')) return 'Telegram';
  if (combined.includes('whatsapp') || combined.includes('wa ')) return 'WhatsApp';
  if (combined.includes('spotify') || combined.includes('music')) return 'Spotify & Music';
  if (combined.includes('threads')) return 'Threads';
  if (combined.includes('discord')) return 'Discord';
  if (combined.includes('linkedin')) return 'LinkedIn';
  return 'Other Services';
};

// Category name clean formatter matching Voiker dashboard
const formatVoikerCategory = (c: string): string => {
  const lower = (c || '').toLowerCase().trim();
  if (lower === 'tiktok-views') return 'TikTok Views';
  if (lower === 'tiktok-likes') return 'TikTok Likes';
  if (lower === 'tiktok-followers') return 'TikTok Followers';
  if (lower === 'tiktok-shares') return 'TikTok Shares';
  if (lower === 'tiktok-saves') return 'TikTok Saves';
  if (lower === 'tiktok-downloads') return 'TikTok Downloads';
  if (lower === 'tiktok-comments') return 'TikTok Comments';
  if (lower === 'tiktok-live-likes-shares-comments') return 'TikTok Live Likes / Shares / Comments';
  if (lower === 'tiktok-live-stream-v3') return 'TikTok Live Stream Views';
  if (lower === 'tiktok-pk-battle-points') return 'TikTok PK Battle Points';
  if (c.includes('-')) {
    return c.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  }
  return c;
};

// Engagement type normalizer
const extractType = (name: string, category: string): string => {
  const combined = `${category || ''} ${name || ''}`.toLowerCase();
  if (combined.includes('follower')) return 'Followers';
  if (combined.includes('like') || combined.includes('reaction')) return 'Likes';
  if (combined.includes('view') || combined.includes('play') || combined.includes('stream')) return 'Views';
  if (combined.includes('comment')) return 'Comments';
  if (combined.includes('share') || combined.includes('repost')) return 'Shares';
  if (combined.includes('subscriber') || combined.includes('sub ')) return 'Subscribers';
  if (combined.includes('member')) return 'Members';
  return 'Engagement';
};

// Input configuration helper
const determineInput = (name: string, type: string, platform: string) => {
  const isCustomComments = type === 'Comments' || `${name}`.toLowerCase().includes('custom comment');
  if (isCustomComments) {
    return {
      inputType: 'custom_comments',
      inputLabel: `${platform} Target URL & Custom Comments (1 per line)`,
      inputPlaceholder: 'https://...\nGreat post!\nAwesome!'
    };
  }
  if (type === 'Followers' || type === 'Subscribers' || type === 'Members') {
    return {
      inputType: 'link',
      inputLabel: `${platform} Profile Link or @Username`,
      inputPlaceholder: `https://${platform.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/username or @username`
    };
  }
  return {
    inputType: 'link',
    inputLabel: `${platform} Target URL / Link`,
    inputPlaceholder: `https://${platform.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/...`
  };
};

// Query Voiker API v2 (supports GET and POST)
const queryVoiker = async (action: string, params: Record<string, any> = {}, method: 'POST' | 'GET' = 'POST', explicitApiKey?: string): Promise<any> => {
  const apiKey = getVoikerApiKey(explicitApiKey);
  const baseUrl = getVoikerBaseUrl();

  const queryParams: Record<string, string> = {
    key: apiKey,
    action,
    ...Object.entries(params).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null) acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>)
  };

  let res: Response;
  if (method === 'GET') {
    const url = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ZENET-HUB-Voiker/1.0'
      },
      signal: AbortSignal.timeout(10000)
    });
  } else {
    const body = new URLSearchParams(queryParams).toString();
    res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'ZENET-HUB-Voiker/1.0'
      },
      body,
      signal: AbortSignal.timeout(10000)
    });
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
};

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-caller-email, x-admin-email',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const db = getDb();
    await ensureServerAuthenticated();

    let body: any = {};
    if (event.body) {
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch {
        body = {};
      }
    }

    const queryParams: Record<string, string> = { ...((event.queryStringParameters as Record<string, string>) || {}) };
    let action = (queryParams.action || body.action || '').toString().toLowerCase().trim();

    if (!action) {
      const path = (event.path || '').replace(/\/+$/, '');
      const segments = path.split('/');
      const last = segments[segments.length - 1];
      if (last && last !== 'voiker' && last !== 'api' && last !== 'functions') {
        action = last.toLowerCase();
      }
    }

    if (!action) {
      action = event.httpMethod === 'POST' ? 'order' : 'services';
    }

    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const verified = parseAndVerifyToken(authHeader);
    const callerEmail = (queryParams.callerEmail || body.callerEmail || event.headers?.['x-caller-email'] || event.headers?.['x-admin-email'] || verified?.email || '').toLowerCase().trim();
    const isOwner = callerEmail === 'azeezmusharaf4@gmail.com' || verified?.email === 'azeezmusharaf4@gmail.com';

    // Helper: load pricing settings
    const getPricing = async () => {
      if (!db) return DEFAULT_PRICING;
      try {
        const snap = await getDoc(doc(db, 'system_settings', 'voiker_pricing'));
        if (snap.exists()) return { ...DEFAULT_PRICING, ...snap.data() };
        const snap2 = await getDoc(doc(db, 'system_settings', 'social_boost_pricing'));
        if (snap2.exists()) return { ...DEFAULT_PRICING, ...snap2.data() };
      } catch {}
      return DEFAULT_PRICING;
    };

    const pricing = await getPricing();
    const usdRate = Number(process.env.USD_TO_NGN_RATE) || pricing.usdToNgnRate || 1650;
    const headerKey = (event.headers?.['x-voiker-api-key'] || event.headers?.['X-Voiker-Api-Key'] || event.headers?.['x-smm-api-key'] || '').toString().trim();
    const bodyKey = (body?.apiKey || queryParams?.apiKey || body?.key || queryParams?.key || '').toString().trim();
    const apiKey = getVoikerApiKey(pricing?.apiKey || (pricing as any)?.key, bodyKey, headerKey);

    // 1. GET /services
    if (action === 'services' || action === 'catalogue' || action === 'list') {
      let rawServices: any[] = [];

      if (apiKey) {
        try {
          const apiRes = await queryVoiker('services', {}, 'GET', apiKey);
          if (Array.isArray(apiRes) && apiRes.length > 0) {
            rawServices = apiRes;
          }
        } catch {}
      }

      if (rawServices.length === 0) {
        try {
          const qsRes = await fetch('https://voiker.com/api/services/quickSearch', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'ZENET-HUB-Voiker/1.0' },
            signal: AbortSignal.timeout(8000)
          });
          if (qsRes.ok) {
            const data: any = await qsRes.json();
            if (data?.services && Array.isArray(data.services)) {
              rawServices = data.services;
            }
          }
        } catch {}
      }

      const services = rawServices.map((raw: any) => {
        const sid = String(raw.service || raw.id || raw.slug);
        const name = String(raw.name || 'Voiker Service').trim();
        const rawCat = String(raw.category?.name || raw.category?.slug || raw.category || 'General').trim();
        const category = formatVoikerCategory(rawCat);
        const platform = extractPlatform(rawCat, name);
        const type = extractType(name, rawCat);
        const inputCfg = determineInput(name, type, platform);

        const priceUsd = Number(raw.rate || raw.price || 0);
        const providerRatePer1000 = Math.max(1, Math.round(priceUsd * usdRate));

        // Direct Voiker pricing without markup as requested
        const customerRate = providerRatePer1000;

        const isViews = /view|play|stream|watch/i.test(`${type} ${category} ${name}`);
        const min = isViews ? 1000 : 100;
        const max = isViews ? 1000000 : 100000;

        const baseSvc = {
          id: `vk-${sid}`,
          provider: 'Voiker',
          providerServiceId: sid,
          platform,
          category,
          name,
          type,
          min,
          max,
          rateUsd: priceUsd,
          rawRate: String(raw.rate ?? priceUsd),
          ratePer1000: customerRate,
          providerRatePer1000,
          refill: Boolean(raw.refill && raw.refill !== '0' && raw.refill !== false),
          cancel: Boolean(raw.cancel && raw.cancel !== '0' && raw.cancel !== false),
          deliverySpeed: raw.dripfeed ? 'Drip-feed Supported' : 'Instant Automated Start',
          quality: 'High-Retention Delivery',
          description: `Automated fast boosting for ${name}. Directly routed through Voiker network.`,
          isActive: true,
          ...inputCfg
        };

        if (isOwner) {
          return {
            ...baseSvc,
            providerRatePer1000,
            rateUsd: priceUsd,
            markupPer1000: 0
          };
        }
        return baseSvc;
      });

      const platforms = Array.from(new Set(services.map(s => s.platform)));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: 'Voiker',
          hasApiKey: Boolean(apiKey),
          services,
          platforms,
          totalCount: services.length,
          isOwner
        })
      };
    }

    // 2. GET /balance
    if (action === 'balance') {
      if (!isOwner) {
        return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
      }
      if (!apiKey) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, hasApiKey: false, balanceUsd: 0, balanceNgn: 0 })
        };
      }
      const bRes = await queryVoiker('balance', {}, 'GET', apiKey);
      const balanceUsd = Number(bRes.balance || 0);
      const balanceNgn = Math.round(balanceUsd * usdRate);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, hasApiKey: true, balanceUsd, balanceNgn, currency: bRes.currency || 'USD' })
      };
    }

    // 3. POST /order or /add
    if (action === 'order' || action === 'add' || action === 'buy') {
      const authHeader = event.headers?.authorization || event.headers?.Authorization;
      const verified = parseAndVerifyToken(authHeader);
      const effectiveUserId = verified?.uid || body.userId;

      const { serviceId, target, quantity, comments } = body;
      if (!serviceId || !target || !quantity) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing serviceId, target, or quantity' }) };
      }

      if (!db || !effectiveUserId) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Invalid or expired session. Please sign in.' }) };
      }

      const userRef = doc(db, 'users', effectiveUserId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'User not found' }) };
      }
      const uData = userSnap.data();
      const currentBal = Number(uData.walletBalance ?? uData.balance ?? 0);

      const isViews = /view|play|stream|watch/i.test(`${serviceId} ${body.name || ''} ${body.type || ''}`);
      const effectiveMin = isViews ? 1000 : 100;
      const effectiveMax = isViews ? 1000000 : 100000;

      const orderQty = Math.round(Number(quantity));
      if (orderQty < effectiveMin || orderQty > effectiveMax) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Quantity must be between ${effectiveMin.toLocaleString()} and ${effectiveMax.toLocaleString()} for this service.`
          })
        };
      }

      const cleanServiceId = String(serviceId).replace(/^vk-/, '');

      let ratePer1000 = Number(body.ratePer1000) || 0;
      if (!ratePer1000) {
        try {
          const catSnap = await getDoc(doc(db, 'system_settings', 'voiker_catalogue'));
          if (catSnap.exists()) {
            const catData = catSnap.data();
            if (Array.isArray(catData?.services) && catData.services.length > 0) {
              const svc = catData.services.find((s: any) => s.id === serviceId || s.providerServiceId === cleanServiceId);
              if (svc?.ratePer1000) ratePer1000 = Number(svc.ratePer1000);
            }
          }
        } catch {}
      }
      if (!ratePer1000) ratePer1000 = 1500;
      const totalCharge = Math.max(1, Math.round((ratePer1000 / 1000) * orderQty));

      if (currentBal < totalCharge) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Insufficient wallet balance. Total: ₦${totalCharge.toLocaleString()}, balance: ₦${currentBal.toLocaleString()}.`
          })
        };
      }

      // Check provider first: wallet is only deducted AFTER provider confirms order!
      let providerOrderId = '';
      let initialStatus = 'in_progress';
      if (!apiKey) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({ success: false, error: 'Voiker API key is not configured on the server yet. Funds were not deducted.' })
        };
      }

      try {
        const vRes = await queryVoiker('add', {
          service: cleanServiceId,
          link: target.trim(),
          quantity: orderQty,
          ...(comments ? { comments } : {})
        }, 'POST', apiKey);

        if (vRes?.order || vRes?.order_id) {
          providerOrderId = String(vRes.order || vRes.order_id);
          initialStatus = 'in_progress';
        } else if (vRes?.error || vRes?.message) {
          const errMsg = String(vRes.error || vRes.message);
          let friendly = errMsg;
          if (/insufficient_funds|balance/i.test(errMsg)) {
            friendly = 'Provider account is awaiting funding. Your wallet was not charged.';
          } else {
            friendly = `Provider notice: ${errMsg}. Your wallet was not charged.`;
          }
          return {
            statusCode: 422,
            headers,
            body: JSON.stringify({ success: false, error: friendly })
          };
        } else {
          return {
            statusCode: 422,
            headers,
            body: JSON.stringify({ success: false, error: 'Provider network could not accept this order. Your wallet was not charged.' })
          };
        }
      } catch (e: any) {
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ success: false, error: `Upstream connection notice: ${e.message}. Your wallet was not charged.` })
        };
      }

      // Provider confirmed order -> Deduct balance atomically and record transactions
      const orderId = `ORD-VK-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const txId = `TX-BOOST-${Date.now()}`;
      let finalNewBalance = currentBal - totalCharge;

      await runTransaction(db, async (tx) => {
        const uS = await tx.get(userRef);
        if (!uS.exists()) throw new Error('User profile not found');
        const cur = Number(uS.data()?.walletBalance ?? uS.data()?.balance ?? 0);
        if (cur < totalCharge) throw new Error('Insufficient wallet balance');
        finalNewBalance = cur - totalCharge;
        tx.update(userRef, { walletBalance: finalNewBalance, balance: finalNewBalance, updatedAt: new Date().toISOString() });
        tx.set(doc(db, 'wallets', effectiveUserId), {
          userId: effectiveUserId,
          userEmail: uData.email || '',
          walletBalance: finalNewBalance,
          balance: finalNewBalance,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Record in transactions collection
        tx.set(doc(db, 'transactions', txId), {
          id: txId,
          userId: effectiveUserId,
          userEmail: uData.email || '',
          type: 'purchase',
          category: 'boost',
          amount: totalCharge,
          currency: 'NGN',
          status: 'completed',
          description: `Social Boost: ${orderQty.toLocaleString()} ${(body.serviceName || serviceId)}`,
          metadata: {
            orderId,
            provider: 'Voiker',
            providerOrderId,
            serviceId,
            target: target.trim(),
            quantity: orderQty
          },
          createdAt: new Date().toISOString()
        });

        // Record in wallet_transactions collection for dual-audit history
        tx.set(doc(db, 'wallet_transactions', txId), {
          id: txId,
          userId: effectiveUserId,
          userEmail: uData.email || '',
          type: 'debit',
          amount: totalCharge,
          category: 'social_boost',
          description: `Social Boost: ${orderQty.toLocaleString()} ${(body.serviceName || serviceId)}`,
          status: 'completed',
          reference: orderId,
          createdAt: new Date().toISOString()
        });

        // Save order
        tx.set(doc(db, 'social_boost_orders', orderId), {
          id: orderId,
          orderId,
          transactionId: txId,
          userId: effectiveUserId,
          userEmail: uData.email || '',
          userName: uData.displayName || uData.name || '',
          provider: 'Voiker',
          providerOrderId,
          serviceId,
          serviceName: body.serviceName || `Voiker #${cleanServiceId}`,
          platform: body.platform || 'Social',
          target: target.trim(),
          quantity: orderQty,
          ratePer1000,
          price: totalCharge,
          totalCharge,
          charge: totalCharge,
          status: initialStatus,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Boosting order placed successfully!',
          newBalance: finalNewBalance,
          order: {
            id: orderId,
            orderId,
            providerOrderId,
            serviceId,
            target: target.trim(),
            quantity: orderQty,
            totalCharge,
            status: initialStatus,
            createdAt: new Date().toISOString()
          }
        })
      };
    }

    // 4. GET & POST /status
    if (action === 'status') {
      const order = queryParams.order || body.order || queryParams.orderId || body.orderId;
      const orders = queryParams.orders || body.orders;

      if (orders && apiKey) {
        const batchRes = await queryVoiker('status', { orders }, 'GET', apiKey);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, statuses: batchRes }) };
      }

      if (order && apiKey) {
        const sRes = await queryVoiker('status', { order }, 'GET', apiKey);
        const providerStatus = sRes?.status || sRes?.details?.status;

        // Sync to Firestore if order document exists
        if (db && providerStatus) {
          try {
            const cleanOrderId = String(order).trim();
            const orderRef = doc(db, 'social_boost_orders', cleanOrderId);
            const oSnap = await getDoc(orderRef);
            if (oSnap.exists()) {
              await updateDoc(orderRef, {
                status: providerStatus.toLowerCase().replace(/\s+/g, '_'),
                remains: sRes.remains !== undefined ? sRes.remains : (oSnap.data().remains ?? null),
                updatedAt: new Date().toISOString()
              });
            } else {
              // Try querying by providerOrderId
              const q = query(collection(db, 'social_boost_orders'), where('providerOrderId', '==', cleanOrderId));
              const snap = await getDocs(q);
              snap.forEach(async (d) => {
                await updateDoc(doc(db, 'social_boost_orders', d.id), {
                  status: providerStatus.toLowerCase().replace(/\s+/g, '_'),
                  remains: sRes.remains !== undefined ? sRes.remains : (d.data().remains ?? null),
                  updatedAt: new Date().toISOString()
                });
              });
            }
          } catch {}
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: sRes.status, details: sRes }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Order parameter required' }) };
    }

    // 5. POST & GET /refill (action=refill)
    if (action === 'refill') {
      const order = queryParams.order || body.order || queryParams.orderId || body.orderId;
      if (!order) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Order required' }) };
      if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ success: false, error: 'VOIKER_API_KEY required' }) };

      let rRes = await queryVoiker('refill', { order }, 'GET', apiKey);
      if (!rRes || rRes.error) {
        try {
          const postRes = await queryVoiker('refill', { order }, 'POST', apiKey);
          if (postRes && !postRes.error) rRes = postRes;
        } catch {}
      }

      if (rRes && rRes.refill !== undefined && rRes.refill !== null && !rRes.error) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, refill: rRes.refill, raw: rRes }) };
      }
      return { statusCode: 422, headers, body: JSON.stringify({ success: false, error: rRes?.error || 'Provider rejected refill request' }) };
    }

    // 6. POST & GET /cancel (action=cancel)
    if (action === 'cancel') {
      const order = queryParams.order || body.order || queryParams.orderId || body.orderId;
      if (!order) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Order required' }) };
      if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ success: false, error: 'VOIKER_API_KEY required' }) };

      let cRes = await queryVoiker('cancel', { order }, 'GET', apiKey);
      if (!cRes || cRes.error) {
        try {
          const postRes = await queryVoiker('cancel', { order }, 'POST', apiKey);
          if (postRes && !postRes.error) cRes = postRes;
        } catch {}
      }

      const isCancelSuccess = Boolean(
        cRes &&
        (cRes.ok === true || cRes.ok === 'true' || cRes.status === 'ok') &&
        cRes.ok !== false &&
        cRes.ok !== 'false' &&
        !cRes.error
      );

      if (isCancelSuccess) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, ok: true, result: cRes }) };
      }
      return { statusCode: 422, headers, body: JSON.stringify({ success: false, error: cRes?.error || 'Provider rejected cancel request' }) };
    }

    // 7. GET /orders
    if (action === 'orders') {
      const userId = queryParams.userId || body.userId;
      if (!userId || !db) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, orders: [] }) };
      }
      const q = query(collection(db, 'social_boost_orders'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const orders: any[] = [];
      snap.forEach(d => orders.push(d.data()));
      orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, orders, count: orders.length })
      };
    }

    // 8. POST & GET /pricing-settings
    if (action === 'pricing-settings') {
      if (event.httpMethod === 'POST') {
        if (!isOwner) {
          return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Forbidden: Owner permission required.' }) };
        }
        const newSettings = {
          ...pricing,
          ...body,
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'system_settings', 'voiker_pricing'), newSettings, { merge: true });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Settings saved', settings: newSettings })
        };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, settings: pricing })
      };
    }

    // 9. POST /save-markup
    if (action === 'save-markup' && event.httpMethod === 'POST') {
      if (!isOwner) {
        return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
      }
      const { serviceId, customMarkupFixedNgn, defaultMarkupFixedNgn } = body;
      const currentOverrides = { ...(pricing.serviceOverrides || {}) };
      if (serviceId) {
        if (customMarkupFixedNgn === null || customMarkupFixedNgn === undefined || customMarkupFixedNgn === '' || customMarkupFixedNgn === 'reset') {
          delete currentOverrides[serviceId];
        } else {
          currentOverrides[serviceId] = {
            ...(currentOverrides[serviceId] || {}),
            customMarkupFixedNgn: Math.max(0, Math.round(Number(customMarkupFixedNgn) || 0))
          };
        }
      }
      const newDef = typeof defaultMarkupFixedNgn === 'number' ? Math.max(0, Math.round(defaultMarkupFixedNgn)) : (pricing.defaultMarkupFixedNgn || 0);
      await setDoc(doc(db, 'system_settings', 'voiker_pricing'), {
        defaultMarkupFixedNgn: newDef,
        serviceOverrides: currentOverrides,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, defaultMarkupFixedNgn: newDef, serviceOverrides: currentOverrides }) };
    }

    // 10. POST /save-bulk-markups
    if ((action === 'save-bulk-markups' || action === 'bulk-markup') && event.httpMethod === 'POST') {
      if (!isOwner) {
        return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
      }
      const { markups, categoryMarkups, defaultMarkupFixedNgn, defaultMarkupPercent } = body;
      const currentOverrides = { ...(pricing.serviceOverrides || {}) };
      if (markups && typeof markups === 'object') {
        for (const [sId, mVal] of Object.entries(markups)) {
          if (mVal === null || mVal === undefined || mVal === '' || mVal === 'reset') {
            delete currentOverrides[sId];
          } else {
            currentOverrides[sId] = {
              ...(currentOverrides[sId] || {}),
              customMarkupFixedNgn: Math.max(0, Math.round(Number(mVal) || 0))
            };
          }
        }
      }
      const currentCategoryMarkups = { ...(pricing.categoryMarkups || {}) };
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
      const newDefFixed = typeof defaultMarkupFixedNgn === 'number' ? Math.max(0, Math.round(defaultMarkupFixedNgn)) : (pricing.defaultMarkupFixedNgn || 0);
      const newDefPct = typeof defaultMarkupPercent === 'number' ? Math.max(0, Math.min(300, Math.round(defaultMarkupPercent))) : (pricing.defaultMarkupPercent || 0);
      await setDoc(doc(db, 'system_settings', 'voiker_pricing'), {
        categoryMarkups: currentCategoryMarkups,
        defaultMarkupFixedNgn: newDefFixed,
        defaultMarkupPercent: newDefPct,
        serviceOverrides: currentOverrides,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          defaultMarkupFixedNgn: newDefFixed,
          defaultMarkupPercent: newDefPct,
          categoryMarkups: currentCategoryMarkups,
          serviceOverrides: currentOverrides
        })
      };
    }

    // 11. POST /save-category-markups
    if (action === 'save-category-markups' && event.httpMethod === 'POST') {
      if (!isOwner) {
        return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
      }
      const { categoryMarkups, defaultMarkupFixedNgn } = body;
      const currentCategoryMarkups = { ...(pricing.categoryMarkups || {}) };
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
      const newDefFixed = typeof defaultMarkupFixedNgn === 'number' ? Math.max(0, Math.round(defaultMarkupFixedNgn)) : (pricing.defaultMarkupFixedNgn || 0);
      await setDoc(doc(db, 'system_settings', 'voiker_pricing'), {
        categoryMarkups: currentCategoryMarkups,
        defaultMarkupFixedNgn: newDefFixed,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          categoryMarkups: currentCategoryMarkups,
          defaultMarkupFixedNgn: newDefFixed
        })
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: `Unsupported action: ${action}` }) };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'Server error' })
    };
  }
};
