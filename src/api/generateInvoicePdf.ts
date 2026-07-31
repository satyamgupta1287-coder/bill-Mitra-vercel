import { z } from 'zod';
import { createEndpoint, ZitePdf, Invoices, InvoiceItems, Customers, Companies, UserSettings, ZiteError } from 'zite-integrations-backend-sdk';
import { renderClassicGst, renderModernGst, renderRetailInvoice, renderWholesaleInvoice, renderPharmaChallan, renderTaxInvoicePremium, renderThermalReceipt } from '../lib/invoiceTemplates';
import { renderGeneralGst, renderIndianRetailBill, renderElectronicsInvoice, renderRestaurantBill, renderGroceryInvoice, renderFurnitureInvoice, renderServicesInvoice, renderProformaInvoice } from '../lib/industryTemplates';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ invoiceId: z.string() }),
  outputSchema: z.object({ url: z.string(), html: z.string().optional() }),
  execute: async ({ input, context }) => {
    const invoice = await Invoices.findOne({ id: input.invoiceId });
    if (!invoice) throw new ZiteError({ code: 'NOT_FOUND', message: 'Invoice not found' });

    const ownerId = Array.isArray(invoice.createdBy) ? invoice.createdBy[0] : invoice.createdBy;
    if (ownerId && ownerId !== context.user.id) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const { records: items } = await InvoiceItems.findAll({ filters: { invoice: input.invoiceId }, limit: 100 });
    const customerId = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
    const customer = customerId ? await Customers.findOne({ id: customerId }) : null;
    const companyId = Array.isArray(invoice.company) ? invoice.company[0] : invoice.company;
    const company = companyId ? await Companies.findOne({ id: companyId }) : null;

    // Get user template settings
    const userSettings = await UserSettings.findOne({ filters: { user: context.user.id } });
    const templateName = userSettings?.selectedTemplate || 'Classic GST';
    const opts = {
      showLogo: userSettings?.showLogo ?? true,
      showBankDetails: userSettings?.showBankDetails ?? true,
      showSignature: userSettings?.showSignature ?? true,
      showQrCode: userSettings?.showQrCode ?? false,
      customFooterText: userSettings?.customFooterText || '',
    };

    let html: string;
    switch (templateName) {
      case 'Modern GST':
        html = renderModernGst(company, invoice, customer, items, opts);
        break;
      case 'Retail Invoice':
        html = renderRetailInvoice(company, invoice, customer, items, opts);
        break;
      case 'Wholesale Invoice':
        html = renderWholesaleInvoice(company, invoice, customer, items, opts);
        break;
      case 'Delivery Challan':
        html = renderPharmaChallan(company, invoice, customer, items, opts);
        break;
      case 'Tax Invoice Premium':
        html = renderTaxInvoicePremium(company, invoice, customer, items, opts);
        break;
      case 'Thermal Receipt':
        html = renderThermalReceipt(company, invoice, customer, items, opts);
        break;
      case 'General GST':
        html = renderGeneralGst(company, invoice, customer, items, opts);
        break;
      case 'Indian Retail Bill':
        html = renderIndianRetailBill(company, invoice, customer, items, opts);
        break;
      case 'Electronics / Mobile':
        html = renderElectronicsInvoice(company, invoice, customer, items, opts);
        break;
      case 'Restaurant / Food':
        html = renderRestaurantBill(company, invoice, customer, items, opts);
        break;
      case 'Grocery / Kirana':
        html = renderGroceryInvoice(company, invoice, customer, items, opts);
        break;
      case 'Furniture / Hardware':
        html = renderFurnitureInvoice(company, invoice, customer, items, opts);
        break;
      case 'Services Invoice':
        html = renderServicesInvoice(company, invoice, customer, items, opts);
        break;
      case 'Proforma Invoice':
        html = renderProformaInvoice(company, invoice, customer, items, opts);
        break;
      default:
        html = renderClassicGst(company, invoice, customer, items, opts);
    }

    return { url: '', html };
    const { url } = await ZitePdf.renderHtml({
      html,
      filename: `${invoice.invoiceNumber || 'invoice'}.pdf`,
    });
    return { url };
  },
});
