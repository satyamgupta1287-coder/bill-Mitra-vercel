import { z } from 'zod';
import { createEndpoint, Products } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
    composition: z.string().optional(),
    rackLocation: z.string().optional(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({ products: z.array(z.any()), hasMore: z.boolean() }),
  execute: async ({ input, context }) => {
    const { records } = await Products.findAll({ filters: { owner: context.user.id } });
    let filtered = records;

    if (input.composition) {
      const cLower = input.composition.toLowerCase();
      filtered = filtered.filter((p: any) => p.composition?.toLowerCase().includes(cLower));
    }

    if (input.rackLocation) {
      const rLower = input.rackLocation.toLowerCase();
      filtered = filtered.filter((p: any) => p.rackLocation?.toLowerCase().includes(rLower));
    }

    if (input.search) {
      const sLower = input.search.toLowerCase();
      filtered = filtered.filter((p: any) =>
        p.productName?.toLowerCase().includes(sLower) ||
        p.composition?.toLowerCase().includes(sLower) ||
        p.rackLocation?.toLowerCase().includes(sLower) ||
        p.manufacturer?.toLowerCase().includes(sLower) ||
        p.hsnSacCode?.toLowerCase().includes(sLower) ||
        p.packSize?.toLowerCase().includes(sLower) ||
        p.description?.toLowerCase().includes(sLower)
      );
    }

    const offset = input.offset || 0;
    const limit = Math.min(input.limit || 100, 500);
    const sliced = filtered.slice(offset, offset + limit);
    return { products: sliced, hasMore: offset + limit < filtered.length };
  },
});

