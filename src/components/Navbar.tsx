import React from 'react';
import { useApp } from '../context/AppContext';
import { formatZAR } from '../utils/calculator';
import {
  Zap,
  FileText,
  ScanLine,
  Receipt,
  Package,
  Users,
  Database,
  Settings,
  Sun,
  Flame,
  ShieldCheck,
  Activity,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, sunlightMode, setSunlightMode, profile, lowStockItems, invoices } = useApp();

  // Quick live metric for top bar
  const totalPaidRevenue = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);

  interface NavItem {
    id: 'dashboard' | 'quotes' | 'invoices' | 'scanner' | 'inventory' | 'clients' | 'schema' | 'settings';
    label: string;
    icon: any;
    highlight?: boolean;
    badge?: number;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'DASHBOARD', icon: Zap },
    { id: 'quotes', label: 'FAST QUOTE', icon: FileText },
    { id: 'invoices', label: 'INVOICES & JOBS', icon: Receipt },
    { id: 'scanner', label: 'GEMINI OCR SCANNER', icon: ScanLine, highlight: true },
    { id: 'inventory', label: 'ZAR PRICE BOOK', icon: Package, badge: lowStockItems.length > 0 ? lowStockItems.length : undefined },
    { id: 'clients', label: 'CLIENTS DIRECTORY', icon: Users },
    { id: 'schema', label: 'SQLITE / ROOM DDL', icon: Database },
    { id: 'settings', label: 'SETTINGS & RATES', icon: Settings },
  ];

  return (
    <header
      className={`border-b sticky top-0 z-40 ${
        sunlightMode
          ? 'bg-black border-amber-400 text-white'
          : 'bg-[#151619] border-[#2D2D30] text-[#E0E0E0]'
      }`}
    >
      {/* Top Main Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Company Title */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-10 h-10 rounded bg-[#FF6321] flex items-center justify-center shadow-lg shadow-[#FF632144] font-bold text-black border border-[#FF8248]">
              <Flame className="w-6 h-6 text-black" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-base md:text-lg uppercase tracking-tighter text-[#FF6321] group-hover:text-[#ff7d45] transition-colors">
                  {profile.companyName}
                </h1>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1A1A1C] text-[#00FF41] border border-[#2D2D30]">
                  ZAR (R) • 15% VAT
                </span>
              </div>
              <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest text-[#E0E0E0]">
                Field Service Management v2.4 // South Africa
              </p>
            </div>
          </div>

          {/* Right Action Badges & Telemetry status */}
          <div className="flex items-center space-x-3">
            {/* Live Revenue Metric */}
            <div className="hidden lg:block text-right pr-2 border-r border-[#2D2D30]">
              <p className="text-[10px] uppercase opacity-50 font-bold tracking-wider font-mono">Settled Revenue</p>
              <p className="text-base font-mono text-[#00FF41] font-bold">{formatZAR(totalPaidRevenue)}</p>
            </div>

            {/* Offline SQLite Status Card */}
            <div className="hidden sm:flex bg-[#1A1A1C] px-3 py-1.5 rounded border border-[#2D2D30] items-center space-x-2.5">
              <div className="w-2 h-2 rounded-full bg-[#00FF41] shadow-[0_0_8px_#00FF41] animate-pulse"></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-[#707070] leading-none">System Status</span>
                <span className="text-[11px] font-mono uppercase text-[#00FF41] font-bold">Offline-Sync Active</span>
              </div>
            </div>

            {/* High-Sunlight Contrast Mode Button */}
            <button
              id="btn-sunlight-toggle"
              onClick={() => setSunlightMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded text-xs font-bold font-mono uppercase flex items-center space-x-1.5 transition-all border ${
                sunlightMode
                  ? 'bg-amber-400 text-black border-amber-300 shadow-md font-extrabold ring-2 ring-amber-300'
                  : 'bg-[#1A1A1C] text-[#E0E0E0] border-[#2D2D30] hover:bg-[#252528] hover:border-[#3D3D40]'
              }`}
              title="Toggle ultra-high contrast outdoor sunlight mode"
            >
              {sunlightMode ? (
                <>
                  <Sun className="w-4 h-4 text-black animate-spin-slow" />
                  <span>SUNLIGHT: ON</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-[#FF6321]" />
                  <span>Sunlight Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation Menu (Technical Data Grid tab buttons) */}
        <nav className="mt-3 flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded text-xs font-mono font-bold tracking-wider whitespace-nowrap transition-all flex-shrink-0 relative border ${
                  isActive
                    ? sunlightMode
                      ? 'bg-amber-400 text-black shadow-md border-amber-300'
                      : 'bg-[#FF6321] text-black border-[#FF8248] shadow-md shadow-[#FF632133]'
                    : sunlightMode
                    ? 'text-slate-300 hover:bg-slate-900 hover:text-white border-slate-800'
                    : 'bg-[#111113] text-[#A0A0A5] border-[#2D2D30] hover:bg-[#1A1A1C] hover:text-[#E0E0E0] hover:border-[#3D3D40]'
                } ${item.highlight && !isActive ? 'border-[#FF632166] text-[#FF6321]' : ''}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : item.highlight ? 'text-[#FF6321]' : 'text-[#707070]'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#FF4444] text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
