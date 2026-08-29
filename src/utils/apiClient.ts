import { getApiUrl } from '../config/api';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  silent?: boolean;
  onRetry?: (attempt: number, maxRetries: number, delayMs: number, error: any) => void;
}

const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds for Render cold-boot wake up
const DEFAULT_RETRIES = 3;

/**
 * Get persistent client user ID for header injection
 */
function getClientId(): string {
  if (typeof window === 'undefined') return 'server_render';
  try {
    let storedId = localStorage.getItem('harrys_contractor_user_id');
    if (!storedId) {
      storedId = 'user_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('harrys_contractor_user_id', storedId);
    }
    return storedId;
  } catch {
    return 'anon_client';
  }
}

/**
 * Check if an error or HTTP status is transient and eligible for retry
 */
export function isTransientError(errorOrStatus: any): boolean {
  if (typeof errorOrStatus === 'number') {
    return [408, 429, 500, 502, 503, 504].includes(errorOrStatus);
  }

  const str = String(errorOrStatus?.message || errorOrStatus || '').toLowerCase();
  return (
    str.includes('failed to fetch') ||
    str.includes('network error') ||
    str.includes('networkrequestfailed') ||
    str.includes('timeout') ||
    str.includes('timed out') ||
    str.includes('abort') ||
    str.includes('econnrefused') ||
    str.includes('econnreset') ||
    str.includes('503') ||
    str.includes('502') ||
    str.includes('504') ||
    str.includes('429')
  );
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Resilient fetch wrapper with:
 * - 60s timeout support to allow cold Render instances to spin up
 * - Exponential backoff retry (at least 3 attempts)
 * - Standardized JSON & CORS request headers
 * - Graceful error formatting
 */
export async function fetchWithRetry(
  pathOrUrl: string,
  options: RequestOptions = {}
): Promise<Response> {
  const url = pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')
    ? pathOrUrl
    : getApiUrl(pathOrUrl);

  const maxRetries = options.retries !== undefined ? options.retries : DEFAULT_RETRIES;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const userId = getClientId();

  const standardHeaders: Record<string, string> = {
    Accept: 'application/json',
    'x-user-id': userId,
  };

  // Add Content-Type if there's a body and method is not GET
  if (options.body && options.method && options.method.toUpperCase() !== 'GET') {
    standardHeaders['Content-Type'] = 'application/json';
  }

  const mergedHeaders = {
    ...standardHeaders,
    ...(options.headers as Record<string, string> || {}),
  };

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (attempt > 0 && !options.silent) {
        console.log(`[API Client] Retrying request to ${url} (Attempt ${attempt}/${maxRetries})...`);
      }

      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // If response is OK or a permanent client error (400, 401, 403, 404, 402), return it immediately
      if (response.ok || (response.status < 500 && response.status !== 429 && response.status !== 408)) {
        return response;
      }

      // If server returned 502/503/504 or 429, retry
      if (attempt < maxRetries && isTransientError(response.status)) {
        const backoff = Math.min(10000, Math.pow(2, attempt) * 1200 + Math.floor(Math.random() * 500));
        if (options.onRetry) {
          options.onRetry(attempt + 1, maxRetries, backoff, `HTTP ${response.status}`);
        }
        await delay(backoff);
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;

      const isTimeout = err?.name === 'AbortError' || String(err).includes('aborted');
      const errDetail = isTimeout ? `Request timed out after ${timeoutMs}ms` : (err?.message || String(err));

      if (!options.silent) {
        console.warn(`[API Client] Network call to ${url} failed (Attempt ${attempt + 1}/${maxRetries + 1}):`, errDetail);
      }

      if (attempt < maxRetries && (isTransientError(err) || isTimeout)) {
        const backoff = Math.min(12000, Math.pow(2, attempt) * 1500 + Math.floor(Math.random() * 600));
        if (options.onRetry) {
          options.onRetry(attempt + 1, maxRetries, backoff, errDetail);
        }
        await delay(backoff);
        continue;
      }

      // If retries exhausted and silent is requested
      if (options.silent) {
        return new Response(JSON.stringify({ offline: true, error: errDetail }), {
          status: 503,
          statusText: 'Service Unavailable (Offline Fallback)',
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(errDetail);
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts.`);
}

/**
 * Background wake-up ping for Render instances.
 * Free Render instances sleep when inactive; calling this early warms the instance up.
 */
let wakeUpPromise: Promise<boolean> | null = null;

export function wakeBackendServer(): Promise<boolean> {
  if (wakeUpPromise) return wakeUpPromise;

  wakeUpPromise = (async () => {
    try {
      const res = await fetchWithRetry('/api/health', {
        method: 'GET',
        timeoutMs: 30000,
        retries: 2,
        silent: true,
      });
      return res.ok;
    } catch {
      return false;
    }
  })();

  return wakeUpPromise;
}

export default {
  fetchWithRetry,
  wakeBackendServer,
  isTransientError,
};
