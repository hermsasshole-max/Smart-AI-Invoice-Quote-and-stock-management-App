import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { QuoteLineItem } from '../types';
import { formatZAR, calculateSellingPrice } from '../utils/calculator';
import {
  Camera,
  Upload,
  Sparkles,
  Check,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  FileCheck,
} from 'lucide-react';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyItemsToQuote?: (items: QuoteLineItem[]) => void;
}

/**
 * Offscreen Canvas Image Compressor:
 * Scales massive high-res camera photos down to a maximum of 1600x1600px
 * and compresses them to JPEG (0.8 quality) to prevent browser/WebView
 * Out-Of-Memory (OOM) crashes and payload limit errors.
 */
async function compressAndScaleImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read photo from device storage.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data for OCR.'));
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

          // Render into HTML5 offscreen canvas
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            // Fallback to original string if canvas context fails
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (canvasErr) {
          reject(new Error('Image canvas rendering failed: ' + (canvasErr as Error).message));
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyItemsToQuote,
}) => {
  const { profile, addInventoryItem } = useApp();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    supplierName?: string;
    invoiceNumber?: string;
    date?: string;
    totalAmount?: number;
    vatAmount?: number;
    items?: Array<{
      description: string;
      quantity: number;
      unitCost: number;
      category?: string;
      unit?: string;
      markupPct?: number;
    }>;
    notes?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    setScanResult(null);
    setIsCompressing(true);

    try {
      // Compress and scale before sending to OCR
      const compressedBase64 = await compressAndScaleImage(file, 1600, 1600, 0.8);
      setSelectedImage(compressedBase64);
    } catch (err: any) {
      console.error('Photo processing error:', err);
      setErrorMessage(err.message || 'Could not process the selected image. Please try again.');
    } finally {
      setIsCompressing(false);
      // Reset input element values so same file can be re-selected if necessary
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (file) {
        handleProcessFile(file);
      }
    } catch (err: any) {
      console.error('File input change error:', err);
      setErrorMessage('Failed to access selected file. Please grant file permissions.');
    }
  };

  const runOcrScan = async () => {
    if (!selectedImage) return;

    setIsScanning(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: selectedImage,
          mimeType: 'image/jpeg',
        }),
      });

      if (!response.ok) {
        let errMessage = 'Failed to extract invoice data.';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch {
          // Response was not JSON
        }
        throw new Error(errMessage);
      }

      const data = await response.json();
      // Apply default business markup to parsed items
      if (data.items && Array.isArray(data.items)) {
        data.items = data.items.map((item: any) => ({
          ...item,
          markupPct: profile.defaultMarkup || 35,
        }));
      }
      setScanResult(data);
    } catch (err: any) {
      console.error('Gemini AI OCR Scan error:', err);
      setErrorMessage(
        err.message || 'Error communicating with AI OCR engine. Check your internet connection and try again.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyToInventory = () => {
    if (!scanResult?.items) return;

    scanResult.items.forEach((item) => {
      const selling = calculateSellingPrice(item.unitCost, item.markupPct || profile.defaultMarkup || 35);
      addInventoryItem({
        sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
        name: item.description,
        category: (item.category as any) || 'Electrical',
        costPrice: item.unitCost,
        defaultMarkup: item.markupPct || 35,
        sellingPrice: selling,
        unit: item.unit || 'ea',
        stockQty: item.quantity,
        minStockLevel: 2,
        supplier: scanResult.supplierName || 'Supplier Invoice',
      });
    });

    onClose();
  };

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="modal-container relative w-full max-w-3xl bg-[#1B1E28] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#151722] border-b border-[#282E3E]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Smart Supplier Invoice OCR Scanner</h2>
              <p className="text-xs text-slate-400">
                Instantly extract line items from Voltex, ARB, Plumblink, or ACDC Express slips
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Photo Capture & Upload Area */}
          {!selectedImage ? (
            <div className="border-2 border-dashed border-[#334155] hover:border-sky-500 rounded-2xl p-8 text-center transition-all bg-[#12141C]">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Upload or Take Photo of Supplier Slip</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports Voltex, ARB, ACDC Express, Herholdts, Plumblink, Builders Warehouse, etc.
                  </p>
                </div>

                {isCompressing ? (
                  <div className="p-4 rounded-xl bg-sky-500/10 text-sky-400 text-xs flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Optimizing photo resolution for mobile performance...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo (Camera)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs sm:text-sm font-semibold flex items-center space-x-2 border border-[#334155] cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Image File</span>
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
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview Card */}
              <div className="relative rounded-xl overflow-hidden bg-black/40 border border-[#334155] max-h-64 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Supplier slip preview"
                  className="max-h-64 object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setScanResult(null);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white shadow-lg cursor-pointer"
                  title="Remove Image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Scan Trigger Button */}
              {!scanResult && (
                <button
                  type="button"
                  onClick={runOcrScan}
                  disabled={isScanning}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/20 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Extracting Materials with Gemini AI OCR...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Scan & Extract Line Items</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* OCR Extracted Results Table */}
          {scanResult && (
            <div className="space-y-4 bg-[#12141C] p-4 sm:p-5 rounded-2xl border border-[#282E3E]">
              {/* Slip Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#282E3E]">
                <div>
                  <span className="text-[10px] uppercase font-mono text-sky-400 font-bold block">Supplier Detected</span>
                  <h4 className="font-bold text-white text-base">{scanResult.supplierName || 'Unknown Merchant'}</h4>
                  <div className="text-xs text-slate-400 font-mono">
                    Ref: {scanResult.invoiceNumber || 'N/A'} | Date: {scanResult.date || 'Today'}
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-[10px] uppercase text-slate-400 block">Total on Slip</span>
                  <span className="text-lg font-black text-amber-400">{formatZAR(scanResult.totalAmount)}</span>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Extracted Items ({scanResult.items?.length || 0})
                </h5>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {scanResult.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#1B1E28] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-white">{item.description}</div>
                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                          Cost: {formatZAR(item.unitCost)} / {item.unit || 'ea'} • Qty: {item.quantity}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                          <span className="text-[11px] text-slate-400">Markup:</span>
                          <input
                            type="number"
                            value={item.markupPct || 35}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              const updated = [...(scanResult.items || [])];
                              updated[idx].markupPct = val;
                              setScanResult({ ...scanResult, items: updated });
                            }}
                            className="w-14 px-1.5 py-1 rounded bg-[#12141C] border border-[#334155] text-amber-400 font-mono text-center font-bold text-xs"
                          />
                          <span className="text-slate-400 font-mono">%</span>
                        </div>

                        <div className="text-right font-mono min-w-20">
                          <span className="text-[10px] text-slate-400 block">Selling Rate</span>
                          <span className="font-bold text-sky-400">
                            {formatZAR(calculateSellingPrice(item.unitCost, item.markupPct || 35))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#282E3E]">
                <button
                  type="button"
                  onClick={handleApplyToInventory}
                  className="px-4 py-2 rounded-xl bg-[#282E3E] hover:bg-[#334155] text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-[#334155] cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Save to Van Stock & Inventory</span>
                </button>

                {onApplyItemsToQuote && (
                  <button
                    type="button"
                    onClick={handleApplyToQuote}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                  >
                    <FileCheck className="w-4 h-4 text-slate-950" />
                    <span>Apply Items to Active Quotation</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
