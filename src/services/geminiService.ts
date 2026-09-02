import { fetchWithRetry } from '../utils/apiClient';
import { QuoteLineItem, ServiceCategory } from '../types';
import { db } from './db';

export interface StructuredVoiceQuote {
  client: {
    name: string;
    phone?: string;
    address?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    costPrice?: number;
    markupPercent?: number;
    isLabour?: boolean;
    category?: string;
    sku?: string;
  }>;
  summaryNotes?: string;
  paymentTerms?: {
    depositRequiredPercent?: number;
    validDays?: number;
  };
  serviceType?: ServiceCategory;
  scopeOfWork?: string;
  calloutFee?: number;
  labourHours?: number;
  labourRatePerHour?: number;
  isFallback?: boolean;
}

export interface StructuredReceiptData {
  supplier: string;
  supplierName?: string;
  date: string;
  invoiceNumber: string;
  items: Array<{
    code?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    vatAmount?: number;
    unit?: string;
    category?: string;
  }>;
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  suggestedJobId?: string;
  isFallback?: boolean;
}

export interface EndOfDayVoiceSummary {
  usedMaterials: Array<{
    sku?: string;
    description: string;
    quantity: number;
    unit: string;
    clientOrJobName?: string;
  }>;
  labourHours?: number;
  notes?: string;
}

/**
 * MODULE A: Voice-to-Quote & Voice-to-Job Engine
 * Parses transcribed audio or prompt text into structured contractor quotation
 */
export async function parseVoiceToQuote(
  transcriptText: string,
  userProfile?: any
): Promise<StructuredVoiceQuote> {
  try {
    const res = await fetchWithRetry('/api/ai/voice-quote', {
      method: 'POST',
      body: JSON.stringify({
        transcript: transcriptText,
        profile: userProfile,
      }),
      timeoutMs: 35000,
      retries: 2,
    });

    if (res.ok) {
      const data = await res.json();
      
      // Auto-match items with IndexedDB Inventory to enrich costs and SKUs
      const inventoryItems = await db.inventory.toArray();
      const enrichedItems = (data.items || []).map((it: any) => {
        const descLower = (it.description || '').toLowerCase();
        const matched = inventoryItems.find((inv) =>
          descLower.includes(inv.name.toLowerCase()) ||
          (inv.sku && descLower.includes(inv.sku.toLowerCase()))
        );

        if (matched) {
          return {
            ...it,
            costPrice: it.costPrice || matched.costPrice,
            unitPrice: it.unitPrice || matched.sellingPrice,
            unit: it.unit || matched.unit,
            category: it.category || matched.category,
            inventoryId: matched.id,
            sku: matched.sku,
          };
        }
        return it;
      });

      return {
        client: {
          name: data.clientName || data.client?.name || 'New Client',
          phone: data.clientPhone || data.client?.phone || '',
          address: data.clientAddress || data.client?.address || '',
        },
        items: enrichedItems,
        summaryNotes: data.notes || data.summaryNotes || 'Quotation valid for 14 days. SANS 10142-1 compliance certified upon job completion.',
        paymentTerms: {
          depositRequiredPercent: data.paymentTerms?.depositRequiredPercent ?? 50,
          validDays: data.paymentTerms?.validDays ?? 14,
        },
        serviceType: (data.serviceType as ServiceCategory) || 'Electrical',
        scopeOfWork: data.scopeOfWork || transcriptText,
        calloutFee: data.calloutFee ?? 650,
        labourHours: data.labourHours ?? 2,
        labourRatePerHour: data.labourRatePerHour ?? 550,
        isFallback: Boolean(data.isFallback),
      };
    }
  } catch (err) {
    console.warn('[Gemini Service] Server request failed, activating offline heuristic parser:', err);
  }

  // 100% Offline Heuristic Fallback
  return fallbackVoiceToQuote(transcriptText);
}

/**
 * MODULE B: Camera-First Counter Slip & Invoice Ingestion
 * Extracts supplier line items, quantities, VAT, and totals from image base64
 */
export async function parseReceiptImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<StructuredReceiptData> {
  try {
    const res = await fetchWithRetry('/api/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({
        imageBase64: base64Image,
        mimeType,
      }),
      timeoutMs: 40000,
      retries: 2,
    });

    if (res.ok) {
      const data = await res.json();
      const rawItems = data.items || data.line_items || [];

      return {
        supplier: data.supplier_name || data.supplierName || data.supplier || 'Trade Supplier',
        supplierName: data.supplier_name || data.supplierName || data.supplier || 'Trade Supplier',
        date: data.issue_date || data.date || new Date().toISOString().split('T')[0],
        invoiceNumber: data.invoice_number || data.invoiceNumber || data.receipt_number || 'INV-' + Math.floor(100000 + Math.random() * 900000),
        items: rawItems.map((it: any) => ({
          code: it.code_barcode || it.code || '',
          description: it.item_name || it.description || 'Materials',
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unit_price ?? it.unitCost ?? it.unitPrice) || 0,
          totalPrice: Number(it.total_price ?? it.total ?? it.totalPrice) || 0,
          vatAmount: Number(it.vat_amount ?? it.vatAmount) || 0,
          unit: it.unit || 'ea',
          category: it.category || 'Electrical',
        })),
        subtotal: Number(data.subtotal) || Number(data.grand_total ? (data.grand_total / 1.15).toFixed(2) : 0),
        vatTotal: Number(data.vat_amount ?? data.vatAmount ?? data.vatTotal) || Number(data.grand_total ? (data.grand_total * 0.15 / 1.15).toFixed(2) : 0),
        grandTotal: Number(data.grand_total ?? data.total_amount ?? data.totalAmount ?? data.grandTotal) || 0,
        suggestedJobId: data.suggestedJobId || undefined,
        isFallback: Boolean(data.isFallback),
      };
    }
  } catch (err) {
    console.warn('[Gemini Service] Receipt OCR server call failed, using offline parsing:', err);
  }

  // Offline default fallback
  return {
    supplier: 'Voltex / ARB Electrical Suppliers',
    supplierName: 'Voltex / ARB Electrical Suppliers',
    date: new Date().toISOString().split('T')[0],
    invoiceNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
    items: [
      {
        description: 'Electrical & Installation Supplies',
        quantity: 1,
        unitPrice: 1250,
        totalPrice: 1250,
        unit: 'lot',
        category: 'Electrical',
      },
    ],
    subtotal: 1086.96,
    vatTotal: 163.04,
    grandTotal: 1250.00,
    isFallback: true,
  };
}

