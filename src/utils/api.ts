/**
 * API utility for ZENET HUB
 * Handles endpoint routing across environments:
 * - Local / Dev server (/api/*)
 * - Netlify static deployment with serverless functions (/api/* -> /.netlify/functions/*)
 * - Custom backend base URL if configured via VITE_API_URL / VITE_BACKEND_URL
 */

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const rawApiUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_BACKEND_URL;

  // Strictly validate customApiUrl: must be a non-empty string starting with http:// or https://
  // Must NOT be a placeholder string like 'VITE_API_URL', 'undefined', 'null', etc.
  if (
    rawApiUrl &&
    typeof rawApiUrl === 'string' &&
    (rawApiUrl.trim().startsWith('http://') || rawApiUrl.trim().startsWith('https://')) &&
    !rawApiUrl.includes('VITE_API_URL') &&
    !rawApiUrl.includes('VITE_BACKEND_URL')
  ) {
    const baseUrl = rawApiUrl.trim().endsWith('/') ? rawApiUrl.trim().slice(0, -1) : rawApiUrl.trim();
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

/**
 * Maps /api/* endpoints to their respective Netlify serverless functions
 * for automatic route fallback if Netlify redirects are bypassed or fail.
 */
export const getNetlifyFunctionFallback = (path: string): string | null => {
  const [pathname, search] = path.split('?');
  const qs = search ? `?${search}` : '';

  if (pathname.startsWith('/api/social-boost-2')) {
    const sub = pathname.replace('/api/social-boost-2', '').replace(/^\//, '');
    const actionParam = sub ? (qs ? `&action=${sub}` : `?action=${sub}`) : '';
    return `/.netlify/functions/social-boost-2${qs}${actionParam}`;
  }
  if (pathname.startsWith('/api/social-boost')) {
    const sub = pathname.replace('/api/social-boost', '').replace(/^\//, '');
    const actionParam = sub ? (qs ? `&action=${sub}` : `?action=${sub}`) : '';
    return `/.netlify/functions/social-boost${qs}${actionParam}`;
  }
  if (pathname.startsWith('/api/service-number-2')) {
    const sub = pathname.replace('/api/service-number-2', '').replace(/^\//, '');
    const actionParam = sub ? (qs ? `&action=${sub}` : `?action=${sub}`) : '';
    return `/.netlify/functions/service-number-2${qs}${actionParam}`;
  }
  if (pathname.startsWith('/api/onegridhub')) {
    const sub = pathname.replace('/api/onegridhub', '').replace(/^\//, '');
    const actionParam = sub ? (qs ? `&action=${sub}` : `?action=${sub}`) : '';
    return `/.netlify/functions/onegridhub${qs}${actionParam}`;
  }
  if (pathname.startsWith('/api/paystack/initialize')) {
    return `/.netlify/functions/paystack-initialize${qs}`;
  }
  if (pathname.startsWith('/api/paystack/verify')) {
    return `/.netlify/functions/paystack-verify${qs}`;
  }
  if (pathname.startsWith('/api/paystack/webhook')) {
    return `/.netlify/functions/paystack-webhook${qs}`;
  }
  if (pathname.startsWith('/api/wallet/purchase')) {
    return `/.netlify/functions/wallet-purchase${qs}`;
  }
  if (pathname.startsWith('/api/admin/wallets/override') || pathname.startsWith('/api/admin/wallets/adjust') || pathname.startsWith('/api/admin/override-wallet')) {
    return `/.netlify/functions/admin-wallets-override${qs}`;
  }
  if (pathname.startsWith('/api/admin/manage-role')) {
    return `/.netlify/functions/admin-manage-role${qs}`;
  }
  if (pathname.startsWith('/api/health')) {
    return `/.netlify/functions/health${qs}`;
  }
  if (pathname.startsWith('/api/')) {
    return `/.netlify/functions/api${pathname.replace('/api', '')}${qs}`;
  }
  return null;
};

export const safeApiFetch = async (path: string, options: RequestInit = {}): Promise<any> => {
  const url = getApiUrl(path);
  
  const executeFetch = async (targetUrl: string): Promise<{ ok: boolean; status: number; data: any; isHtml: boolean }> => {
    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      ...((options.headers as Record<string, string>) || {})
    };

    if (options.body && typeof options.body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(targetUrl, {
      ...options,
      headers
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data, isHtml: false };
    }

    const text = await res.text().catch(() => '');
    if (text) {
      try {
        const parsed = JSON.parse(text);
        return { ok: res.ok, status: res.status, data: parsed, isHtml: false };
      } catch {
        const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.includes('__vite_plugin');
        return { ok: !isHtml && res.ok, status: res.status, data: text, isHtml };
      }
    }

    return { ok: res.ok, status: res.status, data: null, isHtml: false };
  };

  try {
    let result = await executeFetch(url);

    // If request failed with 404, 502, or returned HTML (e.g. Netlify SPA fallback rewrite), try Netlify Function direct fallback
    if (!result.ok || result.isHtml || result.status === 404) {
      const fallbackUrl = getNetlifyFunctionFallback(path);
      if (fallbackUrl && fallbackUrl !== url) {
        try {
          const fallbackResult = await executeFetch(fallbackUrl);
          if (fallbackResult.ok && !fallbackResult.isHtml && fallbackResult.data) {
            result = fallbackResult;
          }
        } catch {
          // Fallback failed, continue with primary error flow
        }
      }
    }

    if (result.isHtml || (!result.ok && result.status === 404)) {
      throw new Error('API server returned unexpected response. Please check network connection or service status.');
    }

    if (!result.ok) {
      const errorMsg = result.data?.error || result.data?.message || `API request failed with status ${result.status}`;
      throw new Error(errorMsg);
    }

    return result.data ?? { success: true };
  } catch (err: any) {
    const cleanMsg = sanitizeApiErrorMessage(err?.message);
    throw new Error(cleanMsg);
  }
};



