import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // Handle CORS preflight if necessary
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables.' });
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
    if (text.startsWith('```json')) {
      text = text.substring(7, text.length - 3);
    } else if (text.startsWith('```')) {
      text = text.substring(3, text.length - 3);
    }

    const data = JSON.parse(text);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error parsing invoice:', error);
    return res.status(500).json({ error: error.message || 'Error parsing invoice' });
  }
}
