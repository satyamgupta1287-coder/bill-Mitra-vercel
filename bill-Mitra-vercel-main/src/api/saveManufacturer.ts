import { z } from 'zod';
import { createEndpoint, Manufacturers, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    manufacturerName: z.string(),
    shortCode: z.string().optional(),
  }),
  outputSchema: z.object({ manufacturer: z.any() }),
  execute: async ({ input, context }) => {
    const companyId = Array.isArray(context.user.company) ? context.user.company[0] : context.user.company;
    const { id, ...data } = input;

    if (id) {
      const existing = await Manufacturers.findOne({ id });
      const ownerId = Array.isArray(existing?.owner) ? existing.owner[0] : existing?.owner;
      if (!existing || ownerId !== context.user.id) {
        throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      await Manufacturers.update({ id, record: data });
      const manufacturer = await Manufacturers.findOne({ id });
      return { manufacturer };
    } else {
      const record: any = { ...data, owner: context.user.id };
      if (companyId) record.company = companyId;
      const manufacturer = await Manufacturers.create({ record });
      return { manufacturer };
    }
  },
});
