import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Quotation, QuoteLineItem, ServiceCategory, QuoteStatus } from '../types';
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
  exportToPlainText,
  printHtmlDocument,
  openPdfInNewTab,
} from '../utils/multiFormatExport';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { VoiceInvoiceWizard } from './VoiceInvoiceWizard';
import { ReceiptScannerModal } from './ReceiptScannerModal';
import { VoiceDictationButton } from './VoiceDictationButton';
import {
  Plus,
  Trash2,
  FileText,
  MessageSquare,
  Printer,
  Download,
  Share2,
  DollarSign,
  Calendar,
  Sparkles,
  Eye,
  Percent,
  Check,
  Zap,
  Mic,
  Scan,
  Send,
  ArrowRight,
  MoreHorizontal,
} from 'lucide-react';

export const QuotationEngine: React.FC = () => {
  const {
    quotes,
    addQuote,
    updateQuote,
    deleteQuote,
    convertQuoteToInvoice,
    clients,
    inventory,
    profile,
    sunlightMode,
  } = useApp();

  const [isCreating, setIsCreating] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [serviceType, setServiceType] = useState<ServiceCategory>('Air Conditioning');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [calloutFee, setCalloutFee] = useState(profile.defaultCalloutFee || 650);
  const [labourHours, setLabourHours] = useState(4);
  const [labourRatePerHour, setLabourRatePerHour] = useState(profile.defaultLabourRate || 450);
  const [travelDistanceKm, setTravelDistanceKm] = useState(20);
  const [travelRatePerKm, setTravelRatePerKm] = useState(profile.defaultTravelRate || 7.5);
  const [discountPct, setDiscountPct] = useState(0);
  const [vatEnabled, setVatEnabled] = useState(profile.vatEnabled ?? true);
  const [notes, setNotes] = useState('');

  // Modals
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [openExportMenuId, setOpenExportMenuId] = useState<string | null>(null);

  // Pick client helper
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

  // Add Item from Inventory
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

  // Add blank manual item
  const handleAddManualItem = () => {
    const newItem: QuoteLineItem = {
      id: 'item_' + Date.now(),
      description: 'Labour / Material Line Item',
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

  // Update item
  const updateItem = (id: string, updates: Partial<QuoteLineItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };

        // Recalculate price if cost or markup changed
        if (updates.costPrice !== undefined || updates.markupPct !== undefined) {
          updated.unitPrice = calculateSellingPrice(updated.costPrice, updated.markupPct);
        }
        // Recalculate line total
        updated.total = Number(((updated.quantity || 0) * (updated.unitPrice || 0)).toFixed(2));
        return updated;
      })
    );
  };

  // Remove item
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Calculated Totals
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

  // Reset form
  const resetForm = () => {
    setEditingQuoteId(null);
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
    setNotes('');
    setIsCreating(false);
  };

  // Save Quote
  const handleSaveQuote = (status: QuoteStatus = 'sent') => {
    if (!clientName || !clientPhone) {
      alert('Please enter client name and phone number.');
      return;
    }

    const quoteNumber = editingQuoteId
      ? quotes.find((q) => q.id === editingQuoteId)?.quoteNumber || 'Q-2026-0001'
      : `Q-${new Date().getFullYear()}-${String(quotes.length + 143).padStart(4, '0')}`;

    const quotePayload: Omit<Quotation, 'id'> = {
      quoteNumber,
      date: new Date().toISOString().split('T')[0],
      expiryDate,
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
      status,
      notes,
      terms: '80% Deposit on acceptance, balance upon commissioning. Materials remain property of contractor until settled.',
    };

    if (editingQuoteId) {
      updateQuote(editingQuoteId, quotePayload);
    } else {
      addQuote(quotePayload);
    }

    resetForm();
  };

  const handleEditQuote = (quote: Quotation) => {
    setEditingQuoteId(quote.id);
    setSelectedClientId(quote.clientId);
    setClientName(quote.clientName);
    setClientPhone(quote.clientPhone);
    setClientEmail(quote.clientEmail || '');
    setClientAddress(quote.clientAddress);
    setServiceType(quote.serviceType);
    setScopeOfWork(quote.scopeOfWork);
    setExpiryDate(quote.expiryDate);
    setItems(quote.items);
    setCalloutFee(quote.calloutFee);
    setLabourHours(quote.labourHours);
    setLabourRatePerHour(quote.labourRatePerHour);
    setTravelDistanceKm(quote.travelDistanceKm);
    setTravelRatePerKm(quote.travelRatePerKm);
    setDiscountPct(quote.discountPct);
    setVatEnabled(quote.vatEnabled);
    setNotes(quote.notes || '');
    setIsCreating(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
            <span>Fast On-Site Quotation Engine</span>
            <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
              ZAR & 15% VAT
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Build accurate electrical, HVAC, & solar quotations in under 60 seconds with instant WhatsApp delivery.
          </p>
        </div>

        {!isCreating && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-sky-600/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Quote</span>
            </button>
          </div>
        )}
      </div>

      {/* Quote Form View */}
      {isCreating ? (
        <div className="p-6 rounded-2xl bg-[#1B1E28] border border-[#282E3E] space-y-6 shadow-xl">
          <div className="flex justify-between items-center pb-4 border-b border-[#282E3E]">
            <h3 className="font-black text-white text-lg flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>{editingQuoteId ? 'Edit Quotation' : 'New On-Site Quotation'}</span>
            </h3>

            <div className="flex items-center space-x-2">
              {/* Hands-Free Voice Button */}
              <button
                type="button"
                onClick={() => setIsVoiceOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-amber-400 text-xs font-semibold flex items-center space-x-1.5 border border-[#334155] cursor-pointer"
              >
                <Mic className="w-4 h-4 text-amber-400" />
                <span>Voice Wizard</span>
              </button>

              {/* OCR Slip Scanner Button */}
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-sky-400 text-xs font-semibold flex items-center space-x-1.5 border border-[#334155] cursor-pointer"
              >
                <Scan className="w-4 h-4 text-sky-400" />
                <span>Scan Supplier Slip</span>
              </button>
            </div>
          </div>

          {/* Client & Service Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Quick Pick Client */}
            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">
                Existing Client (Optional)
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleSelectClient(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
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
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">Client Full Name *</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Johan Van Der Merwe"
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">Client Phone (WhatsApp) *</label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. +27 82 123 4567"
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">Client Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. client@example.co.za"
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">Site / Physical Address</label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. 42 Sandton Drive, Sandhurst, Sandton"
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Category & Scope */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">Service Category</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceCategory)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500 font-medium"
              >
                <option value="Electrical">Electrical Installations & Repairs</option>
                <option value="Air Conditioning">Air Conditioning (HVAC)</option>
                <option value="Solar & Backup">Solar & Backup Power (Inverters/Batteries)</option>
                <option value="Security & CCTV">Security & CCTV Surveillance</option>
                <option value="Automation & Gate Motors">Gate Automation & Intercoms</option>
                <option value="Maintenance & Repairs">General Technical Maintenance</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">Valid Until Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-mono font-bold uppercase mb-1">Add from Van Stock</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddInventoryItem(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-sky-500/50 text-sky-300 focus:outline-none focus:border-sky-400 font-semibold"
              >
                <option value="">+ Pick Van Stock SKU...</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({formatZAR(item.sellingPrice)})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-slate-300 font-mono font-bold uppercase">Technical Scope of Work</label>
                <VoiceDictationButton
                  onTranscript={(text) => setScopeOfWork((prev) => (prev ? prev + ' ' + text : text))}
                />
              </div>
              <textarea
                rows={2}
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                placeholder="Describe the job: e.g. Supply and install 12000 BTU Inverter unit, 4m copper lines, bracket, disconnect isolator..."
                className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-white text-sm uppercase font-mono tracking-wider flex items-center space-x-2">
                <span>Material & Equipment Schedule ({items.length})</span>
              </h4>
              <button
                type="button"
                onClick={handleAddManualItem}
                className="px-3 py-1 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-sky-400 text-xs font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#12141C] border border-[#282E3E] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center text-xs"
                >
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Item description"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-medium focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center space-x-1">
                    <span className="text-[10px] text-slate-400">Cost:</span>
                    <input
                      type="number"
                      value={item.costPrice}
                      onChange={(e) => updateItem(item.id, { costPrice: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-amber-400 font-mono text-right"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center space-x-1">
                    <span className="text-[10px] text-slate-400">Markup:</span>
                    <input
                      type="number"
                      value={item.markupPct}
                      onChange={(e) => updateItem(item.id, { markupPct: Number(e.target.value) || 0 })}
                      className="w-14 px-1.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono text-center"
                    />
                    <span className="text-slate-400 font-mono">%</span>
                  </div>

                  <div className="sm:col-span-2 flex items-center space-x-1">
                    <span className="text-[10px] text-slate-400">Qty:</span>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 1 })}
                      className="w-14 px-1.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono text-center font-bold"
                    />
                    <span className="text-slate-400 text-[10px]">{item.unit}</span>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between">
                    <div className="font-mono font-bold text-sky-400 text-sm">{formatZAR(item.total)}</div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="p-6 rounded-xl border border-dashed border-[#334155] text-center text-slate-400 text-xs">
                  No materials added yet. Add from van stock, scan a supplier slip, or click "Add Custom Item".
                </div>
              )}
            </div>
          </div>

          {/* Labour, Travel, Surcharges & Financial Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#282E3E]">
            {/* Left: Labour & Logistics Inputs */}
            <div className="p-4 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-3 text-xs">
              <h5 className="font-bold text-sky-400 uppercase font-mono">Labour, Logistics & Surcharges</h5>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Standard Callout Fee (ZAR)</label>
                  <input
                    type="number"
                    value={calloutFee}
                    onChange={(e) => setCalloutFee(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Labour Hours</label>
                  <input
                    type="number"
                    value={labourHours}
                    onChange={(e) => setLabourHours(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Labour Rate / Hr (ZAR)</label>
                  <input
                    type="number"
                    value={labourRatePerHour}
                    onChange={(e) => setLabourRatePerHour(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Travel Distance (Km)</label>
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

                <div>
                  <label className="block text-slate-400 mb-1">Client Discount (%)</label>
                  <input
                    type="number"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-amber-400 font-mono font-bold"
                  />
                </div>
              </div>

              {/* VAT Toggle */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-300 font-medium">Charge 15% South African VAT:</span>
                <button
                  type="button"
                  onClick={() => setVatEnabled(!vatEnabled)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    vatEnabled
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                      : 'bg-[#1B1E28] text-slate-400 border border-[#334155]'
                  }`}
                >
                  {vatEnabled ? '15% VAT ACTIVE' : 'VAT EXEMPT'}
                </button>
              </div>
            </div>

            {/* Right: Calculated Financial Breakdown */}
            <div className="p-4 rounded-xl bg-[#151722] border border-[#282E3E] space-y-2 font-mono text-xs">
              <h5 className="font-bold text-white uppercase tracking-wider mb-2">Quote Financial Summary</h5>

              <div className="flex justify-between text-slate-400">
                <span>Materials Total:</span>
                <span className="text-white font-bold">{formatZAR(totals.itemsTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Callout & Diagnostics:</span>
                <span className="text-white font-bold">{formatZAR(totals.calloutFee)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Labour ({labourHours} hrs @ {formatZAR(labourRatePerHour)}):</span>
                <span className="text-white font-bold">{formatZAR(totals.labourTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Logistics ({travelDistanceKm} km @ {formatZAR(travelRatePerKm)}):</span>
                <span className="text-white font-bold">{formatZAR(totals.travelTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-1 border-t border-[#282E3E]">
                <span>Subtotal (Excl VAT):</span>
                <span className="text-white font-bold">{formatZAR(totals.subtotal)}</span>
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

              <div className="flex justify-between text-base font-black text-white pt-2 border-t-2 border-[#334155]">
                <span>TOTAL AMOUNT:</span>
                <span className="text-amber-400">{formatZAR(totals.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-[#282E3E]">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSaveQuote('draft')}
              className="px-4 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs font-bold cursor-pointer"
            >
              Save as Draft
            </button>

            <button
              type="button"
              onClick={() => handleSaveQuote('sent')}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-sky-500/20 cursor-pointer active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Finalize & Issue Quotation</span>
            </button>
          </div>
        </div>
      ) : (
        /* Quotation Pipeline List */
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {quotes.map((quote) => {
              const waSummary = generateWhatsAppQuoteSummary('quote', quote, profile);
              const waLink = getWhatsAppShareLink(quote.clientPhone, waSummary);

              return (
                <div
                  key={quote.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    sunlightMode
                      ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      : 'bg-[#1B1E28] border-[#282E3E] text-white hover:border-[#334155]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    {/* Left: Info */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-bold border border-sky-500/30">
                          {quote.quoteNumber}
                        </span>
                        <h4 className="font-bold text-base">{quote.clientName}</h4>
                        <span
                          className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                            quote.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : quote.status === 'invoiced'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {quote.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        📞 {quote.clientPhone} • 📍 {quote.clientAddress}
                      </div>

                      <div className="text-xs text-slate-300 font-medium line-clamp-1">
                        <span className="text-sky-400">[{quote.serviceType}]</span> {quote.scopeOfWork}
                      </div>
                    </div>

                    {/* Right: Price & Quick Action Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="text-right font-mono pr-2">
                        <span className="text-[10px] text-slate-400 uppercase block">Quotation Value</span>
                        <span className="text-lg font-black text-amber-400">{formatZAR(quote.totalAmount)}</span>
                      </div>

                      {/* WhatsApp Button */}
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
                        title="Send Quote via WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>

                      {/* Document Preview Modal Trigger */}
                      <button
                        onClick={() => setPreviewQuote(quote)}
                        className="p-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 cursor-pointer"
                        title="Preview Full Document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Convert to Invoice */}
                      {quote.status !== 'invoiced' && (
                        <button
                          onClick={() => {
                            const inv = convertQuoteToInvoice(quote.id);
                            if (inv) {
                              alert(`Quotation converted to Invoice ${inv.invoiceNumber}!`);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
                          title="Convert this approved quote to a Tax Invoice"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Convert to Invoice</span>
                        </button>
                      )}

                      {/* Export Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenExportMenuId(openExportMenuId === quote.id ? null : quote.id)}
                          className="p-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 cursor-pointer"
                          title="Export / Download Options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {openExportMenuId === quote.id && (
                          <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#12141C] border border-[#334155] shadow-2xl py-1 z-30 text-xs">
                            <button
                              onClick={() => {
                                printHtmlDocument('quote', quote, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-amber-400 font-semibold border-b border-[#334155]"
                            >
                              <Printer className="w-4 h-4 text-amber-400" />
                              <span>Print / Save as PDF</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToPDF('quote', quote, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200"
                            >
                              <Download className="w-4 h-4 text-sky-400" />
                              <span>Download PDF</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToExcel('quote', quote, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200"
                            >
                              <Download className="w-4 h-4 text-emerald-400" />
                              <span>Export to Excel (.xlsx)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToWord('quote', quote, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200"
                            >
                              <Download className="w-4 h-4 text-blue-400" />
                              <span>Export to Word (.docx)</span>
                            </button>

                            <button
                              onClick={() => {
                                handleEditQuote(quote);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200"
                            >
                              <FileText className="w-4 h-4 text-slate-400" />
                              <span>Edit Quotation</span>
                            </button>

                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this quotation?')) {
                                  deleteQuote(quote.id);
                                }
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-red-500/10 flex items-center space-x-2 text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete Quote</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {quotes.length === 0 && (
              <div className="p-12 text-center rounded-2xl border border-dashed border-[#334155] text-slate-400 text-xs">
                No quotations created yet. Click "Create New Quote" above to build your first on-site quote.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewQuote}
        onClose={() => setPreviewQuote(null)}
        docType="quote"
        data={previewQuote}
      />

      {/* Voice Wizard Modal */}
      <VoiceInvoiceWizard
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onApplyVoiceItems={(voiceItems, cat, scope, hours, clientInfo) => {
          setItems((prev) => [...prev, ...voiceItems]);
          setServiceType(cat);
          setScopeOfWork(scope);
          setLabourHours(hours);
          if (clientInfo) {
            if (clientInfo.name) setClientName(clientInfo.name);
            if (clientInfo.phone) setClientPhone(clientInfo.phone);
            if (clientInfo.address) setClientAddress(clientInfo.address);
          }
        }}
      />

      {/* Receipt OCR Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onApplyItemsToQuote={(scannedItems) => {
          setItems((prev) => [...prev, ...scannedItems]);
        }}
      />
    </div>
  );
};
