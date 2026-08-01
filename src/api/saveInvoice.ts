import { z } from 'zod';
import { createEndpoint, Invoices, InvoiceItems, Companies, Purchases, Products, Customers, ZiteError } from 'zite-integrations-backend-sdk';

const itemSchema = z.object({
  itemName: z.string(),
  productId: z.string().optional(),
  purchaseId: z.string().optional(),
  hsnSacCode: z.string().optional(),
  quantity: z.number(),
  freeQuantity: z.number().optional(),
  unit: z.string().optional(),
  unitPrice: z.number(), // GST-inclusive rate
  mrp: z.number().optional(),
  gstPercentage: z.number(),
  discountPercent: z.number().optional(), // percentage discount
  discountAmount: z.number().optional(), // flat ₹ per-unit discount (for electronics)
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  manufacturer: z.string().optional(),
  packSize: z.string().optional(),
});

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    invoiceId: z.string().optional(),
    type: z.string(),
    selectedTemplate: z.string().optional(),
    status: z.string(),
    invoiceDate: z.string(),
    dueDate: z.string().optional(),
    customerId: z.string().optional(),
    manualCustomerName: z.string().optional(),
    manualCustomerAddress: z.string().optional(),
    manualCustomerPhone: z.string().optional(),
    placeOfSupply: z.string().optional(),
    placeOfSupplyCode: z.string().optional(),
    reverseCharge: z.boolean().optional(),
    notes: z.string().optional(),
    terms: z.string().optional(),
    transport: z.string().optional(),
    lrNumber: z.string().optional(),
    cases: z.number().optional(),
    items: z.array(itemSchema),
  }),
  outputSchema: z.object({ invoice: z.any() }),
  execute: async ({ input, context }) => {
    const companyId = Array.isArray(context.user.company) ? context.user.company[0] : context.user.company;

    if (input.invoiceId) {
      const existing = await Invoices.findOne({ id: input.invoiceId });
      const ownerId = Array.isArray(existing?.createdBy) ? existing.createdBy[0] : existing?.createdBy;
      if (!existing || (ownerId && ownerId !== context.user.id)) {
        throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
    }

    let companyStateCode = '';
    let invoiceNumber = '';
    if (companyId) {
      const company = await Companies.findOne({ id: companyId });
      if (company) {
        companyStateCode = company.stateCode || '';
        if (!input.invoiceId) {
          const prefix = company.invoicePrefix || 'INV';
          const num = company.nextInvoiceNumber || 1;
          invoiceNumber = `${prefix}-${String(num).padStart(5, '0')}`;
          await Companies.update({ id: companyId, record: { nextInvoiceNumber: num + 1 } });
        }
      }
    }

    const isInterstate = input.placeOfSupplyCode && companyStateCode && input.placeOfSupplyCode !== companyStateCode;

    let subtotal = 0; // sum of extracted taxable values
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalDiscount = 0;

    const processedItems = input.items.map(item => {
      const qty = item.quantity;
      const rate = item.unitPrice;
      const grossAmount = qty * rate;

      // Calculate discount (flat ₹ per unit OR percentage)
      let discountTotal = 0;
      const discAmt = item.discountAmount || 0;
      const discPct = item.discountPercent || 0;

      if (discAmt > 0) {
        discountTotal = discAmt * qty;
      } else if (discPct > 0) {
        discountTotal = grossAmount * (discPct / 100);
      }

      // lineAmount = GST-inclusive customer price for this line
      const lineAmount = grossAmount - discountTotal;
      totalDiscount += discountTotal;

      // EXTRACT GST from inclusive amount (not add on top)
      const gstRate = item.gstPercentage / 100;
      const taxableAmount = lineAmount / (1 + gstRate);
      const gstAmount = lineAmount - taxableAmount;

      let cgst = 0, sgst = 0, igst = 0;
      if (isInterstate) {
        igst = gstAmount;
        totalIgst += igst;
      } else {
        cgst = gstAmount / 2;
        sgst = gstAmount / 2;
        totalCgst += cgst;
        totalSgst += sgst;
      }

      subtotal += taxableAmount;

      // Store discountPercent (compute from flat amount if needed)
      const storedDiscPct = discAmt > 0 ? (rate > 0 ? (discAmt / rate * 100) : 0) : discPct;

      return {
        itemName: item.itemName,
        product: item.productId || undefined,
        hsnSacCode: item.hsnSacCode,
        quantity: qty,
        freeQuantity: item.freeQuantity || 0,
        unit: item.unit,
        unitPrice: rate,
        mrp: item.mrp || 0,
        gstPercentage: item.gstPercentage,
        discountPercent: Math.round(storedDiscPct * 100) / 100,
        taxableAmount: Math.round(taxableAmount * 100) / 100,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst: Math.round(igst * 100) / 100,
        total: Math.round(lineAmount * 100) / 100, // total = customer pays (GST-inclusive)
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        manufacturer: item.manufacturer,
        packSize: item.packSize,
        purchaseId: item.purchaseId,
      };
    });

    // subtotal = sum of taxable values
    // totalAmount = subtotal + gst = sum of lineAmounts (= customer pays)
    const preRoundTotal = subtotal + totalCgst + totalSgst + totalIgst;
    const roundOff = Math.round(preRoundTotal) - preRoundTotal;
    const totalAmount = Math.round(preRoundTotal);

    let resolvedCustomerId = input.customerId;
    if (!resolvedCustomerId && input.manualCustomerName) {
      const newCust = await Customers.create({
        record: {
          customerName: input.manualCustomerName,
          billingAddress: input.manualCustomerAddress || undefined,
          phone: input.manualCustomerPhone || undefined,
          owner: context.user.id,
          ...(companyId ? { company: companyId } : {}),
        },
      });
      resolvedCustomerId = newCust.id;
    }

    const invoiceRecord: any = {
      type: input.type,
      selectedTemplate: input.selectedTemplate,
      status: input.status,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      customer: resolvedCustomerId || undefined,
      placeOfSupply: input.placeOfSupply,
      placeOfSupplyCode: input.placeOfSupplyCode,
      reverseCharge: input.reverseCharge || false,
      subtotal: Math.round(subtotal * 100) / 100,
      cgstAmount: Math.round(totalCgst * 100) / 100,
      sgstAmount: Math.round(totalSgst * 100) / 100,
      igstAmount: Math.round(totalIgst * 100) / 100,
      discountAmount: Math.round(totalDiscount * 100) / 100,
      roundOff: Math.round(roundOff * 100) / 100,
      totalAmount,
      balanceDue: totalAmount,
      notes: input.notes,
      terms: input.terms,
      transport: input.transport,
      lrNumber: input.lrNumber,
      cases: input.cases,
    };

    if (companyId) invoiceRecord.company = companyId;
    if (!input.invoiceId) {
      invoiceRecord.invoiceNumber = invoiceNumber;
      invoiceRecord.createdBy = context.user.id;
      invoiceRecord.amountPaid = 0;
    }

    let invoice;
    if (input.invoiceId) {
      const existing = await Invoices.findOne({ id: input.invoiceId });
      invoiceRecord.balanceDue = totalAmount - (existing?.amountPaid || 0);
      await Invoices.update({ id: input.invoiceId, record: invoiceRecord });
      const { records: oldItems } = await InvoiceItems.findAll({ filters: { invoice: input.invoiceId }, limit: 100 });
      for (const item of oldItems) {
        await InvoiceItems.delete({ id: item.id });
      }
      invoice = await Invoices.findOne({ id: input.invoiceId });
    } else {
      invoice = await Invoices.create({ record: invoiceRecord });
    }

    if (processedItems.length > 0) {
      await InvoiceItems.bulkCreate({
        records: processedItems.map(item => {
          const { purchaseId, ...rest } = item;
          return { ...rest, invoice: invoice!.id };
        }),
      });

      if (!input.invoiceId) {
        for (const item of processedItems) {
          if (item.purchaseId) {
            const purchase = await Purchases.findOne({ id: item.purchaseId });
            if (purchase) {
              const newStock = Math.max(0, (purchase.currentStock || 0) - item.quantity - (item.freeQuantity || 0));
              const status = newStock === 0 ? 'Out of Stock' : newStock < 10 ? 'Low Stock' : 'Active';
              await Purchases.update({ id: item.purchaseId, record: { currentStock: newStock, status } });
            }
          }
          if (item.product) {
            const prod = await Products.findOne({ id: item.product });
            if (prod) {
              const newProdStock = Math.max(0, (prod.stockQuantity || 0) - item.quantity - (item.freeQuantity || 0));
              await Products.update({ id: item.product, record: { stockQuantity: newProdStock } });
            }
          }
        }
      }
    }

    return { invoice };
  },
});
