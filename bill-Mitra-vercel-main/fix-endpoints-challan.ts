import fs from 'fs';

let generatePdf = fs.readFileSync('src/api/generateInvoicePdf.ts', 'utf8');
generatePdf = generatePdf.replace("import { renderClassicGst, renderModernGst, renderRetailInvoice, renderWholesaleInvoice, renderTaxInvoicePremium, renderThermalReceipt } from '../lib/invoiceTemplates';", "import { renderClassicGst, renderModernGst, renderRetailInvoice, renderWholesaleInvoice, renderPharmaChallan, renderTaxInvoicePremium, renderThermalReceipt } from '../lib/invoiceTemplates';");
generatePdf = generatePdf.replace("      case 'Wholesale Invoice':\n        html = renderWholesaleInvoice(company, invoice, customer, items, opts);\n        break;", "      case 'Wholesale Invoice':\n        html = renderWholesaleInvoice(company, invoice, customer, items, opts);\n        break;\n      case 'Delivery Challan':\n        html = renderPharmaChallan(company, invoice, customer, items, opts);\n        break;");
fs.writeFileSync('src/api/generateInvoicePdf.ts', generatePdf);

let previewTemplate = fs.readFileSync('src/api/previewTemplate.ts', 'utf8');
previewTemplate = previewTemplate.replace("import { renderClassicGst, renderModernGst, renderRetailInvoice, renderWholesaleInvoice, renderTaxInvoicePremium, renderThermalReceipt } from '../lib/invoiceTemplates';", "import { renderClassicGst, renderModernGst, renderRetailInvoice, renderWholesaleInvoice, renderPharmaChallan, renderTaxInvoicePremium, renderThermalReceipt } from '../lib/invoiceTemplates';");
previewTemplate = previewTemplate.replace("case 'Wholesale Invoice': html = renderWholesaleInvoice(sample.company, sample.invoice, sample.customer, sample.items, opts); break;", "case 'Wholesale Invoice': html = renderWholesaleInvoice(sample.company, sample.invoice, sample.customer, sample.items, opts); break;\n      case 'Delivery Challan': html = renderPharmaChallan(sample.company, sample.invoice, sample.customer, sample.items, opts); break;");
fs.writeFileSync('src/api/previewTemplate.ts', previewTemplate);

let templatesPage = fs.readFileSync('src/pages/InvoiceTemplatesPage.tsx', 'utf8');
templatesPage = templatesPage.replace("{ id: 'Wholesale Invoice', name: 'Wholesale Invoice', desc: 'Landscape with batch, free qty, discount details', icon: '📦' },", "{ id: 'Wholesale Invoice', name: 'Wholesale Invoice', desc: 'Detailed pharma wholesale with same clean UI', icon: '📦' },\n      { id: 'Delivery Challan', name: 'Delivery Challan', desc: 'Pharma challan format with no customer details', icon: '🚚' },");
fs.writeFileSync('src/pages/InvoiceTemplatesPage.tsx', templatesPage);

