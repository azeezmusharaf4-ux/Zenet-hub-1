import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from './_firebase';

// Helper to resolve Provider 2 Social Boost API Key
const getProvider2SocialApiKey = (): string => {
  const candidates = [
    process.env.PROVIDER2_SOCIAL_BOOST_API_KEY,
    process.env.PROVIDER2_SMM_API_KEY,
    process.env.SOCIAL_BOOST_2_API_KEY
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      const clean = c.trim().replace(/^['"`]|['"`]$/g, '').trim();
      if (clean && clean !== 'undefined' && clean !== 'null' && !clean.startsWith('MY_')) {
        return clean;
      }
    }
  }
  return '';
};

// Helper to resolve Provider 2 Social Boost Base URL
const getProvider2SocialBaseUrl = (): string => {
  return (process.env.PROVIDER2_SOCIAL_BOOST_BASE_URL || process.env.PROVIDER2_SMM_BASE_URL || 'https://api.provider2-smm.com/v2')
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/\/+$/, '');
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const DEFAULT_PROVIDER2_SERVICES = [
  {
    service: '201',
    name: 'Instagram Followers [High Quality - Non Drop - Instant]',
    type: 'Default',
    category: 'Instagram Followers',
    rate: 1800,
    min: 50,
    max: 100000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Instagram',
    description: 'Instant start. Refill button active for 30 days.'
  },
  {
    service: '202',
    name: 'Instagram Likes [Real Active - 20k/Day - Super Fast]',
    type: 'Default',
    category: 'Instagram Likes',
    rate: 450,
    min: 50,
    max: 50000,
    dripfeed: false,
    refill: false,
    cancel: false,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Instagram',
    description: 'Fast delivery within 5-10 minutes.'
  },
  {
    service: '203',
    name: 'TikTok Followers [Worldwide Real Accounts - Instant]',
    type: 'Default',
    category: 'TikTok Followers',
    rate: 2200,
    min: 100,
    max: 50000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'TikTok',
    description: 'High retention accounts, zero drop.'
  },
  {
    service: '204',
    name: 'TikTok FYP Video Views [Algorithm Trigger - Instant]',
    type: 'Default',
    category: 'TikTok Views',
    rate: 150,
    min: 500,
    max: 1000000,
    dripfeed: true,
    refill: false,
    cancel: false,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'TikTok',
    description: 'Boosts video ranking and algorithm discovery.'
  },
  {
    service: '205',
    name: 'YouTube Views [High Retention - Monetizable]',
    type: 'Default',
    category: 'YouTube Views',
    rate: 3100,
    min: 500,
    max: 500000,
    dripfeed: true,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'YouTube',
    description: 'Real audience watch time, safe for monetized channels.'
  },
  {
    service: '206',
    name: 'Telegram Channel Members [Non Drop - 0% Drop Rate]',
    type: 'Default',
    category: 'Telegram Members',
    rate: 1650,
    min: 50,
    max: 200000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Telegram',
    description: 'High quality channel subscribers.'
  },
  {
    service: '207',
    name: 'Twitter / X Followers [Organic Looking - Instant]',
    type: 'Default',
    category: 'Twitter Followers',
    rate: 2800,
    min: 100,
    max: 50000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Twitter',
    description: 'Verified appearance, stable profiles.'
  },
  {
    service: '208',
    name: 'Facebook Page Likes & Followers [High Quality]',
    type: 'Default',
    category: 'Facebook Page Likes',
    rate: 1950,
    min: 100,
    max: 50000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Facebook',
    description: 'Permanent page followers and engagements.'
  }
];

export const handler = async (event: any, context: any) => {
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
  const action = queryParams.action || body.action || (lastPart !== 'social-boost-2' ? lastPart : '') || 'services';

  const apiKey = getProvider2SocialApiKey();
  const baseUrl = getProvider2SocialBaseUrl();
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
          provider: 'Provider 2',
          hasApiKey: Boolean(apiKey),
          services,
          pricingSettings
        })
      };
    }

    // 2. PLACE ORDER (With Firestore Wallet escrow check & deduction)
    if (action === 'order') {
      const userId = body.userId || queryParams.userId;
      const totalCost = Number(body.totalCost || 0);
      const serviceId = String(body.service);
      const link = body.link;
      const quantity = Number(body.quantity);

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
          body: JSON.stringify({ success: false, error: 'Target link or username is required.' })
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
      const orderId = `SB2-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error('User profile not found.');
        }

        const userData = userDoc.data();
        const currentBalance = userData.walletBalance || 0;

        if (currentBalance < totalCost) {
          throw new Error(`Insufficient wallet balance (₦${currentBalance.toLocaleString()}). Required: ₦${totalCost.toLocaleString()}`);
        }

        const newBalance = currentBalance - totalCost;
        transaction.update(userRef, {
          walletBalance: newBalance,
          updatedAt: new Date().toISOString()
        });

        const orderDocRef = doc(db, 'orders_social_boost_2', orderId);
        const orderRecord = {
          orderId,
          userId,
          userEmail: body.userEmail || userData.email || '',
          provider: 'Provider 2',
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
          provider: 'Provider 2',
          message: 'Social Boost 2 order submitted successfully.',
          orderId,
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

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          provider: 'Provider 2',
          status: snap.data().status,
          order: snap.data()
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
          provider: 'Provider 2',
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
          body: JSON.stringify({ success: true, message: 'Provider 2 pricing settings updated.' })
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
      body: JSON.stringify({ success: true, provider: 'Provider 2', message: 'Social Boost 2 Ready' })
    };

  } catch (err: any) {
    console.error('[Provider 2 Social Boost Error]:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: err.message || 'Internal Provider 2 error' })
    };
  }
};
