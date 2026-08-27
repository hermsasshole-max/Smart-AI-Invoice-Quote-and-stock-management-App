import React, { useState, useEffect, useRef } from 'react';
import { debugLogger, DebugLogEntry, LogLevel } from '../utils/debugLogger';
import { useApp } from '../context/AppContext';
import { getApiUrl, API_BASE_URL } from '../config/api';
import {
  Terminal,
  Bug,
  AlertCircle,
  AlertTriangle,
  Info,
  Globe,
  Database,
  Copy,
  Check,
  Download,
  Trash2,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Activity,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'logs' | 'network' | 'state' | 'diagnostics';

export const DebugModal: React.FC<DebugModalProps> = ({ isOpen, onClose }) => {
  const { profile, clients, inventory, quotes, invoices, sunlightMode } = useApp();

  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isTestingHealth, setIsTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to log updates
  useEffect(() => {
    const unsubscribe = debugLogger.subscribe((updatedLogs) => {
      setLogs([...updatedLogs]);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll when logs update
  useEffect(() => {
    if (autoScroll && activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, activeTab]);

  // Keyboard shortcut: Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Active state snapshot to attach to logs
  const appStateSnapshot = {
    profile: {
      companyName: profile.companyName,
      vatNumber: profile.vatNumber,
      currency: 'ZAR (R)',
      defaultMarkup: profile.defaultMarkup,
      defaultLabourRate: profile.defaultLabourRate,
      defaultCalloutFee: profile.defaultCalloutFee,
      defaultTravelRate: profile.defaultTravelRate,
    },
    counts: {
      clients: clients.length,
      inventory: inventory.length,
      quotes: quotes.length,
      invoices: invoices.length,
    },
    sunlightMode,
    storage: {
      quotesBytes: (localStorage.getItem('harrys_quotes') || '').length,
      invoicesBytes: (localStorage.getItem('harrys_invoices') || '').length,
      inventoryBytes: (localStorage.getItem('harrys_inventory') || '').length,
    },
    system: {
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      time: new Date().toISOString(),
    },
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    if (!matchesLevel) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(q) ||
      log.category.toLowerCase().includes(q) ||
      (log.url && log.url.toLowerCase().includes(q)) ||
      (log.status && String(log.status).includes(q)) ||
      (log.method && log.method.toLowerCase().includes(q))
    );
  });

  const networkLogs = logs.filter((l) => l.level === 'network' || l.category.startsWith('API_') || l.url);

  const errorCount = debugLogger.getErrorCount();
  const networkCount = networkLogs.length;

  const handleCopyLogs = async () => {
    const success = await debugLogger.copyLogsToClipboard(appStateSnapshot);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleExportJson = () => {
    const jsonStr = debugLogger.exportLogsAsJson(appStateSnapshot);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportText = () => {
    const textStr = debugLogger.exportLogsAsText(appStateSnapshot);
    const blob = new Blob([textStr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTestHealth = async () => {
    setIsTestingHealth(true);
    setHealthStatus(`Pinging health endpoint at ${getApiUrl('/api/health')}...`);
    try {
      const startTime = performance.now();
      const res = await fetch(getApiUrl('/api/health'));
      const duration = Math.round(performance.now() - startTime);
      const data = await res.json();
      setHealthStatus(`200 OK (${duration}ms): ${JSON.stringify(data)}`);
    } catch (err: any) {
      setHealthStatus(`Health Check Error: ${err.message}`);
    } finally {
      setIsTestingHealth(false);
    }
  };

  const handleSimulateScanError = async () => {
    debugLogger.log({
      level: 'info',
      category: 'TEST_DIAGNOSTIC',
      message: 'Triggering mock scan request to verify 503 retry interceptor...',
    });

    try {
      await fetch(getApiUrl('/api/scan-receipt'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: 'mock_invalid_short_test_payload',
          mimeType: 'image/jpeg',
        }),
      });
    } catch (err: any) {
      console.warn('Simulated test error completed:', err);
    }
  };

  const getStatusBadge = (status?: number) => {
    if (!status) return null;
    if (status >= 200 && status < 300) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          {status} OK
        </span>
      );
    }
    if (status === 429) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          429 RATE LIMIT
        </span>
      );
    }
    if (status === 503) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
          503 BUSY
        </span>
      );
    }
    if (status >= 400) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
          {status} ERROR
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">
        {status}
      </span>
    );
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      case 'network':
        return <Globe className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />;
      case 'state':
        return <Database className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 font-sans animate-in fade-in duration-150">
      <div
        className={`modal-container relative w-full bg-[#12141C] border border-[#282E3E] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isFullScreen ? 'h-[98vh] max-w-[98vw]' : 'max-w-5xl h-[88vh]'
        }`}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#181B26] border-b border-[#282E3E] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Application Debug & Diagnostic Panel
                </h2>
                {errorCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                    {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Healthy
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Real-time API interceptor, unhandled exception monitor & system state inspector
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Copy Logs Action */}
            <button
              type="button"
              onClick={handleCopyLogs}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all cursor-pointer active:scale-95"
              title="Copy formatted JSON debug logs and app state to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-200">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  <span>Copy Logs</span>
                </>
              )}
            </button>

            {/* Toggle Full Screen */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#282E3E] transition-all cursor-pointer hidden sm:inline-flex"
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#282E3E] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-[#151722] border-b border-[#282E3E] shrink-0 text-xs">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E2230]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console & API Logs ({logs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('network')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'network'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E2230]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Network Requests ({networkCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('state')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'state'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E2230]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>App State Snapshot</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('diagnostics')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'diagnostics'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E2230]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Diagnostic Tests</span>
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="px-2.5 py-1 rounded bg-[#1B1E28] hover:bg-[#282E3E] text-slate-300 hover:text-white border border-[#334155] text-[11px] font-mono flex items-center space-x-1 cursor-pointer"
              title="Download full JSON log artifact"
            >
              <Download className="w-3 h-3" />
              <span>Export .JSON</span>
            </button>

            <button
              type="button"
              onClick={handleExportText}
              className="px-2.5 py-1 rounded bg-[#1B1E28] hover:bg-[#282E3E] text-slate-300 hover:text-white border border-[#334155] text-[11px] font-mono flex items-center space-x-1 cursor-pointer"
              title="Download formatted text log"
            >
              <Download className="w-3 h-3" />
              <span>Export .TXT</span>
            </button>

            <button
              type="button"
              onClick={() => debugLogger.clearLogs()}
              className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-mono flex items-center space-x-1 cursor-pointer"
              title="Clear in-memory logs"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Console & Execution Logs */}
        {activeTab === 'logs' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0D0E15]">
            {/* Filter & Search Bar */}
            <div className="p-3 bg-[#151722] border-b border-[#282E3E] flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedLevel('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    selectedLevel === 'all'
                      ? 'bg-slate-200 text-slate-900 font-bold'
                      : 'bg-[#1B1E28] text-slate-400 hover:text-slate-200 border border-[#334155]'
                  }`}
                >
                  All ({logs.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLevel('error')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    selectedLevel === 'error'
                      ? 'bg-red-500 text-white font-bold'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                  }`}
                >
                  Errors ({errorCount})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLevel('network')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    selectedLevel === 'network'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20'
                  }`}
                >
                  Network ({networkCount})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLevel('warn')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    selectedLevel === 'warn'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  Warnings
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLevel('info')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    selectedLevel === 'info'
                      ? 'bg-indigo-500 text-white font-bold'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20'
                  }`}
                >
                  Info
                </button>
              </div>

              <div className="flex items-center space-x-3 flex-1 max-w-xs ml-auto">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs or status code..."
                    className="w-full pl-8 pr-3 py-1 rounded-lg bg-[#1B1E28] border border-[#334155] text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <label className="flex items-center space-x-1.5 text-slate-400 text-xs font-mono cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded border-[#334155] text-sky-500 focus:ring-0"
                  />
                  <span>Auto-scroll</span>
                </label>
              </div>
            </div>

            {/* Logs List View */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
                  <Terminal className="w-10 h-10 stroke-1 opacity-50" />
                  <p>No log records matching current filter criteria.</p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const hasDetails =
                    Boolean(log.requestPayload) ||
                    Boolean(log.responsePayload) ||
                    Boolean(log.stack) ||
                    Boolean(log.data) ||
                    Boolean(log.url);

                  return (
                    <div
                      key={log.id}
                      className={`rounded-xl border transition-all ${
                        log.level === 'error'
                          ? 'bg-red-950/20 border-red-500/30'
                          : log.level === 'warn'
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : log.level === 'network'
                          ? 'bg-sky-950/20 border-sky-500/30'
                          : 'bg-[#151722] border-[#282E3E]'
                      }`}
                    >
                      {/* Summary Row */}
                      <div
                        onClick={() => hasDetails && setExpandedLogId(isExpanded ? null : log.id)}
                        className={`p-2.5 flex items-start justify-between gap-3 ${
                          hasDetails ? 'cursor-pointer hover:bg-white/5' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-2.5 flex-1 min-w-0">
                          {getLevelIcon(log.level)}

                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] text-slate-500">{log.timeFormatted}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  log.level === 'error'
                                    ? 'bg-red-500/20 text-red-400'
                                    : log.level === 'warn'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : log.level === 'network'
                                    ? 'bg-sky-500/20 text-sky-400'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {log.category}
                              </span>

                              {getStatusBadge(log.status)}

                              {log.durationMs !== undefined && (
                                <span className="text-[10px] text-slate-400">⚡ {log.durationMs}ms</span>
                              )}
                            </div>

                            <p
                              className={`text-xs break-all leading-relaxed ${
                                log.level === 'error'
                                  ? 'text-red-300 font-semibold'
                                  : log.level === 'warn'
                                  ? 'text-amber-300'
                                  : log.level === 'network'
                                  ? 'text-sky-300'
                                  : 'text-slate-200'
                              }`}
                            >
                              {log.message}
                            </p>
                          </div>
                        </div>

                        {hasDetails && (
                          <button
                            type="button"
                            className="p-1 rounded text-slate-400 hover:text-white shrink-0 mt-0.5"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Expanded Details Section */}
                      {isExpanded && hasDetails && (
                        <div className="p-3 border-t border-[#282E3E] bg-[#0E1017] space-y-3 text-[11px]">
                          {/* Endpoint / Method */}
                          {log.url && (
                            <div>
                              <span className="text-slate-400 font-bold block mb-0.5">REQUEST URL:</span>
                              <div className="p-2 rounded-lg bg-[#151722] border border-[#282E3E] text-sky-400 select-all">
                                {log.method || 'GET'} {log.url}
                              </div>
                            </div>
                          )}

                          {/* Request Payload */}
                          {log.requestPayload && (
                            <div>
                              <span className="text-slate-400 font-bold block mb-0.5">REQUEST PAYLOAD:</span>
                              <pre className="p-2.5 rounded-lg bg-[#151722] border border-[#282E3E] text-slate-300 overflow-x-auto select-all max-h-48">
                                {JSON.stringify(log.requestPayload, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Response Payload */}
                          {log.responsePayload && (
                            <div>
                              <span className="text-slate-400 font-bold block mb-0.5">RESPONSE BODY:</span>
                              <pre
                                className={`p-2.5 rounded-lg border overflow-x-auto select-all max-h-56 ${
                                  log.status && log.status >= 400
                                    ? 'bg-red-950/30 border-red-500/30 text-red-300'
                                    : 'bg-[#151722] border-[#282E3E] text-emerald-300'
                                }`}
                              >
                                {typeof log.responsePayload === 'object'
                                  ? JSON.stringify(log.responsePayload, null, 2)
                                  : log.responsePayload}
                              </pre>
                            </div>
                          )}

                          {/* Error Stack Trace */}
                          {log.stack && (
                            <div>
                              <span className="text-red-400 font-bold block mb-0.5">STACK TRACE:</span>
                              <pre className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/40 text-red-300 overflow-x-auto select-all whitespace-pre-wrap max-h-48">
                                {log.stack}
                              </pre>
                            </div>
                          )}

                          {/* Additional Metadata */}
                          {log.data && (
                            <div>
                              <span className="text-slate-400 font-bold block mb-0.5">EXTRA DATA:</span>
                              <pre className="p-2.5 rounded-lg bg-[#151722] border border-[#282E3E] text-slate-300 overflow-x-auto select-all max-h-40">
                                {JSON.stringify(log.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Tab 2: Network Requests Inspector */}
        {activeTab === 'network' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0D0E15]">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">
                Captured {networkLogs.length} HTTP request{networkLogs.length === 1 ? '' : 's'} via global fetch interceptor
              </span>
              <span className="text-[11px] text-emerald-400">● Live Interception Active</span>
            </div>

            {networkLogs.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Globe className="w-10 h-10 stroke-1 opacity-50" />
                <p className="text-xs font-mono">No API network requests made yet in this session.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {networkLogs.map((req, idx) => (
                  <div
                    key={req.id || idx}
                    className="p-3 rounded-xl bg-[#151722] border border-[#282E3E] space-y-2 font-mono text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold text-[11px]">
                          {req.method || 'GET'}
                        </span>
                        <span className="text-white font-bold">{req.url || req.message}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(req.status)}
                        {req.durationMs !== undefined && (
                          <span className="text-slate-400 text-[11px]">{req.durationMs}ms</span>
                        )}
                        <span className="text-slate-500 text-[10px]">{req.timeFormatted}</span>
                      </div>
                    </div>

                    {req.responsePayload && (
                      <div className="mt-2">
                        <span className="text-[10px] text-slate-500 uppercase block mb-1">Response JSON:</span>
                        <pre className="p-2 rounded-lg bg-[#0E1017] border border-[#282E3E] text-slate-300 text-[11px] overflow-x-auto max-h-36">
                          {typeof req.responsePayload === 'object'
                            ? JSON.stringify(req.responsePayload, null, 2)
                            : req.responsePayload}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: App State Snapshot */}
        {activeTab === 'state' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#0D0E15]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Clients Registered</span>
                <div className="text-2xl font-bold text-white">{clients.length}</div>
              </div>

              <div className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Inventory Items</span>
                <div className="text-2xl font-bold text-sky-400">{inventory.length}</div>
              </div>

              <div className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Active Quotes</span>
                <div className="text-2xl font-bold text-amber-400">{quotes.length}</div>
              </div>

              <div className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Invoices Issued</span>
                <div className="text-2xl font-bold text-emerald-400">{invoices.length}</div>
              </div>
            </div>

            {/* Detailed State JSON viewer */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300 font-mono uppercase">Full Serialized State:</span>
                <span className="text-slate-500 font-mono text-[11px]">Clean JSON Snapshot</span>
              </div>

              <pre className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] text-slate-300 text-xs font-mono overflow-x-auto max-h-96 select-all">
                {JSON.stringify(appStateSnapshot, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 4: Diagnostic Tests */}
        {activeTab === 'diagnostics' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#0D0E15]">
            <div className="space-y-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <span>Runtime Verification & API Health Tools</span>
              </h3>
              <p className="text-xs text-slate-400">
                Trigger explicit health checks and mock failure states to test logger interceptor and UI resilience.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Test 1: Server Health Check */}
              <div className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] space-y-3">
                <div>
                  <h4 className="font-bold text-white text-xs">1. Ping /api/health</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Verifies Express server connectivity, latency, and JSON serialization.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestHealth}
                  disabled={isTestingHealth}
                  className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingHealth ? 'animate-spin' : ''}`} />
                  <span>{isTestingHealth ? 'Pinging...' : 'Send Health Ping'}</span>
                </button>

                {healthStatus && (
                  <div className="p-2.5 rounded-lg bg-[#0E1017] border border-[#282E3E] text-slate-300 text-xs font-mono break-all">
                    {healthStatus}
                  </div>
                )}
              </div>

              {/* Test 2: Simulate OCR Request */}
              <div className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] space-y-3">
                <div>
                  <h4 className="font-bold text-white text-xs">2. Test API Interceptor & Logger</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Dispatches a lightweight payload to /api/scan-receipt and traces full lifecycle in the debug tab.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateScanError}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Trigger Test OCR Request</span>
                </button>
              </div>
            </div>

            {/* System Info Card */}
            <div className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] space-y-2 text-xs font-mono text-slate-300">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Client Environment Specs:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <strong className="text-white">Online Status:</strong>{' '}
                  <span className={navigator.onLine ? 'text-emerald-400' : 'text-red-400'}>
                    {navigator.onLine ? 'CONNECTED (Online)' : 'OFFLINE'}
                  </span>
                </div>
                <div>
                  <strong className="text-white">Screen Viewport:</strong> {window.innerWidth} x {window.innerHeight}
                </div>
                <div className="sm:col-span-2 break-all">
                  <strong className="text-white">User-Agent:</strong> {navigator.userAgent}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Bottom Footer */}
        <div className="px-4 sm:px-6 py-3 bg-[#181B26] border-t border-[#282E3E] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-2">
            <span>
              Total Logs: <strong className="text-white">{logs.length}</strong>
            </span>
            <span>•</span>
            <span className="text-red-400">
              Errors: <strong>{errorCount}</strong>
            </span>
            <span>•</span>
            <span className="text-sky-400">
              Network: <strong>{networkCount}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyLogs}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Copied All Logs!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white" />
                  <span>Copy Logs (JSON)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 font-semibold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
