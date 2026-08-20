import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { createServer as createViteServer } from 'vite';

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

  // Receipt & Supplier Invoice OCR API
  app.post('/api/scan-receipt', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        // Fallback extraction if API key is not configured
        return res.json({
          supplierName: 'Voltex / ARB Electrical Suppliers',
          invoiceNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
          date: new Date().toISOString().split('T')[0],
          totalAmount: 1850.00,
          vatAmount: 241.30,
          items: [
            {
              description: '2.5mm² Surfix Twin+Earth Cable (100m)',
              quantity: 1,
              unitCost: 1250.00,
              category: 'Electrical Wiring',
              unit: 'roll',
            },
            {
              description: 'Double 16A Veti 1 Wall Sockets (White)',
              quantity: 4,
              unitCost: 150.00,
              category: 'Plugs & Switches',
              unit: 'ea',
            },
          ],
          notes: 'Extracted using local fallback parser (Add GEMINI_API_KEY for live AI OCR).',
        });
      }

      // Clean base64 string
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `Analyze this South African electrical / HVAC / solar supplier receipt or invoice (e.g. Voltex, ARB, ACDC Express, Plumblink, Builders, Herholdts, Rubicon, etc.).
Extract all purchased line items with descriptions, quantities, unit prices (excl VAT or cost), category, supplier name, invoice/receipt number, date (YYYY-MM-DD), and total amount in ZAR.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              supplierName: { type: Type.STRING, description: 'Name of the supplier or merchant' },
              invoiceNumber: { type: Type.STRING, description: 'Invoice number or slip reference' },
              date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
              totalAmount: { type: Type.NUMBER, description: 'Total Rand amount paid on slip' },
              vatAmount: { type: Type.NUMBER, description: 'VAT amount in ZAR if present' },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING, description: 'Item description' },
                    quantity: { type: Type.NUMBER, description: 'Quantity purchased' },
                    unitCost: { type: Type.NUMBER, description: 'Unit cost price in ZAR' },
                    category: { type: Type.STRING, description: 'Category (Electrical, HVAC, Solar, Security, Consumables)' },
                    unit: { type: Type.STRING, description: 'Unit of measure (ea, m, roll, pack, box, kg)' },
                  },
                  required: ['description', 'quantity', 'unitCost'],
                },
              },
              notes: { type: Type.STRING, description: 'Any extra details or remarks' },
            },
            required: ['supplierName', 'items', 'totalAmount'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch (error: any) {
      console.error('OCR scanning error:', error);
      return res.status(500).json({
        error: error?.message || 'Failed to process receipt with Gemini OCR.',
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

