import React, { useState, useEffect } from 'react';
import { debugLogger } from '../utils/debugLogger';
import { Bug, AlertCircle } from 'lucide-react';

interface DebugFloatingButtonProps {
  onClick: () => void;
}

export const DebugFloatingButton: React.FC<DebugFloatingButtonProps> = ({ onClick }) => {
  const [errorCount, setErrorCount] = useState(0);
  const [logCount, setLogCount] = useState(0);

  useEffect(() => {
    const unsubscribe = debugLogger.subscribe((logs) => {
      setErrorCount(debugLogger.getErrorCount());
      setLogCount(logs.length);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center space-x-2">
      <button
        type="button"
        onClick={onClick}
        className={`group flex items-center space-x-2 px-3 py-2 rounded-full shadow-2xl backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95 border ${
          errorCount > 0
            ? 'bg-red-950/90 border-red-500/60 text-red-300 hover:bg-red-900 shadow-red-500/20'
            : 'bg-[#151722]/90 border-[#334155] text-slate-300 hover:bg-[#1E2230] hover:text-white shadow-black/50'
        }`}
        title="Open Application & API Debugger (Ctrl+Shift+D)"
      >
        <div className="relative">
          <Bug className={`w-4 h-4 ${errorCount > 0 ? 'text-red-400 animate-bounce' : 'text-amber-400'}`} />
          {errorCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          )}
        </div>

        <span className="text-xs font-mono font-bold tracking-wider">DEBUG</span>

        {errorCount > 0 ? (
          <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-slate-950 font-black text-[10px] font-mono">
            {errorCount}
          </span>
        ) : (
          <span className="px-1.5 py-0.2 rounded-full bg-[#282E3E] text-slate-400 font-mono text-[10px]">
            {logCount}
          </span>
        )}
      </button>
    </div>
  );
};
