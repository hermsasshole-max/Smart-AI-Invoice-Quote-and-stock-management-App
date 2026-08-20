import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice, InvoiceStatus, QuoteLineItem, ServiceCategory } from '../types';
import { formatZAR, getWhatsAppShareLink } from '../utils/calculator';
import { exportToPDF, exportToExcel, exportToWord, exportToPlainText } from '../utils/multiFormatExport';
import { VoiceInvoiceWizard } from './VoiceInvoiceWizard';
import {
  Receipt,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  MessageSquare,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  Edit2,
  Trash2,
  Mic,
  FileSpreadsheet,
  FileText,
  File,
  X,
  ChevronDown,
  Check,
  Percent,
} from 'lucide-react';

export const InvoicingPipeline: React.FC = () => {
  const {
    invoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    markInvoicePaid,
    jobs,
    completeJobAndDeductStock,
    profile,
    sunlightMode,
    clients,
    inventory,
    adjustStockOnHand,
    setActiveTab,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [isCreatingStandalone, setIsCreatingStandalone] = useState(false);
  const [isVoiceWizardOpen, setIsVoiceWizardOpen] = useState(false);

  // Edit Invoice Modal State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Standalone emergency invoice form state
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [serviceType, setServiceType] = useState<ServiceCategory>('Electrical');
  const [description, setDescription] = useState('Emergency Diagnostic & Fault Finding Callout');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [calloutFee, setCalloutFee] = useState(750);
  const [labourAmount, setLabourAmount] = useState(550);
  const [materialsAmount, setMaterialsAmount] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [notes, setNotes] = useState('Payment strictly on completion. SABS approved materials installed.');

  // Export dropdown state for rows
  const [openExportMenuId, setOpenExportMenuId] = useState<string | null>(null);

  // Handle client select
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setClientName(client.name);
      setClientPhone(client.phone);
      setClientEmail(client.email || '');
      setClientAddress(client.siteAddress);
      setServiceType(client.serviceType);
    }
  };

  // Submit standalone emergency invoice
  const handleCreateStandaloneInvoice = () => {
    if (!clientName.trim() || !clientPhone.trim()) {
      alert('Please enter client name and phone.');
      return;
    }

    const subtotal = calloutFee + labourAmount + materialsAmount;
    const safeDiscountPct = Math.max(0, Math.min(100, Number(discountPct) || 0));
    const discountAmount = Number(((subtotal * safeDiscountPct) / 100).toFixed(2));
    const subtotalAfterDiscount = subtotal - discountAmount;
    const vatAmount = vatEnabled ? Number((subtotalAfterDiscount * 0.15).toFixed(2)) : 0;
    const totalAmount = Number((subtotalAfterDiscount + vatAmount).toFixed(2));

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const items: QuoteLineItem[] = [
      {
        id: `li-direct-${Date.now()}`,
        type: 'callout',
        description: description,
        quantity: 1,
        unit: 'ea',
        unitCost: calloutFee * 0.5,
        unitPrice: calloutFee,
        total: calloutFee,
      },
    ];

    if (materialsAmount > 0) {
      items.push({
        id: `li-direct-mat-${Date.now()}`,
        type: 'material',
        description: 'Electrical / HVAC Consumables & Installed Parts',
        quantity: 1,
        unit: 'lot',
        unitCost: materialsAmount * 0.7,
        unitPrice: materialsAmount,
        total: materialsAmount,
      });
    }

    createInvoice(
      {
        invoiceNumber,
        clientId: selectedClientId || `cli-${Date.now()}`,
        clientName,
        clientPhone,
        clientEmail,
        clientAddress: clientAddress || 'Site Location',
        serviceType,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        items,
        calloutFee,
        labourTotal: labourAmount,
        travelTotal: 0,
        materialsTotal: materialsAmount,
        subtotal,
        discountPct: safeDiscountPct,
        discountAmount,
        vatEnabled,
        vatRate: 15,
        vatAmount,
        totalAmount,
        amountPaid: 0,
        status: 'issued',
        notes,
        scopeOfWork: scopeOfWork || description,
      },
      false
    );

    setIsCreatingStandalone(false);
  };

  // Handle Edit Invoice Save
  const handleSaveInvoiceEdit = (inv: Invoice) => {
    // Recalculate financial totals
    const materialsTotal = (inv.items || []).reduce((sum, it) => sum + (Number(it.total) || 0), 0);
    const subtotal = materialsTotal + (Number(inv.calloutFee) || 0) + (Number(inv.labourTotal) || 0) + (Number(inv.travelTotal) || 0);
    const safeDiscountPct = Math.max(0, Math.min(100, Number(inv.discountPct) || 0));
    const discountAmount = Number(((subtotal * safeDiscountPct) / 100).toFixed(2));
    const subtotalAfterDiscount = subtotal - discountAmount;
    const vatAmount = inv.vatEnabled ? Number((subtotalAfterDiscount * 0.15).toFixed(2)) : 0;
    const totalAmount = Number((subtotalAfterDiscount + vatAmount).toFixed(2));

    updateInvoice(inv.id, {
      ...inv,
      materialsTotal,
      subtotal,
      discountPct: safeDiscountPct,
      discountAmount,
      vatAmount,
      totalAmount,
    });

    setEditingInvoice(null);
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'all') return true;
    return inv.status === statusFilter;
  });

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#F8FAFC]'}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#334155] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#38BDF8] text-[#1B1E28] uppercase tracking-wider">
              FINANCIAL DISPATCH & AUDIT
            </span>
            <span className="text-[11px] font-mono text-[#94A3B8]">15% VAT INVOICING • MULTI-FORMAT EXPORTS</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-white">
            Invoicing & Job Execution Pipeline
          </h2>
          <p className="text-xs font-mono text-[#94A3B8] mt-0.5">
            Full CRUD management, automated stock deductions, interactive Voice Assistant, and PDF/Excel/Word/TXT exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          <button
            onClick={() => setIsVoiceWizardOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-[#F59E0B] hover:from-amber-400 hover:to-[#D97706] text-[#1B1E28] font-bold text-xs uppercase flex items-center space-x-1.5 shadow-lg shadow-amber-500/20"
          >
            <Mic className="w-4 h-4 text-[#1B1E28] animate-pulse" />
            <span>Voice Assistant Wizard</span>
          </button>

          <button
            id="btn-new-direct-invoice"
            onClick={() => setIsCreatingStandalone(!isCreatingStandalone)}
            className={`px-4 py-2 rounded-lg font-mono font-bold text-xs uppercase flex items-center space-x-2 transition-all shadow ${
              isCreatingStandalone
                ? 'bg-[#232838] text-[#94A3B8] border border-[#334155]'
                : sunlightMode
                ? 'bg-amber-400 text-black border-2 border-black font-extrabold'
                : 'bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#1B1E28] shadow-lg shadow-[#38BDF833]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isCreatingStandalone ? 'CANCEL' : '+ Direct Tax Invoice'}</span>
          </button>
        </div>
      </div>

      {/* Standalone Emergency / Direct Invoice Creator */}
      {isCreatingStandalone && (
        <div
          className={`p-5 rounded-2xl border space-y-4 shadow-2xl ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#232838] border-[#334155]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#334155] pb-2">
            <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-[#38BDF8] flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#38BDF8]" />
              <span>DIRECT EMERGENCY CALLOUT / COUNTER SALE TAX INVOICE</span>
            </h3>
            <span className="text-[10px] text-[#94A3B8] font-mono uppercase">Auto-Generates Tax Invoice #</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">
                Client Selection
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              >
                <option value="">-- CHOOSE EXISTING OR TYPE BELOW --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">
                Client Name *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Johan Van Der Merwe"
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold font-sans focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">
                Phone Number (WhatsApp) *
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. 082 123 4567"
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">
                Service Trade
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceCategory)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#38BDF8] font-bold focus:border-[#38BDF8] focus:outline-none"
              >
                <option value="Electrical">Electrical Emergency Callout</option>
                <option value="HVAC">HVAC Regas & Fault Finding</option>
                <option value="Solar">Solar / Inverter Repair</option>
                <option value="Refrigeration">Commercial Refrigeration</option>
                <option value="Security">CCTV / Gate Motor Emergency</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Site Location</label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. 14 Kudu Street, Randburg, JHB"
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#94A3B8] block mb-1">Email (Optional)</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. client@example.co.za"
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
          </div>

          {/* Scope of Work / Notes */}
          <div className="space-y-1 text-xs font-mono">
            <label className="text-[10px] font-mono uppercase text-[#38BDF8] block font-bold">
              Scope of Work & Technical Description of Services:
            </label>
            <textarea
              rows={2}
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              placeholder="e.g. Diagnosed tripping main circuit breaker. Isolated faulty geyser element and replaced with standard 3kW incoloy element + new thermostat."
              className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-sans text-xs focus:border-[#38BDF8] focus:outline-none"
            />
          </div>

          {/* Cost Items Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-[#1B1E28] rounded-xl border border-[#334155] text-xs font-mono">
            <div>
              <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Callout Fee (ZAR)</label>
              <input
                type="number"
                value={calloutFee}
                onChange={(e) => setCalloutFee(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#232838] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Labour Charge (ZAR)</label>
              <input
                type="number"
                value={labourAmount}
                onChange={(e) => setLabourAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#232838] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Materials / Parts (ZAR)</label>
              <input
                type="number"
                value={materialsAmount}
                onChange={(e) => setMaterialsAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#232838] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Discount (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#232838] border border-[#334155] text-red-400 font-bold focus:border-red-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <label className="flex items-center space-x-2 text-xs font-mono cursor-pointer">
              <input
                type="checkbox"
                checked={vatEnabled}
                onChange={(e) => setVatEnabled(e.target.checked)}
                className="rounded accent-[#38BDF8]"
              />
              <span>Calculate 15% South African VAT</span>
            </label>

            <div className="flex items-center space-x-3">
              <span className="text-sm font-mono font-bold text-[#10B981]">
                Total:{' '}
                {formatZAR(
                  (calloutFee + labourAmount + materialsAmount) *
                    (1 - discountPct / 100) *
                    (vatEnabled ? 1.15 : 1.0)
                )}
              </span>

              <button
                onClick={handleCreateStandaloneInvoice}
                className="px-5 py-2 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#1B1E28] font-bold text-xs uppercase font-mono shadow-lg shadow-[#10B98133]"
              >
                Issue Tax Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#334155] pb-2 font-mono text-xs overflow-x-auto">
        <span className="text-[#94A3B8] text-[10px] uppercase mr-2">Filter Status:</span>
        {(['all', 'draft', 'issued', 'paid', 'overdue', 'cancelled'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1 rounded-lg uppercase font-bold transition-all ${
              statusFilter === st
                ? 'bg-[#38BDF8] text-[#1B1E28]'
                : 'bg-[#232838] text-[#94A3B8] hover:text-white border border-[#334155]'
            }`}
          >
            {st} ({st === 'all' ? invoices.length : invoices.filter((i) => i.status === st).length})
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#334155] rounded-xl font-mono text-xs text-[#94A3B8]">
            No invoices found matching filter criteria.
          </div>
        ) : (
          filteredInvoices.map((invoice) => {
            const isPaid = invoice.status === 'paid';
            const isOverdue = invoice.status === 'overdue';

            return (
              <div
                key={invoice.id}
                className={`p-4 rounded-xl border transition-all ${
                  sunlightMode
                    ? 'bg-white border-2 border-black'
                    : isPaid
                    ? 'bg-[#232838] border-[#10B981]/40'
                    : isOverdue
                    ? 'bg-[#232838] border-red-500/40'
                    : 'bg-[#232838] border-[#334155] hover:border-[#38BDF8]/50'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left info */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold font-mono text-[#38BDF8]">
                        {invoice.invoiceNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          isPaid
                            ? 'bg-[#10B981] text-[#1B1E28]'
                            : isOverdue
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-400 text-black'
                        }`}
                      >
                        {invoice.status}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1B1E28] text-[#94A3B8] border border-[#334155]">
                        {invoice.serviceType}
                      </span>
                      <span className="text-xs font-mono text-[#94A3B8]">Date: {invoice.date}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 text-xs font-mono text-[#94A3B8] pt-0.5">
                      <span className="font-bold text-white flex items-center space-x-1">
                        <Briefcase className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>{invoice.clientName}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Phone className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>{invoice.clientPhone}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>{invoice.clientAddress}</span>
                      </span>
                    </div>

                    {(invoice.scopeOfWork || invoice.notes) && (
                      <p className="text-xs text-[#94A3B8] italic line-clamp-1 pt-0.5">
                        Scope: {invoice.scopeOfWork || invoice.notes}
                      </p>
                    )}
                  </div>

                  {/* Right Actions & Amount */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right font-mono">
                      <div className="text-base font-bold text-[#10B981]">
                        {formatZAR(invoice.totalAmount)}
                      </div>
                      <div className="text-[10px] text-[#94A3B8]">
                        Sub: {formatZAR(invoice.subtotal)}{' '}
                        {invoice.vatEnabled ? `• VAT: ${formatZAR(invoice.vatAmount)}` : '• Excl VAT'}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* Mark Paid Quick Button */}
                      {!isPaid && (
                        <button
                          onClick={() => markInvoicePaid(invoice.id, 'EFT')}
                          className="px-2.5 py-1.5 rounded-lg bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 text-[#10B981] text-xs font-mono font-bold flex items-center space-x-1"
                          title="Record Instant Settlement"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Paid</span>
                        </button>
                      )}

                      {/* WhatsApp Button */}
                      <a
                        href={getWhatsAppShareLink(
                          invoice.clientPhone,
                          `Hi ${invoice.clientName}, please find your Tax Invoice ${invoice.invoiceNumber} for ${formatZAR(
                            invoice.totalAmount
                          )} from ${profile.companyName}. Banking: ${profile.bankName}, Acc: ${
                            profile.accountNumber
                          }, Ref: ${invoice.invoiceNumber}. Thank you!`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-[#10B981]/15 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/30"
                        title="Send via WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>

                      {/* Multi-Format Export Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenExportMenuId(openExportMenuId === invoice.id ? null : invoice.id)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#1B1E28] hover:bg-[#232838] border border-[#334155] text-[#F8FAFC] text-xs font-mono flex items-center space-x-1"
                        >
                          <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                          <span>Export</span>
                          <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
                        </button>

                        {openExportMenuId === invoice.id && (
                          <div className="absolute right-0 mt-1 w-44 rounded-xl bg-[#232838] border border-[#334155] shadow-2xl z-30 py-1 font-mono text-xs">
                            <button
                              onClick={() => {
                                exportToPDF('invoice', invoice, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-[#F8FAFC]"
                            >
                              <FileText className="w-4 h-4 text-red-400" />
                              <span>PDF Document (.pdf)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToExcel('invoice', invoice, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-[#F8FAFC]"
                            >
                              <FileSpreadsheet className="w-4 h-4 text-green-400" />
                              <span>Excel Sheet (.xlsx)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToWord('invoice', invoice, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-[#F8FAFC]"
                            >
                              <File className="w-4 h-4 text-blue-400" />
                              <span>Word Doc (.docx)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToPlainText('invoice', invoice, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-[#F8FAFC]"
                            >
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span>Plain Text (.txt)</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Edit Invoice Button */}
                      <button
                        onClick={() => setEditingInvoice(JSON.parse(JSON.stringify(invoice)))}
                        className="p-2 rounded-lg bg-[#1B1E28] hover:bg-[#232838] border border-[#334155] text-[#94A3B8] hover:text-white"
                        title="Edit Invoice"
                      >
                        <Edit2 className="w-4 h-4 text-[#38BDF8]" />
                      </button>

                      {/* Delete Invoice Button */}
                      <button
                        onClick={() => setDeleteConfirmId(invoice.id)}
                        className="p-2 rounded-lg bg-[#1B1E28] hover:bg-red-500/20 border border-[#334155] hover:border-red-500/40 text-[#94A3B8] hover:text-red-400"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-5 rounded-2xl bg-[#232838] border border-red-500/40 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase">Confirm Invoice Deletion</h3>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Are you sure you want to permanently delete this Tax Invoice? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1B1E28] text-xs text-[#94A3B8] hover:text-white border border-[#334155]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteInvoice(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase shadow"
              >
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-[#232838] border border-[#334155] shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-[#38BDF8]" />
                <h3 className="font-bold text-sm text-white uppercase">
                  Edit Tax Invoice: {editingInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setEditingInvoice(null)}
                className="p-1 rounded text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Client & Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Client Name</label>
                <input
                  type="text"
                  value={editingInvoice.clientName}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, clientName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-bold focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Client Phone</label>
                <input
                  type="text"
                  value={editingInvoice.clientPhone}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, clientPhone: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Status</label>
                <select
                  value={editingInvoice.status}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      status: e.target.value as InvoiceStatus,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#10B981] font-bold uppercase focus:border-[#38BDF8] focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Site Address</label>
                <input
                  type="text"
                  value={editingInvoice.clientAddress}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, clientAddress: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={editingInvoice.date}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#94A3B8] block mb-1">Due Date</label>
                <input
                  type="date"
                  value={editingInvoice.dueDate}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, dueDate: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>

            {/* Scope of Work / Notes */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[#38BDF8] block font-bold">
                Scope of Work & Notes:
              </label>
              <textarea
                rows={3}
                value={editingInvoice.scopeOfWork || editingInvoice.notes || ''}
                onChange={(e) =>
                  setEditingInvoice({
                    ...editingInvoice,
                    scopeOfWork: e.target.value,
                    notes: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-[#F8FAFC] font-sans text-xs focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            {/* Line items manager */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#334155] pb-1">
                <span className="font-bold text-white text-[11px] uppercase">
                  Line Items ({editingInvoice.items?.length || 0})
                </span>
                <button
                  onClick={() => {
                    const newItem: QuoteLineItem = {
                      id: `li-edit-${Date.now()}`,
                      type: 'material',
                      description: 'New Material / Service Item',
                      quantity: 1,
                      unit: 'ea',
                      unitCost: 100,
                      unitPrice: 150,
                      total: 150,
                    };
                    setEditingInvoice({
                      ...editingInvoice,
                      items: [...(editingInvoice.items || []), newItem],
                    });
                  }}
                  className="px-2 py-1 rounded-lg bg-[#38BDF8] text-[#1B1E28] font-bold text-[10px] uppercase flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(editingInvoice.items || []).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="grid grid-cols-12 gap-2 p-2 rounded-lg bg-[#1B1E28] border border-[#334155] items-center"
                  >
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...editingInvoice.items];
                          updated[idx].description = e.target.value;
                          setEditingInvoice({ ...editingInvoice, items: updated });
                        }}
                        className="w-full px-2 py-1 rounded bg-[#232838] border border-[#334155] text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...editingInvoice.items];
                          const q = Number(e.target.value) || 1;
                          updated[idx].quantity = q;
                          updated[idx].total = Number((q * updated[idx].unitPrice).toFixed(2));
                          setEditingInvoice({ ...editingInvoice, items: updated });
                        }}
                        className="w-full px-2 py-1 rounded bg-[#232838] border border-[#334155] text-xs text-center text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const updated = [...editingInvoice.items];
                          const p = Number(e.target.value) || 0;
                          updated[idx].unitPrice = p;
                          updated[idx].total = Number((updated[idx].quantity * p).toFixed(2));
                          setEditingInvoice({ ...editingInvoice, items: updated });
                        }}
                        className="w-full px-2 py-1 rounded bg-[#232838] border border-[#334155] text-xs text-right text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2 text-right font-bold text-[#10B981]">
                      {formatZAR(item.total)}
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        onClick={() => {
                          const updated = editingInvoice.items.filter((_, i) => i !== idx);
                          setEditingInvoice({ ...editingInvoice, items: updated });
                        }}
                        className="p-1 text-[#94A3B8] hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rates & Discount */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#1B1E28] rounded-xl border border-[#334155]">
              <div>
                <label className="text-[10px] text-[#94A3B8] block">Callout Fee</label>
                <input
                  type="number"
                  value={editingInvoice.calloutFee || 0}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      calloutFee: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-[#232838] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#94A3B8] block">Labour Total</label>
                <input
                  type="number"
                  value={editingInvoice.labourTotal || 0}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      labourTotal: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-[#232838] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#94A3B8] block">Travel Surcharge</label>
                <input
                  type="number"
                  value={editingInvoice.travelTotal || 0}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      travelTotal: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-[#232838] border border-[#334155] text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#94A3B8] block">Discount %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editingInvoice.discountPct || 0}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      discountPct: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-[#232838] border border-[#334155] text-red-400 font-bold focus:border-red-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#334155]">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingInvoice.vatEnabled}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, vatEnabled: e.target.checked })
                  }
                  className="rounded accent-[#38BDF8]"
                />
                <span>Include 15% South African VAT</span>
              </label>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEditingInvoice(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1B1E28] text-[#94A3B8] hover:text-white border border-[#334155]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveInvoiceEdit(editingInvoice)}
                  className="px-5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#1B1E28] font-bold uppercase shadow"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Assistant Wizard Modal */}
      <VoiceInvoiceWizard
        isOpen={isVoiceWizardOpen}
        onClose={() => setIsVoiceWizardOpen(false)}
        onSuccess={() => {
          setIsVoiceWizardOpen(false);
        }}
      />
    </div>
  );
};
