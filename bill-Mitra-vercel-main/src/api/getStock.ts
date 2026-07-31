import { z } from 'zod';
import { createEndpoint, Purchases, Products } from 'zite-integrations-backend-sdk';

// Helper to fetch ALL records from a table by paginating
async function fetchAll(table: typeof Products | typeof Purchases, filters: any): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const limit = 500;
  while (true) {
    const { records, hasMore } = await table.findAll({ filters, offset, limit });
    all.push(...records);
    if (!hasMore) break;
    offset += limit;
  }
  return all;
}

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    productId: z.string().optional(),
    includeAllProducts: z.boolean().optional(),
  }),
  outputSchema: z.object({ stock: z.array(z.any()), products: z.array(z.any()) }),
  execute: async ({ input, context }) => {
    const purchaseFilters: any = { owner: context.user.id, currentStock: { gt: 0 } };
    if (input.productId) purchaseFilters.product = input.productId;

    // Fetch ALL purchases and ALL products (paginated)
    const [allPurchases, allProducts] = await Promise.all([
      fetchAll(Purchases, purchaseFilters),
      fetchAll(Products, { owner: context.user.id }),
    ]);

    const prodMap: Record<string, any> = {};
    allProducts.forEach(p => { prodMap[p.id] = p; });

    const stock = allPurchases.map(r => {
      const pid = Array.isArray(r.product) ? r.product[0] : r.product;
      const prod = pid ? prodMap[pid] : null;
      return {
        ...r,
        productName: prod?.productName || '',
        manufacturer: prod?.manufacturer || '',
        packSize: prod?.packSize || '',
        hsnSacCode: prod?.hsnSacCode || '',
        gstPercentage: prod?.gstPercentage || r.gstPercentage || 0,
        unitPrice: prod?.unitPrice || r.purchaseRate || 0,
      };
    });

    const products = allProducts.map(p => ({
      id: p.id,
      productName: p.productName || '',
      hsnSacCode: p.hsnSacCode || '',
      manufacturer: p.manufacturer || '',
      packSize: p.packSize || '',
      unitPrice: p.unitPrice || 0,
      mrp: p.mrp || 0,
      gstPercentage: p.gstPercentage || 0,
      unit: p.unit || '',
    }));

    return { stock, products };
  },
});
