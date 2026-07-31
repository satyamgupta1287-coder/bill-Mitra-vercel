// Industry-specific invoice template rendering functions
// Each function returns a full HTML document string for PDF generation

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
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
  return `<div style="font-size:7.5pt;margin-top:8px;padding:6px 10px;background:#f8fafc;border-radius:4px"><b>Bank:</b> ${esc(company.bankName)} | A/C: ${esc(company.accountNumber)} | IFSC: ${esc(company.ifscCode)}${company.upiId ? ' | UPI: ' + esc(company.upiId) : ''}</div>`;
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

function totalsBlock(invoice: any, isIgst: boolean) {
  const grossAmount = num(invoice.totalAmount) + num(invoice.discountAmount) - num(invoice.roundOff);
  const hasDiscount = num(invoice.discountAmount) > 0;
  return `
    ${hasDiscount ? '<div class="t-row"><span>Gross Amount</span><span>₹' + fmt(grossAmount) + '</span></div>' : ''}
    ${hasDiscount ? '<div class="t-row"><span>Less Discount</span><span>-₹' + fmt(num(invoice.discountAmount)) + '</span></div>' : ''}
    <div class="t-row"><span>Taxable Value</span><span>₹${fmt(num(invoice.subtotal))}</span></div>
    ${!isIgst ? '<div class="t-row"><span>CGST</span><span>₹' + fmt(num(invoice.cgstAmount)) + '</span></div><div class="t-row"><span>SGST</span><span>₹' + fmt(num(invoice.sgstAmount)) + '</span></div>' : '<div class="t-row"><span>IGST</span><span>₹' + fmt(num(invoice.igstAmount)) + '</span></div>'}
    ${num(invoice.roundOff) !== 0 ? '<div class="t-row"><span>Round Off</span><span>' + (num(invoice.roundOff) >= 0 ? '+' : '') + num(invoice.roundOff).toFixed(2) + '</span></div>' : ''}
    <div class="t-row grand"><span>Grand Total</span><span>₹${fmt(num(invoice.totalAmount))}</span></div>
  `;
}

const baseStyles = `@page{size:a4;margin:12mm}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;font-size:9pt;line-height:1.4}*{box-sizing:border-box}
.t-row{display:flex;justify-content:space-between;padding:3px 0;font-size:8.5pt;border-bottom:1px solid #eee}
.t-row.grand{font-weight:800;font-size:11pt;border-top:2px solid #333;border-bottom:none;padding:6px 0}
table{width:100%;border-collapse:collapse}th{background:#f1f5f9;font-size:7pt;font-weight:600;text-transform:uppercase;padding:6px;border:1px solid #e2e8f0;color:#475569}
td{padding:5px 6px;border:1px solid #e2e8f0;font-size:8pt}`;


