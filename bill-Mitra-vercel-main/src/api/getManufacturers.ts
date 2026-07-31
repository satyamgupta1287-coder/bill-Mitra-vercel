import { z } from 'zod';
import { createEndpoint, Manufacturers } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
  }),
  outputSchema: z.object({ manufacturers: z.array(z.any()) }),
  execute: async ({ input, context }) => {
    const filters: any = { owner: context.user.id };
    if (input.search) filters.manufacturerName = { contains: input.search };
    const result = await Manufacturers.findAll({ filters, limit: 500 });
    return { manufacturers: result.records };
  },
});
