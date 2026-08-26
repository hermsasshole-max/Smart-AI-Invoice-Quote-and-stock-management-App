import { GoogleGenAI, Type } from '@google/genai';

/**
 * Circuit Breaker State & Configuration
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN',     // Tripped, failing fast to fallback
  HALF_OPEN = 'HALF_OPEN', // Testing single probe request
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5; // Trip after 5 consecutive transient failures
  private readonly cooldownPeriodMs = 30000; // 30s cooldown before testing HALF_OPEN

  public canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) return true;

    const now = Date.now();
    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime > this.cooldownPeriodMs) {
        console.log('[CircuitBreaker] Cooldown expired. Moving to HALF_OPEN to probe Gemini API.');
        this.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN allows single probe
    return true;
  }

  public recordSuccess(): void {
    if (this.state !== CircuitState.CLOSED) {
      console.log('[CircuitBreaker] Probe succeeded. Resetting circuit to CLOSED.');
    }
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
  }

  public recordFailure(isTransient: boolean): void {
    this.lastFailureTime = Date.now();
    if (isTransient) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.state = CircuitState.OPEN;
        console.warn(`[CircuitBreaker] ${this.failureCount} consecutive failures. Tripping circuit to OPEN for 30s.`);
      }
    }
  }

  public getState() {
    return this.state;
  }
}

export const circuitBreaker = new CircuitBreaker();

/**
 * Transient Error Detection
 */