// ─── GENERAL GST INVOICE ───
export function renderGeneralGst(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const hasDisc = items.some((i: any) => num(i.discountPercent) > 0);
  const itemRows = items.map((item: any, i: number) => `<tr${i % 2 === 1 ? ' style="background:#fafbff"' : ''}>
    <td style="text-align:center">${i+1}</td><td style="font-weight:500">${esc(item.itemName)}</td><td>${esc(item.hsnSacCode)}</td>
    <td style="text-align:center">${num(item.quantity)} ${esc(item.unit || '')}</td><td style="text-align:right">${fmt(num(item.unitPrice))}</td>
    ${hasDisc ? '<td style="text-align:center">' + (num(item.discountPercent) > 0 ? num(item.discountPercent).toFixed(2) + '%' : '-') + '</td>' : ''}
    <td style="text-align:center">${num(item.gstPercentage)}%</td><td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
${baseStyles}
.hdr{display:flex;justify-content:space-between;padding:12px 16px;border-bottom:2px solid #1e40af;background:#f8fafc}
.hdr h1{font-size:16pt;margin:0;color:#1e40af}
.info{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px;border-bottom:1px solid #e2e8f0}
.info-box{font-size:8pt}.info-box h4{font-size:7pt;text-transform:uppercase;color:#94a3b8;margin:0 0 4px;letter-spacing:0.5px}
</style></head><body>
<div style="border:1.5px solid #1e40af;border-radius:4px;overflow:hidden">
  <div class="hdr">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoHtml(company, opts.showLogo)}
      <div><h1>${esc(company?.companyName)}</h1>
      <div style="font-size:8pt;color:#555">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''} | Ph: ${esc(company?.phone)}</div></div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14pt;font-weight:700;color:#1e40af">${esc(invoice.type || 'TAX INVOICE')}</div>
      <div style="font-size:8pt">GSTIN: <b>${esc(company?.gstin)}</b></div>
      ${company?.pan ? '<div style="font-size:7pt">PAN: ' + esc(company.pan) + '</div>' : ''}
    </div>
  </div>
  <div class="info">
    <div class="info-box"><h4>Invoice Details</h4><p><b>No:</b> ${esc(invoice.invoiceNumber)} &nbsp; <b>Date:</b> ${esc(invoice.invoiceDate)}</p><p><b>Due:</b> ${esc(invoice.dueDate || '-')} &nbsp; <b>Place of Supply:</b> ${esc(invoice.placeOfSupply)}</p></div>
    <div class="info-box"><h4>Bill To</h4><p><b>${esc(customer?.customerName)}</b></p><p>${esc(customer?.billingAddress)}, ${esc(customer?.billingCity)}, ${esc(customer?.billingState)}</p>${customer?.gstin ? '<p>GSTIN: ' + esc(customer.gstin) + '</p>' : ''}<p>Ph: ${esc(customer?.phone)}</p></div>
  </div>
  <table><thead><tr><th>#</th><th>Item / Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate (₹)</th>${hasDisc ? '<th>Disc%</th>' : ''}<th>GST%</th><th>Amount (₹)</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div style="display:flex">
    <div style="flex:1;padding:8px 12px"><div style="font-size:7pt;font-style:italic;color:#666">${numWords(num(invoice.totalAmount))}</div>${bankHtml(company, opts.showBankDetails)}</div>
    <div style="width:250px;padding:8px 12px">${totalsBlock(invoice, isIgst)}</div>
  </div>
  ${footerLine(opts, invoice)}
  ${signHtml(company, opts.showSignature)}
</div></body></html>`;
}


// ─── INDIAN RETAIL BILL ───
export function renderIndianRetailBill(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const itemRows = items.map((item: any, i: number) => `<tr>
    <td style="text-align:center">${i+1}</td><td>${esc(item.itemName)}</td>
    <td style="text-align:center">${num(item.quantity)}</td><td style="text-align:right">${fmt(num(item.unitPrice))}</td>
    <td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page{size:a4;margin:12mm}body{font-family:-apple-system,sans-serif;color:#111;font-size:10pt;line-height:1.3}*{box-sizing:border-box}
.wrap{border:2px solid #222;padding:0}.hdr{text-align:center;padding:10px;border-bottom:2px solid #222;background:#fafafa}
.hdr h1{margin:0;font-size:20pt;letter-spacing:1px}.hdr .sub{font-size:8pt;color:#555}
.meta{display:flex;border-bottom:1px solid #222;font-size:9pt}.meta div{flex:1;padding:5px 10px}
table{width:100%;border-collapse:collapse}th{background:#eee;font-size:8pt;font-weight:700;padding:6px;border:1px solid #222;text-transform:uppercase}
td{padding:5px 6px;border:1px solid #ccc;font-size:9pt}
.total-box{text-align:right;padding:12px 16px;font-size:16pt;font-weight:900;border-top:3px solid #222;background:#f8f8f0}
.total-box .label{font-size:9pt;color:#666;font-weight:400}
</style></head><body><div class="wrap">
  <div class="hdr">
    ${logoHtml(company, opts.showLogo)}
    <h1>${esc(company?.companyName)}</h1>
    <div class="sub">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''} | Ph: ${esc(company?.phone)}</div>
    <div class="sub">GSTIN: ${esc(company?.gstin)}</div>
  </div>
  <div style="text-align:center;padding:4px;font-weight:700;font-size:11pt;border-bottom:1px solid #222;background:#fff">${esc(invoice.type || 'RETAIL BILL / बिल')}</div>
  <div class="meta">
    <div><b>Bill No:</b> ${esc(invoice.invoiceNumber)}</div>
    <div><b>Date:</b> ${esc(invoice.invoiceDate)}</div>
    <div><b>Customer:</b> ${esc(customer?.customerName)} ${customer?.phone ? '| Ph: ' + esc(customer.phone) : ''}</div>
  </div>
  <table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div style="display:flex;border-top:1px solid #222">
    <div style="flex:1;padding:6px 10px;font-size:8pt">
      <div><b>Taxable:</b> ₹${fmt(num(invoice.subtotal))} | <b>GST:</b> ${!isIgst ? 'CGST ₹' + fmt(num(invoice.cgstAmount)) + ' + SGST ₹' + fmt(num(invoice.sgstAmount)) : 'IGST ₹' + fmt(num(invoice.igstAmount))}</div>
      <div style="font-style:italic;color:#555;margin-top:3px">${numWords(num(invoice.totalAmount))}</div>
    </div>
    <div class="total-box"><div class="label">Grand Total</div>₹${fmt(num(invoice.totalAmount))}</div>
  </div>
  ${opts.showBankDetails && company?.bankName ? '<div style="padding:4px 10px;font-size:7pt;border-top:1px solid #ccc"><b>Bank:</b> ' + esc(company.bankName) + ' | A/C: ' + esc(company.accountNumber) + ' | IFSC: ' + esc(company.ifscCode) + '</div>' : ''}
  ${footerLine(opts, invoice)}
  ${signHtml(company, opts.showSignature)}
</div></body></html>`;
}


// ─── ELECTRONICS / MOBILE SHOP ───
export function renderElectronicsInvoice(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const hasImei = items.some((i: any) => i.batchNumber);
  const hasWarranty = items.some((i: any) => i.expiryDate);
  const hasDisc = items.some((i: any) => num(i.discountPercent) > 0);
  const itemRows = items.map((item: any, i: number) => {
    const discAmt = num(item.unitPrice) * num(item.discountPercent) / 100;
    return `<tr${i % 2 === 1 ? ' style="background:#f0f7ff"' : ''}>
    <td style="text-align:center">${i+1}</td><td style="font-weight:500">${esc(item.itemName)}</td><td>${esc(item.hsnSacCode)}</td>
    <td style="text-align:right">${fmt(num(item.mrp))}</td><td style="text-align:right">${fmt(num(item.unitPrice))}</td>
    ${hasDisc ? '<td style="text-align:right">' + (discAmt > 0 ? '₹' + fmt(discAmt) : '-') + '</td>' : ''}
    ${hasImei ? '<td class="mono">' + esc(item.batchNumber) + '</td>' : ''}
    ${hasWarranty ? '<td style="text-align:center">' + esc(item.expiryDate) + '</td>' : ''}
    <td style="text-align:center">${num(item.quantity)}</td>
    <td style="text-align:center">${num(item.gstPercentage)}%</td><td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
${baseStyles}
.mono{font-family:monospace;font-size:7pt;letter-spacing:0.5px}
.hdr{display:flex;justify-content:space-between;padding:14px 16px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;border-radius:4px 4px 0 0}
.hdr h1{font-size:16pt;margin:0}
.info{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px;border:1px solid #e2e8f0;border-top:none}
.info-box{font-size:8pt}.info-box h4{font-size:7pt;text-transform:uppercase;color:#94a3b8;margin:0 0 4px;letter-spacing:0.5px}
.t-row.grand{color:#0f172a;border-top-color:#0f172a}
</style></head><body>
<div style="border:1.5px solid #0f172a;border-radius:4px;overflow:hidden">
  <div class="hdr">
    <div style="display:flex;align-items:center;gap:12px">
      ${opts.showLogo && company?.logo?.[0]?.url ? '<img src="' + String(company.logo[0].url).replace(/"/g, '&quot;') + '" style="height:40px;background:#fff;padding:3px;border-radius:4px"/>' : ''}
      <div><h1>${esc(company?.companyName)}</h1>
      <div style="font-size:8pt;opacity:0.85">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''} | Ph: ${esc(company?.phone)}</div></div>
    </div>
    <div style="text-align:right;font-size:8pt">
      <div style="font-size:13pt;font-weight:700">${esc(invoice.type || 'TAX INVOICE')}</div>
      <div>GSTIN: ${esc(company?.gstin)}</div>
    </div>
  </div>
  <div class="info">
    <div class="info-box"><h4>Invoice</h4><p><b>No:</b> ${esc(invoice.invoiceNumber)} &nbsp; <b>Date:</b> ${esc(invoice.invoiceDate)}</p><p><b>Due:</b> ${esc(invoice.dueDate || '-')}</p></div>
    <div class="info-box"><h4>Customer</h4><p><b>${esc(customer?.customerName)}</b></p><p>${esc(customer?.billingAddress)}, ${esc(customer?.billingCity)}</p>${customer?.gstin ? '<p>GSTIN: ' + esc(customer.gstin) + '</p>' : ''}<p>Ph: ${esc(customer?.phone)}</p></div>
  </div>
  <table><thead><tr><th>#</th><th>Product</th><th>HSN</th><th>MRP (₹)</th><th>Rate (₹)</th>${hasDisc ? '<th>Disc (₹)</th>' : ''}${hasImei ? '<th>IMEI / Serial</th>' : ''}${hasWarranty ? '<th>Warranty</th>' : ''}<th>Qty</th><th>GST%</th><th>Amount (₹)</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div style="display:flex">
    <div style="flex:1;padding:8px 12px">
      <div style="font-size:7pt;font-style:italic;color:#666">${numWords(num(invoice.totalAmount))}</div>
      ${bankHtml(company, opts.showBankDetails)}
    </div>
    <div style="width:250px;padding:8px 12px">${totalsBlock(invoice, isIgst)}</div>
  </div>
  ${footerLine(opts, invoice)}
  ${signHtml(company, opts.showSignature)}
</div></body></html>`;
}


// ─── RESTAURANT / FOOD BILL ───
export function renderRestaurantBill(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const serviceCharge = num(invoice.serviceCharge);
  const itemRows = items.map((item: any, i: number) => `<tr${i % 2 === 1 ? ' style="background:#fefce8"' : ''}>
    <td style="text-align:center">${i+1}</td><td style="font-weight:500">${esc(item.itemName)}</td>
    <td style="text-align:center">${num(item.quantity)}</td><td style="text-align:right">${fmt(num(item.unitPrice))}</td>
    <td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page{size:a4;margin:12mm}body{font-family:-apple-system,sans-serif;color:#1a1a1a;font-size:9pt;line-height:1.4}*{box-sizing:border-box}
.t-row{display:flex;justify-content:space-between;padding:3px 0;font-size:8.5pt;border-bottom:1px solid #eee}
.t-row.grand{font-weight:800;font-size:11pt;border-top:2px solid #b45309;border-bottom:none;padding:6px 0;color:#b45309}
table{width:100%;border-collapse:collapse}th{background:#fffbeb;font-size:7pt;font-weight:600;text-transform:uppercase;padding:6px;border:1px solid #fbbf24;color:#92400e}
td{padding:5px 6px;border:1px solid #fde68a;font-size:8pt}
.hdr{padding:16px;text-align:center;background:#fffbeb;border-bottom:2px solid #f59e0b}
.hdr h1{margin:0;font-size:20pt;color:#b45309}
</style></head><body>
<div style="border:2px solid #f59e0b;border-radius:6px;overflow:hidden">
  <div class="hdr">
    ${logoHtml(company, opts.showLogo)}
    <h1>${esc(company?.companyName)}</h1>
    <div style="font-size:8pt;color:#78716c">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''} | Ph: ${esc(company?.phone)}</div>
    <div style="font-size:8pt">GSTIN: ${esc(company?.gstin)}${company?.fssaiNumber ? ' &nbsp;|&nbsp; FSSAI: <b>' + esc(company.fssaiNumber) + '</b>' : ''}</div>
  </div>
  <div style="text-align:center;padding:4px;font-weight:700;font-size:11pt;border-bottom:1px solid #f59e0b">${esc(invoice.type || 'FOOD BILL')}</div>
  <div style="display:flex;padding:6px 12px;border-bottom:1px solid #fde68a;font-size:8.5pt">
    <div style="flex:1"><b>Bill No:</b> ${esc(invoice.invoiceNumber)} &nbsp; <b>Date:</b> ${esc(invoice.invoiceDate)}</div>
    <div><b>Customer:</b> ${esc(customer?.customerName)} ${customer?.phone ? '| ' + esc(customer.phone) : ''}</div>
  </div>
  <table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div style="display:flex">
    <div style="flex:1;padding:8px 12px">
      <div style="font-size:7pt;font-style:italic;color:#666">${numWords(num(invoice.totalAmount))}</div>
      ${bankHtml(company, opts.showBankDetails)}
    </div>
    <div style="width:250px;padding:8px 12px">
      ${num(invoice.discountAmount) > 0 ? '<div class="t-row"><span>Gross Amount</span><span>₹' + fmt(num(invoice.totalAmount) + num(invoice.discountAmount) - num(invoice.roundOff)) + '</span></div>' : ''}
      ${num(invoice.discountAmount) > 0 ? '<div class="t-row"><span>Less Discount</span><span>-₹' + fmt(num(invoice.discountAmount)) + '</span></div>' : ''}
      ${serviceCharge > 0 ? '<div class="t-row"><span>Service Charge</span><span>₹' + fmt(serviceCharge) + '</span></div>' : ''}
      <div class="t-row"><span>Taxable Value</span><span>₹${fmt(num(invoice.subtotal))}</span></div>
      ${!isIgst ? '<div class="t-row"><span>CGST</span><span>₹' + fmt(num(invoice.cgstAmount)) + '</span></div><div class="t-row"><span>SGST</span><span>₹' + fmt(num(invoice.sgstAmount)) + '</span></div>' : '<div class="t-row"><span>IGST</span><span>₹' + fmt(num(invoice.igstAmount)) + '</span></div>'}
      <div class="t-row grand"><span>Grand Total</span><span>₹${fmt(num(invoice.totalAmount))}</span></div>
    </div>
  </div>
  ${footerLine(opts, invoice)}
  ${opts.showSignature ? '<div style="text-align:center;padding:20px 10px 8px;font-size:7.5pt;color:#78716c">Thank you for dining with us!</div>' : ''}
</div></body></html>`;
}


// ─── GROCERY / KIRANA STORE ───
export function renderGroceryInvoice(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const hasMrp = items.some((i: any) => num(i.mrp) > 0);
  const itemRows = items.map((item: any, i: number) => `<tr${i % 2 === 1 ? ' style="background:#f0fdf4"' : ''}>
    <td style="text-align:center">${i+1}</td><td style="font-weight:500">${esc(item.itemName)}</td>
    <td style="text-align:center">${esc(item.unit || 'pcs')}</td><td style="text-align:center">${num(item.quantity)}</td>
    ${hasMrp ? '<td style="text-align:right">' + fmt(num(item.mrp)) + '</td>' : ''}
    <td style="text-align:right">${fmt(num(item.unitPrice))}</td>
    <td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page{size:a4;margin:12mm}body{font-family:-apple-system,sans-serif;color:#1a1a1a;font-size:9pt;line-height:1.4}*{box-sizing:border-box}
.t-row{display:flex;justify-content:space-between;padding:3px 0;font-size:8.5pt;border-bottom:1px solid #eee}
.t-row.grand{font-weight:800;font-size:11pt;border-top:2px solid #15803d;border-bottom:none;padding:6px 0;color:#15803d}
table{width:100%;border-collapse:collapse}th{background:#f0fdf4;font-size:7pt;font-weight:600;text-transform:uppercase;padding:6px;border:1px solid #bbf7d0;color:#166534}
td{padding:5px 6px;border:1px solid #dcfce7;font-size:8pt}
.hdr{display:flex;justify-content:space-between;padding:12px 16px;border-bottom:2px solid #22c55e;background:#f0fdf4}
.hdr h1{margin:0;font-size:16pt;color:#15803d}
</style></head><body>
<div style="border:1.5px solid #22c55e;border-radius:4px;overflow:hidden">
  <div class="hdr">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoHtml(company, opts.showLogo)}
      <div><h1>${esc(company?.companyName)}</h1>
      <div style="font-size:8pt;color:#555">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''} | Ph: ${esc(company?.phone)}</div></div>
    </div>
    <div style="text-align:right;font-size:8pt">
      <div style="font-size:13pt;font-weight:700;color:#15803d">${esc(invoice.type || 'BILL / INVOICE')}</div>
      <div>GSTIN: ${esc(company?.gstin)}</div>
    </div>
  </div>
  <div style="display:flex;padding:6px 14px;border-bottom:1px solid #dcfce7;font-size:8.5pt">
    <div style="flex:1"><b>Bill No:</b> ${esc(invoice.invoiceNumber)} &nbsp; <b>Date:</b> ${esc(invoice.invoiceDate)}</div>
    <div><b>Customer:</b> ${esc(customer?.customerName)} ${customer?.phone ? '| ' + esc(customer.phone) : ''}</div>
  </div>
  <table><thead><tr><th>#</th><th>Item</th><th>Unit</th><th>Qty</th>${hasMrp ? '<th>MRP (₹)</th>' : ''}<th>Rate (₹)</th><th>Amount (₹)</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div style="display:flex">
    <div style="flex:1;padding:8px 12px">
      <div style="font-size:7pt;font-style:italic;color:#666">${numWords(num(invoice.totalAmount))}</div>
      ${bankHtml(company, opts.showBankDetails)}
    </div>
    <div style="width:250px;padding:8px 12px">${totalsBlock(invoice, isIgst)}</div>
  </div>
  ${footerLine(opts, invoice)}
  ${signHtml(company, opts.showSignature)}
</div></body></html>`;
}


// ─── FURNITURE / HARDWARE ───
export function renderFurnitureInvoice(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const hasDesc = items.some((i: any) => i.manufacturer);
  const hasDims = items.some((i: any) => i.packSize);
  const itemRows = items.map((item: any, i: number) => `<tr${i % 2 === 1 ? ' style="background:#faf5ff"' : ''}>
    <td style="text-align:center">${i+1}</td><td style="font-weight:500">${esc(item.itemName)}</td>
    ${hasDesc ? '<td style="font-size:7.5pt">' + esc(item.manufacturer) + '</td>' : ''}
    ${hasDims ? '<td style="text-align:center">' + esc(item.packSize) + '</td>' : ''}
    <td>${esc(item.hsnSacCode)}</td><td style="text-align:center">${num(item.quantity)}</td>
    <td style="text-align:right">${fmt(num(item.unitPrice))}</td><td style="text-align:center">${num(item.gstPercentage)}%</td>
    <td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
${baseStyles}
.hdr{display:flex;justify-content:space-between;padding:14px 16px;background:#faf5ff;border-bottom:2px solid #7c3aed}
.hdr h1{margin:0;font-size:16pt;color:#6d28d9}
.t-row.grand{border-top-color:#7c3aed;color:#6d28d9}
th{background:#faf5ff;border-color:#e9d5ff;color:#6d28d9}
td{border-color:#f3e8ff}
</style></head><body>
<div style="border:1.5px solid #7c3aed;border-radius:4px;overflow:hidden">
  <div class="hdr">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoHtml(company, opts.showLogo)}
      <div><h1>${esc(company?.companyName)}</h1>
      <div style="font-size:8pt;color:#555">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''} | Ph: ${esc(company?.phone)}</div></div>
    </div>
    <div style="text-align:right;font-size:8pt">
      <div style="font-size:13pt;font-weight:700;color:#6d28d9">${esc(invoice.type || 'TAX INVOICE')}</div>
      <div>GSTIN: ${esc(company?.gstin)}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:10px 14px;border-bottom:1px solid #e9d5ff;font-size:8pt">
    <div><b>Invoice:</b> ${esc(invoice.invoiceNumber)} &nbsp; <b>Date:</b> ${esc(invoice.invoiceDate)} &nbsp; <b>Due:</b> ${esc(invoice.dueDate || '-')}</div>
    <div><b>Customer:</b> ${esc(customer?.customerName)} | ${esc(customer?.billingAddress)}, ${esc(customer?.billingCity)} ${customer?.gstin ? '| GSTIN: ' + esc(customer.gstin) : ''}</div>
  </div>
  <table><thead><tr><th>#</th><th>Product</th>${hasDesc ? '<th>Material / Description</th>' : ''}${hasDims ? '<th>Size / Dimensions</th>' : ''}<th>HSN</th><th>Qty</th><th>Rate (₹)</th><th>GST%</th><th>Amount (₹)</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div style="display:flex">
    <div style="flex:1;padding:8px 12px">
      <div style="font-size:7pt;font-style:italic;color:#666">${numWords(num(invoice.totalAmount))}</div>
      ${bankHtml(company, opts.showBankDetails)}
    </div>
    <div style="width:250px;padding:8px 12px">${totalsBlock(invoice, isIgst)}</div>
  </div>
  ${footerLine(opts, invoice)}
  ${signHtml(company, opts.showSignature)}
</div></body></html>`;
}


// ─── SERVICES INVOICE ───
export function renderServicesInvoice(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const itemRows = items.map((item: any, i: number) => `<tr${i % 2 === 1 ? ' style="background:#f5f3ff"' : ''}>
    <td style="text-align:center">${i+1}</td><td style="font-weight:500">${esc(item.itemName)}</td><td>${esc(item.hsnSacCode)}</td>
    <td style="text-align:center">${num(item.quantity)}</td><td style="text-align:right">${fmt(num(item.unitPrice))}</td>
    <td style="text-align:center">${num(item.gstPercentage)}%</td><td style="text-align:right">${fmt(num(item.taxableAmount))}</td>
    <td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
${baseStyles}
.hdr{padding:20px 16px;border-bottom:3px solid #0d9488}
.hdr h1{margin:0;font-size:16pt;color:#0d9488}
.t-row.grand{border-top-color:#0d9488;color:#0d9488}
th{background:#f0fdfa;border-color:#99f6e4;color:#0d9488}
td{border-color:#ccfbf1}
</style></head><body>
<div style="border:1.5px solid #0d9488;border-radius:4px;overflow:hidden">
  <div class="hdr">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:12px">
        ${logoHtml(company, opts.showLogo)}
        <div><h1>${esc(company?.companyName)}</h1>
        <div style="font-size:8pt;color:#555">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''}</div>
        <div style="font-size:8pt">Ph: ${esc(company?.phone)}${company?.companyEmail ? ' | ' + esc(company.companyEmail) : ''}</div></div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14pt;font-weight:700;color:#0d9488">${esc(invoice.type || 'SERVICE INVOICE')}</div>
        <div style="font-size:8pt">GSTIN: ${esc(company?.gstin)}</div>
        ${company?.pan ? '<div style="font-size:7pt">PAN: ' + esc(company.pan) + '</div>' : ''}
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:12px 16px;border-bottom:1px solid #ccfbf1;font-size:8pt">
    <div><div style="font-size:7pt;text-transform:uppercase;color:#94a3b8;margin-bottom:3px">Invoice Details</div><p><b>No:</b> ${esc(invoice.invoiceNumber)}</p><p><b>Date:</b> ${esc(invoice.invoiceDate)} &nbsp; <b>Due:</b> ${esc(invoice.dueDate || '-')}</p></div>
    <div><div style="font-size:7pt;text-transform:uppercase;color:#94a3b8;margin-bottom:3px">Bill To</div><p><b>${esc(customer?.customerName)}</b></p><p>${esc(customer?.billingAddress)}, ${esc(customer?.billingCity)}, ${esc(customer?.billingState)}</p>${customer?.gstin ? '<p>GSTIN: ' + esc(customer.gstin) + '</p>' : ''}</div>
  </div>
  <table><thead><tr><th>#</th><th>Service Description</th><th>SAC Code</th><th>Hours/Qty</th><th>Rate (₹)</th><th>GST%</th><th>Taxable (₹)</th><th>Total (₹)</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div style="display:flex">
    <div style="flex:1;padding:8px 12px">
      <div style="font-size:7pt;font-style:italic;color:#666">${numWords(num(invoice.totalAmount))}</div>
      ${bankHtml(company, opts.showBankDetails)}
    </div>
    <div style="width:250px;padding:8px 12px">${totalsBlock(invoice, isIgst)}</div>
  </div>
  ${footerLine(opts, invoice)}
  ${signHtml(company, opts.showSignature)}
</div></body></html>`;
}


// ─── PROFORMA INVOICE ───
export function renderProformaInvoice(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  const isIgst = num(invoice.igstAmount) > 0;
  const hasDisc = items.some((i: any) => num(i.discountPercent) > 0);
  const itemRows = items.map((item: any, i: number) => `<tr${i % 2 === 1 ? ' style="background:#fafbff"' : ''}>
    <td style="text-align:center">${i+1}</td><td style="font-weight:500">${esc(item.itemName)}</td><td>${esc(item.hsnSacCode)}</td>
    <td style="text-align:center">${num(item.quantity)} ${esc(item.unit || '')}</td><td style="text-align:right">${fmt(num(item.unitPrice))}</td>
    ${hasDisc ? '<td style="text-align:center">' + (num(item.discountPercent) > 0 ? num(item.discountPercent).toFixed(2) + '%' : '-') + '</td>' : ''}
    <td style="text-align:center">${num(item.gstPercentage)}%</td><td style="text-align:right;font-weight:600">${fmt(num(item.total))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
${baseStyles}
.wrap{border:2px solid #666;position:relative;overflow:hidden}
.watermark{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:54pt;color:rgba(0,0,0,0.04);font-weight:900;pointer-events:none;white-space:nowrap;letter-spacing:8px}
.hdr{display:flex;justify-content:space-between;padding:12px 16px;border-bottom:2px solid #666;background:#f9fafb}
.hdr h1{margin:0;font-size:16pt}
.info{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px;border-bottom:1px solid #e2e8f0}
.info-box{font-size:8pt}.info-box h4{font-size:7pt;text-transform:uppercase;color:#94a3b8;margin:0 0 4px}
.validity{background:#fef3c7;border:1px solid #fbbf24;padding:6px 12px;margin:8px 14px;border-radius:4px;font-size:8pt;color:#92400e}
</style></head><body>
<div class="wrap">
  <div class="watermark">PROFORMA INVOICE</div>
  <div class="hdr">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoHtml(company, opts.showLogo)}
      <div><h1>${esc(company?.companyName)}</h1>
      <div style="font-size:8pt;color:#555">${esc(company?.address)}${company?.city ? ', ' + esc(company.city) : ''} | Ph: ${esc(company?.phone)}</div></div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14pt;font-weight:700;color:#b45309">PROFORMA INVOICE</div>
      <div style="font-size:8pt">GSTIN: <b>${esc(company?.gstin)}</b></div>
    </div>
  </div>
  <div class="info">
    <div class="info-box"><h4>Quotation Details</h4><p><b>Ref No:</b> ${esc(invoice.invoiceNumber)} &nbsp; <b>Date:</b> ${esc(invoice.invoiceDate)}</p><p><b>Valid Till:</b> ${esc(invoice.dueDate || '15 days from date')}</p></div>
    <div class="info-box"><h4>To</h4><p><b>${esc(customer?.customerName)}</b></p><p>${esc(customer?.billingAddress)}, ${esc(customer?.billingCity)}, ${esc(customer?.billingState)}</p>${customer?.gstin ? '<p>GSTIN: ' + esc(customer.gstin) + '</p>' : ''}</div>
  </div>
  <table><thead><tr><th>#</th><th>Item / Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate (₹)</th>${hasDisc ? '<th>Disc%</th>' : ''}<th>GST%</th><th>Amount (₹)</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div style="display:flex">
    <div style="flex:1;padding:8px 12px">
      <div style="font-size:7pt;font-style:italic;color:#666">${numWords(num(invoice.totalAmount))}</div>
      ${bankHtml(company, opts.showBankDetails)}
    </div>
    <div style="width:250px;padding:8px 12px">${totalsBlock(invoice, isIgst)}</div>
  </div>
  <div class="validity"><b>⚠ Note:</b> This is a proforma invoice / quotation and is not a demand for payment. Prices and availability are subject to change.</div>
  ${footerLine(opts, invoice)}
  ${signHtml(company, opts.showSignature)}
</div></body></html>`;
}
