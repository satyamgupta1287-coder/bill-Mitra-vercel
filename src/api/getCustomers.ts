import { z } from 'zod';
import { createEndpoint, Customers } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({ customers: z.array(z.any()), hasMore: z.boolean() }),
  execute: async ({ input, context }) => {
    const filters: any = { owner: context.user.id };
    if (input.search) filters.customerName = { contains: input.search };
    const result = await Customers.findAll({ filters, offset: input.offset || 0, limit: input.limit || 50 });
    return { customers: result.records, hasMore: result.hasMore };
  },
});
