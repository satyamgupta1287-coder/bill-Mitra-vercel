import { z } from 'zod';
import { createEndpoint, Purchases, Products, Suppliers } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    purchaseDate: z.string(),
    supplierId: z.string().optional(),
    supplierInvoiceNumber: z.string().optional(),
    items: z.array(z.object({
      productId: z.string(),
      itemName: z.string(),
      batchNumber: z.string(),
      expiryDate: z.string().optional(),
      quantity: z.number(),
      freeQuantity: z.number().optional(),
      purchaseRate: z.number(),
      mrp: z.number(),
      gstPercentage: z.number(),
      manufacturer: z.string().optional(),
      packSize: z.string().optional(),
    })),
  }),
  outputSchema: z.object({ purchaseCount: z.number(), purchaseNumber: z.string() }),
  execute: async ({ input, context }) => {
    const companyId = Array.isArray(context.user.company) ? context.user.company[0] : context.user.company;
    const refNum = `PUR-${Date.now().toString(36).toUpperCase()}`;

    let supplierName = '';
    if (input.supplierId) {
      const supplier = await Suppliers.findOne({ id: input.supplierId });
      if (supplier) supplierName = supplier.supplierName || '';
    }

    const invoiceRef = [input.supplierInvoiceNumber, supplierName].filter(Boolean).join(' | ');

    const records = input.items.map(item => {
      const gstAmt = item.quantity * item.purchaseRate * (item.gstPercentage / 100);
      const totalAmt = item.quantity * item.purchaseRate + gstAmt;
      const totalStock = item.quantity + (item.freeQuantity || 0);

      const rec: any = {
        purchaseNumber: refNum,
        purchaseDate: input.purchaseDate,
        supplierInvoiceNumber: invoiceRef || input.supplierInvoiceNumber,
        product: item.productId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        freeQuantity: item.freeQuantity || 0,
        purchaseRate: item.purchaseRate,
        mrp: item.mrp,
        gstPercentage: item.gstPercentage,
        totalAmount: totalAmt,
        currentStock: totalStock,
        status: 'Active',
        owner: context.user.id,
      };
      if (companyId) rec.company = companyId;
      return rec;
    });

    await Purchases.bulkCreate({ records });

    const productUpdates = new Map<string, { addStock: number; mrp: number }>();
    for (const item of input.items) {
      const totalStock = item.quantity + (item.freeQuantity || 0);
      const existing = productUpdates.get(item.productId);
      if (existing) {
        existing.addStock += totalStock;
        existing.mrp = item.mrp;
      } else {
        productUpdates.set(item.productId, { addStock: totalStock, mrp: item.mrp });
      }
    }

    const prodIds = Array.from(productUpdates.keys());
    if (prodIds.length > 0) {
      const { records: products } = await Products.findAll({ filters: { id: { in: prodIds } }, limit: 200 });
      for (const p of products) {
        const upd = productUpdates.get(p.id);
        await Products.update({ id: p.id, record: { stockQuantity: (p.stockQuantity || 0) + (upd?.addStock || 0), mrp: upd?.mrp || p.mrp } });
      }
    }

    return { purchaseCount: input.items.length, purchaseNumber: refNum };
  },
});
