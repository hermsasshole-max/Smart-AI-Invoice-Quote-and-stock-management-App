/**
 * Global API Configuration for Web & Capacitor Native Android
 *
 * In web browsers (AI Studio preview, hosted web app, local dev), the frontend
 * and Express backend share the same origin, so relative `/api/...` paths are used.
 *
 * In native Android builds (Capacitor / Android WebView), the app runs locally from
 * `https://localhost`, `capacitor://localhost`, or `http://localhost`, so network calls are routed to the
 * live hosted Render backend URL.
 */

// Default Hosted Render backend URL for native Android APK builds
export const HOSTED_BACKEND_URL = 'https://smart-ai-invoice-quote-and-stock-y242.onrender.com';

/**
 * Check if the application is running inside a native mobile runtime (Capacitor / Android WebView)
 */
export const isNativeApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const win = window as any;

  // 1. Explicit Capacitor or Android interface flags
  if (
    win.Capacitor?.isNativePlatform?.() ||
    win.Capacitor?.getPlatform?.() === 'android' ||
    win.Capacitor?.getPlatform?.() === 'ios' ||
    win.AndroidInterface?.isAndroidApp?.() ||
    win._isCapacitorApp === true
  ) {
    return true;
  }

  // 2. Mobile custom protocols
  const protocol = win.location?.protocol || '';
  if (protocol === 'capacitor:' || protocol === 'ionic:' || protocol === 'file:') {
    return true;
  }

  // 3. Android WebView with androidScheme: 'https' (runs on https://localhost with empty port)
  const origin = win.location?.origin || '';
  const port = win.location?.port || '';
  const hostname = win.location?.hostname || '';

  if (
    (origin === 'https://localhost' || origin === 'http://localhost' || origin === 'capacitor://localhost' || origin === 'ionic://localhost') &&
    (!port || port === '80' || port === '443')
  ) {
    return true;
  }

  // 4. Android userAgent on localhost origin
  if (
    (hostname === 'localhost' || hostname === '127.0.0.1') &&
    (!port || port === '80' || port === '443') &&
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  ) {
    return true;
  }

  return false;
};

/**
 * Check if the application is running in a standard web browser environment (AI Studio preview or hosted Web SPA)
 */
export const isWebBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (isNativeApp()) return false;
  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
};

/**
 * Resolved base URL for all API requests.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Check for user-configured custom endpoint override
    const customUrl = localStorage.getItem('harrys_custom_api_url');
    if (customUrl && customUrl.trim().length > 0) {
      return customUrl.trim().replace(/\/+$/, '');
    }
  }

  // 1. If running in native Android / iOS Capacitor app or Android WebView (e.g. https://localhost)
  if (isNativeApp()) {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
      return envUrl.trim().replace(/\/+$/, '');
    }
    return HOSTED_BACKEND_URL;
  }

  // 2. If running in standard web browser (preview or production), use same-origin relative path
  if (isWebBrowser()) {
    // Only use remote URL if explicitly forced via VITE_FORCE_REMOTE_API=true
    if (import.meta.env.VITE_FORCE_REMOTE_API === 'true' && import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL.trim().replace(/\/+$/, '');
    }
    return ''; // Same-origin relative path
  }

  return HOSTED_BACKEND_URL;
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Generate fully qualified API endpoint URL
 * @param path API endpoint path (e.g. '/api/scan-receipt' or 'api/usage')
 * @returns Fully-qualified API URL or relative path depending on runtime environment
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return cleanPath;
  }
  return `${baseUrl}${cleanPath}`;
}

export default {
  API_BASE_URL,
  HOSTED_BACKEND_URL,
  isNativeApp,
  isWebBrowser,
  getApiBaseUrl,
  getApiUrl,
};
