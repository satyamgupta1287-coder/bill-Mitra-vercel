import { z } from 'zod';
import { createEndpoint } from 'zite-integrations-backend-sdk';

const HEADER_MAP: Record<string, string> = {
  'product name': 'productName',
  'name of the product': 'productName',
  'item name': 'productName',
  'product': 'productName',
  'hsn/sac code': 'hsnSacCode',
  'hsn code': 'hsnSacCode',
  'hsncode': 'hsnSacCode',
  'hsn': 'hsnSacCode',
  'item code': 'hsnSacCode',
  'category': 'category',
  'unit': 'unit',
  'unit price': 'unitPrice',
  'selling rate': 'unitPrice',
  'sale price': 'unitPrice',
  'rate': 'unitPrice',
  'price': 'unitPrice',
  'gst %': 'gstPercentage',
  'gst': 'gstPercentage',
  'gst percentage': 'gstPercentage',
  'gst%': 'gstPercentage',
  'stock qty': 'stockQuantity',
  'stock': 'stockQuantity',
  'stock quantity': 'stockQuantity',
  'cl. qnty.': 'stockQuantity',
  'cl. qnty': 'stockQuantity',
  'cl.qnty.': 'stockQuantity',
  'closing quantity': 'stockQuantity',
  'closing qty': 'stockQuantity',
  'opening quantity': 'stockQuantity',
  'manufacturer': 'manufacturer',
  'company': 'manufacturer',
  'pack size': 'packSize',
  'pack': 'packSize',
  'mrp': 'mrp',
  'm.r.p.': 'mrp',
  'm.r.p': 'mrp',
  'batch': 'batch',
  'expiry': 'expiry',
  'description': 'description',
};

const NUM_FIELDS = ['unitPrice', 'gstPercentage', 'stockQuantity', 'mrp'];

/** Parse a numeric value that may have trailing letters, commas, spaces, etc.
 *  e.g. "328.13 I" → 328.13, "1,200.50" → 1200.50, "     12 " → 12 */
function parseNum(raw: string): number | undefined {
  if (!raw) return undefined;
  // Remove trailing letters (like "I", "L") and whitespace
  const cleaned = raw.replace(/[A-Za-z]+\s*$/, '').replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return isNaN(num) ? undefined : num;
}

function findHeaderRowIndex(rows: string[][]): number {
  // Look for a row that has at least 3 recognized headers
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const headers = rows[i].map(h => (h || '').toLowerCase().trim());
    const mapped = headers.map(h => HEADER_MAP[h] || null).filter(Boolean);
    if (mapped.length >= 3) return i;
    // Also check if "product name" or "name of the product" appears
    if (mapped.includes('productName')) return i;
  }
  return 0; // Default to first row
}

