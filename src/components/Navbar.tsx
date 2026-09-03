import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  DollarSign,
  Users,
  Package,
  Scan,
  Settings,
  Sun,
  Zap,
  Database,
  LayoutDashboard,
  Download,
  Bug,
  Sparkles,
  Crown,
  TrendingUp,
  Receipt,
  ChevronDown,
  Check,
  Menu,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openReceiptScanner: () => void;
  openDebugModal?: () => void;
}

interface NavSection {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'workflows' | 'operations' | 'management';
  badge?: string;
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

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navSections: NavSection[] = [
    // 1. Core Field Workflows
    {
      id: 'dashboard',
      label: 'Dashboard',
      sublabel: 'Command center, revenue & quick actions',
      icon: LayoutDashboard,
      group: 'workflows',
    },
    {
      id: 'quotes',
      label: 'Fast Quotations',
      sublabel: 'Instant quotes, SANS 10142 compliance & markup',
      icon: FileText,
      group: 'workflows',
    },
    {
      id: 'invoices',
      label: 'Invoicing & Payments',
      sublabel: 'Tax invoices, progress claims & payment receipts',
      icon: DollarSign,
      group: 'workflows',
    },
    {
      id: 'expenses',
      label: 'Expense Log',
      sublabel: 'Slip capture, materials, fuel & job cost linking',
      icon: Receipt,
      group: 'workflows',
      badge: 'NEW',
    },
    // 2. Operations & CRM
    {
      id: 'inventory',
      label: 'Inventory & Stock',
      sublabel: 'Van stock, component search & low-stock alerts',
      icon: Package,
      group: 'operations',
    },
    {
      id: 'clients',
      label: 'Clients Directory',
      sublabel: 'Customer CRM, location maps & Google sync',
      icon: Users,
      group: 'operations',
    },
    // 3. Financials & Architecture
    {
      id: 'financials',
      label: 'Financial Analysis',
      sublabel: 'Monthly P&L, gross profit margins & cashflow',
      icon: TrendingUp,
      group: 'management',
    },
    {
      id: 'schema',
      label: 'Cloud SQL Schema',
      sublabel: 'Relational PostgreSQL specs & entity models',
      icon: Database,
      group: 'management',
    },
    {
      id: 'settings',
      label: 'Business Profile',
      sublabel: 'Company branding, banking info, VAT & rates',
      icon: Settings,
      group: 'management',
    },
  ];

