import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from './_firebase';
import { BASE_SOCIAL_SERVICES } from './_social_services';

// Helper to resolve SMM API Key from all environment variable aliases
const getSmmApiKey = (): string => {
  const candidates = [
    process.env.ONEGRIDHUB_SMM_API_KEY,
    process.env.ONEGRIDHUB_API_KEY,
    process.env.ONEGRID_API_KEY,
    process.env.ONEGRIDHUB_KEY,
    process.env.SMM_API_KEY,
    process.env.OGH_API_KEY,
    process.env.ONEGRIDHUB_TOKEN
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      const clean = c.trim().replace(/^['"`]|['"`]$/g, '').trim();
      if (clean && clean !== 'undefined' && clean !== 'null' && clean !== 'your_api_key_here') {
        return clean;
      }
    }
  }
  return '';
};

// Helper to resolve OneGridHub Base URL
const getBaseUrl = (): string => {
  let raw = (process.env.ONEGRIDHUB_BASE_URL || 'https://onegridhub.com/api/v1/index.php')
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/\/+$/, '');

  if (!raw.includes('/api/v1')) {
    raw = `${raw}/api/v1/index.php`;
  } else if (!raw.endsWith('.php')) {
    raw = `${raw}/index.php`;
  }
  return raw;
};

// Category normalization helper
const normalizeCategory = (cat: string, name: string): { platform: string; category: string; type: string } => {
  const combined = `${cat} ${name}`.toLowerCase();
  let platform = 'Other';
  let type = 'Engagement';

  if (combined.includes('tiktok') || combined.includes('tik tok')) platform = 'TikTok';
  else if (combined.includes('instagram') || combined.includes('ig ') || combined.includes('insta')) platform = 'Instagram';
  else if (combined.includes('facebook') || combined.includes('fb ') || combined.includes('fb:')) platform = 'Facebook';
  else if (combined.includes('youtube') || combined.includes('yt ') || combined.includes('yt:')) platform = 'YouTube';
  else if (combined.includes('twitter') || combined.includes(' x ') || combined.includes('x:')) platform = 'Twitter / X';
  else if (combined.includes('telegram') || combined.includes('tg ') || combined.includes('tele:')) platform = 'Telegram';
  else if (combined.includes('spotify') || combined.includes('audiomack') || combined.includes('music')) platform = 'Spotify & Music';
  else if (combined.includes('threads')) platform = 'Threads';
  else if (combined.includes('linkedin')) platform = 'LinkedIn';
  else if (combined.includes('discord')) platform = 'Discord';
  else if (combined.includes('twitch') || combined.includes('kick')) platform = 'Twitch & Streaming';
  else if (combined.includes('snapchat')) platform = 'Snapchat';
  else if (combined.includes('reddit')) platform = 'Reddit';
  else if (combined.includes('google') || combined.includes('review')) platform = 'Reviews & Ratings';
  else if (combined.includes('website') || combined.includes('traffic') || combined.includes('seo')) platform = 'Website Traffic & SEO';
  else if (combined.includes('whatsapp') || combined.includes('wa ')) platform = 'WhatsApp';

  if (combined.includes('follower') || combined.includes('subscriber') || combined.includes('member')) type = 'Followers';
  else if (combined.includes('like') || combined.includes('reaction') || combined.includes('upvote')) type = 'Likes';
  else if (combined.includes('view') || combined.includes('stream') || combined.includes('play') || combined.includes('impression')) type = 'Views';
  else if (combined.includes('comment')) type = 'Comments';
  else if (combined.includes('share') || combined.includes('repost') || combined.includes('retweet')) type = 'Shares';
  else if (combined.includes('watch hour') || combined.includes('watchtime')) type = 'Watch Hours';
  else if (combined.includes('review') || combined.includes('rating')) type = 'Reviews';
  else if (combined.includes('traffic') || combined.includes('visitor')) type = 'Website Visits';

  return { platform, category: cat || `${platform} Services`, type };
};

// Input classification helper
const determineInputConfig = (name: string, type: string) => {
  const lower = `${name} ${type}`.toLowerCase();
  if (type === 'Comments' || lower.includes('custom comment')) {
    return {
      inputLabel: 'Target Link & Custom Comments (1 per line)',
      inputPlaceholder: 'https://...\nGreat content!\nAwesome service!',
      inputType: 'custom_comments'
    };
  }
  if (lower.includes('username') || lower.includes('profile')) {
    return {
      inputLabel: 'Profile Link or @Username',
      inputPlaceholder: 'https://... or @username',
      inputType: 'link'
    };
  }
  return {
    inputLabel: 'Target Link / URL',
    inputPlaceholder: 'https://...',
    inputType: 'link'
  };
};

