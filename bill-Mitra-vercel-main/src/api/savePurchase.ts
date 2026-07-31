import { z } from 'zod';
import { createEndpoint, Purchases, Products, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    purchaseDate: z.string(),
    supplierId: z.string().optional(),
    supplierInvoiceNumber: z.string().optional(),
    productId: z.string(),
    batchNumber: z.string(),
    expiryDate: z.string().optional(),
    quantity: z.number(),
    freeQuantity: z.number().optional(),
    purchaseRate: z.number(),
    mrp: z.number(),
    gstPercentage: z.number(),
  }),
  outputSchema: z.object({ purchase: z.any() }),
  execute: async ({ input, context }) => {
    const companyId = Array.isArray(context.user.company) ? context.user.company[0] : context.user.company;
    const gstAmt = input.quantity * input.purchaseRate * (input.gstPercentage / 100);
    const totalAmt = input.quantity * input.purchaseRate + gstAmt;
    const totalStock = input.quantity + (input.freeQuantity || 0);

    const record: any = {
      purchaseDate: input.purchaseDate,
      supplierInvoiceNumber: input.supplierInvoiceNumber,
      product: input.productId,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate,
      quantity: input.quantity,
      freeQuantity: input.freeQuantity || 0,
      purchaseRate: input.purchaseRate,
      mrp: input.mrp,
      gstPercentage: input.gstPercentage,
      totalAmount: totalAmt,
      currentStock: totalStock,
      status: 'Active',
    };
    if (companyId) record.company = companyId;
    if (input.supplierId) record.supplier = input.supplierId;

    if (input.id) {
      const existing = await Purchases.findOne({ id: input.id });
      const ownerId = Array.isArray(existing?.owner) ? existing.owner[0] : existing?.owner;
      if (!existing || ownerId !== context.user.id) {
        throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      await Purchases.update({ id: input.id, record });
      const purchase = await Purchases.findOne({ id: input.id });
      return { purchase };
    } else {
      record.owner = context.user.id;
      const refNum = `PUR-${Date.now().toString(36).toUpperCase()}`;
      record.purchaseNumber = refNum;
      const purchase = await Purchases.create({ record });

      const product = await Products.findOne({ id: input.productId });
      if (product) {
        await Products.update({
          id: input.productId,
          record: {
            stockQuantity: (product.stockQuantity || 0) + totalStock,
            mrp: input.mrp,
          },
        });
      }
      return { purchase };
    }
  },
});
