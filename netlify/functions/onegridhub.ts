import crypto from 'crypto';
import { 
  getDb, 
  ensureServerAuthenticated, 
  parseAndVerifyToken, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  runTransaction 
} from './_firebase';

// =========================================================================
// CONFIGURATION & SECRETS (SERVER-SIDE ONLY - NEVER EXPOSED TO CLIENT)
// =========================================================================

const getVirtualSMSNumbersConfig = () => {
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
  const eurToNgnRate = Number(process.env.EUR_TO_NGN_RATE) || 1750;
  return { apiKey, baseUrl, hasApiKey: Boolean(apiKey), eurToNgnRate, markup: 0 };
};

// Authorized owner emails for owner-only actions
const OWNER_EMAILS = [
  'azeezmusharaf4@gmail.com',
  'muzenteofficial001@gmail.com',
  'azeezmusharaf@gmail.com',
  'zenet-backend-service@zenetmarketplace.internal'
];

// In-memory caching across warm Lambda invocations
let cachedServices: any[] | null = null;
let lastServicesFetch = 0;
let cachedCountries: any[] | null = null;
let lastCountriesFetch = 0;

// User order idempotency locks
const userOrderLocks = new Map<string, number>();

// =========================================================================
// UPSTREAM CLIENT: VIRTUALSMSNUMBERS.COM API
// =========================================================================

async function queryVirtualSMSNumbers(
  endpoint: string,
  params: Record<string, any> = {},
  method: 'GET' | 'POST' = 'GET',
  customTimeoutMs: number = 15000
) {
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), customTimeoutMs);

  try {
    const resp = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });

    const text = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      const err: any = new Error(data?.message || data?.error?.message || `HTTP ${resp.status} ${resp.statusText}`);
      err.status = resp.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

// =========================================================================
// RESOLUTION & NORMALIZATION HELPERS
// =========================================================================

const getCountryFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const getCountryDialCode = (id?: string | number, name?: string, code?: string): string => {
  const codeUpper = (code || String(id || '')).toUpperCase();
  const nameLower = (name || '').toLowerCase();
  if (codeUpper === 'US' || codeUpper === 'CA' || nameLower.includes('united states') || nameLower.includes('canada')) return '+1';
  if (codeUpper === 'GB' || nameLower.includes('united kingdom')) return '+44';
  if (codeUpper === 'NG' || nameLower.includes('nigeria')) return '+234';
  if (codeUpper === 'ZA' || nameLower.includes('south africa')) return '+27';
  if (codeUpper === 'KE' || nameLower.includes('kenya')) return '+254';
  if (codeUpper === 'GH' || nameLower.includes('ghana')) return '+233';
  if (codeUpper === 'DE' || nameLower.includes('germany')) return '+49';
  if (codeUpper === 'FR' || nameLower.includes('france')) return '+33';
  if (codeUpper === 'NL' || nameLower.includes('netherlands')) return '+31';
  if (codeUpper === 'PT' || nameLower.includes('portugal')) return '+351';
  if (codeUpper === 'BR' || nameLower.includes('brazil')) return '+55';
  if (codeUpper === 'IN' || nameLower.includes('india')) return '+91';
  if (codeUpper === 'ID' || nameLower.includes('indonesia')) return '+62';
  if (codeUpper === 'PH' || nameLower.includes('philippines')) return '+63';
  if (codeUpper === 'RU' || nameLower.includes('russia')) return '+7';
  return '+1';
};

const resolveToVsnServiceSlug = (serviceInput: string, servicesList: any[] = []): string => {
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

const resolveToVsnCountryCode = (countryInput: string, countriesList: any[] = []): string => {
  if (!countryInput) return 'US';
  const clean = countryInput.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(clean)) {
    return clean;
  }
  const lower = countryInput.trim().toLowerCase();
  const commonMap: Record<string, string> = {
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
    'kenya': 'KE',
    'russia': 'RU'
  };
  if (commonMap[lower]) return commonMap[lower];
  for (const c of countriesList) {
    if (String(c.id) === countryInput || c.code?.toUpperCase() === clean || c.name?.toLowerCase() === lower) {
      return (c.code || 'US').toUpperCase();
    }
  }
  return clean.slice(0, 2) || 'US';
};

