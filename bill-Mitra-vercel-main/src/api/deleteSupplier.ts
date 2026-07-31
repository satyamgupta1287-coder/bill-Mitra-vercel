import { z } from 'zod';
import { createEndpoint, Suppliers, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const existing = await Suppliers.findOne({ id: input.id });
    const ownerId = Array.isArray(existing?.owner) ? existing.owner[0] : existing?.owner;
    if (!existing || ownerId !== context.user.id) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }
    await Suppliers.delete({ id: input.id });
    return { success: true };
  },
});
