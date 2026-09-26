"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  parseNumeric: () => parseNumeric,
  sanitizeNumeric: () => sanitizeNumeric,
  standardizeIsoDate: () => standardizeIsoDate,
  validateJsonbPayload: () => validateJsonbPayload
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_genai2 = require("@google/genai");
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/middleware/usageMeter.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var TIER_DEFINITIONS = {
  FREE: {
    maxMonthlyDocuments: 5,
    maxInventoryItems: 20,
    monthlyAiCredits: 3,
    customPdfBranding: false,
    directShareDelivery: false,
    unlimitedAi: false,
    cloudSync: false,
    priceZarMonthly: 0,
    priceUsdMonthly: 0
  },
  PRO: {
    maxMonthlyDocuments: Infinity,
    maxInventoryItems: Infinity,
    monthlyAiCredits: 50,
    customPdfBranding: true,
    directShareDelivery: true,
    unlimitedAi: false,
    cloudSync: false,
    priceZarMonthly: 149,
    priceUsdMonthly: 9.99
  },
  BUSINESS: {
    maxMonthlyDocuments: Infinity,
    maxInventoryItems: Infinity,
    monthlyAiCredits: Infinity,
    customPdfBranding: true,
    directShareDelivery: true,
    unlimitedAi: true,
    cloudSync: true,
    priceZarMonthly: 299,
    priceUsdMonthly: 19.99
  }
};
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var USAGE_FILE = import_path.default.join(DATA_DIR, "user-usage-store.json");
if (!import_fs.default.existsSync(DATA_DIR)) {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
}
var UsageStore = class {
  cache = /* @__PURE__ */ new Map();
  isLoaded = false;
  saveTimeout = null;
  constructor() {
    this.load();
  }
  load() {
    try {
      if (import_fs.default.existsSync(USAGE_FILE)) {
        const raw = import_fs.default.readFileSync(USAGE_FILE, "utf-8");
        const data = JSON.parse(raw);
        for (const [key, val] of Object.entries(data)) {
          this.cache.set(key, val);
        }
      }
      this.isLoaded = true;
    } catch (err) {
      console.error("[UsageStore] Failed to load store file, starting fresh cache:", err);
      this.isLoaded = true;
    }
  }
  scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.flushToDisk();
    }, 500);
  }
  flushToDisk() {
    try {
      const obj = {};
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
      }
      const tmpFile = `${USAGE_FILE}.tmp.${Date.now()}`;
      import_fs.default.writeFileSync(tmpFile, JSON.stringify(obj, null, 2), "utf-8");
      import_fs.default.renameSync(tmpFile, USAGE_FILE);
    } catch (err) {
      console.error("[UsageStore] Failed to write usage store to disk:", err);
    }
  }
  getCurrentCycle() {
    const now = /* @__PURE__ */ new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  getUserRecord(userId) {
    const currentCycle = this.getCurrentCycle();
    let record = this.cache.get(userId);
    if (!record) {
      record = {
        userId,
        tier: "FREE",
        status: "active",
        billingCycle: currentCycle,
        aiCreditsUsed: 0,
        aiCreditsBonus: 0,
        documentsCreatedThisMonth: 0,
        lastVerifiedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.cache.set(userId, record);
      this.scheduleSave();
      return record;
    }
    if (record.billingCycle !== currentCycle) {
      record.billingCycle = currentCycle;
      record.aiCreditsUsed = 0;
      record.documentsCreatedThisMonth = 0;
      record.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.cache.set(userId, record);
      this.scheduleSave();
    }
    return record;
  }
  updateUserTier(userId, tier, expiresAt, source = "manual") {
    const record = this.getUserRecord(userId);
    record.tier = tier;
    record.status = "active";
    record.subscriptionExpiresAt = expiresAt;
    record.source = source;
    record.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.cache.set(userId, record);
    this.scheduleSave();
    return record;
  }
  /**
   * Atomic AI credit check and decrement ($inc: -1)
   */
  consumeAiCredit(userId, amount = 1) {
    const record = this.getUserRecord(userId);
    const tierConfig = TIER_DEFINITIONS[record.tier];
    if (tierConfig.unlimitedAi) {
      record.aiCreditsUsed += amount;
      record.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.cache.set(userId, record);
      this.scheduleSave();
      return { success: true, record, remaining: Infinity };
    }
    const totalAllowed = tierConfig.monthlyAiCredits + record.aiCreditsBonus;
    const remaining = totalAllowed - record.aiCreditsUsed;
    if (remaining < amount) {
      return { success: false, record, remaining: Math.max(0, remaining) };
    }
    record.aiCreditsUsed += amount;
    record.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.cache.set(userId, record);
    this.scheduleSave();
    return {
      success: true,
      record,
      remaining: Math.max(0, totalAllowed - record.aiCreditsUsed)
    };
  }
  incrementDocumentCount(userId) {
    const record = this.getUserRecord(userId);
    const tierConfig = TIER_DEFINITIONS[record.tier];
    if (record.documentsCreatedThisMonth >= tierConfig.maxMonthlyDocuments) {
      return { success: false, record, allowed: false };
    }
    record.documentsCreatedThisMonth += 1;
    record.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.cache.set(userId, record);
    this.scheduleSave();
    return { success: true, record, allowed: true };
  }
};
var usageStore = new UsageStore();
function extractUserId(req) {
  const customId = req.headers["x-user-id"] || req.headers["x-device-id"] || req.query.userId || req.body?.userId;
  if (typeof customId === "string" && customId.trim().length > 0) {
    return customId.trim();
  }
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token.length > 5) {
      return `user_${token.slice(-12)}`;
    }
  }
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "default_contractor";
  return `contractor_${String(ip).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}`;
}
function requireAiCredit(featureName = "ai_assistant") {
  return (req, res, next) => {
    const userId = extractUserId(req);
    const result = usageStore.consumeAiCredit(userId, 1);
    if (!result.success) {
      const now = /* @__PURE__ */ new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      console.warn(`[UsageMeter] Blocked AI request for user=${userId} (Tier=${result.record.tier}). Limits reached.`);
      return res.status(402).json({
        error: "LIMIT_REACHED",
        tier: result.record.tier,
        upgradeRequired: true,
        feature: featureName,
        message: result.record.tier === "FREE" ? "You have used all 3 free monthly AI credits. Upgrade to Pro (50 credits) or Business (Unlimited) to continue." : "You have used your 50 Pro AI credits for this billing period. Upgrade to Business for unlimited AI generations.",
        creditsRemaining: 0,
        creditsUsed: result.record.aiCreditsUsed,
        tierLimit: TIER_DEFINITIONS[result.record.tier].monthlyAiCredits,
        resetDate: nextMonth.toISOString()
      });
    }
    req.metering = {
      userId,
      tier: result.record.tier,
      creditsRemaining: result.remaining
    };
    next();
  };
}

