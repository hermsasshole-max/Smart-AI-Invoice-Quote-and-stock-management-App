/**
 * Comprehensive Debug Logging & Instrumentation Engine
 * Intercepts Network Requests, Catches Unhandled Errors, Tracks State Updates,
 * and maintains an in-memory buffer with export/copy capabilities.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'network' | 'state';

export interface DebugLogEntry {
  id: string;
  timestamp: string;
  timeFormatted: string;
  level: LogLevel;
  category: string;
  message: string;
  status?: number;
  statusText?: string;
  method?: string;
  url?: string;
  durationMs?: number;
  requestPayload?: any;
  responsePayload?: any;
  stack?: string;
  data?: any;
}

type LogListener = (logs: DebugLogEntry[]) => void;

class DebugLogger {
  private logs: DebugLogEntry[] = [];
  private maxLogs = 250;
  private listeners: Set<LogListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Intercept Global Fetch for detailed Network Debugging
    this.setupFetchInterceptor();

    // 2. Global Uncaught Exception Listeners
    window.addEventListener('error', (event) => {
      this.log({
        level: 'error',
        category: 'UNHANDLED_EXCEPTION',
        message: event.message || 'Uncaught window error',
        stack: event.error?.stack,
        data: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.log({
        level: 'error',
        category: 'UNHANDLED_PROMISE_REJECTION',
        message: typeof reason === 'string' ? reason : reason?.message || 'Unhandled Promise Rejection',
        stack: reason?.stack,
        data: typeof reason === 'object' ? this.sanitizeObject(reason) : { reason },
      });
    });

    this.log({
      level: 'info',
      category: 'SYSTEM_BOOT',
      message: 'Debugger & API Interceptor initialized successfully',
      data: {
        userAgent: navigator.userAgent,
        screen: `${window.innerWidth}x${window.innerHeight}`,
        online: navigator.onLine,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private setupFetchInterceptor() {
    if (typeof window === 'undefined' || !window.fetch) return;

    try {
      const originalFetch = window.fetch.bind(window);

      const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const startTime = performance.now();
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        let sanitizedPayload: any = undefined;
        if (init?.body) {
          try {
            if (typeof init.body === 'string') {
              const parsed = JSON.parse(init.body);
              sanitizedPayload = this.sanitizeObject(parsed);
            } else {
              sanitizedPayload = '[Non-string Request Body]';
            }
          } catch {
            sanitizedPayload = typeof init.body === 'string' ? init.body.slice(0, 300) : '[Binary Data]';
          }
        }

        // Log request dispatch
        console.log(`[API REQUEST] ${method} ${url}`, {
          payload: sanitizedPayload,
          headers: init?.headers,
        });

        try {
          const response = await originalFetch(input, init);
          const durationMs = Math.round(performance.now() - startTime);
          const status = response.status;
          const statusText = response.statusText;

          // Clone response to safely read text for debugging without disturbing the app
          let responseBody: any = null;
          try {
            const clone = response.clone();
            const text = await clone.text();
            try {
              responseBody = JSON.parse(text);
              responseBody = this.sanitizeObject(responseBody);
            } catch {
              responseBody = text.slice(0, 1000);
            }
          } catch (readErr) {
            responseBody = `[Unable to read response body: ${readErr}]`;
          }

          const isError = status >= 400;
          const level: LogLevel = isError ? 'error' : 'network';

          this.log({
            level,
            category: isError ? 'API_HTTP_ERROR' : 'API_HTTP_SUCCESS',
            message: `${method} ${url} → ${status} ${statusText} (${durationMs}ms)`,
            status,
            statusText,
            method,
            url,
            durationMs,
            requestPayload: sanitizedPayload,
            responsePayload: responseBody,
          });

          if (isError) {
            console.error(`[API ERROR ${status}] ${method} ${url}`, {
              status,
              statusText,
              durationMs,
              requestPayload: sanitizedPayload,
              response: responseBody,
            });
          } else {
            console.log(`[API SUCCESS ${status}] ${method} ${url} in ${durationMs}ms`, {
              response: responseBody,
            });
          }

          return response;
        } catch (networkError: any) {
          const durationMs = Math.round(performance.now() - startTime);
          const errorMessage = networkError?.message || 'Network request failed';

          this.log({
            level: 'error',
            category: 'API_NETWORK_FAILURE',
            message: `${method} ${url} FAILED after ${durationMs}ms: ${errorMessage}`,
            method,
            url,
            durationMs,
            requestPayload: sanitizedPayload,
            stack: networkError?.stack,
            data: {
              errorName: networkError?.name,
              errorMessage,
            },
          });

          console.error(`[NETWORK EXCEPTION] ${method} ${url}`, networkError);
          throw networkError;
        }
      };

      // Safely apply fetch interceptor across different browser & iframe security models
      try {
        window.fetch = customFetch;
      } catch {
        try {
          Object.defineProperty(window, 'fetch', {
            value: customFetch,
            writable: true,
            configurable: true,
          });
        } catch {
          try {
            const proto = Object.getPrototypeOf(window);
            if (proto) {
              Object.defineProperty(proto, 'fetch', {
                value: customFetch,
                writable: true,
                configurable: true,
              });
            }
          } catch (patchErr) {
            console.warn('[DebugLogger] Could not monkeypatch global fetch:', patchErr);
          }
        }
      }
    } catch (err) {
      console.warn('[DebugLogger] setupFetchInterceptor failed:', err);
    }
  }

  // Sanitizes objects, redacting secrets, keys, and truncating large base64 strings
  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.slice(0, 50).map((item) => this.sanitizeObject(item));
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Redact sensitive keys
      if (
        lowerKey.includes('key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('auth')
      ) {
        cleaned[key] = typeof value === 'string' && value.length > 6
          ? `${value.slice(0, 3)}...${value.slice(-3)} [REDACTED]`
          : '[REDACTED]';
        continue;
      }

      // Truncate large base64 strings
      if (typeof value === 'string' && value.length > 200) {
        if (value.startsWith('data:image') || value.startsWith('/9j/') || lowerKey.includes('base64') || lowerKey.includes('image')) {
          cleaned[key] = `[Base64 Image Data: ${value.length.toLocaleString()} characters, snippet: ${value.slice(0, 32)}...]`;
          continue;
        }
        cleaned[key] = `${value.slice(0, 200)}... [truncated, total ${value.length} chars]`;
        continue;
      }

      if (typeof value === 'object') {
        cleaned[key] = this.sanitizeObject(value);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  public log(entry: {
    level: LogLevel;
    category: string;
    message: string;
    status?: number;
    statusText?: string;
    method?: string;
    url?: string;
    durationMs?: number;
    requestPayload?: any;
    responsePayload?: any;
    stack?: string;
    data?: any;
  }) {
    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    const logItem: DebugLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: now.toISOString(),
      timeFormatted,
      level: entry.level,
      category: entry.category,
      message: entry.message,
      status: entry.status,
      statusText: entry.statusText,
      method: entry.method,
      url: entry.url,
      durationMs: entry.durationMs,
      requestPayload: entry.requestPayload,
      responsePayload: entry.responsePayload,
      stack: entry.stack,
      data: entry.data,
    };

    this.logs.unshift(logItem);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.notifyListeners();
  }

  public getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.notifyListeners();
    this.log({
      level: 'info',
      category: 'DEBUG_LOGGER',
      message: 'Debug logs buffer cleared by user',
    });
  }

  public getErrorCount(): number {
    return this.logs.filter((l) => l.level === 'error').length;
  }

  public getNetworkCount(): number {
    return this.logs.filter((l) => l.level === 'network' || l.category.startsWith('API_')).length;
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const logsCopy = this.getLogs();
    this.listeners.forEach((listener) => {
      try {
        listener(logsCopy);
      } catch (err) {
        console.error('Error in debug log listener:', err);
      }
    });
  }

  public exportLogsAsJson(appStateSnapshot?: any): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      onlineStatus: typeof navigator !== 'undefined' ? navigator.onLine : true,
      errorCount: this.getErrorCount(),
      totalLogs: this.logs.length,
      appStateSnapshot: appStateSnapshot ? this.sanitizeObject(appStateSnapshot) : undefined,
      logs: this.logs,
    };
    return JSON.stringify(exportData, null, 2);
  }

  public exportLogsAsText(appStateSnapshot?: any): string {
    const lines: string[] = [];
    lines.push('================================================================');
    lines.push(`HARRY'S AIRCON & ELECTRICAL - DEBUG EXECUTION LOG`);
    lines.push(`Exported At: ${new Date().toISOString()}`);
    lines.push(`Total Entries: ${this.logs.length} | Errors: ${this.getErrorCount()}`);
    lines.push(`Device: ${navigator.userAgent}`);
    lines.push('================================================================\n');

    if (appStateSnapshot) {
      lines.push('--- ACTIVE APP STATE SNAPSHOT ---');
      lines.push(JSON.stringify(this.sanitizeObject(appStateSnapshot), null, 2));
      lines.push('\n----------------------------------------------------------------\n');
    }

    lines.push('--- RECENT EXECUTION & API LOGS (Newest First) ---');
    this.logs.forEach((log, index) => {
      lines.push(`[#${index + 1}] [${log.timeFormatted}] [${log.level.toUpperCase()}] [${log.category}]`);
      lines.push(`Message: ${log.message}`);
      if (log.status !== undefined) lines.push(`HTTP Status: ${log.status} ${log.statusText || ''}`);
      if (log.durationMs !== undefined) lines.push(`Duration: ${log.durationMs}ms`);
      if (log.url) lines.push(`Endpoint: ${log.method || 'GET'} ${log.url}`);
      if (log.requestPayload) lines.push(`Request Payload: ${JSON.stringify(log.requestPayload, null, 2)}`);
      if (log.responsePayload) lines.push(`Response Body: ${JSON.stringify(log.responsePayload, null, 2)}`);
      if (log.stack) lines.push(`Stack Trace:\n${log.stack}`);
      if (log.data) lines.push(`Data: ${JSON.stringify(log.data, null, 2)}`);
      lines.push('----------------------------------------------------------------');
    });

    return lines.join('\n');
  }

  public async copyLogsToClipboard(appStateSnapshot?: any): Promise<boolean> {
    try {
      const json = this.exportLogsAsJson(appStateSnapshot);
      await navigator.clipboard.writeText(json);
      return true;
    } catch (err) {
      console.warn('Clipboard write failed, trying fallback textarea:', err);
      try {
        const textArea = document.createElement('textarea');
        textArea.value = this.exportLogsAsJson(appStateSnapshot);
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      } catch (fallbackErr) {
        console.error('All clipboard copy attempts failed:', fallbackErr);
        return false;
      }
    }
  }
}

export const debugLogger = new DebugLogger();
