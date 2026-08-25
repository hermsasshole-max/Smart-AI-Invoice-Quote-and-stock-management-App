import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { QuoteLineItem, ScannedReceiptData, ScannedLineItem, ServiceCategory } from '../types';
import { formatZAR, calculateSellingPrice } from '../utils/calculator';
import {
  Camera,
  Upload,
  Sparkles,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  FileCheck,
  RotateCw,
  SlidersHorizontal,
  FileText,
  RefreshCw,
  Building2,
  Calendar,
  Hash,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyItemsToQuote?: (items: QuoteLineItem[]) => void;
}

const CATEGORIES: ServiceCategory[] = [
  'Electrical',
  'Air Conditioning',
  'Solar & Backup',
  'Security & CCTV',
  'Automation & Gate Motors',
  'Maintenance & Repairs',
];

/**
 * Offscreen Canvas Image Processor:
 * Scales massive high-res camera photos down to max 2048x2048px,
 * handles rotation (0, 90, 180, 270 deg), and optionally applies
 * high-contrast grayscale enhancement for thermal paper receipts.
 */
async function processImageCanvas(
  sourceDataUrl: string,
  rotationAngle = 0,
  enhanceContrast = false,
  maxWidth = 2048,
  maxHeight = 2048,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Failed to decode image data on device.'));
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Scale dimensions while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const isRotated90or270 = rotationAngle === 90 || rotationAngle === 270;
        const canvasWidth = isRotated90or270 ? height : width;
        const canvasHeight = isRotated90or270 ? width : height;

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, canvasWidth);
        canvas.height = Math.max(1, canvasHeight);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          resolve(sourceDataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Apply rotation transforms
        ctx.save();
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.rotate((rotationAngle * Math.PI) / 180);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        ctx.restore();

        // Apply high-contrast & thermal slip enhancement filter if enabled
        if (enhanceContrast) {
          const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
          const data = imageData.data;
          const contrastFactor = 1.35; // +35% contrast boost
          const intercept = 128 * (1 - contrastFactor);

          for (let i = 0; i < data.length; i += 4) {
            // Luminance formula (ITU-R BT.601)
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            // Apply contrast curve
            const adjusted = Math.min(255, Math.max(0, gray * contrastFactor + intercept));
            data[i] = adjusted;
            data[i + 1] = adjusted;
            data[i + 2] = adjusted;
          }
          ctx.putImageData(imageData, 0, 0);
        }

        const outputDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(outputDataUrl);
      } catch (err: any) {
        reject(new Error('Image processing error: ' + err.message));
      }
    };
    img.src = sourceDataUrl;
  });
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyItemsToQuote,
}) => {
  const { profile, addInventoryItem, sunlightMode } = useApp();

  // State
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [enhanceContrast, setEnhanceContrast] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);

  const [scanResult, setScanResult] = useState<ScannedReceiptData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle new image upload
  const handleProcessFile = (file: File) => {
    setErrorMessage(null);
    setScanResult(null);
    setIsProcessingImage(true);

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMessage('Could not read image file from your device.');
      setIsProcessingImage(false);
    };
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setOriginalImage(dataUrl);
      setRotationAngle(0);
      setEnhanceContrast(false);

      try {
        const processed = await processImageCanvas(dataUrl, 0, false);
        setProcessedImage(processed);
      } catch (err: any) {
        console.error('Image initial processing error:', err);
        setProcessedImage(dataUrl);
      } finally {
        setIsProcessingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  // Rotate image by 90 degrees
  const handleRotateImage = async () => {
    if (!originalImage) return;
    const newAngle = (rotationAngle + 90) % 360;
    setRotationAngle(newAngle);
    setIsProcessingImage(true);

    try {
      const updated = await processImageCanvas(originalImage, newAngle, enhanceContrast);
      setProcessedImage(updated);
    } catch (err: any) {
      console.error('Rotation error:', err);
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Toggle contrast enhancement
  const handleToggleContrast = async () => {
    if (!originalImage) return;
    const newContrast = !enhanceContrast;
    setEnhanceContrast(newContrast);
    setIsProcessingImage(true);

    try {
      const updated = await processImageCanvas(originalImage, rotationAngle, newContrast);
      setProcessedImage(updated);
    } catch (err: any) {
      console.error('Contrast toggle error:', err);
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Perform AI OCR scan
  const runOcrScan = async () => {
    if (!processedImage) return;

    setIsScanning(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: processedImage,
          mimeType: 'image/jpeg',
        }),
      });

      if (!response.ok) {
        let errMessage = 'Failed to extract invoice data.';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch {
          // not json
        }
        throw new Error(errMessage);
      }

      const data: ScannedReceiptData = await response.json();

      // Normalize items with markup
      const defaultMarkup = profile.defaultMarkup || 35;
      const normalizedItems: ScannedLineItem[] = (data.items || []).map((item, idx) => ({
        id: 'scan_item_' + idx + '_' + Date.now(),
        description: item.description || 'Materials Item',
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitCost: Math.max(0, Number(item.unitCost) || 0),
        category: item.category || 'Electrical',
        unit: item.unit || 'ea',
        markupPct: item.markupPct !== undefined ? item.markupPct : defaultMarkup,
        total: Number(((item.quantity || 1) * (item.unitCost || 0)).toFixed(2)),
      }));

      // Calculate total amount if 0
      let total = Number(data.totalAmount) || 0;
      if (total <= 0 && normalizedItems.length > 0) {
        total = normalizedItems.reduce((acc, it) => acc + it.quantity * it.unitCost, 0);
      }

      setScanResult({
        supplierName: data.supplierName || 'Supplier Slip',
        invoiceNumber: data.invoiceNumber || 'INV-' + Math.floor(100000 + Math.random() * 900000),
        date: data.date || new Date().toISOString().split('T')[0],
        totalAmount: total,
        vatAmount: data.vatAmount || Number((total * 0.15 / 1.15).toFixed(2)),
        items: normalizedItems,
        notes: data.notes,
        rawText: data.rawText,
        isPartial: data.isPartial,
        isFallback: data.isFallback,
      });
    } catch (err: any) {
      console.error('[OCR Frontend Error]:', err);
      setErrorMessage(
        err.message || 'Error communicating with AI OCR engine. Check your connection and try again.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Edit item helper
  const handleUpdateItem = (index: number, updates: Partial<ScannedLineItem>) => {
    if (!scanResult) return;
    const items = [...scanResult.items];
    const current = items[index];
    const updated = { ...current, ...updates };

    if (updates.quantity !== undefined || updates.unitCost !== undefined) {
      updated.total = Number(((updated.quantity || 1) * (updated.unitCost || 0)).toFixed(2));
    }

    items[index] = updated;

    // Recalculate total
    const newTotal = items.reduce((acc, it) => acc + (it.quantity || 1) * (it.unitCost || 0), 0);
    setScanResult({
      ...scanResult,
      items,
      totalAmount: Number(newTotal.toFixed(2)),
      vatAmount: Number((newTotal * 0.15 / 1.15).toFixed(2)),
    });
  };

  // Add a new manual item
  const handleAddItem = () => {
    if (!scanResult) return;
    const newItem: ScannedLineItem = {
      id: 'scan_item_' + Date.now(),
      description: 'Additional Material Line',
      quantity: 1,
      unitCost: 150,
      category: 'Electrical',
      unit: 'ea',
      markupPct: profile.defaultMarkup || 35,
      total: 150,
    };
    const items = [...scanResult.items, newItem];
    const newTotal = items.reduce((acc, it) => acc + it.quantity * it.unitCost, 0);

    setScanResult({
      ...scanResult,
      items,
      totalAmount: Number(newTotal.toFixed(2)),
      vatAmount: Number((newTotal * 0.15 / 1.15).toFixed(2)),
    });
  };

  // Remove an item
  const handleRemoveItem = (index: number) => {
    if (!scanResult) return;
    const items = scanResult.items.filter((_, idx) => idx !== index);
    const newTotal = items.reduce((acc, it) => acc + (it.quantity || 1) * (it.unitCost || 0), 0);

    setScanResult({
      ...scanResult,
      items,
      totalAmount: Number(newTotal.toFixed(2)),
      vatAmount: Number((newTotal * 0.15 / 1.15).toFixed(2)),
    });
  };

  // Apply to Inventory
  const handleApplyToInventory = () => {
    if (!scanResult?.items || scanResult.items.length === 0) return;

    scanResult.items.forEach((item) => {
      const markup = item.markupPct || profile.defaultMarkup || 35;
      const selling = calculateSellingPrice(item.unitCost, markup);
      addInventoryItem({
        sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
        name: item.description,
        category: (item.category as any) || 'Electrical',
        costPrice: item.unitCost,
        defaultMarkup: markup,
        sellingPrice: selling,
        unit: item.unit || 'ea',
        stockQty: item.quantity,
        minStockLevel: 2,
        supplier: scanResult.supplierName || 'Supplier Invoice',
        notes: `Extracted via OCR from slip ${scanResult.invoiceNumber} (${scanResult.date})`,
      });
    });

    onClose();
  };

  // Apply to Quotation
  const handleApplyToQuote = () => {
    if (!scanResult?.items || !onApplyItemsToQuote) return;

    const lineItems: QuoteLineItem[] = scanResult.items.map((item) => {
      const markup = item.markupPct || profile.defaultMarkup || 35;
      const unitPrice = calculateSellingPrice(item.unitCost, markup);
      const total = Number((unitPrice * item.quantity).toFixed(2));

      return {
        id: 'item_' + Date.now() + Math.random().toString().slice(-4),
        description: item.description,
        category: (item.category as any) || 'Electrical',
        costPrice: item.unitCost,
        markupPct: markup,
        unitPrice,
        quantity: item.quantity,
        unit: item.unit || 'ea',
        total,
      };
    });

    onApplyItemsToQuote(lineItems);
    onClose();
  };

  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setScanResult(null);
    setErrorMessage(null);
    setRotationAngle(0);
    setEnhanceContrast(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className={`modal-container relative w-full max-w-4xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
        sunlightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#1B1E28] border-[#334155] text-white'
      }`}>
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          sunlightMode ? 'bg-slate-100 border-slate-300' : 'bg-[#151722] border-[#282E3E]'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Smart Supplier Slip & Invoice OCR</h2>
              <p className="text-xs text-slate-400">
                Instant AI material extraction for Voltex, ARB, Plumblink, ACDC Express, Builders & more
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#282E3E] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Upload / Capture Screen if no image */}
          {!processedImage ? (
            <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              sunlightMode ? 'border-slate-300 bg-slate-50 hover:border-sky-500' : 'border-[#334155] bg-[#12141C] hover:border-sky-500'
            }`}>
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Upload or Take Photo of Supplier Slip</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports high-resolution camera photos, thermal till slips, PDF invoices, and receipts.
                  </p>
                </div>

                {isProcessingImage ? (
                  <div className="p-4 rounded-xl bg-sky-500/10 text-sky-400 text-xs flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Optimizing document resolution & optical contrast...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo (Camera)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 border cursor-pointer ${
                        sunlightMode
                          ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                          : 'bg-[#282E3E] hover:bg-[#334155] text-slate-200 border-[#334155]'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload File</span>
                    </button>
                  </div>
                )}

                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                {/* Popular Suppliers Badges */}
                <div className="pt-4 border-t border-[#282E3E]/40">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-2 font-semibold">
                    Supported Supplier Formats
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-[#1B1E28] border border-[#334155]">Voltex</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#1B1E28] border border-[#334155]">ARB Wholesalers</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#1B1E28] border border-[#334155]">ACDC Express</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#1B1E28] border border-[#334155]">Plumblink</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#1B1E28] border border-[#334155]">Builders</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#1B1E28] border border-[#334155]">Herholdts Solar</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Toolbar & Preview */}
              <div className={`p-4 rounded-2xl border ${
                sunlightMode ? 'bg-slate-100 border-slate-300' : 'bg-[#12141C] border-[#282E3E]'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-mono uppercase text-slate-400">Pre-Scan Controls:</span>
                    <button
                      type="button"
                      onClick={handleRotateImage}
                      disabled={isProcessingImage || isScanning}
                      className="px-3 py-1.5 rounded-lg bg-[#1B1E28] hover:bg-[#282E3E] text-slate-200 text-xs font-medium flex items-center space-x-1.5 border border-[#334155] cursor-pointer disabled:opacity-50"
                      title="Rotate image 90 degrees clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                      <span>Rotate 90° ({rotationAngle}°)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleContrast}
                      disabled={isProcessingImage || isScanning}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 border cursor-pointer disabled:opacity-50 ${
                        enhanceContrast
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-[#1B1E28] hover:bg-[#282E3E] text-slate-200 border-[#334155]'
                      }`}
                      title="Enhances faint thermal till print and low contrast scans"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                      <span>{enhanceContrast ? 'Enhanced Contrast ON' : 'Auto-Enhance Contrast'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium flex items-center space-x-1 border border-red-500/30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Change Image</span>
                  </button>
                </div>

                {/* Image Preview Box */}
                <div className="relative rounded-xl overflow-hidden bg-black/50 border border-[#334155] max-h-64 flex items-center justify-center">
                  <img
                    src={processedImage}
                    alt="Document preview"
                    className="max-h-64 object-contain transition-all"
                  />
                  {isProcessingImage && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center space-x-2 text-white text-xs font-mono">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                      <span>Adjusting image...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scan Trigger Button */}
              {!scanResult && (
                <button
                  type="button"
                  onClick={runOcrScan}
                  disabled={isScanning || isProcessingImage}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-600 to-sky-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm sm:text-base flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/20 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Extracting Materials & Prices with Gemini AI Vision...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Scan & Extract Supplier Line Items</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Scanner Issue:</span>
                <span>{errorMessage}</span>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleRotateImage}
                    className="underline text-sky-400 hover:text-sky-300 font-mono text-[11px] cursor-pointer"
                  >
                    Try Rotating Image
                  </button>
                  <span>•</span>
                  <button
                    onClick={handleToggleContrast}
                    className="underline text-amber-400 hover:text-amber-300 font-mono text-[11px] cursor-pointer"
                  >
                    Toggle High Contrast Filter
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Extracted Results Panel */}
          {scanResult && (
            <div className={`space-y-5 p-4 sm:p-6 rounded-2xl border ${
              sunlightMode ? 'bg-slate-50 border-slate-300' : 'bg-[#12141C] border-[#282E3E]'
            }`}>
              {/* Notice Banner if Fallback / Partial */}
              {(scanResult.isPartial || scanResult.isFallback) && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 text-[11px]">
                    <span className="font-bold block">Review & Verify Document Items:</span>
                    <span>
                      {scanResult.notes || 'Data extracted using best-effort OCR heuristics. You can edit any descriptions, quantities, and prices directly in the table below.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Header Slip Metadata Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-[#1B1E28] border border-[#334155]">
                {/* Supplier Name */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-bold flex items-center space-x-1">
                    <Building2 className="w-3 h-3 text-sky-400" />
                    <span>Supplier / Merchant</span>
                  </label>
                  <input
                    type="text"
                    value={scanResult.supplierName}
                    onChange={(e) => setScanResult({ ...scanResult, supplierName: e.target.value })}
                    placeholder="e.g. Voltex / Plumblink"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#12141C] border border-[#334155] text-white text-xs font-semibold focus:border-sky-500 focus:outline-none"
                  />
                </div>

                {/* Slip Number */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-bold flex items-center space-x-1">
                    <Hash className="w-3 h-3 text-sky-400" />
                    <span>Slip / Invoice Ref</span>
                  </label>
                  <input
                    type="text"
                    value={scanResult.invoiceNumber}
                    onChange={(e) => setScanResult({ ...scanResult, invoiceNumber: e.target.value })}
                    placeholder="e.g. INV-982314"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#12141C] border border-[#334155] text-white text-xs font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-bold flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-sky-400" />
                    <span>Slip Date</span>
                  </label>
                  <input
                    type="date"
                    value={scanResult.date}
                    onChange={(e) => setScanResult({ ...scanResult, date: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#12141C] border border-[#334155] text-white text-xs font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>

                {/* Total Rand Amount */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-amber-400 font-bold flex items-center space-x-1">
                    <DollarSign className="w-3 h-3 text-amber-400" />
                    <span>Total Rand on Slip (ZAR)</span>
                  </label>
                  <div className="px-2.5 py-1.5 rounded-lg bg-[#12141C] border border-amber-500/40 text-amber-400 font-mono font-black text-sm">
                    {formatZAR(scanResult.totalAmount)}
                  </div>
                </div>
              </div>

              {/* Interactive Line Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center space-x-1.5">
                    <span>Extracted Line Items ({scanResult.items.length})</span>
                  </h4>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-semibold flex items-center space-x-1 border border-sky-500/30 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {/* Items Container */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {scanResult.items.map((item, idx) => {
                    const markup = item.markupPct !== undefined ? item.markupPct : profile.defaultMarkup || 35;
                    const sellingPrice = calculateSellingPrice(item.unitCost, markup);

                    return (
                      <div
                        key={item.id || idx}
                        className="p-3 rounded-xl bg-[#1B1E28] border border-[#334155] space-y-2.5 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(idx, { description: e.target.value })}
                            placeholder="Item description"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#12141C] border border-[#334155] text-white font-medium focus:border-sky-500 focus:outline-none"
                          />

                          <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                            <select
                              value={item.category || 'Electrical'}
                              onChange={(e) => handleUpdateItem(idx, { category: e.target.value })}
                              className="px-2 py-1.5 rounded-lg bg-[#12141C] border border-[#334155] text-slate-300 text-xs focus:outline-none"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Numeric Fields Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-[#282E3E]/60 text-[11px] font-mono">
                          {/* Quantity */}
                          <div>
                            <span className="text-slate-400 block text-[10px]">Qty</span>
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                className="w-16 px-1.5 py-1 rounded bg-[#12141C] border border-[#334155] text-white text-center font-bold"
                              />
                              <input
                                type="text"
                                value={item.unit || 'ea'}
                                onChange={(e) => handleUpdateItem(idx, { unit: e.target.value })}
                                className="w-10 px-1 py-1 rounded bg-[#12141C] border border-[#334155] text-slate-400 text-center"
                                placeholder="ea"
                              />
                            </div>
                          </div>

                          {/* Unit Cost Price */}
                          <div>
                            <span className="text-slate-400 block text-[10px]">Unit Cost (ZAR)</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => handleUpdateItem(idx, { unitCost: parseFloat(e.target.value) || 0 })}
                              className="w-full px-1.5 py-1 rounded bg-[#12141C] border border-[#334155] text-amber-400 font-bold"
                            />
                          </div>

                          {/* Markup % */}
                          <div>
                            <span className="text-slate-400 block text-[10px]">Markup %</span>
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                value={markup}
                                onChange={(e) => handleUpdateItem(idx, { markupPct: parseFloat(e.target.value) || 0 })}
                                className="w-14 px-1.5 py-1 rounded bg-[#12141C] border border-[#334155] text-sky-400 text-center font-bold"
                              />
                              <span className="text-slate-400">%</span>
                            </div>
                          </div>

                          {/* Selling Price */}
                          <div>
                            <span className="text-slate-400 block text-[10px]">Selling Rate</span>
                            <div className="py-1 font-bold text-sky-400">{formatZAR(sellingPrice)}</div>
                          </div>

                          {/* Cost Total */}
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px]">Line Total</span>
                            <div className="py-1 font-bold text-white">{formatZAR(item.quantity * item.unitCost)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Raw OCR Text Diagnostic Drawer */}
              {scanResult.rawText && (
                <div className="rounded-xl border border-[#334155] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="w-full px-4 py-2.5 bg-[#1B1E28] hover:bg-[#282E3E] text-slate-300 text-xs font-mono flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                      <span>View Raw OCR Document Text & Transcription</span>
                    </span>
                    {showRawText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showRawText && (
                    <div className="p-3 bg-[#0F1118] text-slate-300 text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border-t border-[#334155]">
                      {scanResult.rawText}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#282E3E]">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl bg-[#1B1E28] hover:bg-[#282E3E] text-slate-300 text-xs font-semibold flex items-center space-x-1.5 border border-[#334155] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan Another Slip</span>
                </button>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleApplyToInventory}
                    className="px-4 py-2.5 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-[#334155] cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>Save to Van Inventory</span>
                  </button>

                  {onApplyItemsToQuote && (
                    <button
                      type="button"
                      onClick={handleApplyToQuote}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                    >
                      <FileCheck className="w-4 h-4 text-slate-950" />
                      <span>Apply Items to Quotation</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
