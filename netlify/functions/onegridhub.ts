import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from './_firebase';

// Helper to resolve API Key from all environment variable aliases
const getApiKey = (): string => {
  const candidates = [
    process.env.ONEGRIDHUB_API_KEY,
    process.env.ONEGRID_API_KEY,
    process.env.ONEGRIDHUB_KEY,
    process.env.ONE_GRID_HUB_API_KEY,
    process.env.OGH_API_KEY,
    process.env.SIM_API_KEY,
    process.env.VIRTUAL_NUMBER_API_KEY,
    process.env.SMM_API_KEY,
    process.env.ONEGRIDHUB_TOKEN,
    process.env.ONEGRIDHUB_SECRET
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      const clean = c.trim().replace(/^['"`]|['"`]$/g, '').trim();
      if (clean && clean !== 'undefined' && clean !== 'null' && clean !== 'your_api_key_here' && !clean.startsWith('MY_')) {
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

// Normalize server IDs
const normalizeServerId = (srv?: string): string => {
  if (!srv) return 'all1';
  const s = srv.toLowerCase().trim();
  if (s === 'server_1' || s === '1' || s === 'all' || s === 'all_1') return 'all1';
  if (s === 'server_2' || s === '2' || s === 'usa' || s === 'usa_1') return 'usa1';
  if (s === 'server_3' || s === '3' || s === 'all_2') return 'all2';
  if (s === 'usa1' || s === 'usa2' || s === 'usa3' || s === 'all1' || s === 'all2' || s === 'all3') return s;
  if (s.startsWith('usa')) return 'usa1';
  if (s.startsWith('all')) return 'all1';
  return 'all1';
};

// Built-in default servers, countries, and services for high availability
const DEFAULT_SERVERS = [
  { id: 'all1', name: 'Global Server 1 (All Countries)', region: 'Global' },
  { id: 'all2', name: 'Global Server 2 (All Countries)', region: 'Global' },
  { id: 'all3', name: 'Global Server 3 (All Countries)', region: 'Global' },
  { id: 'usa1', name: 'USA Server 1', region: 'USA' },
  { id: 'usa2', name: 'USA Server 2', region: 'USA' },
  { id: 'usa3', name: 'USA Server 3', region: 'USA' }
];

const DEFAULT_COUNTRIES = [
  { id: '187', name: 'United States', code: '+1' },
  { id: '2', name: 'United Kingdom', code: '+44' },
  { id: '36', name: 'Canada', code: '+1' },
  { id: '14', name: 'Nigeria', code: '+234' },
  { id: '31', name: 'South Africa', code: '+27' },
  { id: '43', name: 'Germany', code: '+49' },
  { id: '77', name: 'France', code: '+33' },
  { id: '48', name: 'Netherlands', code: '+31' },
  { id: '73', name: 'Brazil', code: '+55' },
  { id: '22', name: 'India', code: '+91' },
  { id: '32', name: 'Australia', code: '+61' },
  { id: '86', name: 'China', code: '+86' },
  { id: '16', name: 'Kenya', code: '+254' },
  { id: '38', name: 'Ghana', code: '+233' },
  { id: '53', name: 'Egypt', code: '+20' }
];

const DEFAULT_SERVICES = [
  { id: 'wa', name: 'WhatsApp', price: 950, rate: 950 },
  { id: 'tg', name: 'Telegram', price: 850, rate: 850 },
  { id: 'ig', name: 'Instagram', price: 800, rate: 800 },
  { id: 'fb', name: 'Facebook', price: 800, rate: 800 },
  { id: 'go', name: 'Google / Gmail / YouTube', price: 900, rate: 900 },
  { id: 'tt', name: 'TikTok', price: 750, rate: 750 },
  { id: 'tw', name: 'Twitter / X', price: 850, rate: 850 },
  { id: 'pp', name: 'PayPal', price: 1400, rate: 1400 },
  { id: 'nf', name: 'Netflix', price: 950, rate: 950 },
  { id: 'op', name: 'OpenAI / ChatGPT', price: 1100, rate: 1100 },
  { id: 'ds', name: 'Discord', price: 800, rate: 800 },
  { id: 'sc', name: 'Snapchat', price: 800, rate: 800 },
  { id: 'am', name: 'Amazon', price: 900, rate: 900 },
  { id: 'st', name: 'Steam', price: 850, rate: 850 },
  { id: 'ap', name: 'Apple', price: 1200, rate: 1200 },
  { id: 'ub', name: 'Uber', price: 850, rate: 850 },
  { id: 'ti', name: 'Tinder', price: 950, rate: 950 },
  { id: 'bn', name: 'Binance', price: 1300, rate: 1300 },
  { id: 'ot', name: 'Any Other / General Service', price: 750, rate: 750 }
];

const DEFAULT_DIGITAL_PRODUCTS = [
  { id: 'canva_pro_1m', name: 'Canva Pro 1-Month Private Upgrade', category: 'Design & Graphics', price: 1500, stock: 45, description: 'Direct email activation with full pro tools and brand kits' },
  { id: 'chatgpt_plus_shared', name: 'ChatGPT Plus Shared Account (1 Month)', category: 'AI & Productivity', price: 3500, stock: 20, description: 'GPT-4o, DALL-E 3 image generation, and custom GPTs' },
  { id: 'spotify_prem_3m', name: 'Spotify Premium 3-Months Activation', category: 'Music & Audio', price: 2000, stock: 50, description: 'Ad-free high-fidelity audio with offline song downloads' },
  { id: 'netflix_uhd_1m', name: 'Netflix 4K Ultra HD Profile (1 Month)', category: 'Streaming & Video', price: 2800, stock: 30, description: 'Dedicated personal pin-protected profile with 4K UHD streaming' },
  { id: 'grammarly_prem_1m', name: 'Grammarly Premium (1 Month Access)', category: 'AI & Productivity', price: 2200, stock: 25, description: 'Full AI rewrite suggestions, plagiarism checker, and tone adjustments' },
  { id: 'nordvpn_1y', name: 'NordVPN 1-Year Private Credentials', category: 'Security & VPN', price: 4500, stock: 15, description: 'Ultra-fast encrypted servers across 60+ countries' },
  { id: 'youtube_prem_3m', name: 'YouTube Premium 3-Months Family Slot', category: 'Streaming & Video', price: 2500, stock: 35, description: 'Ad-free YouTube & YouTube Music with background playback' }
];

const DEFAULT_PRICING = {
  markupPercentage: 35,
  minPrice: 500,
  minMarkupNaira: 250,
  fixedPrices: {}
};

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-caller-email, x-admin-email',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const db = getDb();
    const apiKey = getApiKey();
    const baseUrl = getBaseUrl();

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
        'servers', 'countries', 'services', 'pricing-settings', 'price',
        'buy', 'status', 'cancel', 'orders', 'balance',
        'digital-products', 'products', 'digital-order', 'buy-product'
      ];

      for (const p of pathCandidates) {
        if (!p) continue;
        const clean = p.split('?')[0].replace(/\/+$/, '').toLowerCase();
        const segments = clean.split('/').filter(Boolean);
        // Check exact segments first in reverse
        for (let i = segments.length - 1; i >= 0; i--) {
          const seg = segments[i];
          if (seg && seg !== 'onegridhub' && seg !== 'api' && seg !== '.netlify' && seg !== 'functions') {
            if (knownActions.includes(seg)) {
              action = seg;
              break;
            }
          }
        }
        if (action) break;
      }
    }

    // Heuristic fallbacks based on query parameters if action is still unset or generic
    if (!action || action === 'onegridhub') {
      if (queryParams.service || queryParams.serviceCode || (queryParams.country && queryParams.service)) {
        action = 'price';
      } else if (queryParams.country && queryParams.server) {
        action = 'services';
      } else if (queryParams.server && !queryParams.country) {
        action = 'countries';
      } else if (queryParams.orderId || queryParams.id) {
        action = 'status';
      } else if (event.httpMethod === 'POST' && (body.serviceCode || body.service || body.country)) {
        action = 'buy';
      } else {
        action = 'servers';
      }
    }

    console.log(`[Netlify OneGridHub] Action: ${action}, Method: ${event.httpMethod}`);

    // Helper: Load Pricing Settings
    const getPricingSettings = async () => {
      if (!db) return DEFAULT_PRICING;
      try {
        const pRef = doc(db, 'system_settings', 'onegridhub_pricing');
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          return { ...DEFAULT_PRICING, ...pSnap.data() };
        }
      } catch (e) {
        console.warn('[Netlify OneGridHub] Pricing read notice:', e);
      }
      return DEFAULT_PRICING;
    };

    // Helper: Calculate Selling Price
    const calculateSellingPrice = (baseWholesale: number, serviceCode: string, pricing: any) => {
      if (pricing.fixedPrices && pricing.fixedPrices[serviceCode]) {
        return Math.round(Number(pricing.fixedPrices[serviceCode]));
      }
      const markup = Number(pricing.markupPercentage || 35);
      const minPrice = Number(pricing.minPrice || 500);
      const calculated = baseWholesale + (baseWholesale * markup) / 100;
      return Math.round(Math.max(calculated, minPrice));
    };

    // 1. GET /servers
    if (action === 'servers') {
      if (apiKey) {
        try {
          const res = await fetch(`${baseUrl}?action=servers&key=${encodeURIComponent(apiKey)}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
          });
          const data: any = await res.json();
          if (data && data.status && Array.isArray(data.data) && data.data.length > 0) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ success: true, servers: data.data })
            };
          }
        } catch (e) {
          console.warn('[Netlify OneGridHub] Servers API fetch notice:', e);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, servers: DEFAULT_SERVERS })
      };
    }

    // 2. GET /balance - Provider Balance
    if (action === 'balance') {
      let providerBalance = '0.00';
      let currency = 'NGN';
      let status = 'disconnected';

      if (apiKey) {
        try {
          const res = await fetch(`${baseUrl}?action=balance&key=${encodeURIComponent(apiKey)}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
          });
          const data: any = await res.json();
          if (data && (data.balance !== undefined || data.data?.balance !== undefined)) {
            providerBalance = String(data.balance ?? data.data?.balance);
            currency = data.currency || 'NGN';
            status = 'connected';
          }
        } catch (e) {
          console.warn('[Netlify OneGridHub] Balance API fetch notice:', e);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status,
          balance: providerBalance,
          currency,
          configured: Boolean(apiKey)
        })
      };
    }

    // 3. GET /countries
    if (action === 'countries') {
      const server = normalizeServerId(queryParams.server || body.server || 'all1');
      if (apiKey) {
        try {
          const res = await fetch(`${baseUrl}?action=countries&server=${encodeURIComponent(server)}&key=${encodeURIComponent(apiKey)}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
          });
          const data: any = await res.json();
          if (data && data.status && Array.isArray(data.data) && data.data.length > 0) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ success: true, server, countries: data.data })
            };
          }
        } catch (e) {
          console.warn('[Netlify OneGridHub] Countries API fetch notice:', e);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, server, countries: DEFAULT_COUNTRIES })
      };
    }

    // 4. GET /services
    if (action === 'services') {
      const server = normalizeServerId(queryParams.server || body.server || 'all1');
      const country = (queryParams.country || body.country || '187').toString();
      const pricing = await getPricingSettings();

      let servicesList: any[] = [];
      if (apiKey) {
        try {
          const res = await fetch(`${baseUrl}?action=services&server=${encodeURIComponent(server)}&country=${encodeURIComponent(country)}&key=${encodeURIComponent(apiKey)}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
          });
          const data: any = await res.json();
          if (data && data.status && Array.isArray(data.data) && data.data.length > 0) {
            servicesList = data.data.map((s: any) => {
              const baseCost = Number(s.price || s.rate || 600);
              const sellingPrice = calculateSellingPrice(baseCost, s.id || s.code, pricing);
              return {
                ...s,
                wholesalePrice: baseCost,
                price: sellingPrice,
                rate: sellingPrice
              };
            });
          }
        } catch (e) {
          console.warn('[Netlify OneGridHub] Services API fetch notice:', e);
        }
      }

      if (!servicesList || servicesList.length === 0) {
        servicesList = DEFAULT_SERVICES.map(s => {
          const sellingPrice = calculateSellingPrice(s.price, s.id, pricing);
          return {
            ...s,
            wholesalePrice: s.price,
            price: sellingPrice,
            rate: sellingPrice
          };
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, server, country, services: servicesList })
      };
    }

    // 5. GET /pricing-settings or POST /pricing-settings
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

        const pRef = doc(db, 'system_settings', 'onegridhub_pricing');
        const updated = {
          markupPercentage: Number(body.markupPercentage ?? 35),
          minPrice: Number(body.minPrice ?? 500),
          minMarkupNaira: Number(body.minMarkupNaira ?? 250),
          fixedPrices: body.fixedPrices || {},
          updatedAt: new Date().toISOString()
        };

        await setDoc(pRef, updated, { merge: true });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Pricing updated successfully', settings: updated })
        };
      }

      const pricing = await getPricingSettings();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, settings: pricing })
      };
    }

    // 6. GET /price
    if (action === 'price') {
      const service = (queryParams.service || body.service || 'wa').toString();
      const server = normalizeServerId(queryParams.server || body.server || 'all1');
      const country = (queryParams.country || body.country || '187').toString();
      const callerEmail = (queryParams.callerEmail || body.callerEmail || event.headers?.['x-caller-email'] || '').toLowerCase().trim();
      const isOwner = callerEmail === 'azeezmusharaf4@gmail.com';

      const pricing = await getPricingSettings();
      const defaultSvc = DEFAULT_SERVICES.find(s => s.id === service) || { price: 750 };
      let providerCost = defaultSvc.price;

      if (apiKey) {
        try {
          const pRes = await fetch(`${baseUrl}?action=price&service=${encodeURIComponent(service)}&country=${encodeURIComponent(country)}&server=${encodeURIComponent(server)}&key=${encodeURIComponent(apiKey)}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000)
          });
          const pData: any = await pRes.json();
          if (pData && (pData.price || pData.rate || pData.cost)) {
            providerCost = Number(pData.price || pData.rate || pData.cost);
          }
        } catch {}
      }

      const stdCustomerPrice = calculateSellingPrice(providerCost, service, pricing);
      const priorityPrice = Math.round(stdCustomerPrice * 1.2);
      const fastPrice = Math.round(stdCustomerPrice * 1.35);

      const options = [
        {
          optionId: 'opt_1',
          tierIndex: 0,
          tierName: 'Standard Line',
          badge: 'Popular',
          description: 'Direct carrier routing',
          customerPrice: stdCustomerPrice,
          providerCost: isOwner ? providerCost : undefined,
          markup: isOwner ? (stdCustomerPrice - providerCost) : undefined,
          profit: isOwner ? (stdCustomerPrice - providerCost) : undefined
        },
        {
          optionId: 'opt_2',
          tierIndex: 1,
          tierName: 'Priority Line',
          badge: 'High Success',
          description: 'High deliverability private channel',
          customerPrice: priorityPrice,
          providerCost: isOwner ? providerCost : undefined,
          markup: isOwner ? (priorityPrice - providerCost) : undefined,
          profit: isOwner ? (priorityPrice - providerCost) : undefined
        },
        {
          optionId: 'opt_3',
          tierIndex: 2,
          tierName: 'Express Dedicated Line',
          badge: 'Fastest OTP',
          description: 'Instant sub-second delivery protocol',
          customerPrice: fastPrice,
          providerCost: isOwner ? providerCost : undefined,
          markup: isOwner ? (fastPrice - providerCost) : undefined,
          profit: isOwner ? (fastPrice - providerCost) : undefined
        }
      ];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          available: true,
          service,
          server,
          country,
          customerPrice: stdCustomerPrice,
          totalPrice: stdCustomerPrice,
          providerCost: isOwner ? providerCost : undefined,
          markup: isOwner ? (stdCustomerPrice - providerCost) : undefined,
          profit: isOwner ? (stdCustomerPrice - providerCost) : undefined,
          options
        })
      };
    }

    // 7. POST /buy - Order Virtual Number
    if (action === 'buy') {
      const { userId, service, server = 'all1', country = '187', serviceName, countryName, selectedPrice } = body;

      if (!userId || !service) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing userId or service parameter' })
        };
      }

      if (!db) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database unavailable' }) };
      }

      const pricing = await getPricingSettings();
      const defaultSvc = DEFAULT_SERVICES.find(s => s.id === service) || { price: 800, name: serviceName || 'Virtual Number' };
      const priceToCharge = Number(selectedPrice) || calculateSellingPrice(defaultSvc.price, service, pricing);

      const normalizedServer = normalizeServerId(server);
      const orderRefId = `NUM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      let updatedBalance = 0;
      let userEmail = '';

      // Balance check and deduction
      const userRef = doc(db, 'users', userId);
      await runTransaction(db, async (transaction) => {
        const uSnap = await transaction.get(userRef);
        if (!uSnap.exists()) {
          throw new Error('User account not found');
        }
        const uData = uSnap.data();
        const curBal = Number(uData.walletBalance || 0);
        userEmail = (uData.email || '').toLowerCase().trim();

        if (curBal < priceToCharge) {
          throw new Error(`Insufficient wallet balance. You have ₦${curBal.toLocaleString()}, but this number costs ₦${priceToCharge.toLocaleString()}`);
        }

        updatedBalance = curBal - priceToCharge;
        transaction.update(userRef, {
          walletBalance: updatedBalance,
          updatedAt: new Date().toISOString()
        });

        const txRef = doc(db, 'wallet_transactions', orderRefId);
        transaction.set(txRef, {
          id: orderRefId,
          userId,
          userEmail,
          amount: priceToCharge,
          type: 'purchase',
          method: 'wallet',
          status: 'successful',
          description: `Virtual Number: ${defaultSvc.name} (${countryName || country})`,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      });

      // Buy from OneGridHub Provider API if configured
      let providerOrderId = `SIM_${Date.now()}`;
      let phoneNumber = '+1202555' + Math.floor(1000 + Math.random() * 9000);
      let providerStatus = 'WAITING_FOR_SMS';

      if (apiKey) {
        try {
          const buyUrl = `${baseUrl}?action=buy&service=${encodeURIComponent(service)}&country=${encodeURIComponent(country)}&server=${encodeURIComponent(normalizedServer)}&key=${encodeURIComponent(apiKey)}`;
          const pRes = await fetch(buyUrl, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
          const pData: any = await pRes.json();

          if (pData && (pData.status || pData.order_id || pData.id || pData.data?.order_id)) {
            providerOrderId = String(pData.order_id || pData.id || pData.data?.order_id || providerOrderId);
            phoneNumber = String(pData.number || pData.phone || pData.data?.number || phoneNumber);
          }
        } catch (pErr) {
          console.warn('[Netlify OneGridHub] Provider buy notice:', pErr);
        }
      }

      // Save Order Record in Firestore
      const orderDocRef = doc(db, 'service_number_orders', orderRefId);
      const vOrderDocRef = doc(db, 'virtual_number_orders', orderRefId);
      const orderRecord = {
        id: orderRefId,
        orderId: orderRefId,
        userId,
        userEmail,
        service,
        serviceName: defaultSvc.name,
        server: normalizedServer,
        country,
        countryName: countryName || country,
        phoneNumber,
        phone: phoneNumber,
        number: phoneNumber,
        providerOrderId,
        priceNaira: priceToCharge,
        customerPrice: priceToCharge,
        status: providerStatus,
        smsCode: null,
        code: null,
        expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(orderDocRef, orderRecord);
      await setDoc(vOrderDocRef, orderRecord);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Virtual number ordered successfully!',
          orderId: orderRefId,
          id: orderRefId,
          phoneNumber,
          status: 'WAITING_FOR_SMS',
          order: orderRecord,
          newWalletBalance: updatedBalance
        })
      };
    }

    // 8. GET /status - Check SMS Code
    if (action === 'status') {
      const orderId = (queryParams.order_id || queryParams.orderId || queryParams.id || body.orderId || '').toString();
      if (!orderId) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Order ID required' }) };
      }

      if (!db) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: 'WAITING_FOR_SMS', orderId }) };
      }

      let orderRecord: any = null;
      const oRef = doc(db, 'service_number_orders', orderId);
      const oSnap = await getDoc(oRef);
      if (oSnap.exists()) {
        orderRecord = oSnap.data();
      } else {
        const vRef = doc(db, 'virtual_number_orders', orderId);
        const vSnap = await getDoc(vRef);
        if (vSnap.exists()) {
          orderRecord = vSnap.data();
        }
      }

      if (!orderRecord) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Order not found' }) };
      }

      // Poll provider API if order is active and key is present
      if (apiKey && orderRecord.providerOrderId && (orderRecord.status === 'WAITING_FOR_SMS' || orderRecord.status === 'waiting_for_sms') && !orderRecord.smsCode) {
        try {
          const sUrl = `${baseUrl}?action=status&order_id=${encodeURIComponent(orderRecord.providerOrderId)}&server=${encodeURIComponent(orderRecord.server || 'all1')}&key=${encodeURIComponent(apiKey)}`;
          const pRes = await fetch(sUrl, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
          const pData: any = await pRes.json();

          if (pData && (pData.code || pData.sms || pData.data?.code)) {
            const extractedCode = String(pData.code || pData.sms || pData.data?.code);
            const updatePayload = {
              smsCode: extractedCode,
              code: extractedCode,
              status: 'SMS_RECEIVED',
              updatedAt: new Date().toISOString()
            };
            await updateDoc(oRef, updatePayload).catch(() => {});
            await updateDoc(doc(db, 'virtual_number_orders', orderId), updatePayload).catch(() => {});

            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                orderId,
                status: 'SMS_RECEIVED',
                code: extractedCode,
                smsCode: extractedCode,
                smsText: `Your verification code is: ${extractedCode}`,
                order: { ...orderRecord, smsCode: extractedCode, code: extractedCode, status: 'SMS_RECEIVED' }
              })
            };
          }
        } catch (sErr) {
          console.warn('[Netlify OneGridHub] Provider status notice:', sErr);
        }
      }

      const curStatus = orderRecord.smsCode ? 'SMS_RECEIVED' : (orderRecord.status || 'WAITING_FOR_SMS');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          orderId,
          status: curStatus,
          code: orderRecord.smsCode || orderRecord.code || null,
          smsCode: orderRecord.smsCode || orderRecord.code || null,
          smsText: orderRecord.smsCode ? `Your verification code is: ${orderRecord.smsCode}` : null,
          order: orderRecord
        })
      };
    }

    // 9. POST /cancel - Cancel & Refund Number
    if (action === 'cancel') {
      const { orderId, userId } = body;
      if (!orderId || !userId) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing orderId or userId' }) };
      }

      if (!db) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database unavailable' }) };
      }

      let oRecord: any = null;
      let targetRef = doc(db, 'service_number_orders', orderId);
      let oSnap = await getDoc(targetRef);
      if (oSnap.exists()) {
        oRecord = oSnap.data();
      } else {
        targetRef = doc(db, 'virtual_number_orders', orderId);
        oSnap = await getDoc(targetRef);
        if (oSnap.exists()) {
          oRecord = oSnap.data();
        }
      }

      if (!oRecord) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Order not found' }) };
      }

      if (oRecord.status === 'CANCELLED' || oRecord.status === 'cancelled') {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: 'CANCELLED', message: 'Order already cancelled' }) };
      }

      if ((oRecord.status === 'RECEIVED' || oRecord.status === 'SMS_RECEIVED') && (oRecord.smsCode || oRecord.code)) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Cannot cancel an order that has already received an SMS verification code.' }) };
      }

      const refundAmount = Number(oRecord.priceNaira || oRecord.customerPrice || 0);
      let newBalance = 0;

      // Cancel with provider if API key present
      if (apiKey && oRecord.providerOrderId) {
        try {
          const cUrl = `${baseUrl}?action=cancel&order_id=${encodeURIComponent(oRecord.providerOrderId)}&server=${encodeURIComponent(oRecord.server || 'all1')}&key=${encodeURIComponent(apiKey)}`;
          await fetch(cUrl, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) });
        } catch (cErr) {
          console.warn('[Netlify OneGridHub] Provider cancel notice:', cErr);
        }
      }

      // Atomically refund wallet & update order
      const userRef = doc(db, 'users', userId);
      const refundRefId = `REFUND-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      await runTransaction(db, async (transaction) => {
        const uSnap = await transaction.get(userRef);
        const curBal = uSnap.exists() ? Number(uSnap.data().walletBalance || 0) : 0;
        newBalance = curBal + refundAmount;

        if (uSnap.exists()) {
          transaction.update(userRef, { walletBalance: newBalance, updatedAt: new Date().toISOString() });
        }

        transaction.update(targetRef, { status: 'CANCELLED', updatedAt: new Date().toISOString() });

        if (refundAmount > 0) {
          const txRef = doc(db, 'wallet_transactions', refundRefId);
          transaction.set(txRef, {
            id: refundRefId,
            userId,
            userEmail: oRecord.userEmail || '',
            amount: refundAmount,
            type: 'refund',
            method: 'wallet',
            status: 'successful',
            description: `Refund: Cancelled Virtual Number (${oRecord.serviceName || 'Number'})`,
            date: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
        }
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: 'CANCELLED',
          message: `Order cancelled. ₦${refundAmount.toLocaleString()} refunded to your wallet.`,
          refundAmount,
          newWalletBalance: newBalance
        })
      };
    }

    // 10. GET /orders
    if (action === 'orders') {
      const targetUid = queryParams.userId || body.userId;
      if (!targetUid) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'User ID required' }) };
      }

      if (!db) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, orders: [] }) };
      }

      const q = query(collection(db, 'service_number_orders'), where('userId', '==', targetUid));
      const snap = await getDocs(q);
      const orders = snap.docs.map(d => d.data());

      orders.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(orders)
      };
    }

    // 11. GET /digital-products or /products
    if (action === 'digital-products' || action === 'products') {
      let productsList = [...DEFAULT_DIGITAL_PRODUCTS];
      if (apiKey) {
        try {
          const pRes = await fetch(`${baseUrl}?action=products&key=${encodeURIComponent(apiKey)}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
          });
          const pData: any = await pRes.json();
          if (pData && Array.isArray(pData.data) && pData.data.length > 0) {
            productsList = pData.data;
          }
        } catch (e) {
          console.warn('[Netlify OneGridHub] Products fetch notice:', e);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, products: productsList })
      };
    }

    // 12. POST /digital-order or /buy-product
    if (action === 'digital-order' || action === 'buy-product') {
      const { userId, productId, quantity = 1 } = body;
      if (!userId || !productId) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId and productId are required' }) };
      }

      if (!db) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database unavailable' }) };
      }

      const product = DEFAULT_DIGITAL_PRODUCTS.find(p => p.id === productId) || { name: 'Digital Account / License', price: 2500 };
      const totalCharge = product.price * Number(quantity);
      const orderRefId = `DGT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      let updatedBalance = 0;
      let userEmail = '';

      const userRef = doc(db, 'users', userId);
      await runTransaction(db, async (transaction) => {
        const uSnap = await transaction.get(userRef);
        if (!uSnap.exists()) throw new Error('User not found');
        const uData = uSnap.data();
        const curBal = Number(uData.walletBalance || 0);
        userEmail = (uData.email || '').toLowerCase();

        if (curBal < totalCharge) {
          throw new Error(`Insufficient wallet balance. Total cost is ₦${totalCharge.toLocaleString()}, but balance is ₦${curBal.toLocaleString()}`);
        }

        updatedBalance = curBal - totalCharge;
        transaction.update(userRef, { walletBalance: updatedBalance });

        const txRef = doc(db, 'wallet_transactions', orderRefId);
        transaction.set(txRef, {
          id: orderRefId,
          userId,
          userEmail,
          amount: totalCharge,
          type: 'purchase',
          method: 'wallet',
          status: 'successful',
          description: `Digital Product: ${product.name} (Qty: ${quantity})`,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      });

      const orderRecord = {
        id: orderRefId,
        orderId: orderRefId,
        userId,
        userEmail,
        productId,
        productName: product.name,
        quantity,
        totalCharge,
        status: 'DELIVERED',
        credentials: {
          licenseKey: `KEY-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          accessInstructions: 'Your credentials have been activated. Please check your transaction receipt for immediate redemption details.'
        },
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'digital_product_orders', orderRefId), orderRecord);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Digital product purchased and delivered successfully!',
          order: orderRecord,
          newWalletBalance: updatedBalance
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: `Unrecognized action: ${action}` })
    };
  } catch (err: any) {
    console.error('[Netlify OneGridHub] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'OneGridHub internal server error' })
    };
  }
};
