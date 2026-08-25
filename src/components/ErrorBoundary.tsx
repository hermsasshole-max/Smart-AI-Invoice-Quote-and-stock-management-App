import React, { Component, ErrorInfo, ReactNode } from 'react';
import { debugLogger } from '../utils/debugLogger';
import { AlertOctagon, RefreshCw, Copy, Check, Terminal, Database } from 'lucide-react';

interface Props {
  children: ReactNode;
  onOpenDebugModal?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    debugLogger.log({
      level: 'error',
      category: 'REACT_ERROR_BOUNDARY',
      message: error.message || 'React render-tree exception caught',
      stack: error.stack,
      data: {
        componentStack: errorInfo.componentStack,
      },
    });

    console.error('[ErrorBoundary caught exception]:', error, errorInfo);
  }

  private handleCopyError = async () => {
    const errorDetails = {
      timestamp: new Date().toISOString(),
      name: this.state.error?.name,
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      recentLogs: debugLogger.getLogs().slice(0, 15),
    };

    const success = await navigator.clipboard
      .writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => true)
      .catch(() => false);

    if (success) {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    if (window.confirm('Reset local application storage to clean sample state?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0E1017] text-white flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-2xl w-full bg-[#1B1E28] border border-red-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 shrink-0">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  Application Runtime Exception
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  A React render boundary caught an unhandled error. Diagnostic logs have been captured in the debug logger.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-4 rounded-xl bg-[#12141C] border border-red-500/20 text-red-300 font-mono text-xs overflow-x-auto space-y-2">
              <div className="font-bold text-red-400">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
              {this.state.error?.stack && (
                <pre className="text-[11px] text-slate-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reload Application</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleResetStorage}
                  className="px-3.5 py-2 rounded-xl bg-[#12141C] hover:bg-[#282E3E] text-slate-300 text-xs font-semibold flex items-center space-x-2 border border-[#334155] cursor-pointer"
                >
                  <Database className="w-4 h-4 text-amber-400" />
                  <span>Reset Storage & Reload</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleCopyError}
                  className="px-3.5 py-2 rounded-xl bg-[#12141C] hover:bg-[#282E3E] text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-[#334155] cursor-pointer"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied Stack Trace!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copy Error Details</span>
                    </>
                  )}
                </button>

                {this.props.onOpenDebugModal && (
                  <button
                    type="button"
                    onClick={this.props.onOpenDebugModal}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center space-x-1.5 border border-amber-500/40 cursor-pointer"
                  >
                    <Terminal className="w-4 h-4" />
                    <span>Open Debug Panel</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