const generatePriceOptions = (providerCostNgn: number, isOwner: boolean) => {
  const pCost = Math.round(Number(providerCostNgn) || 0);
  if (pCost <= 0) return [];

  // Zero markup for VirtualSMSNumbers: exact provider cost in NGN
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
      customerPrice: pCost,
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

// =========================================================================
// MAIN NETLIFY SERVERLESS FUNCTION HANDLER
// =========================================================================

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-caller-email, X-Caller-Email',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const queryParams = event.queryStringParameters || {};
  let body: any = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      body = {};
    }
  }

  // Extract action from query, body, or path segment
  const pathParts = (event.path || '').split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1] || '';
  let action = (queryParams.action || body.action || '').toLowerCase().trim();
  if (!action && lastPart && lastPart !== 'onegridhub' && lastPart !== 'virtual-numbers') {
    action = lastPart.toLowerCase().trim();
  }

  if (!action) {
    action = 'services'; // Default query action
  }

  const { apiKey, hasApiKey, eurToNgnRate } = getVirtualSMSNumbersConfig();

  // Helper to check owner status
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const verifiedUser = parseAndVerifyToken(authHeader);
  const callerEmail = (
    event.headers?.['x-caller-email'] || 
    event.headers?.['X-Caller-Email'] || 
    queryParams.callerEmail || 
    body.callerEmail || 
    verifiedUser?.email || 
    ''
  ).toLowerCase().trim();

  const isOwner = Boolean(
    (verifiedUser?.email && OWNER_EMAILS.includes(verifiedUser.email.toLowerCase())) ||
    (callerEmail && OWNER_EMAILS.includes(callerEmail))
  );

  try {
    // -----------------------------------------------------------------------
    // 1. SERVICES LIST (GET /services or action=services)
    // -----------------------------------------------------------------------
    if (action === 'services') {
      try {
        if (!cachedServices || (Date.now() - lastServicesFetch > 10 * 60 * 1000)) {
          const upstreamRes = await queryVirtualSMSNumbers('/services');
          const list = Array.isArray(upstreamRes?.data) 
            ? upstreamRes.data 
            : Array.isArray(upstreamRes) 
            ? upstreamRes 
            : [];
          if (list.length > 0) {
            cachedServices = list;
            lastServicesFetch = Date.now();
          }
        }
      } catch (err: any) {
        console.warn('[Netlify VSN] Upstream services fetch notice:', err.message);
      }

      if (cachedServices && cachedServices.length > 0) {
        const mapped = cachedServices.map((s: any) => ({
          id: s.slug || s.code || String(s.id),
          code: s.code || s.slug,
          slug: s.slug || s.code,
          name: s.name,
          category: s.category || 'general'
        }));

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            provider: 'VirtualSMSNumbers',
            hasApiKey,
            services: mapped
          })
        };
      }

      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Could not load SMS services from VirtualSMSNumbers provider. Please check connection and retry.',
          services: []
        })
      };
    }

    // -----------------------------------------------------------------------
    // 2. COUNTRIES LIST (GET /countries or action=countries)
    // -----------------------------------------------------------------------
    if (action === 'countries') {
      try {
        if (!cachedCountries || (Date.now() - lastCountriesFetch > 10 * 60 * 1000)) {
          const upstreamRes = await queryVirtualSMSNumbers('/countries');
          const list = Array.isArray(upstreamRes?.data) 
            ? upstreamRes.data 
            : Array.isArray(upstreamRes) 
            ? upstreamRes 
            : [];
          if (list.length > 0) {
            cachedCountries = list;
            lastCountriesFetch = Date.now();
          }
        }
      } catch (err: any) {
        console.warn('[Netlify VSN] Upstream countries fetch notice:', err.message);
      }

      if (cachedCountries && cachedCountries.length > 0) {
        const server = (queryParams.server || body.server || '').toLowerCase();
        let filtered = cachedCountries;
        if (server === 'usa1' || server === 'usa') {
          filtered = cachedCountries.filter((c: any) => c.code === 'US' || c.code === 'CA' || c.region === 'North America');
        }

        const mapped = filtered.map((c: any) => ({
          id: (c.code || String(c.id)).toUpperCase(),
          code: c.dial_code || getCountryDialCode(c.id, c.name, c.code),
          name: c.name,
          flag: c.flag || getCountryFlagEmoji(c.code || String(c.id)),
          region: c.region || 'Global'
        }));

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            provider: 'VirtualSMSNumbers',
            hasApiKey,
            countries: mapped
          })
        };
      }

      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Could not load countries from VirtualSMSNumbers provider.',
          countries: []
        })
      };
    }

    // -----------------------------------------------------------------------
    // 3. SERVERS (GET /servers or action=servers)
    // -----------------------------------------------------------------------
    if (action === 'servers') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: 'VirtualSMSNumbers',
          hasApiKey,
          servers: [
            { id: 'all1', name: 'Global Direct Pool (225 Countries)', region: 'Global' },
            { id: 'usa1', name: 'USA & North America Dedicated Pool', region: 'USA' }
          ]
        })
      };
    }

    // -----------------------------------------------------------------------
    // 4. REAL PRICE & STOCK (GET /price or action=price)
    // -----------------------------------------------------------------------
    if (action === 'price') {
      const rawCountry = (queryParams.country || body.country || '').toString();
      const rawService = (queryParams.service || body.service || '').toString();

      if (!rawService) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Service parameter is required.' })
        };
      }

      // Ensure cached lists are populated for canonical slug / country mapping
      if (!cachedServices) {
        try {
          const sRes = await queryVirtualSMSNumbers('/services');
          if (Array.isArray(sRes?.data)) cachedServices = sRes.data;
        } catch {}
      }
      if (!cachedCountries) {
        try {
          const cRes = await queryVirtualSMSNumbers('/countries');
          if (Array.isArray(cRes?.data)) cachedCountries = cRes.data;
        } catch {}
      }

      const cleanService = resolveToVsnServiceSlug(rawService, cachedServices || []);
      const isCheapestQuery = !rawCountry || rawCountry.toLowerCase() === 'cheapest' || rawCountry.toLowerCase() === 'cheapest_available' || rawCountry.toLowerCase() === 'any';
      const countryIso = isCheapestQuery ? '' : resolveToVsnCountryCode(rawCountry, cachedCountries || []);

      let resolvedCountry = countryIso || 'US';
      let resolvedCountryName = 'United States';
      let resolvedFlag = '🇺🇸';
      let resolvedDialCode = '+1';

      let providerCostNgn = 350;
      let providerCostEur = 0.20;
      let stock = 0;
      let successRate = 0.90;
      let isAvailable = false;

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
          providerCostNgn = Math.round(providerCostEur * eurToNgnRate);
          stock = Number(item.available ?? item.stock ?? item.count ?? 0);
          if (isNaN(stock) || stock < 0) stock = 0;
          successRate = Number(item.success_rate ?? item.rate) || 0.90;
          isAvailable = stock > 0;

          const cCode = (item.country || item.country_code || item.code || countryIso || 'US').toString().toUpperCase();
          resolvedCountry = cCode;
          const matched = (cachedCountries || []).find((c: any) => (c.code?.toUpperCase() === cCode) || String(c.id) === cCode);
          resolvedCountryName = matched?.name || item.country_name || cCode;
          resolvedFlag = matched?.flag || getCountryFlagEmoji(cCode);
          resolvedDialCode = matched?.dial_code || getCountryDialCode(cCode, resolvedCountryName);
        } else {
          isAvailable = false;
          stock = 0;
        }
      } catch (err: any) {
        console.warn(`[Netlify VSN Price Notice] (${countryIso || 'cheapest'}/${cleanService}):`, err.message);
        isAvailable = false;
        stock = 0;
      }

      const options = generatePriceOptions(providerCostNgn, isOwner);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: 'VirtualSMSNumbers',
          hasApiKey,
          available: isAvailable,
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
        })
      };
    }

    // -----------------------------------------------------------------------
    // 5. PROVIDER BALANCE (GET /balance or action=balance) (Owner Only)
    // -----------------------------------------------------------------------
    if (action === 'balance') {
      if (!isOwner) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: 'Forbidden: Owner permission required.' })
        };
      }

      if (!hasApiKey) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            provider: 'VirtualSMSNumbers',
            hasApiKey: false,
            message: 'VSN_API_KEY is not configured yet on Netlify.'
          })
        };
      }

      try {
        const balanceRes = await queryVirtualSMSNumbers('/balance');
        const accountRes = await queryVirtualSMSNumbers('/me').catch(() => null);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            provider: 'VirtualSMSNumbers',
            hasApiKey: true,
            balanceEur: balanceRes.balance || (balanceRes.balance_cents / 100),
            balanceCents: balanceRes.balance_cents,
            canPurchase: Boolean(balanceRes.can_purchase),
            requiresTopUp: !balanceRes.can_purchase,
            accountEmail: accountRes?.email || 'zenethubofficial@gmail.com'
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

    // -----------------------------------------------------------------------
    // 6. ORDERS HISTORY (GET /orders or action=orders)
    // -----------------------------------------------------------------------
    if (action === 'orders') {
      if (!verifiedUser) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Unauthorized. Please sign in.' })
        };
      }

      await ensureServerAuthenticated();
      const db = getDb();
      if (!db) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Database service is currently unavailable.' })
        };
      }

      let ordersQuery;
      if (isOwner && queryParams.all === 'true') {
        ordersQuery = query(collection(db, 'virtual_number_orders'));
      } else {
        ordersQuery = query(collection(db, 'virtual_number_orders'), where('userId', '==', verifiedUser.uid));
      }

      const snap = await getDocs(ordersQuery);
      const ordersList = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) }));
      ordersList.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: 'VirtualSMSNumbers',
          orders: ordersList
        })
      };
    }

    // -----------------------------------------------------------------------
    // 7. BUY VIRTUAL NUMBER (POST /buy or action=buy)
    // -----------------------------------------------------------------------
    if (action === 'buy') {
      if (!verifiedUser) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Unauthorized: Please sign in.' })
        };
      }

      await ensureServerAuthenticated();
      const db = getDb();
      if (!db) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Database service is currently unavailable.' })
        };
      }

      const { country, service, selectedPrice } = body;
      if (!service) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Service parameter is required.' })
        };
      }

      // 5-second idempotency guard
      const now = Date.now();
      const lockKey = `buy_${verifiedUser.uid}`;
      const lastAttempt = userOrderLocks.get(lockKey);
      if (lastAttempt && (now - lastAttempt < 5000)) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ success: false, error: 'An allocation transaction is already processing. Please wait.' })
        };
      }
      userOrderLocks.set(lockKey, now);

      // Canonical slug and country resolution
      if (!cachedServices) {
        try {
          const sRes = await queryVirtualSMSNumbers('/services');
          if (Array.isArray(sRes?.data)) cachedServices = sRes.data;
        } catch {}
      }
      if (!cachedCountries) {
        try {
          const cRes = await queryVirtualSMSNumbers('/countries');
          if (Array.isArray(cRes?.data)) cachedCountries = cRes.data;
        } catch {}
      }

      const cleanService = resolveToVsnServiceSlug(service, cachedServices || []);
      const isCheapestQuery = !country || country.toLowerCase() === 'cheapest' || country.toLowerCase() === 'any';
      let countryIso = isCheapestQuery ? '' : resolveToVsnCountryCode(country, cachedCountries || []);

      // Look up current provider price
      let providerEurCost = 0.50;
      try {
        if (hasApiKey) {
          const priceRes = await queryVirtualSMSNumbers('/prices', {
            country: countryIso || undefined,
            service: cleanService
          });
          const pData = priceRes?.data || priceRes;
          if (Array.isArray(pData) && pData.length > 0) {
            const match = countryIso ? pData.find((p: any) => p.country === countryIso) : pData[0];
            if (match) {
              providerEurCost = Number(match.price || match.cost || 0.50);
              if (!countryIso && match.country) countryIso = match.country;
            }
          }
        }
      } catch (pErr: any) {
        console.warn('[Netlify VSN Buy] Price lookup note:', pErr.message);
      }

      if (!countryIso) countryIso = 'US';

      let customerPrice = Math.max(1, Math.round(providerEurCost * eurToNgnRate));
      if (selectedPrice && Number(selectedPrice) > 0) {
        customerPrice = Math.round(Number(selectedPrice));
      }

      // Check user wallet balance before doing anything
      const userRef = doc(db, 'users', verifiedUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'User profile not found.' })
        };
      }

      const userData = userSnap.data();
      const currentBal = Number(userData.walletBalance ?? userData.balance ?? 0);

      if (currentBal < customerPrice) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            code: 'INSUFFICIENT_BALANCE',
            error: `Insufficient wallet balance. This number requires ₦${customerPrice.toLocaleString()}, but your balance is ₦${currentBal.toLocaleString()}. Please top up your wallet.`
          })
        };
      }

      if (!hasApiKey) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            success: false,
            code: 'PROVIDER_KEY_MISSING',
            error: 'Virtual SMS provider API key is not configured in the server environment.'
          })
        };
      }

      // Call upstream activation API
      let activationResult: any = null;
      try {
        activationResult = await queryVirtualSMSNumbers('/activations', {
          country: countryIso,
          service: cleanService
        }, 'POST');
      } catch (supplierError: any) {
        console.warn('[Netlify VSN Buy] Provider declined:', supplierError.message);
        const errCode = supplierError.code || supplierError.data?.error?.code || 'PROVIDER_DECLINED';
        const errMsg = supplierError.message || supplierError.data?.error?.message || 'Provider reported insufficient balance or allocation error.';
        const isTopUpReq = String(errCode).toLowerCase().includes('top_up') || String(errMsg).toLowerCase().includes('top-up') || String(errMsg).toLowerCase().includes('€20');
        return {
          statusCode: 422,
          headers,
          body: JSON.stringify({
            success: false,
            code: errCode,
            error: isTopUpReq
              ? 'Virtual SMS / Service Numbers is coming soon. The service is currently undergoing provider setup and will be enabled shortly. Your wallet balance was not charged.'
              : `Service notice: ${errMsg}. Your wallet balance was not charged.`
          })
        };
      }

      if (!activationResult || activationResult.error || (!activationResult.id && !activationResult.phone_number && !activationResult.phone)) {
        const errCode = activationResult?.error?.code || 'PROVIDER_DECLINED';
        const errMsg = activationResult?.error?.message || activationResult?.message || 'Provider reported no available numbers or insufficient balance.';
        return {
          statusCode: 422,
          headers,
          body: JSON.stringify({
            success: false,
            code: errCode,
            error: `Service notice: ${errMsg}. Your wallet balance was not charged.`
          })
        };
      }

      // Provider confirmed -> Debit wallet and record in Firestore
      const providerActivationId = String(activationResult.id || activationResult.activation_id || activationResult.order_id);
      const rawPhone = String(activationResult.phone_number || activationResult.phoneNumber || activationResult.phone || '');
      const cleanPhone = rawPhone.replace(/^\+/, '');
      const nowIso = new Date().toISOString();
      const expiresAtIso = new Date(Date.now() + 20 * 60 * 1000).toISOString();
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
        tx.set(doc(db, 'wallets', verifiedUser.uid), {
          userId: verifiedUser.uid,
          userEmail: userData.email || '',
          walletBalance: newBal,
          balance: newBal,
          updatedAt: nowIso
        }, { merge: true });

        tx.set(doc(db, 'transactions', txId), {
          id: txId,
          userId: verifiedUser.uid,
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
          userId: verifiedUser.uid,
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
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
        })
      };
    }

    // -----------------------------------------------------------------------
    // 8. ORDER STATUS (GET /status or action=status)
    // -----------------------------------------------------------------------
    if (action === 'status') {
      const orderId = (queryParams.order_id || queryParams.orderId || queryParams.id || body.order_id || body.orderId || body.id || '').toString();

      if (!orderId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Order ID is required.' })
        };
      }

      await ensureServerAuthenticated();
      const db = getDb();
      if (!db) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Database unavailable' })
        };
      }

      const orderRef = doc(db, 'virtual_number_orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Order not found.' })
        };
      }

      const orderData = orderSnap.data();
      if (verifiedUser && orderData.userId !== verifiedUser.uid && !isOwner) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: 'Forbidden' })
        };
      }

      // If already code received
      if (orderData.status === 'RECEIVED' || orderData.status === 'COMPLETED' || orderData.code) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            status: 'RECEIVED',
            code: orderData.code || '',
            smsText: orderData.smsText || '',
            order: orderData
          })
        };
      }

      // If already cancelled or refunded
      if (orderData.status === 'CANCELLED' || orderData.status === 'EXPIRED' || orderData.refunded) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            status: orderData.status || 'CANCELLED',
            code: '',
            smsText: '',
            refunded: true,
            order: orderData
          })
        };
      }

      // For WAITING orders: poll upstream provider
      if (orderData.status === 'WAITING' && orderData.providerOrderId && hasApiKey) {
        const createdAtMs = new Date(orderData.createdAt || Date.now()).getTime();
        const orderAgeMs = Date.now() - createdAtMs;
        const isPast20Min = orderAgeMs >= 20 * 60 * 1000;

        try {
          const upstreamStatus = await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}`);
          if (upstreamStatus) {
            const dataObj = upstreamStatus.data || upstreamStatus;
            const uStatus = String(dataObj.status || upstreamStatus.status || '').toLowerCase();
            let extractedCode = dataObj.code || upstreamStatus.code || null;
            let extractedText = dataObj.smsText || dataObj.sms_text || dataObj.text || upstreamStatus.smsText || '';

            const messagesList = Array.isArray(dataObj.messages) ? dataObj.messages : [];
            if (!extractedCode && messagesList.length > 0) {
              extractedCode = messagesList[0].code || null;
              extractedText = messagesList[0].text || messagesList[0].message || '';
            }

            if (!extractedCode && extractedText) {
              const match = extractedText.match(/\b\d{4,8}\b/);
              if (match) extractedCode = match[0];
            }

            const isReceived = uStatus === 'code_received' || uStatus === 'received' || uStatus === 'success' || uStatus === 'completed' || Boolean(extractedCode);

            if (isReceived && extractedCode) {
              const nowIso = new Date().toISOString();
              await updateDoc(orderRef, {
                status: 'RECEIVED',
                code: extractedCode,
                smsText: extractedText || `Verification code: ${extractedCode}`,
                receivedAt: nowIso,
                updatedAt: nowIso
              });

              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                  success: true,
                  status: 'RECEIVED',
                  code: extractedCode,
                  smsText: extractedText || `Verification code: ${extractedCode}`,
                  order: { ...orderData, status: 'RECEIVED', code: extractedCode, smsText: extractedText }
                })
              };
            }

            // 20-minute automatic timeout cancellation and refund
            if (isPast20Min) {
              try {
                await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}/cancel`, {}, 'POST');
              } catch {}

              const nowIso = new Date().toISOString();
              const refundAmount = Number(orderData.price || orderData.customerPrice || 0);
              const userRef = doc(db, 'users', orderData.userId);
              const refundTxId = `REF-VSN-${orderData.orderId || orderId}`;

              await runTransaction(db, async (tx) => {
                const oSnap = await tx.get(orderRef);
                if (!oSnap.exists()) return;
                const oData = oSnap.data();
                if (oData.refunded || oData.status === 'RECEIVED' || oData.code) return;

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

              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                  success: true,
                  status: 'EXPIRED',
                  message: '20-minute waiting period elapsed without receiving an SMS code. Order cancelled and full refund credited to your wallet.',
                  refunded: true,
                  order: { ...orderData, status: 'EXPIRED', refunded: true }
                })
              };
            }
          }
        } catch (pollErr: any) {
          console.warn('[Netlify VSN Status Poll Notice]:', pollErr.message);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: orderData.status || 'WAITING',
          code: orderData.code || '',
          smsText: orderData.smsText || '',
          order: orderData
        })
      };
    }

    // -----------------------------------------------------------------------
    // 9. CANCEL & REFUND ORDER (POST /cancel or action=cancel)
    // -----------------------------------------------------------------------
    if (action === 'cancel') {
      const orderId = (body.order_id || body.orderId || body.id || queryParams.order_id || queryParams.orderId || queryParams.id || '').toString();

      if (!orderId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Order ID is required.' })
        };
      }

      await ensureServerAuthenticated();
      const db = getDb();
      if (!db) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Database unavailable' })
        };
      }

      const orderRef = doc(db, 'virtual_number_orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Order not found.' })
        };
      }

      const orderData = orderSnap.data();
      if (verifiedUser && orderData.userId !== verifiedUser.uid && !isOwner) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: 'Forbidden: You do not own this order.' })
        };
      }

      if (orderData.status === 'RECEIVED' || orderData.status === 'COMPLETED' || orderData.code) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            code: 'CODE_ALREADY_RECEIVED',
            error: 'Cannot cancel order: The SMS verification code has already arrived. No refund can be issued.'
          })
        };
      }

      if (orderData.status === 'CANCELLED' || orderData.status === 'EXPIRED' || orderData.refunded) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            code: 'ALREADY_CANCELLED',
            error: 'Order has already been cancelled and refunded.'
          })
        };
      }

      // Check upstream provider state
      if (orderData.providerOrderId && hasApiKey) {
        try {
          const providerCheck = await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}`);
          if (providerCheck) {
            const dataObj = providerCheck.data || providerCheck;
            let extractedCode = dataObj.code || providerCheck.code || null;
            if (!extractedCode && Array.isArray(dataObj.messages) && dataObj.messages.length > 0) {
              extractedCode = dataObj.messages[0].code || null;
            }

            if (extractedCode) {
              const nowIso = new Date().toISOString();
              await updateDoc(orderRef, {
                status: 'RECEIVED',
                code: extractedCode,
                smsText: dataObj.smsText || dataObj.text || `Verification code: ${extractedCode}`,
                receivedAt: nowIso,
                updatedAt: nowIso
              });

              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                  success: false,
                  code: 'CODE_ALREADY_RECEIVED',
                  error: 'Cannot cancel order: The verification code arrived from the carrier. Cancellation and refund are disabled.',
                  receivedCode: extractedCode
                })
              };
            }
          }
        } catch {}

        try {
          await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}/cancel`, {}, 'POST');
        } catch (cancelErr: any) {
          const msg = (cancelErr.message || '').toLowerCase();
          if (!msg.includes('already') && !msg.includes('canceled') && !msg.includes('cancelled') && !msg.includes('expired') && cancelErr.status !== 404) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                success: false,
                code: 'PROVIDER_DECLINED',
                error: `Provider declined cancellation: ${cancelErr.message}.`
              })
            };
          }
        }
      }

      // Atomically refund customer wallet
      const refundPrice = Number(orderData.price || orderData.customerPrice || 0);
      const userRef = doc(db, 'users', orderData.userId);
      const nowIso = new Date().toISOString();
      const refundTxId = `REF-VSN-${orderData.orderId || orderId}`;

      await runTransaction(db, async (tx) => {
        const oSnap = await tx.get(orderRef);
        if (!oSnap.exists()) throw new Error('Order not found');
        const oData = oSnap.data();

        if (oData.refunded || oData.status === 'RECEIVED' || oData.code) {
          throw new Error('Order was already processed or refunded.');
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: 'CANCELLED',
          message: `Order cancelled successfully. ₦${refundPrice.toLocaleString()} has been refunded to your wallet.`,
          refunded: true,
          refundAmount: refundPrice
        })
      };
    }

    // -----------------------------------------------------------------------
    // 10. COMPLETE ORDER (POST /complete or action=complete)
    // -----------------------------------------------------------------------
    if (action === 'complete') {
      const orderId = (body.order_id || body.orderId || body.id || queryParams.order_id || queryParams.orderId || queryParams.id || '').toString();

      if (!orderId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Order ID is required.' })
        };
      }

      await ensureServerAuthenticated();
      const db = getDb();
      if (!db) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Database unavailable' })
        };
      }

      const orderRef = doc(db, 'virtual_number_orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Order not found.' })
        };
      }

      const orderData = orderSnap.data();
      if (orderData.providerOrderId && hasApiKey) {
        try {
          await queryVirtualSMSNumbers(`/activations/${orderData.providerOrderId}/complete`, {}, 'POST');
        } catch {}
      }

      await updateDoc(orderRef, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString()
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Order completed.' })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: `Unsupported action: ${action}` })
    };

  } catch (err: any) {
    console.error('[Netlify OneGridHub Gateway Error]:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'VirtualSMSNumbers Gateway error' })
    };
  }
};