export function isTransientError(error: any): boolean {
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

/**
 * Lazy Gemini Client Provider
 */
let geminiClientInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  if (!geminiClientInstance) {
    geminiClientInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClientInstance;
}

/**
 * Robust Model Invocation with Exponential Backoff and Fallback Hierarchy
 */
export async function executeFailsafeGeminiCall<T>(
  promptOrContents: any,
  schema: any,
  systemInstruction?: string
): Promise<{ data: T; isFallback: boolean; modelUsed: string }> {
  const ai = getGeminiClient();

  if (!ai || !circuitBreaker.canExecute()) {
    console.warn('[GeminiService] API key missing or circuit OPEN. Falling back to local heuristic synthesis.');
    throw new Error('CIRCUIT_OPEN_OR_NO_KEY');
  }

  // Model Hierarchy: Primary (gemini-3.7-flash) -> Fast Alias (gemini-flash-latest) -> High-Throughput (gemini-3.1-flash-lite)
  const candidateModels = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const currentModel of candidateModels) {
    const maxRetries = 2;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const generatePromise = ai.models.generateContent({
          model: currentModel,
          contents: promptOrContents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            systemInstruction: systemInstruction || undefined,
          },
        });

        // 30s timeout guard per individual attempt
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Attempt timed out on ${currentModel}`)), 30000)
        );

        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        const text = response?.text;

        if (text && text.trim().length > 0) {
          const parsed = JSON.parse(text.trim()) as T;
          circuitBreaker.recordSuccess();
          return {
            data: parsed,
            isFallback: false,
            modelUsed: currentModel,
          };
        }
      } catch (err: any) {
        lastError = err;
        const isTransient = isTransientError(err);
        circuitBreaker.recordFailure(isTransient);

        // If 404 (model unavailable), switch to next candidate immediately
        const is404 =
          err?.status === 404 ||
          err?.statusCode === 404 ||
          String(err?.message || '').includes('404') ||
          String(err?.message || '').includes('not found');

        if (is404) break;

        if (isTransient && attempt < maxRetries - 1) {
          const backoff = (attempt + 1) * 700 + Math.floor(Math.random() * 300);
          console.log(`[GeminiService] Transient error on ${currentModel}. Retrying in ${backoff}ms...`);
          await delayMs(backoff);
          continue;
        }

        break;
      }
    }
  }

  throw lastError || new Error('ALL_MODELS_FAILED');
}

// -------------------------------------------------------------
// 1. STRUCTURED SCHEMAS FOR STRUCTURED OUTPUTS
// -------------------------------------------------------------

export const QuoteGenerationSchema = {
  type: Type.OBJECT,
  properties: {
    clientName: { type: Type.STRING, description: 'Client or property owner name' },
    clientPhone: { type: Type.STRING, description: 'Phone number if mentioned' },
    clientAddress: { type: Type.STRING, description: 'Job site address or suburb' },
    serviceType: {
      type: Type.STRING,
      description: 'One of: Electrical, Air Conditioning, Solar & Backup, Security & CCTV, Automation & Gate Motors, Maintenance & Repairs',
    },
    scopeOfWork: { type: Type.STRING, description: 'Comprehensive contractor scope of work description' },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: 'Material or hardware line item name' },
          category: { type: Type.STRING, description: 'Electrical, Hardware, Cabling, Switchgear, etc.' },
          quantity: { type: Type.NUMBER, description: 'Quantity required' },
          costPrice: { type: Type.NUMBER, description: 'Estimated trade supplier cost in ZAR' },
          markupPct: { type: Type.NUMBER, description: 'Standard markup percentage (e.g. 25, 30, 35)' },
          unit: { type: Type.STRING, description: 'Unit of measure: ea, m, roll, pack, box, set' },
        },
        required: ['description', 'quantity', 'costPrice'],
      },
    },
    calloutFee: { type: Type.NUMBER, description: 'Standard Call-out fee (default ~R650)' },
    labourHours: { type: Type.NUMBER, description: 'Estimated on-site technician hours' },
    labourRatePerHour: { type: Type.NUMBER, description: 'Hourly labour rate in ZAR (default ~R450 - R650)' },
    travelDistanceKm: { type: Type.NUMBER, description: 'Estimated round-trip kilometers' },
    travelRatePerKm: { type: Type.NUMBER, description: 'Rate per km (default ~R6.50)' },
    notes: { type: Type.STRING, description: 'Payment terms, SANS 10142-1 notes, or warranty terms' },
  },
  required: ['scopeOfWork', 'items'],
};

export const ReceiptOcrSchema = {
  type: Type.OBJECT,
  properties: {
    supplier_name: { type: Type.STRING, description: 'Merchant or trade supply store name' },
    address: { type: Type.STRING, description: 'Physical store address' },
    vat_number: { type: Type.STRING, description: 'Supplier VAT number' },
    receipt_number: { type: Type.STRING, description: 'Tax invoice or slip number' },
    date: { type: Type.STRING, description: 'Transaction date (YYYY-MM-DD)' },
    time: { type: Type.STRING, description: 'Transaction time (HH:MM:SS)' },
    cashier: { type: Type.STRING, description: 'Cashier name or operator code' },
    line_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code_barcode: { type: Type.STRING, description: 'Product code, SKU or barcode' },
          description: { type: Type.STRING, description: 'Item description' },
          quantity: { type: Type.NUMBER, description: 'Quantity purchased' },
          unit_price: { type: Type.NUMBER, description: 'Price per unit' },
          total_price: { type: Type.NUMBER, description: 'Line total' },
          category: { type: Type.STRING, description: 'Electrical, Cabling, Hardware, etc.' },
        },
        required: ['description', 'quantity', 'unit_price', 'total_price'],
      },
    },
    vat_amount: { type: Type.NUMBER, description: 'Total 15% VAT amount' },
    subtotal: { type: Type.NUMBER, description: 'Subtotal before VAT' },
    total_amount: { type: Type.NUMBER, description: 'Grand total payable' },
  },
  required: ['supplier_name', 'total_amount', 'line_items'],
};

// -------------------------------------------------------------
// 2. FAIL-OPEN SERVICE FUNCTIONS
// -------------------------------------------------------------

export interface VoiceQuoteResult {
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  serviceType: string;
  scopeOfWork: string;
  items: Array<{
    description: string;
    category: string;
    quantity: number;
    costPrice: number;
    markupPct: number;
    unitPrice: number;
    unit: string;
    total: number;
  }>;
  calloutFee: number;
  labourHours: number;
  labourRatePerHour: number;
  travelDistanceKm: number;
  travelRatePerKm: number;
  notes: string;
  isFallback?: boolean;
}

export async function generateQuoteFromVoiceOrText(
  transcript: string,
  userProfile?: any
): Promise<VoiceQuoteResult> {
  const defaultLabourRate = Number(userProfile?.defaultLabourRate) || 550;
  const defaultCalloutFee = Number(userProfile?.defaultCalloutFee) || 650;
  const defaultTravelRate = Number(userProfile?.defaultTravelRate) || 6.5;
  const defaultMarkup = Number(userProfile?.defaultMarkup) || 30;

  const systemInstruction = `You are an expert South African Electrical, HVAC, and Solar Estimator assisting contractors.
Parse the contractor's voice note or description into itemized materials, labor hours, and scope of work adhering to South African trade standards (SANS 10142-1, ZAR currency).
Default Callout Fee is R${defaultCalloutFee}, Default Labour Rate is R${defaultLabourRate}/hr, Default Markup is ${defaultMarkup}%.`;

  try {
    const result = await executeFailsafeGeminiCall<any>(
      `Voice / Job Description: "${transcript}"`,
      QuoteGenerationSchema,
      systemInstruction
    );

    const raw = result.data;
    const items = (raw.items || []).map((it: any) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const cost = Math.max(0, Number(it.costPrice) || 50);
      const markup = Number(it.markupPct) || defaultMarkup;
      const unitPrice = Number((cost * (1 + markup / 100)).toFixed(2));
      return {
        description: String(it.description || 'Materials'),
        category: String(it.category || 'Electrical'),
        quantity: qty,
        costPrice: cost,
        markupPct: markup,
        unitPrice,
        unit: String(it.unit || 'ea'),
        total: Number((qty * unitPrice).toFixed(2)),
      };
    });

    return {
      clientName: raw.clientName || undefined,
      clientPhone: raw.clientPhone || undefined,
      clientAddress: raw.clientAddress || undefined,
      serviceType: raw.serviceType || 'Electrical',
      scopeOfWork: raw.scopeOfWork || transcript.slice(0, 150),
      items: items.length > 0 ? items : [
        {
          description: 'Supply & Installation Work as detailed',
          category: 'Electrical',
          quantity: 1,
          costPrice: 450,
          markupPct: defaultMarkup,
          unitPrice: Number((450 * (1 + defaultMarkup / 100)).toFixed(2)),
          unit: 'lot',
          total: Number((450 * (1 + defaultMarkup / 100)).toFixed(2)),
        }
      ],
      calloutFee: Number(raw.calloutFee) || defaultCalloutFee,
      labourHours: Number(raw.labourHours) || 2,
      labourRatePerHour: Number(raw.labourRatePerHour) || defaultLabourRate,
      travelDistanceKm: Number(raw.travelDistanceKm) || 0,
      travelRatePerKm: Number(raw.travelRatePerKm) || defaultTravelRate,
      notes: raw.notes || 'Workmanship guaranteed for 12 months. Compliance Certificate issued upon full settlement.',
      isFallback: false,
    };
  } catch (err) {
    console.warn('[GeminiService] AI generation failed or circuit open. Providing intelligent trade template fallback.');

    // Intelligent heuristic fallback so the contractor NEVER loses their job context
    const lines = transcript.split(/[\n,.]+/).map((l) => l.trim()).filter((l) => l.length > 2);
    const mockItems = lines.slice(0, 3).map((line, idx) => ({
      description: line.charAt(0).toUpperCase() + line.slice(1),
      category: 'Electrical',
      quantity: 1,
      costPrice: 350 + idx * 100,
      markupPct: defaultMarkup,
      unitPrice: Number(((350 + idx * 100) * (1 + defaultMarkup / 100)).toFixed(2)),
      unit: 'ea',
      total: Number(((350 + idx * 100) * (1 + defaultMarkup / 100)).toFixed(2)),
    }));

    return {
      serviceType: 'Electrical',
      scopeOfWork: transcript || 'General electrical inspection, repair and installation',
      items: mockItems.length > 0 ? mockItems : [
        {
          description: 'Electrical & AC materials according to site requirements',
          category: 'Electrical',
          quantity: 1,
          costPrice: 500,
          markupPct: defaultMarkup,
          unitPrice: Number((500 * (1 + defaultMarkup / 100)).toFixed(2)),
          unit: 'lot',
          total: Number((500 * (1 + defaultMarkup / 100)).toFixed(2)),
        },
      ],
      calloutFee: defaultCalloutFee,
      labourHours: 2,
      labourRatePerHour: defaultLabourRate,
      travelDistanceKm: 0,
      travelRatePerKm: defaultTravelRate,
      notes: 'Generated via offline trade estimator. You can manually adjust all items, quantities, and rates.',
      isFallback: true,
    };
  }
}
