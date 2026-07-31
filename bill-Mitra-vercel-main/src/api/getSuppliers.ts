import { z } from 'zod';
import { createEndpoint, Suppliers } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
  }),
  outputSchema: z.object({ suppliers: z.array(z.any()) }),
  execute: async ({ input, context }) => {
    const filters: any = { owner: context.user.id };
    if (input.search) filters.supplierName = { contains: input.search };
    const result = await Suppliers.findAll({ filters, limit: 200 });
    return { suppliers: result.records };
  },
});
