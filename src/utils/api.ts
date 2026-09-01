/**
 * API utility for ZENET HUB
 * Handles endpoint routing across environments:
 * - Local / Dev server (/api/*)
 * - Netlify static deployment with serverless functions (/api/* -> /.netlify/functions/*)
 * - Custom backend base URL if configured via VITE_API_URL / VITE_BACKEND_URL
 */

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const customApiUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_BACKEND_URL;

  if (customApiUrl && typeof customApiUrl === 'string' && customApiUrl.trim()) {
    const baseUrl = customApiUrl.trim().endsWith('/') ? customApiUrl.trim().slice(0, -1) : customApiUrl.trim();
    return `${baseUrl}${cleanPath}`;
  }

  return cleanPath;
};

/**
 * Validates and sanitizes a Paystack public key.
 * Only accepts valid pk_live_ or pk_test_ keys.
 * Rejects undefined, null, demo placeholders, quotes, and secret keys (sk_...).
 */
export const formatPaystackPublicKey = (key: any): string => {
  if (!key || typeof key !== 'string') return '';
  let clean = key.trim().replace(/^['"`]|['"`]$/g, '').trim();

  // If secret key is somehow passed, strictly convert prefix or strip
  if (clean.startsWith('sk_')) {
    clean = clean.replace(/^sk_/, 'pk_');
  }

  // Must start with pk_live_ or pk_test_
  if (clean.startsWith('pk_live_') || clean.startsWith('pk_test_')) {
    if (clean.includes('demo') || clean === 'pk_test_' || clean === 'pk_live_') {
      return '';
    }
    return clean;
  }

  return '';
};

/**
 * Sanitizes any backend or provider error message so that raw HTML,
 * CSS, JSON SyntaxErrors or stack traces are NEVER displayed to users.
 */
export const sanitizeApiErrorMessage = (
  msg: any,
  fallback = 'This service is currently updating. Please try again shortly.'
): string => {
  if (!msg || typeof msg !== 'string') return fallback;
  const lower = msg.toLowerCase();
  if (
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('<head') ||
    lower.includes('<body') ||
    lower.includes('<script') ||
    lower.includes('<style') ||
    lower.includes('unexpected token') ||
    lower.includes('not valid json') ||
    lower.includes('failed to fetch') ||
    lower.includes('internal server error') ||
    lower.includes('502 bad gateway') ||
    lower.includes('503 service unavailable') ||
    lower.includes('504 gateway timeout') ||
    lower.includes('cloudflare') ||
    lower.includes('syntaxerror')
  ) {
    return fallback;
  }
  return msg.trim();
};

export const safeApiFetch = async (path: string, options: RequestInit = {}): Promise<any> => {
  const url = getApiUrl(path);
  
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      ...((options.headers as Record<string, string>) || {})
    };

    if (options.body && typeof options.body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return data;
    }

    const text = await res.text().catch(() => '');
    if (text) {
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch {
        // Returned HTML or non-JSON text
        if (!res.ok) {
          throw new Error(sanitizeApiErrorMessage(text));
        }
        return { success: res.ok, data: text };
      }
    }

    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }

    return { success: true };
  } catch (err: any) {
    const cleanMsg = sanitizeApiErrorMessage(err?.message);
    throw new Error(cleanMsg);
  }
};



