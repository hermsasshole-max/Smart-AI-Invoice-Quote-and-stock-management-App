import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice, InvoiceStatus, QuoteLineItem, ServiceCategory, ConsumablesTier } from '../types';
import {
  formatZAR,
  calculateSellingPrice,
  calculateDocumentTotals,
  getWhatsAppShareLink,
  generateWhatsAppQuoteSummary,
  CONSUMABLE_PRESETS,
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
  Wrench,
  Package,
  Layers,
  Archive,
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
  const [labourHours, setLabourHours] = useState<number>(2);
  const [labourRatePerHour, setLabourRatePerHour] = useState<number>(profile.defaultLabourRate || 450);
  const [travelDistanceKm, setTravelDistanceKm] = useState<number>(20);
  const [travelRatePerKm, setTravelRatePerKm] = useState<number>(profile.defaultTravelRate || 7.5);
  const [consumablesTier, setConsumablesTier] = useState<ConsumablesTier>('standard');
  const [consumablesFee, setConsumablesFee] = useState<number>(350);
  const [consumablesDescription, setConsumablesDescription] = useState<string>(
    'Fasteners, Sealant, Saddles, UV Ties, Lugs, Glands & Fixings'
  );
  const [miscellaneousDescription, setMiscellaneousDescription] = useState<string>('');
  const [miscellaneousFee, setMiscellaneousFee] = useState<number>(0);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [vatEnabled, setVatEnabled] = useState<boolean>(profile.vatEnabled ?? true);
  const [deductStockOnSave, setDeductStockOnSave] = useState<boolean>(true);
  const [status, setStatus] = useState<InvoiceStatus>('issued');
  const [notes, setNotes] = useState('');

  const totals = calculateDocumentTotals(
    items,
    calloutFee,
    labourHours,
    labourRatePerHour,
    travelDistanceKm,
    travelRatePerKm,
    consumablesFee,
    miscellaneousFee,
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
    setLabourHours(2);
    setLabourRatePerHour(profile.defaultLabourRate || 450);
    setTravelDistanceKm(20);
    setTravelRatePerKm(profile.defaultTravelRate || 7.5);
    setConsumablesTier('standard');
    setConsumablesFee(350);
    setConsumablesDescription('Fasteners, Sealant, Saddles, UV Ties, Lugs, Glands & Fixings');
    setMiscellaneousDescription('');
    setMiscellaneousFee(0);
    setDiscountPct(0);
    setVatEnabled(profile.vatEnabled ?? true);
    setDeductStockOnSave(true);
    setStatus('issued');
    setNotes('');
    setIsEditing(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleTierSelect = (tier: ConsumablesTier) => {
    setConsumablesTier(tier);
    const preset = CONSUMABLE_PRESETS.find((p) => p.tier === tier);
    if (preset) {
      setConsumablesFee(preset.price);
      if (tier !== 'custom') {
        setConsumablesDescription(preset.description);
      }
    }
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
    setCalloutFee(inv.calloutFee ?? profile.defaultCalloutFee ?? 650);
    setLabourHours(inv.labourHours ?? 0);
    setLabourRatePerHour(inv.labourRatePerHour ?? profile.defaultLabourRate ?? 450);
    setTravelDistanceKm(inv.travelDistanceKm ?? 0);
    setTravelRatePerKm(inv.travelRatePerKm ?? profile.defaultTravelRate ?? 7.5);
    setConsumablesTier(inv.consumablesTier || 'standard');
    setConsumablesFee(inv.consumablesFee ?? 350);
    setConsumablesDescription(inv.consumablesDescription || 'Fasteners, Sealant, Saddles, UV Ties, Lugs, Glands & Fixings');
    setMiscellaneousDescription(inv.miscellaneousDescription || '');
    setMiscellaneousFee(inv.miscellaneousFee ?? 0);
    setDiscountPct(inv.discountPct ?? 0);
    setVatEnabled(inv.vatEnabled ?? true);
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
      inventoryId: found.id,
      description: found.name,
      category: (found.category as any) || 'Hardware & Site Materials',
      costPrice: found.costPrice,
      markupPct: found.defaultMarkup,
      unitPrice: found.sellingPrice,
      quantity: 1,
      unit: found.unit,
      notes: found.sku,
      total: found.sellingPrice,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleAddManualItem = () => {
    const newItem: QuoteLineItem = {
      id: 'item_' + Date.now(),
      description: 'Site Material / Equipment Item',
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
      alert('Please provide client name and phone number.');
      return;
    }

    const invoiceNumber = editingInvoiceId
      ? invoices.find((i) => i.id === editingInvoiceId)?.invoiceNumber || 'INV-2026-0001'
      : `INV-${new Date().getFullYear()}-${String(invoices.length + 101).padStart(4, '0')}`;

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
      additionalLabourTotal: totals.additionalLabourAmount,
      travelDistanceKm,
      travelRatePerKm,
      travelTotal: totals.travelTotal,
      consumablesTier,
      consumablesFee: totals.consumablesFee,
      consumablesDescription,
      miscellaneousDescription,
      miscellaneousFee: totals.miscellaneousFee,
      subtotal: totals.subtotal,
      discountPct: totals.discountPct,
      discountAmount: totals.discountAmount,
      vatEnabled: totals.vatEnabled,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
      amountPaid: editingInvoiceId ? invoices.find((i) => i.id === editingInvoiceId)?.amountPaid || 0 : 0,
      status,
      terms: 'Strictly 7 days from invoice presentation. EFT / Card payments accepted.',
      notes,
    };

    if (editingInvoiceId) {
      updateInvoice(editingInvoiceId, payload);
    } else {
      addInvoice(payload, deductStockOnSave);
    }

    resetForm();
  };

  const handleOpenPayment = (inv: Invoice) => {
    setPaymentModalInvoice(inv);
    const balance = Number((inv.totalAmount - inv.amountPaid).toFixed(2));
    setPayAmount(balance > 0 ? balance : 0);
    setPayMethod('EFT');
    setPayReference(`PAY-${Date.now().toString().slice(-4)}`);
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

          {/* Labour, Travel, Consumables, Surcharges & Financial Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-[#282E3E]">
            {/* Left 7 cols: Inputs */}
            <div className="lg:col-span-7 space-y-4 text-xs">
              {/* 1. Structured Labor & Call-Out Breakdown */}
              <div className="p-4 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-emerald-400 uppercase font-mono flex items-center space-x-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>1. Structured Labor & Call-Out Fee</span>
                  </h5>
                  <span className="text-[10px] text-slate-400 font-mono">1st Hour Included in Call-Out</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Call-Out (Incl 1st Hr)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">R</span>
                      <input
                        type="number"
                        value={calloutFee}
                        onChange={(e) => setCalloutFee(Number(e.target.value) || 0)}
                        className="w-full pl-7 pr-2.5 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Additional Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={labourHours}
                      onChange={(e) => setLabourHours(Number(e.target.value) || 0)}
                      placeholder="After 1st hour"
                      className="w-full px-2.5 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Hourly Rate (ZAR)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">R</span>
                      <input
                        type="number"
                        value={labourRatePerHour}
                        onChange={(e) => setLabourRatePerHour(Number(e.target.value) || 0)}
                        className="w-full pl-7 pr-2.5 py-2 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto-calculated Labor Formula Badge */}
                <div className="p-2.5 rounded-lg bg-[#181B26] border border-[#2B3142] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 font-mono text-[11px]">
                  <div className="text-slate-400">
                    <span>Formula: </span>
                    <span className="text-slate-300">
                      {formatZAR(calloutFee)} (Call-Out) + {labourHours} hrs × {formatZAR(labourRatePerHour)} ({formatZAR(totals.additionalLabourAmount)})
                    </span>
                  </div>
                  <div className="text-emerald-400 font-bold">
                    Total Labor: {formatZAR(totals.totalLabourAmount)}
                  </div>
                </div>
              </div>

              {/* 2. Consumables & Fasteners Section */}
              <div className="p-4 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-amber-400 uppercase font-mono flex items-center space-x-1.5">
                    <Package className="w-3.5 h-3.5" />
                    <span>2. Consumables & Fasteners</span>
                  </h5>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">{formatZAR(totals.consumablesFee)}</span>
                </div>

                {/* Preset Tier Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {CONSUMABLE_PRESETS.map((preset) => {
                    const isSelected = consumablesTier === preset.tier;
                    return (
                      <button
                        key={preset.tier}
                        type="button"
                        onClick={() => handleTierSelect(preset.tier)}
                        className={`p-2 rounded-lg text-left transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                            : 'bg-[#1B1E28] border-[#334155] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="font-bold text-[11px] truncate">{preset.label.split('(')[0]}</div>
                        <div className="font-mono text-[10px] text-amber-400 mt-0.5">
                          {preset.tier === 'custom' ? 'Custom' : formatZAR(preset.price)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom input or tier description */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1 text-[11px]">Consumables Description / Items Included</label>
                    <input
                      type="text"
                      value={consumablesDescription}
                      onChange={(e) => setConsumablesDescription(e.target.value)}
                      placeholder="e.g. Screws, Rawl Plugs, PVC Tape, Saddles, UV Ties"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Consumables Fee (ZAR)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">R</span>
                      <input
                        type="number"
                        value={consumablesFee}
                        onChange={(e) => {
                          setConsumablesFee(Number(e.target.value) || 0);
                          setConsumablesTier('custom');
                        }}
                        className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-amber-400 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Travel, Logistics & Miscellaneous Charges */}
              <div className="p-4 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-3">
                <h5 className="font-bold text-sky-400 uppercase font-mono flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>3. Logistics, Travel & Miscellaneous Surcharges</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Travel Distance (Km round trip)</label>
                    <input
                      type="number"
                      value={travelDistanceKm}
                      onChange={(e) => setTravelDistanceKm(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Travel Rate / Km (ZAR)</label>
                    <input
                      type="number"
                      value={travelRatePerKm}
                      onChange={(e) => setTravelRatePerKm(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono"
                    />
                  </div>
                </div>

                {/* Miscellaneous / Extra line */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-[#282E3E]">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1 text-[11px]">Miscellaneous Description (Optional)</label>
                    <input
                      type="text"
                      value={miscellaneousDescription}
                      onChange={(e) => setMiscellaneousDescription(e.target.value)}
                      placeholder="e.g. Scaffolding rental, Cherry picker, Disposal fee"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Misc Charge (ZAR)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">R</span>
                      <input
                        type="number"
                        value={miscellaneousFee}
                        onChange={(e) => setMiscellaneousFee(Number(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Discount & VAT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#282E3E]">
                  <div>
                    <label className="block text-slate-400 mb-1">Client Discount (%)</label>
                    <input
                      type="number"
                      value={discountPct}
                      onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-amber-400 font-mono font-bold"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="block text-slate-400 mb-1">15% South African VAT</label>
                    <button
                      type="button"
                      onClick={() => setVatEnabled(!vatEnabled)}
                      className={`w-full py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        vatEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-[#1B1E28] text-slate-400 border border-[#334155]'
                      }`}
                    >
                      {vatEnabled ? '15% VAT ACTIVE' : 'VAT EXEMPT'}
                    </button>
                  </div>
                </div>

                {/* Stock Deduction Toggle on Save */}
                {!editingInvoiceId && (
                  <div className="p-3 rounded-lg bg-[#181B26] border border-[#282E3E] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Archive className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="text-white font-semibold text-xs">Deduct Van Stock Items</div>
                        <div className="text-slate-400 text-[10px]">Automatically update inventory stock levels for billed line items</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeductStockOnSave(!deductStockOnSave)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        deductStockOnSave
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-[#1B1E28] text-slate-400 border border-[#334155]'
                      }`}
                    >
                      {deductStockOnSave ? 'DEDUCT STOCK: YES' : 'NO DEDUCTION'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 cols: Live Calculated Financial Summary Card */}
            <div className="lg:col-span-5">
              <div className="p-5 rounded-2xl bg-[#141722] border border-[#282E3E] space-y-3 font-mono text-xs shadow-lg sticky top-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#282E3E]">
                  <h5 className="font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Tax Invoice Summary</span>
                  </h5>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                    Live
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Materials & Equipment:</span>
                    <span className="text-white font-bold">{formatZAR(totals.itemsTotal)}</span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Call-Out Fee (1st Hr Included):</span>
                    <span className="text-slate-300 font-semibold">{formatZAR(totals.calloutFee)}</span>
                  </div>

                  {totals.additionalLabourHours > 0 && (
                    <div className="flex justify-between text-slate-400 pl-2 text-[11px]">
                      <span>Addl Labour ({totals.additionalLabourHours} hrs @ {formatZAR(totals.labourRatePerHour)}):</span>
                      <span className="text-slate-300">+{formatZAR(totals.additionalLabourAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-[#232838]">
                    <span>Total Labor Subtotal:</span>
                    <span>{formatZAR(totals.totalLabourAmount)}</span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Logistics ({travelDistanceKm} km @ {formatZAR(travelRatePerKm)}):</span>
                    <span className="text-white font-bold">{formatZAR(totals.travelTotal)}</span>
                  </div>

                  {totals.consumablesFee > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Consumables ({consumablesTier.toUpperCase()}):</span>
                      <span className="font-bold">{formatZAR(totals.consumablesFee)}</span>
                    </div>
                  )}

                  {totals.miscellaneousFee > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span className="truncate max-w-[170px]">Misc ({miscellaneousDescription || 'Extras'}):</span>
                      <span className="text-white font-bold">{formatZAR(totals.miscellaneousFee)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-300 pt-2 border-t border-[#282E3E]">
                    <span className="font-bold">Subtotal (Excl VAT):</span>
                    <span className="text-white font-black">{formatZAR(totals.subtotal)}</span>
                  </div>

                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>Discount ({totals.discountPct}%):</span>
                      <span>-{formatZAR(totals.discountAmount)}</span>
                    </div>
                  )}

                  {totals.vatEnabled && (
                    <div className="flex justify-between text-slate-400">
                      <span>South African VAT (15%):</span>
                      <span className="text-white font-bold">{formatZAR(totals.vatAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-black text-white pt-3 border-t-2 border-[#334155]">
                    <span>TOTAL INVOICE:</span>
                    <span className="text-emerald-400 text-lg">{formatZAR(totals.totalAmount)}</span>
                  </div>
                </div>
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
