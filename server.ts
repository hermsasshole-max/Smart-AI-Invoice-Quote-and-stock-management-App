import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Support high-resolution camera photo uploads for invoice OCR
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    company: "Harrys Aircon Electrical and Solar Services Pty.Ltd",
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Endpoint to scan and parse supplier invoices (Voltex, ARB, ACDC, Metraclark, Plumblink, etc.)
app.post("/api/scan-invoice", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", supplierHint } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 in request body" });
    }

    // Clean base64 string if it has data URL prefix
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");

    const ai = getGeminiClient();

    if (!ai) {
      // Return structured fallback for preview when API key is not yet set
      console.warn("GEMINI_API_KEY not configured, using structured fallback parser");
      return res.json({
        success: true,
        isFallback: true,
        data: {
          supplierName: supplierHint || "Voltex Electrical Wholesalers",
          invoiceNumber: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
          invoiceDate: new Date().toISOString().split("T")[0],
          vatNumber: "4590123892",
          items: [
            {
              sku: "VOLT-CBL-2.5-SURF",
              description: "2.5mm² Surfix Flat Cable with Earth (100m Roll)",
              quantity: 2,
              unit: "roll",
              unitCostPrice: 1450.0,
              lineTotal: 2900.0,
              vatAmount: 435.0,
              category: "Electrical",
            },
            {
              sku: "CBI-MCB-20A-1P",
              description: "CBI Din-Rail Circuit Breaker 20A Single Pole 3kA",
              quantity: 6,
              unit: "ea",
              unitCostPrice: 78.5,
              lineTotal: 471.0,
              vatAmount: 70.65,
              category: "Electrical",
            },
            {
              sku: "CBI-EL-63A-30MA",
              description: "CBI Earth Leakage Main Unit 63A 30mA Single Phase",
              quantity: 1,
              unit: "ea",
              unitCostPrice: 580.0,
              lineTotal: 580.0,
              vatAmount: 87.0,
              category: "Electrical",
            },
            {
              sku: "WTR-ISOL-32A-2P",
              description: "Weatherproof Isolator Switch 32A Double Pole IP65",
              quantity: 2,
              unit: "ea",
              unitCostPrice: 135.0,
              lineTotal: 270.0,
              vatAmount: 40.5,
              category: "Electrical",
            },
          ],
          subtotal: 4221.0,
          vatTotal: 633.15,
          grandTotal: 4854.15,
          notes: "Auto-extracted simulated supplier invoice data. Attach Gemini API key for live optical OCR.",
        },
      });
    }

    const promptText = `
You are an expert AI document scanner for South African technical trade suppliers (such as Voltex, ARB Electrical, ACDC Dynamics, Metraclark HVAC&R, Plumblink, Herholdts, Rubicon).
Parse this supplier invoice / delivery note image into accurate structured JSON.

Rules:
1. Extract supplier name (e.g. Voltex, ARB, ACDC, Metraclark, etc.), invoice or receipt number, invoice date (YYYY-MM-DD), supplier VAT registration if visible.
2. Extract all line items:
   - SKU / Item code / Barcode
   - Exact item description
   - Quantity (number)
   - Unit of measurement (ea, m, roll, kg, box, set, pair)
   - Unit cost price in ZAR (exclusive of VAT if itemized separately, or specify unit cost)
   - Line total amount (excl VAT)
   - VAT amount for line (or calculate 15% if standard SA VAT)
   - Suggested technical category: "Electrical" | "HVAC" | "Solar" | "Security" | "Consumables"
3. Extract subtotal, VAT amount, and grand total.
4. If values are blurry, make the best sensible estimate for a South African trade supplier invoice.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplierName: { type: Type.STRING, description: "Supplier company name" },
            invoiceNumber: { type: Type.STRING, description: "Supplier invoice number" },
            invoiceDate: { type: Type.STRING, description: "Invoice date in YYYY-MM-DD format" },
            vatNumber: { type: Type.STRING, description: "Supplier VAT registration number if found" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sku: { type: Type.STRING, description: "Item code, part number or barcode" },
                  description: { type: Type.STRING, description: "Detailed item description" },
                  quantity: { type: Type.NUMBER, description: "Quantity invoiced" },
                  unit: { type: Type.STRING, description: "Unit of measure: ea, m, roll, kg, box, set" },
                  unitCostPrice: { type: Type.NUMBER, description: "Unit cost price in ZAR before VAT" },
                  lineTotal: { type: Type.NUMBER, description: "Total line cost before VAT" },
                  vatAmount: { type: Type.NUMBER, description: "VAT amount for this line item" },
                  category: {
                    type: Type.STRING,
                    description: "Category: Electrical, HVAC, Solar, Security, Consumables",
                  },
                },
                required: ["description", "quantity", "unitCostPrice", "lineTotal"],
              },
            },
            subtotal: { type: Type.NUMBER, description: "Subtotal before VAT in ZAR" },
            vatTotal: { type: Type.NUMBER, description: "Total 15% VAT in ZAR" },
            grandTotal: { type: Type.NUMBER, description: "Grand total including VAT in ZAR" },
            notes: { type: Type.STRING, description: "Any special invoice notes or payment terms" },
          },
          required: ["supplierName", "items", "grandTotal"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No text response received from Gemini model.");
    }

    const parsedData = JSON.parse(text);

    return res.json({
      success: true,
      isFallback: false,
      data: parsedData,
    });
  } catch (error: any) {
    console.error("Error in /api/scan-invoice:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to parse invoice with Gemini Vision OCR",
    });
  }
});

// Setup Vite development server or production static serving
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Harrys Aircon Electrical & Solar server running on http://0.0.0.0:${PORT}`);
  });
}

start();
