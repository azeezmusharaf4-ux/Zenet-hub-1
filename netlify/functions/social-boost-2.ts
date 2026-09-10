import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from './_firebase';
import { getEstraLogConfig, queryEstraLog } from './_estralog';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const DEFAULT_PROVIDER2_SERVICES = [
  {
    id: '101',
    service: '101',
    name: 'Telegram Channel/Group Members [Non-Drop - High Quality]',
    type: 'Default',
    category: 'Telegram Members',
    platform: 'Telegram',
    rate: 1450,
    pricePerThousandNgn: 1450,
    min: 100,
    max: 50000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Instant start. Refill button active for 30 days.'
  },
  {
    id: '102',
    service: '102',
    name: 'Telegram Post Views [Instant Fast - Lifetime Guarantee]',
    type: 'Default',
    category: 'Telegram Post Views',
    platform: 'Telegram',
    rate: 450,
    pricePerThousandNgn: 450,
    min: 500,
    max: 100000,
    dripfeed: true,
    refill: false,
    cancel: false,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Lightning fast view counter increments.'
  },
  {
    id: '103',
    service: '103',
    name: 'Instagram Real Followers [Instant Start - 30 Days Refill]',
    type: 'Default',
    category: 'Instagram Followers',
    platform: 'Instagram',
    rate: 1950,
    pricePerThousandNgn: 1950,
    min: 100,
    max: 20000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Real active looking accounts with profile pictures.'
  },
  {
    id: '104',
    service: '104',
    name: 'Instagram HQ Likes [Fast Delivery]',
    type: 'Default',
    category: 'Instagram Likes',
    platform: 'Instagram',
    rate: 750,
    pricePerThousandNgn: 750,
    min: 100,
    max: 50000,
    dripfeed: false,
    refill: false,
    cancel: false,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Fast delivery within 5-10 minutes.'
  },
  {
    id: '105',
    service: '105',
    name: 'Facebook Page Likes + Followers [Real Global]',
    type: 'Default',
    category: 'Facebook Page Likes',
    platform: 'Facebook',
    rate: 2200,
    pricePerThousandNgn: 2200,
    min: 100,
    max: 10000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Permanent page followers and engagements.'
  },
  {
    id: '106',
    service: '106',
    name: 'TikTok Active Followers [Organic Quality]',
    type: 'Default',
    category: 'TikTok Followers',
    platform: 'TikTok',
    rate: 2400,
    pricePerThousandNgn: 2400,
    min: 100,
    max: 50000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'High retention accounts, zero drop.'
  },
  {
    id: '107',
    service: '107',
    name: 'TikTok FYP Likes [Instant Fast]',
    type: 'Default',
    category: 'TikTok Likes & Views',
    platform: 'TikTok',
    rate: 650,
    pricePerThousandNgn: 650,
    min: 200,
    max: 100000,
    dripfeed: true,
    refill: false,
    cancel: false,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Boosts video ranking and algorithm discovery.'
  },
  {
    id: '108',
    service: '108',
    name: 'YouTube Channel Subscribers [Monetizable]',
    type: 'Default',
    category: 'YouTube Subscribers',
    platform: 'YouTube',
    rate: 6800,
    pricePerThousandNgn: 6800,
    min: 50,
    max: 5000,
    dripfeed: true,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Real audience watch time, safe for monetized channels.'
  },
  {
    id: '109',
    service: '109',
    name: 'Twitter / X High Quality Followers',
    type: 'Default',
    category: 'Twitter Followers',
    platform: 'Twitter',
    rate: 3200,
    pricePerThousandNgn: 3200,
    min: 100,
    max: 10000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Verified appearance, stable profiles.'
  },
  {
    id: '110',
    service: '110',
    name: 'Discord Server Members [Online Active]',
    type: 'Default',
    category: 'Discord Members',
    platform: 'Discord',
    rate: 3500,
    pricePerThousandNgn: 3500,
    min: 100,
    max: 10000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Active looking Discord members with online presence.'
  },
  {
    id: '111',
    service: '111',
    name: 'LinkedIn Connections & Followers',
    type: 'Default',
    category: 'LinkedIn Connections',
    platform: 'LinkedIn',
    rate: 5400,
    pricePerThousandNgn: 5400,
    min: 50,
    max: 5000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Corporate professional profiles for LinkedIn networking.'
  },
  {
    id: '112',
    service: '112',
    name: 'Spotify Track Plays [Royalty Eligible]',
    type: 'Default',
    category: 'Spotify Plays',
    platform: 'Spotify',
    rate: 950,
    pricePerThousandNgn: 950,
    min: 500,
    max: 50000,
    dripfeed: true,
    refill: false,
    cancel: false,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Streams counted towards Spotify discovery algorithm.'
  },
  {
    id: '113',
    service: '113',
    name: 'Snapchat Public Profile Followers',
    type: 'Default',
    category: 'Snapchat Followers',
    platform: 'Snapchat',
    rate: 3800,
    pricePerThousandNgn: 3800,
    min: 100,
    max: 10000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Followers for public Snapchat profiles.'
  },
  {
    id: '114',
    service: '114',
    name: 'Global Website Visitors [Organic Direct]',
    type: 'Default',
    category: 'Website Traffic',
    platform: 'Website',
    rate: 850,
    pricePerThousandNgn: 850,
    min: 1000,
    max: 500000,
    dripfeed: true,
    refill: false,
    cancel: false,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'High retention web traffic from global desktop & mobile.'
  },
  {
    id: '115',
    service: '115',
    name: 'Multi-Network Social Growth & Engagement Boost',
    type: 'Default',
    category: 'Special Growth',
    platform: 'Other',
    rate: 2100,
    pricePerThousandNgn: 2100,
    min: 100,
    max: 20000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'EstraLog Tools High-Speed Pool',
    description: 'Cross-platform engagement package.'
  }
];

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
  }

  const queryParams = event.queryStringParameters || {};
  let body: any = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      body = {};
    }
  }

  const pathParts = (event.path || '').split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const action = (queryParams.action || body.action || (lastPart !== 'social-boost-2' ? lastPart : '') || 'services').toLowerCase();

  const { apiKey } = getEstraLogConfig();
  const db = getDb();

  try {
    // 1. GET SERVICES
    if (action === 'services') {
      let services = [...DEFAULT_PROVIDER2_SERVICES];
      let pricingSettings = {
        profitMarginPercent: 35,
        usdToNgnRate: 1550,
        fixedMarkupPerThousand: 200
      };

      if (db) {
        try {
          const settingsSnap = await getDoc(doc(db, 'settings', 'social_boost_2_pricing'));
          if (settingsSnap.exists()) {
            pricingSettings = { ...pricingSettings, ...settingsSnap.data() };
          }

          const customServicesSnap = await getDocs(collection(db, 'social_boost_2_services'));
          if (!customServicesSnap.empty) {
            const list: any[] = [];
            customServicesSnap.forEach(d => list.push(d.data()));
            if (list.length > 0) {
              services = list;
            }
          }
        } catch (e) {
          console.warn('[SocialBoost2] Firestore custom read notice:', e);
        }
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          provider: 'EstraLog Tools',
          hasApiKey: Boolean(apiKey),
          services,
          pricingSettings
        })
      };
    }

    // 2. PLACE ORDER
    if (action === 'order') {
      const userId = body.userId || queryParams.userId;
      const totalCost = Number(body.totalCost || body.amountNgn || 0);
      const serviceId = String(body.service || body.serviceId || '');
      const link = (body.link || body.target || body.targetUrl || '').toString().trim();
      const quantity = Number(body.quantity || 0);

      if (!userId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'User ID is required to place an order.' })
        };
      }

      if (!link) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Target link or profile URL is required.' })
        };
      }

      if (!serviceId || quantity <= 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Valid service and quantity are required.' })
        };
      }

      if (totalCost <= 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Invalid total order cost.' })
        };
      }

      if (!db) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Database service is temporarily unavailable.' })
        };
      }

      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'User profile not found.' })
        };
      }

      const userData = userDoc.data();
      const currentBalance = userData.walletBalance || 0;
      if (currentBalance < totalCost) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: `Insufficient wallet balance (₦${currentBalance.toLocaleString()}). Required: ₦${totalCost.toLocaleString()}`
          })
        };
      }

      // Query live EstraLog Tools smm_order endpoint if available
      let upstreamOrderId: string | null = null;
      if (apiKey) {
        try {
          const upstreamRes = await queryEstraLog('smm_order', {
            service: serviceId,
            link,
            quantity
          }, 'POST');

          if (upstreamRes) {
            if (upstreamRes.status === 'success' && (upstreamRes.order || upstreamRes.order_id)) {
              upstreamOrderId = String(upstreamRes.order || upstreamRes.order_id);
            } else if (upstreamRes.status === 'error') {
              const upstreamMsg = upstreamRes.message || 'Upstream provider error';
              const upstreamCode = upstreamRes.code ? ` (${upstreamRes.code})` : '';
              return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                  success: false,
                  error: `EstraLog Tools response: ${upstreamMsg}${upstreamCode}. Your wallet balance was not charged.`
                })
              };
            }
          }
        } catch (err: any) {
          console.warn('[EstraLog Tools smm_order notice]:', err.message);
        }
      }

      const orderId = `SB2-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      // Execute atomic wallet deduction and order registration
      await runTransaction(db, async (transaction) => {
        const uSnap = await transaction.get(userRef);
        if (!uSnap.exists()) throw new Error('User profile not found.');
        const uBal = uSnap.data().walletBalance || 0;
        if (uBal < totalCost) {
          throw new Error(`Insufficient wallet balance (₦${uBal.toLocaleString()}). Required: ₦${totalCost.toLocaleString()}`);
        }

        transaction.update(userRef, {
          walletBalance: uBal - totalCost,
          updatedAt: new Date().toISOString()
        });

        const orderDocRef = doc(db, 'orders_social_boost_2', orderId);
        const orderRecord = {
          orderId,
          providerOrderId: upstreamOrderId,
          userId,
          userEmail: body.userEmail || userData.email || '',
          provider: 'EstraLog Tools',
          service: serviceId,
          serviceName: body.serviceName || `Service #${serviceId}`,
          category: body.category || 'Growth',
          platform: body.platform || 'Other',
          link,
          quantity,
          charge: totalCost,
          status: 'Processing',
          startCount: 0,
          remains: quantity,
          createdAt: new Date().toISOString()
        };

        transaction.set(orderDocRef, orderRecord);
      });

      const placedOrderDoc = await getDoc(doc(db, 'orders_social_boost_2', orderId));
      const placedOrder = placedOrderDoc.exists() ? placedOrderDoc.data() : { orderId };

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          provider: 'EstraLog Tools',
          message: 'Social Boost order submitted successfully.',
          orderId,
          providerOrderId: upstreamOrderId,
          order: placedOrder
        })
      };
    }

    // 3. GET ORDER STATUS
    if (action === 'status') {
      const orderId = queryParams.orderId || body.orderId;
      if (!orderId || !db) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Order ID is required.' })
        };
      }

      const orderRef = doc(db, 'orders_social_boost_2', orderId);
      const snap = await getDoc(orderRef);
      if (!snap.exists()) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Order not found.' })
        };
      }

      const orderData = snap.data();

      // Check live upstream status if providerOrderId exists
      if (orderData.providerOrderId && apiKey) {
        try {
          const upstreamStatus = await queryEstraLog('smm_status', { order: orderData.providerOrderId });
          if (upstreamStatus && upstreamStatus.status === 'success' && upstreamStatus.state) {
            await updateDoc(orderRef, {
              status: upstreamStatus.state,
              remains: upstreamStatus.remains !== undefined ? upstreamStatus.remains : orderData.remains,
              updatedAt: new Date().toISOString()
            });
            orderData.status = upstreamStatus.state;
          }
        } catch (err: any) {
          console.warn('[EstraLog smm_status check notice]:', err.message);
        }
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          provider: 'EstraLog Tools',
          status: orderData.status,
          order: orderData
        })
      };
    }

    // 4. LIST USER ORDERS
    if (action === 'orders') {
      const userId = queryParams.userId || body.userId;
      const isAll = queryParams.all === 'true';

      if (!db) {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: true, orders: [] })
        };
      }

      let q;
      if (isAll) {
        q = query(collection(db, 'orders_social_boost_2'));
      } else if (userId) {
        q = query(collection(db, 'orders_social_boost_2'), where('userId', '==', userId));
      } else {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: true, orders: [] })
        };
      }

      const snaps = await getDocs(q);
      const ordersList: any[] = [];
      snaps.forEach(docSnap => {
        ordersList.push(docSnap.data());
      });

      ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          provider: 'EstraLog Tools',
          orders: ordersList
        })
      };
    }

    // 5. OWNER PRICING SETTINGS
    if (action === 'pricing-settings') {
      if (event.httpMethod === 'POST') {
        if (!db) {
          return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ success: false, error: 'DB unavailable' }) };
        }
        await setDoc(doc(db, 'settings', 'social_boost_2_pricing'), {
          profitMarginPercent: Number(body.profitMarginPercent || 35),
          usdToNgnRate: Number(body.usdToNgnRate || 1550),
          fixedMarkupPerThousand: Number(body.fixedMarkupPerThousand || 200),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: true, message: 'EstraLog Tools pricing settings updated.' })
        };
      } else {
        let pricingSettings = {
          profitMarginPercent: 35,
          usdToNgnRate: 1550,
          fixedMarkupPerThousand: 200
        };
        if (db) {
          const snap = await getDoc(doc(db, 'settings', 'social_boost_2_pricing'));
          if (snap.exists()) {
            pricingSettings = { ...pricingSettings, ...snap.data() };
          }
        }
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: true, settings: pricingSettings })
        };
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, provider: 'EstraLog Tools', message: 'EstraLog Tools Boost Ready' })
    };

  } catch (err: any) {
    console.error('[EstraLog Tools Social Boost Error]:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: err.message || 'Internal EstraLog Tools error' })
    };
  }
};