/**
 * MODULE C: End-of-Day Voice Summary Parser
 * Parses voice notes like "Used 20m 2.5mm cable and 40A breaker on Smith install"
 */
export async function parseEndOfDayVoiceSummary(transcriptText: string): Promise<EndOfDayVoiceSummary> {
  const inventoryItems = await db.inventory.toArray();
  const lower = transcriptText.toLowerCase();

  const usedMaterials: Array<{
    sku?: string;
    description: string;
    quantity: number;
    unit: string;
    clientOrJobName?: string;
  }> = [];

  // Match inventory items mentioned in the speech
  for (const item of inventoryItems) {
    const nameMatch = lower.indexOf(item.name.toLowerCase());
    const skuMatch = item.sku ? lower.indexOf(item.sku.toLowerCase()) : -1;

    if (nameMatch !== -1 || skuMatch !== -1) {
      // Look for a preceding number (e.g., "20m cable" or "2 breaker")
      const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${item.unit}|units|pieces|meters|m)?\\s*${item.name}`, 'i');
      const match = transcriptText.match(regex);
      const qty = match ? parseFloat(match[1]) : 1;

      usedMaterials.push({
        sku: item.sku,
        description: item.name,
        quantity: qty,
        unit: item.unit,
      });
    }
  }

  // Heuristic extraction for hours
  const hoursMatch = transcriptText.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|hr)/i);
  const labourHours = hoursMatch ? parseFloat(hoursMatch[1]) : undefined;

  // Extract client or job name if "on [Client]" or "for [Client]"
  const clientMatch = transcriptText.match(/(?:on|for|at)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:job|install|house|site|property)|[.,]|$)/i);
  const clientOrJobName = clientMatch ? clientMatch[1].trim() : undefined;

  if (clientOrJobName && usedMaterials.length > 0) {
    usedMaterials.forEach((m) => (m.clientOrJobName = clientOrJobName));
  }

  // If no items matched specific inventory names, extract general quantities
  if (usedMaterials.length === 0) {
    const lines = transcriptText.split(/[\n,.]+/).filter((l) => l.trim().length > 3);
    for (const line of lines) {
      const numMatch = line.match(/(\d+)\s*(?:x|meters|m|units|boxes|rolls)?\s+(.+)/i);
      if (numMatch) {
        usedMaterials.push({
          description: numMatch[2].trim(),
          quantity: parseInt(numMatch[1], 10),
          unit: 'ea',
          clientOrJobName,
        });
      }
    }
  }

  return {
    usedMaterials,
    labourHours,
    notes: transcriptText,
  };
}

/**
 * Offline Heuristic Voice Parser
 */
function fallbackVoiceToQuote(transcript: string): StructuredVoiceQuote {
  const lines = transcript.split(/[\n,.]+/).map((l) => l.trim()).filter((l) => l.length > 2);

  // Extract client name
  let clientName = 'Field Client';
  const clientMatch = transcript.match(/(?:client|for|customer|name\s+is)\s+([A-Z][a-zA-Z\s]+)/i);
  if (clientMatch) {
    clientName = clientMatch[1].trim();
  }

  // Extract phone
  let clientPhone = '';
  const phoneMatch = transcript.match(/(\+?27\s*\d{2}\s*\d{3}\s*\d{4}|0\d{2}\s*\d{3}\s*\d{4}|\d{10})/);
  if (phoneMatch) {
    clientPhone = phoneMatch[0].replace(/\s+/g, '');
  }

  // Extract items
  const items = lines.slice(0, 4).map((line, idx) => ({
    description: line.charAt(0).toUpperCase() + line.slice(1),
    quantity: 1,
    unit: 'ea',
    costPrice: 350 + idx * 100,
    unitPrice: Number(((350 + idx * 100) * 1.35).toFixed(2)),
    markupPercent: 35,
    isLabour: line.toLowerCase().includes('labour') || line.toLowerCase().includes('installation'),
    category: 'Electrical',
  }));

  return {
    client: {
      name: clientName,
      phone: clientPhone,
      address: 'Job Site Address',
    },
    items: items.length > 0 ? items : [
      {
        description: 'Electrical & Air Conditioning Service Call',
        quantity: 1,
        unit: 'lot',
        costPrice: 450,
        unitPrice: 650,
        markupPercent: 35,
        category: 'Electrical',
      },
    ],
    summaryNotes: 'Standard SANS 10142-1 certified electrical installation. 50% deposit required upon quote acceptance.',
    paymentTerms: {
      depositRequiredPercent: 50,
      validDays: 14,
    },
    serviceType: 'Electrical',
    scopeOfWork: transcript,
    calloutFee: 650,
    labourHours: 2,
    labourRatePerHour: 550,
    isFallback: true,
  };
}
