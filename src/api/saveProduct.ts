import { z } from 'zod';
import { createEndpoint, Products, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    productName: z.string(),
    hsnSacCode: z.string().optional(),
    category: z.string().optional(),
    unit: z.string().optional(),
    unitPrice: z.number(),
    gstPercentage: z.number(),
    stockQuantity: z.number().optional(),
    description: z.string().optional(),
    manufacturer: z.string().optional(),
    packSize: z.string().optional(),
    mrp: z.number().optional(),
    composition: z.string().optional(),
    compositionId: z.string().optional(),
    rackLocation: z.string().optional(),
    locationId: z.string().optional(),
    scheduleDrug: z.boolean().optional(),
    minStockLevel: z.number().optional(),
  }),
  outputSchema: z.object({ product: z.any() }),
  execute: async ({ input, context }) => {
    const { id, ...data } = input;
    const companyId = Array.isArray(context.user.company) ? context.user.company[0] : context.user.company;

    if (id) {
      const existing = await Products.findOne({ id });
      const ownerId = Array.isArray(existing?.owner) ? existing.owner[0] : existing?.owner;
      if (!existing || ownerId !== context.user.id) {
        throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      await Products.update({ id, record: data });
      const product = await Products.findOne({ id });
      return { product };
    } else {
      const record: any = { ...data, owner: context.user.id };
      if (companyId) record.company = companyId;
      const product = await Products.create({ record });
      return { product };
    }
  },
});
