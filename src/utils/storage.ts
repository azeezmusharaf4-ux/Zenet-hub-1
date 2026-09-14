/**
 * Ultra-safe storage wrapper for localStorage and sessionStorage.
 * Protects against:
 * - Safari Private Browsing DOMException: SecurityError
 * - Android WebView restricted storage
 * - Disabled cookies / iframe storage blocking
 * - QuotaExceededError when device storage is completely full
 * - In-memory fallback if native storage is unavailable
 */

const memoryStore: Record<string, string> = {};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return memoryStore[`local_${key}`] ?? null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStore[`local_${key}`] = value;
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}
    delete memoryStore[`local_${key}`];
  }
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch {}
    return memoryStore[`session_${key}`] ?? null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStore[`session_${key}`] = value;
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {}
    delete memoryStore[`session_${key}`];
  }
};

/**
 * Universal safe scroll to top that never throws in older WebViews or iOS Safari.
 */
export const safeScrollToTop = () => {
  try {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  } catch {}
};
