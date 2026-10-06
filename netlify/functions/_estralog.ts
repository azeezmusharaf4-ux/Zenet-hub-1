/**
 * Shared EstraLog Tools (Server 2) API Client
 * Used across Netlify Functions for production execution.
 * Connects directly to real EstraLog Tools API.
 * NEVER hardcodes secrets or fake responses.
 */

export const getEstraLogConfig = () => {
  return { apiKey: '', baseUrl: '' };
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
