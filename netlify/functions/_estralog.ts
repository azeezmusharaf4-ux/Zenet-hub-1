/**
 * Shared EstraLog Tools (Server 2) API Client
 * Used across Netlify Functions for production execution.
 * Connects directly to real EstraLog Tools API.
 * NEVER hardcodes secrets or fake responses.
 */

export const getEstraLogConfig = () => {
  const candidates = [
    process.env.ESTRALOG_API_KEY,
    process.env.ESTRALOGS_API_KEY,
    process.env.ESTRALOG_TOOLS_API_KEY,
    process.env.ESTRALOGS_TOOLS_API_KEY,
    process.env.XTRALOGSTOOLS_API_KEY,
    process.env.EXTRA_LOG_API_KEY,
    process.env.EXTRA_LOGS_API_KEY,
    process.env.PROVIDER2_NUMBERS_API_KEY,
    process.env.PROVIDER2_SOCIAL_BOOST_API_KEY,
    process.env.PROVIDER2_SMM_API_KEY,
    process.env.PROVIDER2_API_KEY,
    process.env.VIRTUAL_NUMBER_2_API_KEY
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

  const rawBase = (
    process.env.ESTRALOG_BASE_URL ||
    process.env.ESTRALOGS_BASE_URL ||
    process.env.ESTRALOG_TOOLS_BASE_URL ||
    process.env.XTRALOGSTOOLS_BASE_URL ||
    process.env.EXTRA_LOG_BASE_URL ||
    process.env.EXTRA_LOGS_BASE_URL ||
    process.env.PROVIDER2_NUMBERS_BASE_URL ||
    process.env.PROVIDER2_SOCIAL_BOOST_BASE_URL ||
    'https://xtralogstools.com/api/v1/index.php'
  ).trim().replace(/^['"`]|['"`]$/g, '').trim();

  let baseUrl = rawBase;
  if (!baseUrl.includes('/api/v1')) {
    baseUrl = `${baseUrl.replace(/\/+$/, '')}/api/v1/index.php`;
  } else if (!baseUrl.endsWith('.php')) {
    baseUrl = `${baseUrl.replace(/\/+$/, '')}/index.php`;
  }

  return { apiKey, baseUrl };
};

export const normalizeEstraLogServer = (serverParam: string = '', tabParam: string = 'usa'): string => {
  const s = (serverParam || '').toLowerCase().trim();
  if (['usa1', 'usa2', 'usa3', 'all1', 'all2', 'all3'].includes(s)) {
    return s;
  }
  if (s === 'server_1' || s === 'server1') {
    return tabParam === 'all' ? 'all1' : 'usa1';
  }
  if (s === 'server_2' || s === 'server2') {
    return tabParam === 'all' ? 'all2' : 'usa2';
  }
  if (s === 'server_3' || s === 'server3') {
    return tabParam === 'all' ? 'all3' : 'usa3';
  }
  return tabParam === 'all' ? 'all1' : 'usa1';
};

export const queryEstraLog = async (
  endpoint: string,
  params: Record<string, any> = {},
  method: 'GET' | 'POST' = 'GET'
): Promise<any> => {
  const { apiKey, baseUrl } = getEstraLogConfig();
  if (!apiKey) {
    throw new Error('EstraLog Tools API Key is not configured in server environment variables.');
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    'Accept': 'application/json',
    'User-Agent': 'BMB-EstraLogTools-Production/1.0'
  };

  const urlObj = new URL(baseUrl);
  urlObj.searchParams.set('endpoint', endpoint);

  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        urlObj.searchParams.set(k, String(v));
      }
    }
    const response = await fetch(urlObj.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000)
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid response from EstraLog Tools (${response.status}): ${text.slice(0, 150)}`);
    }
  } else {
    const bodyParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        bodyParams.append(k, String(v));
      }
    }
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const response = await fetch(urlObj.toString(), {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(20000)
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid response from EstraLog Tools (${response.status}): ${text.slice(0, 150)}`);
    }
  }
};
