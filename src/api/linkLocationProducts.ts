import { z } from 'zod';
import { createEndpoint, Products } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    locationId: z.string(),
    locationName: z.string(),
    productIdsToAdd: z.array(z.string()).optional(),
    productIdsToRemove: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), updatedCount: z.number() }),
  execute: async ({ input }) => {
    let count = 0;
    if (input.productIdsToAdd && input.productIdsToAdd.length > 0) {
      for (const pid of input.productIdsToAdd) {
        await Products.update({
          id: pid,
          data: {
            locationId: input.locationId,
            rackLocation: input.locationName,
          },
        });
        count++;
      }
    }

    if (input.productIdsToRemove && input.productIdsToRemove.length > 0) {
      for (const pid of input.productIdsToRemove) {
        await Products.update({
          id: pid,
          data: {
            locationId: null,
            rackLocation: '',
          },
        });
        count++;
      }
    }

    return { success: true, updatedCount: count };
  },
});