// Default pricing config
const DEFAULT_PRICING = {
  markupPercentage: 35,
  minMarkupNaira: 100,
  platformMarkups: {},
  categoryMarkups: {},
  customPrices: {},
  hiddenServices: [],
  bestValueIds: ['ig-followers-nondrop', 'tt-followers-hq', 'yt-subscribers-hq', 'tg-members-nondrop'],
  cheapestIds: ['tt-views-viral', 'ig-views-reels', 'tg-post-views', 'x-views-impressions']
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
    const apiKey = getSmmApiKey();

    // Extract action and parameters
    let body: any = {};
    if (event.body) {
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch {
        body = {};
      }
    }

    const queryParams = event.queryStringParameters || {};
    let action = (queryParams.action || body.action || '').toString().toLowerCase().trim();
    let orderIdParam = queryParams.orderId || queryParams.id || body.orderId || body.id || '';

    // Extract path candidates from event.path, rawUrl, and headers
    const pathCandidates: string[] = [];
    if (event.path) pathCandidates.push(event.path);
    if (event.rawUrl) {
      try {
        pathCandidates.push(new URL(event.rawUrl).pathname);
      } catch {}
    }
    if (event.headers?.['x-forwarded-uri']) pathCandidates.push(event.headers['x-forwarded-uri']);
    if (event.headers?.['x-original-url']) pathCandidates.push(event.headers['x-original-url']);

    if (!action) {
      const knownActions = [
        'services', 'pricing-settings', 'sync-provider', 'provider-services',
        'order', 'orders', 'status', 'admin-stats', 'test-connection'
      ];

      for (const p of pathCandidates) {
        if (!p) continue;
        const clean = p.split('?')[0].replace(/\/+$/, '').toLowerCase();
        const segments = clean.split('/').filter(Boolean);

        if (segments.includes('status') && segments.length > segments.indexOf('status') + 1) {
          action = 'status';
          orderIdParam = segments[segments.indexOf('status') + 1];
          break;
        }

        for (let i = segments.length - 1; i >= 0; i--) {
          const seg = segments[i];
          if (seg && seg !== 'social-boost' && seg !== 'api' && seg !== '.netlify' && seg !== 'functions') {
            if (knownActions.includes(seg)) {
              action = seg;
              break;
            }
          }
        }
        if (action) break;
      }
    }

    // Heuristic fallbacks based on query parameters / body if action is still unset or generic
    if (!action || action === 'social-boost') {
      if (orderIdParam) {
        action = 'status';
      } else if (event.httpMethod === 'POST' && (body.serviceId || body.service || body.quantity)) {
        action = 'order';
      } else if (queryParams.userId || queryParams.all || queryParams.user) {
        action = 'orders';
      } else {
        action = 'services';
      }
    }

    console.log(`[Netlify SocialBoost] Action: ${action}, Method: ${event.httpMethod}`);

    // Helper: Load Pricing Settings from Firestore
    const getPricingSettings = async () => {
      if (!db) return DEFAULT_PRICING;
      try {
        const pRef = doc(db, 'system_settings', 'social_boost_pricing');
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          return { ...DEFAULT_PRICING, ...pSnap.data() };
        }
      } catch (e) {
        console.warn('[Netlify SocialBoost] Pricing read notice:', e);
      }
      return DEFAULT_PRICING;
    };

    // Helper: Calculate Selling Rate for a service
    const calculateRate = (service: any, pricing: any) => {
      const providerRate = Number(service.providerRatePer1000 || service.rate || 0);
      if (pricing.customPrices && pricing.customPrices[service.id]) {
        return Math.round(Number(pricing.customPrices[service.id]));
      }
      const platformMarkup = pricing.platformMarkups?.[service.platform] !== undefined
        ? Number(pricing.platformMarkups[service.platform])
        : Number(pricing.markupPercentage || 35);

      const computedMarkup = (providerRate * platformMarkup) / 100;
      const minMarkup = Number(pricing.minMarkupNaira || 100);
      const finalMarkup = Math.max(computedMarkup, minMarkup);
      return Math.round(providerRate + finalMarkup);
    };

    // 1. GET /services - Retrieve all active, priced services
    if (action === 'services') {
      const callerEmail = (queryParams.callerEmail || body.callerEmail || event.headers?.['x-caller-email'] || event.headers?.['x-admin-email'] || '').toLowerCase().trim();
      const isOwner = callerEmail === 'azeezmusharaf4@gmail.com';
      const pricing = await getPricingSettings();
      let serviceList: any[] = [];
      let lastSyncedAt: string | null = null;

      // Check Firestore cached catalogue
      if (db) {
        try {
          const catRef = doc(db, 'system_settings', 'social_boost_catalogue');
          const catSnap = await getDoc(catRef);
          if (catSnap.exists()) {
            const data = catSnap.data();
            if (Array.isArray(data.services) && data.services.length > 0) {
              serviceList = data.services;
              lastSyncedAt = data.lastSyncedAt || null;
            }
          }
        } catch (e) {
          console.warn('[Netlify SocialBoost] Catalogue read notice:', e);
        }
      }

      // Fallback to BASE_SOCIAL_SERVICES if cache is empty
      if (!serviceList || serviceList.length === 0) {
        serviceList = [...BASE_SOCIAL_SERVICES];
      }

      // Filter hidden services and compute client selling rates
      const hiddenSet = new Set(pricing.hiddenServices || []);
      const bestValueSet = new Set(pricing.bestValueIds || DEFAULT_PRICING.bestValueIds);
      const cheapestSet = new Set(pricing.cheapestIds || DEFAULT_PRICING.cheapestIds);

      const activeServices = serviceList
        .filter((s: any) => isOwner || !hiddenSet.has(s.id))
        .map((s: any) => {
          const providerRate = Number(s.providerRatePer1000 || s.rate || 500);
          const sellingRate = calculateRate(s, pricing);
          const markup = Math.max(0, sellingRate - providerRate);
          if (isOwner) {
            return {
              ...s,
              ratePer1000: sellingRate,
              pricePer1000: sellingRate,
              providerRatePer1000: providerRate,
              markupPer1000: markup,
              isBestValue: bestValueSet.has(s.id),
              isCheapest: cheapestSet.has(s.id)
            };
          }
          const { providerRatePer1000: _p, ...cleanSvc } = s;
          return {
            ...cleanSvc,
            ratePer1000: sellingRate,
            pricePer1000: sellingRate,
            isBestValue: bestValueSet.has(s.id),
            isCheapest: cheapestSet.has(s.id)
          };
        });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          services: activeServices,
          total: activeServices.length,
          lastSyncedAt,
          markupPercentage: pricing.markupPercentage,
          isOwner
        })
      };
    }

    // 2. GET /pricing-settings or POST /pricing-settings
    if (action === 'pricing-settings') {
      if (event.httpMethod === 'POST') {
        const callerEmail = (body.callerEmail || queryParams.callerEmail || event.headers?.['x-caller-email'] || '').toLowerCase().trim();
        if (callerEmail !== 'azeezmusharaf4@gmail.com') {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ success: false, error: 'Forbidden. Owner authorization required.' })
          };
        }

        if (!db) {
          return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database unavailable' }) };
        }

        const pRef = doc(db, 'system_settings', 'social_boost_pricing');
        const updatedSettings = {
          markupPercentage: Number(body.markupPercentage ?? 35),
          minMarkupNaira: Number(body.minMarkupNaira ?? 100),
          platformMarkups: body.platformMarkups || {},
          categoryMarkups: body.categoryMarkups || {},
          customPrices: body.customPrices || {},
          hiddenServices: body.hiddenServices || [],
          bestValueIds: body.bestValueIds || [],
          cheapestIds: body.cheapestIds || [],
          updatedAt: new Date().toISOString()
        };

        await setDoc(pRef, updatedSettings, { merge: true });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Social Boost pricing updated successfully', settings: updatedSettings })
        };
      }

      // GET pricing settings
      const pricing = await getPricingSettings();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, settings: pricing })
      };
    }

    // 3. POST /sync-provider or GET /provider-services
    if (action === 'sync-provider' || action === 'provider-services') {
      if (!apiKey) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            syncedCount: BASE_SOCIAL_SERVICES.length,
            message: 'Using verified baseline services (Provider API key not configured).',
            services: BASE_SOCIAL_SERVICES
          })
        };
      }

      try {
        const pUrl = `${getBaseUrl()}?action=services&key=${encodeURIComponent(apiKey)}`;
        const pRes = await fetch(pUrl, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000) });
        const pData: any = await pRes.json();

        let rawServices: any[] = [];
        if (Array.isArray(pData)) {
          rawServices = pData;
        } else if (pData && Array.isArray(pData.services)) {
          rawServices = pData.services;
        }

        if (rawServices.length > 0) {
          const normalized = rawServices.map((s: any) => {
            const sid = String(s.service || s.id || `smm-${Math.random()}`);
            const sname = s.name || 'Social Media Service';
            const scat = s.category || 'Social Services';
            const { platform, category, type } = normalizeCategory(scat, sname);
            const inputCfg = determineInputConfig(sname, type);
            const rate = Number(s.rate || s.price || 1000);

            return {
              id: sid,
              platform,
              category,
              name: sname,
              type,
              providerRatePer1000: rate,
              min: Number(s.min || 10),
              max: Number(s.max || 100000),
              deliverySpeed: s.deliverySpeed || 'Instant - 24 Hours',
              refill: Boolean(s.refill || s.refill === '1' || s.refill === true),
              quality: s.quality || 'High Quality',
              description: s.description || `${platform} ${type} with automated high-speed delivery.`,
              inputLabel: inputCfg.inputLabel,
              inputPlaceholder: inputCfg.inputPlaceholder,
              inputType: inputCfg.inputType
            };
          });

          if (db) {
            const catRef = doc(db, 'system_settings', 'social_boost_catalogue');
            await setDoc(catRef, {
              services: normalized,
              lastSyncedAt: new Date().toISOString(),
              totalCount: normalized.length
            }, { merge: true });
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: `Successfully synchronized ${normalized.length} services from provider.`,
              syncedCount: normalized.length,
              services: normalized
            })
          };
        }
      } catch (syncErr: any) {
        console.warn('[Netlify SocialBoost] Provider sync notice:', syncErr);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          syncedCount: BASE_SOCIAL_SERVICES.length,
          message: 'Synced with built-in catalogue.',
          services: BASE_SOCIAL_SERVICES
        })
      };
    }

    // 4. POST /order - Place an SMM Order
    if (action === 'order') {
      const { userId, serviceId, link, quantity, customComments } = body;

      if (!userId || !serviceId || !link || !quantity) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing required parameters: userId, serviceId, link, quantity' })
        };
      }

      const numQuantity = Number(quantity);
      if (isNaN(numQuantity) || numQuantity <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Quantity must be a positive number' })
        };
      }

      if (!db) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database service unavailable' }) };
      }

      // Load pricing settings and service info
      const pricing = await getPricingSettings();
      let targetService: any = BASE_SOCIAL_SERVICES.find((s: any) => String(s.id) === String(serviceId));

      if (!targetService && db) {
        try {
          const catRef = doc(db, 'system_settings', 'social_boost_catalogue');
          const catSnap = await getDoc(catRef);
          if (catSnap.exists() && Array.isArray(catSnap.data().services)) {
            targetService = catSnap.data().services.find((s: any) => String(s.id) === String(serviceId));
          }
        } catch {}
      }

      if (!targetService) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: `Service ID "${serviceId}" not found in catalogue.` })
        };
      }

      const minQty = Number(targetService.min || 10);
      const maxQty = Number(targetService.max || 1000000);
      if (numQuantity < minQty || numQuantity > maxQty) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: `Quantity must be between ${minQty.toLocaleString()} and ${maxQty.toLocaleString()}` })
        };
      }

      const sellingRatePer1000 = calculateRate(targetService, pricing);
      const totalChargeNaira = Math.max(1, Math.round((sellingRatePer1000 * numQuantity) / 1000));
      const orderRefId = `SMM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      let updatedBalance = 0;
      let userEmail = '';

      // Atomic balance verification & deduction
      const userDocRef = doc(db, 'users', userId);
      await runTransaction(db, async (transaction) => {
        const uSnap = await transaction.get(userDocRef);
        if (!uSnap.exists()) {
          throw new Error('User profile not found.');
        }
        const uData = uSnap.data();
        const curBal = Number(uData.walletBalance || 0);
        userEmail = (uData.email || '').toLowerCase().trim();

        if (curBal < totalChargeNaira) {
          throw new Error(`Insufficient wallet balance. You have ₦${curBal.toLocaleString()}, but order requires ₦${totalChargeNaira.toLocaleString()}`);
        }

        updatedBalance = curBal - totalChargeNaira;
        const curTotalPurchases = Number(uData.totalPurchasesAmount || 0) + totalChargeNaira;

        transaction.update(userDocRef, {
          walletBalance: updatedBalance,
          totalPurchasesAmount: curTotalPurchases,
          updatedAt: new Date().toISOString()
        });

        const txDocRef = doc(db, 'wallet_transactions', orderRefId);
        transaction.set(txDocRef, {
          id: orderRefId,
          userId,
          userEmail,
          amount: totalChargeNaira,
          type: 'purchase',
          method: 'wallet',
          status: 'successful',
          description: `Social Boost: ${targetService.name} (${numQuantity.toLocaleString()} units)`,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      });

      // Submit order to OneGridHub SMM API if key configured
      let providerOrderId = null;
      let providerStatus = 'Processing';
      if (apiKey && !isNaN(Number(targetService.id))) {
        try {
          const smmOrderParams = new URLSearchParams({
            action: 'add',
            key: apiKey,
            service: String(targetService.id),
            link: link.trim(),
            quantity: String(numQuantity)
          });
          if (customComments) {
            smmOrderParams.set('comments', customComments);
          }

          const providerRes = await fetch(getBaseUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: smmOrderParams.toString(),
            signal: AbortSignal.timeout(10000)
          });
          const pOrderData: any = await providerRes.json();
          if (pOrderData && pOrderData.order) {
            providerOrderId = pOrderData.order;
            providerStatus = 'In Progress';
          }
        } catch (pErr) {
          console.warn('[Netlify SocialBoost] Provider order submission notice:', pErr);
        }
      }

      // Record Social Boost order in Firestore
      const orderDocRef = doc(db, 'social_boost_orders', orderRefId);
      const orderRecord = {
        id: orderRefId,
        orderId: orderRefId,
        userId,
        userEmail,
        serviceId: targetService.id,
        serviceName: targetService.name,
        platform: targetService.platform,
        category: targetService.category,
        link: link.trim(),
        quantity: numQuantity,
        chargeNaira: totalChargeNaira,
        ratePer1000: sellingRatePer1000,
        providerOrderId: providerOrderId || null,
        status: providerStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(orderDocRef, orderRecord);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Social Boost order placed successfully!',
          order: orderRecord,
          newWalletBalance: updatedBalance
        })
      };
    }

    // 5. GET /orders - Retrieve User's Social Boost Orders
    if (action === 'orders') {
      const targetUid = queryParams.userId || body.userId;
      if (!targetUid) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'User ID required' }) };
      }

      if (!db) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, orders: [] }) };
      }

      const ordersQ = query(collection(db, 'social_boost_orders'), where('userId', '==', targetUid));
      const ordersSnap = await getDocs(ordersQ);
      const orders = ordersSnap.docs.map(d => d.data());

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, orders, total: orders.length })
      };
    }

    // 6. GET /status - Check Order Status
    if (action === 'status') {
      const idToCheck = orderIdParam || queryParams.orderId || queryParams.id;
      if (!idToCheck) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Order ID is required' }) };
      }

      if (!db) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: 'In Progress' }) };
      }

      const oRef = doc(db, 'social_boost_orders', idToCheck);
      const oSnap = await getDoc(oRef);
      if (oSnap.exists()) {
        const oData = oSnap.data();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, order: oData, status: oData.status || 'In Progress' })
        };
      }

      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Order not found' })
      };
    }

    // 7. GET /admin-stats - Owner Analytics
    if (action === 'admin-stats') {
      if (!db) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, stats: { totalOrders: 0, totalRevenue: 0 } }) };
      }
      const allOrdersSnap = await getDocs(collection(db, 'social_boost_orders'));
      let totalRevenue = 0;
      let totalOrders = allOrdersSnap.docs.length;
      allOrdersSnap.docs.forEach(d => {
        totalRevenue += Number(d.data().chargeNaira || 0);
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          stats: {
            totalOrders,
            totalRevenue,
            hasProviderApiKey: Boolean(apiKey)
          }
        })
      };
    }

    // 8. GET /test-connection
    if (action === 'test-connection') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: 'ready',
          hasApiKey: Boolean(apiKey),
          baseServicesAvailable: BASE_SOCIAL_SERVICES.length
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: `Unrecognized action: ${action}` })
    };
  } catch (err: any) {
    console.error('[Netlify SocialBoost] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'Social Boost internal server error' })
    };
  }
};
