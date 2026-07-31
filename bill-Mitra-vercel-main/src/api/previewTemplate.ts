import { z } from 'zod';
import { createEndpoint, ZitePdf } from 'zite-integrations-backend-sdk';
import { renderClassicGst, renderModernGst, renderRetailInvoice, renderWholesaleInvoice, renderPharmaChallan, renderTaxInvoicePremium, renderThermalReceipt } from '../lib/invoiceTemplates';
import { renderGeneralGst, renderIndianRetailBill, renderElectronicsInvoice, renderRestaurantBill, renderGroceryInvoice, renderFurnitureInvoice, renderServicesInvoice, renderProformaInvoice } from '../lib/industryTemplates';

// Helper: compute GST-inclusive sample item data
function makeItem(name: string, hsn: string, mfr: string, pack: string, qty: number, free: number, batch: string, expiry: string, mrp: number, rate: number, discPct: number, gstPct: number, unit: string) {
  const gross = qty * rate;
  const disc = gross * discPct / 100;
  const amount = gross - disc; // GST-inclusive
  const taxable = amount / (1 + gstPct / 100);
  const gst = amount - taxable;
  return { itemName: name, hsnSacCode: hsn, manufacturer: mfr, packSize: pack, quantity: qty, freeQuantity: free, batchNumber: batch, expiryDate: expiry, mrp, unitPrice: rate, discountPercent: discPct, total: Math.round(amount * 100) / 100, gstPercentage: gstPct, taxableAmount: Math.round(taxable * 100) / 100, cgst: Math.round(gst / 2 * 100) / 100, sgst: Math.round(gst / 2 * 100) / 100, igst: 0, unit };
}

function makeInvoice(items: any[], opts?: { type?: string; serviceCharge?: number; discountAmount?: number }) {
  const subtotal = items.reduce((s: number, i: any) => s + i.taxableAmount, 0);
  const cgst = items.reduce((s: number, i: any) => s + i.cgst, 0);
  const sgst = items.reduce((s: number, i: any) => s + i.sgst, 0);
  const totalAmount = items.reduce((s: number, i: any) => s + i.total, 0);
  const discAmount = opts?.discountAmount || items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice * i.discountPercent / 100), 0);
  return {
    invoiceNumber: 'INV-2026-001', invoiceDate: '2026-06-07', dueDate: '2026-07-07',
    type: opts?.type || 'Tax Invoice', placeOfSupply: 'Maharashtra', placeOfSupplyCode: '27',
    transport: 'Blue Dart', lrNumber: 'BD12345', cases: 5,
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discAmount * 100) / 100,
    cgstAmount: Math.round(cgst * 100) / 100,
    sgstAmount: Math.round(sgst * 100) / 100,
    igstAmount: 0,
    roundOff: 0,
    totalAmount: Math.round(totalAmount),
    terms: 'Goods once sold will not be taken back.',
    serviceCharge: opts?.serviceCharge || 0,
  };
}

const defaultCompany = { companyName: 'ABC Pharma Pvt. Ltd.', gstin: '27AABCU9603R1ZM', pan: 'AABCU9603R', address: '123 Industrial Area, Phase 2', city: 'Mumbai', phone: '022-12345678', companyEmail: 'info@abcpharma.com', dlNumber1: 'MH-20B-123456', dlNumber2: 'MH-21B-654321', bankName: 'State Bank of India', accountNumber: '1234567890', ifscCode: 'SBIN0001234', upiId: 'abcpharma@upi', logo: null as any, fssaiNumber: '' };
const defaultCustomer = { customerName: 'XYZ Medical Store', gstin: '27BBBBB1234B1Z1', billingAddress: '456 Market Road', billingCity: 'Pune', billingState: 'Maharashtra', billingPincode: '411001', phone: '9876543210' };

const pharmaItems = [
  makeItem('Paracetamol 500mg', '30049099', 'Sun Pharma', '10x10', 100, 10, 'BT2026A', '12/2027', 35.50, 28.00, 5, 12, 'Strip'),
  makeItem('Amoxicillin 250mg', '30041010', 'Cipla', '10x6', 50, 5, 'BT2026B', '03/2028', 120, 95, 8, 18, 'Strip'),
  makeItem('Vitamin C Tablets', '21069099', 'Mankind', '1x30', 200, 0, 'BT2026C', '09/2027', 15, 10.50, 0, 5, 'Bottle'),
];

const pharmaSample = { company: defaultCompany, invoice: makeInvoice(pharmaItems), customer: defaultCustomer, items: pharmaItems };

