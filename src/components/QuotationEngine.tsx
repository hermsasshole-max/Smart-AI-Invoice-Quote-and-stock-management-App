import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Quotation, QuoteLineItem, Client, ServiceCategory, QuoteStatus } from '../types';
import {
  formatZAR,
  calculateTotals,
  getWhatsAppShareLink,
  generateWhatsAppQuoteSummary,
  calculateSellingPrice,
} from '../utils/calculator';
import { exportToPDF, exportToExcel, exportToWord, exportToPlainText } from '../utils/multiFormatExport';
import { VoiceInvoiceWizard } from './VoiceInvoiceWizard';
import {
  FileText,
  Plus,
  Trash2,
  Phone,
  MessageSquare,
  Download,
  Share2,
  CheckCircle,
  Briefcase,
  Receipt,
  Search,
  Zap,
  MapPin,
  Clock,
  Car,
  Users,
  AlertCircle,
  ArrowRight,
  Edit2,
  Mic,
  ChevronDown,
  FileSpreadsheet,
  File,
  X,
  Percent,
} from 'lucide-react';

export const QuotationEngine: React.FC = () => {
  const {
    quotations,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    convertQuoteToJob,
    convertQuoteToInvoice,
    inventory,
    clients,
    addClient,
    profile,
    sunlightMode,
    setActiveTab,
  } = useApp();

  const [isCreating, setIsCreating] = useState(false);
  const [isVoiceWizardOpen, setIsVoiceWizardOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quotation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [openExportMenuId, setOpenExportMenuId] = useState<string | null>(null);

  // Form State for new quotation
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [serviceType, setServiceType] = useState<ServiceCategory>('Electrical');

  // Line items state
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Cost calculator parameters
  const [calloutFee, setCalloutFee] = useState<number>(profile.rates.calloutDiagnostic || 750);
  const [masterLabourHours, setMasterLabourHours] = useState<number>(2);
  const [masterLabourRate, setMasterLabourRate] = useState<number>(profile.rates.masterLabourRate || 550);
  const [assistantLabourHours, setAssistantLabourHours] = useState<number>(0);
  const [assistantLabourRate, setAssistantLabourRate] = useState<number>(profile.rates.assistantLabourRate || 150);
  const [travelKm, setTravelKm] = useState<number>(0);
  const [travelRate, setTravelRate] = useState<number>(profile.rates.travelRatePerKm || 9.5);
  const [isAfterHours, setIsAfterHours] = useState<boolean>(false);
  const [afterHoursMultiplier, setAfterHoursMultiplier] = useState<number>(profile.rates.afterHoursMultiplier || 1.5);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [vatEnabled, setVatEnabled] = useState<boolean>(true);
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(
    '70% deposit required upon equipment confirmation. Balance payable on completion. All equipment certified compliant with South African safety standards.'
  );

  // Calculate live totals
  const liveTotals = calculateTotals({
    items: lineItems,
    calloutFee,
    masterLabourHours,
    masterLabourRate,
    assistantLabourHours,
    assistantLabourRate,
    travelKm,
    travelRate,
    travelIncludedKm: profile.rates.travelIncludedKm || 25,
    isAfterHours,
    afterHoursMultiplier,
    discountPct,
    vatEnabled,
    vatRate: profile.defaultVatRate || 15,
  });

  // Client dropdown selection
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId === 'new') {
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setClientAddress('');
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setClientName(client.name);
      setClientPhone(client.phone);
      setClientEmail(client.email || '');
      setClientAddress(client.siteAddress);
      setServiceType(client.serviceType);
    }
  };

  // Add material line item from catalog
  const handleAddCatalogItem = (item: (typeof inventory)[0]) => {
    const existingIndex = lineItems.findIndex((li) => li.inventoryId === item.id);
    if (existingIndex >= 0) {
      const updated = [...lineItems];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
      setLineItems(updated);
    } else {
      const newLineItem: QuoteLineItem = {
        id: `li-${Date.now()}-${Math.random()}`,
        inventoryId: item.id,
        type: 'material',
        description: item.description,
        quantity: 1,
        unit: item.unit,
        unitCost: item.costPrice,
        unitPrice: item.sellingPrice,
        total: item.sellingPrice,
        category: item.category,
      };
      setLineItems([...lineItems, newLineItem]);
    }
  };

  // Add custom manual line item
  const handleAddCustomItem = () => {
    const newItem: QuoteLineItem = {
      id: `li-custom-${Date.now()}`,
      type: 'custom',
      description: 'Custom Consumable / Special Order Part',
      quantity: 1,
      unit: 'ea',
      unitCost: 100,
      unitPrice: 130,
      total: 130,
      category: serviceType,
    };
    setLineItems([...lineItems, newItem]);
  };

  // Update line item
  const handleUpdateLineItem = (id: string, field: keyof QuoteLineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.total = Number(updated.quantity) * Number(updated.unitPrice);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Submit and save new quotation
  const handleSaveQuotation = () => {
    if (!clientName.trim() || !clientPhone.trim()) {
      alert('Please provide at least client name and contact phone number.');
      return;
    }

    let finalClientId = selectedClientId;
    if (!selectedClientId || selectedClientId === 'new') {
      const newCli = addClient({
        name: clientName,
        phone: clientPhone,
        email: clientEmail,
        siteAddress: clientAddress || 'Site Location TBD',
        serviceType: serviceType,
      });
      finalClientId = newCli.id;
    }

    const quoteNumber = `QUO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    createQuotation({
      quoteNumber,
      clientId: finalClientId,
      clientName,
      clientPhone,
      clientEmail,
      clientAddress: clientAddress || 'Site Address TBD',
      serviceType,
      date: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: lineItems,
      calloutFee: liveTotals.calloutFee,
      masterLabourHours,
      masterLabourRate,
      assistantLabourHours,
      assistantLabourRate,
      travelKm,
      travelRate,
      isAfterHours,
      afterHoursMultiplier,
      materialsTotal: liveTotals.materialsTotal,
      labourTotal: liveTotals.labourTotal,
      travelTotal: liveTotals.travelTotal,
      subtotal: liveTotals.subtotal,
      discountPct: liveTotals.discountPct,
      discountAmount: liveTotals.discountAmount,
      vatEnabled,
      vatRate: 15,
      vatAmount: liveTotals.vatAmount,
      totalAmount: liveTotals.totalAmount,
      status: 'draft',
      scopeOfWork: scopeOfWork || notes,
      notes: notes || scopeOfWork,
      terms,
    });

    setIsCreating(false);
  };

  // Save Quotation Edit
  const handleSaveQuoteEdit = (q: Quotation) => {
    const materialsTotal = (q.items || []).reduce((sum, it) => sum + (Number(it.total) || 0), 0);
    const labourTotal =
      (Number(q.masterLabourHours) || 0) * (Number(q.masterLabourRate) || 0) +
      (Number(q.assistantLabourHours) || 0) * (Number(q.assistantLabourRate) || 0);
    const travelTotal = (Number(q.travelKm) || 0) * (Number(q.travelRate) || 0);
    const subtotal = materialsTotal + labourTotal + travelTotal + (Number(q.calloutFee) || 0);
    const safeDiscountPct = Math.max(0, Math.min(100, Number(q.discountPct) || 0));
    const discountAmount = Number(((subtotal * safeDiscountPct) / 100).toFixed(2));
    const subtotalAfterDiscount = subtotal - discountAmount;
    const vatAmount = q.vatEnabled ? Number((subtotalAfterDiscount * 0.15).toFixed(2)) : 0;
    const totalAmount = Number((subtotalAfterDiscount + vatAmount).toFixed(2));

    updateQuotation(q.id, {
      ...q,
      materialsTotal,
      labourTotal,
      travelTotal,
      subtotal,
      discountPct: safeDiscountPct,
      discountAmount,
      vatAmount,
      totalAmount,
    });

    setEditingQuote(null);
  };

  const filteredCatalog = inventory.filter((item) => {
    const matchSearch =
      item.description.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchSearch;
  });

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#E0E0E0]'}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D2D30] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#007AFF] text-white uppercase tracking-wider">
              FAST ON-SITE QUOTE ENGINE
            </span>
            <span className="text-[11px] font-mono text-[#707070]">SANS 10142-1 • ZAR TRADE RATES</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-[#FF6321]">
            Quotation Pipeline & Cost Modeler
          </h2>
          <p className="text-xs font-mono text-[#A0A0A5] mt-0.5">
            Create multi-item contractor estimates, automated labour/travel math, discount control, and multi-format exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          <button
            onClick={() => setIsVoiceWizardOpen(true)}
            className="px-3.5 py-2 rounded bg-gradient-to-r from-amber-500 to-[#FF6321] hover:from-amber-400 hover:to-[#e0551a] text-black font-bold text-xs uppercase flex items-center space-x-1.5 shadow-lg shadow-amber-500/20"
          >
            <Mic className="w-4 h-4 text-black animate-pulse" />
            <span>Voice Assistant</span>
          </button>

          <button
            id="btn-create-quote"
            onClick={() => setIsCreating(!isCreating)}
            className={`px-4 py-2 rounded font-mono font-bold text-xs uppercase flex items-center space-x-1.5 transition-all shadow ${
              isCreating
                ? 'bg-[#252528] text-[#A0A0A5] border border-[#2D2D30]'
                : sunlightMode
                ? 'bg-amber-400 text-black border-2 border-black font-extrabold'
                : 'bg-[#FF6321] hover:bg-[#e0551a] text-black shadow-lg shadow-[#FF632133]'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{isCreating ? 'Close Form' : '+ New Quotation'}</span>
          </button>
        </div>
      </div>

      {/* Quote Creation Form Drawer */}
      {isCreating && (
        <div
          className={`p-5 rounded-xl border space-y-6 shadow-2xl ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#2D2D30] pb-2">
            <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-[#FF6321] flex items-center space-x-2">
              <Zap className="w-4 h-4 text-[#FF6321]" />
              <span>ON-SITE QUOTE CAPTURE WIZARD</span>
            </h3>
            <span className="text-[10px] text-[#707070] font-mono">
              DRAFT ID: QUO-{new Date().getFullYear()}-XXXX
            </span>
          </div>

          {/* Section 1: Client Information */}
          <div>
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#707070] mb-3 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-[#007AFF]" />
              <span>1. CLIENT & SITE LOCATION</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                  Select Existing Client
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-mono"
                >
                  <option value="new">+ QUICK ADD NEW CLIENT</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                  Client / Business Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Johan Van Der Merwe"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                  Phone (WhatsApp) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 082 123 4567"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                  Service Category
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as ServiceCategory)}
                  className="w-full px-3 py-2 text-xs rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#007AFF] font-mono font-bold"
                >
                  <option value="Electrical">Electrical Installation & DB</option>
                  <option value="HVAC">HVAC+R Air Conditioning</option>
                  <option value="Solar">Solar PV & Battery Inverter</option>
                  <option value="Refrigeration">Refrigeration & Coldrooms</option>
                  <option value="Security">Security & CCTV Automation</option>
                  <option value="Consumables">Appliance / Maintenance</option>
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <label className="text-[10px] font-mono uppercase text-[#707070] block mb-1">
                  Physical Site Address (for GPS & travel billing)
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-[#707070] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. 42 Woodlands Drive, Woodmead, Sandton"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Scope of Work / Description of Services */}
          <div>
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#FF6321] mb-2 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-[#FF6321]" />
              <span>2. SCOPE OF WORK & SERVICE DESCRIPTION</span>
            </h4>
            <textarea
              rows={3}
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              placeholder="e.g. Supply and install 5kW Hybrid Inverter with 5.12kWh Lithium Battery and automated changeover switch. Issue SANS 10142 Certificate of Compliance on completion."
              className="w-full px-3 py-2 text-xs rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-sans"
            />
          </div>

          {/* Section 3: Material Line Items */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#707070] flex items-center space-x-1.5">
                <Receipt className="w-3.5 h-3.5 text-[#00FF41]" />
                <span>3. MATERIALS & PARTS (WITH LIVE STOCK CHECK)</span>
              </h4>

              <button
                onClick={handleAddCustomItem}
                className="text-xs font-mono text-[#00FF41] hover:underline font-bold flex items-center space-x-1 uppercase"
              >
                <Plus className="w-3 h-3" />
                <span>Add Custom Line Item</span>
              </button>
            </div>

            {/* Quick Catalog Search Bar */}
            <div className="mb-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#707070] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search ZAR Price Book (e.g. 2.5mm cable, 63A breaker, R410a gas, 5kW Deye, MC4)..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>

              {catalogSearch.trim() && (
                <div className="mt-1.5 p-2 bg-[#0A0A0B] border border-[#2D2D30] rounded max-h-48 overflow-y-auto space-y-1 z-20">
                  {filteredCatalog.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        handleAddCatalogItem(item);
                        setCatalogSearch('');
                      }}
                      className="p-2 rounded hover:bg-[#252528] cursor-pointer flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <span className="text-[10px] text-[#007AFF] mr-2">{item.sku}</span>
                        <span className="font-bold text-[#E0E0E0]">{item.description}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-[#00FF41] font-bold">{formatZAR(item.sellingPrice)}</span>
                        <span className="text-[10px] text-[#707070]">Stock: {item.stockOnHand} {item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Items table */}
            {lineItems.length > 0 && (
              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 p-2.5 rounded bg-[#0A0A0B] border border-[#2D2D30] items-center text-xs font-mono"
                  >
                    <div className="col-span-12 sm:col-span-5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleUpdateLineItem(item.id, 'description', e.target.value)}
                        className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30] text-xs font-bold text-[#E0E0E0]"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2 flex items-center space-x-1">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleUpdateLineItem(item.id, 'quantity', Number(e.target.value) || 1)}
                        className="w-16 px-2 py-1 rounded bg-[#141416] border border-[#2D2D30] text-xs text-center"
                      />
                      <span className="text-[10px] text-[#707070]">{item.unit || 'ea'}</span>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateLineItem(item.id, 'unitPrice', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30] text-xs text-right"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-right font-bold text-[#00FF41]">
                      {formatZAR(item.total)}
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        onClick={() => handleRemoveLineItem(item.id)}
                        className="p-1 text-[#707070] hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Labour & Discounts */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-[#0A0A0B] rounded border border-[#2D2D30] text-xs font-mono">
            <div>
              <label className="text-[10px] text-[#707070] block mb-1">Callout Fee</label>
              <input
                type="number"
                value={calloutFee}
                onChange={(e) => setCalloutFee(Number(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#707070] block mb-1">Master Labour (Hours)</label>
              <input
                type="number"
                value={masterLabourHours}
                onChange={(e) => setMasterLabourHours(Number(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#707070] block mb-1">Travel (Km)</label>
              <input
                type="number"
                value={travelKm}
                onChange={(e) => setTravelKm(Number(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#707070] block mb-1">Discount %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30] text-red-400 font-bold"
              />
            </div>
          </div>

          {/* Totals & Submit */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#2D2D30]">
            <label className="flex items-center space-x-2 text-xs font-mono cursor-pointer">
              <input
                type="checkbox"
                checked={vatEnabled}
                onChange={(e) => setVatEnabled(e.target.checked)}
                className="rounded accent-[#FF6321]"
              />
              <span>Include 15% South African VAT</span>
            </label>

            <div className="flex items-center space-x-3 font-mono">
              <div className="text-right">
                <div className="text-sm font-bold text-[#00FF41]">
                  Total: {formatZAR(liveTotals.totalAmount)}
                </div>
                <div className="text-[10px] text-[#707070]">
                  Sub: {formatZAR(liveTotals.subtotal)}
                  {liveTotals.discountAmount > 0 && ` • Disc: -${formatZAR(liveTotals.discountAmount)}`}
                </div>
              </div>

              <button
                onClick={handleSaveQuotation}
                className="px-5 py-2 rounded bg-[#00FF41] hover:bg-[#00d636] text-black font-bold text-xs uppercase shadow-lg shadow-[#00FF4133]"
              >
                Save & Issue Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quotations List */}
      <div className="space-y-4">
        {quotations.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#2D2D30] rounded-xl font-mono text-xs text-[#707070]">
            No quotations found. Click "+ New Quotation" or "Voice Assistant" to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quotations.map((quote) => {
              const totals = calculateTotals({
                items: quote.items,
                calloutFee: quote.calloutFee,
                masterLabourHours: quote.masterLabourHours,
                masterLabourRate: quote.masterLabourRate,
                assistantLabourHours: quote.assistantLabourHours,
                assistantLabourRate: quote.assistantLabourRate,
                travelKm: quote.travelKm,
                travelRate: quote.travelRate,
                isAfterHours: quote.isAfterHours,
                afterHoursMultiplier: quote.afterHoursMultiplier,
                discountPct: quote.discountPct,
                vatEnabled: quote.vatEnabled,
                vatRate: 15,
              });

              const whatsappSummary = generateWhatsAppQuoteSummary(
                profile,
                quote.quoteNumber,
                quote.clientName,
                quote.serviceType,
                totals,
                quote.vatEnabled
              );

              return (
                <div
                  key={quote.id}
                  className={`p-4 rounded-xl border transition-all ${
                    sunlightMode
                      ? 'bg-white border-2 border-black text-black'
                      : 'bg-[#1A1A1C] border-[#2D2D30] text-[#E0E0E0] hover:border-[#3D3D42]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2 font-mono">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#007AFF]">
                          {quote.quoteNumber}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0A0A0B] text-[#A0A0A5] border border-[#2D2D30]">
                          {quote.serviceType}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-[#E0E0E0] mt-1 font-sans">
                        {quote.clientName}
                      </h4>
                      <p className="text-[11px] text-[#707070] flex items-center space-x-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#707070]" />
                        <span>{quote.clientAddress}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-bold text-[#00FF41]">
                        {formatZAR(quote.totalAmount)}
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          quote.status === 'accepted'
                            ? 'bg-[#00FF4122] text-[#00FF41] border border-[#00FF4144]'
                            : quote.status === 'converted'
                            ? 'bg-[#007AFF22] text-[#007AFF] border border-[#007AFF44]'
                            : 'bg-[#0A0A0B] text-[#707070] border border-[#2D2D30]'
                        }`}
                      >
                        {quote.status}
                      </span>
                    </div>
                  </div>

                  {/* Scope of Work */}
                  {(quote.scopeOfWork || quote.notes) && (
                    <div className="p-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[11px] font-mono text-[#A0A0A5] mb-2">
                      <span className="text-[#FF6321] text-[9px] uppercase font-bold block mb-0.5">
                        Scope of Work:
                      </span>
                      <p className="line-clamp-2">{quote.scopeOfWork || quote.notes}</p>
                    </div>
                  )}

                  {/* Summary of Line Items */}
                  <div className="py-2 border-y border-[#2D2D30] text-[11px] font-mono text-[#A0A0A5] space-y-1 mb-3">
                    <div className="font-bold text-[#707070] text-[10px] uppercase">
                      Items & Materials ({quote.items.length}):
                    </div>
                    {quote.items.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="truncate pr-2">• {item.description} ({item.quantity} {item.unit})</span>
                        <span className="font-bold text-[#E0E0E0]">{formatZAR(item.total)}</span>
                      </div>
                    ))}
                    {quote.items.length > 2 && (
                      <div className="text-[10px] text-[#707070] italic">
                        + {quote.items.length - 2} more line items...
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono">
                    <div className="flex items-center space-x-1.5">
                      <a
                        href={getWhatsAppShareLink(quote.clientPhone, whatsappSummary)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded bg-[#25D366] text-black hover:bg-[#20ba59] text-xs font-bold flex items-center space-x-1 uppercase"
                        title="Share on WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>

                      {/* Multi-Format Export Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenExportMenuId(openExportMenuId === quote.id ? null : quote.id)
                          }
                          className="px-2.5 py-1.5 rounded bg-[#0A0A0B] text-[#E0E0E0] border border-[#2D2D30] hover:bg-[#252528] text-xs font-bold flex items-center space-x-1"
                        >
                          <Download className="w-3.5 h-3.5 text-[#00FF41]" />
                          <span>Export</span>
                          <ChevronDown className="w-3 h-3 text-[#707070]" />
                        </button>

                        {openExportMenuId === quote.id && (
                          <div className="absolute left-0 mt-1 w-44 rounded-lg bg-[#18181B] border border-[#2D2D30] shadow-2xl z-30 py-1 font-mono text-xs">
                            <button
                              onClick={() => {
                                exportToPDF('quote', quote, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#27272A] flex items-center space-x-2 text-[#E0E0E0]"
                            >
                              <FileText className="w-4 h-4 text-red-400" />
                              <span>PDF Document (.pdf)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToExcel('quote', quote, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#27272A] flex items-center space-x-2 text-[#E0E0E0]"
                            >
                              <FileSpreadsheet className="w-4 h-4 text-green-400" />
                              <span>Excel Sheet (.xlsx)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToWord('quote', quote, profile);
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[#27272A] flex items-center space-x-2 text-[#E0E0E0]"
                            >
                              <File className="w-4 h-4 text-blue-400" />
                              <span>Word Doc (.docx)</span>
                            </button>

                            <button
                              onClick={() => {
                                exportToPlainText('quote', quote, profile);
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

                      {/* Edit Button */}
                      <button
                        onClick={() => setEditingQuote(JSON.parse(JSON.stringify(quote)))}
                        className="p-1.5 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#A0A0A5] hover:text-white"
                        title="Edit Quotation"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#007AFF]" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => setDeleteConfirmId(quote.id)}
                        className="p-1.5 rounded bg-[#0A0A0B] border border-[#2D2D30] hover:border-red-500/40 text-[#707070] hover:text-red-400"
                        title="Delete Quotation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Convert Pipeline Actions */}
                    <div className="flex items-center space-x-1.5">
                      {quote.status !== 'converted' && (
                        <>
                          <button
                            onClick={() => {
                              convertQuoteToJob(quote.id);
                              setActiveTab('invoices');
                            }}
                            className="px-2 py-1 rounded bg-[#007AFF] hover:bg-[#0062cc] text-white text-[11px] font-bold flex items-center space-x-1 uppercase"
                            title="Convert to Active Job"
                          >
                            <Briefcase className="w-3 h-3" />
                            <span>To Job</span>
                          </button>

                          <button
                            onClick={() => {
                              convertQuoteToInvoice(quote.id);
                              setActiveTab('invoices');
                            }}
                            className="px-2 py-1 rounded bg-[#FF6321] hover:bg-[#e0551a] text-black text-[11px] font-bold flex items-center space-x-1 uppercase"
                            title="Convert Directly to Tax Invoice"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>To Invoice</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-5 rounded-xl bg-[#18181B] border border-red-500/40 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase">Delete Quotation</h3>
            </div>
            <p className="text-xs text-[#A0A0A5]">
              Are you sure you want to permanently delete this quotation?
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
                  deleteQuotation(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase"
              >
                Delete Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quotation Modal */}
      {editingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl bg-[#141416] border border-[#2D2D30] shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#2D2D30] pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#007AFF]" />
                <h3 className="font-bold text-sm text-white uppercase">
                  Edit Quotation: {editingQuote.quoteNumber}
                </h3>
              </div>
              <button
                onClick={() => setEditingQuote(null)}
                className="p-1 rounded text-[#707070] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Client & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Client Name</label>
                <input
                  type="text"
                  value={editingQuote.clientName}
                  onChange={(e) => setEditingQuote({ ...editingQuote, clientName: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Client Phone</label>
                <input
                  type="text"
                  value={editingQuote.clientPhone}
                  onChange={(e) => setEditingQuote({ ...editingQuote, clientPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#707070] block mb-1">Status</label>
                <select
                  value={editingQuote.status}
                  onChange={(e) =>
                    setEditingQuote({
                      ...editingQuote,
                      status: e.target.value as QuoteStatus,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#00FF41] font-bold uppercase"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="converted">Converted</option>
                </select>
              </div>
            </div>

            {/* Scope of Work */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[#FF6321] block font-bold">
                Scope of Work & Notes:
              </label>
              <textarea
                rows={3}
                value={editingQuote.scopeOfWork || editingQuote.notes || ''}
                onChange={(e) =>
                  setEditingQuote({
                    ...editingQuote,
                    scopeOfWork: e.target.value,
                    notes: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#E0E0E0] font-sans text-xs"
              />
            </div>

            {/* Line items editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#2D2D30] pb-1">
                <span className="font-bold text-white text-[11px] uppercase">
                  Line Items ({editingQuote.items?.length || 0})
                </span>
                <button
                  onClick={() => {
                    const newItem: QuoteLineItem = {
                      id: `li-edit-q-${Date.now()}`,
                      type: 'material',
                      description: 'New Material / Service Item',
                      quantity: 1,
                      unit: 'ea',
                      unitCost: 100,
                      unitPrice: 150,
                      total: 150,
                    };
                    setEditingQuote({
                      ...editingQuote,
                      items: [...(editingQuote.items || []), newItem],
                    });
                  }}
                  className="px-2 py-1 rounded bg-[#FF6321] text-black font-bold text-[10px] uppercase flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Item</span>
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(editingQuote.items || []).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="grid grid-cols-12 gap-2 p-2 rounded bg-[#0A0A0B] border border-[#2D2D30] items-center"
                  >
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...editingQuote.items];
                          updated[idx].description = e.target.value;
                          setEditingQuote({ ...editingQuote, items: updated });
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
                          const updated = [...editingQuote.items];
                          const q = Number(e.target.value) || 1;
                          updated[idx].quantity = q;
                          updated[idx].total = Number((q * updated[idx].unitPrice).toFixed(2));
                          setEditingQuote({ ...editingQuote, items: updated });
                        }}
                        className="w-full px-2 py-1 rounded bg-[#141416] border border-[#2D2D30] text-xs text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const updated = [...editingQuote.items];
                          const p = Number(e.target.value) || 0;
                          updated[idx].unitPrice = p;
                          updated[idx].total = Number((updated[idx].quantity * p).toFixed(2));
                          setEditingQuote({ ...editingQuote, items: updated });
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
                          const updated = editingQuote.items.filter((_, i) => i !== idx);
                          setEditingQuote({ ...editingQuote, items: updated });
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
                  value={editingQuote.calloutFee || 0}
                  onChange={(e) =>
                    setEditingQuote({
                      ...editingQuote,
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
                  value={editingQuote.labourTotal || 0}
                  onChange={(e) =>
                    setEditingQuote({
                      ...editingQuote,
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
                  value={editingQuote.travelTotal || 0}
                  onChange={(e) =>
                    setEditingQuote({
                      ...editingQuote,
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
                  value={editingQuote.discountPct || 0}
                  onChange={(e) =>
                    setEditingQuote({
                      ...editingQuote,
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
                  checked={editingQuote.vatEnabled}
                  onChange={(e) =>
                    setEditingQuote({ ...editingQuote, vatEnabled: e.target.checked })
                  }
                  className="rounded accent-[#FF6321]"
                />
                <span>Include 15% South African VAT</span>
              </label>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEditingQuote(null)}
                  className="px-3.5 py-1.5 rounded bg-[#252528] text-[#A0A0A5] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveQuoteEdit(editingQuote)}
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
        onSuccess={() => setIsVoiceWizardOpen(false)}
      />
    </div>
  );
};
