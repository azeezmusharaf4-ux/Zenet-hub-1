import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction, ensureServerAuthenticated } from './_firebase';

// Helper to resolve Voiker API Key
const getVoikerApiKey = (): string => (process.env.VOIKER_API_KEY || '').trim();

// Helper to resolve Voiker Base URL
const getVoikerBaseUrl = (): string => (process.env.VOIKER_BASE_URL || 'https://voiker.com/api/v2').trim().replace(/\/+$/, '');

// Default pricing config
const DEFAULT_PRICING = {
  defaultMarkupPercent: 45,
  minMarkupPer1k: 350,
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
    LinkedIn: true
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
const queryVoiker = async (action: string, params: Record<string, any> = {}, method: 'POST' | 'GET' = 'POST'): Promise<any> => {
  const apiKey = getVoikerApiKey();
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

    const callerEmail = (queryParams.callerEmail || body.callerEmail || event.headers?.['x-caller-email'] || event.headers?.['x-admin-email'] || '').toLowerCase().trim();
    const isOwner = callerEmail === 'azeezmusharaf4@gmail.com';

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
    const apiKey = getVoikerApiKey();

    // 1. GET /services
    if (action === 'services' || action === 'catalogue' || action === 'list') {
      let rawServices: any[] = [];

      if (apiKey) {
        try {
          const apiRes = await queryVoiker('services', {}, 'GET');
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

        const min = Math.max(1, Number(raw.min) || 50);
        const max = Math.max(min, Number(raw.max) || 100000);

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
      const bRes = await queryVoiker('balance', {}, 'GET');
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
      const { serviceId, target, quantity, comments, userId } = body;
      if (!serviceId || !target || !quantity) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing serviceId, target, or quantity' }) };
      }

      if (!db || !userId) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'User must be signed in' }) };
      }

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'User not found' }) };
      }
      const uData = userSnap.data();
      const currentBal = Number(uData.walletBalance ?? uData.balance ?? 0);

      const orderQty = Math.round(Number(quantity));
      const cleanServiceId = String(serviceId).replace(/^vk-/, '');

      let ratePer1000 = Number(body.ratePer1000) || 0;
      if (!ratePer1000) {
        try {
          const catSnap = await getDoc(doc(db, 'system_settings', 'voiker_catalogue'));
          if (catSnap.exists() && Array.isArray(catSnap.data()?.services)) {
            const svc = catSnap.data().services.find((s: any) => s.id === serviceId || s.providerServiceId === cleanServiceId);
            if (svc?.ratePer1000) ratePer1000 = Number(svc.ratePer1000);
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

      // Deduct balance atomically
      await runTransaction(db, async (tx) => {
        const uS = await tx.get(userRef);
        const cur = Number(uS.data()?.walletBalance ?? 0);
        if (cur < totalCharge) throw new Error('Insufficient wallet balance');
        tx.update(userRef, { walletBalance: cur - totalCharge, balance: cur - totalCharge });
      });

      // Submit to Voiker
      let providerOrderId = '';
      let initialStatus = 'pending';
      if (apiKey) {
        try {
          const vRes = await queryVoiker('add', {
            service: cleanServiceId,
            link: target.trim(),
            quantity: orderQty,
            ...(comments ? { comments } : {})
          }, 'POST');
          if (vRes?.order || vRes?.order_id) {
            providerOrderId = String(vRes.order || vRes.order_id);
            initialStatus = 'in_progress';
          } else if (vRes?.error) {
            // Auto refund
            await runTransaction(db, async (tx) => {
              const uS = await tx.get(userRef);
              const cur = Number(uS.data()?.walletBalance ?? 0);
              tx.update(userRef, { walletBalance: cur + totalCharge });
            });
            return {
              statusCode: 422,
              headers,
              body: JSON.stringify({ success: false, error: `Voiker rejected: ${vRes.error}. Wallet not charged.` })
            };
          }
        } catch (e: any) {
          console.warn('[Voiker Netlify] Upstream note:', e.message);
        }
      }

      const orderId = `ORD-VK-${Date.now()}`;
      const orderDoc = {
        id: orderId,
        orderId,
        userId,
        userEmail: uData.email || '',
        provider: 'Voiker',
        providerOrderId,
        serviceId,
        target: target.trim(),
        quantity: orderQty,
        price: totalCharge,
        totalCharge,
        status: initialStatus,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'social_boost_orders', orderId), orderDoc);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Boosting order placed successfully!', order: orderDoc })
      };
    }

    // 4. GET & POST /status
    if (action === 'status') {
      const order = queryParams.order || body.order || queryParams.orderId || body.orderId;
      const orders = queryParams.orders || body.orders;

      if (orders && apiKey) {
        const batchRes = await queryVoiker('status', { orders }, 'GET');
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, statuses: batchRes }) };
      }

      if (order && apiKey) {
        const sRes = await queryVoiker('status', { order }, 'GET');
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: sRes.status, details: sRes }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Order parameter required' }) };
    }

    // 5. POST & GET /refill (action=refill)
    if (action === 'refill') {
      const order = queryParams.order || body.order || queryParams.orderId || body.orderId;
      if (!order) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Order required' }) };
      if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ success: false, error: 'VOIKER_API_KEY required' }) };

      let rRes = await queryVoiker('refill', { order }, 'GET');
      if (!rRes || rRes.error) {
        try {
          const postRes = await queryVoiker('refill', { order }, 'POST');
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

      let cRes = await queryVoiker('cancel', { order }, 'GET');
      if (!cRes || cRes.error) {
        try {
          const postRes = await queryVoiker('cancel', { order }, 'POST');
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

    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: `Unsupported action: ${action}` }) };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'Server error' })
    };
  }
};
