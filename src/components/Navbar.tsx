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
  Wind,
  Sparkles,
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
    { id: 'scanner', label: 'SMART OCR SCANNER', icon: ScanLine, highlight: true },
    { id: 'inventory', label: 'STOCK & INVENTORY', icon: Package, badge: lowStockItems.length > 0 ? lowStockItems.length : undefined },
    { id: 'clients', label: 'CLIENTS DIRECTORY', icon: Users },
    { id: 'schema', label: 'SQLITE DDL / ROOM', icon: Database },
    { id: 'settings', label: 'SETTINGS & RATES', icon: Settings },
  ];

  return (
    <header
      className={`border-b sticky top-0 z-40 transition-colors ${
        sunlightMode
          ? 'bg-black border-amber-400 text-white'
          : 'bg-[#1B1E28] border-[#334155] text-[#F8FAFC]'
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
            {profile.logoUrl && profile.logoUrl.startsWith('data:image/') ? (
              <img
                src={profile.logoUrl}
                alt="Harry's Logo"
                className="w-10 h-10 object-contain rounded bg-white p-1 border border-[#38BDF8]"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#38BDF8] to-[#0284C7] flex items-center justify-center shadow-lg shadow-[#38BDF833] font-bold text-[#1B1E28] border border-[#7DD3FC]">
                <Zap className="w-5 h-5 text-[#1B1E28] fill-current" />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-base md:text-lg uppercase tracking-tight text-[#F8FAFC] group-hover:text-[#38BDF8] transition-colors">
                  {profile.companyName || "HARRY'S AIRCON ELECTRICAL & SOLAR"}
                </h1>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#232838] text-[#38BDF8] border border-[#334155]">
                  ZAR (R) • 15% VAT
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wide truncate max-w-xs sm:max-w-md">
                {profile.tagline || "From Electrical to Aircons, security to automation, we've got you covered"}
              </p>
            </div>
          </div>

          {/* Right Action Badges & Telemetry status */}
          <div className="flex items-center space-x-3">
            {/* Live Revenue Metric */}
            <div className="hidden lg:block text-right pr-3 border-r border-[#334155]">
              <p className="text-[10px] uppercase text-[#94A3B8] font-bold tracking-wider font-mono">Settled Revenue</p>
              <p className="text-base font-mono text-[#38BDF8] font-bold">{formatZAR(totalPaidRevenue)}</p>
            </div>

            {/* Offline SQLite Status Card */}
            <div className="hidden sm:flex bg-[#232838] px-3 py-1.5 rounded-lg border border-[#334155] items-center space-x-2.5">
              <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981] animate-pulse"></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-[#94A3B8] leading-none">Field Data Layer</span>
                <span className="text-[11px] font-mono uppercase text-[#38BDF8] font-bold">Offline SQLite Sync</span>
              </div>
            </div>

            {/* High-Sunlight Contrast Mode Button */}
            <button
              id="btn-sunlight-toggle"
              onClick={() => setSunlightMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono uppercase flex items-center space-x-1.5 transition-all border ${
                sunlightMode
                  ? 'bg-amber-400 text-black border-amber-300 shadow-md font-extrabold ring-2 ring-amber-300'
                  : 'bg-[#232838] text-[#F8FAFC] border-[#334155] hover:bg-[#2D3449] hover:border-[#38BDF866]'
              }`}
              title="Toggle outdoor high-sunlight contrast mode"
            >
              {sunlightMode ? (
                <>
                  <Sun className="w-4 h-4 text-black animate-spin-slow" />
                  <span>SUNLIGHT: ON</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-[#F59E0B]" />
                  <span>Sunlight Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <nav className="mt-3 flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider whitespace-nowrap transition-all flex-shrink-0 relative border ${
                  isActive
                    ? sunlightMode
                      ? 'bg-amber-400 text-black shadow-md border-amber-300'
                      : 'bg-[#38BDF8] text-[#1B1E28] border-[#7DD3FC] shadow-md shadow-[#38BDF844]'
                    : sunlightMode
                    ? 'text-slate-300 hover:bg-slate-900 hover:text-white border-slate-800'
                    : 'bg-[#232838] text-[#94A3B8] border-[#334155] hover:bg-[#2D3449] hover:text-[#F8FAFC] hover:border-[#38BDF844]'
                } ${item.highlight && !isActive ? 'border-[#F59E0B66] text-[#F59E0B]' : ''}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#1B1E28]' : item.highlight ? 'text-[#F59E0B]' : 'text-[#94A3B8]'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#EF4444] text-white">
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

