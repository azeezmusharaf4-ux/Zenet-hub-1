/**
 * API utility for ZENET HUB
 * Handles endpoint routing across environments:
 * - Local / Dev server (/api/*)
 * - Netlify static deployment with serverless functions (/api/* -> /.netlify/functions/*)
 * - Custom backend base URL if configured via VITE_API_URL / VITE_BACKEND_URL
 */
import { getSafeIdToken } from '../lib/firebase';

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
      'X-Requested-With': 'XMLHttpRequest',
      ...((options.headers as Record<string, string>) || {})
    };

    if (options.body && typeof options.body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (!headers['Authorization'] && !headers['authorization']) {
      try {
        const token = await getSafeIdToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        // Fallback gracefully for unauthenticated public requests
      }
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

/**
 * Known invalid strings that must never be treated as OTP codes
 */
const INVALID_OTP_PATTERNS = [
  'unauthorized',
  'forbidden',
  'invalid',
  'error',
  'failed',
  'status',
  'pending',
  'waiting',
  'wait',
  'expired',
  'cancelled',
  'canceled',
  'null',
  'undefined',
  'unknown',
  'no_activation',
  'bad_key',
  'bad_action',
  'no_numbers',
  'access_denied',
  'true',
  'false',
  'ok',
  'success',
  'none'
];

export const isInvalidOtpCode = (val: any): boolean => {
  if (!val) return true;
  const str = String(val).trim().toLowerCase();
  if (!str) return true;
  if (INVALID_OTP_PATTERNS.includes(str)) return true;
  if (str.length < 3 || str.length > 12) return true;
  if (/^[a-z_\s\-]+$/i.test(str)) return true;
  return false;
};

export const isValidOtpCode = (val: any): boolean => {
  if (!val) return false;
  if (isInvalidOtpCode(val)) return false;
  const str = String(val).trim();
  // Valid OTP must contain at least 3 digits
  const digitCount = (str.match(/\d/g) || []).length;
  return digitCount >= 3;
};

export interface ResolvedCountryInfo {
  id: string;
  name: string;
  code: string;
  flag: string;
  displayName: string;
}

export const resolveCountryInfo = (
  countryIdentifier?: string | null,
  phoneNumber?: string | null,
  dialCodeFallback?: string | null
): ResolvedCountryInfo => {
  const cleanPhone = (phoneNumber || '').replace(/[^\d+]/g, '');

  if (cleanPhone.startsWith('+1') || (cleanPhone.startsWith('1') && cleanPhone.length === 11)) {
    return { id: 'US', name: 'United States', code: '+1', flag: '🇺🇸', displayName: '🇺🇸 United States (+1)' };
  }
  if (cleanPhone.startsWith('+44') || cleanPhone.startsWith('44')) {
    return { id: 'GB', name: 'United Kingdom', code: '+44', flag: '🇬🇧', displayName: '🇬🇧 United Kingdom (+44)' };
  }
  if (cleanPhone.startsWith('+234') || cleanPhone.startsWith('234')) {
    return { id: 'NG', name: 'Nigeria', code: '+234', flag: '🇳🇬', displayName: '🇳🇬 Nigeria (+234)' };
  }
  if (cleanPhone.startsWith('+7') || cleanPhone.startsWith('7')) {
    return { id: 'RU', name: 'Russia', code: '+7', flag: '🇷🇺', displayName: '🇷🇺 Russia (+7)' };
  }
  if (cleanPhone.startsWith('+91') || cleanPhone.startsWith('91')) {
    return { id: 'IN', name: 'India', code: '+91', flag: '🇮🇳', displayName: '🇮🇳 India (+91)' };
  }
  if (cleanPhone.startsWith('+55') || cleanPhone.startsWith('55')) {
    return { id: 'BR', name: 'Brazil', code: '+55', flag: '🇧🇷', displayName: '🇧🇷 Brazil (+55)' };
  }
  if (cleanPhone.startsWith('+62') || cleanPhone.startsWith('62')) {
    return { id: 'ID', name: 'Indonesia', code: '+62', flag: '🇮🇩', displayName: '🇮🇩 Indonesia (+62)' };
  }
  if (cleanPhone.startsWith('+63') || cleanPhone.startsWith('63')) {
    return { id: 'PH', name: 'Philippines', code: '+63', flag: '🇵🇭', displayName: '🇵🇭 Philippines (+63)' };
  }
  if (cleanPhone.startsWith('+254') || cleanPhone.startsWith('254')) {
    return { id: 'KE', name: 'Kenya', code: '+254', flag: '🇰🇪', displayName: '🇰🇪 Kenya (+254)' };
  }
  if (cleanPhone.startsWith('+27') || cleanPhone.startsWith('27')) {
    return { id: 'ZA', name: 'South Africa', code: '+27', flag: '🇿🇦', displayName: '🇿🇦 South Africa (+27)' };
  }
  if (cleanPhone.startsWith('+49') || cleanPhone.startsWith('49')) {
    return { id: 'DE', name: 'Germany', code: '+49', flag: '🇩🇪', displayName: '🇩🇪 Germany (+49)' };
  }
  if (cleanPhone.startsWith('+33') || cleanPhone.startsWith('33')) {
    return { id: 'FR', name: 'France', code: '+33', flag: '🇫🇷', displayName: '🇫🇷 France (+33)' };
  }
  if (cleanPhone.startsWith('+380') || cleanPhone.startsWith('380')) {
    return { id: 'UA', name: 'Ukraine', code: '+380', flag: '🇺🇦', displayName: '🇺🇦 Ukraine (+380)' };
  }
  if (cleanPhone.startsWith('+84') || cleanPhone.startsWith('84')) {
    return { id: 'VN', name: 'Vietnam', code: '+84', flag: '🇻🇳', displayName: '🇻🇳 Vietnam (+84)' };
  }
  if (cleanPhone.startsWith('+60') || cleanPhone.startsWith('60')) {
    return { id: 'MY', name: 'Malaysia', code: '+60', flag: '🇲🇾', displayName: '🇲🇾 Malaysia (+60)' };
  }
  if (cleanPhone.startsWith('+65') || cleanPhone.startsWith('65')) {
    return { id: 'SG', name: 'Singapore', code: '+65', flag: '🇸🇬', displayName: '🇸🇬 Singapore (+65)' };
  }

  const raw = String(countryIdentifier || '').trim().toLowerCase();
  if (raw === 'us' || raw === 'usa' || raw === 'united states' || raw === '187' || raw === '1') {
    return { id: 'US', name: 'United States', code: '+1', flag: '🇺🇸', displayName: '🇺🇸 United States (+1)' };
  }
  if (raw === 'gb' || raw === 'uk' || raw === 'england' || raw === 'united kingdom' || raw === '16' || raw === '44') {
    return { id: 'GB', name: 'United Kingdom', code: '+44', flag: '🇬🇧', displayName: '🇬🇧 United Kingdom (+44)' };
  }
  if (raw === 'ng' || raw === 'nigeria' || raw === '19' || raw === '234') {
    return { id: 'NG', name: 'Nigeria', code: '+234', flag: '🇳🇬', displayName: '🇳🇬 Nigeria (+234)' };
  }
  if (raw === 'ru' || raw === 'russia' || raw === '0' || raw === '7') {
    return { id: 'RU', name: 'Russia', code: '+7', flag: '🇷🇺', displayName: '🇷🇺 Russia (+7)' };
  }
  if (raw === 'in' || raw === 'india' || raw === '22' || raw === '91') {
    return { id: 'IN', name: 'India', code: '+91', flag: '🇮🇳', displayName: '🇮🇳 India (+91)' };
  }
  if (raw === 'br' || raw === 'brazil' || raw === '73' || raw === '55') {
    return { id: 'BR', name: 'Brazil', code: '+55', flag: '🇧🇷', displayName: '🇧🇷 Brazil (+55)' };
  }
  if (raw === 'id' || raw === 'indonesia' || raw === '6' || raw === '62') {
    return { id: 'ID', name: 'Indonesia', code: '+62', flag: '🇮🇩', displayName: '🇮🇩 Indonesia (+62)' };
  }
  if (raw === 'ke' || raw === 'kenya' || raw === '8' || raw === '254') {
    return { id: 'KE', name: 'Kenya', code: '+254', flag: '🇰🇪', displayName: '🇰🇪 Kenya (+254)' };
  }
  if (raw === 'za' || raw === 'south africa' || raw === '31' || raw === '27') {
    return { id: 'ZA', name: 'South Africa', code: '+27', flag: '🇿🇦', displayName: '🇿🇦 South Africa (+27)' };
  }
  if (raw === 'ph' || raw === 'philippines' || raw === '4' || raw === '63') {
    return { id: 'PH', name: 'Philippines', code: '+63', flag: '🇵🇭', displayName: '🇵🇭 Philippines (+63)' };
  }

  const fallbackName = countryIdentifier || 'International';
  const dial = dialCodeFallback || '';
  return {
    id: countryIdentifier || 'INT',
    name: fallbackName,
    code: dial,
    flag: '🌐',
    displayName: dial ? `🌐 ${fallbackName} (${dial})` : `🌐 ${fallbackName}`
  };
};



