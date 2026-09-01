import { getDb } from './_firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

const getSmmApiKey = (): string => {
  const rawKey = (
    process.env.ONEGRIDHUB_SMM_API_KEY ||
    process.env.ONEGRIDHUB_API_KEY ||
    process.env.ONEGRID_API_KEY ||
    process.env.ONEGRIDHUB_KEY ||
    process.env.SMM_API_KEY ||
    process.env.OGH_API_KEY ||
    process.env.ONEGRIDHUB_TOKEN ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  const isPlaceholder = !rawKey ||
    ['ONEGRIDHUB_API_KEY', 'YOUR_API_KEY', 'MY_ONEGRIDHUB_API_KEY', 'UNDEFINED', 'NULL', 'PLACEHOLDER', 'YOUR_KEY_HERE'].includes(rawKey.toUpperCase()) ||
    rawKey.startsWith('MY_');

  return isPlaceholder ? '' : rawKey;
};

const getOneGridHubBaseUrl = (): string => {
  let raw = (process.env.ONEGRIDHUB_BASE_URL || 'https://onegridhub.com/api/v1/index.php').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (!raw.includes('/api/v1')) {
    raw = `${raw}/api/v1/index.php`;
  } else if (!raw.endsWith('.php')) {
    raw = `${raw}/index.php`;
  }
  return raw;
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const extractDynamicPlatform = (category: string, name: string): string => {
  const cat = (category || '').trim();
  const cleanName = (name || '').trim();
  const combined = (cat + ' ' + cleanName).toLowerCase();
  
  if (combined.includes('instagram') || combined.includes('ig ') || combined.includes(' ig') || combined.includes('ig-') || combined.includes('ig reels') || combined.includes('ig story') || combined.includes('ig followers')) return 'Instagram';
  if (combined.includes('facebook') || combined.includes('fb ') || combined.includes('fb-') || combined.includes('meta ') || combined.includes('fb page') || combined.includes('fb post')) return 'Facebook';
  if (combined.includes('tiktok') || combined.includes('tt ') || combined.includes('douyin') || combined.includes('tiktok followers') || combined.includes('tiktok likes')) return 'TikTok';
  if (combined.includes('youtube') || combined.includes('yt ') || combined.includes('yt-') || combined.includes('shorts') || combined.includes('watch hour') || combined.includes('subscribers')) return 'YouTube';
  if (combined.includes('twitter') || combined.includes(' x ') || combined.includes('x.com') || combined.includes('tweet') || combined.includes('x views') || combined.includes('x followers') || combined.includes('x likes') || combined.includes('x retweets') || combined.includes('x poll')) return 'Twitter / X';
  if (combined.includes('telegram') || combined.includes('tg ') || combined.includes('tg-') || combined.includes('t.me')) return 'Telegram';
  if (combined.includes('linkedin') || combined.includes('linked in')) return 'LinkedIn';
  if (combined.includes('spotify') || combined.includes('audiomack') || combined.includes('soundcloud') || combined.includes('apple music') || combined.includes('deezer') || combined.includes('boomplay') || combined.includes('mixcloud') || combined.includes('shazam') || combined.includes('hypeddit')) return 'Spotify & Music';
  if (combined.includes('threads')) return 'Threads';
  if (combined.includes('discord')) return 'Discord';
  if (combined.includes('twitch') || combined.includes('kick') || combined.includes('rumble') || combined.includes('vimeo') || combined.includes('trovo') || combined.includes('streamers') || combined.includes('sooplive') || combined.includes('openrec') || combined.includes('panda.tv') || combined.includes('mixch') || combined.includes('live stream')) return 'Twitch & Streaming';
  if (combined.includes('snapchat')) return 'Snapchat';
  if (combined.includes('reddit')) return 'Reddit';
  if (combined.includes('pinterest')) return 'Pinterest';
  if (combined.includes('quora')) return 'Quora';
  if (combined.includes('bluesky')) return 'BlueSky';
  if (combined.includes('steam') || combined.includes('roblox') || combined.includes('pubg') || combined.includes('riot games') || combined.includes('valorant') || combined.includes('league of legends') || combined.includes('brawl stars') || combined.includes('free fire') || combined.includes('ea play') || combined.includes('xbox') || combined.includes('gaming') || combined.includes('gamers')) return 'Gaming & Accounts';
  if (combined.includes('behance') || combined.includes('dribbble') || combined.includes('canva') || combined.includes('freepik') || combined.includes('envato') || combined.includes('capcut')) return 'Design & Creative';
  if (combined.includes('trustpilot') || combined.includes('google reviews') || combined.includes('tripadvisor') || combined.includes('review') || combined.includes('rating') || combined.includes('google maps')) return 'Reviews & Ratings';
  if (combined.includes('traffic') || combined.includes('website') || combined.includes('seo ') || combined.includes('backlinks') || combined.includes('visitors') || combined.includes('google search')) return 'Website Traffic & SEO';
  if (combined.includes('whatsapp')) return 'WhatsApp';
  return 'Other Services';
};

const normalizeOneGridHubService = (item: any, index: number) => {
  const rawId = String(item.service || item.id || `ogh-${index + 1}`);
  const rawName = String(item.name || item.service_name || 'Social Media Boosting Service').trim();
  const rawCategory = String(item.category || 'General').trim();
  const rawRate = Number(item.rate_per_1000 || item.rate || item.price) || 0;
  const providerRateNgn = Math.max(1, Math.round(rawRate));
  const platform = extractDynamicPlatform(rawCategory, rawName);
  const description = item.desc || item.description || `Automated fast delivery for ${rawName}. Direct provider routing from OneGridHub network.`;
  const minQty = Math.max(1, Number(item.min) || 50);
  const maxQty = Math.max(minQty, Number(item.max) || 100000);

  const lowerAll = (rawCategory + ' ' + rawName).toLowerCase();
  let type = item.type || 'Service';
  if (lowerAll.includes('follower')) type = 'Followers';
  else if (lowerAll.includes('like')) type = 'Likes';
  else if (lowerAll.includes('view') || lowerAll.includes('impression')) type = 'Views';
  else if (lowerAll.includes('subscriber') || lowerAll.includes('sub ')) type = 'Subscribers';
  else if (lowerAll.includes('member')) type = 'Members';
  else if (lowerAll.includes('comment')) type = 'Comments';
  else if (lowerAll.includes('share') || lowerAll.includes('repost') || lowerAll.includes('retweet')) type = 'Shares';
  else if (lowerAll.includes('watch hour') || lowerAll.includes('watchtime') || lowerAll.includes('watch time')) type = 'Watch Hours';
  else if (lowerAll.includes('play') || lowerAll.includes('stream') || lowerAll.includes('listener')) type = 'Plays & Streams';
  else if (lowerAll.includes('reaction') || lowerAll.includes('poll')) type = 'Reactions';
  else if (lowerAll.includes('review') || lowerAll.includes('rating')) type = 'Reviews';
  else if (lowerAll.includes('traffic') || lowerAll.includes('visit')) type = 'Website Visits';

  const isCustomComments = item.type === 'Custom Comments' || item.type === 'custom_comments' || lowerAll.includes('custom comment');
  const refillGuarantee = Boolean(item.refill && item.refill !== '0' && item.refill !== 'false' && item.refill !== false);

  return {
    id: `ogh-svc-${rawId}`,
    providerServiceId: rawId,
    platform,
    category: rawCategory,
    name: rawName,
    type,
    providerRatePer1000: Math.max(1, providerRateNgn),
    min: minQty,
    max: maxQty,
    deliverySpeed: item.dripfeed ? 'Drip-feed Capable' : (item.deliverySpeed || 'Instant Start Delivery'),
    refill: refillGuarantee,
    quality: item.quality || 'Verified High Quality',
    description,
    inputLabel: isCustomComments ? 'Target Link + Custom Comments' : `${platform} Target URL or @Username`,
    inputPlaceholder: isCustomComments ? 'Enter 1 comment per line' : `https://${platform.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/... or @username`,
    inputType: isCustomComments ? 'custom_comments' : 'link'
  };
};

const queryOneGridHubSmm = async (action: string, extraParams: Record<string, any> = {}) => {
  const apiKey = getSmmApiKey();
  if (!apiKey) return null;
  const baseUrl = getOneGridHubBaseUrl();

  try {
    const q = new URLSearchParams({
      action,
      endpoint: action,
      key: apiKey,
      api_key: apiKey,
      ...extraParams
    }).toString();

    const res = await fetch(`${baseUrl}?${q}`, {
      headers: { 'Accept': 'application/json, text/plain, */*', 'User-Agent': 'ZENET-Hub-SMM/1.0' }
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return data;
    }
  } catch (err) {
    console.warn(`[OneGridHub SMM Error] Action ${action}:`, err);
  }
  return null;
};

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const db = getDb();
  const rawPath = event.path || '';
  const isServicesReq = rawPath.includes('/services') || event.queryStringParameters?.action === 'services';
  const isPricingReq = rawPath.includes('/pricing-settings') || event.queryStringParameters?.action === 'pricing-settings';
  const isOrderReq = rawPath.includes('/order') || event.queryStringParameters?.action === 'order';
  const isOrdersReq = rawPath.includes('/orders') || event.queryStringParameters?.action === 'orders';
  const isStatusReq = rawPath.includes('/status') || event.queryStringParameters?.action === 'status';
  const isSyncReq = rawPath.includes('/sync-provider') || event.queryStringParameters?.action === 'sync-provider';

  // 1. GET Services Catalogue
  if (event.httpMethod === 'GET' && (!rawPath || isServicesReq || rawPath.endsWith('/social-boost'))) {
    try {
      let liveServices: any[] = [];
      let lastSyncedAt = new Date().toISOString();

      if (db) {
        try {
          const docRef = doc(db, 'system_settings', 'social_boost_catalogue');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.services) && data.services.length > 0) {
              liveServices = data.services;
              if (data.lastSyncedAt) lastSyncedAt = data.lastSyncedAt;
            }
          }
        } catch (dbErr) {
          console.warn('[SocialBoost Netlify] DB cache read notice:', dbErr);
        }
      }

      // If catalogue not in DB yet, fetch live from provider
      if (liveServices.length === 0) {
        const smmData = await queryOneGridHubSmm('services');
        if (Array.isArray(smmData) && smmData.length > 0) {
          liveServices = smmData.map((s, idx) => normalizeOneGridHubService(s, idx));
          if (db) {
            try {
              await setDoc(doc(db, 'system_settings', 'social_boost_catalogue'), {
                services: liveServices,
                total: liveServices.length,
                lastSyncedAt
              });
            } catch {}
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          services: liveServices,
          total: liveServices.length,
          lastSyncedAt
        })
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: err.message })
      };
    }
  }

  // 2. GET/POST Pricing Settings
  if (isPricingReq) {
    if (event.httpMethod === 'GET') {
      let settings = {
        defaultMarkupPercent: 45,
        minMarkupPer1k: 350,
        pricingStyle: 'standard',
        curatedServiceIds: [],
        bestValueServiceIds: {},
        serviceOverrides: {},
        platformStatus: {}
      };
      if (db) {
        try {
          const docRef = doc(db, 'system_settings', 'social_boost_pricing');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            settings = { ...settings, ...snap.data() };
          }
        } catch {}
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, settings }) };
    }

    if (event.httpMethod === 'POST') {
      try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
        if (db) {
          const docRef = doc(db, 'system_settings', 'social_boost_pricing');
          await setDoc(docRef, { ...body, updatedAt: new Date().toISOString() }, { merge: true });
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Settings saved successfully.' }) };
      } catch (err: any) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }
  }

  // 3. POST Order
  if (isOrderReq && event.httpMethod === 'POST') {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      const { serviceId, link, quantity, customComments, userId } = body;

      if (!serviceId || !link || !quantity || !userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Service ID, Target URL, Quantity, and User ID are required.' })
        };
      }

      if (!db) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database service is unavailable.' }) };
      }

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'User account not found.' }) };
      }

      const userData = userSnap.data();
      const walletBalance = Number(userData.walletBalance || 0);

      let service: any = null;
      try {
        const catSnap = await getDoc(doc(db, 'system_settings', 'social_boost_catalogue'));
        if (catSnap.exists()) {
          const list = catSnap.data().services || [];
          service = list.find((s: any) => s.id === serviceId || s.providerServiceId === serviceId);
        }
      } catch {}

      const providerRate = Number(service?.providerRatePer1000 || 800);
      const markupPercent = 45;
      const ratePer1000 = Math.max(300, Math.round(providerRate * (1 + markupPercent / 100)));
      const totalCharge = Math.ceil((Number(quantity) / 1000) * ratePer1000);

      if (walletBalance < totalCharge) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Insufficient wallet balance. Total cost is ₦${totalCharge.toLocaleString()}, but your balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`
          })
        };
      }

      let providerOrderId = '';
      if (service?.providerServiceId) {
        const smmOrder = await queryOneGridHubSmm('add', {
          service: service.providerServiceId,
          link,
          quantity: Number(quantity),
          comments: customComments || undefined
        });
        if (smmOrder && (smmOrder.order || smmOrder.order_id)) {
          providerOrderId = String(smmOrder.order || smmOrder.order_id);
        }
      }

      const newBalance = walletBalance - totalCharge;
      const orderId = `SMM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await updateDoc(userRef, {
        walletBalance: newBalance,
        totalPurchasesAmount: (Number(userData.totalPurchasesAmount) || 0) + totalCharge
      });

      const orderRecord = {
        id: orderId,
        userId,
        userEmail: userData.email || '',
        userName: userData.displayName || 'Buyer',
        serviceId,
        providerServiceId: service?.providerServiceId || '',
        providerOrderId,
        serviceName: service?.name || 'Social Boost Package',
        platform: service?.platform || 'Social',
        category: service?.category || 'Boosting',
        link,
        quantity: Number(quantity),
        customComments: customComments || '',
        charge: totalCharge,
        currency: 'NGN',
        status: 'processing',
        startCount: 0,
        remains: Number(quantity),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'social_boost_orders', orderId), orderRecord);

      const txId = `tx-smm-${orderId}`;
      await setDoc(doc(db, 'wallet_transactions', txId), {
        id: txId,
        userId,
        type: 'purchase',
        amount: totalCharge,
        description: `Social Boost: ${service?.name || 'Package'} (Qty: ${Number(quantity).toLocaleString()}) for ${link}`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'completed',
        reference: orderId
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          orderId,
          newBalance,
          message: `Order #${orderId} placed successfully! Your boosting campaign has started.`,
          order: orderRecord
        })
      };
    } catch (err: any) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
    }
  }

  // 4. GET Orders
  if (isOrdersReq && event.httpMethod === 'GET') {
    try {
      const userId = event.queryStringParameters?.userId;
      if (!userId || !db) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, orders: [] }) };
      }
      const q = query(collection(db, 'social_boost_orders'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, orders }) };
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, orders: [] }) };
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, message: 'Social Boost endpoint ready' })
  };
};