const electronicsItems = [
  makeItem('Samsung Galaxy S24 Ultra', '85171200', 'Samsung', '', 1, 0, '352456789012345', '1 Year Warranty', 134999, 129999, 0, 18, 'Nos'),
  makeItem('iPhone 15 Pro Max 256GB', '85171200', 'Apple', '', 1, 0, '356789012345678', '1 Year Warranty', 164900, 159900, 0, 18, 'Nos'),
  makeItem('OnePlus Buds Pro 2', '85183000', 'OnePlus', '', 2, 0, '', '6 Month Warranty', 11999, 9999, 0, 18, 'Nos'),
];
const restaurantItems = [
  makeItem('Butter Chicken', '21069099', '', '', 2, 0, '', '', 0, 380, 0, 5, ''),
  makeItem('Garlic Naan (4 pcs)', '19059040', '', '', 3, 0, '', '', 0, 120, 0, 5, ''),
  makeItem('Paneer Tikka', '21069099', '', '', 1, 0, '', '', 0, 320, 0, 5, ''),
  makeItem('Cold Drinks', '22021010', '', '', 4, 0, '', '', 0, 65, 0, 12, ''),
];
const groceryItems = [
  makeItem('Toor Dal', '07132000', '', '', 3, 0, '', '', 180, 160, 0, 5, 'kg'),
  makeItem('Wheat Flour Chakki', '11010000', '', '', 10, 0, '', '', 42, 38, 0, 0, 'kg'),
  makeItem('Amul Ghee', '04059020', '', '', 2, 0, '', '', 600, 550, 0, 12, 'ltr'),
  makeItem('Red Label Tea', '09024010', '', '', 4, 0, '', '', 200, 180, 0, 5, '250g'),
];
const furnitureItems = [
  makeItem('Sheesham Dining Table', '94036000', 'Solid Sheesham Wood, Natural Finish', '180x90x76 cm', 1, 0, '', '', 0, 45000, 0, 18, 'Nos'),
  makeItem('Dining Chair Set (6)', '94013000', 'Cushioned, Walnut Finish', '45x45x90 cm each', 1, 0, '', '', 0, 24000, 0, 18, 'Set'),
  makeItem('TV Unit Wall Mount', '94036000', 'Engineered Wood, Matte', '150x40x50 cm', 1, 0, '', '', 0, 18500, 0, 18, 'Nos'),
];
const servicesItems = [
  makeItem('Website Development (Full Stack)', '998314', '', '', 1, 0, '', '', 0, 85000, 0, 18, 'Project'),
  makeItem('UI/UX Design (per page)', '998314', '', '', 12, 0, '', '', 0, 5000, 0, 18, 'Pages'),
  makeItem('SEO Setup & Optimization', '998366', '', '', 1, 0, '', '', 0, 25000, 0, 18, 'Package'),
];

const industrySamples: Record<string, typeof pharmaSample> = {
  'Electronics / Mobile': {
    company: { ...defaultCompany, companyName: 'Mobile Galaxy', dlNumber1: '', dlNumber2: '' },
    invoice: makeInvoice(electronicsItems),
    customer: { ...defaultCustomer, customerName: 'Raj Electronics' },
    items: electronicsItems,
  },
  'Restaurant / Food': {
    company: { ...defaultCompany, companyName: 'Spice Garden Restaurant', fssaiNumber: '11526008000123', dlNumber1: '', dlNumber2: '' },
    invoice: makeInvoice(restaurantItems, { type: 'Food Bill', serviceCharge: 500 }),
    customer: { ...defaultCustomer, customerName: 'Walk-in Customer', gstin: '' },
    items: restaurantItems,
  },
  'Grocery / Kirana': {
    company: { ...defaultCompany, companyName: 'Sharma Kirana Store', dlNumber1: '', dlNumber2: '' },
    invoice: makeInvoice(groceryItems),
    customer: { ...defaultCustomer, customerName: 'Cash Customer', gstin: '' },
    items: groceryItems,
  },
  'Furniture / Hardware': {
    company: { ...defaultCompany, companyName: 'Royal Furniture House', dlNumber1: '', dlNumber2: '' },
    invoice: makeInvoice(furnitureItems),
    customer: { ...defaultCustomer, customerName: 'Mr. Anil Gupta' },
    items: furnitureItems,
  },
  'Services Invoice': {
    company: { ...defaultCompany, companyName: 'TechSoft Solutions Pvt. Ltd.', dlNumber1: '', dlNumber2: '' },
    invoice: makeInvoice(servicesItems, { type: 'Service Invoice' }),
    customer: { ...defaultCustomer, customerName: 'Global Corp Ltd.' },
    items: servicesItems,
  },
};

industrySamples['General GST'] = { ...pharmaSample, company: { ...defaultCompany, companyName: 'ABC Trading Company', dlNumber1: '', dlNumber2: '' } };
industrySamples['Indian Retail Bill'] = { ...pharmaSample, company: { ...defaultCompany, companyName: 'Ram General Store', dlNumber1: '', dlNumber2: '' } };
industrySamples['Proforma Invoice'] = { ...pharmaSample, company: { ...defaultCompany, companyName: 'BuildMart Supplies', dlNumber1: '', dlNumber2: '' }, invoice: makeInvoice(pharmaItems, { type: 'Proforma' }) };

export default createEndpoint({
  authenticated: true,
  description: 'Generate a preview PDF with sample data for a given template',
  inputSchema: z.object({ template: z.string() }),
  outputSchema: z.object({ url: z.string() }),
  execute: async ({ input }) => {
    const opts = { showLogo: true, showBankDetails: true, showSignature: true, showQrCode: false, customFooterText: '' };
    const sample = industrySamples[input.template] || pharmaSample;
    let html: string;

    switch (input.template) {
      case 'Modern GST': html = renderModernGst(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Retail Invoice': html = renderRetailInvoice(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Wholesale Invoice': html = renderWholesaleInvoice(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Delivery Challan': html = renderPharmaChallan(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Tax Invoice Premium': html = renderTaxInvoicePremium(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Thermal Receipt': html = renderThermalReceipt(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'General GST': html = renderGeneralGst(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Indian Retail Bill': html = renderIndianRetailBill(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Electronics / Mobile': html = renderElectronicsInvoice(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Restaurant / Food': html = renderRestaurantBill(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Grocery / Kirana': html = renderGroceryInvoice(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Furniture / Hardware': html = renderFurnitureInvoice(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Services Invoice': html = renderServicesInvoice(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      case 'Proforma Invoice': html = renderProformaInvoice(sample.company, sample.invoice, sample.customer, sample.items, opts); break;
      default: html = renderClassicGst(sample.company, sample.invoice, sample.customer, sample.items, opts);
    }

    const { url } = await ZitePdf.renderHtml({ html, filename: `preview-${input.template}.pdf` });
    return { url };
  },
});
