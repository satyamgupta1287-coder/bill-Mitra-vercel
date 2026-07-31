import { z } from 'zod';
import { createEndpoint, Invoices, InvoiceItems, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const existing = await Invoices.findOne({ id: input.id });
    const ownerId = Array.isArray(existing?.createdBy) ? existing.createdBy[0] : existing?.createdBy;
    if (!existing || (ownerId && ownerId !== context.user.id)) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }
    const { records: items } = await InvoiceItems.findAll({ filters: { invoice: input.id }, limit: 100 });
    for (const item of items) {
      await InvoiceItems.delete({ id: item.id });
    }
    await Invoices.delete({ id: input.id });
    return { success: true };
  },
});
