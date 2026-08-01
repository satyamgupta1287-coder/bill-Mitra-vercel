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
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
Extract the following details from this invoice/bill image and return them as a JSON object (without any markdown formatting):
- supplierName: string
- invoiceNumber: string
- purchaseDate: string (YYYY-MM-DD format, or leave empty if not found)
- items: Array of objects, each containing:
  - itemName: string
  - hsnSacCode: string
  - quantity: number
  - freeQuantity: number
  - purchaseRate: number
  - mrp: number
  - gstPercentage: number
  - batchNumber: string
  - expiryDate: string
  - manufacturer: string
  - packSize: string

Only return the JSON. No other text.`;

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
      res.status(500).json({ error: error.message || 'Error parsing invoice' });
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
