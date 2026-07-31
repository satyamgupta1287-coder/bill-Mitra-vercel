// Shared invoice template rendering functions for PDF generation
// Each function returns a full HTML document string

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n: unknown) => { const v = Number(n); return Number.isFinite(v) ? v : 0; };
const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Opts = { showLogo: boolean; showBankDetails: boolean; showSignature: boolean; showQrCode: boolean; customFooterText: string };

function numWords(n: number): string {
  if (n === 0) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const convert = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' ' + ones[num%10] : '');
    if (num < 1000) return ones[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' ' + convert(num%100) : '');
    if (num < 100000) return convert(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' ' + convert(num%1000) : '');
    if (num < 10000000) return convert(Math.floor(num/100000)) + ' Lakh' + (num%100000 ? ' ' + convert(num%100000) : '');
    return convert(Math.floor(num/10000000)) + ' Crore' + (num%10000000 ? ' ' + convert(num%10000000) : '');
  };
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let result = 'Rupees ' + convert(rupees);
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  result += ' Only';
  return result;
}

function gstSummary(items: any[], isIgst: boolean) {
  const rates: Record<number, { taxable: number; cgst: number; sgst: number; igst: number }> = {};
  items.forEach(item => {
    const rate = num(item.gstPercentage);
    if (!rates[rate]) rates[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    rates[rate].taxable += num(item.taxableAmount);
    rates[rate].cgst += num(item.cgst);
    rates[rate].sgst += num(item.sgst);
    rates[rate].igst += num(item.igst);
  });
  return Object.entries(rates).sort(([a], [b]) => Number(a) - Number(b))
    .map(([rate, d]) => `<tr><td style="text-align:center">${rate}%</td><td style="text-align:right">${fmt(d.taxable)}</td><td style="text-align:right">${fmt(isIgst ? 0 : d.cgst)}</td><td style="text-align:right">${fmt(isIgst ? 0 : d.sgst)}</td><td style="text-align:right">${fmt(isIgst ? d.igst : 0)}</td></tr>`).join('');
}

function logoHtml(company: any, show: boolean) {
  if (!show) return '';
  if (company?.logo && company.logo.length > 0 && company.logo[0]?.url) {
    return `<img src="${String(company.logo[0].url).replace(/"/g, '&quot;')}" style="height:50px;width:auto;max-width:120px;object-fit:contain" />`;
  }
  return '';
}

function bankHtml(company: any, show: boolean) {
  if (!show || !company?.bankName) return '';
  return `<div style="font-size:7pt"><b>BANK:</b> ${esc(company.bankName)} | A/C: ${esc(company.accountNumber)} | IFSC: ${esc(company.ifscCode)}${company.upiId ? ' | UPI: ' + esc(company.upiId) : ''}</div>`;
}

function signHtml(company: any, show: boolean) {
  if (!show) return '';
  return `<div style="text-align:right;padding:30px 20px 8px;font-size:8pt"><span style="border-top:1px solid #333;padding-top:3px">FOR ${esc(company?.companyName)}<br/>AUTHORISED SIGNATORY</span></div>`;
}

function footerLine(opts: Opts, invoice: any) {
  if (opts.customFooterText) return `<div style="padding:4px 10px;font-size:6.5pt;border-top:1px solid #ddd"><b>NOTE:</b> ${esc(opts.customFooterText)}</div>`;
  if (invoice.terms) return `<div style="padding:4px 10px;font-size:6.5pt;border-top:1px solid #ddd"><b>TERMS:</b> ${esc(invoice.terms)}</div>`;
  return '';
}

// ─── CLASSIC GST ───
export function renderClassicGst(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const itemRows = items.map((item, i) => {
    const qtyStr = item.freeQuantity && num(item.freeQuantity) > 0 ? `${num(item.quantity)}+${num(item.freeQuantity)}` : `${num(item.quantity)}`;
    return `<tr class="item-row">
      <td style="text-align:center">${i+1}</td><td>${esc(item.itemName)}</td><td class="mono">${esc(item.hsnSacCode)}</td>
      <td>${esc(item.manufacturer)}</td><td style="text-align:center">${esc(item.packSize)}</td><td style="text-align:center">${qtyStr}</td>
      <td>${esc(item.batchNumber)}</td><td style="text-align:center">${esc(item.expiryDate)}</td><td style="text-align:right">${fmt(num(item.mrp))}</td>
      ${config.title === 'Retail Sale' ? '' : `<td style="text-align:right">${fmt(num(item.unitPrice))}</td>`}<td style="text-align:center">${num(item.discountPercent) > 0 ? num(item.discountPercent).toFixed(2) : '-'}</td>
      <td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td><td style="text-align:center">${num(item.gstPercentage)}%</td><td style="text-align:right">${fmt(num(item.taxableAmount))}</td>
    </tr>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page{size:a4;margin:10mm}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;font-size:8pt;line-height:1.3}*{box-sizing:border-box}
.border{border:1.5px solid #333}.header{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1.5px solid #333}
.company-name{font-size:16pt;font-weight:800;letter-spacing:1px}.meta-row{display:flex;border-bottom:1px solid #333}
.meta-cell{flex:1;padding:3px 8px;border-right:1px solid #333;font-size:7.5pt}.meta-cell:last-child{border-right:none}
.parties{display:flex;border-bottom:1.5px solid #333}.party{flex:1;padding:6px 10px;font-size:7.5pt}.party:first-child{border-right:1.5px solid #333}
table.items{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
table.items th{background:#f0f0f0;font-size:6.5pt;font-weight:700;text-transform:uppercase;padding:4px 3px;border:1px solid #333;text-align:center}
table.items td{padding:3px 4px;border:1px solid #ddd;font-size:7.5pt;border-left:1px solid #333;border-right:1px solid #333}
.mono{font-family:monospace;font-size:7pt}.gst-summary table{width:100%;border-collapse:collapse}
.gst-summary th,.gst-summary td{border:1px solid #333;padding:3px 6px;font-size:7.5pt}.gst-summary th{background:#f0f0f0;font-size:6.5pt;text-transform:uppercase}
.footer-right .row{display:flex;justify-content:space-between;padding:2px 10px;border-bottom:1px solid #ddd;font-size:7.5pt}
.footer-right .row.grand{background:#f0f0f0;font-weight:800;font-size:9pt;padding:5px 10px}
.words{font-size:7pt;font-style:italic;padding:4px 10px;border-top:1px solid #333;border-bottom:1px solid #333}
</style></head><body>
<div class="border">
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoHtml(company, opts.showLogo)}
      <div><div class="company-name">${esc(company?.companyName)}</div>
      <div style="font-size:7.5pt;color:#444">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''}</div>
      <div style="font-size:7.5pt">Ph: ${esc(company?.phone)}${company?.companyEmail ? ' | ' + esc(company.companyEmail) : ''}</div></div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9pt;font-weight:600;color:#333">${esc(invoice.type || 'GST INVOICE')}</div>
      ${company?.dlNumber1 ? '<div style="font-size:7pt">DL No.: ' + esc(company.dlNumber1) + (company?.dlNumber2 ? '/' + esc(company.dlNumber2) : '') + '</div>' : ''}
      <div style="font-size:7pt">GSTIN: <b>${esc(company?.gstin)}</b></div>
      ${company?.pan ? '<div style="font-size:7pt">PAN: ' + esc(company.pan) + '</div>' : ''}
    </div>
  </div>
  <div class="meta-row"><div class="meta-cell">Inv No.: <b>${esc(invoice.invoiceNumber)}</b></div><div class="meta-cell">Date: <b>${esc(invoice.invoiceDate)}</b></div><div class="meta-cell">Due: <b>${esc(invoice.dueDate || '-')}</b></div></div>
  <div class="meta-row"><div class="meta-cell">Transport: <b>${esc(invoice.transport || '-')}</b></div><div class="meta-cell">LR No.: <b>${esc(invoice.lrNumber || '-')}</b></div><div class="meta-cell">Cases: <b>${invoice.cases || 0}</b></div></div>
  <div class="parties">
    <div class="party"><strong>${esc(customer?.customerName)}</strong><br/>${customer?.billingAddress ? esc(customer.billingAddress) + '<br/>' : ''}${customer?.billingCity ? esc(customer.billingCity) + ', ' : ''}${esc(customer?.billingState)} ${esc(customer?.billingPincode)}<br/>${customer?.gstin ? 'GSTIN: <b>' + esc(customer.gstin) + '</b><br/>' : ''}${customer?.phone ? 'Ph: ' + esc(customer.phone) : ''}</div>
    <div class="party"><div style="font-size:6.5pt;color:#888;text-transform:uppercase">Place of Supply</div><strong>${esc(invoice.placeOfSupply)} (${esc(invoice.placeOfSupplyCode)})</strong></div>
  </div>
  <table class="items"><thead><tr><th>#</th><th>Product</th><th>HSN</th><th>MFC</th><th>Pack</th><th>Qty</th><th>Batch</th><th>Exp</th><th>MRP</th><th>Rate</th><th>Disc%</th><th>Amount</th><th>GST%</th><th>Taxable</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div style="display:flex">
    <div style="flex:1;padding:6px 10px"><div class="gst-summary"><table><thead><tr><th>GST%</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead><tbody>${gstSummary(items, isIgst)}</tbody></table></div>${bankHtml(company, opts.showBankDetails)}</div>
    <div class="footer-right" style="width:240px">
      ${num(invoice.discountAmount) > 0 ? '<div class="row"><span>Gross Amount</span><span>' + fmt(num(invoice.totalAmount) + num(invoice.discountAmount) - num(invoice.roundOff)) + '</span></div>' : ''}
      ${num(invoice.discountAmount) > 0 ? '<div class="row"><span>Less Discount</span><span>-' + fmt(num(invoice.discountAmount)) + '</span></div>' : ''}
      <div class="row"><span>Taxable Value</span><span>${fmt(num(invoice.subtotal))}</span></div>
      ${!isIgst ? '<div class="row"><span>CGST</span><span>' + fmt(num(invoice.cgstAmount)) + '</span></div><div class="row"><span>SGST</span><span>' + fmt(num(invoice.sgstAmount)) + '</span></div>' : '<div class="row"><span>IGST</span><span>' + fmt(num(invoice.igstAmount)) + '</span></div>'}
      ${num(invoice.roundOff) !== 0 ? '<div class="row"><span>Round Off</span><span>' + (num(invoice.roundOff) >= 0 ? '+' : '') + num(invoice.roundOff).toFixed(2) + '</span></div>' : ''}
      <div class="row grand"><span>GRAND TOTAL</span><span>₹${fmt(num(invoice.totalAmount))}</span></div>
    </div>
  </div>
  <div class="words">[${numWords(num(invoice.totalAmount))}]</div>
  ${footerLine(opts, invoice)}
  ${signHtml(company, opts.showSignature)}
</div></body></html>`;
}

// ─── MODERN GST ───
export function renderModernGst(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const itemRows = items.map((item, i) => `<tr${i % 2 === 1 ? ' style="background:#fafbff"' : ''}>
    <td style="text-align:center">${i+1}</td><td style="font-weight:500">${esc(item.itemName)}</td><td>${esc(item.hsnSacCode)}</td>
    <td style="text-align:center">${esc(item.batchNumber)}</td><td style="text-align:center">${esc(item.expiryDate)}</td><td style="text-align:center">${num(item.quantity)}</td><td style="text-align:right">${fmt(num(item.unitPrice))}</td>
    <td style="text-align:center">${num(item.gstPercentage)}%</td><td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page{size:a4;margin:12mm}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;font-size:9pt;line-height:1.4}*{box-sizing:border-box}
.accent{background:#2563eb;color:#fff}.header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-radius:6px 6px 0 0}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 20px;border:1px solid #e2e8f0;border-top:none}
.info-box{font-size:8pt}.info-box h4{font-size:7pt;text-transform:uppercase;color:#94a3b8;margin:0 0 4px;letter-spacing:0.5px}.info-box p{margin:2px 0}
table{width:100%;border-collapse:collapse;margin-top:0}th{background:#f1f5f9;font-size:7pt;font-weight:600;text-transform:uppercase;padding:8px 6px;border:1px solid #e2e8f0;color:#475569}
td{padding:6px;border:1px solid #e2e8f0;font-size:8pt}.totals{display:flex;justify-content:flex-end;margin-top:12px}
.totals-box{width:260px}.totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:8.5pt;border-bottom:1px solid #f1f5f9}
.totals-row.grand{font-weight:800;font-size:11pt;border-top:2px solid #2563eb;border-bottom:none;padding:8px 0;color:#2563eb}
.words{font-size:7.5pt;font-style:italic;color:#64748b;margin-top:12px;padding:6px 0;border-top:1px solid #e2e8f0}
</style></head><body>
<div class="accent header">
  <div style="display:flex;align-items:center;gap:14px">
    ${opts.showLogo && company?.logo?.[0]?.url ? '<img src="' + String(company.logo[0].url).replace(/"/g, '&quot;') + '" style="height:40px;background:#fff;padding:4px;border-radius:4px"/>' : ''}
    <div><div style="font-size:18pt;font-weight:800">${esc(company?.companyName)}</div>
    <div style="font-size:8pt;opacity:0.85">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''} | Ph: ${esc(company?.phone)}</div></div>
  </div>
  <div style="text-align:right;font-size:8pt">
    <div style="font-size:14pt;font-weight:700">${esc(invoice.type || 'TAX INVOICE')}</div>
    <div>GSTIN: ${esc(company?.gstin)}</div>
  </div>
</div>
<div class="info-grid">
  <div class="info-box"><h4>Invoice Details</h4><p><b>No:</b> ${esc(invoice.invoiceNumber)}</p><p><b>Date:</b> ${esc(invoice.invoiceDate)}</p><p><b>Due:</b> ${esc(invoice.dueDate || '-')}</p></div>
  <div class="info-box"><h4>Bill To</h4><p><b>${esc(customer?.customerName)}</b></p><p>${esc(customer?.billingAddress)}, ${esc(customer?.billingCity)}</p>${customer?.gstin ? '<p>GSTIN: ' + esc(customer.gstin) + '</p>' : ''}</div>
</div>
<table><thead><tr><th>#</th><th>Product</th><th>HSN</th><th>Batch</th><th>Exp</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
<div class="totals"><div class="totals-box">
  ${num(invoice.discountAmount) > 0 ? '<div class="totals-row"><span>Gross Amount</span><span>₹' + fmt(num(invoice.totalAmount) + num(invoice.discountAmount) - num(invoice.roundOff)) + '</span></div>' : ''}
  ${num(invoice.discountAmount) > 0 ? '<div class="totals-row"><span>Less Discount</span><span>-₹' + fmt(num(invoice.discountAmount)) + '</span></div>' : ''}
  <div class="totals-row"><span>Taxable Value</span><span>₹${fmt(num(invoice.subtotal))}</span></div>
  ${!isIgst ? '<div class="totals-row"><span>CGST</span><span>₹' + fmt(num(invoice.cgstAmount)) + '</span></div><div class="totals-row"><span>SGST</span><span>₹' + fmt(num(invoice.sgstAmount)) + '</span></div>' : '<div class="totals-row"><span>IGST</span><span>₹' + fmt(num(invoice.igstAmount)) + '</span></div>'}
  <div class="totals-row grand"><span>Grand Total</span><span>₹${fmt(num(invoice.totalAmount))}</span></div>
</div></div>
<div class="words">${numWords(num(invoice.totalAmount))}</div>
${opts.showBankDetails && company?.bankName ? '<div style="margin-top:10px;font-size:7.5pt;padding:8px 10px;background:#f8fafc;border-radius:4px"><b>Bank:</b> ' + esc(company.bankName) + ' | A/C: ' + esc(company.accountNumber) + ' | IFSC: ' + esc(company.ifscCode) + '</div>' : ''}
${footerLine(opts, invoice)}
${opts.showSignature ? '<div style="text-align:right;padding:40px 20px 10px;font-size:8pt"><span style="border-top:1.5px solid #2563eb;padding-top:4px;color:#2563eb;font-weight:600">Authorized Signatory</span></div>' : ''}
</body></html>`;
}

// ─── RETAIL INVOICE ───
// ─── WHOLESALE INVOICE ───

function generatePharmaHtml(company: any, invoice: any, customer: any, items: any[], opts: any, config: { title: string; showCustomer: boolean }) {
  const isIgst = num(invoice.igstAmount) > 0;
  
  const itemRows = items.map((item: any, i: number) => {
    const qtyStr = num(item.freeQuantity) > 0 ? `${num(item.quantity)}+${num(item.freeQuantity)}` : `${num(item.quantity)}`;
    return `<tr>
      <td style="text-align:center">${i+1}</td>
      <td>${esc(item.itemName)}</td>
      <td style="text-align:center">${esc(item.hsnSacCode)}</td>
      <td style="text-align:center">${esc(item.manufacturer)}</td>
      <td style="text-align:center">${esc(item.packSize)}</td>
      <td style="text-align:center">${qtyStr}</td>
      <td style="text-align:center">${esc(item.batchNumber)}</td>
      <td style="text-align:center">${esc(item.expiryDate)}</td>
      <td style="text-align:right">${fmt(num(item.mrp))}</td>
      <td style="text-align:right">${fmt(num(item.unitPrice))}</td>
      <td style="text-align:center">${num(item.discountPercent) > 0 ? num(item.discountPercent).toFixed(2) : '-'}</td>
      <td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
      <td style="text-align:center">${num(item.gstPercentage)}%</td>
      <td style="text-align:right">${fmt(num(item.taxableAmount))}</td>
    </tr>`;
  }).join('');

  // GST Summary table
  const rates: any = {};
  items.forEach((item: any) => {
    const r = num(item.gstPercentage);
    if (!rates[r]) rates[r] = { tax: 0, cgst: 0, sgst: 0, igst: 0 };
    rates[r].tax += num(item.taxableAmount);
    rates[r].cgst += num(item.cgst);
    rates[r].sgst += num(item.sgst);
    rates[r].igst += num(item.igst);
  });
  
  const gstRows = Object.keys(rates).sort((a,b)=>Number(a)-Number(b)).map(r => `
    <tr>
      <td style="text-align:center">${r}%</td>
      <td style="text-align:right">${fmt(rates[r].tax)}</td>
      <td style="text-align:right">${fmt(rates[r].cgst)}</td>
      <td style="text-align:right">${fmt(rates[r].sgst)}</td>
      <td style="text-align:right">${fmt(rates[r].igst)}</td>
    </tr>
  `).join('');

  const showCust = config.showCustomer;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
@page { size: a4; margin: 8mm; }
body { font-family: -apple-system, sans-serif; color: #111; font-size: 8.5pt; line-height: 1.3; }
* { box-sizing: border-box; }
.wrap { border: 1px solid #000; padding: 0; display: flex; flex-direction: column; height: auto; }
.hdr { display: flex; border-bottom: 1px solid #000; }
.hdr-l { width: 120px; border-right: 1px solid #000; display: flex; align-items: center; justify-content: center; padding: 5px; }
.hdr-c { flex: 1; text-align: center; padding: 10px; }
.hdr-r { width: 200px; border-left: 1px solid #000; padding: 5px 8px; font-size: 7.5pt; text-align: right; display:flex; flex-direction:column; justify-content:space-between; }
.comp-name { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
.title-badge { text-align: right; font-size: 11pt; font-weight: bold; margin-bottom: 4px; }
.row-box { display: flex; border-bottom: 1px solid #000; }
.col-box { flex: 1; padding: 4px 8px; border-right: 1px solid #000; }
.col-box:last-child { border-right: none; }
table { width: 100%; border-collapse: collapse; }
th { background: #f0f0f0; font-size: 7pt; font-weight: 700; padding: 5px 4px; border: 1px solid #000; text-transform: uppercase; text-align: center; }
td { padding: 4px 4px; border: 1px solid #000; font-size: 8pt; }
.items-table-container { border-bottom: 1px solid #000; border-top: 1px solid #000; }
.items-table { border: none; height: 100%; }
.items-table td { border: 1px solid #000; vertical-align: top; }

.bottom-section { display: flex; border-bottom: 1px solid #000; }
.bot-left { width: 65%; border-right: 1px solid #000; display:flex; flex-direction:column; }
.bot-right { width: 35%; display:flex; flex-direction:column; }
.gst-table { margin-bottom: auto; }
.gst-table th, .gst-table td { border: 1px solid #000; }
.gst-table th { background: transparent; }
.bank-info { font-size: 7.5pt; font-weight: 600; padding: 6px; border-top: 1px solid #000; }
.calc-row { display: flex; justify-content: space-between; padding: 3.5px 8px; border-bottom: 1px solid #eee; }
.calc-row:last-child { border-bottom: none; }
.grand-row { border-top: 1px solid #000; font-size: 11pt; font-weight: bold; background: #f0f0f0; }
.words-row { padding: 6px 8px; font-style: italic; border-bottom: 1px solid #000; font-weight: 600; }
.footer { display: flex; justify-content: space-between; padding: 8px; min-height: 80px; }
.terms { font-size: 6.5pt; width: 70%; text-align: justify; }
.sign { width: 28%; text-align: right; display: flex; flex-direction: column; justify-content: space-between; }
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    ${opts.showLogo && company?.logo?.[0]?.url ? `<div class="hdr-l"><img src="${company.logo[0].url}" style="max-width:100px;max-height:80px;object-fit:contain;"/></div>` : ''}
    <div class="hdr-c">
      <div class="comp-name">${esc(company?.companyName)}</div>
      <div>${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''}</div>
      <div>Ph: ${esc(company?.phone)}${company?.companyEmail ? ' | ' + esc(company.companyEmail) : ''}</div>
    </div>
    <div class="hdr-r">
      <div class="title-badge">${config.title}</div>
      <div>
        ${company?.dlNumber1 ? `<div>DL No.: ${esc(company.dlNumber1)}${company?.dlNumber2 ? '/' + esc(company.dlNumber2) : ''}</div>` : ''}
        ${company?.gstin ? `<div>GSTIN: <b>${esc(company.gstin)}</b></div>` : ''}
        ${company?.pan ? `<div>PAN: ${esc(company.pan)}</div>` : ''}
      </div>
    </div>
  </div>
  
  <div class="row-box">
    <div class="col-box" style="flex:0.6">Inv No.: <b>${esc(invoice.invoiceNumber)}</b></div>
    <div class="col-box" style="flex:0.8">Date: <b>${esc(invoice.invoiceDate)}</b></div>
    <div class="col-box">Due: ${esc(invoice.dueDate || '-')}</div>
  </div>
  <div class="row-box">
    <div class="col-box" style="flex:0.6">Transport: ${esc(invoice.transport || '-')}</div>
    <div class="col-box" style="flex:0.8">LR No.: ${esc(invoice.lrNumber || '-')}</div>
    <div class="col-box">Cases: <b>${num(invoice.cases) || 0}</b></div>
  </div>
  
  ${showCust ? `
  <div class="row-box" style="min-height: 50px;">
    <div class="col-box" style="flex:1.4">
      <b>${esc(customer?.customerName || '-')}</b><br/>
      ${esc(customer?.billingAddress || '')}<br/>
      ${customer?.phone ? 'Ph: ' + esc(customer.phone) : ''}
    </div>
    <div class="col-box" style="flex:1">
      <span style="color:#666;font-size:7pt">PLACE OF SUPPLY</span><br/>
      <b>${esc(invoice.placeOfSupply || '')} ${invoice.placeOfSupplyCode ? '('+esc(invoice.placeOfSupplyCode)+')' : ''}</b>
    </div>
  </div>
  ` : ''}

  <div class="items-table-container">
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:20px">#</th>
          <th style="text-align:left">PRODUCT</th>
          <th>HSN</th>
          <th>MFC</th>
          <th>PACK</th>
          <th>QTY</th>
          <th>BATCH</th>
          <th>EXP</th>
          <th style="text-align:right">MRP</th>
          ${config.title === 'Retail Sale' ? '' : '<th style="text-align:right">RATE</th>'}
          <th>DISC%</th>
          <th style="text-align:right">AMOUNT</th>
          <th>GST%</th>
          <th style="text-align:right">TAXABLE</th>
        </tr>
      </thead>
      <tbody>
          
        ${itemRows}
        </tbody>
    </table>
  </div>

  <div class="bottom-section">
    <div class="bot-left">
      <table class="gst-table">
        <thead>
          <tr><th>GST%</th><th style="text-align:right">TAXABLE</th><th style="text-align:right">CGST</th><th style="text-align:right">SGST</th><th style="text-align:right">IGST</th></tr>
        </thead>
        <tbody>
          ${gstRows}
        </tbody>
      </table>
      ${opts.showBankDetails && company?.bankName ? `<div class="bank-info">BANK: ${esc(company.bankName)} | A/C: ${esc(company.accountNumber)} | IFSC: ${esc(company.ifscCode)}${company?.upiId ? ' | UPI: ' + esc(company.upiId) : ''}</div>` : ''}
    </div>
    <div class="bot-right">
      <div class="calc-row"><span>Gross Amount</span><span>${fmt(num(invoice.totalAmount) + num(invoice.discountAmount) - num(invoice.roundOff))}</span></div>
      <div class="calc-row"><span>Less Discount</span><span>${num(invoice.discountAmount) > 0 ? '-' : ''}${fmt(num(invoice.discountAmount))}</span></div>
      <div class="calc-row"><span>Taxable Value</span><span>${fmt(num(invoice.subtotal))}</span></div>
      <div class="calc-row"><span>CGST</span><span>${fmt(num(invoice.cgstAmount))}</span></div>
      <div class="calc-row"><span>SGST</span><span>${fmt(num(invoice.sgstAmount))}</span></div>
      <div class="calc-row"><span>IGST</span><span>${fmt(num(invoice.igstAmount))}</span></div>
      <div class="calc-row"><span>Round Off</span><span>${fmt(num(invoice.roundOff))}</span></div>
      <div class="calc-row grand-row"><span>GRAND TOTAL</span><span>₹${fmt(num(invoice.totalAmount))}</span></div>
    </div>
  </div>

  <div class="words-row">[Rupees ${numWords(num(invoice.totalAmount))}]</div>

  <div class="footer">
    <div class="terms">
      <b>TERMS:</b> ${esc(company?.termsAndConditions || 'Medicines once sold will not be taken back. Subject to local jurisdiction.')}
    </div>
    <div class="sign">
      <div style="text-align:center;font-weight:bold;text-decoration:underline;margin-bottom:20px">FOR ${esc(company?.companyName)}</div>
      <div style="border-top:1px solid #000;text-align:center;padding-top:2px">AUTHORISED SIGNATORY</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

export function renderRetailInvoice(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  return generatePharmaHtml(company, invoice, customer, items, opts, { title: 'Retail Sale', showCustomer: true });
}

export function renderWholesaleInvoice(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  return generatePharmaHtml(company, invoice, customer, items, opts, { title: 'Wholesale Sale', showCustomer: true });
}

export function renderPharmaChallan(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  return generatePharmaHtml(company, invoice, customer, items, opts, { title: 'Challan Sale', showCustomer: false });
}
// ─── TAX INVOICE PREMIUM ───
export function renderTaxInvoicePremium(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const itemRows = items.map((item, i) => `<tr>
    <td style="text-align:center">${i+1}</td><td style="font-weight:500">${esc(item.itemName)}</td><td>${esc(item.hsnSacCode)}</td>
    <td style="text-align:center">${esc(item.batchNumber)}</td><td style="text-align:center">${esc(item.expiryDate)}</td><td style="text-align:center">${num(item.quantity)}</td><td style="text-align:right">${fmt(num(item.unitPrice))}</td>
    <td style="text-align:center">${num(item.gstPercentage)}%</td><td style="text-align:right">${fmt(num(item.taxableAmount))}</td>
    <td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page{size:a4;margin:12mm}body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:9pt;line-height:1.4}*{box-sizing:border-box}
.wrap{border:3px double #333;padding:0;position:relative}
.watermark{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:60pt;color:rgba(0,0,0,0.03);font-weight:900;pointer-events:none;white-space:nowrap}
.hdr{display:flex;justify-content:space-between;padding:14px 16px;border-bottom:2px solid #333;background:#fafaf8}
.hdr h1{font-size:18pt;margin:0;font-family:Georgia,serif}.inv-label{font-size:16pt;font-weight:700;color:#8b0000;font-family:Georgia,serif}
.grid{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #333}.grid-cell{padding:8px 14px;font-size:8pt}.grid-cell:first-child{border-right:1px solid #333}
.grid-cell h4{font-size:7pt;text-transform:uppercase;color:#888;margin:0 0 4px;letter-spacing:1px}
table{width:100%;border-collapse:collapse}th{background:#f5f0e8;font-size:7pt;font-weight:700;text-transform:uppercase;padding:6px;border:1px solid #999;color:#444}
td{padding:5px 6px;border:1px solid #ccc;font-size:8pt}
.total-section{display:flex;justify-content:flex-end;padding:10px 14px}
.total-box{width:260px}.t-row{display:flex;justify-content:space-between;padding:3px 0;font-size:8.5pt;border-bottom:1px solid #eee}
.t-row.grand{font-weight:800;font-size:12pt;color:#8b0000;border-top:2px solid #8b0000;border-bottom:none;padding:6px 0}
.words{font-size:7.5pt;font-style:italic;color:#666;padding:6px 14px;border-top:1px solid #ccc}
.dual-sign{display:flex;justify-content:space-between;padding:40px 30px 10px}
.dual-sign div{text-align:center;font-size:8pt}.dual-sign span{border-top:1px solid #333;padding-top:4px;display:inline-block}
</style></head><body><div class="wrap">
  <div class="watermark">TAX INVOICE</div>
  <div class="hdr"><div style="display:flex;align-items:center;gap:12px">${logoHtml(company, opts.showLogo)}<div><h1>${esc(company?.companyName)}</h1><div style="font-size:8pt;color:#555">${esc(company?.address)}, ${esc(company?.city)} | GSTIN: ${esc(company?.gstin)}</div></div></div><div class="inv-label">${esc(invoice.type || 'TAX INVOICE')}</div></div>
  <div class="grid">
    <div class="grid-cell"><h4>Invoice</h4><p><b>No:</b> ${esc(invoice.invoiceNumber)} &nbsp; <b>Date:</b> ${esc(invoice.invoiceDate)}</p><p><b>Due:</b> ${esc(invoice.dueDate || '-')} &nbsp; <b>Place:</b> ${esc(invoice.placeOfSupply)}</p></div>
    <div class="grid-cell"><h4>Bill To</h4><p><b>${esc(customer?.customerName)}</b></p><p>${esc(customer?.billingAddress)}, ${esc(customer?.billingCity)}, ${esc(customer?.billingState)}</p>${customer?.gstin ? '<p>GSTIN: ' + esc(customer.gstin) + '</p>' : ''}</div>
  </div>
  <table><thead><tr><th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>GST</th><th>Taxable</th><th>Total</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div class="total-section"><div class="total-box">
    <div class="t-row"><span>Taxable Value</span><span>₹${fmt(num(invoice.subtotal))}</span></div>
    ${!isIgst ? '<div class="t-row"><span>CGST</span><span>₹' + fmt(num(invoice.cgstAmount)) + '</span></div><div class="t-row"><span>SGST</span><span>₹' + fmt(num(invoice.sgstAmount)) + '</span></div>' : '<div class="t-row"><span>IGST</span><span>₹' + fmt(num(invoice.igstAmount)) + '</span></div>'}
    <div class="t-row grand"><span>Grand Total</span><span>₹${fmt(num(invoice.totalAmount))}</span></div>
  </div></div>
  <div class="words">${numWords(num(invoice.totalAmount))}</div>
  ${opts.showBankDetails && company?.bankName ? '<div style="padding:6px 14px;font-size:7.5pt;background:#fafaf8;border-top:1px solid #ccc"><b>Bank:</b> ' + esc(company.bankName) + ' | A/C: ' + esc(company.accountNumber) + ' | IFSC: ' + esc(company.ifscCode) + '</div>' : ''}
  ${footerLine(opts, invoice)}
  ${opts.showSignature ? '<div class="dual-sign"><div><span>Receiver\'s Signature</span></div><div><span>For ' + esc(company?.companyName) + '<br/>Authorised Signatory</span></div></div>' : ''}
</div></body></html>`;
}

// ─── THERMAL RECEIPT ───
export function renderThermalReceipt(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const itemRows = items.map((item, i) => `<tr><td>${esc(item.itemName)}</td><td style="text-align:center">${num(item.quantity)}</td><td style="text-align:right">${fmt(num(item.unitPrice))}</td><td style="text-align:right">${fmt(num(item.total))}</td></tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page{size:80mm 297mm;margin:3mm}body{font-family:'Courier New',monospace;color:#000;font-size:8pt;line-height:1.3;width:74mm}*{box-sizing:border-box}
.center{text-align:center}.sep{border-top:1px dashed #000;margin:4px 0}
h1{font-size:12pt;margin:0 0 2px}table{width:100%;border-collapse:collapse}
th{font-size:7pt;font-weight:700;padding:3px 2px;border-bottom:1px solid #000;text-align:left}
td{padding:2px;font-size:7.5pt}.total{font-weight:800;font-size:10pt}
</style></head><body>
<div class="center"><h1>${esc(company?.companyName)}</h1>
<div style="font-size:7pt">${esc(company?.address)}, ${esc(company?.city)}</div>
<div style="font-size:7pt">Ph: ${esc(company?.phone)} | GSTIN: ${esc(company?.gstin)}</div></div>
<div class="sep"></div>
<div style="font-size:7.5pt"><b>${esc(invoice.type || 'RECEIPT')}</b> &nbsp; No: ${esc(invoice.invoiceNumber)} &nbsp; Date: ${esc(invoice.invoiceDate)}</div>
<div style="font-size:7.5pt">Customer: ${esc(customer?.customerName)}</div>
<div class="sep"></div>
<table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr></thead><tbody>${itemRows}</tbody></table>
<div class="sep"></div>
<div style="display:flex;justify-content:space-between;font-size:7.5pt"><span>Taxable</span><span>${fmt(num(invoice.subtotal))}</span></div>
<div style="display:flex;justify-content:space-between;font-size:7.5pt"><span>GST</span><span>${fmt(num(invoice.cgstAmount) + num(invoice.sgstAmount) + num(invoice.igstAmount))}</span></div>
<div class="sep"></div>
<div style="display:flex;justify-content:space-between" class="total"><span>TOTAL</span><span>₹${fmt(num(invoice.totalAmount))}</span></div>
<div class="sep"></div>
<div class="center" style="font-size:7pt;margin-top:4px">${opts.customFooterText ? esc(opts.customFooterText) : 'Thank you for your purchase!'}</div>
</body></html>`;
}
