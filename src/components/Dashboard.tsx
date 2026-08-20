import React from 'react';
import { useApp } from '../context/AppContext';
import { formatZAR, getWhatsAppShareLink } from '../utils/calculator';
import {
  DollarSign,
  Briefcase,
  FileCheck,
  AlertTriangle,
  ScanLine,
  PlusCircle,
  PhoneCall,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle,
  Package,
  Wrench,
  Sun,
  Shield,
  Zap,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    setActiveTab,
    sunlightMode,
    quotations,
    invoices,
    jobs,
    inventory,
    lowStockItems,
    completeJobAndDeductStock,
    profile,
  } = useApp();

  // Metrics calculation
  const totalPaidRevenue = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);

  const totalOutstanding = invoices
    .filter((inv) => inv.status === 'issued' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + (inv.totalAmount - (inv.amountPaid || 0)), 0);

  const activeJobs = jobs.filter((j) => j.status === 'in_progress' || j.status === 'pending');
  const pendingQuotes = quotations.filter((q) => q.status === 'draft' || q.status === 'sent');

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#F8FAFC]'}`}>
      {/* Top Banner / Technical Control Unit with Fast Rates Glance */}
      <div
        className={`p-5 rounded-xl border transition-all ${
          sunlightMode
            ? 'bg-amber-100 border-amber-400 text-black shadow-lg font-bold'
            : 'bg-[#232838] border-[#334155] shadow-xl'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#38BDF8] text-[#1B1E28] uppercase tracking-wider">
                FIELD UNIT // ACTIVE
              </span>
              <span className="text-[11px] font-mono text-[#94A3B8]">OPERATOR: {profile.email}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-[#F8FAFC]">
              {profile.companyName}
            </h2>
            <p className="text-xs font-mono text-[#94A3B8] mt-0.5">
              {profile.tagline || 'From Electrical to Aircons, security to automation, we\'ve got you covered'}
            </p>
          </div>

          {/* Quick Rates Glance */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155]">
              <span className="text-[#94A3B8] block text-[9px] font-mono uppercase tracking-wider">Call-Out Fee</span>
              <span className="font-mono font-bold text-[#F59E0B]">{formatZAR(profile.rates.calloutDiagnostic)}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155]">
              <span className="text-[#94A3B8] block text-[9px] font-mono uppercase tracking-wider">Master Labour</span>
              <span className="font-mono font-bold text-[#38BDF8]">{formatZAR(profile.rates.masterLabourRate)}/hr</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155]">
              <span className="text-[#94A3B8] block text-[9px] font-mono uppercase tracking-wider">Travel Rate</span>
              <span className="font-mono font-bold text-[#10B981]">{formatZAR(profile.rates.travelRatePerKm)}/km</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Financial & Operational KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Paid Revenue */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            sunlightMode
              ? 'bg-white border-2 border-black text-black'
              : 'bg-[#232838] border-[#334155] text-white hover:border-[#10B98166]'
          }`}
        >
          <div className="flex items-center justify-between text-[#94A3B8] mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Settled Revenue</span>
            <DollarSign className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-xl md:text-2xl font-mono font-bold text-[#10B981]">{formatZAR(totalPaidRevenue)}</div>
          <span className="text-[10px] font-mono text-[#94A3B8]">EFT & cash receipted</span>
        </div>

        {/* Outstanding Invoices */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            sunlightMode
              ? 'bg-white border-2 border-black text-black'
              : 'bg-[#232838] border-[#334155] text-white hover:border-[#F59E0B66]'
          }`}
        >
          <div className="flex items-center justify-between text-[#94A3B8] mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Awaiting Settlement</span>
            <Clock className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-xl md:text-2xl font-mono font-bold text-[#F59E0B]">{formatZAR(totalOutstanding)}</div>
          <span className="text-[10px] font-mono text-[#94A3B8]">Unsettled client invoices</span>
        </div>

        {/* Active On-Site Jobs */}
        <div
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            sunlightMode
              ? 'bg-white border-2 border-black text-black'
              : 'bg-[#232838] border-[#334155] text-white hover:border-[#38BDF8]'
          }`}
          onClick={() => setActiveTab('invoices')}
        >
          <div className="flex items-center justify-between text-[#94A3B8] mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Active Jobs</span>
            <Briefcase className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="text-xl md:text-2xl font-mono font-bold text-[#38BDF8]">{activeJobs.length} In Progress</div>
          <span className="text-[10px] font-mono text-[#94A3B8]">{pendingQuotes.length} pending quotations</span>
        </div>

        {/* Low Stock Alerts */}
        <div
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            lowStockItems.length > 0
              ? sunlightMode
                ? 'bg-rose-100 border-2 border-rose-600 text-rose-950 font-bold'
                : 'bg-[#232838] border-[#EF4444] text-white'
              : sunlightMode
              ? 'bg-white border-2 border-black text-black'
              : 'bg-[#232838] border-[#334155] text-white hover:border-[#10B981]'
          }`}
          onClick={() => setActiveTab('inventory')}
        >
          <div className="flex items-center justify-between text-[#94A3B8] mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Critical Stock</span>
            <AlertTriangle className={`w-4 h-4 ${lowStockItems.length > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`} />
          </div>
          <div className={`text-xl md:text-2xl font-mono font-bold ${lowStockItems.length > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
            {lowStockItems.length} Low Stock
          </div>
          <span className="text-[10px] font-mono text-[#94A3B8]">Catalog: {inventory.length} total SKUs</span>
        </div>
      </div>

      {/* QUICK ACTIONS GRID */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[#94A3B8] flex items-center space-x-2">
            <Zap className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Field Dispatch Actions</span>
          </h3>
          <span className="text-[10px] font-mono text-[#94A3B8]">ONE-TAP WORKFLOW</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Action 1: Smart OCR Invoice Scanner */}
          <button
            id="quick-action-scan-invoice"
            onClick={() => setActiveTab('scanner')}
            className={`p-4 rounded-xl text-left border flex flex-col justify-between transition-all group ${
              sunlightMode
                ? 'bg-amber-300 border-2 border-black text-black hover:bg-amber-400 shadow-md'
                : 'bg-[#232838] border-[#334155] hover:border-[#38BDF8] hover:bg-[#2D3449] text-white'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#38BDF8] flex items-center justify-center text-[#1B1E28] mb-3 shadow-md shadow-[#38BDF833]">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs md:text-sm uppercase tracking-tight text-[#F8FAFC] group-hover:text-[#38BDF8]">
                Smart OCR Scanner
              </div>
              <p className="text-[10px] font-mono text-[#94A3B8] mt-0.5">
                Voltex / Metraclark Bills
              </p>
            </div>
          </button>

          {/* Action 2: Fast On-Site Quote */}
          <button
            id="quick-action-fast-quote"
            onClick={() => setActiveTab('quotes')}
            className={`p-4 rounded-xl text-left border flex flex-col justify-between transition-all group ${
              sunlightMode
                ? 'bg-amber-300 border-2 border-black text-black hover:bg-amber-400 shadow-md'
                : 'bg-[#232838] border-[#334155] hover:border-[#F59E0B] hover:bg-[#2D3449] text-white'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#F59E0B] flex items-center justify-center text-[#1B1E28] mb-3 shadow-md shadow-[#F59E0B33]">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs md:text-sm uppercase tracking-tight text-[#F8FAFC] group-hover:text-[#F59E0B]">
                Fast On-Site Quote
              </div>
              <p className="text-[10px] font-mono text-[#94A3B8] mt-0.5">
                WhatsApp 1-Tap & PDF
              </p>
            </div>
          </button>

          {/* Action 3: Direct Tax Invoice */}
          <button
            id="quick-action-direct-invoice"
            onClick={() => setActiveTab('invoices')}
            className={`p-4 rounded-xl text-left border flex flex-col justify-between transition-all group ${
              sunlightMode
                ? 'bg-amber-300 border-2 border-black text-black hover:bg-amber-400 shadow-md'
                : 'bg-[#232838] border-[#334155] hover:border-[#10B981] hover:bg-[#2D3449] text-white'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#10B981] flex items-center justify-center text-[#1B1E28] mb-3 shadow-md shadow-[#10B98133]">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs md:text-sm uppercase tracking-tight text-[#F8FAFC] group-hover:text-[#10B981]">
                Direct Tax Invoice
              </div>
              <p className="text-[10px] font-mono text-[#94A3B8] mt-0.5">
                Emergency & Counter Sale
              </p>
            </div>
          </button>

          {/* Action 4: Stock & Inventory */}
          <button
            id="quick-action-price-book"
            onClick={() => setActiveTab('inventory')}
            className={`p-4 rounded-xl text-left border flex flex-col justify-between transition-all group ${
              sunlightMode
                ? 'bg-amber-300 border-2 border-black text-black hover:bg-amber-400 shadow-md'
                : 'bg-[#232838] border-[#334155] hover:border-[#38BDF8] hover:bg-[#2D3449] text-white'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#1B1E28] border border-[#334155] flex items-center justify-center text-[#38BDF8] mb-3 shadow">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs md:text-sm uppercase tracking-tight text-[#F8FAFC] group-hover:text-[#38BDF8]">
                Stock & Inventory
              </div>
              <p className="text-[10px] font-mono text-[#94A3B8] mt-0.5">
                Gas, Cable & Components
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Two Column Layout: Active On-Site Jobs & Low Stock Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Jobs Card */}
        <div
          className={`rounded-xl border overflow-hidden transition-all ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#232838] border-[#334155]'
          }`}
        >
          <div className="p-4 border-b border-[#334155] flex justify-between items-center bg-[#1B1E28]">
            <div className="flex items-center space-x-2">
              <Briefcase className="w-4 h-4 text-[#38BDF8]" />
              <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-[#F8FAFC]">
                Active Field Jobs Grid
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('invoices')}
              className="text-[11px] font-mono uppercase text-[#38BDF8] hover:underline flex items-center space-x-1"
            >
              <span>View Pipeline</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-4">
            {activeJobs.length === 0 ? (
              <div className="p-8 text-center text-[#94A3B8] border border-dashed border-[#334155] rounded-lg">
                <p className="text-xs font-mono uppercase">No active jobs scheduled.</p>
                <button
                  onClick={() => setActiveTab('quotes')}
                  className="mt-2 text-xs font-bold text-[#38BDF8] hover:underline font-mono"
                >
                  + CONVERT A QUOTE INTO AN ACTIVE JOB
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3.5 rounded-lg bg-[#1B1E28] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#38BDF866] transition-colors"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#232838] text-[#38BDF8] border border-[#334155]">
                          {job.serviceType}
                        </span>
                        <span className="text-[10px] font-mono text-[#94A3B8]">{job.jobNumber}</span>
                      </div>
                      <div className="font-bold text-xs text-[#F8FAFC] mt-1">{job.title}</div>
                      <div className="text-[11px] font-mono text-[#94A3B8] flex items-center space-x-2 mt-0.5">
                        <span className="text-[#F8FAFC]">{job.clientName}</span>
                        <span>•</span>
                        <span>{job.clientAddress.split(',')[0]}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Call client */}
                      <a
                        href={`tel:${job.clientPhone}`}
                        className="p-2 rounded-lg bg-[#38BDF8] text-[#1B1E28] font-bold hover:bg-[#7DD3FC] transition-colors"
                        title="Call Client"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>

                      {/* WhatsApp */}
                      <a
                        href={getWhatsAppShareLink(job.clientPhone, `Hi ${job.clientName}, this is Harry from Harry's Aircon Electrical & Solar regarding job ${job.jobNumber}.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-[#25D366] text-black font-bold hover:bg-[#20ba59] transition-colors"
                        title="WhatsApp Client"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>

                      {/* 1-Tap Complete & Deduct Materials */}
                      <button
                        onClick={() => completeJobAndDeductStock(job.id)}
                        className="px-3 py-2 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-[#1B1E28] font-mono font-bold text-xs flex items-center space-x-1.5 shadow"
                        title="Complete job & automatically deduct materials from stock"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>DEDUCT STOCK</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock & Gas Consumables Warning */}
        <div
          className={`rounded-xl border overflow-hidden transition-all ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#232838] border-[#334155]'
          }`}
        >
          <div className="p-4 border-b border-[#334155] flex justify-between items-center bg-[#1B1E28]">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-[#F8FAFC]">
                Critical Inventory
              </h3>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${lowStockItems.length > 0 ? 'bg-[#EF4444] text-white' : 'bg-[#10B981] text-white'}`}>
              {lowStockItems.length > 0 ? 'LOW STOCK' : 'OPTIMAL'}
            </span>
          </div>

          <div className="p-4 space-y-4">
            {lowStockItems.length === 0 ? (
              <div className="p-8 text-center text-[#94A3B8] border border-dashed border-[#334155] rounded-lg">
                <CheckCircle className="w-6 h-6 text-[#10B981] mx-auto mb-1" />
                <p className="text-xs font-mono uppercase font-bold text-[#F8FAFC]">All inventory levels optimal</p>
                <p className="text-[11px] font-mono text-[#94A3B8] mt-0.5">No materials or refrigerants below threshold.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {lowStockItems.map((item) => {
                  const pct = Math.min(100, Math.round((item.stockOnHand / (item.minStockAlert * 2 || 10)) * 100));
                  return (
                    <div key={item.id} className="p-3 bg-[#1B1E28] border border-[#334155] rounded-lg">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#F8FAFC]">{item.description}</span>
                        <span className="font-mono text-[#EF4444] font-bold">
                          {item.stockOnHand} / {item.minStockAlert * 2} {item.unit}
                        </span>
                      </div>
                      <div className="relative h-1.5 bg-[#334155] rounded mt-2 overflow-hidden">
                        <div
                          className={`absolute h-full rounded ${
                            pct <= 25 ? 'bg-[#EF4444]' : pct <= 50 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'
                          }`}
                          style={{ width: `${Math.max(8, pct)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono text-[#94A3B8] mt-1.5">
                        <span>SKU: {item.sku}</span>
                        <span>TRADE COST: {formatZAR(item.costPrice)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Prompt to scan receipt if stock low */}
            <div className="pt-3 border-t border-[#334155] flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
              <span>Purchased stock at Voltex or Metraclark?</span>
              <button
                onClick={() => setActiveTab('scanner')}
                className="text-[11px] font-mono font-bold text-[#38BDF8] hover:underline flex items-center space-x-1"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>SCAN INVOICE NOW</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

