import { z } from 'zod';
import { createEndpoint, Purchases, Products, Customers } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
  }),
  outputSchema: z.object({ bills: z.array(z.any()), allPurchases: z.array(z.any()) }),
  execute: async ({ input, context }) => {
    const filters: any = { owner: context.user.id };
    const result = await Purchases.findAll({ filters, limit: 500 });

    const prodIds = new Set<string>();
    const suppIds = new Set<string>();
    result.records.forEach(p => {
      const pid = Array.isArray(p.product) ? p.product[0] : p.product;
      const sid = Array.isArray(p.supplier) ? p.supplier[0] : p.supplier;
      if (pid) prodIds.add(pid);
      if (sid) suppIds.add(sid);
    });
    const prodMap: Record<string, any> = {};
    const suppMap: Record<string, string> = {};
    if (prodIds.size) {
      const { records } = await Products.findAll({ filters: { id: { in: Array.from(prodIds) } }, limit: 500 });
      records.forEach(r => { prodMap[r.id] = r; });
    }
    if (suppIds.size) {
      const { records } = await Customers.findAll({ filters: { id: { in: Array.from(suppIds) } }, limit: 200 });
      records.forEach(r => { suppMap[r.id] = r.customerName || ''; });
    }

    const allPurchases = result.records.map(p => {
      const pid = Array.isArray(p.product) ? p.product[0] : (p.product || '');
      const sid = Array.isArray(p.supplier) ? p.supplier[0] : (p.supplier || '');
      const prod = prodMap[pid];
      return {
        ...p,
        productName: prod?.productName || '',
        manufacturer: prod?.manufacturer || '',
        packSize: prod?.packSize || '',
        supplierName: suppMap[sid] || '',
      };
    });

    const billMap = new Map<string, any>();
    for (const p of allPurchases) {
      const key = p.purchaseNumber || p.id;
      if (!billMap.has(key)) {
        billMap.set(key, {
          purchaseNumber: p.purchaseNumber,
          purchaseDate: p.purchaseDate,
          supplierName: p.supplierName || '',
          supplierInvoiceNumber: p.supplierInvoiceNumber || '',
          items: [],
          totalAmount: 0,
          totalItems: 0,
        });
      }
      const bill = billMap.get(key)!;
      bill.items.push(p);
      bill.totalAmount += p.totalAmount || 0;
      bill.totalItems += 1;
      if (!bill.supplierName && p.supplierInvoiceNumber) {
        bill.supplierName = p.supplierInvoiceNumber;
      }
    }

    const bills = Array.from(billMap.values()).sort((a, b) => {
      if (a.purchaseDate && b.purchaseDate) return b.purchaseDate.localeCompare(a.purchaseDate);
      return 0;
    });

    return { bills, allPurchases };
  },
});
