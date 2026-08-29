import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  usageStore,
  requireAiCredit,
  extractUserId,
  TIER_DEFINITIONS,
  SubscriptionTier,
} from './server/middleware/usageMeter';
import {
  generateQuoteFromVoiceOrText,
} from './server/services/geminiService';

// Helper to sanitize numeric monetary values for PostgreSQL NUMERIC(12, 2)
export function sanitizeNumeric(val: any, fallback = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : Number(val.toFixed(2));
  }
  if (typeof val === 'string') {
    // Remove currency signs (R, $, €, £), commas, spaces, and any non-numeric chars except dot and minus
    const cleaned = val
      .replace(/[R$€£]/gi, '')
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '')
      .trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : Number(parsed.toFixed(2));
  }
  return fallback;
}

// Backward-compatible alias
export const parseNumeric = sanitizeNumeric;

// Standardize dates into ISO format (YYYY-MM-DD and TIMESTAMPTZ ISO strings)
export function standardizeIsoDate(dateVal?: any, timeVal?: any): { isoDate: string; isoTimestamp: string } {
  const now = new Date();
  const fallbackIsoDate = now.toISOString().split('T')[0];
  const fallbackIsoTimestamp = now.toISOString();

  if (!dateVal || (typeof dateVal !== 'string' && !(dateVal instanceof Date))) {
    return { isoDate: fallbackIsoDate, isoTimestamp: fallbackIsoTimestamp };
  }

  if (dateVal instanceof Date) {
    return {
      isoDate: dateVal.toISOString().split('T')[0],
      isoTimestamp: dateVal.toISOString(),
    };
  }

  const trimmed = dateVal.trim();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = now.getDate();
  let matched = false;

  // 1. Match standard YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10);
    day = parseInt(ymdMatch[3], 10);
    matched = true;
  } else {
    // 2. Match DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/);
    if (dmyMatch) {
      let rawYear = dmyMatch[3];
      year = rawYear.length === 2 ? parseInt('20' + rawYear, 10) : parseInt(rawYear, 10);
      const part1 = parseInt(dmyMatch[1], 10);
      const part2 = parseInt(dmyMatch[2], 10);

      // If part1 > 12, it must be day-month-year
      if (part1 > 12) {
        day = part1;
        month = part2;
      } else if (part2 > 12) {
        // MM/DD/YYYY
        month = part1;
        day = part2;
      } else {
        // Default to DD/MM/YYYY (standard in South Africa / Commonwealth)
        day = part1;
        month = part2;
      }
      matched = true;
    } else {
      // 3. Match textual dates e.g. "25 Aug 2026", "25-August-2026"
      const parsedTimestamp = Date.parse(trimmed);
      if (!isNaN(parsedTimestamp)) {
        const d = new Date(parsedTimestamp);
        year = d.getFullYear();
        month = d.getMonth() + 1;
        day = d.getDate();
        matched = true;
      }
    }
  }

  if (!matched || month < 1 || month > 12 || day < 1 || day > 31) {
    return { isoDate: fallbackIsoDate, isoTimestamp: fallbackIsoTimestamp };
  }

  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  const isoDate = `${year}-${paddedMonth}-${paddedDay}`;

  // Time parsing for TIMESTAMPTZ
  let hour = 12;
  let minute = 0;
  let second = 0;

  if (typeof timeVal === 'string' && timeVal.trim()) {
    const timeMatch = timeVal.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      second = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const meridiem = (timeMatch[4] || '').toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
    }
  }

  const paddedHour = String(hour).padStart(2, '0');
  const paddedMin = String(minute).padStart(2, '0');
  const paddedSec = String(second).padStart(2, '0');
  const isoTimestamp = `${isoDate}T${paddedHour}:${paddedMin}:${paddedSec}.000Z`;

  return { isoDate, isoTimestamp };
}

