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
  RotateCcw,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  Hash,
  Edit3,
} from 'lucide-react';

export const InvoicingPipeline: React.FC = () => {
  const {
    invoices,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,
    deleteInvoicePayment,
    revertInvoicePayment,
    getNextInvoiceNumber,
    updateInvoiceNumber,
    syncSequenceFromDocument,
    clients,
    inventory,
    profile,
    sunlightMode,
  } = useApp();

  // Modals & Active Edit States
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [revertModalInvoice, setRevertModalInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'EFT' | 'Cash' | 'Card' | 'Instant EFT'>('EFT');
  const [payReference, setPayReference] = useState('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');
  const [openExportMenuId, setOpenExportMenuId] = useState<string | null>(null);

  // Quick Edit Invoice Number Modal
  const [numberEditInvoice, setNumberEditInvoice] = useState<Invoice | null>(null);
  const [tempInvoiceNumber, setTempInvoiceNumber] = useState<string>('');

  // Invoice Form (Create & Edit) State
  const [isEditing, setIsEditing] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [formInvoiceNumber, setFormInvoiceNumber] = useState<string>('');
  const [formAmountPaid, setFormAmountPaid] = useState<number>(0);
  const [formPaymentStatus, setFormPaymentStatus] = useState<InvoiceStatus>('issued');
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

  // Deposit Fields
  const [isDepositPaid, setIsDepositPaid] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState<number>(80);
  const [depositAmountPaid, setDepositAmountPaid] = useState<number>(0);
  const [depositPaidDate, setDepositPaidDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<'EFT' | 'Cash' | 'Card' | 'Instant EFT'>('EFT');
  const [depositReference, setDepositReference] = useState<string>('');

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
    depositPercentage,
    undefined,
    isDepositPaid ? depositAmountPaid : 0
  );

  const resetForm = () => {
    setEditingInvoiceId(null);
    setFormInvoiceNumber('');
    setFormAmountPaid(0);
    setFormPaymentStatus('issued');
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
    setIsDepositPaid(false);
    setDepositPercentage(80);
    setDepositAmountPaid(0);
    setDepositPaidDate(new Date().toISOString().split('T')[0]);
    setDepositPaymentMethod('EFT');
    setDepositReference('');
    setNotes('');
    setIsEditing(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormInvoiceNumber(getNextInvoiceNumber());
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
    setFormInvoiceNumber(inv.invoiceNumber);
    setFormAmountPaid(inv.amountPaid || 0);
    setFormPaymentStatus(inv.status);
    setSelectedClientId(inv.clientId);
    setClientName(inv.clientName);
    setClientPhone(inv.clientPhone);
    setClientEmail(inv.clientEmail || '');
    setClientAddress(inv.clientAddress);
    setServiceType(inv.serviceType);
    setScopeOfWork(inv.scopeOfWork);
    setDueDate(inv.dueDate);
    setItems(inv.items || []);
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
    setIsDepositPaid(Boolean(inv.isDepositPaid || (inv.depositAmountPaid && inv.depositAmountPaid > 0)));
    setDepositPercentage(inv.depositPercentage ?? 80);
    setDepositAmountPaid(inv.depositAmountPaid ?? 0);
    setDepositPaidDate(inv.depositPaidDate || new Date().toISOString().split('T')[0]);
    setDepositPaymentMethod(inv.depositPaymentMethod || 'EFT');
    setDepositReference(inv.depositReference || '');
    setNotes(inv.notes || '');
    setIsEditing(true);
  };

  const handleRevertPaymentDirectly = (inv: Invoice, keepDeposit: boolean = false) => {
    revertInvoicePayment(inv.id, { keepDepositOnly: keepDeposit });
    setRevertModalInvoice(null);
  };

  const handleRevertAndOpenEdit = (inv: Invoice, keepDeposit: boolean = false) => {
    const updated = revertInvoicePayment(inv.id, { keepDepositOnly: keepDeposit });
    setRevertModalInvoice(null);
    if (updated) {
      handleOpenEdit(updated);
    } else {
      handleOpenEdit(inv);
    }
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

    const invoiceNumber = (formInvoiceNumber || '').trim() || (
      editingInvoiceId
        ? invoices.find((i) => i.id === editingInvoiceId)?.invoiceNumber || getNextInvoiceNumber()
        : getNextInvoiceNumber()
    );

    const existingInv = editingInvoiceId ? invoices.find((i) => i.id === editingInvoiceId) : null;
    
    // Determine effective paid amount from form
    let effectivePaid = editingInvoiceId
      ? formAmountPaid
      : isDepositPaid
      ? depositAmountPaid
      : 0;

    effectivePaid = Math.max(0, effectivePaid);

    let finalStatus: InvoiceStatus = formPaymentStatus;
    if (effectivePaid >= totals.totalAmount && totals.totalAmount > 0) {
      finalStatus = (formPaymentStatus === 'issued' || formPaymentStatus === 'draft') ? formPaymentStatus : 'paid';
    } else if (effectivePaid > 0 && effectivePaid < totals.totalAmount) {
      finalStatus = 'partially_paid';
    } else if (effectivePaid === 0) {
      finalStatus = (formPaymentStatus === 'paid') ? 'issued' : formPaymentStatus;
    }

    // Retain or adjust payments history
    let finalPayments = existingInv?.payments ? [...existingInv.payments] : [];
    if (effectivePaid === 0) {
      finalPayments = [];
    } else if (effectivePaid < (existingInv?.amountPaid || 0)) {
      // Reverted or reduced amount: retain payments that fit within effectivePaid or create an adjustment record
      let runningTotal = 0;
      finalPayments = finalPayments.filter((p) => {
        if (runningTotal + p.amount <= effectivePaid) {
          runningTotal += p.amount;
          return true;
        }
        return false;
      });
      if (finalPayments.length === 0 && effectivePaid > 0) {
        finalPayments = [
          {
            id: 'pay_' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            amount: effectivePaid,
            method: 'EFT',
            reference: 'ADJUSTED-BALANCE',
          },
        ];
      }
    }

    const payload: Omit<Invoice, 'id'> = {
      invoiceNumber,
      date: existingInv ? existingInv.date : new Date().toISOString().split('T')[0],
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
      amountPaid: effectivePaid,
      isDepositPaid: isDepositPaid && effectivePaid >= depositAmountPaid,
      depositPercentage,
      depositAmount: totals.depositRequired,
      depositAmountPaid: isDepositPaid ? depositAmountPaid : 0,
      depositPaidDate: isDepositPaid ? depositPaidDate : undefined,
      depositPaymentMethod: isDepositPaid ? depositPaymentMethod : undefined,
      depositReference: isDepositPaid ? depositReference : undefined,
      status: finalStatus,
      terms: existingInv?.terms || 'Strictly 7 days from invoice presentation. EFT / Card payments accepted.',
      notes,
      payments: finalPayments,
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
    const balance = Number((inv.totalAmount - (inv.amountPaid || 0)).toFixed(2));
    setPayAmount(balance > 0 ? balance : 0);
    setPayMethod('EFT');
    setPayReference(`PAY-${Date.now().toString().slice(-4)}`);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
  };

  const handleRecordPayment = () => {
    if (!paymentModalInvoice || payAmount <= 0) return;
    recordPayment(
      paymentModalInvoice.id,
      payAmount,
      payMethod,
      payReference,
      payDate,
      payNotes
    );
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

          {/* Invoice Number & Sequence Tracker */}
          <div className="p-3.5 rounded-xl bg-[#12141C] border border-[#334155]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Hash className="w-4 h-4" />
              </div>
              <div>
                <label className="block text-slate-300 font-mono font-bold uppercase text-[11px]">
                  Tax Invoice Number (Customizable)
                </label>
                <span className="text-slate-400 text-[10px]">
                  Subsequent invoices will automatically follow sequentially from the number after this one.
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={formInvoiceNumber}
                onChange={(e) => setFormInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2026-0102"
                className="px-3 py-1.5 rounded-xl bg-[#1B1E28] border border-emerald-500/50 text-emerald-300 font-mono font-bold text-sm w-44 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
              <button
                type="button"
                onClick={() => setFormInvoiceNumber(getNextInvoiceNumber())}
                title="Reset to Next Sequential Number"
                className="p-2 rounded-lg bg-[#282E3E] hover:bg-[#334155] text-slate-300 hover:text-emerald-400 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
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

              {/* 4. Deposit & Upfront Payment Record */}
              <div className="p-4 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-emerald-400 uppercase font-mono flex items-center space-x-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>4. Upfront Deposit & Prior Payment</span>
                  </h5>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/30">
                    Standard 80%: {formatZAR(totals.totalAmount * 0.8)}
                  </span>
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDepositPaid}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsDepositPaid(checked);
                        if (checked && depositAmountPaid === 0) {
                          const depAmount = Number((totals.totalAmount * (depositPercentage / 100)).toFixed(2));
                          setDepositAmountPaid(depAmount);
                          setFormAmountPaid(depAmount);
                          setFormPaymentStatus('partially_paid');
                        } else if (!checked && formAmountPaid === depositAmountPaid) {
                          setDepositAmountPaid(0);
                          setFormAmountPaid(0);
                          setFormPaymentStatus('issued');
                        }
                      }}
                      className="rounded border-[#334155] text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Upfront deposit or prior payment was received for this job</span>
                  </label>

                  {isDepositPaid && (
                    <div className="mt-3 p-3 rounded-lg bg-[#1B1E28] border border-emerald-500/30 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-1">Deposit Amount Paid (ZAR)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">R</span>
                            <input
                              type="number"
                              value={depositAmountPaid}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setDepositAmountPaid(val);
                                if (formAmountPaid <= depositAmountPaid || formAmountPaid === 0) {
                                  setFormAmountPaid(val);
                                }
                              }}
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
                            <option value="Instant EFT">Instant EFT / Ozow</option>
                            <option value="Cash">Cash on Site</option>
                            <option value="Card">Card Machine (Yoco)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[10px] mb-1">Reference / Note</label>
                          <input
                            type="text"
                            value={depositReference}
                            onChange={(e) => setDepositReference(e.target.value)}
                            placeholder="e.g. EFT Deposit Ref #4412"
                            className="w-full px-2.5 py-1 rounded bg-[#141722] border border-[#334155] text-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Payment Settlement & Status Adjustment (Revert to Unpaid / Change Status) */}
              <div className="p-4 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-sky-400 uppercase font-mono flex items-center space-x-1.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>5. Invoice Payment & Settlement Status</span>
                  </h5>
                  <div>
                    {formAmountPaid >= totals.totalAmount && totals.totalAmount > 0 ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> PAID IN FULL
                      </span>
                    ) : formAmountPaid > 0 ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/40">
                        PARTIALLY PAID
                      </span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono font-bold border border-sky-500/40">
                        UNPAID / OUTSTANDING
                      </span>
                    )}
                  </div>
                </div>

                {editingInvoiceId && formAmountPaid >= totals.totalAmount && totals.totalAmount > 0 && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Invoice is currently marked Paid in Full.</span>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        You can adjust the invoice line items, pricing, or scope. If payment should no longer be marked as settled, use the quick buttons below to revert to unpaid.
                      </p>
                    </div>
                  </div>
                )}

                {/* Quick Payment State Preset Buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFormAmountPaid(0);
                      setFormPaymentStatus('issued');
                      setIsDepositPaid(false);
                      setDepositAmountPaid(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      formAmountPaid === 0
                        ? 'bg-sky-600 text-white shadow'
                        : 'bg-[#1E2330] hover:bg-[#282E3E] text-slate-300 border border-[#334155]'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Revert to Unpaid (R0.00 Paid)</span>
                  </button>

                  {depositAmountPaid > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormAmountPaid(depositAmountPaid);
                        setFormPaymentStatus('partially_paid');
                        setIsDepositPaid(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                        formAmountPaid === depositAmountPaid && formAmountPaid > 0
                          ? 'bg-teal-600 text-white shadow'
                          : 'bg-[#1E2330] hover:bg-[#282E3E] text-slate-300 border border-[#334155]'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5 text-teal-400" />
                      <span>Set to Deposit Only ({formatZAR(depositAmountPaid)})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setFormAmountPaid(totals.totalAmount);
                      setFormPaymentStatus('paid');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      formAmountPaid >= totals.totalAmount && totals.totalAmount > 0
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-[#1E2330] hover:bg-[#282E3E] text-slate-300 border border-[#334155]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mark Paid in Full ({formatZAR(totals.totalAmount)})</span>
                  </button>
                </div>

                {/* Granular Amount Paid & Status Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1F2432]">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1 font-mono uppercase font-bold">
                      Amount Paid to Date (ZAR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">R</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formAmountPaid}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setFormAmountPaid(val);
                          if (val >= totals.totalAmount && totals.totalAmount > 0) {
                            setFormPaymentStatus('paid');
                          } else if (val > 0) {
                            setFormPaymentStatus('partially_paid');
                          } else {
                            setFormPaymentStatus('issued');
                          }
                        }}
                        className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-[#141722] border border-[#334155] text-white font-mono text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1 font-mono uppercase font-bold">
                      Document Status Override
                    </label>
                    <select
                      value={formPaymentStatus}
                      onChange={(e) => setFormPaymentStatus(e.target.value as InvoiceStatus)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#141722] border border-[#334155] text-white text-xs font-semibold"
                    >
                      <option value="issued">Issued / Unpaid</option>
                      <option value="partially_paid">Partially Paid</option>
                      <option value="paid">Paid in Full</option>
                      <option value="draft">Draft</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                </div>
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

                  {/* Payment Settlement Breakdown in Summary */}
                  <div className="pt-3 border-t border-[#282E3E] space-y-2">
                    {formAmountPaid > 0 ? (
                      <div className="flex justify-between text-teal-400 font-bold">
                        <span>Amount Paid / Settled:</span>
                        <span>-{formatZAR(formAmountPaid)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-slate-400">
                        <span>Payment Status:</span>
                        <span className="text-sky-300 font-semibold">Unpaid (R0.00)</span>
                      </div>
                    )}

                    <div className={`flex justify-between items-center text-sm font-black p-2 rounded-lg border ${
                      formAmountPaid >= totals.totalAmount && totals.totalAmount > 0
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}>
                      <span>REMAINING BALANCE DUE:</span>
                      <span className="text-base">
                        {formatZAR(Math.max(0, totals.totalAmount - formAmountPaid))}
                      </span>
                    </div>
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
          const balance = Math.max(0, inv.totalAmount - (inv.amountPaid || 0));
          const isPaid = inv.status === 'paid' || (inv.amountPaid || 0) >= inv.totalAmount;
          const isOverdue = !isPaid && new Date(inv.dueDate) < new Date();
          const hasDeposit = Boolean(inv.isDepositPaid || (inv.depositAmountPaid && inv.depositAmountPaid > 0));

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
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNumberEditInvoice(inv);
                        setTempInvoiceNumber(inv.invoiceNumber);
                      }}
                      className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center space-x-1 cursor-pointer transition-colors"
                      title="Click to manually change Tax Invoice Number"
                    >
                      <Hash className="w-3 h-3" />
                      <span>{inv.invoiceNumber}</span>
                      <Edit3 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                    </button>
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

                    {hasDeposit && (
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/30">
                        Deposit Paid ({formatZAR(inv.depositAmountPaid || 0)})
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400">
                    📞 {inv.clientPhone} • Due Date: <strong className="text-slate-200">{inv.dueDate}</strong> • 📍 {inv.clientAddress}
                  </div>

                  <div className="text-xs text-slate-300 font-medium">
                    <span className="text-sky-400">[{inv.serviceType}]</span> {inv.scopeOfWork}
                  </div>

                  {hasDeposit && (
                    <div className="text-[11px] text-teal-300/90 font-mono flex items-center space-x-1.5 pt-0.5">
                      <span>✓ Upfront Deposit Received:</span>
                      <strong className="text-teal-300">{formatZAR(inv.depositAmountPaid || 0)}</strong>
                      {inv.depositPaidDate && <span>({inv.depositPaidDate} via {inv.depositPaymentMethod || 'EFT'})</span>}
                    </div>
                  )}
                </div>

                {/* Financials & Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right font-mono pr-2">
                    <div className="text-xs text-slate-400">
                      Total: <span className="font-bold text-white">{formatZAR(inv.totalAmount)}</span>
                    </div>
                    {inv.amountPaid > 0 && !isPaid && (
                      <div className="text-[11px] text-teal-400">
                        Paid to Date: {formatZAR(inv.amountPaid)}
                      </div>
                    )}
                    <div className="text-sm font-black">
                      {isPaid ? (
                        <span className="text-emerald-400">PAID IN FULL</span>
                      ) : (
                        <span className="text-amber-400">Balance Due: {formatZAR(balance)}</span>
                      )}
                    </div>
                  </div>

                  {/* Payment & Revert Actions */}
                  {isPaid ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setRevertModalInvoice(inv)}
                        className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                        title="Revert payment status to unpaid or adjust settlement"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Revert Payment</span>
                      </button>

                      <button
                        onClick={() => handleRevertAndOpenEdit(inv, false)}
                        className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-sky-600/20 cursor-pointer active:scale-95"
                        title="Revert invoice to unpaid and open the full editor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Revert & Edit</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenPayment(inv)}
                      className={`px-3 py-2 rounded-xl text-white text-xs font-bold flex items-center space-x-1.5 shadow-md cursor-pointer active:scale-95 transition-all ${
                        inv.amountPaid > 0
                          ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-teal-600/20'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>{inv.amountPaid > 0 ? 'Add Payment' : 'Record Payment'}</span>
                    </button>
                  )}

                  {/* Edit Invoice (Always Available) */}
                  <button
                    onClick={() => handleOpenEdit(inv)}
                    className="p-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 hover:text-sky-400 transition-colors cursor-pointer"
                    title={isPaid ? "Edit Paid Invoice" : "Edit Invoice Details"}
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

                  {/* Export & Extended Options */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenExportMenuId(openExportMenuId === inv.id ? null : inv.id)}
                      className="p-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 cursor-pointer"
                      title="More Options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {openExportMenuId === inv.id && (
                      <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#12141C] border border-[#334155] shadow-2xl py-1 z-30 text-xs">
                        {isPaid && (
                          <>
                            <button
                              onClick={() => {
                                setRevertModalInvoice(inv);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-amber-300 font-semibold border-b border-[#282E3E] cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4 text-amber-400" />
                              <span>Revert Payment (Unpay)</span>
                            </button>
                            <button
                              onClick={() => {
                                handleRevertAndOpenEdit(inv, false);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-sky-300 font-semibold border-b border-[#282E3E] cursor-pointer"
                            >
                              <Undo2 className="w-4 h-4 text-sky-400" />
                              <span>Revert Payment & Edit</span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => {
                            handleOpenEdit(inv);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1B1E28] flex items-center space-x-2 text-slate-200 border-b border-[#282E3E] cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4 text-sky-400" />
                          <span>Edit Tax Invoice</span>
                        </button>

                        <button
                          onClick={() => {
                            setNumberEditInvoice(inv);
                            setTempInvoiceNumber(inv.invoiceNumber);
                            setOpenExportMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-emerald-500/10 flex items-center space-x-2 text-emerald-400 font-semibold border-b border-[#282E3E] cursor-pointer"
                        >
                          <Hash className="w-4 h-4 text-emerald-400" />
                          <span>Change Invoice #</span>
                        </button>

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
          <div className="relative w-full max-w-lg bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#282E3E]">
              <div>
                <h3 className="font-bold text-white text-base">Record Payment / Partial Settlement</h3>
                <p className="text-xs text-slate-400 font-mono">{paymentModalInvoice.invoiceNumber} • {paymentModalInvoice.clientName}</p>
              </div>
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary Box */}
            <div className="p-3.5 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Total Invoice Value:</span>
                <span className="text-white font-bold">{formatZAR(paymentModalInvoice.totalAmount)}</span>
              </div>
              {paymentModalInvoice.depositAmountPaid && paymentModalInvoice.depositAmountPaid > 0 ? (
                <div className="flex justify-between text-teal-400">
                  <span>Upfront Deposit Paid:</span>
                  <span>-{formatZAR(paymentModalInvoice.depositAmountPaid)}</span>
                </div>
              ) : null}
              {paymentModalInvoice.amountPaid > (paymentModalInvoice.depositAmountPaid || 0) && (
                <div className="flex justify-between text-slate-400">
                  <span>Other Partial Payments:</span>
                  <span>-{formatZAR(paymentModalInvoice.amountPaid - (paymentModalInvoice.depositAmountPaid || 0))}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-[#282E3E] text-amber-300 font-black">
                <span>Remaining Balance Due:</span>
                <span className="text-sm">
                  {formatZAR(Math.max(0, paymentModalInvoice.totalAmount - (paymentModalInvoice.amountPaid || 0)))}
                </span>
              </div>
            </div>

            {/* Previous Payments History */}
            {paymentModalInvoice.payments && paymentModalInvoice.payments.length > 0 && (
              <div className="p-3 rounded-xl bg-[#141722] border border-[#282E3E] space-y-2">
                <div className="text-[11px] font-bold text-slate-300 uppercase font-mono flex items-center justify-between">
                  <span>Payment History ({paymentModalInvoice.payments.length})</span>
                  <span className="text-emerald-400 font-bold">{formatZAR(paymentModalInvoice.amountPaid)} Total Paid</span>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {paymentModalInvoice.payments.map((pmt, pIdx) => (
                    <div
                      key={pmt.id || pIdx}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#1B1E28] border border-[#282E3E] text-xs font-mono"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5 text-white font-bold truncate">
                          <span>{formatZAR(pmt.amount)}</span>
                          <span className="text-[10px] font-normal text-slate-400">• {pmt.method}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          📅 {pmt.date} {pmt.reference ? `• Ref: ${pmt.reference}` : ''} {pmt.notes ? `• ${pmt.notes}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteInvoicePayment(paymentModalInvoice.id, pmt.id)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer transition-colors"
                        title="Remove this payment entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Amount Selection Buttons */}
            {(() => {
              const currentBalance = Math.max(0, paymentModalInvoice.totalAmount - (paymentModalInvoice.amountPaid || 0));
              return (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Quick Amount Presets:</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPayAmount(Number(currentBalance.toFixed(2)))}
                      className="px-2.5 py-1 rounded-lg bg-[#282E3E] hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 text-xs font-mono font-bold transition-colors cursor-pointer"
                    >
                      Full Balance ({formatZAR(currentBalance)})
                    </button>
                    {currentBalance > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPayAmount(Number((currentBalance / 2).toFixed(2)))}
                          className="px-2.5 py-1 rounded-lg bg-[#282E3E] hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold transition-colors cursor-pointer"
                        >
                          50% ({formatZAR(currentBalance / 2)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayAmount(Number((currentBalance / 3).toFixed(2)))}
                          className="px-2.5 py-1 rounded-lg bg-[#282E3E] hover:bg-teal-600/30 text-teal-400 border border-teal-500/30 text-xs font-mono font-bold transition-colors cursor-pointer"
                        >
                          1/3 Partial ({formatZAR(currentBalance / 3)})
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">
                  Amount to Record (ZAR)
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-amber-400 font-mono font-black text-lg focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Bank Reference Number</label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. TYME-REF-9921 or EFT-INSTALLMENT-1"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono uppercase font-bold">Payment Notes (Optional)</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. 1st installment paid after rough-in cabling"
                  className="w-full px-3 py-2 rounded-xl bg-[#12141C] border border-[#334155] text-white focus:outline-none focus:border-sky-500"
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
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95 flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {payAmount >= (paymentModalInvoice.totalAmount - (paymentModalInvoice.amountPaid || 0))
                    ? 'Settle in Full'
                    : 'Record Partial Payment'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Payment Modal */}
      {revertModalInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-[#282E3E]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Revert Payment Status</h3>
                  <p className="text-xs text-slate-400 font-mono">{revertModalInvoice.invoiceNumber} • {revertModalInvoice.clientName}</p>
                </div>
              </div>
              <button
                onClick={() => setRevertModalInvoice(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Information Alert */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Revert invoice to unpaid status?</p>
                <p className="text-amber-300/80 text-[11px]">
                  This invoice is currently settled in full ({formatZAR(revertModalInvoice.amountPaid)}). Reverting will revoke the paid status, re-establish an outstanding balance due, and allow you to modify line items or payment details.
                </p>
              </div>
            </div>

            {/* Invoice Breakdown */}
            <div className="p-3.5 rounded-xl bg-[#12141C] border border-[#282E3E] space-y-2 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Invoice Total:</span>
                <span className="text-white font-bold">{formatZAR(revertModalInvoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Currently Recorded as Paid:</span>
                <span>{formatZAR(revertModalInvoice.amountPaid)}</span>
              </div>
              {revertModalInvoice.depositAmountPaid && revertModalInvoice.depositAmountPaid > 0 ? (
                <div className="flex justify-between text-teal-400 text-[11px] pl-2 border-l border-teal-500/40">
                  <span>Upfront Deposit Portion:</span>
                  <span>{formatZAR(revertModalInvoice.depositAmountPaid)} ({revertModalInvoice.depositPaymentMethod || 'EFT'})</span>
                </div>
              ) : null}
            </div>

            {/* Reversion Action Options */}
            <div className="space-y-2.5 pt-1">
              <div className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                Select Reversion Method:
              </div>

              {/* Option 1: Complete Reversion */}
              <button
                onClick={() => handleRevertPaymentDirectly(revertModalInvoice, false)}
                className="w-full p-3 rounded-xl bg-[#141722] hover:bg-[#1E2330] border border-[#334155] hover:border-amber-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4 text-amber-400 group-hover:rotate-[-45deg] transition-transform" />
                    <span className="text-xs font-bold text-white">Full Revert to Unpaid (R0.00 Paid)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-bold">
                    Status: Issued
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 pl-6">
                  Clears all recorded payments. Restores total outstanding balance of {formatZAR(revertModalInvoice.totalAmount)}.
                </p>
              </button>

              {/* Option 2: Keep Deposit (if applicable) */}
              {revertModalInvoice.depositAmountPaid && revertModalInvoice.depositAmountPaid > 0 ? (
                <button
                  onClick={() => handleRevertPaymentDirectly(revertModalInvoice, true)}
                  className="w-full p-3 rounded-xl bg-[#141722] hover:bg-[#1E2330] border border-[#334155] hover:border-teal-500/50 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-teal-400" />
                      <span className="text-xs font-bold text-white">
                        Revert Settlement, Keep Deposit ({formatZAR(revertModalInvoice.depositAmountPaid)})
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 font-mono font-bold">
                      Partially Paid
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 pl-6">
                    Revokes final settlement, keeping the upfront deposit. Outstanding balance: {formatZAR(Math.max(0, revertModalInvoice.totalAmount - revertModalInvoice.depositAmountPaid))}.
                  </p>
                </button>
              ) : null}

              {/* Option 3: Revert & Immediately Open Editor */}
              <button
                onClick={() => handleRevertAndOpenEdit(revertModalInvoice, false)}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-sky-900/40 to-blue-900/40 hover:from-sky-900/60 hover:to-blue-900/60 border border-sky-500/40 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Edit2 className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-white">Revert to Unpaid & Open Full Editor</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold">
                    Revert & Edit
                  </span>
                </div>
                <p className="text-[11px] text-sky-200/70 mt-1 pl-6">
                  Reverts payment status and immediately opens the Tax Invoice editor so you can adjust line items, materials, labour, or discounts.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#282E3E]">
              <button
                onClick={() => setRevertModalInvoice(null)}
                className="px-4 py-2 rounded-xl bg-[#282E3E] text-slate-300 text-xs font-bold cursor-pointer hover:bg-[#334155]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Invoice Number Modal */}
      {numberEditInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1E28] border border-[#282E3E] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-[#12141C] border-b border-[#282E3E] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Hash className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Change Tax Invoice Number</h3>
              </div>
              <button
                type="button"
                onClick={() => setNumberEditInvoice(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Client Name:</span>
                <span className="text-white font-bold text-sm">{numberEditInvoice.clientName}</span>
              </div>

              <div>
                <label className="block text-slate-300 font-mono font-bold uppercase mb-1">
                  Tax Invoice Number
                </label>
                <input
                  type="text"
                  value={tempInvoiceNumber}
                  onChange={(e) => setTempInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-0102"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#12141C] border border-emerald-500/50 text-emerald-300 font-mono font-bold text-base focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <span>⚡ Automatic Sequence Tracking</span>
                </p>
                <p className="text-slate-300">
                  Changing this invoice number will update the document, and all subsequent invoices will automatically continue sequentially from the number after this one.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#12141C] border-t border-[#282E3E] flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setNumberEditInvoice(null)}
                className="px-4 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = tempInvoiceNumber.trim();
                  if (!cleaned) {
                    alert('Please enter a valid invoice number.');
                    return;
                  }
                  updateInvoiceNumber(numberEditInvoice.id, cleaned);
                  setNumberEditInvoice(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Save Number</span>
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
