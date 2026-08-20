import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ScannedInvoiceResult, ScannedSupplierItem, ServiceCategory } from '../types';
import { formatZAR, calculateSellingPrice, calculateMarkupPct } from '../utils/calculator';
import {
  ScanLine,
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  PackagePlus,
  RefreshCw,
  FileCheck,
  Building,
  Calendar,
  Layers,
  HelpCircle,
} from 'lucide-react';

export const ReceiptScannerModal: React.FC = () => {
  const { inventory, applyScannedInvoiceToInventory, setActiveTab, sunlightMode, profile } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<ScannedInvoiceResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState<{ updatedCount: number; createdCount: number } | null>(null);

  // Match scanned items against local inventory
  const matchAndEnrichItems = (
    rawItems: Array<{
      sku?: string;
      description: string;
      quantity: number;
      unit?: string;
      unitCostPrice: number;
      lineTotal: number;
      vatAmount?: number;
      category?: string;
    }>
  ): ScannedSupplierItem[] => {
    return rawItems.map((raw) => {
      // 1. Try SKU match
      let matched = inventory.find(
        (i) => raw.sku && i.sku.toLowerCase().trim() === raw.sku.toLowerCase().trim()
      );

      // 2. Fallback fuzzy text match
      if (!matched && raw.description) {
        const descLower = raw.description.toLowerCase();
        matched = inventory.find((i) => {
          const localLower = i.description.toLowerCase();
          return localLower.includes(descLower) || descLower.includes(localLower);
        });
      }

      let priceChangePct: number | undefined = undefined;
      if (matched && matched.costPrice > 0 && raw.unitCostPrice) {
        priceChangePct = calculateMarkupPct(matched.costPrice, raw.unitCostPrice);
      }

      const defaultMarkup = profile.rates.defaultMaterialMarkupPct || 30;
      const initialSellingPrice = matched
        ? calculateSellingPrice(raw.unitCostPrice, matched.markupPct)
        : calculateSellingPrice(raw.unitCostPrice, defaultMarkup);

      return {
        sku: raw.sku || (matched ? matched.sku : `SKU-${Math.floor(1000 + Math.random() * 9000)}`),
        description: raw.description,
        quantity: Number(raw.quantity) || 1,
        unit: raw.unit || (matched ? matched.unit : 'ea'),
        unitCostPrice: Number(raw.unitCostPrice) || 0,
        lineTotal: Number(raw.lineTotal) || Number(raw.unitCostPrice) * (Number(raw.quantity) || 1),
        vatAmount: raw.vatAmount,
        category: (raw.category as ServiceCategory) || (matched ? matched.category : 'Electrical'),
        matchedItemId: matched ? matched.id : undefined,
        existingCostPrice: matched ? matched.costPrice : undefined,
        existingStock: matched ? matched.stockOnHand : undefined,
        priceChangePct,
        action: matched ? 'update_stock_and_price' : 'create_new',
        newSellingPrice: initialSellingPrice,
      };
    });
  };

  // Preset South African supplier samples for instantaneous demonstration
  const loadPresetSample = (supplier: 'voltex' | 'metraclark' | 'arb') => {
    setIsScanning(true);
    setErrorMessage(null);
    setAppliedSuccess(null);

    setTimeout(() => {
      let mockRaw;
      if (supplier === 'voltex') {
        mockRaw = {
          supplierName: 'Voltex (Pty) Ltd - East Rand Branch',
          invoiceNumber: 'VTX-INV-849201',
          invoiceDate: new Date().toISOString().split('T')[0],
          vatNumber: '4790129841',
          subtotal: 4230.0,
          vatTotal: 634.5,
          grandTotal: 4864.5,
          notes: 'Standard 30-Day Trade Account. SABS Approved Electrical Products.',
          items: [
            {
              sku: 'VOLT-SURF-2.5-100',
              description: '2.5mm² Surfix Flat Twin + Earth White Cable (100m Roll)',
              quantity: 2,
              unit: 'roll',
              unitCostPrice: 1520.0, // Slight price increase from 1450
              lineTotal: 3040.0,
              vatAmount: 456.0,
              category: 'Electrical',
            },
            {
              sku: 'CBI-MCB-20A-1P',
              description: 'CBI Din-Rail Circuit Breaker 20A 1P 3kA (Plugs & Sockets)',
              quantity: 10,
              unit: 'ea',
              unitCostPrice: 74.0,
              lineTotal: 740.0,
              vatAmount: 111.0,
              category: 'Electrical',
            },
            {
              sku: 'WTR-ISOL-32A-IP65',
              description: 'Weatherproof Rotary Isolator Switch 32A 2-Pole IP65 (Aircon/Geyser)',
              quantity: 3,
              unit: 'ea',
              unitCostPrice: 150.0, // Price increased from 135
              lineTotal: 450.0,
              vatAmount: 67.5,
              category: 'Electrical',
            },
          ],
        };
      } else if (supplier === 'metraclark') {
        mockRaw = {
          supplierName: 'Metraclark HVAC&R Wholesalers',
          invoiceNumber: 'MC-2026-99381',
          invoiceDate: new Date().toISOString().split('T')[0],
          vatNumber: '4120938491',
          subtotal: 8250.0,
          vatTotal: 1237.5,
          grandTotal: 9487.5,
          notes: 'Refrigeration Equipment & Gases. Certified pressure cylinders.',
          items: [
            {
              sku: 'GAS-R410A-11.3KG',
              description: 'Refrigerant Gas R410a Virgin (11.3kg Cylinder)',
              quantity: 2,
              unit: 'canister',
              unitCostPrice: 1850.0, // Increased from 1750
              lineTotal: 3700.0,
              vatAmount: 555.0,
              category: 'HVAC',
            },
            {
              sku: 'MET-COP-PAIR-14-38',
              description: 'Pre-Insulated Copper Pipe Pair 1/4" + 3/8" with Armaflex (15m Coil)',
              quantity: 3,
              unit: 'roll',
              unitCostPrice: 1150.0,
              lineTotal: 3450.0,
              vatAmount: 517.5,
              category: 'HVAC',
            },
            {
              sku: 'CAP-DUAL-45-5UF',
              description: 'Dual Run Motor Capacitor 45+5µF 450V Round Aluminium (Aircon)',
              quantity: 6,
              unit: 'ea',
              unitCostPrice: 145.0,
              lineTotal: 870.0,
              vatAmount: 130.5,
              category: 'HVAC',
            },
          ],
        };
      } else {
        mockRaw = {
          supplierName: 'ARB Electrical Wholesalers (Solar Division)',
          invoiceNumber: 'ARB-SLR-44109',
          invoiceDate: new Date().toISOString().split('T')[0],
          vatNumber: '4019284719',
          subtotal: 21500.0,
          vatTotal: 3225.0,
          grandTotal: 24725.0,
          notes: 'Tier 1 Solar Photovoltaic Panels & Accessories. 10-Year Manufacturer Warranty.',
          items: [
            {
              sku: 'JA-SOL-550W-MONO',
              description: 'JA Solar 550W Tier-1 Mono PERC Half-Cell Solar Panel (Silver Frame)',
              quantity: 12,
              unit: 'ea',
              unitCostPrice: 1420.0, // Dropped from 1450
              lineTotal: 17040.0,
              vatAmount: 2556.0,
              category: 'Solar',
            },
            {
              sku: 'SOL-DC-CBL-6MM-BLK',
              description: '6mm² TUV Certified UV-Resistant Solar DC Cable Black (100m Roll)',
              quantity: 2,
              unit: 'roll',
              unitCostPrice: 1680.0,
              lineTotal: 3360.0,
              vatAmount: 504.0,
              category: 'Solar',
            },
            {
              sku: 'MC4-CONN-PAIR-IP67',
              description: 'MC4 Male & Female Solar Cable Connector Pairs IP67 (Pack of 10)',
              quantity: 4,
              unit: 'box',
              unitCostPrice: 180.0,
              lineTotal: 720.0,
              vatAmount: 108.0,
              category: 'Solar',
            },
          ],
        };
      }

      const enriched = matchAndEnrichItems(mockRaw.items);
      setScannedResult({
        ...mockRaw,
        items: enriched,
      });
      setIsScanning(false);
    }, 800);
  };

  // Real Camera capture & File upload handler calling `/api/scan-invoice`
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setAppliedSuccess(null);
    setIsScanning(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);

      try {
        const response = await fetch('/api/scan-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
          }),
        });

        const json = await response.json();
        if (!json.success || !json.data) {
          throw new Error(json.error || 'Failed to parse invoice OCR response');
        }

        const enriched = matchAndEnrichItems(json.data.items || []);
        setScannedResult({
          supplierName: json.data.supplierName || 'Scanned Supplier',
          invoiceNumber: json.data.invoiceNumber || 'INV-SCANNED',
          invoiceDate: json.data.invoiceDate || new Date().toISOString().split('T')[0],
          vatNumber: json.data.vatNumber,
          subtotal: json.data.subtotal || 0,
          vatTotal: json.data.vatTotal || 0,
          grandTotal: json.data.grandTotal || 0,
          notes: json.data.notes,
          rawImagePreview: base64,
          items: enriched,
        });
      } catch (err: any) {
        console.error('Scan error:', err);
        setErrorMessage(err?.message || 'Error communicating with Gemini Vision scanner.');
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Toggle item action (Update stock vs Skip vs Create new)
  const handleItemActionChange = (index: number, action: ScannedSupplierItem['action']) => {
    if (!scannedResult) return;
    const updated = [...scannedResult.items];
    updated[index] = { ...updated[index], action };
    setScannedResult({ ...scannedResult, items: updated });
  };

  // Modify quantity or price directly in review table
  const handleItemFieldChange = (
    index: number,
    field: keyof ScannedSupplierItem,
    value: any
  ) => {
    if (!scannedResult) return;
    const updated = [...scannedResult.items];
    const item = { ...updated[index], [field]: value };

    // Recalculate line total if cost or qty changes
    if (field === 'unitCostPrice' || field === 'quantity') {
      item.lineTotal = Number(item.unitCostPrice) * Number(item.quantity);
      const markup = profile.rates.defaultMaterialMarkupPct || 30;
      item.newSellingPrice = calculateSellingPrice(item.unitCostPrice, markup);
      if (item.existingCostPrice) {
        item.priceChangePct = calculateMarkupPct(item.existingCostPrice, item.unitCostPrice);
      }
    }

    updated[index] = item;
    setScannedResult({ ...scannedResult, items: updated });
  };

  // Apply to inventory
  const handleApplyToInventory = () => {
    if (!scannedResult) return;
    const result = applyScannedInvoiceToInventory(scannedResult);
    setAppliedSuccess(result);
  };

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${sunlightMode ? 'text-black' : 'text-[#E0E0E0]'}`}>
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D2D30] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF6321] text-black flex items-center space-x-1 uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>GEMINI 3.7 MULTIMODAL OCR</span>
            </span>
            <span className="text-[11px] font-mono text-[#707070]">ZERO-ERROR SA SUPPLIER PARSER</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1 text-[#FF6321]">
            Supplier Receipt & Invoice Scanner
          </h2>
          <p className="text-xs font-mono text-[#A0A0A5] mt-0.5">
            Capture delivery notes (Voltex, ARB, Metraclark, ACDC) to update stock levels, calculate trade margins, and flag price inflation.
          </p>
        </div>
      </div>

      {/* Upload / Camera Capture Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload box */}
        <div
          className={`lg:col-span-1 p-4 rounded border flex flex-col justify-between ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Camera className="w-4 h-4 text-[#FF6321]" />
              <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-[#E0E0E0]">
                Capture Device Input
              </h3>
            </div>

            {/* Hidden native camera/file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Main big touch button for field camera */}
            <button
              id="btn-take-photo-invoice"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className={`w-full py-5 px-4 rounded font-mono font-bold flex flex-col items-center justify-center space-y-2 transition-all border border-dashed ${
                isScanning
                  ? 'bg-[#111113] border-[#2D2D30] text-[#707070] cursor-not-allowed'
                  : sunlightMode
                  ? 'bg-amber-300 border-black text-black hover:bg-amber-400 shadow-md'
                  : 'bg-[#0A0A0B] border-[#FF6321] hover:bg-[#151619] text-[#FF6321]'
              }`}
            >
              <div className="w-12 h-12 rounded bg-[#FF6321] text-black flex items-center justify-center shadow-lg shadow-[#FF632133]">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-[#E0E0E0]">Snap Photo with Camera</span>
              <span className="text-[10px] text-[#707070]">OR BROWSE DEVICE FILES</span>
            </button>

            {/* Quick SA Supplier Presets for instant testing */}
            <div className="mt-5">
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#707070] mb-2 flex items-center space-x-1">
                <Building className="w-3.5 h-3.5 text-[#007AFF]" />
                <span>1-TAP SA SUPPLIER PRESETS:</span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <button
                  onClick={() => loadPresetSample('voltex')}
                  disabled={isScanning}
                  className="p-2 rounded bg-[#0A0A0B] border border-[#2D2D30] hover:border-[#FF6321] text-center transition-all text-xs font-bold"
                >
                  <div className="text-[#FF6321] font-bold">VOLTEX</div>
                  <div className="text-[9px] text-[#707070]">Cable & DB</div>
                </button>

                <button
                  onClick={() => loadPresetSample('metraclark')}
                  disabled={isScanning}
                  className="p-2 rounded bg-[#0A0A0B] border border-[#2D2D30] hover:border-[#007AFF] text-center transition-all text-xs font-bold"
                >
                  <div className="text-[#007AFF] font-bold">METRACLARK</div>
                  <div className="text-[9px] text-[#707070]">HVAC Gas</div>
                </button>

                <button
                  onClick={() => loadPresetSample('arb')}
                  disabled={isScanning}
                  className="p-2 rounded bg-[#0A0A0B] border border-[#2D2D30] hover:border-[#00FF41] text-center transition-all text-xs font-bold"
                >
                  <div className="text-[#00FF41] font-bold">ARB SOLAR</div>
                  <div className="text-[9px] text-[#707070]">Panels & DC</div>
                </button>
              </div>
            </div>
          </div>

          {/* Tips note */}
          <div className="mt-4 pt-3 border-t border-[#2D2D30] text-[10px] font-mono text-[#707070] flex items-start space-x-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-[#FF6321] shrink-0 mt-0.5" />
            <span>
              TIPS: Keep paper invoice flat with good lighting for 100% SKU extraction accuracy.
            </span>
          </div>
        </div>

        {/* OCR Result & Live Verification Panel */}
        <div
          className={`lg:col-span-2 p-4 rounded border ${
            sunlightMode ? 'bg-white border-2 border-black' : 'bg-[#1A1A1C] border-[#2D2D30]'
          }`}
        >
          {isScanning ? (
            <div className="py-16 text-center space-y-4 font-mono">
              <div className="w-12 h-12 border-2 border-[#FF6321] border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="font-bold text-xs uppercase tracking-widest text-[#FF6321]">
                Gemini Vision OCR Parsing Supplier Invoice...
              </div>
              <p className="text-[11px] text-[#707070] max-w-md mx-auto">
                Extracting supplier metadata, tax totals, line SKUs, and cross-matching local SQLite inventory.
              </p>
            </div>
          ) : errorMessage ? (
            <div className="p-6 text-center space-y-3 bg-[#1A1A1C] border border-[#FF4444] rounded font-mono">
              <AlertCircle className="w-8 h-8 text-[#FF4444] mx-auto" />
              <div className="font-bold text-xs text-[#FF4444] uppercase">OCR Scan Notice</div>
              <p className="text-xs text-[#E0E0E0]">{errorMessage}</p>
              <button
                onClick={() => loadPresetSample('voltex')}
                className="px-4 py-2 bg-[#FF6321] text-black rounded text-xs font-bold uppercase"
              >
                Load Sample Voltex Invoice Instead
              </button>
            </div>
          ) : scannedResult ? (
            <div className="space-y-4">
              {/* Scanned Invoice Metadata Banner */}
              <div className="p-3.5 rounded bg-[#0A0A0B] border border-[#2D2D30] flex flex-wrap items-center justify-between gap-3 font-mono">
                <div>
                  <div className="text-[10px] text-[#FF6321] font-bold uppercase tracking-widest">
                    Supplier Detected
                  </div>
                  <div className="text-base font-bold text-[#E0E0E0]">{scannedResult.supplierName}</div>
                  <div className="text-[11px] text-[#707070] flex items-center space-x-2 mt-0.5">
                    <span>INV: {scannedResult.invoiceNumber}</span>
                    <span>•</span>
                    <span>DATE: {scannedResult.invoiceDate}</span>
                    {scannedResult.vatNumber && (
                      <>
                        <span>•</span>
                        <span>VAT: {scannedResult.vatNumber}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-[#707070] uppercase">Total Scanned Amount</div>
                  <div className="text-lg font-bold text-[#00FF41]">
                    {formatZAR(scannedResult.grandTotal)}
                  </div>
                  <div className="text-[10px] text-[#707070]">
                    (EXCL VAT: {formatZAR(scannedResult.subtotal)})
                  </div>
                </div>
              </div>

              {/* Items Table with Auto-Inventory Match Status */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#707070] flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span>Scanned Line Items & Stock Action</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#707070]">{scannedResult.items.length} ITEMS PARSED</span>
                </div>

                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {scannedResult.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border transition-all ${
                        item.action === 'skip'
                          ? 'bg-[#0A0A0B]/40 border-[#2D2D30] opacity-50'
                          : item.priceChangePct && item.priceChangePct > 0
                          ? 'bg-[#0A0A0B] border-[#FF6321]'
                          : 'bg-[#0A0A0B] border-[#2D2D30]'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        {/* Description & Match Badge */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1 font-mono">
                            <span className="text-[10px] font-bold text-[#007AFF] bg-[#1A1A1C] px-1.5 py-0.5 rounded border border-[#2D2D30]">
                              {item.sku}
                            </span>
                            <span className="text-[10px] font-semibold text-[#A0A0A5] px-1.5 py-0.5 rounded bg-[#1A1A1C] border border-[#2D2D30]">
                              {item.category}
                            </span>

                            {item.matchedItemId ? (
                              <span className="text-[10px] font-bold text-[#00FF41] bg-[#1A1A1C] border border-[#00FF4144] px-1.5 py-0.5 rounded flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>MATCHED CATALOG (STOCK: {item.existingStock} {item.unit})</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-[#007AFF] bg-[#1A1A1C] border border-[#007AFF44] px-1.5 py-0.5 rounded flex items-center space-x-1">
                                <PackagePlus className="w-3 h-3" />
                                <span>NEW ITEM</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-bold text-[#E0E0E0]">{item.description}</div>

                          {/* Price Change & Markup Notification */}
                          {item.priceChangePct !== undefined && item.priceChangePct !== 0 && (
                            <div className="mt-1 flex items-center space-x-2 text-[10px] font-mono">
                              {item.priceChangePct > 0 ? (
                                <span className="text-[#FF6321] font-bold flex items-center space-x-0.5">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>COST INCREASED +{item.priceChangePct}% (OLD: {formatZAR(item.existingCostPrice)})</span>
                                </span>
                              ) : (
                                <span className="text-[#00FF41] font-bold flex items-center space-x-0.5">
                                  <TrendingDown className="w-3 h-3" />
                                  <span>COST DROPPED {item.priceChangePct}%</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Editable Quantities & Costs */}
                        <div className="flex flex-wrap items-center gap-3 font-mono">
                          <div>
                            <span className="text-[9px] text-[#707070] block uppercase">Qty</span>
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleItemFieldChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-xs rounded bg-[#1A1A1C] border border-[#2D2D30] text-white text-center font-bold"
                            />
                          </div>

                          <div>
                            <span className="text-[9px] text-[#707070] block uppercase">Trade Cost</span>
                            <div className="text-xs font-bold text-[#00FF41]">{formatZAR(item.unitCostPrice)}</div>
                          </div>

                          <div>
                            <span className="text-[9px] text-[#707070] block uppercase">Selling Price</span>
                            <div className="text-xs font-bold text-[#E0E0E0]">{formatZAR(item.newSellingPrice)}</div>
                          </div>

                          {/* Action Selector */}
                          <div>
                            <span className="text-[9px] text-[#707070] block uppercase">Action</span>
                            <select
                              value={item.action}
                              onChange={(e) => handleItemActionChange(idx, e.target.value as any)}
                              className="px-2 py-1 text-xs rounded bg-[#1A1A1C] border border-[#2D2D30] text-[#E0E0E0] font-semibold"
                            >
                              <option value="update_stock_and_price">Update Stock & Cost</option>
                              <option value="create_new">Add as New Item</option>
                              <option value="skip">Ignore Item</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Success Message */}
              {appliedSuccess && (
                <div className="p-3 bg-[#00FF4111] border border-[#00FF41] text-[#00FF41] rounded flex items-center justify-between font-mono">
                  <div className="flex items-center space-x-2 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-[#00FF41]" />
                    <span>
                      UPDATED {appliedSuccess.updatedCount} ITEMS AND CREATED {appliedSuccess.createdCount} NEW ITEMS IN SQLITE!
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="px-3 py-1 bg-[#00FF41] text-black rounded text-[11px] font-bold uppercase"
                  >
                    View Price Book
                  </button>
                </div>
              )}

              {/* Bottom Action Buttons */}
              <div className="pt-3 border-t border-[#2D2D30] flex flex-wrap items-center justify-between gap-3 font-mono">
                <button
                  onClick={() => {
                    setScannedResult(null);
                    setSelectedImage(null);
                    setAppliedSuccess(null);
                  }}
                  className="px-3 py-2 rounded bg-[#0A0A0B] border border-[#2D2D30] text-[#A0A0A5] hover:bg-[#252528] text-xs font-bold uppercase"
                >
                  Clear / Scan Another
                </button>

                <button
                  id="btn-apply-inventory-batch"
                  onClick={handleApplyToInventory}
                  className="px-5 py-2.5 rounded bg-[#FF6321] hover:bg-[#e0551a] text-black font-bold text-xs uppercase flex items-center space-x-2 shadow-lg shadow-[#FF632133]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Apply All to Inventory (Batch Commit)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3 text-[#707070] font-mono">
              <ScanLine className="w-10 h-10 text-[#3D3D40] mx-auto" />
              <div className="font-bold text-xs uppercase tracking-widest text-[#E0E0E0]">Ready to Scan Supplier Invoice</div>
              <p className="text-[11px] max-w-sm mx-auto">
                Snap a picture of your paper invoice from your camera or select one of the SA supplier sample presets on the left.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
