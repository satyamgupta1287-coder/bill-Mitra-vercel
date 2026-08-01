import { z } from 'zod';
import { createEndpoint, Purchases, Products, Suppliers } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    purchaseDate: z.string(),
    supplierId: z.string().optional(),
    supplierInvoiceNumber: z.string().optional(),
    items: z.array(z.object({
      productId: z.string().optional(),
      itemName: z.string(),
      hsnSacCode: z.string().optional(),
      batchNumber: z.string(),
      expiryDate: z.string().optional(),
      quantity: z.number(),
      freeQuantity: z.number().optional(),
      purchaseRate: z.number(),
      saleRate: z.number().optional(),
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

    // Handle missing product IDs by matching existing product names or creating new ones
    const { records: userProducts } = await Products.findAll({ filters: { owner: context.user.id }, limit: 500 });

    for (const item of input.items) {
      if (!item.productId) {
        const trimmedName = item.itemName.trim().toLowerCase();
        const matched = userProducts.find((p: any) => p.productName && p.productName.trim().toLowerCase() === trimmedName);
        if (matched) {
          item.productId = matched.id;
        } else {
          const newProdRec: any = {
            productName: item.itemName,
            hsnSacCode: item.hsnSacCode || '',
            packSize: item.packSize || '',
            manufacturer: item.manufacturer || '',
            unitPrice: item.saleRate || item.mrp || item.purchaseRate,
            mrp: item.mrp,
            gstPercentage: item.gstPercentage,
            stockQuantity: 0,
            status: 'Active',
            owner: context.user.id
          };
          if (companyId) newProdRec.company = companyId;
          const newProd = await Products.create({ record: newProdRec });
          item.productId = newProd.id;
        }
      }
    }

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
        unitPrice: item.saleRate || item.purchaseRate,
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

    const productUpdates = new Map<string, { addStock: number; mrp: number; saleRate?: number }>();
    for (const item of input.items) {
      if (!item.productId) continue;
      const totalStock = item.quantity + (item.freeQuantity || 0);
      const existing = productUpdates.get(item.productId);
      if (existing) {
        existing.addStock += totalStock;
        existing.mrp = item.mrp;
        if (item.saleRate) existing.saleRate = item.saleRate;
      } else {
        productUpdates.set(item.productId, { addStock: totalStock, mrp: item.mrp, saleRate: item.saleRate });
      }
    }

    const prodIds = Array.from(productUpdates.keys());
    if (prodIds.length > 0) {
      const { records: products } = await Products.findAll({ filters: { id: { in: prodIds } }, limit: 200 });
      for (const p of products) {
        const upd = productUpdates.get(p.id);
        const updRec: any = {
          stockQuantity: (p.stockQuantity || 0) + (upd?.addStock || 0),
          mrp: upd?.mrp || p.mrp,
        };
        if (upd?.saleRate) updRec.unitPrice = upd.saleRate;
        await Products.update({ id: p.id, record: updRec });
      }
    }

    return { purchaseCount: input.items.length, purchaseNumber: refNum };
  },
});
