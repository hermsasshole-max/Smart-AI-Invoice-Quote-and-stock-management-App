import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Quotation, QuoteLineItem, Client, ServiceCategory } from '../types';
import {
  formatZAR,
  calculateTotals,
  getWhatsAppShareLink,
  generateWhatsAppQuoteSummary,
  calculateSellingPrice,
} from '../utils/calculator';
import { generateQuotePDF } from '../utils/pdfGenerator';
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
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Form State
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
  const [vatEnabled, setVatEnabled] = useState<boolean>(true);
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
      // Increase qty
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
    // Auto-save client if not exists
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

    const newQuote = createQuotation({
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
      vatEnabled,
      vatRate: 15,
      vatAmount: liveTotals.vatAmount,
      totalAmount: liveTotals.totalAmount,
      status: 'draft',
      notes,
      terms,
    });

    setIsCreating(false);
    setSelectedQuoteId(newQuote.id);
  };

  // Filtered inventory for picker
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
            Generate itemized estimates on-site with live SQLite inventory checks, labour calculations, and 1-tap WhatsApp sharing.
          </p>
        </div>

        <button
          id="btn-new-quote"
          onClick={() => {
            setIsCreating(!isCreating);
            if (!isCreating) {
              setLineItems([]);
              setSelectedClientId('');
              setClientName('');
              setClientPhone('');
              setClientEmail('');
              setClientAddress('');
            }
          }}
          className={`px-4 py-2 rounded font-mono font-bold text-xs uppercase flex items-center space-x-2 transition-all shadow ${
            isCreating
              ? 'bg-[#252528] text-[#A0A0A5] border border-[#2D2D30]'
              : sunlightMode
              ? 'bg-amber-400 text-black border-2 border-black font-extrabold'
              : 'bg-[#FF6321] hover:bg-[#e0551a] text-black shadow-lg shadow-[#FF632133]'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isCreating ? 'CANCEL BUILDER' : '+ NEW ON-SITE QUOTE'}</span>
        </button>
      </div>

      {/* Quote Builder Form */}
      {isCreating && (
        <div
          className={`p-5 rounded border space-y-6 shadow-2xl ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#2D2D30] pb-3">
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
              {/* Existing Client Picker */}
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

              {/* Client Name */}
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

              {/* Phone */}
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

              {/* Service Type Tag */}
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
                  <option value="Security">Security & CCTV Automation</option>
                  <option value="Consumables">Appliance / Maintenance</option>
                </select>
              </div>

              {/* Site Address */}
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

          {/* Section 2: Material Line Items & Catalog Picker */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#707070] flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-[#00FF41]" />
                <span>2. MATERIALS & PARTS (WITH LIVE STOCK CHECK)</span>
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

              {/* Live search dropdown results */}
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
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            item.stockOnHand > item.minStockAlert
                              ? 'bg-[#00FF4122] text-[#00FF41]'
                              : 'bg-[#FF444422] text-[#FF4444]'
                          }`}
                        >
                          {item.stockOnHand} {item.unit} IN STOCK
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Line Items Table */}
            {lineItems.length === 0 ? (
              <div className="p-4 text-center text-[#707070] border border-dashed border-[#2D2D30] rounded text-xs font-mono uppercase">
                No materials added yet. Search the price book above or click "+ Add Custom Line Item".
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 font-mono">
                {lineItems.map((item) => {
                  const stockRef = inventory.find((i) => i.id === item.inventoryId);
                  const isLow = stockRef && stockRef.stockOnHand < item.quantity;
                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded bg-[#0A0A0B] border flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs ${
                        isLow ? 'border-[#FF6321]' : 'border-[#2D2D30]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateLineItem(item.id, 'description', e.target.value)}
                          className="w-full bg-transparent font-bold text-[#E0E0E0] focus:outline-none focus:border-b focus:border-[#00FF41]"
                        />
                        {stockRef && (
                          <div className="text-[10px] text-[#707070] flex items-center space-x-2 mt-0.5">
                            <span>STOCK ON HAND: {stockRef.stockOnHand} {stockRef.unit}</span>
                            {isLow && (
                              <span className="text-[#FF6321] font-bold flex items-center space-x-0.5">
                                <AlertCircle className="w-3 h-3" />
                                <span>ORDER NEEDED ({item.quantity - stockRef.stockOnHand} SHORT)</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Qty */}
                        <div className="flex items-center space-x-1">
                          <span className="text-[9px] text-[#707070] uppercase">Qty:</span>
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleUpdateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-14 px-1.5 py-1 rounded bg-[#1A1A1C] border border-[#2D2D30] text-center font-bold text-[#E0E0E0]"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="flex items-center space-x-1">
                          <span className="text-[9px] text-[#707070] uppercase">R:</span>
                          <input
                            type="number"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 px-1.5 py-1 rounded bg-[#1A1A1C] border border-[#2D2D30] text-center font-bold text-[#00FF41]"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="w-20 text-right font-bold text-[#E0E0E0]">
                          {formatZAR(item.total)}
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => handleRemoveLineItem(item.id)}
                          className="p-1 text-[#707070] hover:text-[#FF4444]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Built-in South African Cost Calculator (Labour, Travel, After-Hours) */}
          <div className="p-4 rounded bg-[#0A0A0B] border border-[#2D2D30] space-y-3 font-mono">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#FF6321] flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>3. SOUTH AFRICAN LABOUR, CALL-OUT & TRAVEL CALCULATOR</span>
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* Callout Fee */}
              <div>
                <label className="text-[10px] text-[#707070] uppercase block mb-1">
                  Call-out / Diagnostic Base
                </label>
                <div className="flex items-center space-x-1">
                  <span className="text-[#707070]">R</span>
                  <input
                    type="number"
                    value={calloutFee}
                    onChange={(e) => setCalloutFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded bg-[#1A1A1C] border border-[#2D2D30] font-bold text-[#E0E0E0]"
                  />
                </div>
              </div>

              {/* Master Electrician Hours */}
              <div>
                <label className="text-[10px] text-[#707070] uppercase block mb-1">
                  Master Electrician (R{masterLabourRate}/hr)
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    value={masterLabourHours}
                    onChange={(e) => setMasterLabourHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded bg-[#1A1A1C] border border-[#2D2D30] font-bold text-[#E0E0E0]"
                  />
                  <span className="text-[#707070]">hrs</span>
                </div>
              </div>

              {/* Assistant Labour Hours */}
              <div>
                <label className="text-[10px] text-[#707070] uppercase block mb-1">
                  Assistant Labour (R{assistantLabourRate}/hr)
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    value={assistantLabourHours}
                    onChange={(e) => setAssistantLabourHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded bg-[#1A1A1C] border border-[#2D2D30] font-bold text-[#E0E0E0]"
                  />
                  <span className="text-[#707070]">hrs</span>
                </div>
              </div>

              {/* Travel Km */}
              <div>
                <label className="text-[10px] text-[#707070] uppercase block mb-1">
                  Total Travel (First 25km Free)
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={travelKm}
                    onChange={(e) => setTravelKm(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded bg-[#1A1A1C] border border-[#2D2D30] font-bold text-[#E0E0E0]"
                  />
                  <span className="text-[#707070]">km</span>
                </div>
              </div>
            </div>

            {/* Multipliers & VAT Checkboxes */}
            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#2D2D30] text-xs gap-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAfterHours}
                  onChange={(e) => setIsAfterHours(e.target.checked)}
                  className="rounded text-[#FF6321] focus:ring-[#FF6321]"
                />
                <span className="font-bold text-[#FF6321]">
                  Emergency / After-Hours Surcharge (1.5x Multiplier)
                </span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vatEnabled}
                  onChange={(e) => setVatEnabled(e.target.checked)}
                  className="rounded text-[#00FF41] focus:ring-[#00FF41]"
                />
                <span className="font-bold text-[#E0E0E0]">
                  Add 15% South African VAT
                </span>
              </label>
            </div>
          </div>

          {/* Section 4: Live Totals & Final Summary */}
          <div className="p-4 rounded bg-[#0A0A0B] border border-[#2D2D30] flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono">
            <div className="space-y-1 text-xs text-[#A0A0A5]">
              <div>MATERIALS: <span className="font-bold text-[#E0E0E0]">{formatZAR(liveTotals.materialsTotal)}</span></div>
              <div>LABOUR & DIAGNOSTIC: <span className="font-bold text-[#E0E0E0]">{formatZAR(liveTotals.labourTotal + liveTotals.calloutFee)}</span></div>
              <div>TRAVEL: <span className="font-bold text-[#E0E0E0]">{formatZAR(liveTotals.travelTotal)}</span></div>
              {vatEnabled && <div>VAT (15%): <span className="font-bold text-[#E0E0E0]">{formatZAR(liveTotals.vatAmount)}</span></div>}
            </div>

            <div className="text-right">
              <div className="text-[10px] text-[#707070] uppercase">TOTAL QUOTE ESTIMATE</div>
              <div className="text-2xl md:text-3xl font-bold text-[#00FF41]">
                {formatZAR(liveTotals.totalAmount)}
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="flex items-center justify-end space-x-3 font-mono">
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#A0A0A5] text-xs font-bold uppercase hover:bg-[#252528]"
            >
              Discard
            </button>

            <button
              id="btn-save-quote"
              onClick={handleSaveQuotation}
              className="px-6 py-2.5 rounded bg-[#FF6321] hover:bg-[#e0551a] text-black font-bold text-xs uppercase shadow-lg shadow-[#FF632133] flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Save & Commit Official Quote</span>
            </button>
          </div>
        </div>
      )}

      {/* Existing Quotations List */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[#707070] flex items-center space-x-2">
          <FileText className="w-3.5 h-3.5 text-[#007AFF]" />
          <span>Active Quotations ({quotations.length})</span>
        </h3>

        {quotations.length === 0 ? (
          <div className="p-8 text-center text-[#707070] border border-dashed border-[#2D2D30] rounded font-mono uppercase">
            <p className="text-xs font-bold">No quotations created yet.</p>
            <p className="text-[10px] mt-1">Click "+ New On-Site Quote" to capture your first estimate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quotations.map((quote) => {
              const whatsappSummary = generateWhatsAppQuoteSummary(
                profile,
                quote.quoteNumber,
                quote.clientName,
                quote.serviceType,
                calculateTotals({
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
                  vatEnabled: quote.vatEnabled,
                  vatRate: 15,
                }),
                quote.vatEnabled
              );

              return (
                <div
                  key={quote.id}
                  className={`p-4 rounded border transition-all ${
                    sunlightMode
                      ? 'bg-white border-2 border-black text-black'
                      : 'bg-[#1A1A1C] border-[#2D2D30] text-[#E0E0E0]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3 font-mono">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-[#007AFF]">
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
                      <div className="text-lg font-bold text-[#00FF41]">
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

                  {/* Summary of Line Items */}
                  <div className="py-2 border-y border-[#2D2D30] text-[11px] font-mono text-[#A0A0A5] space-y-1 mb-3">
                    <div className="font-bold text-[#707070] text-[10px] uppercase">Included Items & Labour:</div>
                    {quote.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="truncate pr-2">• {item.description} ({item.quantity} {item.unit})</span>
                        <span className="font-bold text-[#E0E0E0]">{formatZAR(item.total)}</span>
                      </div>
                    ))}
                    {quote.items.length > 3 && (
                      <div className="text-[10px] text-[#707070] italic">
                        + {quote.items.length - 3} more items...
                      </div>
                    )}
                  </div>

                  {/* Action Bar (WhatsApp, Call, PDF, Convert) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono">
                    <div className="flex items-center space-x-1.5">
                      {/* Direct WhatsApp Share Link */}
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

                      {/* Phone call */}
                      <a
                        href={`tel:${quote.clientPhone}`}
                        className="p-1.5 rounded bg-[#007AFF] text-white hover:bg-[#0062cc]"
                        title="Call Client"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>

                      {/* PDF Download */}
                      <button
                        onClick={() => generateQuotePDF(quote, profile)}
                        className="px-2.5 py-1.5 rounded bg-[#0A0A0B] text-[#E0E0E0] border border-[#2D2D30] hover:bg-[#252528] text-xs font-bold flex items-center space-x-1 uppercase"
                        title="Download Branded PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-[#00FF41]" />
                        <span>PDF</span>
                      </button>
                    </div>

                    {/* Conversion Pipeline Actions */}
                    <div className="flex items-center space-x-1.5">
                      {quote.status !== 'converted' && (
                        <>
                          <button
                            onClick={() => {
                              convertQuoteToJob(quote.id);
                              setActiveTab('invoices');
                            }}
                            className="px-2.5 py-1.5 rounded bg-[#007AFF] hover:bg-[#0062cc] text-white text-xs font-bold flex items-center space-x-1 uppercase"
                            title="Convert to Active Job"
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>To Job</span>
                          </button>

                          <button
                            onClick={() => {
                              convertQuoteToInvoice(quote.id);
                              setActiveTab('invoices');
                            }}
                            className="px-2.5 py-1.5 rounded bg-[#FF6321] hover:bg-[#e0551a] text-black text-xs font-bold flex items-center space-x-1 uppercase"
                            title="Convert Directly to Tax Invoice"
                          >
                            <Receipt className="w-3.5 h-3.5" />
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
    </div>
  );
};
