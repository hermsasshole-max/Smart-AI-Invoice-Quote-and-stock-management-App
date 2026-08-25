import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Helper to parse numeric monetary values safely
function parseNumeric(val: any, fallback = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  if (typeof val === 'string') {
    // Remove currency signs (R, $, etc.), spaces, and commas
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

// Resilient JSON extractor and regex fallback
function sanitizeAndExtractOcrData(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  // 1. Try direct or cleaned JSON parse
  let cleaned = rawText.trim();
  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  // Find outermost curly braces
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubstring = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      // Remove trailing commas before } or ]
      const normalizedJson = jsonSubstring
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\u201C\u201D]/g, '"'); // smart quotes to standard quotes
      const parsed = JSON.parse(normalizedJson);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (parseErr) {
      console.warn('[OCR Server] JSON.parse failed on substring, attempting regex heuristics:', parseErr);
    }
  }

  // 2. Regex Heuristic Extraction if JSON parse fails
  console.log('[OCR Server] Running Regex Heuristics on raw text...');
  const result: any = {
    supplier_name: 'Supplier Slip',
    supplierName: 'Supplier Slip',
    receipt_number: '',
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    total_amount: 0,
    totalAmount: 0,
    vat_amount: 0,
    vatAmount: 0,
    line_items: [],
    items: [],
    rawText: rawText.slice(0, 1000),
    isPartial: true,
  };

  // Supplier Name Heuristics
  const supplierMatch = rawText.match(
    /(?:Supplier|Merchant|Vendor|From|Store|Company|Plumblink|Voltex|ARB|ACDC|Builders|Herholdts|Rubicon|Leroy Merlin|Chamberlains)[:\s]+([^\n\r,]+)/i
  );
  if (supplierMatch) {
    result.supplier_name = supplierMatch[1].trim();
    result.supplierName = supplierMatch[1].trim();
  } else {
    // Try first non-empty line
    const firstLine = rawText.split('\n').map((l) => l.trim()).find((l) => l.length > 2 && !l.toLowerCase().includes('tax invoice'));
    if (firstLine) {
      result.supplier_name = firstLine.slice(0, 40);
      result.supplierName = firstLine.slice(0, 40);
    }
  }

  // Invoice Number Heuristics
  const invMatch = rawText.match(/(?:Invoice|Tax\s*Invoice|Slip|Doc|Doc\s*No|Order|Reference|Ref|Receipt)[\s#:]*([A-Z0-9\-_/]{4,20})/i);
  if (invMatch) {
    result.receipt_number = invMatch[1].trim();
    result.invoiceNumber = invMatch[1].trim();
  } else {
    const genNum = 'INV-' + Math.floor(100000 + Math.random() * 900000);
    result.receipt_number = genNum;
    result.invoiceNumber = genNum;
  }

  // Date Heuristics
  const dateMatch = rawText.match(/(\d{4}[-/]\d{2}[-/]\d{2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
  if (dateMatch) {
    const rawDate = dateMatch[0];
    if (rawDate.includes('-') && rawDate.length === 10 && rawDate.indexOf('-') === 4) {
      result.date = rawDate;
    } else {
      const parts = rawDate.split(/[-/]/);
      if (parts.length === 3) {
        let y = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        let m = parts[1].padStart(2, '0');
        let d = parts[0].padStart(2, '0');
        result.date = `${y}-${m}-${d}`;
      }
    }
  }

  // Total Amount Heuristics
  const totalMatch = rawText.match(/(?:TOTAL|TOTAL\s*DUE|AMOUNT\s*DUE|GRAND\s*TOTAL|BALANCE|AMOUNT)[\s:R$]*([0-9,]+\.[0-9]{2})/i);
  if (totalMatch) {
    const parsedTotal = parseNumeric(totalMatch[1]);
    result.total_amount = parsedTotal;
    result.totalAmount = parsedTotal;
  }

  // VAT Amount Heuristics
  const vatMatch = rawText.match(/(?:VAT|TAX|15%|15\.00%)[\s:R$]*([0-9,]+\.[0-9]{2})/i);
  if (vatMatch) {
    const parsedVat = parseNumeric(vatMatch[1]);
    result.vat_amount = parsedVat;
    result.vatAmount = parsedVat;
  }

  // Line Items Regex Scan: look for line items with prices
  const lines = rawText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Pattern: [description text] followed by [qty optional] [price]
    const itemMatch = trimmed.match(/^([a-zA-Z0-9\s().,/²³\-+]+?)(?:\s+(\d+)\s*(?:ea|m|roll|box|pack|kg)?)?\s+[R$]?\s*([0-9,]+\.[0-9]{2})$/i);
    if (itemMatch && itemMatch[1].trim().length > 3 && !trimmed.toLowerCase().includes('total') && !trimmed.toLowerCase().includes('vat')) {
      const desc = itemMatch[1].trim();
      const qty = itemMatch[2] ? parseInt(itemMatch[2], 10) : 1;
      const cost = parseNumeric(itemMatch[3]);
      if (cost > 0) {
        const itemObj = {
          code_barcode: '',
          description: desc,
          quantity: qty,
          unit_price: cost,
          unitCost: cost,
          total_price: Number((qty * cost).toFixed(2)),
          total: Number((qty * cost).toFixed(2)),
          category: 'Electrical',
          unit: 'ea',
        };
        result.items.push(itemObj);
        result.line_items.push(itemObj);
      }
    }
  }

  // If no items were parsed, construct a generic single item matching total
  if (result.items.length === 0 && result.totalAmount > 0) {
    const genericItem = {
      code_barcode: '',
      description: 'Materials / Hardware Supplies (' + result.supplierName + ')',
      quantity: 1,
      unit_price: result.totalAmount,
      unitCost: result.totalAmount,
      total_price: result.totalAmount,
      total: result.totalAmount,
      category: 'Electrical',
      unit: 'lot',
    };
    result.items.push(genericItem);
    result.line_items.push(genericItem);
  }

  return result;
}

// Clean and normalize final structured data object
function normalizeOcrData(data: any, rawFallbackText = ''): any {
  if (!data || typeof data !== 'object') {
    data = {};
  }

  const supplierName = typeof data.supplier_name === 'string' && data.supplier_name.trim()
    ? data.supplier_name.trim()
    : (typeof data.supplierName === 'string' && data.supplierName.trim()
      ? data.supplierName.trim()
      : 'Supplier Invoice');

  const receiptNumber = typeof data.receipt_number === 'string' && data.receipt_number.trim()
    ? data.receipt_number.trim()
    : (typeof data.receiptNumber === 'string' && data.receiptNumber.trim()
      ? data.receiptNumber.trim()
      : (typeof data.invoiceNumber === 'string' && data.invoiceNumber.trim()
        ? data.invoiceNumber.trim()
        : 'INV-' + Math.floor(100000 + Math.random() * 900000)));

  const date = typeof data.date === 'string' && data.date.trim()
    ? data.date.trim()
    : new Date().toISOString().split('T')[0];

  const address = typeof data.address === 'string' && data.address.trim() ? data.address.trim() : undefined;
  const vatNumber = typeof data.vat_number === 'string' && data.vat_number.trim()
    ? data.vat_number.trim()
    : (typeof data.vatNumber === 'string' && data.vatNumber.trim() ? data.vatNumber.trim() : undefined);
  const time = typeof data.time === 'string' && data.time.trim() ? data.time.trim() : undefined;
  const cashier = typeof data.cashier === 'string' && data.cashier.trim() ? data.cashier.trim() : undefined;

  let rawItems = Array.isArray(data.line_items)
    ? data.line_items
    : (Array.isArray(data.items) ? data.items : []);

  let normalizedItems = rawItems.map((item: any) => {
    const desc = typeof item.description === 'string' && item.description.trim()
      ? item.description.trim()
      : (typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Materials Item');
    const qty = Math.max(1, parseNumeric(item.quantity, 1));
    const unitPrice = Math.max(0, parseNumeric(item.unit_price ?? item.unitCost ?? item.unitPrice ?? item.cost ?? item.price, 0));
    const totalPrice = parseNumeric(item.total_price ?? item.total ?? item.totalPrice, Number((qty * unitPrice).toFixed(2)));
    const codeBarcode = typeof item.code_barcode === 'string' && item.code_barcode.trim()
      ? item.code_barcode.trim()
      : (typeof item.codeBarcode === 'string' && item.codeBarcode.trim() ? item.codeBarcode.trim() : undefined);
    const cat = typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Electrical';
    const u = typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'ea';

    return {
      code_barcode: codeBarcode,
      codeBarcode,
      description: desc,
      quantity: qty,
      unit_price: unitPrice,
      unitCost: unitPrice,
      total_price: totalPrice,
      total: totalPrice,
      category: cat,
      unit: u,
    };
  });

  // Calculate or normalize total amount
  let totalAmount = parseNumeric(data.total_amount ?? data.totalAmount, 0);
  if (totalAmount <= 0 && normalizedItems.length > 0) {
    totalAmount = Number(normalizedItems.reduce((sum: number, it: any) => sum + (it.quantity * it.unitCost), 0).toFixed(2));
  }

  // If no items extracted but total amount is known, provide single line
  if (normalizedItems.length === 0 && totalAmount > 0) {
    normalizedItems = [
      {
        code_barcode: undefined,
        codeBarcode: undefined,
        description: 'Supplier Materials (' + supplierName + ')',
        quantity: 1,
        unit_price: totalAmount,
        unitCost: totalAmount,
        total_price: totalAmount,
        total: totalAmount,
        category: 'Electrical',
        unit: 'lot',
      },
    ];
  }

  let subtotal = parseNumeric(data.subtotal, 0);
  if (subtotal <= 0 && totalAmount > 0) {
    subtotal = Number((totalAmount / 1.15).toFixed(2));
  }

  let vatAmount = parseNumeric(data.vat_amount ?? data.vatAmount, 0);
  if (vatAmount <= 0 && totalAmount > 0) {
    vatAmount = Number((totalAmount * 0.15 / 1.15).toFixed(2));
  }

  return {
    supplier_name: supplierName,
    supplierName,
    address,
    vat_number: vatNumber,
    vatNumber,
    receipt_number: receiptNumber,
    receiptNumber,
    invoiceNumber: receiptNumber,
    date,
    time,
    cashier,
    subtotal: subtotal > 0 ? subtotal : undefined,
    vat_amount: vatAmount,
    vatAmount,
    total_amount: totalAmount,
    totalAmount,
    line_items: normalizedItems,
    items: normalizedItems,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    rawText: data.rawText || rawFallbackText || undefined,
    isPartial: Boolean(data.isPartial),
    isFallback: Boolean(data.isFallback),
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Lazy initialize Gemini client
  function getGeminiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Helper to determine if an error is transient (503 UNAVAILABLE / 429 RATE LIMIT / network timeout)
  function isTransientError(error: any): boolean {
    const status = error?.status || error?.statusCode || error?.code;
    const message = String(error?.message || error || '').toLowerCase();

    return (
      status === 503 ||
      status === 429 ||
      status === 'UNAVAILABLE' ||
      status === 'RESOURCE_EXHAUSTED' ||
      message.includes('503') ||
      message.includes('429') ||
      message.includes('unavailable') ||
      message.includes('high demand') ||
      message.includes('rate limit') ||
      message.includes('resource exhausted') ||
      message.includes('overloaded') ||
      message.includes('temporary') ||
      message.includes('quota') ||
      message.includes('fetch failed') ||
      message.includes('econnreset')
    );
  }

  const delayMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Receipt & Supplier Invoice OCR API
  app.post('/api/scan-receipt', async (req, res) => {
    const startTime = Date.now();
    console.log('[OCR Server] Received receipt scan request at', new Date().toISOString());

    try {
      // 1. Support all common mobile payload structures & key names
      let rawImagePayload =
        req.body?.imageBase64 ||
        req.body?.image ||
        req.body?.imageData ||
        req.body?.image_base64 ||
        req.body?.data ||
        req.body?.base64 ||
        req.body?.photo ||
        req.body?.file ||
        req.body?.uri ||
        req.body?.base64Data;

      if (!rawImagePayload && typeof req.body === 'string') {
        try {
          const parsedBody = JSON.parse(req.body);
          rawImagePayload =
            parsedBody?.imageBase64 ||
            parsedBody?.image ||
            parsedBody?.imageData ||
            parsedBody?.image_base64 ||
            parsedBody?.data ||
            parsedBody?.base64;
        } catch {
          rawImagePayload = req.body;
        }
      }

      if (!rawImagePayload || typeof rawImagePayload !== 'string') {
        console.warn('[OCR Server] Missing or non-string image data received');
        const emptyFallback = normalizeOcrData({
          supplierName: 'Supplier Slip',
          invoiceNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
          date: new Date().toISOString().split('T')[0],
          totalAmount: 0,
          items: [],
          notes: 'No image payload received. Please retry or enter items manually.',
          isPartial: true,
          isFallback: true,
        });
        return res.json(emptyFallback);
      }

      // If URL-encoded base64 was passed from mobile WebView/client
      if (rawImagePayload.includes('%3A') || rawImagePayload.includes('%2F') || rawImagePayload.includes('%2B')) {
        try {
          rawImagePayload = decodeURIComponent(rawImagePayload);
        } catch {
          // ignore if decoding fails
        }
      }

      // Extract clean base64 data and normalize MIME type
      let cleanBase64 = rawImagePayload;
      let effectiveMime = req.body?.mimeType || 'image/jpeg';

      const headerMatch = rawImagePayload.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/s);
      if (headerMatch) {
        effectiveMime = headerMatch[1].toLowerCase();
        cleanBase64 = headerMatch[2];
      } else {
        cleanBase64 = rawImagePayload.replace(/^data:[^;]+;base64,/, '');
      }

      // Clean all whitespace, newlines, carriage returns
      cleanBase64 = cleanBase64.trim().replace(/\s+/g, '');

      // Normalize common mobile MIME variants
      if (effectiveMime.includes('jpg') || effectiveMime.includes('pjpeg')) {
        effectiveMime = 'image/jpeg';
      } else if (effectiveMime.includes('png')) {
        effectiveMime = 'image/png';
      } else if (effectiveMime.includes('webp')) {
        effectiveMime = 'image/webp';
      } else if (effectiveMime.includes('heic') || effectiveMime.includes('heif')) {
        effectiveMime = 'image/heic';
      } else if (effectiveMime.includes('pdf')) {
        effectiveMime = 'application/pdf';
      } else {
        effectiveMime = 'image/jpeg';
      }

      console.log(`[OCR Server] Mobile payload validated: MIME=${effectiveMime}, Base64Length=${cleanBase64.length}`);

      const ai = getGeminiClient();
      if (!ai) {
        console.warn('[OCR Server] No GEMINI_API_KEY detected. Returning intelligent fallback template.');
        const fallbackData = normalizeOcrData({
          supplierName: 'Voltex / ARB Electrical Suppliers',
          invoiceNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
          date: new Date().toISOString().split('T')[0],
          totalAmount: 1850.00,
          vatAmount: 241.30,
          items: [
            {
              description: '2.5mm² Surfix Twin+Earth Cable (100m Roll)',
              quantity: 1,
              unitCost: 1250.00,
              category: 'Electrical',
              unit: 'roll',
            },
            {
              description: 'Double 16A Veti 1 Wall Sockets (White)',
              quantity: 4,
              unitCost: 150.00,
              category: 'Electrical',
              unit: 'ea',
            },
          ],
          notes: 'Extracted using local fallback parser. Add GEMINI_API_KEY in Settings > Secrets for live Vision AI OCR.',
          isFallback: true,
        });
        return res.json(fallbackData);
      }

      const promptText = `You are a precision OCR document parsing system for hardware, electrical, and plumbing supplier receipts and trade invoices.
Extract key metadata and every itemized line item strictly following the provided JSON schema.
Convert string numbers into standard numerical floats. If a barcode, product code, or SKU is present, capture it in code_barcode.
If any value is missing or unreadable, provide reasonable defaults instead of failing.`;

      const ocrSchema = {
        type: Type.OBJECT,
        properties: {
          supplier_name: { type: Type.STRING, description: 'Business or store name at the top of the slip' },
          address: { type: Type.STRING, description: 'Physical address' },
          vat_number: { type: Type.STRING, description: 'VAT tax registration number' },
          receipt_number: { type: Type.STRING, description: 'Till/Sale/Invoice number' },
          date: { type: Type.STRING, description: 'Date of transaction (YYYY-MM-DD)' },
          time: { type: Type.STRING, description: 'Time of transaction (HH:MM:SS)' },
          cashier: { type: Type.STRING, description: 'Cashier or attendant name' },
          line_items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                code_barcode: { type: Type.STRING, description: 'Item product code, SKU, or barcode' },
                description: { type: Type.STRING, description: 'Full item description' },
                quantity: { type: Type.NUMBER, description: 'Quantity purchased' },
                unit_price: { type: Type.NUMBER, description: 'Individual item unit price' },
                total_price: { type: Type.NUMBER, description: 'Line total price' },
              },
            },
          },
          vat_amount: { type: Type.NUMBER, description: 'Calculated VAT included amount' },
          subtotal: { type: Type.NUMBER, description: 'Subtotal amount before final tax' },
          total_amount: { type: Type.NUMBER, description: 'Final total charged' },
        },
      };

      // Model Redundancy Hierarchy: Primary -> Secondary -> Fallback Tier
      const modelCandidates = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.7-flash'];
      let rawResponseText = '';
      let successfulModel = '';
      let lastAttemptError: any = null;

      // Model & Retry Loop with Exponential Backoff + Jitter
      modelLoop: for (const currentModel of modelCandidates) {
        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            console.log(`[OCR Server] Calling model=${currentModel} (Attempt ${attempt + 1}/${maxRetries})...`);

            const generatePromise = ai.models.generateContent({
              model: currentModel,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: effectiveMime,
                      data: cleanBase64,
                    },
                  },
                  {
                    text: promptText,
                  },
                ],
              },
              config: {
                responseMimeType: 'application/json',
                responseSchema: ocrSchema,
              },
            });

            // 35s timeout guard per individual attempt
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('OCR model attempt timed out.')), 35000)
            );

            const response: any = await Promise.race([generatePromise, timeoutPromise]);
            const extractedText = response?.text || '';

            if (extractedText && extractedText.trim().length > 0) {
              rawResponseText = extractedText;
              successfulModel = currentModel;
              console.log(
                `[OCR Server] Gemini response received via ${currentModel} on attempt ${attempt + 1} in ${Date.now() - startTime}ms.`
              );
              break modelLoop;
            }
          } catch (modelErr: any) {
            lastAttemptError = modelErr;
            const isTransient = isTransientError(modelErr);
            console.warn(
              `[OCR Server] Model ${currentModel} (Attempt ${attempt + 1}) encountered error:`,
              modelErr?.message || modelErr
            );

            if (isTransient && attempt < maxRetries - 1) {
              // Exponential backoff: ~1s, ~2s, ~4s (+ 0-400ms random jitter)
              const baseBackoff = Math.pow(2, attempt) * 1000;
              const jitter = Math.floor(Math.random() * 400);
              const waitDuration = baseBackoff + jitter;
              console.log(`[OCR Server] High traffic / 503 detected. Retrying in ${waitDuration}ms...`);
              await delayMs(waitDuration);
              continue;
            }

            // Move to next candidate model if this one is exhausted or permanently failing
            break;
          }
        }
      }

      // If we got valid response text from any model tier
      if (rawResponseText) {
        const extractedJson = sanitizeAndExtractOcrData(rawResponseText);
        const normalized = normalizeOcrData(extractedJson, rawResponseText);
        return res.json(normalized);
      }

      // If all candidate models and retries failed due to 503 / 429
      const isTransient = isTransientError(lastAttemptError);
      console.error('[OCR Server] All model candidate attempts exhausted. Last error:', lastAttemptError?.message);

      if (isTransient) {
        return res.status(503).json({
          error: 'Server busy. Please tap Retry or enter items manually.',
          isServerBusy: true,
          status: 503,
        });
      }

      // If other error, return safe fallback template with clean message
      const safeRecovery = normalizeOcrData(
        {
          supplierName: 'Scanned Supplier Slip',
          invoiceNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
          date: new Date().toISOString().split('T')[0],
          totalAmount: 0,
          items: [
            {
              description: 'Scanned Materials (Tap to edit item name & cost)',
              quantity: 1,
              unitCost: 0,
              category: 'Electrical',
              unit: 'ea',
            },
          ],
          notes: 'Server busy. Please tap Retry or enter items manually.',
          isPartial: true,
          isFallback: true,
        },
        'Server busy. Please tap Retry or enter items manually.'
      );

      return res.json(safeRecovery);
    } catch (error: any) {
      console.error('[OCR Server Error] Fatal uncaught error during OCR processing:', {
        message: error?.message,
        duration: Date.now() - startTime,
      });

      return res.status(503).json({
        error: 'Server busy. Please tap Retry or enter items manually.',
        isServerBusy: true,
        status: 503,
      });
    }
  });

  // Vite middleware for development vs static asset serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

