import { z } from 'zod';
import { createEndpoint, Products } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    products: z.array(z.object({
      productName: z.string(),
      hsnSacCode: z.string().optional(),
      category: z.string().optional(),
      unit: z.string().optional(),
      unitPrice: z.number().optional(),
      gstPercentage: z.number().optional(),
      stockQuantity: z.number().optional(),
      description: z.string().optional(),
      manufacturer: z.string().optional(),
      packSize: z.string().optional(),
      mrp: z.number().optional(),
      composition: z.string().optional(),
      rackLocation: z.string().optional(),
      scheduleDrug: z.boolean().optional(),
      minStockLevel: z.number().optional(),
    })),
  }),
  outputSchema: z.object({
    created: z.number(),
    errors: z.array(z.object({ row: z.number(), message: z.string() })),
  }),
  execute: async ({ input, context }) => {
    const companyId = Array.isArray(context.user.company) ? context.user.company[0] : context.user.company;
    const validRecords: any[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < input.products.length; i++) {
      const p = input.products[i];
      if (!p.productName || !p.productName.trim()) {
        errors.push({ row: i + 2, message: 'Missing product name' });
        continue;
      }
      const rec: any = { productName: p.productName.trim(), owner: context.user.id };
      if (companyId) rec.company = companyId;
      if (p.hsnSacCode) rec.hsnSacCode = p.hsnSacCode;
      if (p.category) rec.category = p.category;
      if (p.unit) rec.unit = p.unit;
      if (p.unitPrice != null) rec.unitPrice = p.unitPrice;
      if (p.gstPercentage != null) rec.gstPercentage = p.gstPercentage;
      if (p.stockQuantity != null) rec.stockQuantity = p.stockQuantity;
      if (p.description) rec.description = p.description;
      if (p.manufacturer) rec.manufacturer = p.manufacturer;
      if (p.packSize) rec.packSize = p.packSize;
      if (p.mrp != null) rec.mrp = p.mrp;
      validRecords.push(rec);
    }

    // bulkCreate in chunks of 100
    for (let i = 0; i < validRecords.length; i += 100) {
      const chunk = validRecords.slice(i, i + 100);
      await Products.bulkCreate({ records: chunk });
    }

    return { created: validRecords.length, errors };
  },
});
