import { z } from 'zod';
import { createEndpoint, Products } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({ products: z.array(z.any()), hasMore: z.boolean() }),
  execute: async ({ input, context }) => {
    const filters: any = { owner: context.user.id };
    if (input.search) filters.productName = { contains: input.search };
    const limit = Math.min(input.limit || 100, 500);
    const result = await Products.findAll({ filters, offset: input.offset || 0, limit });
    return { products: result.records, hasMore: result.hasMore };
  },
});
