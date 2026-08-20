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
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#E0E0E0]'}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D2D30] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#007AFF] text-white uppercase tracking-wider">
              FINANCIAL DISPATCH & AUDIT
            </span>
            <span className="text-[11px] font-mono text-[#707070]">15% VAT INVOICING • MULTI-FORMAT EXPORTS</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-[#FF6321]">
            Invoicing & Job Execution Pipeline
          </h2>
          <p className="text-xs font-mono text-[#A0A0A5] mt-0.5">
            Full CRUD management, automated stock deductions, interactive Voice Assistant, and PDF/Excel/Word/TXT exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          <button
            onClick={() => setIsVoiceWizardOpen(true)}
            className="px-3.5 py-2 rounded bg-gradient-to-r from-amber-500 to-[#FF6321] hover:from-amber-400 hover:to-[#e0551a] text-black font-bold text-xs uppercase flex items-center space-x-1.5 shadow-lg shadow-amber-500/20"
          >
            <Mic className="w-4 h-4 text-black animate-pulse" />
            <span>Voice Assistant Wizard</span>
          </button>

          <button
            id="btn-new-direct-invoice"
            onClick={() => setIsCreatingStandalone(!isCreatingStandalone)}
            className={`px-4 py-2 rounded font-mono font-bold text-xs uppercase flex items-center space-x-2 transition-all shadow ${
              isCreatingStandalone
                ? 'bg-[#252528] text-[#A0A0A5] border border-[#2D2D30]'
                : sunlightMode
                ? 'bg-amber-400 text-black border-2 border-black font-extrabold'
                : 'bg-[#FF6321] hover:bg-[#e0551a] text-black shadow-lg shadow-[#FF632133]'
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
          className={`p-5 rounded-xl border space-y-4 shadow-2xl ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#2D2D30] pb-2">
            <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-[#FF6321] flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#FF6321]" />
              <span>DIRECT EMERGENCY CALLOUT / COUNTER SALE TAX INVOICE</span>
            </h3>
            <span className="text-[10px] text-[#707070] font-mono uppercase">Auto-Generates Tax Invoice #</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Client Selection
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
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
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Client Name *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Johan Van Der Merwe"
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold font-sans"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Phone Number (WhatsApp) *
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. 082 123 4567"
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                Service Trade
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceCategory)}
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#007AFF] font-bold"
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
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Site Location</label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. 14 Kudu Street, Randburg, JHB"
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">Email (Optional)</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. client@example.co.za"
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
              />
            </div>
          </div>

          {/* Scope of Work / Notes */}
          <div className="space-y-1 text-xs font-mono">
            <label className="text-[10px] font-mono uppercase text-[#FF6321] block font-bold">
              Scope of Work & Technical Description of Services:
            </label>
            <textarea
              rows={2}
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              placeholder="e.g. Diagnosed tripping main circuit breaker. Isolated faulty geyser element and replaced with standard 3kW incoloy element + new thermostat."
              className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-sans text-xs"
            />
          </div>

          {/* Cost Items Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-[#0A0A0B] rounded border border-[#2D2D30] text-xs font-mono">
            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Callout Fee (ZAR)</label>
              <input
                type="number"
                value={calloutFee}
                onChange={(e) => setCalloutFee(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded bg-[#141416] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Labour Charge (ZAR)</label>
              <input
                type="number"
                value={labourAmount}
                onChange={(e) => setLabourAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded bg-[#141416] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Materials / Parts (ZAR)</label>
              <input
                type="number"
                value={materialsAmount}
                onChange={(e) => setMaterialsAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded bg-[#141416] border border-[#2D2D30] text-[#E0E0E0] font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-[#707070] block mb-1">Discount (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded bg-[#141416] border border-[#2D2D30] text-red-400 font-bold"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <label className="flex items-center space-x-2 text-xs font-mono cursor-pointer">
              <input
                type="checkbox"
                checked={vatEnabled}
                onChange={(e) => setVatEnabled(e.target.checked)}
                className="rounded accent-[#FF6321]"
              />
              <span>Calculate 15% South African VAT</span>
            </label>

            <div className="flex items-center space-x-3">
              <span className="text-sm font-mono font-bold text-[#00FF41]">
                Total:{' '}
                {formatZAR(
                  (calloutFee + labourAmount + materialsAmount) *
                    (1 - discountPct / 100) *
                    (vatEnabled ? 1.15 : 1.0)
                )}
              </span>

              <button
                onClick={handleCreateStandaloneInvoice}
                className="px-5 py-2 rounded bg-[#00FF41] hover:bg-[#00d636] text-black font-bold text-xs uppercase font-mono shadow-lg shadow-[#00FF4133]"
              >
                Issue Tax Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#2D2D30] pb-2 font-mono text-xs overflow-x-auto">
        <span className="text-[#707070] text-[10px] uppercase mr-2">Filter Status:</span>
        {(['all', 'draft', 'issued', 'paid', 'overdue', 'cancelled'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1 rounded uppercase font-bold transition-all ${
              statusFilter === st
                ? 'bg-[#007AFF] text-white'
                : 'bg-[#1A1A1C] text-[#A0A0A5] hover:text-white border border-[#2D2D30]'
            }`}
          >
            {st} ({st === 'all' ? invoices.length : invoices.filter((i) => i.status === st).length})
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#2D2D30] rounded-xl font-mono text-xs text-[#707070]">
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
                    ? 'bg-[#141A14] border-[#00FF4133]'
                    : isOverdue
                    ? 'bg-[#1E1414] border-red-500/30'
                    : 'bg-[#141416] border-[#2D2D30] hover:border-[#3D3D42]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left info */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold font-mono text-[#007AFF]">
                        {invoice.invoiceNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          isPaid
                            ? 'bg-[#00FF41] text-black'
                            : isOverdue
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-400 text-black'
                        }`}
                      >
                        {invoice.status}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#252528] text-[#A0A0A5]">
                        {invoice.serviceType}
                      </span>
                      <span className="text-xs font-mono text-[#707070]">Date: {invoice.date}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 text-xs font-mono text-[#A0A0A5] pt-0.5">
                      <span className="font-bold text-white flex items-center space-x-1">
                        <Briefcase className="w-3.5 h-3.5 text-[#FF6321]" />
                        <span>{invoice.clientName}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Phone className="w-3.5 h-3.5 text-[#00FF41]" />
                        <span>{invoice.clientPhone}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-[#007AFF]" />
                        <span>{invoice.clientAddress}</span>
                      </span>
                    </div>

                    {(invoice.scopeOfWork || invoice.notes) && (
                      <p className="text-xs text-[#707070] italic line-clamp-1 pt-0.5">
                        Scope: {invoice.scopeOfWork || invoice.notes}
                      </p>
                    )}
                  </div>

                  {/* Right Actions & Amount */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right font-mono">
                      <div className="text-base font-bold text-[#00FF41]">
                        {formatZAR(invoice.totalAmount)}
                      </div>
                      <div className="text-[10px] text-[#707070]">
                        Sub: {formatZAR(invoice.subtotal)}{' '}
                        {invoice.vatEnabled ? `• VAT: ${formatZAR(invoice.vatAmount)}` : '• Excl VAT'}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* Mark Paid Quick Button */}
                      {!isPaid && (
                        <button
                          onClick={() => markInvoicePaid(invoice.id, 'EFT')}
                          className="px-2.5 py-1.5 rounded bg-[#00FF4111] hover:bg-[#00FF4122] border border-[#00FF4144] text-[#00FF41] text-xs font-mono font-bold flex items-center space-x-1"
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
                        className="p-2 rounded bg-[#00FF4115] hover:bg-[#00FF4130] text-[#00FF41] border border-[#00FF4133]"
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
                          className="px-2.5 py-1.5 rounded bg-[#1A1A1C] hover:bg-[#252528] border border-[#2D2D30] text-[#E0E0E0] text-xs font-mono flex items-center space-x-1"
                        >
                          <Download className="w-3.5 h-3.5 text-[#FF6321]" />
                          <span>Export</span>
                          <ChevronDown className="w-3 h-3 text-[#707070]" />
                        </button>

                        {openExportMenuId === invoice.id && (
                          <div className="absolute right-0 mt-1 w-44 rounded-lg bg-[#18181B] border border-[#2D2D30] shadow-2xl z-30 py-1 font-mono text-xs">
                            <button
                              onClick={() => {
                                exportToPDF('invoice', invoice, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#27272A] flex items-center space-x-2 text-[#E0E0E0]"
                            >
                              <FileText className="w-4 h-4 text-red-400" />
                              <span>PDF Document (.pdf)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToExcel('invoice', invoice, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#27272A] flex items-center space-x-2 text-[#E0E0E0]"
                            >
                              <FileSpreadsheet className="w-4 h-4 text-green-400" />
                              <span>Excel Sheet (.xlsx)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToWord('invoice', invoice, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#27272A] flex items-center space-x-2 text-[#E0E0E0]"
                            >
                              <File className="w-4 h-4 text-blue-400" />
                              <span>Word Doc (.docx)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToPlainText('invoice', invoice, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#27272A] flex items-center space-x-2 text-[#E0E0E0]"
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
                        className="p-2 rounded bg-[#1A1A1C] hover:bg-[#252528] border border-[#2D2D30] text-[#A0A0A5] hover:text-white"
                        title="Edit Invoice"
                      >
                        <Edit2 className="w-4 h-4 text-[#007AFF]" />
                      </button>

                      {/* Delete Invoice Button */}
                      <button
                        onClick={() => setDeleteConfirmId(invoice.id)}
                        className="p-2 rounded bg-[#1A1A1C] hover:bg-red-500/20 border border-[#2D2D30] hover:border-red-500/40 text-[#707070] hover:text-red-400"
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
          <div className="w-full max-w-md p-5 rounded-xl bg-[#18181B] border border-red-500/40 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase">Confirm Invoice Deletion</h3>
            </div>
            <p className="text-xs text-[#A0A0A5]">
              Are you sure you want to permanently delete this Tax Invoice? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded bg-[#27272A] text-xs text-[#A0A0A5] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteInvoice(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase"
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
          <div className="w-full max-w-3xl rounded-xl bg-[#141416] border border-[#2D2D30] shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#2D2D30] pb-3">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-[#007AFF]" />
                <h3 className="font-bold text-sm text-white uppercase">
                  Edit Tax Invoice: {editingInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setEditingInvoice(null)}
                className="p-1 rounded text-[#707070] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Client & Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Client Name</label>
                <input
                  type="text"
                  value={editingInvoice.clientName}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, clientName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Client Phone</label>
                <input
                  type="text"
                  value={editingInvoice.clientPhone}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, clientPhone: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Status</label>
                <select
                  value={editingInvoice.status}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      status: e.target.value as InvoiceStatus,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#00FF41] font-bold uppercase"
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
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Site Address</label>
                <input
                  type="text"
                  value={editingInvoice.clientAddress}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, clientAddress: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={editingInvoice.date}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Due Date</label>
                <input
                  type="date"
                  value={editingInvoice.dueDate}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, dueDate: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>
            </div>

            {/* Scope of Work / Notes */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[#FF6321] block font-bold">
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
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-sans text-xs"
              />
            </div>

            {/* Line items manager */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#2D2D30] pb-1">
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
                  className="px-2 py-1 rounded bg-[#FF6321] text-black font-bold text-[10px] uppercase flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(editingInvoice.items || []).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="grid grid-cols-12 gap-2 p-2 rounded bg-[#0A0A0B] border border-[#2D2D30] items-center"
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
                        className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30] text-xs text-white"
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
                        className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30] text-xs text-center"
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
                        className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30] text-xs text-right"
                      />
                    </div>
                    <div className="col-span-2 text-right font-bold text-[#00FF41]">
                      {formatZAR(item.total)}
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        onClick={() => {
                          const updated = editingInvoice.items.filter((_, i) => i !== idx);
                          setEditingInvoice({ ...editingInvoice, items: updated });
                        }}
                        className="p-1 text-[#707070] hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rates & Discount */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#0A0A0B] rounded border border-[#2D2D30]">
              <div>
                <label className="text-[10px] text-[#707070] block">Callout Fee</label>
                <input
                  type="number"
                  value={editingInvoice.calloutFee || 0}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      calloutFee: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#707070] block">Labour Total</label>
                <input
                  type="number"
                  value={editingInvoice.labourTotal || 0}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      labourTotal: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#707070] block">Travel Surcharge</label>
                <input
                  type="number"
                  value={editingInvoice.travelTotal || 0}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      travelTotal: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#707070] block">Discount %</label>
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
                  className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30] text-red-400 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2D2D30]">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingInvoice.vatEnabled}
                  onChange={(e) =>
                    setEditingInvoice({ ...editingInvoice, vatEnabled: e.target.checked })
                  }
                  className="rounded accent-[#FF6321]"
                />
                <span>Include 15% South African VAT</span>
              </label>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEditingInvoice(null)}
                  className="px-3.5 py-1.5 rounded bg-[#252528] text-[#A0A0A5] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveInvoiceEdit(editingInvoice)}
                  className="px-5 py-1.5 rounded bg-[#00FF41] hover:bg-[#00d636] text-black font-bold uppercase"
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
