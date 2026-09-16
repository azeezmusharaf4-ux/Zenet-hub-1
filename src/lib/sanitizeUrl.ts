/**
 * Secure URL Sanitizer
 * Protects against DOM-based XSS attacks via javascript:, vbscript:, or data: URLs.
 * Ensures only safe protocols (http, https, mailto, tel) are rendered in anchor hrefs.
 */
export function sanitizeUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Explicitly block dangerous script-executing schemes
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return '#';
  }

  // Safe protocols
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  // Relative paths
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }

  // Common web addresses missing scheme e.g. "drive.google.com/..."
  if (/^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return '#';
}
