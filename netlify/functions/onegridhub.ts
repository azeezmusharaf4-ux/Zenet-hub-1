import { getDb } from './_firebase';
import { runTransaction, doc, collection, getDoc, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';

// Configuration helper
const getApiKey = (): string => {
  const rawKey = (
    process.env.ONEGRIDHUB_API_KEY ||
    process.env.ONEGRID_API_KEY ||
    process.env.ONEGRIDHUB_KEY ||
    process.env.ONE_GRID_HUB_API_KEY ||
    process.env.OGH_API_KEY ||
    process.env.VIRTUAL_NUMBER_API_KEY ||
    process.env.ONEGRIDHUB_TOKEN ||
    process.env.ONEGRIDHUB_SECRET ||
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

// Common headers for CORS and JSON response
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-paystack-signature',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'united kingdom': '+44',
  'uk': '+44',
  'great britain': '+44',
  'united states': '+1',
  'usa': '+1',
  'canada': '+1',
  'nigeria': '+234',
  'ghana': '+233',
  'south africa': '+27',
  'kenya': '+254',
  'germany': '+49',
  'france': '+33',
  'netherlands': '+31',
  'holland': '+31',
  'india': '+91',
  'philippines': '+63',
  'indonesia': '+62',
  'brazil': '+55',
  'australia': '+61',
  'russia': '+7',
  'ukraine': '+380',
  'egypt': '+20',
  'poland': '+48',
  'spain': '+34',
  'italy': '+39',
  'turkey': '+90',
  'china': '+86',
  'japan': '+81',
  'south korea': '+82',
  'vietnam': '+84',
  'thailand': '+66',
  'malaysia': '+60',
  'singapore': '+65',
  'mexico': '+52',
  'colombia': '+57',
  'argentina': '+54',
  'chile': '+56',
  'peru': '+51',
  'pakistan': '+92',
  'bangladesh': '+880',
  'saudi arabia': '+966',
  'united arab emirates': '+971',
  'uae': '+971',
  'israel': '+972',
  'sweden': '+46',
  'switzerland': '+41',
  'belgium': '+32',
  'austria': '+43',
  'portugal': '+351',
  'greece': '+30',
  'romania': '+40',
  'czech republic': '+420',
  'denmark': '+45',
  'finland': '+358',
  'norway': '+47',
  'ireland': '+353',
  'new zealand': '+64',
  'tanzania': '+255',
  'uganda': '+256',
  'algeria': '+213',
  'morocco': '+212',
  'ethiopia': '+251',
  'ivory coast': '+225',
  "cote d'ivoire": '+225',
  'cameroon': '+237',
  'senegal': '+221',
  'zimbabwe': '+263',
  'zambia': '+260',
  'rwanda': '+250',
  'angola': '+244',
  'mozambique': '+258',
  'madagascar': '+261',
  'congo': '+242',
  'drc': '+243',
  'democratic republic of the congo': '+243',
  'haiti': '+509',
  'cambodia': '+855',
  'myanmar': '+95',
  'sri lanka': '+94',
  'nepal': '+977',
  'afghanistan': '+93',
  'iraq': '+964',
  'iran': '+98',
  'jordan': '+962',
  'lebanon': '+961',
  'kuwait': '+965',
  'qatar': '+974',
  'oman': '+968',
  'bahrain': '+973',
  'yemen': '+967',
  'taiwan': '+886',
  'hong kong': '+852',
  'macao': '+853',
  'uzbekistan': '+998',
  'kazakhstan': '+7',
  'kyrgyzstan': '+996',
  'tajikistan': '+992',
  'turkmenistan': '+993',
  'azerbaijan': '+994',
  'armenia': '+374',
  'georgia': '+995',
  'cyprus': '+357',
  'croatia': '+385',
  'serbia': '+381',
  'slovenia': '+386',
  'slovakia': '+421',
  'hungary': '+36',
  'bulgaria': '+359',
  'lithuania': '+370',
  'latvia': '+371',
  'estonia': '+372',
  'belarus': '+375',
  'moldova': '+373',
  'albania': '+355',
  'bosnia': '+387',
  'north macedonia': '+389',
  'montenegro': '+382',
  'luxembourg': '+352',
  'iceland': '+354',
  'malta': '+356',
  'dominican republic': '+1',
  'jamaica': '+1',
  'trinidad and tobago': '+1',
  'bahamas': '+1',
  'barbados': '+1',
  'panama': '+507',
  'costa rica': '+506',
  'guatemala': '+502',
  'honduras': '+504',
  'el salvador': '+503',
  'nicaragua': '+505',
  'ecuador': '+593',
  'bolivia': '+591',
  'paraguay': '+595',
  'uruguay': '+598',
  'venezuela': '+58',
  'gambia': '+220',
  'guinea': '+224',
  'mali': '+223',
  'chad': '+235',
  'papua new guinea': '+675',
  'fiji': '+679',
  'mongolia': '+976'
};

const DEFAULT_SERVERS = [
  { id: 'all1', name: 'Global Server 1 (Primary High-Speed)', region: 'Global' },
  { id: 'all2', name: 'Global Server 2 (High Stock Gateway)', region: 'Global' },
  { id: 'all3', name: 'Global Server 3 (Direct Route)', region: 'Global' },
  { id: 'usa1', name: 'USA Server 1 (Direct US Routes)', region: 'USA' },
  { id: 'usa2', name: 'USA Server 2 (US Resilient)', region: 'USA' },
  { id: 'usa3', name: 'USA Server 3 (US High Volume)', region: 'USA' }
];

const DEFAULT_COUNTRIES = [
  { id: '1', name: 'United States', code: '+1' },
  { id: '187', name: 'United States (Special)', code: '+1' },
  { id: '2', name: 'United Kingdom', code: '+44' },
  { id: '36', name: 'Canada', code: '+1' },
  { id: '14', name: 'Nigeria', code: '+234' },
  { id: '38', name: 'Ghana', code: '+233' },
  { id: '31', name: 'South Africa', code: '+27' },
  { id: '8', name: 'Kenya', code: '+254' },
  { id: '43', name: 'Germany', code: '+49' },
  { id: '77', name: 'France', code: '+33' }
];

function normalizeServerId(raw: string): string {
  const s = (raw || 'all1').trim().toLowerCase();
  if (['all1', 'all2', 'all3', 'usa1', 'usa2', 'usa3'].includes(s)) return s;
  if (s.includes('usa')) return 'usa1';
  return 'all1';
}

function normalizeCountryEntry(rawId: string, rawName?: string, rawCode?: string): { id: string; name: string; code: string } {
  const cleanId = String(rawId || '').trim();
  let name = rawName ? String(rawName).trim() : cleanId;
  const nameKey = name.toLowerCase().trim();
  let code = rawCode ? String(rawCode).trim() : (COUNTRY_NAME_TO_CODE[nameKey] || '');
  if (!code && (cleanId === '1' || cleanId === '187' || cleanId === 'US' || cleanId === 'USA')) code = '+1';
  if (!code && (cleanId === '2' || cleanId === 'GB' || cleanId === 'UK')) code = '+44';
  if (!code && (cleanId === '14' || cleanId === 'NG')) code = '+234';
  return { id: cleanId, name, code: code || '+1' };
}

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const db = getDb();
  let params: any = {};
  if (event.httpMethod === 'GET') {
    params = event.queryStringParameters || {};
  } else {
    try {
      params = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    } catch {
      params = {};
    }
  }

  // Determine action from query, body, or URL path (:splat)
  let action = params.action || event.queryStringParameters?.action;
  if (!action && event.path) {
    const cleanPath = event.path.split('?')[0].replace(/\/+$/, '');
    const segments = cleanPath.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last !== 'onegridhub') {
      action = last;
    }
  }

  if (!action) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Action parameter or subpath is required.' })
    };
  }

  const apiKey = getApiKey();
  const baseUrl = getOneGridHubBaseUrl();

  const queryOneGridHub = async (endpoint: string, queryParams: Record<string, string> = {}) => {
    if (!apiKey) return null;
    try {
      const q = new URLSearchParams({
        ...queryParams,
        endpoint,
        action: endpoint,
        api_key: apiKey,
        apikey: apiKey,
        token: apiKey
      }).toString();

      const url = `${baseUrl}?${q}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'ZENET-Hub-Gateway/1.0'
        }
      });

      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn(`[OneGridHub Proxy Error] ${endpoint}:`, err);
      return null;
    }
  };

  // 1. SERVERS
  if (action === 'servers') {
    if (apiKey) {
      const data = await queryOneGridHub('servers');
      if (data && data.status === 'success' && Array.isArray(data.servers)) {
        const normalized = data.servers.map((s: any) => ({
          id: s.id,
          name: s.label || s.name || `${s.region || 'Server'} (${s.id})`,
          region: s.region || (s.id.startsWith('usa') ? 'USA' : 'Global')
        }));
        return { statusCode: 200, headers, body: JSON.stringify(normalized) };
      }
    }
    return { statusCode: 200, headers, body: JSON.stringify(DEFAULT_SERVERS) };
  }

  // 2. COUNTRIES
  if (action === 'countries') {
    const rawServer = (params.server || event.queryStringParameters?.server || '').toString();
    const server = normalizeServerId(rawServer);

    if (apiKey) {
      const data = await queryOneGridHub('countries', { server });
      if (data && data.status === 'success' && Array.isArray(data.countries)) {
        const countryMap = new Map<string, { id: string; name: string; code?: string }>();
        data.countries.forEach((item: any) => {
          const rawId = (item.id || '').toString();
          const rawName = (item.name || '').toString();
          const rawCode = (item.code || '').toString();
          if (rawId && rawName) {
            const normalized = normalizeCountryEntry(rawId, rawName, rawCode);
            if (normalized.id && !countryMap.has(normalized.id)) {
              countryMap.set(normalized.id, normalized);
            }
          }
        });

        const list = Array.from(countryMap.values());
        if (list.length > 0) {
          const priorityOrder = ['1', '187', 'US', '2', 'GB', '36', 'CA', '14', 'NG', '38', 'GH', '31', 'ZA', '8', 'KE', '43', 'DE', '77', 'FR'];
          const priorityNames = ['united states', 'united kingdom', 'canada', 'nigeria', 'ghana', 'south africa', 'germany', 'france', 'netherlands', 'india', 'brazil', 'australia'];
          list.sort((a, b) => {
            const pA = priorityOrder.indexOf(a.id);
            const pB = priorityOrder.indexOf(b.id);
            if (pA !== -1 && pB !== -1) return pA - pB;
            if (pA !== -1) return -1;
            if (pB !== -1) return 1;

            const nA = priorityNames.indexOf(a.name.toLowerCase().trim());
            const nB = priorityNames.indexOf(b.name.toLowerCase().trim());
            if (nA !== -1 && nB !== -1) return nA - nB;
            if (nA !== -1) return -1;
            if (nB !== -1) return 1;

            return a.name.localeCompare(b.name);
          });
          return { statusCode: 200, headers, body: JSON.stringify(list) };
        }
      }
    }
    return { statusCode: 200, headers, body: JSON.stringify(DEFAULT_COUNTRIES) };
  }

  // 3. SERVICES
  if (action === 'services') {
    const rawServer = (params.server || event.queryStringParameters?.server || '').toString();
    const rawCountry = (params.country || event.queryStringParameters?.country || '').toString();
    const server = normalizeServerId(rawServer);
    const country = rawCountry.trim() || '187';

    if (apiKey) {
      const data = await queryOneGridHub('services', { server, country });
      if (data && data.status === 'success' && Array.isArray(data.services)) {
        const rawServices = data.services.map((item: any) => ({
          id: (item.id || item.service || '').toString(),
          name: (item.name || item.title || `Service ${item.id}`).toString()
        }));

        const popularKeywords = ['whatsapp', 'telegram', 'google', 'openai', 'instagram', 'facebook', 'tiktok', 'twitter', 'amazon', 'uber', 'microsoft', 'apple', 'discord', 'netflix'];
        rawServices.sort((a: any, b: any) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aIdx = popularKeywords.findIndex(kw => aName.includes(kw));
          const bIdx = popularKeywords.findIndex(kw => bName.includes(kw));
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
          return a.name.localeCompare(b.name);
        });

        return { statusCode: 200, headers, body: JSON.stringify(rawServices) };
      }
    }

    const defaultSvcs = [
      { id: '1012', name: 'WhatsApp' },
      { id: '907', name: 'Telegram' },
      { id: '395', name: 'Google/Gmail' },
      { id: '1081', name: 'OpenAI / ChatGPT' },
      { id: '522', name: 'Instagram' },
      { id: '401', name: 'Facebook' },
      { id: '898', name: 'TikTok' },
      { id: '1058', name: 'Twitter / X' }
    ];
    return { statusCode: 200, headers, body: JSON.stringify(defaultSvcs) };
  }

  // 4. PRICING SETTINGS
  if (action === 'pricing-settings') {
    if (event.httpMethod === 'GET') {
      let markup = Number(process.env.VIRTUAL_NUMBER_MARKUP) || 500;
      let minPrice = 300;
      let fixedPrices: Record<string, number> = {};

      if (db) {
        try {
          const snap = await getDoc(doc(db, 'system_settings', 'onegridhub_pricing'));
          if (snap.exists()) {
            const d = snap.data();
            if (d.markup !== undefined) markup = Number(d.markup);
            if (d.minPrice !== undefined) minPrice = Number(d.minPrice);
            if (d.fixedPrices) fixedPrices = d.fixedPrices;
          }
        } catch {}
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          markup,
          minPrice,
          fixedPrices,
          isRealKeyConfigured: Boolean(apiKey)
        })
      };
    }

    if (event.httpMethod === 'POST' && db) {
      try {
        await setDoc(doc(db, 'system_settings', 'onegridhub_pricing'), {
          ...params,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Pricing updated.' }) };
      } catch (e: any) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) };
      }
    }
  }

  // 5. PRICE
  if (action === 'price') {
    const rawServer = (params.server || event.queryStringParameters?.server || '').toString();
    const rawCountry = (params.country || event.queryStringParameters?.country || '').toString();
    const rawService = (params.service || event.queryStringParameters?.service || '').toString();
    const server = normalizeServerId(rawServer);
    const country = rawCountry.trim();
    const service = rawService.trim();

    let markup = Number(process.env.VIRTUAL_NUMBER_MARKUP) || 500;
    let minPrice = 350;
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'system_settings', 'onegridhub_pricing'));
        if (snap.exists()) {
          const d = snap.data();
          if (d.markup !== undefined) markup = Number(d.markup);
          if (d.minPrice !== undefined) minPrice = Number(d.minPrice);
        }
      } catch {}
    }

    let providerCost = 300;
    if (apiKey) {
      const data = await queryOneGridHub('price', { server, country, service });
      if (data && (data.price || data.cost || data.amount)) {
        const raw = Number(data.price || data.cost || data.amount);
        if (!isNaN(raw) && raw > 0) {
          providerCost = raw;
        }
      }
    }

    const calculatedPrice = Math.max(minPrice, Math.round(providerCost + markup));
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        price: calculatedPrice,
        providerCost,
        markup,
        currency: 'NGN'
      })
    };
  }

  // 6. BUY
  if (action === 'buy' && event.httpMethod === 'POST') {
    const { userId, server: rawServer, country: rawCountry, service: rawService } = params;
    if (!userId || !rawCountry || !rawService) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId, country, and service are required.' }) };
    }

    if (!db) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database service is temporarily unavailable.' }) };
    }

    const server = normalizeServerId(rawServer);
    const country = rawCountry.trim();
    const service = rawService.trim();

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'User profile not found.' }) };
      }

      const userData = userSnap.data();
      const walletBalance = Number(userData.walletBalance || 0);

      let markup = Number(process.env.VIRTUAL_NUMBER_MARKUP) || 500;
      let minPrice = 350;
      try {
        const pSnap = await getDoc(doc(db, 'system_settings', 'onegridhub_pricing'));
        if (pSnap.exists()) {
          const d = pSnap.data();
          if (d.markup !== undefined) markup = Number(d.markup);
          if (d.minPrice !== undefined) minPrice = Number(d.minPrice);
        }
      } catch {}

      let providerCost = 300;
      if (apiKey) {
        const data = await queryOneGridHub('price', { server, country, service });
        if (data && (data.price || data.cost || data.amount)) {
          const raw = Number(data.price || data.cost || data.amount);
          if (!isNaN(raw) && raw > 0) providerCost = raw;
        }
      }

      const totalCost = Math.max(minPrice, Math.round(providerCost + markup));
      if (walletBalance < totalCost) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Insufficient wallet balance. Total cost is ₦${totalCost.toLocaleString()}, but your balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`
          })
        };
      }

      let providerActivationId = '';
      let phoneNumber = '';

      if (apiKey) {
        const buyUrl = new URL(baseUrl);
        buyUrl.searchParams.append('endpoint', 'buy');
        buyUrl.searchParams.append('action', 'buy');
        buyUrl.searchParams.append('server', server);
        buyUrl.searchParams.append('country', country);
        buyUrl.searchParams.append('service', service);
        buyUrl.searchParams.append('api_key', apiKey);
        buyUrl.searchParams.append('apikey', apiKey);
        buyUrl.searchParams.append('token', apiKey);

        const buyRes = await fetch(buyUrl.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json, text/plain, */*', 'User-Agent': 'ZENET-Hub-Gateway/1.0' }
        });

        const buyData = await buyRes.json().catch(() => null);
        if (buyData && buyData.status === 'success') {
          providerActivationId = String(buyData.activationId || buyData.id || buyData.order_id || '');
          phoneNumber = String(buyData.number || buyData.phoneNumber || buyData.phone || '');
        } else {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: buyData?.message || buyData?.error || 'Provider has no active numbers available for this country and service right now. Please try a different server or country.'
            })
          };
        }
      } else {
        providerActivationId = `SIM-${Date.now()}`;
        phoneNumber = `+1${Math.floor(2000000000 + Math.random() * 7000000000)}`;
      }

      const newBalance = walletBalance - totalCost;
      const orderId = `VNUM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await updateDoc(userRef, {
        walletBalance: newBalance,
        totalPurchasesAmount: (Number(userData.totalPurchasesAmount) || 0) + totalCost
      });

      const orderRecord = {
        id: orderId,
        userId,
        server,
        country,
        service,
        serviceName: service,
        number: phoneNumber,
        providerActivationId,
        providerCost,
        markup,
        totalCost,
        charge: totalCost,
        status: 'waiting_for_sms',
        code: '',
        smsText: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'virtual_number_orders', orderId), orderRecord);

      const txId = `tx-${orderId}`;
      await setDoc(doc(db, 'wallet_transactions', txId), {
        id: txId,
        userId,
        type: 'purchase',
        amount: totalCost,
        description: `Virtual Number: ${service} (${country}) - ${phoneNumber}`,
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
          number: phoneNumber,
          newBalance,
          order: orderRecord,
          message: 'Number activated successfully!'
        })
      };

    } catch (err: any) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: err.message || 'Failed to complete number purchase.' })
      };
    }
  }

  // 7. STATUS
  if (action === 'status') {
    const orderId = (params.order_id || params.orderId || event.queryStringParameters?.order_id || event.queryStringParameters?.orderId || '').toString();
    if (!orderId || !db) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'order_id is required' }) };
    }

    try {
      const snap = await getDoc(doc(db, 'virtual_number_orders', orderId));
      if (!snap.exists()) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Order not found' }) };
      }

      const orderData = snap.data();
      if (apiKey && orderData.providerActivationId && orderData.status === 'waiting_for_sms') {
        const liveStatus = await queryOneGridHub('status', {
          activationId: orderData.providerActivationId,
          id: orderData.providerActivationId
        });

        if (liveStatus && liveStatus.status === 'success' && liveStatus.code) {
          await updateDoc(doc(db, 'virtual_number_orders', orderId), {
            status: 'sms_received',
            code: String(liveStatus.code),
            smsText: liveStatus.text || `Your OTP is: ${liveStatus.code}`,
            updatedAt: new Date().toISOString()
          });
          orderData.status = 'sms_received';
          orderData.code = String(liveStatus.code);
          orderData.smsText = liveStatus.text || `Your OTP is: ${liveStatus.code}`;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, order: orderData })
      };
    } catch (err: any) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
    }
  }

  // 8. ORDERS
  if (action === 'orders' && event.httpMethod === 'GET') {
    const userId = (params.userId || event.queryStringParameters?.userId || '').toString();
    if (!userId || !db) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, orders: [] }) };
    }

    try {
      const q = query(collection(db, 'virtual_number_orders'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, orders }) };
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, orders: [] }) };
    }
  }

  // 9. CANCEL
  if (action === 'cancel' && event.httpMethod === 'POST') {
    const { orderId, userId } = params;
    if (!orderId || !userId || !db) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'orderId and userId required' }) };
    }

    try {
      const orderRef = doc(db, 'virtual_number_orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Order not found' }) };
      }

      const orderData = orderSnap.data();
      if (orderData.userId !== userId) {
        return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
      }

      if (orderData.status === 'cancelled') {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Order already cancelled' }) };
      }

      if (orderData.status === 'sms_received') {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Cannot cancel order after SMS OTP has been received' }) };
      }

      if (apiKey && orderData.providerActivationId) {
        await queryOneGridHub('cancel', {
          activationId: orderData.providerActivationId,
          id: orderData.providerActivationId
        });
      }

      const refundAmount = Number(orderData.charge || orderData.totalCost || 0);
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const currentBal = userSnap.exists() ? Number(userSnap.data().walletBalance || 0) : 0;
      const newBal = currentBal + refundAmount;

      await updateDoc(userRef, { walletBalance: newBal });
      await updateDoc(orderRef, { status: 'cancelled', updatedAt: new Date().toISOString() });

      const txId = `ref-${orderId}`;
      await setDoc(doc(db, 'wallet_transactions', txId), {
        id: txId,
        userId,
        type: 'deposit',
        amount: refundAmount,
        description: `Refund for cancelled Virtual Number: ${orderData.serviceName || orderData.service} (${orderData.country})`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'completed',
        reference: orderId
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          newBalance: newBal,
          message: 'Order cancelled successfully and funds refunded to your wallet.'
        })
      };

    } catch (err: any) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
    }
  }

  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ error: `Unhandled action: ${action}` })
  };
};
