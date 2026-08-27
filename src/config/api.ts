/**
 * Global API Configuration for Web & Capacitor Native Android
 *
 * In web browsers (AI Studio preview, hosted web app, local dev), the frontend
 * and Express backend share the same origin, so relative `/api/...` paths are used.
 *
 * In native Android builds (Capacitor / Android WebView), the app runs locally from
 * `capacitor://localhost` or `http://localhost`, so network calls are routed to the
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
  return Boolean(
    win.Capacitor?.isNativePlatform?.() ||
    win.Capacitor?.getPlatform?.() === 'android' ||
    win.Capacitor?.getPlatform?.() === 'ios' ||
    win.location?.protocol === 'capacitor:' ||
    win.location?.protocol === 'ionic:' ||
    win.AndroidInterface?.isAndroidApp?.()
  );
};

/**
 * Check if the application is running in a standard web browser environment
 */
export const isWebBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !isNativeApp() && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
};

/**
 * Resolved base URL for all API requests.
 */
export function getApiBaseUrl(): string {
  // 1. If running in standard web browser (preview or production), use same-origin relative path
  if (isWebBrowser()) {
    // Only use remote URL if explicitly forced via VITE_FORCE_REMOTE_API=true
    if (import.meta.env.VITE_FORCE_REMOTE_API === 'true' && import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL.trim().replace(/\/+$/, '');
    }
    return ''; // Same-origin relative path
  }

  // 2. If running inside native Android / iOS Capacitor app
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
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