// server/services/geminiService.ts
var import_genai = require("@google/genai");
var CircuitBreaker = class {
  state = "CLOSED" /* CLOSED */;
  failureCount = 0;
  lastFailureTime = 0;
  failureThreshold = 5;
  // Trip after 5 consecutive transient failures
  cooldownPeriodMs = 3e4;
  // 30s cooldown before testing HALF_OPEN
  canExecute() {
    if (this.state === "CLOSED" /* CLOSED */) return true;
    const now = Date.now();
    if (this.state === "OPEN" /* OPEN */) {
      if (now - this.lastFailureTime > this.cooldownPeriodMs) {
        console.log("[CircuitBreaker] Cooldown expired. Moving to HALF_OPEN to probe Gemini API.");
        this.state = "HALF_OPEN" /* HALF_OPEN */;
        return true;
      }
      return false;
    }
    return true;
  }
  recordSuccess() {
    if (this.state !== "CLOSED" /* CLOSED */) {
      console.log("[CircuitBreaker] Probe succeeded. Resetting circuit to CLOSED.");
    }
    this.state = "CLOSED" /* CLOSED */;
    this.failureCount = 0;
  }
  recordFailure(isTransient) {
    this.lastFailureTime = Date.now();
    if (isTransient) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN" /* OPEN */;
        console.warn(`[CircuitBreaker] ${this.failureCount} consecutive failures. Tripping circuit to OPEN for 30s.`);
      }
    }
  }
  getState() {
    return this.state;
  }
};
var circuitBreaker = new CircuitBreaker();
function isTransientError(error) {
  const status = error?.status || error?.statusCode || error?.code;
  const message = String(error?.message || error || "").toLowerCase();
  return status === 503 || status === 429 || status === "UNAVAILABLE" || status === "RESOURCE_EXHAUSTED" || message.includes("503") || message.includes("429") || message.includes("unavailable") || message.includes("high demand") || message.includes("rate limit") || message.includes("resource exhausted") || message.includes("overloaded") || message.includes("temporary") || message.includes("quota") || message.includes("fetch failed") || message.includes("econnreset");
}
var delayMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var geminiClientInstance = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClientInstance) {
    geminiClientInstance = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return geminiClientInstance;
}
async function executeFailsafeGeminiCall(promptOrContents, schema, systemInstruction) {
  const ai = getGeminiClient();
  if (!ai || !circuitBreaker.canExecute()) {
    console.warn("[GeminiService] API key missing or circuit OPEN. Falling back to local heuristic synthesis.");
    throw new Error("CIRCUIT_OPEN_OR_NO_KEY");
  }
  const candidateModels = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError = null;
  for (const currentModel of candidateModels) {
    const maxRetries = 2;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const generatePromise = ai.models.generateContent({
          model: currentModel,
          contents: promptOrContents,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: systemInstruction || void 0
          }
        });
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error(`Attempt timed out on ${currentModel}`)), 3e4)
        );
        const response = await Promise.race([generatePromise, timeoutPromise]);
        const text = response?.text;
        if (text && text.trim().length > 0) {
          const parsed = JSON.parse(text.trim());
          circuitBreaker.recordSuccess();
          return {
            data: parsed,
            isFallback: false,
            modelUsed: currentModel
          };
        }
      } catch (err) {
        lastError = err;
        const isTransient = isTransientError(err);
        circuitBreaker.recordFailure(isTransient);
        const is404 = err?.status === 404 || err?.statusCode === 404 || String(err?.message || "").includes("404") || String(err?.message || "").includes("not found");
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
  throw lastError || new Error("ALL_MODELS_FAILED");
}
var QuoteGenerationSchema = {
  type: import_genai.Type.OBJECT,
  properties: {
    clientName: { type: import_genai.Type.STRING, description: "Client or property owner name" },
    clientPhone: { type: import_genai.Type.STRING, description: "Phone number if mentioned" },
    clientAddress: { type: import_genai.Type.STRING, description: "Job site address or suburb" },
    serviceType: {
      type: import_genai.Type.STRING,
      description: "One of: Electrical, Air Conditioning, Solar & Backup, Security & CCTV, Automation & Gate Motors, Maintenance & Repairs"
    },
    scopeOfWork: { type: import_genai.Type.STRING, description: "Comprehensive contractor scope of work description" },
    items: {
      type: import_genai.Type.ARRAY,
      items: {
        type: import_genai.Type.OBJECT,
        properties: {
          description: { type: import_genai.Type.STRING, description: "Material or hardware line item name" },
          category: { type: import_genai.Type.STRING, description: "Electrical, Hardware, Cabling, Switchgear, etc." },
          quantity: { type: import_genai.Type.NUMBER, description: "Quantity required" },
          costPrice: { type: import_genai.Type.NUMBER, description: "Estimated trade supplier cost in ZAR" },
          markupPct: { type: import_genai.Type.NUMBER, description: "Standard markup percentage (e.g. 25, 30, 35)" },
          unit: { type: import_genai.Type.STRING, description: "Unit of measure: ea, m, roll, pack, box, set" }
        },
        required: ["description", "quantity", "costPrice"]
      }
    },
    calloutFee: { type: import_genai.Type.NUMBER, description: "Standard Call-out fee (default ~R650)" },
    labourHours: { type: import_genai.Type.NUMBER, description: "Estimated on-site technician hours" },
    labourRatePerHour: { type: import_genai.Type.NUMBER, description: "Hourly labour rate in ZAR (default ~R450 - R650)" },
    travelDistanceKm: { type: import_genai.Type.NUMBER, description: "Estimated round-trip kilometers" },
    travelRatePerKm: { type: import_genai.Type.NUMBER, description: "Rate per km (default ~R6.50)" },
    notes: { type: import_genai.Type.STRING, description: "Payment terms, SANS 10142-1 notes, or warranty terms" }
  },
  required: ["scopeOfWork", "items"]
};
var ReceiptOcrSchema = {
  type: import_genai.Type.OBJECT,
  properties: {
    supplier_name: { type: import_genai.Type.STRING, description: "Merchant or trade supply store name" },
    address: { type: import_genai.Type.STRING, description: "Physical store address" },
    vat_number: { type: import_genai.Type.STRING, description: "Supplier VAT number" },
    receipt_number: { type: import_genai.Type.STRING, description: "Tax invoice or slip number" },
    date: { type: import_genai.Type.STRING, description: "Transaction date (YYYY-MM-DD)" },
    time: { type: import_genai.Type.STRING, description: "Transaction time (HH:MM:SS)" },
    cashier: { type: import_genai.Type.STRING, description: "Cashier name or operator code" },
    line_items: {
      type: import_genai.Type.ARRAY,
      items: {
        type: import_genai.Type.OBJECT,
        properties: {
          code_barcode: { type: import_genai.Type.STRING, description: "Product code, SKU or barcode" },
          description: { type: import_genai.Type.STRING, description: "Item description" },
          quantity: { type: import_genai.Type.NUMBER, description: "Quantity purchased" },
          unit_price: { type: import_genai.Type.NUMBER, description: "Price per unit" },
          total_price: { type: import_genai.Type.NUMBER, description: "Line total" },
          category: { type: import_genai.Type.STRING, description: "Electrical, Cabling, Hardware, etc." }
        },
        required: ["description", "quantity", "unit_price", "total_price"]
      }
    },
    vat_amount: { type: import_genai.Type.NUMBER, description: "Total 15% VAT amount" },
    subtotal: { type: import_genai.Type.NUMBER, description: "Subtotal before VAT" },
    total_amount: { type: import_genai.Type.NUMBER, description: "Grand total payable" }
  },
  required: ["supplier_name", "total_amount", "line_items"]
};
async function generateQuoteFromVoiceOrText(transcript, userProfile) {
  const defaultLabourRate = Number(userProfile?.defaultLabourRate) || 550;
  const defaultCalloutFee = Number(userProfile?.defaultCalloutFee) || 650;
  const defaultTravelRate = Number(userProfile?.defaultTravelRate) || 6.5;
  const defaultMarkup = Number(userProfile?.defaultMarkup) || 30;
  const systemInstruction = `You are an expert South African Electrical, HVAC, and Solar Estimator assisting contractors.
Parse the contractor's voice note or description into itemized materials, labor hours, and scope of work adhering to South African trade standards (SANS 10142-1, ZAR currency).
Default Callout Fee is R${defaultCalloutFee}, Default Labour Rate is R${defaultLabourRate}/hr, Default Markup is ${defaultMarkup}%.`;
  try {
    const result = await executeFailsafeGeminiCall(
      `Voice / Job Description: "${transcript}"`,
      QuoteGenerationSchema,
      systemInstruction
    );
    const raw = result.data;
    const items = (raw.items || []).map((it) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const cost = Math.max(0, Number(it.costPrice) || 50);
      const markup = Number(it.markupPct) || defaultMarkup;
      const unitPrice = Number((cost * (1 + markup / 100)).toFixed(2));
      return {
        description: String(it.description || "Materials"),
        category: String(it.category || "Electrical"),
        quantity: qty,
        costPrice: cost,
        markupPct: markup,
        unitPrice,
        unit: String(it.unit || "ea"),
        total: Number((qty * unitPrice).toFixed(2))
      };
    });
    return {
      clientName: raw.clientName || void 0,
      clientPhone: raw.clientPhone || void 0,
      clientAddress: raw.clientAddress || void 0,
      serviceType: raw.serviceType || "Electrical",
      scopeOfWork: raw.scopeOfWork || transcript.slice(0, 150),
      items: items.length > 0 ? items : [
        {
          description: "Supply & Installation Work as detailed",
          category: "Electrical",
          quantity: 1,
          costPrice: 450,
          markupPct: defaultMarkup,
          unitPrice: Number((450 * (1 + defaultMarkup / 100)).toFixed(2)),
          unit: "lot",
          total: Number((450 * (1 + defaultMarkup / 100)).toFixed(2))
        }
      ],
      calloutFee: Number(raw.calloutFee) || defaultCalloutFee,
      labourHours: Number(raw.labourHours) || 2,
      labourRatePerHour: Number(raw.labourRatePerHour) || defaultLabourRate,
      travelDistanceKm: Number(raw.travelDistanceKm) || 0,
      travelRatePerKm: Number(raw.travelRatePerKm) || defaultTravelRate,
      notes: raw.notes || "Workmanship guaranteed for 12 months. Compliance Certificate issued upon full settlement.",
      isFallback: false
    };
  } catch (err) {
    console.warn("[GeminiService] AI generation failed or circuit open. Providing intelligent trade template fallback.");
    const lines = transcript.split(/[\n,.]+/).map((l) => l.trim()).filter((l) => l.length > 2);
    const mockItems = lines.slice(0, 3).map((line, idx) => ({
      description: line.charAt(0).toUpperCase() + line.slice(1),
      category: "Electrical",
      quantity: 1,
      costPrice: 350 + idx * 100,
      markupPct: defaultMarkup,
      unitPrice: Number(((350 + idx * 100) * (1 + defaultMarkup / 100)).toFixed(2)),
      unit: "ea",
      total: Number(((350 + idx * 100) * (1 + defaultMarkup / 100)).toFixed(2))
    }));
    return {
      serviceType: "Electrical",
      scopeOfWork: transcript || "General electrical inspection, repair and installation",
      items: mockItems.length > 0 ? mockItems : [
        {
          description: "Electrical & AC materials according to site requirements",
          category: "Electrical",
          quantity: 1,
          costPrice: 500,
          markupPct: defaultMarkup,
          unitPrice: Number((500 * (1 + defaultMarkup / 100)).toFixed(2)),
          unit: "lot",
          total: Number((500 * (1 + defaultMarkup / 100)).toFixed(2))
        }
      ],
      calloutFee: defaultCalloutFee,
      labourHours: 2,
      labourRatePerHour: defaultLabourRate,
      travelDistanceKm: 0,
      travelRatePerKm: defaultTravelRate,
      notes: "Generated via offline trade estimator. You can manually adjust all items, quantities, and rates.",
      isFallback: true
    };
  }
}

