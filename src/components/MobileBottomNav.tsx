import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  Package,
  Mic,
  Scan,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openVoiceQuote: () => void;
  openReceiptScanner: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  openVoiceQuote,
  openReceiptScanner,
}) => {
  const { sunlightMode } = useApp();

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 md:hidden border-t shadow-2xl transition-colors pb-[env(safe-area-inset-bottom,0px)] ${
        sunlightMode
          ? 'bg-white/95 backdrop-blur-md border-slate-300 text-slate-800'
          : 'bg-[#12141D]/95 backdrop-blur-md border-[#252B3D] text-slate-200'
      }`}
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto relative">
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Dashboard</span>
        </button>

        {/* 2. Inventory & Stock */}
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 transition-all cursor-pointer ${
            activeTab === 'inventory'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Stock</span>
        </button>

        {/* 3. Center Hero Voice FAB */}
        <div className="relative -top-5 flex flex-col items-center justify-center px-1">
          <button
            type="button"
            onClick={openVoiceQuote}
            className="w-14 h-14 min-w-[48px] min-h-[48px] rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-orange-500 text-slate-950 flex flex-col items-center justify-center shadow-lg shadow-amber-500/40 border-4 border-[#0E1017] active:scale-95 transition-transform cursor-pointer"
            title="Voice-to-Quote & Job Engine"
          >
            <Mic className="w-6 h-6 text-slate-950 animate-pulse" />
          </button>
          <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider mt-0.5">
            Voice Quote
          </span>
        </div>

        {/* 4. Scan Counter Slip */}
        <button
          type="button"
          onClick={openReceiptScanner}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 transition-all cursor-pointer text-slate-400 hover:text-amber-400"
        >
          <Scan className="w-5 h-5 mb-0.5 text-sky-400" />
          <span className="text-[10px] tracking-tight">Scan Slip</span>
        </button>

        {/* 5. Clients CRM */}
        <button
          type="button"
          onClick={() => setActiveTab('clients')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 transition-all cursor-pointer ${
            activeTab === 'clients'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Clients</span>
        </button>
      </div>
    </div>
  );
};
