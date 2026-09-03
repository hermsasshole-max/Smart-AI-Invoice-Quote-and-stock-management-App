import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Quotation, QuoteLineItem, ServiceCategory, QuoteStatus, ConsumablesTier } from '../types';
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
  Wrench,
  Package,
  Layers,
  Hash,
  Edit3,
  Edit2,
  RotateCcw,
} from 'lucide-react';

export const QuotationEngine: React.FC = () => {
  const {
    quotes,
    addQuote,
    updateQuote,
    deleteQuote,
    convertQuoteToInvoice,
    recordQuoteDeposit,
    getNextQuoteNumber,
    updateQuoteNumber,
    syncSequenceFromDocument,
    clients,
    inventory,
    profile,
    sunlightMode,
  } = useApp();

  const [isCreating, setIsCreating] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  // Form State
  const [formQuoteNumber, setFormQuoteNumber] = useState<string>('');
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
  const [labourHours, setLabourHours] = useState(2); // Additional hours after 1st hr
  const [labourRatePerHour, setLabourRatePerHour] = useState(profile.defaultLabourRate || 450);
  const [travelDistanceKm, setTravelDistanceKm] = useState(20);
  const [travelRatePerKm, setTravelRatePerKm] = useState(profile.defaultTravelRate || 7.5);
  const [consumablesTier, setConsumablesTier] = useState<ConsumablesTier>('standard');
  const [consumablesFee, setConsumablesFee] = useState(350);
  const [consumablesDescription, setConsumablesDescription] = useState(
    'Fasteners, Sealant, Saddles, UV Ties, Lugs, Glands & Fixings'
  );
  const [miscellaneousDescription, setMiscellaneousDescription] = useState('');
  const [miscellaneousFee, setMiscellaneousFee] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [vatEnabled, setVatEnabled] = useState(profile.vatEnabled ?? true);
  const [notes, setNotes] = useState('');

  // Deposit Management State
  const [depositMode, setDepositMode] = useState<'percentage' | 'fixed' | 'none'>('percentage');
  const [depositPercentage, setDepositPercentage] = useState(80);
  const [customDepositAmount, setCustomDepositAmount] = useState(0);
  const [isDepositPaid, setIsDepositPaid] = useState(false);
  const [depositAmountPaid, setDepositAmountPaid] = useState(0);
  const [depositPaidDate, setDepositPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<'EFT' | 'Cash' | 'Card' | 'Instant EFT'>('EFT');
  const [depositReference, setDepositReference] = useState('');

  // Record Deposit Quick Modal State
  const [depositModalQuote, setDepositModalQuote] = useState<Quotation | null>(null);
  const [modalDepositAmount, setModalDepositAmount] = useState<number>(0);
  const [modalDepositDate, setModalDepositDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modalDepositMethod, setModalDepositMethod] = useState<'EFT' | 'Cash' | 'Card' | 'Instant EFT'>('EFT');
  const [modalDepositRef, setModalDepositRef] = useState<string>('');
  const [modalAutoConvert, setModalAutoConvert] = useState<boolean>(true);

  // Quick Edit Quotation Number Modal
  const [numberEditQuote, setNumberEditQuote] = useState<Quotation | null>(null);
  const [tempQuoteNumber, setTempQuoteNumber] = useState<string>('');

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

  // Add blank manual item
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

  // Handle Consumables Tier Change
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

  // Calculated Totals
  const effectiveDepositPercentage = depositMode === 'percentage' ? depositPercentage : depositMode === 'none' ? 0 : 0;
  const effectiveCustomDeposit = depositMode === 'fixed' ? customDepositAmount : undefined;

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
    profile.vatPercentage || 15,
    effectiveDepositPercentage,
    effectiveCustomDeposit,
    isDepositPaid ? depositAmountPaid : 0
  );

  // Reset form
  const resetForm = () => {
    setEditingQuoteId(null);
    setFormQuoteNumber('');
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
    setDepositMode('percentage');
    setDepositPercentage(80);
    setCustomDepositAmount(0);
    setIsDepositPaid(false);
    setDepositAmountPaid(0);
    setDepositPaidDate(new Date().toISOString().split('T')[0]);
    setDepositPaymentMethod('EFT');
    setDepositReference('');
    setNotes('');
    setIsCreating(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormQuoteNumber(getNextQuoteNumber());
    setIsCreating(true);
  };

  // Save Quote
  const handleSaveQuote = (status: QuoteStatus = 'sent') => {
    if (!clientName || !clientPhone) {
      alert('Please enter client name and phone number.');
      return;
    }

    const quoteNumber = (formQuoteNumber || '').trim() || (
      editingQuoteId
        ? quotes.find((q) => q.id === editingQuoteId)?.quoteNumber || getNextQuoteNumber()
        : getNextQuoteNumber()
    );

    const calculatedDepositReq = totals.depositRequired;

    const finalStatus: QuoteStatus = isDepositPaid && depositAmountPaid > 0 ? 'deposit_paid' : status;

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
      depositPercentage: depositMode === 'percentage' ? depositPercentage : undefined,
      depositAmount: calculatedDepositReq,
      isDepositPaid,
      depositAmountPaid: isDepositPaid ? depositAmountPaid : 0,
      depositPaidDate: isDepositPaid ? depositPaidDate : undefined,
      depositPaymentMethod: isDepositPaid ? depositPaymentMethod : undefined,
      depositReference: isDepositPaid ? depositReference : undefined,
      status: finalStatus,
      notes,
      terms: `${depositPercentage > 0 ? `${depositPercentage}%` : '80%'} Deposit on acceptance, balance upon commissioning. Materials remain property of contractor until settled.`,
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
    setFormQuoteNumber(quote.quoteNumber);
    setSelectedClientId(quote.clientId);
    setClientName(quote.clientName);
    setClientPhone(quote.clientPhone);
    setClientEmail(quote.clientEmail || '');
    setClientAddress(quote.clientAddress);
    setServiceType(quote.serviceType);
    setScopeOfWork(quote.scopeOfWork);
    setExpiryDate(quote.expiryDate);
    setItems(quote.items);
    setCalloutFee(quote.calloutFee ?? profile.defaultCalloutFee ?? 650);
    setLabourHours(quote.labourHours ?? 0);
    setLabourRatePerHour(quote.labourRatePerHour ?? profile.defaultLabourRate ?? 450);
    setTravelDistanceKm(quote.travelDistanceKm ?? 0);
    setTravelRatePerKm(quote.travelRatePerKm ?? profile.defaultTravelRate ?? 7.5);
    setConsumablesTier(quote.consumablesTier || 'standard');
    setConsumablesFee(quote.consumablesFee ?? 350);
    setConsumablesDescription(quote.consumablesDescription || 'Fasteners, Sealant, Saddles, UV Ties, Lugs, Glands & Fixings');
    setMiscellaneousDescription(quote.miscellaneousDescription || '');
    setMiscellaneousFee(quote.miscellaneousFee ?? 0);
    setDiscountPct(quote.discountPct ?? 0);
    setVatEnabled(quote.vatEnabled ?? true);
    setDepositPercentage(quote.depositPercentage ?? 80);
    setDepositMode(quote.depositPercentage !== undefined ? 'percentage' : quote.depositAmount ? 'fixed' : 'percentage');
    setCustomDepositAmount(quote.depositAmount ?? 0);
    setIsDepositPaid(Boolean(quote.isDepositPaid));
    setDepositAmountPaid(quote.depositAmountPaid ?? 0);
    setDepositPaidDate(quote.depositPaidDate || new Date().toISOString().split('T')[0]);
    setDepositPaymentMethod(quote.depositPaymentMethod || 'EFT');
    setDepositReference(quote.depositReference || '');
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
              onClick={handleOpenCreate}
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

          {/* Quotation Number & Document Sequence Banner */}
          <div className="p-3.5 rounded-xl bg-[#12141C] border border-[#334155]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Hash className="w-4 h-4" />
              </div>
              <div>
                <label className="block text-slate-300 font-mono font-bold uppercase text-[11px]">
                  Quotation Number (Customizable)
                </label>
                <span className="text-slate-400 text-[10px]">
                  Next quotes & invoices follow sequentially from the number after this one.
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={formQuoteNumber}
                onChange={(e) => setFormQuoteNumber(e.target.value)}
                placeholder="e.g. Q-2026-0144"
                className="px-3 py-1.5 rounded-xl bg-[#1B1E28] border border-sky-500/50 text-sky-300 font-mono font-bold text-sm w-44 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
              />
              <button
                type="button"
                onClick={() => setFormQuoteNumber(getNextQuoteNumber())}
                title="Reset to Next Sequential Number"
                className="p-2 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-slate-300 hover:text-sky-400 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
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

          {/* Labour, Travel, Consumables, Surcharges & Financial Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-[#282E3E]">
            {/* Left 7 cols: Inputs */}
            <div className="lg:col-span-7 space-y-4 text-xs">
              {/* 1. Structured Labor & Call-Out Breakdown */}
              <div className="p-4 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-sky-400 uppercase font-mono flex items-center space-x-1.5">
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
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                          : 'bg-[#1B1E28] text-slate-400 border border-[#334155]'
                      }`}
                    >
                      {vatEnabled ? '15% VAT ACTIVE' : 'VAT EXEMPT'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Deposit & Payment Terms */}
              <div className="p-4 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-sky-400 uppercase font-mono flex items-center space-x-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>4. Deposit & Payment Terms</span>
                  </h5>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/30">
                    Required: {formatZAR(totals.depositRequired)}
                  </span>
                </div>

                {/* Preset Selector */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 text-[11px]">Deposit Policy</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: '80% (Standard)', mode: 'percentage', val: 80 },
                      { label: '70% Deposit', mode: 'percentage', val: 70 },
                      { label: '50% Deposit', mode: 'percentage', val: 50 },
                      { label: 'Fixed Amount', mode: 'fixed', val: 0 },
                    ].map((preset) => {
                      const isActive =
                        preset.mode === 'fixed'
                          ? depositMode === 'fixed'
                          : depositMode === 'percentage' && depositPercentage === preset.val;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            if (preset.mode === 'fixed') {
                              setDepositMode('fixed');
                              if (customDepositAmount === 0) {
                                setCustomDepositAmount(Math.round(totals.totalAmount * 0.8));
                              }
                            } else {
                              setDepositMode('percentage');
                              setDepositPercentage(preset.val);
                            }
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                              : 'bg-[#1B1E28] text-slate-400 border-[#334155] hover:border-slate-500'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom input depending on mode */}
                {depositMode === 'percentage' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Deposit Percentage (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={depositPercentage}
                          onChange={(e) => setDepositPercentage(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-white font-mono"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Calculated Deposit Amount</label>
                      <div className="px-3 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-emerald-400 font-mono font-bold text-sm">
                        {formatZAR(totals.depositRequired)}
                      </div>
                    </div>
                  </div>
                )}

                {depositMode === 'fixed' && (
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Fixed Deposit Amount (ZAR)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">R</span>
                      <input
                        type="number"
                        value={customDepositAmount}
                        onChange={(e) => setCustomDepositAmount(Number(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-[#1B1E28] border border-[#334155] text-emerald-400 font-mono font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* On-Site Deposit Collection Subpanel */}
                <div className="pt-2 border-t border-[#282E3E]">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDepositPaid}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsDepositPaid(checked);
                        if (checked && depositAmountPaid === 0) {
                          setDepositAmountPaid(totals.depositRequired);
                        }
                      }}
                      className="rounded border-[#334155] text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Client has already paid upfront deposit on-site</span>
                  </label>

                  {isDepositPaid && (
                    <div className="mt-3 p-3 rounded-lg bg-[#1B1E28] border border-emerald-500/30 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-400 font-semibold">Deposit Payment Details:</span>
                        <button
                          type="button"
                          onClick={() => setDepositAmountPaid(totals.depositRequired)}
                          className="text-[11px] text-sky-400 hover:underline"
                        >
                          Match Required ({formatZAR(totals.depositRequired)})
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-1">Amount Paid (ZAR)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">R</span>
                            <input
                              type="number"
                              value={depositAmountPaid}
                              onChange={(e) => setDepositAmountPaid(Number(e.target.value) || 0)}
                              className="w-full pl-7 pr-2 py-1 rounded bg-[#141722] border border-[#334155] text-emerald-300 font-mono text-xs font-bold"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[10px] mb-1">Payment Date</label>
                          <input
                            type="date"
                            value={depositPaidDate}
                            onChange={(e) => setDepositPaidDate(e.target.value)}
                            className="w-full px-2.5 py-1 rounded bg-[#141722] border border-[#334155] text-white text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[10px] mb-1">Payment Method</label>
                          <select
                            value={depositPaymentMethod}
                            onChange={(e) => setDepositPaymentMethod(e.target.value as any)}
                            className="w-full px-2.5 py-1 rounded bg-[#141722] border border-[#334155] text-white text-xs"
                          >
                            <option value="EFT">EFT Bank Transfer</option>
                            <option value="Instant EFT">Instant EFT / Ozow / Payfast</option>
                            <option value="Cash">Cash on Site</option>
                            <option value="Card">Card Machine (Yoco / Speedpoint)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[10px] mb-1">Proof / Reference (Optional)</label>
                          <input
                            type="text"
                            value={depositReference}
                            onChange={(e) => setDepositReference(e.target.value)}
                            placeholder="e.g. EFT-98234 / Cash Ref"
                            className="w-full px-2.5 py-1 rounded bg-[#141722] border border-[#334155] text-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right 5 cols: Live Calculated Financial Summary Card */}
            <div className="lg:col-span-5">
              <div className="p-5 rounded-2xl bg-[#141722] border border-[#282E3E] space-y-3 font-mono text-xs shadow-lg sticky top-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#282E3E]">
                  <h5 className="font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>Quote Financial Summary</span>
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

                  <div className="flex justify-between text-sky-400 font-bold pt-1 border-t border-[#232838]">
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
                    <span>TOTAL AMOUNT:</span>
                    <span className="text-amber-400 text-lg">{formatZAR(totals.totalAmount)}</span>
                  </div>

                  {/* Deposit Breakdown */}
                  <div className="pt-3 border-t border-[#282E3E] space-y-2">
                    <div className="flex justify-between text-slate-300 text-xs">
                      <span>Deposit Required ({depositMode === 'percentage' ? `${depositPercentage}%` : 'Fixed'}):</span>
                      <span className="text-emerald-400 font-bold">{formatZAR(totals.depositRequired)}</span>
                    </div>

                    {isDepositPaid && depositAmountPaid > 0 ? (
                      <>
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span>Deposit Paid ({depositPaidDate}):</span>
                          <span>-{formatZAR(depositAmountPaid)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-black p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                          <span>REMAINING BALANCE DUE:</span>
                          <span className="text-base">{formatZAR(totals.remainingBalanceDue)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-slate-400 text-xs">
                        <span>Balance on Completion:</span>
                        <span className="text-slate-200 font-bold">{formatZAR(totals.remainingBalanceDue)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 pt-6 border-t border-[#282E3E]">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSaveQuote('draft')}
              className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs font-bold cursor-pointer"
            >
              Save as Draft
            </button>

            <button
              type="button"
              onClick={() => handleSaveQuote('sent')}
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-sky-500/20 cursor-pointer active:scale-95"
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

              const quoteDepPct = quote.depositPercentage ?? 80;
              const quoteDepReq = quote.depositAmount ?? Number(((quote.totalAmount * quoteDepPct) / 100).toFixed(2));
              const isDepPaid = Boolean(quote.isDepositPaid || quote.status === 'deposit_paid');
              const paidAmt = quote.depositAmountPaid ?? 0;
              const remainingBal = Math.max(0, quote.totalAmount - (isDepPaid ? paidAmt : 0));

              return (
                <div
                  key={quote.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    sunlightMode
                      ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                      : 'bg-[#1B1E28] border-[#282E3E] text-white hover:border-[#334155]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    {/* Left: Info */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNumberEditQuote(quote);
                            setTempQuoteNumber(quote.quoteNumber);
                          }}
                          className="font-mono text-xs px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30 flex items-center space-x-1 cursor-pointer transition-colors"
                          title="Click to manually change Quote Number"
                        >
                          <Hash className="w-3 h-3" />
                          <span>{quote.quoteNumber}</span>
                          <Edit3 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                        </button>
                        <h4 className="font-bold text-base">{quote.clientName}</h4>
                        <span
                          className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                            quote.status === 'deposit_paid' || isDepPaid
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                              : quote.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : quote.status === 'invoiced'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                              : quote.status === 'sent'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {quote.status === 'deposit_paid' ? 'DEPOSIT PAID' : quote.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        📞 {quote.clientPhone} • Valid: <span className="text-slate-300">{quote.expiryDate}</span> • 📍 {quote.clientAddress}
                      </div>

                      <div className="text-xs text-slate-300 font-medium line-clamp-1">
                        <span className="text-sky-400">[{quote.serviceType}]</span> {quote.scopeOfWork}
                      </div>

                      {/* Deposit Status Pill Bar */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {isDepPaid ? (
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-mono">
                            <Check className="w-3.5 h-3.5 text-teal-400" />
                            <span>Deposit Paid: <strong>{formatZAR(paidAmt)}</strong></span>
                            {quote.depositPaidDate && <span className="text-slate-400 text-[10px]">({quote.depositPaidDate})</span>}
                            <span className="text-slate-500">|</span>
                            <span className="text-slate-300">Balance: <strong className="text-amber-400">{formatZAR(remainingBal)}</strong></span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#141722] border border-[#282E3E] text-slate-300 text-xs font-mono">
                            <span className="text-slate-400">Deposit Required ({quoteDepPct}%):</span>
                            <strong className="text-emerald-400">{formatZAR(quoteDepReq)}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Price & Quick Action Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="text-right font-mono pr-2">
                        <span className="text-[10px] text-slate-400 uppercase block">Total Value</span>
                        <span className="text-lg font-black text-amber-400">{formatZAR(quote.totalAmount)}</span>
                      </div>

                      {/* Record Deposit CTA */}
                      {quote.status !== 'invoiced' && !isDepPaid && (
                        <button
                          onClick={() => {
                            setDepositModalQuote(quote);
                            setModalDepositAmount(quoteDepReq);
                            setModalDepositDate(new Date().toISOString().split('T')[0]);
                            setModalDepositMethod('EFT');
                            setModalDepositRef('');
                            setModalAutoConvert(true);
                          }}
                          className="px-3 py-2 rounded-xl bg-teal-600/30 hover:bg-teal-600/40 text-teal-300 border border-teal-500/40 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                          title="Record Deposit Payment Received"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-teal-400" />
                          <span>Record Deposit</span>
                        </button>
                      )}

                      {/* Mark as Accepted (if draft or sent) */}
                      {(quote.status === 'draft' || quote.status === 'sent') && (
                        <button
                          onClick={() => {
                            updateQuote(quote.id, { status: 'approved' });
                          }}
                          className="px-2.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                          title="Mark Quote as Accepted by Client"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                      )}

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
                              alert(`Quotation successfully converted to Tax Invoice ${inv.invoiceNumber} with deposit details tracked!`);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
                          title="Convert this quote into a Final Tax Invoice with deposit deducted"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
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
                          <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#12141C] border border-[#334155] shadow-2xl py-1 z-30 text-xs">
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
                                setNumberEditQuote(quote);
                                setTempQuoteNumber(quote.quoteNumber);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-sky-500/10 flex items-center space-x-2 text-sky-400 font-semibold"
                            >
                              <Hash className="w-4 h-4 text-sky-400" />
                              <span>Change Quote #</span>
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

      {/* Record Deposit & Convert to Invoice Modal */}
      {depositModalQuote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#181B26] border border-[#282E3E] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-teal-900/40 via-emerald-900/20 to-transparent border-b border-[#282E3E] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Record Deposit Payment</h4>
                  <p className="text-xs text-slate-400 font-mono">
                    {depositModalQuote.quoteNumber} • {depositModalQuote.clientName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDepositModalQuote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#282E3E] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs font-mono">
              {/* Financial Snapshot */}
              <div className="p-3.5 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Total Quotation Amount:</span>
                  <span className="text-white font-bold">{formatZAR(depositModalQuote.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Expected Deposit ({depositModalQuote.depositPercentage ?? 80}%):</span>
                  <span>{formatZAR(depositModalQuote.depositAmount ?? (depositModalQuote.totalAmount * (depositModalQuote.depositPercentage ?? 80)) / 100)}</span>
                </div>
                <div className="flex justify-between text-slate-300 pt-1.5 border-t border-[#282E3E]">
                  <span>Remaining Balance Due After This:</span>
                  <span className="text-amber-400 font-bold">
                    {formatZAR(Math.max(0, depositModalQuote.totalAmount - (modalDepositAmount || 0)))}
                  </span>
                </div>
              </div>

              {/* Deposit Inputs */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-300 font-semibold">Deposit Amount Paid (ZAR)*</label>
                    <button
                      type="button"
                      onClick={() => {
                        const rec = depositModalQuote.depositAmount ?? (depositModalQuote.totalAmount * (depositModalQuote.depositPercentage ?? 80)) / 100;
                        setModalDepositAmount(rec);
                      }}
                      className="text-[10px] text-teal-400 hover:underline cursor-pointer"
                    >
                      Fill Standard Required
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R</span>
                    <input
                      type="number"
                      value={modalDepositAmount}
                      onChange={(e) => setModalDepositAmount(Number(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-teal-300 text-sm font-bold font-mono focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={modalDepositDate}
                      onChange={(e) => setModalDepositDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Payment Method</label>
                    <select
                      value={modalDepositMethod}
                      onChange={(e) => setModalDepositMethod(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white text-xs"
                    >
                      <option value="EFT">EFT Bank Transfer</option>
                      <option value="Instant EFT">Instant EFT / Ozow</option>
                      <option value="Cash">Cash on Site</option>
                      <option value="Card">Card Machine (Yoco)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Payment Reference / Note (Optional)</label>
                  <input
                    type="text"
                    value={modalDepositRef}
                    onChange={(e) => setModalDepositRef(e.target.value)}
                    placeholder="e.g. FNB EFT ref #82910, Bank deposit receipt"
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white text-xs"
                  />
                </div>

                {/* Auto Convert to Invoice Checkbox */}
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalAutoConvert}
                      onChange={(e) => setModalAutoConvert(e.target.checked)}
                      className="rounded border-[#334155] text-teal-500 focus:ring-teal-500 w-4 h-4"
                    />
                    <div className="text-xs text-slate-200">
                      <span className="font-bold text-teal-300">Generate & Convert to Final Invoice immediately</span>
                      <p className="text-[10px] text-slate-400 font-normal">
                        Creates an active Tax Invoice with deposit deducted and balance due highlighted.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-[#12141C] border-t border-[#282E3E] flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDepositModalQuote(null)}
                className="px-4 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modalDepositAmount <= 0) {
                    alert('Please enter a valid deposit amount.');
                    return;
                  }
                  recordQuoteDeposit(depositModalQuote.id, {
                    amount: modalDepositAmount,
                    date: modalDepositDate,
                    method: modalDepositMethod,
                    reference: modalDepositRef,
                  });

                  if (modalAutoConvert) {
                    const inv = convertQuoteToInvoice(depositModalQuote.id);
                    if (inv) {
                      alert(`Deposit recorded and Tax Invoice ${inv.invoiceNumber} generated!`);
                    }
                  } else {
                    alert(`Deposit payment of ${formatZAR(modalDepositAmount)} successfully recorded!`);
                  }

                  setDepositModalQuote(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-teal-600/20 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Save Deposit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Quotation Number Modal */}
      {numberEditQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1E28] border border-[#282E3E] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-[#12141C] border-b border-[#282E3E] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Hash className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-sm">Change Quotation Number</h3>
              </div>
              <button
                type="button"
                onClick={() => setNumberEditQuote(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Client Name:</span>
                <span className="text-white font-bold text-sm">{numberEditQuote.clientName}</span>
              </div>

              <div>
                <label className="block text-slate-300 font-mono font-bold uppercase mb-1">
                  Quotation Number
                </label>
                <input
                  type="text"
                  value={tempQuoteNumber}
                  onChange={(e) => setTempQuoteNumber(e.target.value)}
                  placeholder="e.g. Q-2026-0144"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#12141C] border border-sky-500/50 text-sky-300 font-mono font-bold text-base focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                />
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-300 space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <span>⚡ Automatic Sequence Tracking</span>
                </p>
                <p className="text-slate-300">
                  Changing this quote number will update the document, and all subsequent quotations and invoices will automatically continue from the next number in sequence.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#12141C] border-t border-[#282E3E] flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setNumberEditQuote(null)}
                className="px-4 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = tempQuoteNumber.trim();
                  if (!cleaned) {
                    alert('Please enter a valid quotation number.');
                    return;
                  }
                  updateQuoteNumber(numberEditQuote.id, cleaned);
                  setNumberEditQuote(null);
                }}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-sky-600/20 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Save Number</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
