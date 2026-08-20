import React from 'react';
import { useApp } from '../context/AppContext';
import { formatZAR } from '../utils/calculator';
import {
  DollarSign,
  FileText,
  Clock,
  TrendingUp,
  AlertCircle,
  Plus,
  Scan,
  Users,
  Package,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  openReceiptScanner: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  setActiveTab,
  openReceiptScanner,
}) => {
  const { quotes, invoices, clients, inventory, sunlightMode } = useApp();

  // Metrics
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  const totalOutstanding = totalInvoiced - totalCollected;

  const totalQuotesValue = quotes.reduce((sum, q) => sum + (q.totalAmount || 0), 0);
  const pendingQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'draft');
  const lowStockItems = inventory.filter((item) => item.stockQty <= item.minStockLevel);

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className={`p-6 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300 text-slate-900 shadow-sm' : 'bg-gradient-to-r from-[#1B1E28] via-[#1E2333] to-[#161922] border-[#282E3E] text-white shadow-xl'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>South African Field Service Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Harry's Field Command Center
            </h1>
            <p className={`text-xs sm:text-sm mt-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Instant quoting, OCR supplier receipt extraction, automated WhatsApp invoicing & SANS 10142 compliance.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setActiveTab('quotes')}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-sky-600/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New On-Site Quote</span>
            </button>

            <button
              onClick={openReceiptScanner}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
            >
              <Scan className="w-4 h-4 text-slate-950" />
              <span>Scan Slip</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-slate-400 block">Total Revenue</span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">{formatZAR(totalInvoiced)}</h3>
            </div>
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{formatZAR(totalCollected)} collected</span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-slate-400 block">Outstanding Balance</span>
              <h3 className="text-xl sm:text-2xl font-black text-amber-400 mt-1 font-mono">{formatZAR(totalOutstanding)}</h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            {invoices.filter((i) => i.status !== 'paid').length} invoices pending settlement
          </div>
        </div>

        {/* Pipeline Quotes */}
        <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-slate-400 block">Quotation Pipeline</span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">{formatZAR(totalQuotesValue)}</h3>
            </div>
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-sky-400">
            {pendingQuotes.length} active proposals awaiting approval
          </div>
        </div>

        {/* Van Stock Alerts */}
        <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-slate-400 block">Van Stock Status</span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
                {inventory.length} <span className="text-sm font-normal text-slate-400">SKUs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-1 text-xs text-orange-400">
            {lowStockItems.length > 0 ? (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{lowStockItems.length} items below minimum</span>
              </>
            ) : (
              <span className="text-emerald-400">Stock levels healthy</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Dual Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Quotations & Invoices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Quotes */}
          <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-base">Recent Field Quotations</h3>
              </div>
              <button
                onClick={() => setActiveTab('quotes')}
                className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <span>View All ({quotes.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {quotes.slice(0, 4).map((q) => (
                <div
                  key={q.id}
                  onClick={() => setActiveTab('quotes')}
                  className="p-3.5 rounded-xl bg-[#12141C] hover:bg-[#151824] border border-[#282E3E] flex items-center justify-between transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm">{q.clientName}</span>
                      <span className="font-mono text-xs text-sky-400">({q.quoteNumber})</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {q.serviceType} • {q.items?.length || 0} items • {q.date}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-amber-400 text-sm">{formatZAR(q.totalAmount)}</div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/30">
                      {q.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Invoices */}
          <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Invoicing & Settled Revenue</h3>
              </div>
              <button
                onClick={() => setActiveTab('invoices')}
                className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <span>View All ({invoices.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {invoices.slice(0, 4).map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => setActiveTab('invoices')}
                  className="p-3.5 rounded-xl bg-[#12141C] hover:bg-[#151824] border border-[#282E3E] flex items-center justify-between transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm">{inv.clientName}</span>
                      <span className="font-mono text-xs text-emerald-400">({inv.invoiceNumber})</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {inv.serviceType} • Due: {inv.dueDate}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-white text-sm">{formatZAR(inv.totalAmount)}</div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Tools & SANS Notice */}
        <div className="space-y-6">
          {/* Quick Field Actions */}
          <div className={`p-5 rounded-2xl border ${sunlightMode ? 'bg-white border-slate-300' : 'bg-[#1B1E28] border-[#282E3E]'}`}>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider font-mono mb-3">
              ⚡ Field Quick Tools
            </h3>

            <div className="space-y-2.5">
              <button
                onClick={() => setActiveTab('quotes')}
                className="w-full p-3 rounded-xl bg-[#12141C] hover:bg-[#282E3E] border border-[#282E3E] text-left flex items-center space-x-3 transition-all cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Fast On-Site Quotation</div>
                  <div className="text-[11px] text-slate-400">Itemized quotes with WhatsApp delivery</div>
                </div>
              </button>

              <button
                onClick={openReceiptScanner}
                className="w-full p-3 rounded-xl bg-[#12141C] hover:bg-[#282E3E] border border-[#282E3E] text-left flex items-center space-x-3 transition-all cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Scan className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Smart OCR Receipt Scan</div>
                  <div className="text-[11px] text-slate-400">Extract Voltex/ARB slips via Gemini</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('inventory')}
                className="w-full p-3 rounded-xl bg-[#12141C] hover:bg-[#282E3E] border border-[#282E3E] text-left flex items-center space-x-3 transition-all cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Van Stock & Markup Rates</div>
                  <div className="text-[11px] text-slate-400">Manage cost prices & markup tiers</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('schema')}
                className="w-full p-3 rounded-xl bg-[#12141C] hover:bg-[#282E3E] border border-[#282E3E] text-left flex items-center space-x-3 transition-all cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Cloud SQL PostgreSQL Schema</div>
                  <div className="text-[11px] text-slate-400">View database structure & queries</div>
                </div>
              </button>
            </div>
          </div>

          {/* SANS Compliance Badge */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-950/40 to-slate-900 border border-sky-800/40 text-xs space-y-2">
            <div className="flex items-center space-x-2 text-sky-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>SANS 10142-1 Compliance</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              All electrical installations and Certificates of Compliance (CoC) generated adhere strictly to South African National Standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