function mapRowsToProducts(rows: string[][]) {
  if (rows.length < 2) return { products: [] as any[], errors: ['File must have a header row and at least one data row.'] };

  // Find the actual header row (may not be row 0 if there are title/merged rows)
  const headerIdx = findHeaderRowIndex(rows);
  const headerRow = rows[headerIdx];
  const headers = headerRow.map(h => (h || '').toLowerCase().trim());
  const mappedHeaders = headers.map(h => HEADER_MAP[h] || null);

  console.log('Header row index:', headerIdx);
  console.log('Detected headers:', JSON.stringify(headerRow.map(h => (h || '').trim()).filter(Boolean)));
  console.log('Mapped to:', JSON.stringify(mappedHeaders.filter(Boolean)));

  if (!mappedHeaders.includes('productName')) {
    const foundHeaders = headerRow.map(h => (h || '').trim()).filter(h => h);
    return { products: [] as any[], errors: ['\"Product Name\" / \"Name of The Product\" column not found. Found headers: ' + foundHeaders.join(', ')] };
  }

  const products: any[] = [];
  const errors: string[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const vals = rows[i];

    // Skip completely empty rows
    if (vals.every(v => !v || !v.trim())) continue;

    // Skip "Total :" summary rows
    const firstVal = (vals[0] || '').trim().toLowerCase();
    if (firstVal.startsWith('total')) continue;

    const obj: any = {};
    mappedHeaders.forEach((key, idx) => {
      if (!key) return;
      const val = (vals[idx] || '').trim();
      if (!val) return;

      // Skip non-data fields we don't store
      if (key === 'batch' || key === 'expiry') return;

      if (NUM_FIELDS.includes(key)) {
        const num = parseNum(val);
        if (num !== undefined) obj[key] = num;
      } else {
        obj[key] = val;
      }
    });

    // Skip rows with no product name (empty/whitespace-only names)
    if (!obj.productName) continue;

    // If manufacturer equals productName, it's likely a group header row — 
    // still include it but clear the manufacturer
    if (obj.manufacturer && obj.manufacturer === obj.productName) {
      delete obj.manufacturer;
    }

    // Skip rows with negative stock (likely summary/adjustment rows)
    if (obj.stockQuantity !== undefined && obj.stockQuantity < 0) {
      delete obj.stockQuantity;
    }

    products.push(obj);
  }

  // Deduplicate: group by productName and take the row with the most data
  const grouped = new Map<string, any[]>();
  for (const p of products) {
    const key = p.productName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  const dedupedProducts: any[] = [];
  for (const [, items] of grouped) {
    if (items.length === 1) {
      dedupedProducts.push(items[0]);
    } else {
      // Pick the row with the most fields filled, or merge them
      // Take fields from the "best" row (one with most data)
      const merged: any = {};
      // Sort by field count descending
      items.sort((a, b) => Object.keys(b).length - Object.keys(a).length);
      // Merge all — first non-empty value wins
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

// ── CSV parsing ──

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const rows = lines.map(l => parseCSVLine(l));
  return mapRowsToProducts(rows);
}

// ── XLSX parsing using DecompressionStream ──

async function decompressDeflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  const copy = new ArrayBuffer(compressed.byteLength);
  new Uint8Array(copy).set(compressed);
  writer.write(new Uint8Array(copy));
  writer.close();

  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }

  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

async function extractZipEntries(data: Uint8Array): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  const decoder = new TextDecoder('utf-8');
  const targetFiles = ['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml'];

  let pos = 0;
  while (pos + 30 < data.length) {
    if (data[pos] !== 0x50 || data[pos + 1] !== 0x4B || data[pos + 2] !== 0x03 || data[pos + 3] !== 0x04) {
      break;
    }

    const compMethod = readUint16LE(data, pos + 8);
    const compSize = readUint32LE(data, pos + 18);
    const uncompSize = readUint32LE(data, pos + 22);
    const nameLen = readUint16LE(data, pos + 26);
    const extraLen = readUint16LE(data, pos + 28);
    const fileName = decoder.decode(data.slice(pos + 30, pos + 30 + nameLen));
    const dataStart = pos + 30 + nameLen + extraLen;

    if (targetFiles.includes(fileName)) {
      const rawData = data.slice(dataStart, dataStart + compSize);
      if (compMethod === 0) {
        entries[fileName] = decoder.decode(rawData);
      } else if (compMethod === 8) {
        try {
          const decompressed = await decompressDeflateRaw(rawData);
          entries[fileName] = decoder.decode(decompressed);
        } catch (err) {
          console.log('Decompression failed for', fileName, err);
          entries[fileName] = '';
        }
      }
    }

    const actualDataSize = compSize > 0 ? compSize : uncompSize;
    pos = dataStart + actualDataSize;

    if (pos + 4 <= data.length && data[pos] === 0x50 && data[pos + 1] === 0x4B && data[pos + 2] === 0x07 && data[pos + 3] === 0x08) {
      pos += 16;
    }
  }

  return entries;
}

function extractSharedStrings(xml: string): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  const siParts = xml.split('<si>');
  for (let i = 1; i < siParts.length; i++) {
    const siEnd = siParts[i].indexOf('</si>');
    const siContent = siParts[i].substring(0, siEnd);
    let text = '';
    const tParts = siContent.split('<t');
    for (let j = 1; j < tParts.length; j++) {
      const afterTag = tParts[j];
      const closeAngle = afterTag.indexOf('>');
      const tEnd = afterTag.indexOf('</t>', closeAngle);
      if (tEnd > closeAngle) {
        text += afterTag.substring(closeAngle + 1, tEnd);
      }
    }
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
    strings.push(text);
  }
  return strings;
}

function colLetterToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result - 1;
}

function extractSheetRows(xml: string, sharedStrings: string[]): string[][] {
  if (!xml) return [];
  const rows: string[][] = [];

  const rowParts = xml.split('<row ');
  for (let r = 1; r < rowParts.length; r++) {
    const rowEnd = rowParts[r].indexOf('</row>');
    const rowContent = rowEnd >= 0 ? rowParts[r].substring(0, rowEnd) : rowParts[r];

    const cells: { col: number; value: string }[] = [];

    const cellParts = rowContent.split('<c ');
    for (let c = 1; c < cellParts.length; c++) {
      const cellStr = cellParts[c];

      const rMatch = cellStr.match(/r="([A-Z]+)\d+"/);
      if (!rMatch) continue;
      const col = colLetterToIndex(rMatch[1]);

      const isSharedString = /t="s"/.test(cellStr);
      const isInlineStr = /t="inlineStr"/.test(cellStr);

      const vStart = cellStr.indexOf('<v>');
      const vEnd = cellStr.indexOf('</v>');
      let value = '';

      if (vStart >= 0 && vEnd > vStart) {
        const rawVal = cellStr.substring(vStart + 3, vEnd);
        if (isSharedString) {
          const idx = parseInt(rawVal, 10);
          value = sharedStrings[idx] || '';
        } else {
          value = rawVal;
        }
      }

      if (isInlineStr) {
        const tStart = cellStr.indexOf('<t>');
        const tEnd = cellStr.indexOf('</t>');
        if (tStart >= 0 && tEnd > tStart) {
          value = cellStr.substring(tStart + 3, tEnd);
        }
        const tStart2 = cellStr.indexOf('<t ');
        if (tStart2 >= 0 && !value) {
          const closeAngle = cellStr.indexOf('>', tStart2);
          const tEnd2 = cellStr.indexOf('</t>', closeAngle);
          if (tEnd2 > closeAngle) {
            value = cellStr.substring(closeAngle + 1, tEnd2);
          }
        }
      }

      value = value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      cells.push({ col, value });
    }

    if (cells.length > 0) {
      const maxCol = Math.max(...cells.map(c => c.col));
      const row = new Array(maxCol + 1).fill('');
      cells.forEach(c => { row[c.col] = c.value; });
      rows.push(row);
    }
  }
  return rows;
}

async function parseXLSX(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    return { products: [] as any[], errors: ['File does not appear to be a valid .xlsx file. Please check the file format.'] };
  }

  const entries = await extractZipEntries(bytes);
  console.log('Zip entries found:', Object.keys(entries).join(', '));

  const sharedStrings = extractSharedStrings(entries['xl/sharedStrings.xml'] || '');
  console.log('Shared strings count:', sharedStrings.length);

  const rows = extractSheetRows(entries['xl/worksheets/sheet1.xml'] || '', sharedStrings);
  console.log('Total rows extracted:', rows.length);

  if (rows.length > 0) {
    // Log first few rows to help debug
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const trimmed = rows[i].map(v => (v || '').trim()).filter(Boolean);
      console.log(`Row ${i}: ${JSON.stringify(trimmed.slice(0, 8))}`);
    }
  }

  if (rows.length === 0) {
    return { products: [] as any[], errors: ['Could not read any data from the Excel file. Make sure the data is on Sheet 1.'] };
  }

  return mapRowsToProducts(rows);
}

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    fileUrl: z.string(),
    fileType: z.enum(['csv', 'xlsx']),
  }),
  outputSchema: z.object({
    products: z.array(z.any()),
    errors: z.array(z.string()),
  }),
  execute: async ({ input }) => {
    const response = await fetch(input.fileUrl);
    if (!response.ok) {
      return { products: [], errors: ['Failed to download uploaded file. Status: ' + response.status] };
    }

    if (input.fileType === 'csv') {
      const text = await response.text();
      return parseCSV(text);
    } else {
      const buffer = await response.arrayBuffer();
      return await parseXLSX(buffer);
    }
  },
});