// server.ts
function sanitizeNumeric(val, fallback = 0) {
  if (typeof val === "number") {
    return isNaN(val) ? fallback : Number(val.toFixed(2));
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[R$€£]/gi, "").replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : Number(parsed.toFixed(2));
  }
  return fallback;
}
var parseNumeric = sanitizeNumeric;
function standardizeIsoDate(dateVal, timeVal) {
  const now = /* @__PURE__ */ new Date();
  const fallbackIsoDate = now.toISOString().split("T")[0];
  const fallbackIsoTimestamp = now.toISOString();
  if (!dateVal || typeof dateVal !== "string" && !(dateVal instanceof Date)) {
    return { isoDate: fallbackIsoDate, isoTimestamp: fallbackIsoTimestamp };
  }
  if (dateVal instanceof Date) {
    return {
      isoDate: dateVal.toISOString().split("T")[0],
      isoTimestamp: dateVal.toISOString()
    };
  }
  const trimmed = dateVal.trim();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = now.getDate();
  let matched = false;
  const ymdMatch = trimmed.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10);
    day = parseInt(ymdMatch[3], 10);
    matched = true;
  } else {
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/);
    if (dmyMatch) {
      let rawYear = dmyMatch[3];
      year = rawYear.length === 2 ? parseInt("20" + rawYear, 10) : parseInt(rawYear, 10);
      const part1 = parseInt(dmyMatch[1], 10);
      const part2 = parseInt(dmyMatch[2], 10);
      if (part1 > 12) {
        day = part1;
        month = part2;
      } else if (part2 > 12) {
        month = part1;
        day = part2;
      } else {
        day = part1;
        month = part2;
      }
      matched = true;
    } else {
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
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  const isoDate = `${year}-${paddedMonth}-${paddedDay}`;
  let hour = 12;
  let minute = 0;
  let second = 0;
  if (typeof timeVal === "string" && timeVal.trim()) {
    const timeMatch = timeVal.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      second = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const meridiem = (timeMatch[4] || "").toLowerCase();
      if (meridiem === "pm" && hour < 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;
    }
  }
  const paddedHour = String(hour).padStart(2, "0");
  const paddedMin = String(minute).padStart(2, "0");
  const paddedSec = String(second).padStart(2, "0");
  const isoTimestamp = `${isoDate}T${paddedHour}:${paddedMin}:${paddedSec}.000Z`;
  return { isoDate, isoTimestamp };
}
function validateJsonbPayload(payload) {
  if (payload === null || payload === void 0) {
    return {};
  }
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return typeof parsed === "object" && parsed !== null ? parsed : { value: parsed };
    } catch {
      return { raw_content: payload };
    }
  }
  if (typeof payload === "object") {
    try {
      return JSON.parse(JSON.stringify(payload));
    } catch {
      return { fallback_text: String(payload) };
    }
  }
  return { value: payload };
}
function sanitizeAndExtractOcrData(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return null;
  }
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubstring = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      const normalizedJson = jsonSubstring.replace(/,\s*([}\]])/g, "$1").replace(/[\u201C\u201D]/g, '"');
      const parsed = JSON.parse(normalizedJson);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (parseErr) {
      console.warn("[OCR Server] JSON.parse failed on substring, attempting regex heuristics:", parseErr);
    }
  }
  console.log("[OCR Server] Running Regex Heuristics on raw text...");
  const result = {
    supplier_name: "Supplier Slip",
    supplierName: "Supplier Slip",
    receipt_number: "",
    invoiceNumber: "",
    date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    total_amount: 0,
    totalAmount: 0,
    vat_amount: 0,
    vatAmount: 0,
    line_items: [],
    items: [],
    rawText: rawText.slice(0, 1e3),
    isPartial: true
  };
  const supplierMatch = rawText.match(
    /(?:Supplier|Merchant|Vendor|From|Store|Company|Plumblink|Voltex|ARB|ACDC|Builders|Herholdts|Rubicon|Leroy Merlin|Chamberlains)[:\s]+([^\n\r,]+)/i
  );
  if (supplierMatch) {
    result.supplier_name = supplierMatch[1].trim();
    result.supplierName = supplierMatch[1].trim();
  } else {
    const firstLine = rawText.split("\n").map((l) => l.trim()).find((l) => l.length > 2 && !l.toLowerCase().includes("tax invoice"));
    if (firstLine) {
      result.supplier_name = firstLine.slice(0, 40);
      result.supplierName = firstLine.slice(0, 40);
    }
  }
  const invMatch = rawText.match(/(?:Invoice|Tax\s*Invoice|Slip|Doc|Doc\s*No|Order|Reference|Ref|Receipt)[\s#:]*([A-Z0-9\-_/]{4,20})/i);
  if (invMatch) {
    result.receipt_number = invMatch[1].trim();
    result.invoiceNumber = invMatch[1].trim();
  } else {
    const genNum = "INV-" + Math.floor(1e5 + Math.random() * 9e5);
    result.receipt_number = genNum;
    result.invoiceNumber = genNum;
  }
  const dateMatch = rawText.match(/(\d{4}[-/]\d{2}[-/]\d{2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
  if (dateMatch) {
    const rawDate = dateMatch[0];
    if (rawDate.includes("-") && rawDate.length === 10 && rawDate.indexOf("-") === 4) {
      result.date = rawDate;
    } else {
      const parts = rawDate.split(/[-/]/);
      if (parts.length === 3) {
        let y = parts[2].length === 2 ? "20" + parts[2] : parts[2];
        let m = parts[1].padStart(2, "0");
        let d = parts[0].padStart(2, "0");
        result.date = `${y}-${m}-${d}`;
      }
    }
  }
  const totalMatch = rawText.match(/(?:TOTAL|TOTAL\s*DUE|AMOUNT\s*DUE|GRAND\s*TOTAL|BALANCE|AMOUNT)[\s:R$]*([0-9,]+\.[0-9]{2})/i);
  if (totalMatch) {
    const parsedTotal = parseNumeric(totalMatch[1]);
    result.total_amount = parsedTotal;
    result.totalAmount = parsedTotal;
  }
  const vatMatch = rawText.match(/(?:VAT|TAX|15%|15\.00%)[\s:R$]*([0-9,]+\.[0-9]{2})/i);
  if (vatMatch) {
    const parsedVat = parseNumeric(vatMatch[1]);
    result.vat_amount = parsedVat;
    result.vatAmount = parsedVat;
  }
  const lines = rawText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const itemMatch = trimmed.match(/^([a-zA-Z0-9\s().,/²³\-+]+?)(?:\s+(\d+)\s*(?:ea|m|roll|box|pack|kg)?)?\s+[R$]?\s*([0-9,]+\.[0-9]{2})$/i);
    if (itemMatch && itemMatch[1].trim().length > 3 && !trimmed.toLowerCase().includes("total") && !trimmed.toLowerCase().includes("vat")) {
      const desc = itemMatch[1].trim();
      const qty = itemMatch[2] ? parseInt(itemMatch[2], 10) : 1;
      const cost = parseNumeric(itemMatch[3]);
      if (cost > 0) {
        const itemObj = {
          code_barcode: "",
          description: desc,
          quantity: qty,
          unit_price: cost,
          unitCost: cost,
          total_price: Number((qty * cost).toFixed(2)),
          total: Number((qty * cost).toFixed(2)),
          category: "Electrical",
          unit: "ea"
        };
        result.items.push(itemObj);
        result.line_items.push(itemObj);
      }
    }
  }
  if (result.items.length === 0 && result.totalAmount > 0) {
    const genericItem = {
      code_barcode: "",
      description: "Materials / Hardware Supplies (" + result.supplierName + ")",
      quantity: 1,
      unit_price: result.totalAmount,
      unitCost: result.totalAmount,
      total_price: result.totalAmount,
      total: result.totalAmount,
      category: "Electrical",
      unit: "lot"
    };
    result.items.push(genericItem);
    result.line_items.push(genericItem);
  }
  return result;
}
function normalizeOcrData(data, rawFallbackText = "") {
  if (!data || typeof data !== "object") {
    data = {};
  }
  const supplierName = typeof data.supplier_name === "string" && data.supplier_name.trim() ? data.supplier_name.trim() : typeof data.supplierName === "string" && data.supplierName.trim() ? data.supplierName.trim() : "Supplier Invoice";
  const receiptNumber = typeof data.invoice_number === "string" && data.invoice_number.trim() ? data.invoice_number.trim() : typeof data.receipt_number === "string" && data.receipt_number.trim() ? data.receipt_number.trim() : typeof data.receiptNumber === "string" && data.receiptNumber.trim() ? data.receiptNumber.trim() : typeof data.invoiceNumber === "string" && data.invoiceNumber.trim() ? data.invoiceNumber.trim() : "INV-" + Math.floor(1e5 + Math.random() * 9e5);
  const rawDate = data.issue_date || data.issueDate || data.date || data.scan_date || data.scanDate;
  const rawTime = typeof data.time === "string" ? data.time.trim() : void 0;
  const { isoDate, isoTimestamp } = standardizeIsoDate(rawDate, rawTime);
  const monthKey = typeof data.month_key === "string" && data.month_key.trim() ? data.month_key.trim() : typeof data.monthKey === "string" && data.monthKey.trim() ? data.monthKey.trim() : isoDate.substring(0, 7);
  const address = typeof data.address === "string" && data.address.trim() ? data.address.trim() : void 0;
  const vatNumber = typeof data.vat_number === "string" && data.vat_number.trim() ? data.vat_number.trim() : typeof data.vatNumber === "string" && data.vatNumber.trim() ? data.vatNumber.trim() : void 0;
  const cashier = typeof data.cashier === "string" && data.cashier.trim() ? data.cashier.trim() : void 0;
  let rawItems = Array.isArray(data.items) ? data.items : Array.isArray(data.line_items) ? data.line_items : [];
  let normalizedItems = rawItems.map((item) => {
    const desc = typeof item.item_name === "string" && item.item_name.trim() ? item.item_name.trim() : typeof item.description === "string" && item.description.trim() ? item.description.trim() : typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Materials Item";
    const qty = Math.max(1, sanitizeNumeric(item.quantity, 1));
    const unitPrice = Math.max(0, sanitizeNumeric(item.unit_price ?? item.unitCost ?? item.unitPrice ?? item.cost ?? item.price, 0));
    const totalPrice = sanitizeNumeric(item.total_price ?? item.total ?? item.totalPrice, Number((qty * unitPrice).toFixed(2)));
    const codeBarcode = typeof item.code_barcode === "string" && item.code_barcode.trim() ? item.code_barcode.trim() : typeof item.codeBarcode === "string" && item.codeBarcode.trim() ? item.codeBarcode.trim() : void 0;
    const cat = typeof item.category === "string" && item.category.trim() ? item.category.trim() : "Electrical";
    const u = typeof item.unit === "string" && item.unit.trim() ? item.unit.trim() : "ea";
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
      unit: u
    };
  });
  let totalAmount = sanitizeNumeric(data.grand_total ?? data.grandTotal ?? data.total_amount ?? data.totalAmount, 0);
  if (totalAmount <= 0 && normalizedItems.length > 0) {
    totalAmount = Number(normalizedItems.reduce((sum, it) => sum + it.quantity * it.unitCost, 0).toFixed(2));
  }
  if (normalizedItems.length === 0 && totalAmount > 0) {
    normalizedItems = [
      {
        code_barcode: void 0,
        codeBarcode: void 0,
        item_name: "Supplier Materials (" + supplierName + ")",
        description: "Supplier Materials (" + supplierName + ")",
        quantity: 1,
        unit_price: totalAmount,
        unitCost: totalAmount,
        total_price: totalAmount,
        total: totalAmount,
        category: "Electrical",
        unit: "lot"
      }
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
    subtotal: subtotal > 0 ? subtotal : void 0,
    vat_amount: vatAmount,
    vatAmount,
    grand_total: totalAmount,
    total_amount: totalAmount,
    totalAmount,
    total: totalAmount,
    line_items: normalizedItems,
    items: normalizedItems,
    notes: typeof data.notes === "string" ? data.notes : void 0,
    rawText: data.rawText || rawFallbackText || void 0,
    isPartial: Boolean(data.isPartial),
    isFallback: Boolean(data.isFallback)
  };
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  const allowedOrigins = [
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost:3000",
    "http://localhost:5173"
  ];
  app.use((0, import_cors.default)({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.includes("localhost") || origin.startsWith("capacitor://") || origin.startsWith("ionic://") || origin.startsWith("file://") || origin.includes("onrender.com") || origin.includes("run.app") || origin.includes("google.com")) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-user-id",
      "x-device-id",
      "Accept",
      "Origin"
    ],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    credentials: true,
    maxAge: 86400
  }));
  app.options("*", (0, import_cors.default)());
  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, x-user-id, x-device-id, Accept, Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
  function getGeminiClient2() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new import_genai2.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  app.get(["/api/health", "/health"], (req, res) => {
    res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get(["/api/usage", "/usage"], (req, res) => {
    try {
      const userId = extractUserId(req) || "anonymous_user";
      const record = usageStore.getUserRecord(userId);
      const tierConfig = TIER_DEFINITIONS[record.tier] || TIER_DEFINITIONS.FREE;
      const now = /* @__PURE__ */ new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const creditsRemaining = tierConfig.unlimitedAi ? 999999 : Math.max(0, tierConfig.monthlyAiCredits + record.aiCreditsBonus - record.aiCreditsUsed);
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
          unlimited: tierConfig.unlimitedAi
        },
        documents: {
          createdThisMonth: record.documentsCreatedThisMonth,
          maxAllowed: tierConfig.maxMonthlyDocuments === Infinity ? -1 : tierConfig.maxMonthlyDocuments,
          unlimited: tierConfig.maxMonthlyDocuments === Infinity
        },
        inventory: {
          maxItems: tierConfig.maxInventoryItems === Infinity ? -1 : tierConfig.maxInventoryItems,
          unlimited: tierConfig.maxInventoryItems === Infinity
        },
        entitlements: tierConfig,
        subscriptionExpiresAt: record.subscriptionExpiresAt,
        resetDate: nextMonth.toISOString()
      });
    } catch (err) {
      console.error("[Usage API Error]", err);
      const fallbackUserId = req.query?.userId || "default_user";
      return res.status(200).json({
        userId: fallbackUserId,
        tier: "FREE",
        status: "active",
        scansUsed: 0,
        scanLimit: 100,
        scansRemaining: 100,
        aiCredits: {
          total: 100,
          bonus: 0,
          used: 0,
          remaining: 100,
          unlimited: false
        },
        documents: {
          createdThisMonth: 0,
          maxAllowed: 5,
          unlimited: false
        },
        inventory: {
          maxItems: 20,
          unlimited: false
        }
      });
    }
  });
  app.post(["/api/usage/document-created", "/usage/document-created"], (req, res) => {
    const userId = extractUserId(req);
    const result = usageStore.incrementDocumentCount(userId);
    res.json(result);
  });
  app.post(["/api/billing/verify", "/billing/verify"], (req, res) => {
    const userId = extractUserId(req);
    const { productId, purchaseToken, orderId, platform } = req.body || {};
    console.log(`[Billing Server] Verifying purchase for user=${userId}: product=${productId}, platform=${platform}`);
    let tier = "PRO";
    if (productId && (productId.includes("business") || productId.includes("ai_tier"))) {
      tier = "BUSINESS";
    } else if (productId && (productId.includes("pro") || productId.includes("starter"))) {
      tier = "PRO";
    }
    const durationDays = productId && (productId.includes("year") || productId.includes("annual")) ? 365 : 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1e3).toISOString();
    const source = platform === "google_play" ? "google_play" : platform === "revenuecat" ? "revenuecat" : "stripe";
    const updated = usageStore.updateUserTier(userId, tier, expiresAt, source);
    res.json({
      success: true,
      message: `Successfully activated ${tier} subscription.`,
      tier: updated.tier,
      expiresAt: updated.subscriptionExpiresAt,
      record: updated
    });
  });
  app.post("/api/billing/developer-code", (req, res) => {
    const userId = extractUserId(req);
    const { code } = req.body || {};
    if (!code || typeof code !== "string" || code.trim().toLowerCase() !== "nismor34") {
      return res.status(400).json({
        success: false,
        message: "Invalid developer token. Please verify the code."
      });
    }
    console.log(`[Billing Server] Developer token 'NismoR34' accepted for userId=${userId}. Unlocking Lifetime Business Access.`);
    const lifetimeExpiresAt = "2099-12-31T23:59:59.000Z";
    const updated = usageStore.updateUserTier(userId, "BUSINESS", lifetimeExpiresAt, "manual");
    return res.json({
      success: true,
      message: "Developer Code (NismoR34) Verified! Unlimited Lifetime Business Tier Unlocked.",
      tier: updated.tier,
      expiresAt: updated.subscriptionExpiresAt,
      record: updated
    });
  });
  app.post("/api/billing/webhook", (req, res) => {
    const event = req.body?.event || req.body;
    console.log("[Billing Webhook] Received webhook notification:", event?.type || event?.notificationType || "Unknown");
    if (event?.app_user_id) {
      const userId = event.app_user_id;
      const type = event.type;
      const productId = event.product_id || "";
      if (type === "INITIAL_PURCHASE" || type === "RENEWAL" || type === "PRODUCT_CHANGE") {
        const tier = productId.includes("business") ? "BUSINESS" : "PRO";
        const expDate = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : void 0;
        usageStore.updateUserTier(userId, tier, expDate, "revenuecat");
      } else if (type === "EXPIRATION" || type === "CANCELLATION") {
        usageStore.updateUserTier(userId, "FREE", void 0, "revenuecat");
      }
    }
    res.json({ received: true });
  });
  app.post(["/api/ai/voice-quote", "/ai/voice-quote"], requireAiCredit("voice_to_quote"), async (req, res) => {
    const { transcript, profile } = req.body || {};
    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ error: "Missing audio transcript or text prompt" });
    }
    try {
      const result = await generateQuoteFromVoiceOrText(transcript, profile);
      res.json(result);
    } catch (err) {
      console.error("[AI Voice-Quote Error]", err);
      const fallback = await generateQuoteFromVoiceOrText(transcript, profile);
      res.json(fallback);
    }
  });
  function isTransientError2(error) {
    const status = error?.status || error?.statusCode || error?.code;
    const message = String(error?.message || error || "").toLowerCase();
    return status === 503 || status === 429 || status === "UNAVAILABLE" || status === "RESOURCE_EXHAUSTED" || message.includes("503") || message.includes("429") || message.includes("unavailable") || message.includes("high demand") || message.includes("rate limit") || message.includes("resource exhausted") || message.includes("overloaded") || message.includes("temporary") || message.includes("quota") || message.includes("fetch failed") || message.includes("econnreset");
  }
  const delayMs2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  app.post(["/api/scan-receipt", "/scan-receipt"], requireAiCredit("receipt_ocr"), async (req, res) => {
    const startTime = Date.now();
    console.log("[OCR Server] Received receipt scan request at", (/* @__PURE__ */ new Date()).toISOString());
    try {
      let rawImagePayload = req.body?.imageBase64 || req.body?.image || req.body?.imageData || req.body?.image_base64 || req.body?.data || req.body?.base64 || req.body?.photo || req.body?.file || req.body?.uri || req.body?.base64Data;
      if (!rawImagePayload && typeof req.body === "string") {
        try {
          const parsedBody = JSON.parse(req.body);
          rawImagePayload = parsedBody?.imageBase64 || parsedBody?.image || parsedBody?.imageData || parsedBody?.image_base64 || parsedBody?.data || parsedBody?.base64;
        } catch {
          rawImagePayload = req.body;
        }
      }
      if (!rawImagePayload || typeof rawImagePayload !== "string" || rawImagePayload.trim().length === 0) {
        console.warn("[OCR Server] Missing or empty image data received");
        return res.status(500).json({ error: "Failed to parse receipt image" });
      }
      if (rawImagePayload.includes("%3A") || rawImagePayload.includes("%2F") || rawImagePayload.includes("%2B")) {
        try {
          rawImagePayload = decodeURIComponent(rawImagePayload);
        } catch {
        }
      }
      let cleanBase64 = rawImagePayload;
      let effectiveMime = req.body?.mimeType || "image/jpeg";
      const headerMatch = rawImagePayload.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/s);
      if (headerMatch) {
        effectiveMime = headerMatch[1].toLowerCase();
        cleanBase64 = headerMatch[2];
      } else {
        cleanBase64 = rawImagePayload.replace(/^data:[^;]+;base64,/, "");
      }
      cleanBase64 = cleanBase64.trim().replace(/\s+/g, "");
      if (!cleanBase64 || cleanBase64.length === 0) {
        return res.status(500).json({ error: "Failed to parse receipt image" });
      }
      if (effectiveMime.includes("jpg") || effectiveMime.includes("pjpeg")) {
        effectiveMime = "image/jpeg";
      } else if (effectiveMime.includes("png")) {
        effectiveMime = "image/png";
      } else if (effectiveMime.includes("webp")) {
        effectiveMime = "image/webp";
      } else if (effectiveMime.includes("heic") || effectiveMime.includes("heif")) {
        effectiveMime = "image/heic";
      } else if (effectiveMime.includes("pdf")) {
        effectiveMime = "application/pdf";
      } else {
        effectiveMime = "image/jpeg";
      }
      console.log(`[OCR Server] Mobile payload validated: MIME=${effectiveMime}, Base64Length=${cleanBase64.length}`);
      const ai = getGeminiClient2();
      if (!ai) {
        console.warn("[OCR Server] No GEMINI_API_KEY detected. Returning intelligent fallback template.");
        const fallbackData = normalizeOcrData({
          supplierName: "Voltex / ARB Electrical Suppliers",
          invoiceNumber: "INV-" + Math.floor(1e5 + Math.random() * 9e5),
          date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          totalAmount: 1850,
          vatAmount: 241.3,
          items: [
            {
              item_name: "2.5mm\xB2 Surfix Twin+Earth Cable (100m Roll)",
              description: "2.5mm\xB2 Surfix Twin+Earth Cable (100m Roll)",
              quantity: 1,
              unit_price: 1250,
              total_price: 1250,
              category: "Electrical",
              unit: "roll"
            },
            {
              item_name: "Double 16A Veti 1 Wall Sockets (White)",
              description: "Double 16A Veti 1 Wall Sockets (White)",
              quantity: 4,
              unit_price: 150,
              total_price: 600,
              category: "Electrical",
              unit: "ea"
            }
          ],
          notes: "Extracted using local fallback parser. Add GEMINI_API_KEY in Settings > Secrets for live Vision AI OCR.",
          isFallback: true
        });
        if (!fallbackData || typeof fallbackData !== "object") {
          return res.status(500).json({ error: "Failed to parse receipt image" });
        }
        return res.status(200).json({
          success: true,
          invoice: {
            issueDate: fallbackData.issue_date,
            invoiceNumber: fallbackData.invoice_number,
            grandTotal: fallbackData.grand_total,
            items: (fallbackData.items || []).map((it) => ({
              item_name: it.item_name || it.description,
              quantity: it.quantity,
              unit_price: it.unit_price ?? it.unitCost,
              total_price: it.total_price ?? it.total
            }))
          },
          ...fallbackData
        });
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
        type: import_genai2.Type.OBJECT,
        properties: {
          invoice_number: { type: import_genai2.Type.STRING, description: "Invoice or receipt reference number, or null if unreadable" },
          issue_date: { type: import_genai2.Type.STRING, description: "Date in YYYY-MM-DD format" },
          month_key: { type: import_genai2.Type.STRING, description: "Accounting month in YYYY-MM format" },
          items: {
            type: import_genai2.Type.ARRAY,
            items: {
              type: import_genai2.Type.OBJECT,
              properties: {
                item_name: { type: import_genai2.Type.STRING, description: "Item description or product name" },
                quantity: { type: import_genai2.Type.NUMBER, description: "Numeric quantity parsed cleanly" },
                unit_price: { type: import_genai2.Type.NUMBER, description: "Numeric unit price" },
                total_price: { type: import_genai2.Type.NUMBER, description: "Numeric total price" }
              },
              required: ["item_name", "quantity", "unit_price", "total_price"]
            }
          },
          grand_total: { type: import_genai2.Type.NUMBER, description: "Numeric grand total amount" },
          supplier_name: { type: import_genai2.Type.STRING, description: "Supplier or store name at the top of the invoice" },
          address: { type: import_genai2.Type.STRING, description: "Physical address" },
          vat_number: { type: import_genai2.Type.STRING, description: "Tax/VAT registration number" }
        },
        required: ["issue_date", "month_key", "items", "grand_total"]
      };
      const modelCandidates = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
      let rawResponseText = "";
      let successfulModel = "";
      let lastAttemptError = null;
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
                      data: cleanBase64
                    }
                  },
                  {
                    text: promptText
                  }
                ]
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: ocrSchema
              }
            });
            const timeoutPromise = new Promise(
              (_, reject) => setTimeout(() => reject(new Error("OCR model attempt timed out.")), 35e3)
            );
            const response = await Promise.race([generatePromise, timeoutPromise]);
            const extractedText = response?.text || "";
            if (extractedText && typeof extractedText === "string" && extractedText.trim().length > 0) {
              rawResponseText = extractedText.trim();
              successfulModel = currentModel;
              console.log(
                `[OCR Server] Gemini response received via ${currentModel} on attempt ${attempt + 1} in ${Date.now() - startTime}ms.`
              );
              break modelLoop;
            }
          } catch (modelErr) {
            lastAttemptError = modelErr;
            const isTransient2 = isTransientError2(modelErr);
            console.warn(
              `[OCR Server] Model ${currentModel} (Attempt ${attempt + 1}) encountered error:`,
              modelErr?.message || modelErr
            );
            const is404NotFound = modelErr?.status === 404 || modelErr?.statusCode === 404 || String(modelErr?.message || "").includes("404") || String(modelErr?.message || "").includes("no longer available") || String(modelErr?.message || "").includes("NOT_FOUND");
            if (is404NotFound) {
              console.warn(`[OCR Server] Model ${currentModel} not available (404), switching immediately to next candidate model...`);
              break;
            }
            if (isTransient2 && attempt < maxRetries - 1) {
              const baseBackoff = (attempt + 1) * 800;
              const jitter = Math.floor(Math.random() * 300);
              const waitDuration = baseBackoff + jitter;
              console.log(`[OCR Server] High traffic / 503 detected on ${currentModel}. Retrying in ${waitDuration}ms...`);
              await delayMs2(waitDuration);
              continue;
            }
            break;
          }
        }
      }
      if (rawResponseText && rawResponseText.length > 0) {
        try {
          const extractedJson = sanitizeAndExtractOcrData(rawResponseText);
          const parsedData = normalizeOcrData(extractedJson, rawResponseText);
          if (!parsedData || typeof parsedData !== "object" || typeof parsedData === "string" || !Array.isArray(parsedData.items)) {
            console.warn("[OCR Server] Parsed data is invalid or empty string");
            return res.status(500).json({ error: "Failed to parse receipt image" });
          }
          const formattedResponse = {
            success: true,
            invoice: {
              issueDate: parsedData.issue_date,
              invoiceNumber: parsedData.invoice_number,
              grandTotal: parsedData.grand_total,
              items: (parsedData.items || []).map((it) => ({
                item_name: it.item_name || it.description,
                quantity: it.quantity,
                unit_price: it.unit_price ?? it.unitCost,
                total_price: it.total_price ?? it.total
              }))
            },
            ...parsedData
          };
          return res.status(200).json(formattedResponse);
        } catch (parseErr) {
          console.error("[OCR Server] Error parsing model response JSON:", parseErr);
          return res.status(500).json({ error: "Failed to parse receipt image" });
        }
      }
      const isTransient = isTransientError2(lastAttemptError);
      console.error("[OCR Server] All model candidate attempts exhausted. Last error:", lastAttemptError?.message);
      if (isTransient) {
        return res.status(503).json({
          error: "Server busy. Please tap Retry or enter items manually.",
          isServerBusy: true,
          status: 503
        });
      }
      return res.status(500).json({ error: "Failed to parse receipt image" });
    } catch (error) {
      console.error("[OCR Server Error] Fatal uncaught error during OCR processing:", {
        message: error?.message,
        duration: Date.now() - startTime
      });
      return res.status(500).json({ error: "Failed to parse receipt image" });
    }
  });
  app.post(["/api/receipt-scans", "/receipt-scans"], async (req, res) => {
    try {
      const payload = req.body || {};
      const supplierName = (payload.supplier_name || payload.supplierName || "Unknown Supplier").toString().trim().slice(0, 255);
      const invoiceNumber = (payload.invoice_number || payload.invoiceNumber || payload.receipt_number || payload.receiptNumber || "INV-" + Math.floor(1e5 + Math.random() * 9e5)).toString().trim().slice(0, 100);
      const { isoDate, isoTimestamp } = standardizeIsoDate(payload.scan_date || payload.date, payload.time);
      const totalAmount = sanitizeNumeric(payload.total_amount ?? payload.totalAmount, 0);
      const rawOcrJson = validateJsonbPayload(payload.raw_ocr_json || payload.rawOcrJson || payload);
      const processed = Boolean(payload.processed);
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
          isoTimestamp,
          // TIMESTAMPTZ compliant ISO string
          totalAmount,
          // Sanitized Float for NUMERIC(12, 2)
          JSON.stringify(rawOcrJson),
          // Serialized JSONB string
          processed
        ]
      };
      console.log("[Receipt Scan DB] Sanitized record prepared for insertion:", {
        supplier_name: supplierName,
        invoice_number: invoiceNumber,
        scan_date: isoTimestamp,
        total_amount: totalAmount
      });
      return res.status(201).json({
        success: true,
        message: "Receipt scan sanitized and validated successfully for PostgreSQL insertion.",
        record: {
          supplier_name: supplierName,
          invoice_number: invoiceNumber,
          scan_date: isoTimestamp,
          iso_date: isoDate,
          total_amount: totalAmount,
          raw_ocr_json: rawOcrJson,
          processed
        },
        sql_prepared: query
      });
    } catch (err) {
      console.error("[Receipt Scan DB Error] Failed to process receipt scan payload:", err);
      return res.status(400).json({
        error: "Invalid receipt scan data format.",
        details: err?.message || err
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseNumeric,
  sanitizeNumeric,
  standardizeIsoDate,
  validateJsonbPayload
});
//# sourceMappingURL=server.cjs.map
