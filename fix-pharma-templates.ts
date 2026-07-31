import fs from 'fs';

const content = fs.readFileSync('src/lib/invoiceTemplates.ts', 'utf8');

const pharmaGen = `
function generatePharmaHtml(company: any, invoice: any, customer: any, items: any[], opts: any, config: { title: string; showCustomer: boolean }) {
  const isIgst = num(invoice.igstAmount) > 0;
  
  const itemRows = items.map((item: any, i: number) => {
    const qtyStr = num(item.freeQuantity) > 0 ? \`\${num(item.quantity)}+\${num(item.freeQuantity)}\` : \`\${num(item.quantity)}\`;
    return \`<tr>
      <td style="text-align:center">\${i+1}</td>
      <td>\${esc(item.itemName)}</td>
      <td style="text-align:center">\${esc(item.hsnSacCode)}</td>
      <td style="text-align:center">\${esc(item.manufacturer)}</td>
      <td style="text-align:center">\${esc(item.packSize)}</td>
      <td style="text-align:center">\${qtyStr}</td>
      <td style="text-align:center">\${esc(item.batchNumber)}</td>
      <td style="text-align:center">\${esc(item.expiryDate)}</td>
      <td style="text-align:right">\${fmt(num(item.mrp))}</td>
      <td style="text-align:right">\${fmt(num(item.unitPrice))}</td>
      <td style="text-align:center">\${num(item.discountPercent) > 0 ? num(item.discountPercent).toFixed(2) : '-'}</td>
      <td style="text-align:right;font-weight:600">\${fmt(num(item.total))}</td>
      <td style="text-align:center">\${num(item.gstPercentage)}%</td>
      <td style="text-align:right">\${fmt(num(item.taxableAmount))}</td>
    </tr>\`;
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
  
  const gstRows = Object.keys(rates).sort((a,b)=>Number(a)-Number(b)).map(r => \`
    <tr>
      <td style="text-align:center">\${r}%</td>
      <td style="text-align:right">\${fmt(rates[r].tax)}</td>
      <td style="text-align:right">\${fmt(rates[r].cgst)}</td>
      <td style="text-align:right">\${fmt(rates[r].sgst)}</td>
      <td style="text-align:right">\${fmt(rates[r].igst)}</td>
    </tr>
  \`).join('');

  const showCust = config.showCustomer;

  return \`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
@page { size: a4; margin: 8mm; }
body { font-family: -apple-system, sans-serif; color: #111; font-size: 8.5pt; line-height: 1.3; }
* { box-sizing: border-box; }
.wrap { border: 1px solid #000; padding: 0; display: flex; flex-direction: column; min-height: 98vh; }
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
td { padding: 4px 4px; border: 1px solid #000; font-size: 8pt; border-bottom: none; border-top: none; }
.items-table-container { flex: 1; border-bottom: 1px solid #000; border-top: 1px solid #000; }
.items-table { border: none; height: 100%; }
.items-table td { border: 1px solid #000; border-top: none; border-bottom: none; }
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
    \${opts.showLogo && company?.logo?.[0]?.url ? \`<div class="hdr-l"><img src="\${company.logo[0].url}" style="max-width:100px;max-height:80px;object-fit:contain;"/></div>\` : ''}
    <div class="hdr-c">
      <div class="comp-name">\${esc(company?.companyName)}</div>
      <div>\${esc(company?.address)}\${company?.city ? ', ' + esc(company.city) : ''}</div>
      <div>Ph: \${esc(company?.phone)}\${company?.companyEmail ? ' | ' + esc(company.companyEmail) : ''}</div>
    </div>
    <div class="hdr-r">
      <div class="title-badge">\${config.title}</div>
      <div>
        \${company?.dlNumber1 ? \`<div>DL No.: \${esc(company.dlNumber1)}\${company?.dlNumber2 ? '/' + esc(company.dlNumber2) : ''}</div>\` : ''}
        \${company?.gstin ? \`<div>GSTIN: <b>\${esc(company.gstin)}</b></div>\` : ''}
        \${company?.pan ? \`<div>PAN: \${esc(company.pan)}</div>\` : ''}
      </div>
    </div>
  </div>
  
  <div class="row-box">
    <div class="col-box" style="flex:0.6">Inv No.: <b>\${esc(invoice.invoiceNumber)}</b></div>
    <div class="col-box" style="flex:0.8">Date: <b>\${esc(invoice.invoiceDate)}</b></div>
    <div class="col-box">Due: \${esc(invoice.dueDate || '-')}</div>
  </div>
  <div class="row-box">
    <div class="col-box" style="flex:0.6">Transport: \${esc(invoice.transport || '-')}</div>
    <div class="col-box" style="flex:0.8">LR No.: \${esc(invoice.lrNumber || '-')}</div>
    <div class="col-box">Cases: <b>\${num(invoice.cases) || 0}</b></div>
  </div>
  
  \${showCust ? \`
  <div class="row-box" style="min-height: 50px;">
    <div class="col-box" style="flex:1.4">
      <b>\${esc(customer?.customerName || '-')}</b><br/>
      \${esc(customer?.billingAddress || '')}<br/>
      \${customer?.phone ? 'Ph: ' + esc(customer.phone) : ''}
    </div>
    <div class="col-box" style="flex:1">
      <span style="color:#666;font-size:7pt">PLACE OF SUPPLY</span><br/>
      <b>\${esc(invoice.placeOfSupply || '')} \${invoice.placeOfSupplyCode ? '('+esc(invoice.placeOfSupplyCode)+')' : ''}</b>
    </div>
  </div>
  \` : ''}

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
          <th style="text-align:right">RATE</th>
          <th>DISC%</th>
          <th style="text-align:right">AMOUNT</th>
          <th>GST%</th>
          <th style="text-align:right">TAXABLE</th>
        </tr>
      </thead>
      <tbody>
        \${itemRows}
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
          \${gstRows}
        </tbody>
      </table>
      \${opts.showBankDetails && company?.bankName ? \`<div class="bank-info">BANK: \${esc(company.bankName)} | A/C: \${esc(company.accountNumber)} | IFSC: \${esc(company.ifscCode)}\${company?.upiId ? ' | UPI: ' + esc(company.upiId) : ''}</div>\` : ''}
    </div>
    <div class="bot-right">
      <div class="calc-row"><span>Gross Amount</span><span>\${fmt(num(invoice.totalAmount) + num(invoice.discountAmount) - num(invoice.roundOff))}</span></div>
      <div class="calc-row"><span>Less Discount</span><span>\${num(invoice.discountAmount) > 0 ? '-' : ''}\${fmt(num(invoice.discountAmount))}</span></div>
      <div class="calc-row"><span>Taxable Value</span><span>\${fmt(num(invoice.subtotal))}</span></div>
      <div class="calc-row"><span>CGST</span><span>\${fmt(num(invoice.cgstAmount))}</span></div>
      <div class="calc-row"><span>SGST</span><span>\${fmt(num(invoice.sgstAmount))}</span></div>
      <div class="calc-row"><span>IGST</span><span>\${fmt(num(invoice.igstAmount))}</span></div>
      <div class="calc-row"><span>Round Off</span><span>\${fmt(num(invoice.roundOff))}</span></div>
      <div class="calc-row grand-row"><span>GRAND TOTAL</span><span>₹\${fmt(num(invoice.totalAmount))}</span></div>
    </div>
  </div>

  <div class="words-row">[Rupees \${numWords(num(invoice.totalAmount))}]</div>

  <div class="footer">
    <div class="terms">
      <b>TERMS:</b> \${esc(company?.termsAndConditions || 'Medicines once sold will not be taken back. Subject to local jurisdiction.')}
    </div>
    <div class="sign">
      <div style="text-align:center;font-weight:bold;text-decoration:underline;margin-bottom:20px">FOR \${esc(company?.companyName)}</div>
      <div style="border-top:1px solid #000;text-align:center;padding-top:2px">AUTHORISED SIGNATORY</div>
    </div>
  </div>
</div>
</body>
</html>\`;
}

export function renderRetailInvoice(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  return generatePharmaHtml(company, invoice, customer, items, opts, { title: 'Retail Sale', showCustomer: true });
}

export function renderWholesaleInvoice(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  return generatePharmaHtml(company, invoice, customer, items, opts, { title: 'Wholesale Sale', showCustomer: true });
}

export function renderPharmaChallan(company: any, invoice: any, customer: any, items: any[], opts: Opts): string {
  return generatePharmaHtml(company, invoice, customer, items, opts, { title: 'Delivery Challan', showCustomer: false });
}
`;

const updatedContent = content
  .replace(/export function renderRetailInvoice[\s\S]*?(?=\/\/ ───|$)/, '')
  .replace(/export function renderWholesaleInvoice[\s\S]*?(?=\/\/ ───|$)/, pharmaGen);

fs.writeFileSync('src/lib/invoiceTemplates.ts', updatedContent);
