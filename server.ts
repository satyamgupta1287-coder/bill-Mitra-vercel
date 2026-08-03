import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/parse-invoice', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'No image provided' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({ error: 'GEMINI_API_KEY is missing. Please set your Gemini API Key in platform settings.' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
You are an expert Indian B2B Pharmaceutical Invoice OCR parser.
Extract invoice details from this pharma bill image.

CRITICAL ACCURACY INSTRUCTIONS FOR PHARMA B2B INVOICES:
1. Extract ALL line items on the bill carefully (do not miss any row).
2. The 'Rate' column on the bill is printedRate (gross rate BEFORE discount, e.g. 76.80).
3. READ DISCOUNT PER ROW: Look closely at the column labeled 'Dis%' or 'Dis %'. This is usually a SEPARATE column from GST% and is often the SAME value for every row on the invoice (e.g. 6.00 for every single item). If you see 6.00 in the Dis% column for one row, apply that same logic to EVERY row that shows it — do not default to 0 unless the column is genuinely blank or literally "0".
4. Do not confuse Dis% with GST%. GST% is often shown split as "2.5+2.5" (CGST+SGST) — add both halves together for gstPercentage (e.g. 2.5+2.5 = 5, 0+0 = 0, 6+6 = 12).
5. QUANTITY & FREE ITEMS: Look at 'Qty+FR' and the 'Amount' column. If the printed Amount equals (Qty+FR) * Rate (e.g. 10 * 67.39 = 673.90), set "quantity" to the full Qty+FR value and "freeQuantity" to 0. Ignore "Lot (9+1)" style text if Amount is based on the full quantity.
6. Calculate net pre-tax 'purchaseRate' = printedRate * (1 - discountPercent/100).
7. VERIFY GRAND TOTAL:
   - Gross Subtotal = sum(quantity * printedRate)
   - Total Discount = sum(quantity * printedRate * discountPercent / 100)
   - Total Taxable = Gross Subtotal - Total Discount
   - Total GST = sum(Taxable_i * gstPercentage_i / 100)
   - Calculated Net Total = Total Taxable + Total GST
   - Compare with 'Net Payable' printed on the bill.
   - Set 'billAdjustment' = Number((netPayableAmount - Calculated Net Total).toFixed(2)) to absorb any rounding difference so the bill matches exactly.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              supplierName: { type: 'string' },
              supplierGstin: { type: 'string' },
              invoiceNumber: { type: 'string' },
              purchaseDate: { type: 'string' },
              tradeDiscountPercent: { type: 'number' },
              billAdjustment: { type: 'number' },
              netPayableAmount: { type: 'number' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    itemName: { type: 'string' },
                    manufacturer: { type: 'string' },
                    batchNumber: { type: 'string' },
                    expiryDate: { type: 'string' },
                    packSize: { type: 'string' },
                    mrp: { type: 'number' },
                    quantity: { type: 'number' },
                    freeQuantity: { type: 'number' },
                    printedRate: { type: 'number' },
                    discountPercent: { type: 'number' },
                    purchaseRate: { type: 'number' },
                    gstPercentage: { type: 'number' },
                    lineTotal: { type: 'number' }
                  },
                  required: [
                    'itemName', 'batchNumber', 'expiryDate', 'quantity',
                    'freeQuantity', 'printedRate', 'discountPercent',
                    'purchaseRate', 'gstPercentage', 'lineTotal'
                  ]
                }
              }
            },
            required: ['items', 'netPayableAmount']
          }
        }
      });

      let text = response.text;
      if (!text) {
        return res.status(500).json({ error: 'Failed to extract data from image' });
      }

      text = text.trim();
      // Safety net — structured output normally returns raw JSON, but strip just in case
      if (text.startsWith('```json')) {
        text = text.slice(7, text.endsWith('```') ? -3 : undefined);
      } else if (text.startsWith('```')) {
        text = text.slice(3, text.endsWith('```') ? -3 : undefined);
      }

      const data = JSON.parse(text);
      res.json(data);
    } catch (error) {
      console.error('Error parsing invoice:', error);
      let errMsg = error.message || 'Error parsing invoice';
      if (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID')) {
        errMsg = 'The Gemini API key configured in environment settings is invalid. Please update GEMINI_API_KEY with a valid key.';
      }
      res.status(500).json({ error: errMsg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
