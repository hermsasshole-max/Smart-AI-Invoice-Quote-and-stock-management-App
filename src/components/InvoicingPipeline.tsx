import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice, InvoiceStatus, QuoteLineItem, ServiceCategory } from '../types';
import {
  formatZAR,
  calculateSellingPrice,
  calculateDocumentTotals,
  getWhatsAppShareLink,
  generateWhatsAppQuoteSummary,
} from '../utils/calculator';
import {
  exportToPDF,
  exportToExcel,
  exportToWord,
  printHtmlDocument,
} from '../utils/multiFormatExport';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { VoiceDictationButton } from './VoiceDictationButton';
import {
  FileText,
  MessageSquare,
  Printer,
  Download,
  CreditCard,
  Plus,
  Eye,
  Trash2,
  X,
  Edit2,
  MoreHorizontal,
  Check,
  Calendar,
  DollarSign,
  Zap,
} from 'lucide-react';

export const InvoicingPipeline: React.FC = () => {
  const {
    invoices,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,
    clients,
    inventory,
    profile,
    sunlightMode,
  } = useApp();

  // Modals & Active Edit States
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'EFT' | 'Cash' | 'Card' | 'Instant EFT'>('EFT');
  const [payReference, setPayReference] = useState('');
  const [openExportMenuId, setOpenExportMenuId] = useState<string | null>(null);

  // Invoice Form (Create & Edit) State
  const [isEditing, setIsEditing] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [serviceType, setServiceType] = useState<ServiceCategory>('Air Conditioning');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [calloutFee, setCalloutFee] = useState<number>(profile.defaultCalloutFee || 650);
  const [labourHours, setLabourHours] = useState<number>(4);
  const [labourRatePerHour, setLabourRatePerHour] = useState<number>(profile.defaultLabourRate || 450);
  const [travelDistanceKm, setTravelDistanceKm] = useState<number>(20);
  const [travelRatePerKm, setTravelRatePerKm] = useState<number>(profile.defaultTravelRate || 7.5);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [vatEnabled, setVatEnabled] = useState<boolean>(profile.vatEnabled ?? true);
  const [status, setStatus] = useState<InvoiceStatus>('issued');
  const [notes, setNotes] = useState('');

  const totals = calculateDocumentTotals(
    items,
    calloutFee,
    labourHours,
    labourRatePerHour,
    travelDistanceKm,
    travelRatePerKm,
    discountPct,
    vatEnabled,
    profile.vatPercentage || 15
  );

  const resetForm = () => {
    setEditingInvoiceId(null);
    setSelectedClientId('');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientAddress('');
    setServiceType('Air Conditioning');
    setScopeOfWork('');
    setItems([]);
    setCalloutFee(profile.defaultCalloutFee || 650);
    setLabourHours(4);
    setLabourRatePerHour(profile.defaultLabourRate || 450);
    setTravelDistanceKm(20);
    setTravelRatePerKm(profile.defaultTravelRate || 7.5);
    setDiscountPct(0);
    setVatEnabled(profile.vatEnabled ?? true);
    setStatus('issued');
    setNotes('');
    setIsEditing(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoiceId(inv.id);
    setSelectedClientId(inv.clientId);
    setClientName(inv.clientName);
    setClientPhone(inv.clientPhone);
    setClientEmail(inv.clientEmail || '');
    setClientAddress(inv.clientAddress);
    setServiceType(inv.serviceType);
    setScopeOfWork(inv.scopeOfWork);
    setDueDate(inv.dueDate);
    setItems(inv.items);
    setCalloutFee(inv.calloutFee);
    setLabourHours(inv.labourHours);
    setLabourRatePerHour(inv.labourRatePerHour);
    setTravelDistanceKm(inv.travelDistanceKm);
    setTravelRatePerKm(inv.travelRatePerKm);
    setDiscountPct(inv.discountPct);
    setVatEnabled(inv.vatEnabled);
    setStatus(inv.status);
    setNotes(inv.notes || '');
    setIsEditing(true);
  };

  const handleSelectClient = (cId: string) => {
    setSelectedClientId(cId);
    const found = clients.find((c) => c.id === cId);
    if (found) {
      setClientName(found.name);
      setClientPhone(found.phone);
      setClientEmail(found.email || '');
      setClientAddress(found.address);
    }
  };

  const handleAddInventoryItem = (invId: string) => {
    const found = inventory.find((i) => i.id === invId);
    if (!found) return;

    const newItem: QuoteLineItem = {
      id: 'item_' + Date.now() + Math.random().toString().slice(-4),
      description: found.name,
      category: (found.category as any) || 'Electrical',
      costPrice: found.costPrice,
      markupPct: found.defaultMarkup,
      unitPrice: found.sellingPrice,
      quantity: 1,
      unit: found.unit,
      total: found.sellingPrice,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleAddManualItem = () => {
    const newItem: QuoteLineItem = {
      id: 'item_' + Date.now(),
      description: 'Labour / Material Item',
      category: serviceType,
      costPrice: 500,
      markupPct: profile.defaultMarkup || 35,
      unitPrice: calculateSellingPrice(500, profile.defaultMarkup || 35),
      quantity: 1,
      unit: 'ea',
      total: calculateSellingPrice(500, profile.defaultMarkup || 35),
    };
    setItems((prev) => [...prev, newItem]);
  };

  const updateItem = (id: string, updates: Partial<QuoteLineItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if (updates.costPrice !== undefined || updates.markupPct !== undefined) {
          updated.unitPrice = calculateSellingPrice(updated.costPrice, updated.markupPct);
        }
        updated.total = Number(((updated.quantity || 0) * (updated.unitPrice || 0)).toFixed(2));
        return updated;
      })
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveInvoice = () => {
    if (!clientName || !clientPhone) {
      alert('Please fill in Client Name and Phone number.');
      return;
    }

    const invoiceNumber = editingInvoiceId
      ? invoices.find((i) => i.id === editingInvoiceId)?.invoiceNumber || 'INV-2026-0001'
      : `INV-${new Date().getFullYear()}-${String(invoices.length + 89).padStart(4, '0')}`;

    const existingAmountPaid = editingInvoiceId
      ? invoices.find((i) => i.id === editingInvoiceId)?.amountPaid || 0
      : 0;

    const payload: Omit<Invoice, 'id'> = {
      invoiceNumber,
      date: new Date().toISOString().split('T')[0],
      dueDate,
      clientId: selectedClientId || 'c_' + Date.now(),
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      serviceType,
      scopeOfWork,
      items,
      calloutFee: totals.calloutFee,
      labourHours,
      labourRatePerHour,
      labourTotal: totals.labourTotal,
      travelDistanceKm,
      travelRatePerKm,
      travelTotal: totals.travelTotal,
      subtotal: totals.subtotal,
      discountPct: totals.discountPct,
      discountAmount: totals.discountAmount,
      vatEnabled: totals.vatEnabled,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
      amountPaid: existingAmountPaid,
      status: existingAmountPaid >= totals.totalAmount ? 'paid' : status,
      notes,
      terms: 'Strictly 7 Days from Invoice Date. Direct Bank Transfer (EFT). Materials remain property of contractor until settled in full.',
    };

    if (editingInvoiceId) {
      updateInvoice(editingInvoiceId, payload);
    } else {
      addInvoice(payload);
    }

    resetForm();
  };

  const handleOpenPayment = (inv: Invoice) => {
    const remaining = inv.totalAmount - inv.amountPaid;
    setPayAmount(remaining > 0 ? remaining : 0);
    setPayReference(`PAY-${inv.invoiceNumber}`);
    setPaymentModalInvoice(inv);
  };

  const handleRecordPayment = () => {
    if (!paymentModalInvoice || payAmount <= 0) return;
    recordPayment(paymentModalInvoice.id, payAmount, payMethod, payReference);
    setPaymentModalInvoice(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
            <span>Invoicing & Payment Settlement</span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
              EFT & SANS Compliant
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Issue official tax invoices, log partial or full EFT settlements, and dispatch automated payment receipts via WhatsApp.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Create Direct Tax Invoice</span>
        </button>
      </div>

      {/* Invoice Form (Inline Drawer/Card for Create/Edit) */}
      {isEditing && (
        <div className="p-6 rounded-2xl bg-[#1B1E28] border-2 border-emerald-500/40 shadow-2xl space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-[#282E3E]">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {editingInvoiceId ? 'Edit Tax Invoice' : 'New Tax Invoice'}
                </h3>
                <p className="text-xs text-slate-400">
                  Update customer billing information, line items, and settlement terms
                </p>
              </div>
            </div>
            <button onClick={resetForm} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">
                Select Client Directory
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleSelectClient(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                <option value="">-- Choose Existing Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">
                Client Name *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Dr. Johan van der Merwe"
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-emerald-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">
                Phone Number (WhatsApp) *
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. 082 555 1290"
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">
                Site / Physical Address
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. 42 Sandown Manor, Sandton, Johannesburg"
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">
                Invoice Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-3">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-slate-300 font-mono font-bold uppercase">
                  Scope of Work Performed
                </label>
                <VoiceDictationButton
                  onTranscript={(text) => setScopeOfWork((prev) => (prev ? prev + ' ' + text : text))}
                />
              </div>
              <textarea
                rows={2}
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                placeholder="Describe scope of work completed..."
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Line Items Schedule */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-white text-sm uppercase font-mono tracking-wider">
                Material & Labour Schedule ({items.length})
              </h4>
              <div className="flex space-x-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddInventoryItem(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#12141C] border border-emerald-500/50 text-emerald-400 text-xs font-semibold"
                >
                  <option value="">+ Add Van Stock...</option>
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({formatZAR(i.sellingPrice)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="px-3 py-1.5 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-emerald-400 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#12141C] border border-[#282E3E] grid grid-cols-12 gap-2 items-center text-xs"
                >
                  <div className="col-span-12 md:col-span-4">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white"
                      placeholder="Item description"
                    />
                  </div>

                  <div className="col-span-4 md:col-span-2">
                    <input
                      type="number"
                      value={item.costPrice}
                      onChange={(e) => updateItem(item.id, { costPrice: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono text-right"
                      placeholder="Cost (R)"
                    />
                  </div>

                  <div className="col-span-4 md:col-span-2">
                    <input
                      type="number"
                      value={item.markupPct}
                      onChange={(e) => updateItem(item.id, { markupPct: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-emerald-400 font-mono text-right"
                      placeholder="Markup %"
                    />
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono text-center"
                      placeholder="Qty"
                    />
                  </div>

                  <div className="col-span-2 md:col-span-2 font-mono font-bold text-white text-right">
                    {formatZAR(item.total)}
                  </div>

                  <div className="col-span-12 md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown & VAT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#282E3E]">
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Labour Hours</label>
                  <input
                    type="number"
                    value={labourHours}
                    onChange={(e) => setLabourHours(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#12141C] border border-[#334155] text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Labour Rate (R/hr)</label>
                  <input
                    type="number"
                    value={labourRatePerHour}
                    onChange={(e) => setLabourRatePerHour(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#12141C] border border-[#334155] text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-300 font-medium">15% South African VAT:</span>
                <button
                  type="button"
                  onClick={() => setVatEnabled(!vatEnabled)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    vatEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-[#12141C] text-slate-400 border border-[#334155]'
                  }`}
                >
                  {vatEnabled ? '15% VAT ACTIVE' : 'VAT EXEMPT'}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="text-white font-bold">{formatZAR(totals.subtotal)}</span>
              </div>
              {totals.vatEnabled && (
                <div className="flex justify-between text-slate-400">
                  <span>VAT (15%):</span>
                  <span className="text-white font-bold">{formatZAR(totals.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-white pt-2 border-t border-[#334155]">
                <span>TOTAL INVOICE:</span>
                <span className="text-emerald-400">{formatZAR(totals.totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-[#282E3E]">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-xl bg-[#282E3E] text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveInvoice}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Save Tax Invoice</span>
            </button>
          </div>
        </div>
      )}

      {/* Invoice List */}
      <div className="space-y-3">
        {invoices.map((inv) => {
          const balance = inv.totalAmount - inv.amountPaid;
          const isPaid = inv.status === 'paid' || inv.amountPaid >= inv.totalAmount;
          const isOverdue = !isPaid && new Date(inv.dueDate) < new Date();

          const waSummary = generateWhatsAppQuoteSummary('invoice', inv, profile);
          const waLink = getWhatsAppShareLink(inv.clientPhone, waSummary);

          return (
            <div
              key={inv.id}
              className={`p-5 rounded-2xl border transition-all ${
                sunlightMode
                  ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                  : 'bg-[#1B1E28] border-[#282E3E] text-white hover:border-[#334155]'
              }`}
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Invoice Details */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                      {inv.invoiceNumber}
                    </span>
                    <h4 className="font-bold text-base">{inv.clientName}</h4>
                    <span
                      className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                        isPaid
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isOverdue
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {isPaid ? 'PAID IN FULL' : isOverdue ? 'OVERDUE' : inv.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400">
                    📞 {inv.clientPhone} • Due Date: <strong className="text-slate-200">{inv.dueDate}</strong> • 📍 {inv.clientAddress}
                  </div>

                  <div className="text-xs text-slate-300 font-medium">
                    <span className="text-sky-400">[{inv.serviceType}]</span> {inv.scopeOfWork}
                  </div>
                </div>

                {/* Financials & Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right font-mono pr-2">
                    <div className="text-xs text-slate-400">
                      Total: <span className="font-bold text-white">{formatZAR(inv.totalAmount)}</span>
                    </div>
                    <div className="text-sm font-black">
                      {isPaid ? (
                        <span className="text-emerald-400">PAID</span>
                      ) : (
                        <span className="text-amber-400">Due: {formatZAR(balance)}</span>
                      )}
                    </div>
                  </div>

                  {/* Record Payment CTA */}
                  {!isPaid && (
                    <button
                      onClick={() => handleOpenPayment(inv)}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Log Payment</span>
                    </button>
                  )}

                  {/* Edit Invoice */}
                  <button
                    onClick={() => handleOpenEdit(inv)}
                    className="p-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 hover:text-sky-400 transition-colors cursor-pointer"
                    title="Edit Invoice Details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* WhatsApp */}
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
                    title="Send Tax Invoice via WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>

                  {/* Preview Document */}
                  <button
                    onClick={() => setPreviewInvoice(inv)}
                    className="p-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 cursor-pointer"
                    title="Preview Tax Invoice"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* Export Options */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenExportMenuId(openExportMenuId === inv.id ? null : inv.id)}
                      className="p-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 cursor-pointer"
                      title="Export Options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {openExportMenuId === inv.id && (
                      <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#12141C] border border-[#334155] shadow-2xl py-1 z-30 text-xs">
                        <button
                          onClick={() => {
                            printHtmlDocument('invoice', inv, profile);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-amber-400 font-semibold border-b border-[#334155] cursor-pointer"
                        >
                          <Printer className="w-4 h-4 text-amber-400" />
                          <span>Print / Save as PDF</span>
                        </button>

                        <button
                          onClick={() => {
                            exportToPDF('invoice', inv, profile);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200 cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-sky-400" />
                          <span>Download PDF</span>
                        </button>

                        <button
                          onClick={() => {
                            exportToExcel('invoice', inv, profile);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200 cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-emerald-400" />
                          <span>Export to Excel (.xlsx)</span>
                        </button>

                        <button
                          onClick={() => {
                            exportToWord('invoice', inv, profile);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200 cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-blue-400" />
                          <span>Export to Word (.docx)</span>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('Delete this invoice?')) {
                              deleteInvoice(inv.id);
                            }
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-red-500/10 flex items-center space-x-2 text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Invoice</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {invoices.length === 0 && (
          <div className="p-12 text-center rounded-2xl border border-dashed border-[#334155] text-slate-400 text-xs">
            No invoices issued yet. Convert an approved quotation in the Quotations tab or create a direct Tax Invoice above.
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#282E3E]">
              <div>
                <h3 className="font-bold text-white text-base">Record Payment Settlement</h3>
                <p className="text-xs text-slate-400 font-mono">{paymentModalInvoice.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Amount Paid (ZAR)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-amber-400 font-mono font-black text-lg focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="EFT">Electronic Funds Transfer (EFT)</option>
                  <option value="Instant EFT">Instant EFT / Ozow / PayFast</option>
                  <option value="Cash">Cash on Hand</option>
                  <option value="Card">Card Machine (Yoco / Speedpoint)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Bank Reference Number</label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. TYME-REF-9921"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-[#282E3E]">
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="px-4 py-2 rounded-xl bg-[#282E3E] text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewInvoice}
        onClose={() => setPreviewInvoice(null)}
        docType="invoice"
        data={previewInvoice}
      />
    </div>
  );
};
