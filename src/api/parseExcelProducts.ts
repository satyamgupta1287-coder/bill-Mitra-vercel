import { z } from 'zod';
import { createEndpoint } from 'zite-integrations-backend-sdk';
import * as XLSX from 'xlsx';

const HEADER_MAP: Record<string, string> = {
  'product name': 'productName',
  'name of the product': 'productName',
  'item name': 'productName',
  'product': 'productName',
  'dawa name': 'productName',
  'medicine': 'productName',
  'description': 'productName',
  'particulars': 'productName',
  'name': 'productName',

  'hsn/sac code': 'hsnSacCode',
  'hsn code': 'hsnSacCode',
  'hsncode': 'hsnSacCode',
  'hsn': 'hsnSacCode',
  'item code': 'hsnSacCode',
  'sac': 'hsnSacCode',

  'category': 'category',
  'unit': 'unit',
  'pack size': 'packSize',
  'pack': 'packSize',
  'packing': 'packSize',

  'unit price': 'unitPrice',
  'selling rate': 'unitPrice',
  'sale rate': 'unitPrice',
  'sale price': 'unitPrice',
  'rate': 'unitPrice',
  'price': 'unitPrice',
  's.rate': 'unitPrice',

  'purchase rate': 'purchaseRate',
  'cost rate': 'purchaseRate',
  'pur rate': 'purchaseRate',
  'pur. rate': 'purchaseRate',
  'p.rate': 'purchaseRate',
  'cost price': 'purchaseRate',

  'gst %': 'gstPercentage',
  'gst': 'gstPercentage',
  'gst percentage': 'gstPercentage',
  'gst%': 'gstPercentage',
  'tax%': 'gstPercentage',
  'tax %': 'gstPercentage',

  'stock qty': 'stockQuantity',
  'stock': 'stockQuantity',
  'stock quantity': 'stockQuantity',
  'qty': 'stockQuantity',
  'quantity': 'stockQuantity',
  'cl. qnty.': 'stockQuantity',
  'cl. qnty': 'stockQuantity',
  'cl.qnty.': 'stockQuantity',
  'closing quantity': 'stockQuantity',
  'closing qty': 'stockQuantity',
  'opening quantity': 'stockQuantity',

  'manufacturer': 'manufacturer',
  'company': 'manufacturer',
  'brand': 'manufacturer',
  'mfg': 'manufacturer',
  'mfg.': 'manufacturer',

  'mrp': 'mrp',
  'm.r.p.': 'mrp',
  'm.r.p': 'mrp',

  'batch': 'batch',
  'expiry': 'expiry',
};

const NUM_FIELDS = ['unitPrice', 'purchaseRate', 'gstPercentage', 'stockQuantity', 'mrp'];

function parseNum(raw: any): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'number') return isNaN(raw) ? undefined : raw;
  const str = String(raw).trim();
  if (!str) return undefined;
  const cleaned = str.replace(/[A-Za-z]+\s*$/, '').replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return isNaN(num) ? undefined : num;
}

function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const headers = rows[i].map(h => String(h || '').toLowerCase().trim());
    const mapped = headers.map(h => HEADER_MAP[h] || null).filter(Boolean);
    if (mapped.length >= 2) return i;
    if (mapped.includes('productName')) return i;
  }
  return 0;
}

function processRows(rows: string[][]) {
  if (rows.length < 2) return { products: [] as any[], errors: ['File must have a header row and at least one data row.'] };

  const headerIdx = findHeaderRowIndex(rows);
  const headerRow = rows[headerIdx];
  const headers = headerRow.map(h => String(h || '').toLowerCase().trim());
  const mappedHeaders = headers.map(h => HEADER_MAP[h] || null);

  if (!mappedHeaders.includes('productName')) {
    const foundHeaders = headerRow.map(h => String(h || '').trim()).filter(Boolean);
    return {
      products: [] as any[],
      errors: ['"Product Name" / "Item Name" column not found. Detected headers: ' + foundHeaders.join(', ')]
    };
  }

  const products: any[] = [];
  const errors: string[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const vals = rows[i];
    if (!vals || vals.every(v => !v || !String(v).trim())) continue;

    const firstVal = String(vals[0] || '').trim().toLowerCase();
    if (firstVal.startsWith('total') || firstVal.startsWith('grand total')) continue;

    const obj: any = {};
    mappedHeaders.forEach((key, idx) => {
      if (!key) return;
      const rawVal = vals[idx];
      if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') return;

      if (key === 'batch' || key === 'expiry') return;

      if (NUM_FIELDS.includes(key)) {
        const num = parseNum(rawVal);
        if (num !== undefined) obj[key] = num;
      } else {
        obj[key] = String(rawVal).trim();
      }
    });

    if (!obj.productName) continue;

    if (obj.manufacturer && obj.manufacturer === obj.productName) {
      delete obj.manufacturer;
    }

    if (obj.stockQuantity !== undefined && obj.stockQuantity < 0) {
      delete obj.stockQuantity;
    }

    // Default GST to 12 if missing or 0
    if (obj.gstPercentage === undefined) {
      obj.gstPercentage = 12;
    }

    products.push(obj);
  }

  // Deduplicate products
  const grouped = new Map<string, any[]>();
  for (const p of products) {
    const key = p.productName.toLowerCase().trim();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  const dedupedProducts: any[] = [];
  for (const [, items] of grouped) {
    if (items.length === 1) {
      dedupedProducts.push(items[0]);
    } else {
      items.sort((a, b) => Object.keys(b).length - Object.keys(a).length);
      const merged: any = {};
      for (const item of items) {
        for (const [k, v] of Object.entries(item)) {
          if (merged[k] === undefined || merged[k] === null || merged[k] === '') {
            merged[k] = v;
          }
        }
      }
      dedupedProducts.push(merged);
    }
  }

  return { products: dedupedProducts, errors };
}

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    fileUrl: z.string().optional(),
    fileBase64: z.string().optional(),
    fileBuffer: z.array(z.number()).optional(),
    fileType: z.enum(['csv', 'xlsx', 'xls']).optional(),
    fileName: z.string().optional(),
  }),
  outputSchema: z.object({
    products: z.array(z.any()),
    errors: z.array(z.string()),
  }),
  execute: async ({ input }) => {
    try {
      let buffer: ArrayBuffer | Buffer | Uint8Array;

      if (input.fileBuffer && Array.isArray(input.fileBuffer)) {
        buffer = new Uint8Array(input.fileBuffer);
      } else if (input.fileBase64) {
        const base64Data = input.fileBase64.replace(/^data:.*?;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else if (input.fileUrl) {
        const response = await fetch(input.fileUrl);
        if (!response.ok) {
          return { products: [], errors: ['Failed to download file. Status: ' + response.status] };
        }
        buffer = await response.arrayBuffer();
      } else {
        return { products: [], errors: ['No file data provided.'] };
      }

      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellText: false });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return { products: [], errors: ['Excel file has no sheets.'] };
      }

      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

      const stringRows: string[][] = rawRows.map(row =>
        Array.isArray(row) ? row.map(cell => (cell !== null && cell !== undefined ? String(cell) : '')) : []
      );

      return processRows(stringRows);
    } catch (err: any) {
      console.error('Error parsing Excel file:', err);
      return { products: [], errors: ['Failed to parse Excel file: ' + (err.message || String(err))] };
    }
  },
});