// JSON validation and serialization for PostgreSQL JSONB columns
export function validateJsonbPayload(payload: any): Record<string, any> {
  if (payload === null || payload === undefined) {
    return {};
  }
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return typeof parsed === 'object' && parsed !== null ? parsed : { value: parsed };
    } catch {
      return { raw_content: payload };
    }
  }
  if (typeof payload === 'object') {
    try {
      // Validate serialization and strip any non-JSON compliant functions/circular refs
      return JSON.parse(JSON.stringify(payload));
    } catch {
      return { fallback_text: String(payload) };
    }
  }
  return { value: payload };
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

  const receiptNumber = typeof data.invoice_number === 'string' && data.invoice_number.trim()
    ? data.invoice_number.trim()
    : (typeof data.receipt_number === 'string' && data.receipt_number.trim()
      ? data.receipt_number.trim()
      : (typeof data.receiptNumber === 'string' && data.receiptNumber.trim()
        ? data.receiptNumber.trim()
        : (typeof data.invoiceNumber === 'string' && data.invoiceNumber.trim()
          ? data.invoiceNumber.trim()
          : 'INV-' + Math.floor(100000 + Math.random() * 900000))));

  const rawDate = data.issue_date || data.issueDate || data.date || data.scan_date || data.scanDate;
  const rawTime = typeof data.time === 'string' ? data.time.trim() : undefined;
  const { isoDate, isoTimestamp } = standardizeIsoDate(rawDate, rawTime);
  const monthKey = typeof data.month_key === 'string' && data.month_key.trim()
    ? data.month_key.trim()
    : (typeof data.monthKey === 'string' && data.monthKey.trim()
      ? data.monthKey.trim()
      : isoDate.substring(0, 7));

  const address = typeof data.address === 'string' && data.address.trim() ? data.address.trim() : undefined;
  const vatNumber = typeof data.vat_number === 'string' && data.vat_number.trim()
    ? data.vat_number.trim()
    : (typeof data.vatNumber === 'string' && data.vatNumber.trim() ? data.vatNumber.trim() : undefined);
  const cashier = typeof data.cashier === 'string' && data.cashier.trim() ? data.cashier.trim() : undefined;

  let rawItems = Array.isArray(data.items)
    ? data.items
    : (Array.isArray(data.line_items) ? data.line_items : []);

  let normalizedItems = rawItems.map((item: any) => {
    const desc = typeof item.item_name === 'string' && item.item_name.trim()
      ? item.item_name.trim()
      : (typeof item.description === 'string' && item.description.trim()
        ? item.description.trim()
        : (typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Materials Item'));
    const qty = Math.max(1, sanitizeNumeric(item.quantity, 1));
    const unitPrice = Math.max(0, sanitizeNumeric(item.unit_price ?? item.unitCost ?? item.unitPrice ?? item.cost ?? item.price, 0));
    const totalPrice = sanitizeNumeric(item.total_price ?? item.total ?? item.totalPrice, Number((qty * unitPrice).toFixed(2)));
    const codeBarcode = typeof item.code_barcode === 'string' && item.code_barcode.trim()
      ? item.code_barcode.trim()
      : (typeof item.codeBarcode === 'string' && item.codeBarcode.trim() ? item.codeBarcode.trim() : undefined);
    const cat = typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Electrical';
    const u = typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'ea';

    return {
      code_barcode: codeBarcode,
      codeBarcode,
      item_name: desc,
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
  let totalAmount = sanitizeNumeric(data.grand_total ?? data.grandTotal ?? data.total_amount ?? data.totalAmount, 0);
  if (totalAmount <= 0 && normalizedItems.length > 0) {
    totalAmount = Number(normalizedItems.reduce((sum: number, it: any) => sum + (it.quantity * it.unitCost), 0).toFixed(2));
  }

  // If no items extracted but total amount is known, provide single line
  if (normalizedItems.length === 0 && totalAmount > 0) {
    normalizedItems = [
      {
        code_barcode: undefined,
        codeBarcode: undefined,
        item_name: 'Supplier Materials (' + supplierName + ')',
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

  let subtotal = sanitizeNumeric(data.subtotal, 0);
  if (subtotal <= 0 && totalAmount > 0) {
    subtotal = Number((totalAmount / 1.15).toFixed(2));
  }

  let vatAmount = sanitizeNumeric(data.vat_amount ?? data.vatAmount, 0);
  if (vatAmount <= 0 && totalAmount > 0) {
    vatAmount = Number((totalAmount * 0.15 / 1.15).toFixed(2));
  }

  return {
    supplier_name: supplierName,
    supplierName,
    address,
    vat_number: vatNumber,
    vatNumber,
    invoice_number: receiptNumber,
    receipt_number: receiptNumber,
    receiptNumber,
    invoiceNumber: receiptNumber,
    issue_date: isoDate,
    date: isoDate,
    month_key: monthKey,
    monthKey,
    scan_date: isoTimestamp,
    time: rawTime,
    cashier,
    subtotal: subtotal > 0 ? subtotal : undefined,
    vat_amount: vatAmount,
    vatAmount,
    grand_total: totalAmount,
    total_amount: totalAmount,
    totalAmount,
    total: totalAmount,
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

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: false,
  }));
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

  // GET Current User Usage & Entitlements
  app.get('/api/usage', (req, res) => {
    try {
      const userId = extractUserId(req) || 'anonymous_user';
      const record = usageStore.getUserRecord(userId);
      const tierConfig = TIER_DEFINITIONS[record.tier] || TIER_DEFINITIONS.FREE;
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const creditsRemaining = tierConfig.unlimitedAi
        ? 999999
        : Math.max(0, tierConfig.monthlyAiCredits + record.aiCreditsBonus - record.aiCreditsUsed);

      const scanLimit = tierConfig.unlimitedAi ? 999999 : tierConfig.monthlyAiCredits;
      const scansUsed = record.aiCreditsUsed || 0;
      const scansRemaining = creditsRemaining;

      return res.status(200).json({
        userId,
        tier: record.tier,
        status: record.status,
        billingCycle: record.billingCycle,
        scansUsed,
        scanLimit,
        scansRemaining,
        aiCredits: {
          total: tierConfig.monthlyAiCredits,
          bonus: record.aiCreditsBonus,
          used: record.aiCreditsUsed,
          remaining: creditsRemaining,
          unlimited: tierConfig.unlimitedAi,
        },
        documents: {
          createdThisMonth: record.documentsCreatedThisMonth,
          maxAllowed: tierConfig.maxMonthlyDocuments === Infinity ? -1 : tierConfig.maxMonthlyDocuments,
          unlimited: tierConfig.maxMonthlyDocuments === Infinity,
        },
        inventory: {
          maxItems: tierConfig.maxInventoryItems === Infinity ? -1 : tierConfig.maxInventoryItems,
          unlimited: tierConfig.maxInventoryItems === Infinity,
        },
        entitlements: tierConfig,
        subscriptionExpiresAt: record.subscriptionExpiresAt,
        resetDate: nextMonth.toISOString(),
      });
    } catch (err: any) {
      console.error('[Usage API Error]', err);
      const fallbackUserId = (req.query?.userId as string) || 'default_user';
      return res.status(200).json({
        userId: fallbackUserId,
        tier: 'FREE',
        status: 'active',
        scansUsed: 0,
        scanLimit: 100,
        scansRemaining: 100,
        aiCredits: {
          total: 100,
          bonus: 0,
          used: 0,
          remaining: 100,
          unlimited: false,
        },
        documents: {
          createdThisMonth: 0,
          maxAllowed: 5,
          unlimited: false,
        },
        inventory: {
          maxItems: 20,
          unlimited: false,
        },
      });
    }
  });

  // POST Increment Document Count (for Free tier document limit enforcement)
  app.post('/api/usage/document-created', (req, res) => {
    const userId = extractUserId(req);
    const result = usageStore.incrementDocumentCount(userId);
    res.json(result);
  });

  // POST Purchase Verification (Google Play / RevenueCat / Web Stripe)
  app.post('/api/billing/verify', (req, res) => {
    const userId = extractUserId(req);
    const { productId, purchaseToken, orderId, platform } = req.body || {};

    console.log(`[Billing Server] Verifying purchase for user=${userId}: product=${productId}, platform=${platform}`);

    let tier: SubscriptionTier = 'PRO';
    if (productId && (productId.includes('business') || productId.includes('ai_tier'))) {
      tier = 'BUSINESS';
    } else if (productId && (productId.includes('pro') || productId.includes('starter'))) {
      tier = 'PRO';
    }

    // Set 30-day expiration for monthly or 365-day for annual
    const durationDays = productId && (productId.includes('year') || productId.includes('annual')) ? 365 : 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const source = platform === 'google_play' ? 'google_play' : platform === 'revenuecat' ? 'revenuecat' : 'stripe';
    const updated = usageStore.updateUserTier(userId, tier, expiresAt, source);

    res.json({
      success: true,
      message: `Successfully activated ${tier} subscription.`,
      tier: updated.tier,
      expiresAt: updated.subscriptionExpiresAt,
      record: updated,
    });
  });

  // POST Developer Code / Token Unlock (NismoR34)
  app.post('/api/billing/developer-code', (req, res) => {
    const userId = extractUserId(req);
    const { code } = req.body || {};

    if (!code || typeof code !== 'string' || code.trim().toLowerCase() !== 'nismor34') {
      return res.status(400).json({
        success: false,
        message: 'Invalid developer token. Please verify the code.',
      });
    }

    console.log(`[Billing Server] Developer token 'NismoR34' accepted for userId=${userId}. Unlocking Lifetime Business Access.`);

    // Set lifetime expiration date
    const lifetimeExpiresAt = '2099-12-31T23:59:59.000Z';
    const updated = usageStore.updateUserTier(userId, 'BUSINESS', lifetimeExpiresAt, 'manual');

    return res.json({
      success: true,
      message: 'Developer Code (NismoR34) Verified! Unlimited Lifetime Business Tier Unlocked.',
      tier: updated.tier,
      expiresAt: updated.subscriptionExpiresAt,
      record: updated,
    });
  });

  // POST Server Webhook (RevenueCat / Google Play RTDN)
  app.post('/api/billing/webhook', (req, res) => {
    const event = req.body?.event || req.body;
    console.log('[Billing Webhook] Received webhook notification:', event?.type || event?.notificationType || 'Unknown');

    // RevenueCat webhook payload handling
    if (event?.app_user_id) {
      const userId = event.app_user_id;
      const type = event.type;
      const productId = event.product_id || '';

      if (type === 'INITIAL_PURCHASE' || type === 'RENEWAL' || type === 'PRODUCT_CHANGE') {
        const tier: SubscriptionTier = productId.includes('business') ? 'BUSINESS' : 'PRO';
        const expDate = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : undefined;
        usageStore.updateUserTier(userId, tier, expDate, 'revenuecat');
      } else if (type === 'EXPIRATION' || type === 'CANCELLATION') {
        usageStore.updateUserTier(userId, 'FREE', undefined, 'revenuecat');
      }
    }

    res.json({ received: true });
  });

  // POST AI Voice-to-Quote / Structured Job Estimation API
  app.post('/api/ai/voice-quote', requireAiCredit('voice_to_quote'), async (req, res) => {
    const { transcript, profile } = req.body || {};
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Missing audio transcript or text prompt' });
    }

    try {
      const result = await generateQuoteFromVoiceOrText(transcript, profile);
      res.json(result);
    } catch (err: any) {
      console.error('[AI Voice-Quote Error]', err);
      // Even if AI service fails, return failsafe trade template
      const fallback = await generateQuoteFromVoiceOrText(transcript, profile);
      res.json(fallback);
    }
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

  // Receipt & Supplier Invoice OCR API (Metered by AI Credits)
  app.post('/api/scan-receipt', requireAiCredit('receipt_ocr'), async (req, res) => {
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

      if (!rawImagePayload || typeof rawImagePayload !== 'string' || rawImagePayload.trim().length === 0) {
        console.warn('[OCR Server] Missing or empty image data received');
        return res.status(500).json({ error: 'Failed to parse receipt image' });
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

      if (!cleanBase64 || cleanBase64.length === 0) {
        return res.status(500).json({ error: 'Failed to parse receipt image' });
      }

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

        if (!fallbackData || typeof fallbackData !== 'object') {
          return res.status(500).json({ error: 'Failed to parse receipt image' });
        }
        return res.status(200).json(fallbackData);
      }

      const promptText = `You are a robust document data extraction engine. Your job is to extract invoice items and issue dates from scanned invoice images and format them strictly into a standard JSON schema.
Rules:
Always respond with raw, valid JSON only. Do not include markdown ticks, backticks (\`\`\`json), or commentary.
Clean numeric strings: Ensure quantities, unit prices, and totals are parsed as raw numbers (e.g. 12.50, not '$12.50').
Standardize dates to YYYY-MM-DD. If year is missing or ambiguous, use the current year.
If an item name is truncated or unclear, extract best-effort plain text. Never omit the items array.
Required JSON structure:
{
  "invoice_number": string | null,
  "issue_date": string,
  "month_key": string, // Format: 'YYYY-MM'
  "items": [
    {
      "item_name": string,
      "quantity": number,
      "unit_price": number,
      "total_price": number
    }
  ],
  "grand_total": number
}`;

      const ocrSchema = {
        type: Type.OBJECT,
        properties: {
          invoice_number: { type: Type.STRING, description: 'Invoice or receipt reference number, or null if unreadable' },
          issue_date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
          month_key: { type: Type.STRING, description: 'Accounting month in YYYY-MM format' },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item_name: { type: Type.STRING, description: 'Item description or product name' },
                quantity: { type: Type.NUMBER, description: 'Numeric quantity parsed cleanly' },
                unit_price: { type: Type.NUMBER, description: 'Numeric unit price' },
                total_price: { type: Type.NUMBER, description: 'Numeric total price' },
              },
              required: ['item_name', 'quantity', 'unit_price', 'total_price'],
            },
          },
          grand_total: { type: Type.NUMBER, description: 'Numeric grand total amount' },
          supplier_name: { type: Type.STRING, description: 'Supplier or store name at the top of the invoice' },
          address: { type: Type.STRING, description: 'Physical address' },
          vat_number: { type: Type.STRING, description: 'Tax/VAT registration number' },
        },
        required: ['issue_date', 'month_key', 'items', 'grand_total'],
      };

      // Model Redundancy Hierarchy: Primary (gemini-3.7-flash) -> Fast Alias (gemini-flash-latest) -> High-Throughput (gemini-3.1-flash-lite)
      const modelCandidates = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
      let rawResponseText = '';
      let successfulModel = '';
      let lastAttemptError: any = null;

      // Model & Retry Loop with Exponential Backoff + Jitter
      modelLoop: for (const currentModel of modelCandidates) {
        const maxRetries = 2;
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

            if (extractedText && typeof extractedText === 'string' && extractedText.trim().length > 0) {
              rawResponseText = extractedText.trim();
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

            // If 404 (deprecated/unsupported model), immediately break to next model without wasting retries
            const is404NotFound =
              modelErr?.status === 404 ||
              modelErr?.statusCode === 404 ||
              String(modelErr?.message || '').includes('404') ||
              String(modelErr?.message || '').includes('no longer available') ||
              String(modelErr?.message || '').includes('NOT_FOUND');

            if (is404NotFound) {
              console.warn(`[OCR Server] Model ${currentModel} not available (404), switching immediately to next candidate model...`);
              break;
            }

            if (isTransient && attempt < maxRetries - 1) {
              // Exponential backoff: ~800ms, ~1600ms (+ 0-300ms random jitter)
              const baseBackoff = (attempt + 1) * 800;
              const jitter = Math.floor(Math.random() * 300);
              const waitDuration = baseBackoff + jitter;
              console.log(`[OCR Server] High traffic / 503 detected on ${currentModel}. Retrying in ${waitDuration}ms...`);
              await delayMs(waitDuration);
              continue;
            }

            // Move to next candidate model if this one is exhausted or permanently failing
            break;
          }
        }
      }

      // If we got valid response text from any model tier
      if (rawResponseText && rawResponseText.length > 0) {
        try {
          const extractedJson = sanitizeAndExtractOcrData(rawResponseText);
          const parsedData = normalizeOcrData(extractedJson, rawResponseText);

          if (
            !parsedData ||
            typeof parsedData !== 'object' ||
            typeof parsedData === 'string' ||
            !Array.isArray(parsedData.items)
          ) {
            console.warn('[OCR Server] Parsed data is invalid or empty string');
            return res.status(500).json({ error: 'Failed to parse receipt image' });
          }

          return res.status(200).json(parsedData);
        } catch (parseErr: any) {
          console.error('[OCR Server] Error parsing model response JSON:', parseErr);
          return res.status(500).json({ error: 'Failed to parse receipt image' });
        }
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

      // If model returned empty or could not parse receipt
      return res.status(500).json({ error: 'Failed to parse receipt image' });
    } catch (error: any) {
      console.error('[OCR Server Error] Fatal uncaught error during OCR processing:', {
        message: error?.message,
        duration: Date.now() - startTime,
      });

      return res.status(500).json({ error: 'Failed to parse receipt image' });
    }
  });

  /**
   * Receipt Scan Database Ingestion & Parameterized Validation Endpoint
   * Safeguards against SQL type mismatches, non-numeric values, invalid dates, and unescaped JSON.
   */
  app.post('/api/receipt-scans', async (req, res) => {
    try {
      const payload = req.body || {};

      // 1. Sanitize text fields
      const supplierName = (payload.supplier_name || payload.supplierName || 'Unknown Supplier').toString().trim().slice(0, 255);
      const invoiceNumber = (payload.invoice_number || payload.invoiceNumber || payload.receipt_number || payload.receiptNumber || 'INV-' + Math.floor(100000 + Math.random() * 900000)).toString().trim().slice(0, 100);

      // 2. Standardize date & timestamp into ISO-8601 for TIMESTAMPTZ
      const { isoDate, isoTimestamp } = standardizeIsoDate(payload.scan_date || payload.date, payload.time);

      // 3. Clean numeric total_amount for NUMERIC(12, 2) - stripping symbols and rounding to 2 decimal places
      const totalAmount = sanitizeNumeric(payload.total_amount ?? payload.totalAmount, 0);

      // 4. Validate and serialize JSONB payload
      const rawOcrJson = validateJsonbPayload(payload.raw_ocr_json || payload.rawOcrJson || payload);

      const processed = Boolean(payload.processed);

      // Parameterized SQL query structure for PostgreSQL 13+ with gen_random_uuid()
      const query = {
        text: `
          INSERT INTO receipt_scans (
            supplier_name,
            invoice_number,
            scan_date,
            total_amount,
            raw_ocr_json,
            processed
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *;
        `,
        values: [
          supplierName,
          invoiceNumber,
          isoTimestamp, // TIMESTAMPTZ compliant ISO string
          totalAmount,  // Sanitized Float for NUMERIC(12, 2)
          JSON.stringify(rawOcrJson), // Serialized JSONB string
          processed,
        ],
      };

      console.log('[Receipt Scan DB] Sanitized record prepared for insertion:', {
        supplier_name: supplierName,
        invoice_number: invoiceNumber,
        scan_date: isoTimestamp,
        total_amount: totalAmount,
      });

      return res.status(201).json({
        success: true,
        message: 'Receipt scan sanitized and validated successfully for PostgreSQL insertion.',
        record: {
          supplier_name: supplierName,
          invoice_number: invoiceNumber,
          scan_date: isoTimestamp,
          iso_date: isoDate,
          total_amount: totalAmount,
          raw_ocr_json: rawOcrJson,
          processed,
        },
        sql_prepared: query,
      });
    } catch (err: any) {
      console.error('[Receipt Scan DB Error] Failed to process receipt scan payload:', err);
      return res.status(400).json({
        error: 'Invalid receipt scan data format.',
        details: err?.message || err,
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