  // Current active section
  const currentSection =
    navSections.find((s) => s.id === activeTab) || navSections[0];
  const CurrentIcon = currentSection.icon;

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    setIsDropdownOpen(false);
  };

  return (
    <header
      className={`${
        sunlightMode
          ? 'bg-[#F8FAFC] border-b-2 border-[#CBD5E1] text-[#0F172A]'
          : 'bg-[#181B26] border-b border-[#282E3E] text-white'
      } sticky top-0 z-50 shadow-lg`}
    >
      {/* Main Unified Header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Left: Brand + Sections Dropdown Menu */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Logo */}
            <div
              className="flex items-center space-x-2.5 cursor-pointer select-none group"
              onClick={() => handleSelectTab('dashboard')}
              title="Return to Dashboard"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 via-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center space-x-1.5">
                  <span className="font-black text-sm sm:text-base tracking-tight bg-gradient-to-r from-amber-400 via-sky-300 to-white bg-clip-text text-transparent truncate max-w-[170px] lg:max-w-none">
                    {profile.companyName || "Harry's Aircon & Electrical"}
                  </span>
                  <span className="hidden lg:inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                    SANS 10142
                  </span>
                </div>
                <p
                  className={`text-[11px] ${
                    sunlightMode ? 'text-slate-600' : 'text-slate-400'
                  } line-clamp-1`}
                >
                  {profile.tagline || 'Electrical • Aircon • Solar'}
                </p>
              </div>
            </div>

            {/* SECTIONS DROPDOWN SELECTOR */}
            <div className="relative" ref={dropdownRef}>
              <button
                id="sections-dropdown-toggle"
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-xl border text-xs sm:text-sm font-black transition-all cursor-pointer shadow-sm select-none ${
                  isDropdownOpen
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30 ring-2 ring-amber-400/40'
                    : sunlightMode
                    ? 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-slate-50'
                    : 'bg-[#12141D] border-[#2A3143] text-white hover:border-amber-500/50 hover:bg-[#1C202F]'
                }`}
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
                title="Select application section"
              >
                <CurrentIcon
                  className={`w-4 h-4 ${
                    isDropdownOpen ? 'text-slate-950' : 'text-amber-400'
                  }`}
                />
                <span className="max-w-[110px] sm:max-w-[160px] md:max-w-[200px] truncate">
                  {currentSection.label}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180 text-slate-950' : 'text-slate-400'
                  }`}
                />
              </button>

              {/* DROPDOWN MENU PANEL */}
              {isDropdownOpen && (
                <div
                  className={`absolute left-0 mt-2 w-[310px] sm:w-[360px] md:w-[400px] rounded-2xl border shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 ${
                    sunlightMode
                      ? 'bg-white border-slate-300 text-slate-900 shadow-slate-400/30'
                      : 'bg-[#151824] border-[#2E364B] text-white shadow-black/80'
                  }`}
                >
                  <div className="px-3 py-2 border-b border-[#282E3E]/60 flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-extrabold text-amber-400 flex items-center gap-1.5">
                      <Menu className="w-3.5 h-3.5 text-amber-400" />
                      App Sections & Tools
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {navSections.length} modules
                    </span>
                  </div>

                  <div className="max-h-[70vh] overflow-y-auto py-1 space-y-3 divide-y divide-[#282E3E]/40">
                    {/* Group 1: Core Field Workflows */}
                    <div className="pt-1">
                      <div className="px-3 py-1 text-[10px] font-mono uppercase font-bold text-slate-400">
                        ⚡ Core Workflows
                      </div>
                      <div className="space-y-1 mt-1">
                        {navSections
                          .filter((s) => s.group === 'workflows')
                          .map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectTab(item.id)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                    : sunlightMode
                                    ? 'hover:bg-slate-100 text-slate-800'
                                    : 'hover:bg-[#1E2333] text-slate-200'
                                }`}
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isActive
                                        ? 'bg-slate-950 text-amber-400'
                                        : 'bg-slate-800/80 text-amber-400'
                                    }`}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-xs sm:text-sm font-bold truncate">
                                        {item.label}
                                      </span>
                                      {item.badge && (
                                        <span
                                          className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                                            isActive
                                              ? 'bg-slate-950 text-white'
                                              : 'bg-amber-500 text-slate-950'
                                          }`}
                                        >
                                          {item.badge}
                                        </span>
                                      )}
                                    </div>
                                    <p
                                      className={`text-[11px] truncate ${
                                        isActive ? 'text-slate-900' : 'text-slate-400'
                                      }`}
                                    >
                                      {item.sublabel}
                                    </p>
                                  </div>
                                </div>
                                {isActive && (
                                  <Check className="w-4 h-4 shrink-0 text-slate-950 ml-2" />
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Group 2: Operations & CRM */}
                    <div className="pt-2">
                      <div className="px-3 py-1 text-[10px] font-mono uppercase font-bold text-slate-400">
                        📦 Operations & Stock
                      </div>
                      <div className="space-y-1 mt-1">
                        {navSections
                          .filter((s) => s.group === 'operations')
                          .map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectTab(item.id)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                    : sunlightMode
                                    ? 'hover:bg-slate-100 text-slate-800'
                                    : 'hover:bg-[#1E2333] text-slate-200'
                                }`}
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isActive
                                        ? 'bg-slate-950 text-sky-400'
                                        : 'bg-slate-800/80 text-sky-400'
                                    }`}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-xs sm:text-sm font-bold truncate block">
                                      {item.label}
                                    </span>
                                    <p
                                      className={`text-[11px] truncate ${
                                        isActive ? 'text-slate-900' : 'text-slate-400'
                                      }`}
                                    >
                                      {item.sublabel}
                                    </p>
                                  </div>
                                </div>
                                {isActive && (
                                  <Check className="w-4 h-4 shrink-0 text-slate-950 ml-2" />
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Group 3: Financials & Architecture */}
                    <div className="pt-2">
                      <div className="px-3 py-1 text-[10px] font-mono uppercase font-bold text-slate-400">
                        📊 Intelligence & Setup
                      </div>
                      <div className="space-y-1 mt-1">
                        {navSections
                          .filter((s) => s.group === 'management')
                          .map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectTab(item.id)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                    : sunlightMode
                                    ? 'hover:bg-slate-100 text-slate-800'
                                    : 'hover:bg-[#1E2333] text-slate-200'
                                }`}
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isActive
                                        ? 'bg-slate-950 text-emerald-400'
                                        : 'bg-slate-800/80 text-emerald-400'
                                    }`}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-xs sm:text-sm font-bold truncate block">
                                      {item.label}
                                    </span>
                                    <p
                                      className={`text-[11px] truncate ${
                                        isActive ? 'text-slate-900' : 'text-slate-400'
                                      }`}
                                    >
                                      {item.sublabel}
                                    </p>
                                  </div>
                                </div>
                                {isActive && (
                                  <Check className="w-4 h-4 shrink-0 text-slate-950 ml-2" />
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick jump pills for top desktop workflows */}
            <div className="hidden xl:flex items-center space-x-1 pl-1 border-l border-slate-700/60">
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'quotes', label: 'Quotes' },
                { id: 'invoices', label: 'Invoices' },
                { id: 'expenses', label: 'Expenses' },
                { id: 'inventory', label: 'Stock' },
              ].map((pill) => {
                const isSelected = activeTab === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => handleSelectTab(pill.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                        : sunlightMode
                        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#1F2433]'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Actions & Indicators */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5">
            {/* Subscription Tier Pill */}
            <button
              id="navbar-subscription-badge"
              type="button"
              onClick={() =>
                openPaywall('Upgrade or manage your subscription plan.')
              }
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-sm ${
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
            </button>

            {/* Install App CTA */}
            {isInstallable && (
              <button
                onClick={promptInstall}
                className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
                title="Install this app on your device"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span className="hidden md:inline">Install</span>
              </button>
            )}

            {/* Quick Receipt Scan CTA */}
            <button
              onClick={openReceiptScanner}
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
              title="Scan supplier receipt using Gemini OCR"
            >
              <Scan className="w-4 h-4 text-slate-950" />
              <span className="hidden md:inline">Scan Slip</span>
            </button>

            {/* Debug Mode Button */}
            {openDebugModal && (
              <button
                type="button"
                onClick={openDebugModal}
                className={`p-1.5 sm:p-2 rounded-lg border transition-all cursor-pointer ${
                  sunlightMode
                    ? 'bg-slate-200 border-slate-300 text-slate-800 hover:bg-slate-300'
                    : 'bg-[#12141C] border-[#334155] text-slate-300 hover:text-amber-400 hover:bg-[#282E3E]'
                }`}
                title="Open Application & API Debugger (Ctrl+Shift+D)"
              >
                <Bug className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {/* Sunlight High Contrast Mode */}
            <button
              onClick={toggleSunlightMode}
              className={`p-1.5 sm:p-2 rounded-lg border transition-all cursor-pointer ${
                sunlightMode
                  ? 'bg-amber-400 border-amber-500 text-slate-950 font-bold shadow-md'
                  : 'bg-[#12141C] border-[#334155] text-amber-400 hover:bg-[#282E3E]'
              }`}
              title="Toggle Outdoor High-Contrast Sunlight Mode for bright field conditions"
            >
              <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

