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
Extract invoice details from this pharma bill image and return a JSON object with NO markdown formatting:

{
  "supplierName": "string (e.g. SARASWATI PHARMA)",
  "supplierGstin": "string",
  "invoiceNumber": "string (e.g. 00659)",
  "purchaseDate": "YYYY-MM-DD",
  "tradeDiscountPercent": number (e.g. 6.00 if 'Dis%' or 'Less Discount' column/field is 6.00%),
  "netPayableAmount": number (The final Net Payable / Grand Total at bottom right, e.g. 5781.00),
  "items": [
    {
      "itemName": "string (Product Name, e.g. HAEMOKIND-GOLD)",
      "manufacturer": "string (Mfd Name / Brand, e.g. SIRMOUR)",
      "batchNumber": "string (Batch No, e.g. ALZAL018)",
      "expiryDate": "string (MM/YY, e.g. 08/27)",
      "packSize": "string (Packing, e.g. 1X300ML)",
      "mrp": number (MRP per unit, e.g. 280.75),
      "quantity": number (Paid quantity. If Lot is 9+1 and Qty+FR is 10, paid qty is 9, free qty is 1. If no lot split, use Qty),
      "freeQuantity": number (Free/Bonus scheme qty, e.g. 1 if 9+1, else 0),
      "printedRate": number (Gross rate printed on the line before discount, e.g. 76.80),
      "discountPercent": number (Line trade discount Dis%, e.g. 6.00),
      "purchaseRate": number (CRITICAL: Net pre-tax purchase rate AFTER trade discount per unit! Formula: printedRate * (1 - discountPercent/100). E.g. 76.80 * 0.94 = 72.19),
      "gstPercentage": number (Total GST %. If 2.5+2.5, it is 5. If 0+0, it is 0. If 6+6, it is 12),
      "lineTotal": number (Final total amount for this item line including discount and tax)
    }
  ]
}

CRITICAL ACCURACY INSTRUCTIONS FOR PHARMA BILLS:
1. Extract ALL line items on the bill carefully (do not miss any row).
2. Check if there is a trade discount column "Dis%" or overall "Less Discount" at the bottom (e.g. 6.00%).
3. Calculate 'purchaseRate' as the NET pre-tax rate after discount = printedRate * (1 - Dis%/100).
4. Ensure the sum of (quantity * purchaseRate * (1 + gstPercentage/100)) across all items equals the 'netPayableAmount' (Net Payable) on the bill.
5. Return ONLY valid raw JSON with no backticks or markdown wrapper.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
            ]
          }
        ]
      });

      let text = response.text;
      if (!text) {
         return res.status(500).json({ error: 'Failed to extract data from image' });
      }

      text = text.trim();
      if (text.startsWith('\`\`\`json')) {
        text = text.substring(7, text.length - 3);
      } else if (text.startsWith('\`\`\`')) {
        text = text.substring(3, text.length - 3);
      }

      const data = JSON.parse(text);
      res.json(data);
    } catch (error: any) {
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
