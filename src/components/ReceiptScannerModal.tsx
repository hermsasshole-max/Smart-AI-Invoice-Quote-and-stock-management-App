import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { QuoteLineItem, ScannedReceiptData, ScannedLineItem, ServiceCategory } from '../types';
import { formatZAR, calculateSellingPrice } from '../utils/calculator';
import { entitlementManager } from '../services/EntitlementManager';
import { getApiUrl } from '../config/api';
import { fetchWithRetry, wakeBackendServer } from '../utils/apiClient';
import { offlineSyncQueue } from '../services/offlineSyncQueue';
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
  'Refridgeration, Motors and Fans',
  'Solar & Backup',
  'Security & CCTV',
  'Automation & Gate Motors',
  'Maintenance & Repairs',
];

/**
 * Mobile-Optimized Canvas Image Processor:
 * Efficiently downscales high-megapixel camera photos (from iPhone/Android 12MP-48MP)
 * to 1600px max dimension, applies optional 90-degree rotations and thermal slip
 * contrast filtering, and exports clean ~250KB JPEG base64 payloads to prevent
 * mobile timeouts and memory crashes.
 */
async function processImageCanvas(
  source: File | Blob | string,
  rotationAngle = 0,
  enhanceContrast = false,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    // Helper to read file as data URL fallback
    const fallbackFileReader = (fileOrBlob: File | Blob) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = (e.target?.result as string) || '';
        resolve(result);
      };
      reader.onerror = () => {
        resolve('');
      };
      reader.readAsDataURL(fileOrBlob);
    };

    let objectUrlToRevoke: string | null = null;
    const img = new Image();

    img.onerror = () => {
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
      if (typeof source !== 'string') {
        fallbackFileReader(source);
      } else {
        resolve(source);
      }
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          width = 1200;
          height = 1600;
        }

        // Scale down large camera photos while keeping exact aspect ratio
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
          if (typeof source === 'string') {
            resolve(source);
          } else {
            fallbackFileReader(source);
          }
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
          try {
            const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
            const data = imageData.data;
            const contrastFactor = 1.35; // +35% contrast boost
            const intercept = 128 * (1 - contrastFactor);

            for (let i = 0; i < data.length; i += 4) {
              const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              const adjusted = Math.min(255, Math.max(0, gray * contrastFactor + intercept));
              data[i] = adjusted;
              data[i + 1] = adjusted;
              data[i + 2] = adjusted;
            }
            ctx.putImageData(imageData, 0, 0);
          } catch (filterErr) {
            console.warn('Contrast filter skipped:', filterErr);
          }
        }

        const outputDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(outputDataUrl);
      } catch (err: any) {
        console.warn('Canvas rendering fallback triggered:', err);
        if (typeof source !== 'string') {
          fallbackFileReader(source);
        } else {
          resolve(source);
        }
      } finally {
        if (objectUrlToRevoke) {
          URL.revokeObjectURL(objectUrlToRevoke);
        }
      }
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      try {
        objectUrlToRevoke = URL.createObjectURL(source);
        img.src = objectUrlToRevoke;
      } catch (blobErr) {
        fallbackFileReader(source);
      }
    }
  });
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyItemsToQuote,
}) => {
  const { profile, addInventoryItem, addExpense, sunlightMode, openPaywall, consumeAiCredit } = useApp();

  // State
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [enhanceContrast, setEnhanceContrast] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string>(
    'Extracting Materials & Prices with Gemini AI Vision...'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);

  const [scanResult, setScanResult] = useState<ScannedReceiptData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Pre-wake backend Render server as soon as the modal is opened
  useEffect(() => {
    if (isOpen) {
      wakeBackendServer().catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Sanitizer to convert raw API JSON or 503/429 errors into user-friendly message
  const formatFriendlyError = (err: any): string => {
    if (!err) return 'Server busy. Please tap Retry or enter items manually.';
    const str = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
    const lower = str.toLowerCase();

    if (
      lower.includes('503') ||
      lower.includes('429') ||
      lower.includes('unavailable') ||
      lower.includes('high demand') ||
      lower.includes('rate limit') ||
      lower.includes('resource exhausted') ||
      lower.includes('overloaded') ||
      lower.includes('server busy') ||
      lower.includes('temporary') ||
      lower.includes('quota') ||
      str.includes('{"error"') ||
      str.includes('"code":503') ||
      str.includes('"status":"UNAVAILABLE"') ||
      str.includes('UNAVAILABLE')
    ) {
      return 'Server busy. Please tap Retry or enter items manually.';
    }

    if (str.trim().startsWith('{') && str.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(str);
        if (parsed?.error?.message) {
          return formatFriendlyError(parsed.error.message);
        }
        if (parsed?.error && typeof parsed.error === 'string') {
          return formatFriendlyError(parsed.error);
        }
      } catch {
        // ignore
      }
      return 'Server busy. Please tap Retry or enter items manually.';
    }

    return str;
  };

  const delayMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Handle new image upload with low memory footprint
  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    setScanResult(null);
    setIsProcessingImage(true);
    setRotationAngle(0);
    setEnhanceContrast(false);

    try {
      // Process and compress directly from File object
      const compressedDataUrl = await processImageCanvas(file, 0, false);
      setOriginalImage(compressedDataUrl);
      setProcessedImage(compressedDataUrl);
    } catch (err: any) {
      console.error('Mobile image initial processing error:', err);
      // Fallback via FileReader
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = e.target?.result as string;
        setOriginalImage(raw);
        setProcessedImage(raw);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
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

  // Create manual slip entry
  const handleCreateBlankScan = () => {
    setScanResult({
      supplier_name: 'Supplier Slip',
      supplierName: 'Supplier Slip',
      receipt_number: 'INV-' + Math.floor(100000 + Math.random() * 900000),
      receiptNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
      invoiceNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toISOString().split('T')[0],
      total_amount: 0,
      totalAmount: 0,
      vat_amount: 0,
      vatAmount: 0,
      line_items: [
        {
          id: 'manual_item_' + Date.now(),
          code_barcode: '',
          codeBarcode: '',
          description: 'Electrical / Plumbing Supplies',
          quantity: 1,
          unitCost: 0,
          unit_price: 0,
          unitPrice: 0,
          total_price: 0,
          totalPrice: 0,
          category: 'Electrical',
          unit: 'ea',
          markupPct: profile.defaultMarkup || 35,
          total: 0,
        },
      ],
      items: [
        {
          id: 'manual_item_' + Date.now(),
          code_barcode: '',
          codeBarcode: '',
          description: 'Electrical / Plumbing Supplies',
          quantity: 1,
          unitCost: 0,
          unit_price: 0,
          unitPrice: 0,
          total_price: 0,
          totalPrice: 0,
          category: 'Electrical',
          unit: 'ea',
          markupPct: profile.defaultMarkup || 35,
          total: 0,
        },
      ],
      isPartial: true,
    });
    setErrorMessage(null);
  };

  // Perform AI OCR scan with automatic exponential backoff retries and live status feedback
  const runOcrScan = async () => {
    if (!processedImage) return;

    try {
      const aiCheck = entitlementManager.canUseAiFeature('Supplier Receipt OCR');
      if (!aiCheck.allowed) {
        openPaywall(aiCheck.reason);
        return;
      }
    } catch {
      // In offline or fallback mode, allow scan to proceed
    }

    setIsScanning(true);
    setErrorMessage(null);
    setScanStatusMessage('Extracting Materials & Prices with Gemini AI Vision...');

    try {
      const response = await fetchWithRetry('/api/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: processedImage,
          mimeType: 'image/jpeg',
        }),
        timeoutMs: 60000,
        retries: 3,
        onRetry: (attempt, maxRetries, delayMs, error) => {
          setScanStatusMessage(`Waking cloud server & extracting items (Attempt ${attempt}/${maxRetries})...`);
        },
      });

      if (!response.ok) {
        let errMessage = 'Failed to extract invoice data.';
        try {
          const errData = await response.json();
          errMessage = errData.error || (typeof errData === 'string' ? errData : JSON.stringify(errData));
        } catch {
          // not json
        }

        if (response.status === 402) {
          openPaywall(errMessage || 'You have exhausted your monthly AI credits. Upgrade your subscription for unlimited AI scanning.');
          setIsScanning(false);
          return;
        }

        throw new Error(errMessage);
      }

      const data: ScannedReceiptData = await response.json();

      // Consume credit on success
      try {
        consumeAiCredit();
      } catch {
        // silent
      }

      // Normalize items with markup
      const defaultMarkup = profile.defaultMarkup || 35;
      const rawInvoice = (data as any).invoice || {};
      const rawItemsList = rawInvoice.items || data.items || data.line_items || [];
      const normalizedItems: ScannedLineItem[] = rawItemsList.map((item: any, idx: number) => {
        const cost = Math.max(0, Number(item.unit_price ?? item.unitCost ?? item.unitPrice ?? item.cost ?? item.price ?? 0));
        const qty = Math.max(1, Number(item.quantity) || 1);
        const lineTotal = Number(item.total_price ?? item.total ?? item.totalPrice ?? (qty * cost).toFixed(2));
        const barcode = item.code_barcode || item.codeBarcode || '';
        const desc = item.item_name || item.description || item.name || 'Materials Item';

        return {
          id: 'scan_item_' + idx + '_' + Date.now(),
          code_barcode: barcode,
          codeBarcode: barcode,
          item_name: desc,
          description: desc,
          quantity: qty,
          unitCost: cost,
          unit_price: cost,
          unitPrice: cost,
          total_price: lineTotal,
          totalPrice: lineTotal,
          category: item.category || 'Electrical',
          unit: item.unit || 'ea',
          markupPct: item.markupPct !== undefined ? item.markupPct : defaultMarkup,
          total: lineTotal,
        };
      });

      // Calculate total amount if 0
      let total = Number(rawInvoice.grandTotal ?? rawInvoice.grand_total ?? data.grand_total ?? data.total_amount ?? data.totalAmount) || 0;
      if (total <= 0 && normalizedItems.length > 0) {
        total = normalizedItems.reduce((acc, it) => acc + it.quantity * it.unitCost, 0);
      }

      const vatAmt = Number(data.vat_amount ?? data.vatAmount) || Number(((total * 0.15) / 1.15).toFixed(2));
      const subTot = Number(data.subtotal) || Number((total / 1.15).toFixed(2));

      const structuredResult: ScannedReceiptData = {
        supplier_name: data.supplier_name || data.supplierName || rawInvoice.supplierName || 'Supplier Slip',
        supplierName: data.supplier_name || data.supplierName || rawInvoice.supplierName || 'Supplier Slip',
        address: data.address,
        vat_number: data.vat_number || data.vatNumber,
        vatNumber: data.vat_number || data.vatNumber,
        receipt_number:
          rawInvoice.invoiceNumber ||
          rawInvoice.invoice_number ||
          data.invoice_number ||
          data.receipt_number ||
          data.receiptNumber ||
          data.invoiceNumber ||
          'INV-' + Math.floor(100000 + Math.random() * 900000),
        receiptNumber:
          rawInvoice.invoiceNumber ||
          rawInvoice.invoice_number ||
          data.invoice_number ||
          data.receipt_number ||
          data.receiptNumber ||
          data.invoiceNumber ||
          'INV-' + Math.floor(100000 + Math.random() * 900000),
        invoiceNumber:
          rawInvoice.invoiceNumber ||
          rawInvoice.invoice_number ||
          data.invoice_number ||
          data.receipt_number ||
          data.receiptNumber ||
          data.invoiceNumber ||
          'INV-' + Math.floor(100000 + Math.random() * 900000),
        date: rawInvoice.issueDate || rawInvoice.issue_date || data.issue_date || data.date || new Date().toISOString().split('T')[0],
        time: data.time,
        cashier: data.cashier,
        subtotal: subTot,
        vat_amount: vatAmt,
        vatAmount: vatAmt,
        total_amount: total,
        totalAmount: total,
        line_items: normalizedItems,
        items: normalizedItems,
        notes: data.notes,
        rawText: data.rawText,
        isPartial: data.isPartial,
        isFallback: data.isFallback,
      };

      setScanResult(structuredResult);

      // Failsafe local state persistence: Store scanned invoice items directly to offline queue
      offlineSyncQueue.enqueueScannedReceipt({
        supplierName: structuredResult.supplierName,
        invoiceNumber: structuredResult.invoiceNumber,
        issueDate: structuredResult.date,
        totalAmount: structuredResult.totalAmount,
        items: structuredResult.items,
        rawPayload: data,
      });

      setErrorMessage(null);
      setIsScanning(false);
      return; // Success!
    } catch (err: any) {
      console.warn('[OCR Frontend] Scan failed after retries:', err);
      const friendlyMessage = formatFriendlyError(err);
      setErrorMessage(friendlyMessage);
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
      const skuCode = (item.code_barcode || item.codeBarcode || '').trim() || ('SKU-' + Math.floor(1000 + Math.random() * 9000));
      addInventoryItem({
        sku: skuCode,
        name: item.description,
        category: (item.category as any) || 'Hardware & Site Materials',
        costPrice: item.unitCost,
        defaultMarkup: markup,
        sellingPrice: selling,
        unit: item.unit || 'ea',
        stockQty: item.quantity || 1,
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

  // Record as Business Expense for Financial Analysis
  const handleRecordAsExpense = () => {
    if (!scanResult) return;

    const totalAmt = scanResult.totalAmount || scanResult.items.reduce((s, it) => s + (it.quantity || 1) * (it.unitCost || 0), 0);
    const vatAmt = scanResult.vatAmount || (profile.vatEnabled ? Number((totalAmt * 0.15 / 1.15).toFixed(2)) : 0);
    const itemDescSummary = scanResult.items.length > 0 
      ? scanResult.items.map(it => `${it.quantity || 1}x ${it.description}`).slice(0, 3).join(', ') + (scanResult.items.length > 3 ? ` (+${scanResult.items.length - 3} more)` : '')
      : `Supplier Purchase from ${scanResult.supplierName || 'Merchant'}`;

    addExpense({
      date: scanResult.date || new Date().toISOString().split('T')[0],
      description: itemDescSummary,
      category: 'Materials & Stock',
      amount: totalAmt,
      vatAmount: vatAmt,
      supplier: scanResult.supplierName || 'Supplier Slip',
      invoiceNumber: scanResult.invoiceNumber || scanResult.receiptNumber || 'REC-' + Math.floor(1000 + Math.random() * 9000),
      paymentMethod: 'Card',
      notes: `Captured via AI OCR scanner. ${scanResult.items.length} line items detected.`,
      receiptImageUrl: processedImage || originalImage || undefined,
    });

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

                    <button
                      type="button"
                      onClick={handleCreateBlankScan}
                      className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 border cursor-pointer ${
                        sunlightMode
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                          : 'bg-[#181B24] hover:bg-[#222734] text-slate-300 border-[#334155]'
                      }`}
                    >
                      <Plus className="w-4 h-4 text-amber-400" />
                      <span>Manual Slip Entry</span>
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
                      <span>{scanStatusMessage}</span>
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

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div>
                  <span className="font-bold block text-sm">Scanner Notice:</span>
                  <span className="text-slate-300">{errorMessage}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {processedImage && (
                    <button
                      type="button"
                      onClick={runOcrScan}
                      disabled={isScanning}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      <span>{isScanning ? 'Retrying Extraction...' : 'Retry AI Scan'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCreateBlankScan}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs flex items-center space-x-1.5 border border-amber-500/40 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Enter Items Manually</span>
                  </button>
                  {processedImage && (
                    <>
                      <button
                        type="button"
                        onClick={handleRotateImage}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1B1E28] hover:bg-[#282E3E] text-slate-300 text-xs border border-[#334155] cursor-pointer"
                      >
                        Rotate 90°
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleContrast}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1B1E28] hover:bg-[#282E3E] text-slate-300 text-xs border border-[#334155] cursor-pointer"
                      >
                        Auto-Contrast
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Extracted Results Panel */}
          {scanResult && (
            <div className={`space-y-5 p-4 sm:p-6 rounded-2xl border ${
              sunlightMode ? 'bg-slate-50 border-slate-300' : 'bg-[#12141C] border-[#282E3E]'
            }`}>
              {/* Notice Banner: Review & Verify Document Items with Direct Retry Scan Action */}
              <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                scanResult.isPartial || scanResult.isFallback
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
              }`}>
                <div className="flex items-start space-x-2.5 flex-1">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-[11px] space-y-0.5">
                    <span className="font-bold block text-xs">Review & Verify Document Items:</span>
                    <span className="text-slate-300 block">
                      {scanResult.notes || 'Document extracted. You can adjust item descriptions, quantities, and prices directly in the table below.'}
                    </span>
                  </div>
                </div>

                {/* Direct Retry Scan Action on Review Screen using cached image */}
                {processedImage && (
                  <button
                    type="button"
                    onClick={runOcrScan}
                    disabled={isScanning}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shrink-0 cursor-pointer disabled:opacity-50 shadow-sm self-end sm:self-center active:scale-95"
                    title="Re-run AI extraction using the captured image without re-uploading"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>{isScanning ? 'Retrying Extraction...' : 'Retry Scan'}</span>
                  </button>
                )}
              </div>

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
                    value={scanResult.supplierName || scanResult.supplier_name || ''}
                    onChange={(e) => setScanResult({ ...scanResult, supplierName: e.target.value, supplier_name: e.target.value })}
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
                    value={scanResult.receipt_number || scanResult.invoiceNumber || ''}
                    onChange={(e) => setScanResult({ ...scanResult, invoiceNumber: e.target.value, receipt_number: e.target.value, receiptNumber: e.target.value })}
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
                    {formatZAR(scanResult.total_amount ?? scanResult.totalAmount)}
                  </div>
                </div>

                {/* Optional Extended Metadata Fields: Address, VAT Number, Cashier/Time, Subtotal */}
                {(scanResult.address || scanResult.vat_number || scanResult.vatNumber || scanResult.cashier || scanResult.time || scanResult.subtotal) && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-4 pt-2 border-t border-[#282E3E] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400">
                    {(scanResult.vat_number || scanResult.vatNumber) && (
                      <div className="truncate">
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">VAT No</span>
                        <span className="text-slate-300">{scanResult.vat_number || scanResult.vatNumber}</span>
                      </div>
                    )}
                    {scanResult.address && (
                      <div className="truncate">
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Address</span>
                        <span className="text-slate-300 truncate block" title={scanResult.address}>{scanResult.address}</span>
                      </div>
                    )}
                    {(scanResult.cashier || scanResult.time) && (
                      <div className="truncate">
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Cashier / Time</span>
                        <span className="text-slate-300">
                          {scanResult.cashier || ''} {scanResult.time ? `(${scanResult.time})` : ''}
                        </span>
                      </div>
                    )}
                    {scanResult.subtotal !== undefined && (
                      <div className="truncate">
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Subtotal / VAT (15%)</span>
                        <span className="text-slate-300">
                          {formatZAR(scanResult.subtotal)} + {formatZAR(scanResult.vat_amount ?? scanResult.vatAmount ?? 0)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
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
                          <div className="flex-1 w-full space-y-1">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleUpdateItem(idx, { description: e.target.value })}
                              placeholder="Item description"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#12141C] border border-[#334155] text-white font-medium focus:border-sky-500 focus:outline-none"
                            />
                            {(item.code_barcode || item.codeBarcode) && (
                              <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
                                <span className="text-slate-500 font-bold">CODE:</span>
                                <input
                                  type="text"
                                  value={item.code_barcode || item.codeBarcode || ''}
                                  onChange={(e) => handleUpdateItem(idx, { code_barcode: e.target.value, codeBarcode: e.target.value })}
                                  placeholder="Barcode / Code"
                                  className="px-1.5 py-0.5 rounded bg-[#12141C] border border-[#334155]/60 text-sky-400 text-[10px] font-mono focus:border-sky-500 focus:outline-none"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-1.5 self-end sm:self-auto shrink-0">
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3.5 py-2.5 rounded-xl bg-[#1B1E28] hover:bg-[#282E3E] text-slate-300 text-xs font-semibold flex items-center space-x-1.5 border border-[#334155] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Scan Another Slip</span>
                  </button>

                  {processedImage && (
                    <button
                      type="button"
                      onClick={runOcrScan}
                      disabled={isScanning}
                      className="px-3.5 py-2.5 rounded-xl bg-[#1B1E28] hover:bg-sky-950/40 text-sky-400 hover:text-sky-300 text-xs font-semibold flex items-center space-x-1.5 border border-sky-500/40 cursor-pointer disabled:opacity-50"
                      title="Re-run AI extraction on this slip"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      <span>{isScanning ? 'Re-scanning...' : 'Re-scan with AI'}</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleRecordAsExpense}
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-bold flex items-center space-x-1.5 border border-emerald-500/40 cursor-pointer"
                    title="Log this slip directly into Financial Analysis as a monthly expenditure record"
                  >
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Record as Expense</span>
                  </button>

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
