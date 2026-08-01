import { z } from 'zod';
import { createEndpoint, Locations, Products } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await Locations.delete({ id: input.id });

    const productsRes = await Products.findAll({ filters: { owner: context.user.id }, limit: 1000 });
    for (const p of productsRes.records) {
      if (p.locationId === input.id) {
        await Products.update({ id: p.id, data: { locationId: null, rackLocation: '' } });
      }
    }

    return { success: true };
  },
});
