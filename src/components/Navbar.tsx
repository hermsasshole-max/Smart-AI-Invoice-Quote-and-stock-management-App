import React from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  DollarSign,
  Users,
  Package,
  Scan,
  Settings,
  Sun,
  Moon,
  Zap,
  Flame,
  ShieldAlert,
  Database,
  LayoutDashboard,
  Download,
  Bug,
  Sparkles,
  Crown,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openReceiptScanner: () => void;
  openDebugModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  openReceiptScanner,
  openDebugModal,
}) => {
  const {
    profile,
    sunlightMode,
    toggleSunlightMode,
    isInstallable,
    promptInstall,
    tier,
    entitlements,
    openPaywall,
  } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'quotes', label: 'Fast Quotations', icon: FileText },
    { id: 'invoices', label: 'Invoicing & Payments', icon: DollarSign },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'inventory', label: 'Inventory & Van Stock', icon: Package },
    { id: 'schema', label: 'Cloud SQL Schema', icon: Database },
    { id: 'settings', label: 'Business Profile', icon: Settings },
  ];

  return (
    <header className={`${sunlightMode ? 'bg-[#F8FAFC] border-b-2 border-[#CBD5E1] text-[#0F172A]' : 'bg-[#1B1E28] border-b border-[#282E3E] text-white'} sticky top-0 z-40 shadow-md`}>
      {/* Top Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Slogan */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-amber-400 via-sky-300 to-white bg-clip-text text-transparent">
                  {profile.companyName || "Harry's Aircon & Electrical"}
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  SANS 10142
                </span>
              </div>
              <p className={`text-xs ${sunlightMode ? 'text-slate-600' : 'text-slate-400'} line-clamp-1`}>
                {profile.tagline || "Electrical • Aircon • Solar • Security"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Subscription Tier & AI Credits Pill */}
            <button
              id="navbar-subscription-badge"
              type="button"
              onClick={() => openPaywall('Upgrade or manage your subscription plan.')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-sm ${
                tier === 'BUSINESS'
                  ? 'bg-sky-950/80 border-sky-500/50 text-sky-300 hover:bg-sky-900'
                  : tier === 'PRO'
                  ? 'bg-amber-950/80 border-amber-500/50 text-amber-300 hover:bg-amber-900'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-400'
              }`}
              title="Click to view subscription tiers & AI credits"
            >
              {tier === 'BUSINESS' ? (
                <Crown className="w-3.5 h-3.5 text-sky-400" />
              ) : tier === 'PRO' ? (
                <Crown className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="font-extrabold">{tier}</span>
              <span className="hidden sm:inline opacity-40">|</span>
              <span className="hidden sm:inline font-mono text-[11px]">
                {entitlements.unlimitedAi
                  ? '∞ AI'
                  : `${entitlements.creditsRemaining} AI`}
              </span>
              {tier === 'FREE' && (
                <span className="hidden md:inline ml-1 px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                  UPGRADE
                </span>
              )}
            </button>

            {/* Install App CTA */}
            {isInstallable && (
              <button
                onClick={promptInstall}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
                title="Install this app on your device"
              >
                <Download className="w-4 h-4 text-white" />
                <span className="hidden md:inline">Install App</span>
                <span className="md:hidden">Install</span>
              </button>
            )}

            {/* Quick Receipt Scan CTA */}
            <button
              onClick={openReceiptScanner}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
              title="Scan supplier receipt using Gemini OCR"
            >
              <Scan className="w-4 h-4 text-slate-950" />
              <span className="hidden md:inline">Scan Supplier Receipt</span>
              <span className="md:hidden">Scan Receipt</span>
            </button>

            {/* Debug Mode Button */}
            {openDebugModal && (
              <button
                type="button"
                onClick={openDebugModal}
                className={`p-2 rounded-lg border transition-all cursor-pointer ${
                  sunlightMode
                    ? 'bg-slate-200 border-slate-300 text-slate-800 hover:bg-slate-300'
                    : 'bg-[#12141C] border-[#334155] text-slate-300 hover:text-amber-400 hover:bg-[#282E3E]'
                }`}
                title="Open Application & API Debugger (Ctrl+Shift+D)"
              >
                <Bug className="w-5 h-5" />
              </button>
            )}

            {/* Sunlight High Contrast Mode */}
            <button
              onClick={toggleSunlightMode}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                sunlightMode
                  ? 'bg-amber-400 border-amber-500 text-slate-950 font-bold shadow-md'
                  : 'bg-[#12141C] border-[#334155] text-amber-400 hover:bg-[#282E3E]'
              }`}
              title="Toggle Outdoor High-Contrast Sunlight Mode for bright field conditions"
            >
              {sunlightMode ? (
                <Sun className="w-5 h-5 animate-spin-slow" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className={`border-t ${sunlightMode ? 'border-[#E2E8F0] bg-white' : 'border-[#282E3E]/60 bg-[#151722]'}`}>
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none" aria-label="Tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? sunlightMode
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-[#0284C7] text-white shadow-md shadow-sky-600/30'
                      : sunlightMode
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-[#1B1E28] hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
