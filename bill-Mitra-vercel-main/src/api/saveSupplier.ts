import { z } from 'zod';
import { createEndpoint, Suppliers, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    supplierName: z.string(),
    gstin: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    stateCode: z.string().optional(),
    pincode: z.string().optional(),
    dlNumber: z.string().optional(),
  }),
  outputSchema: z.object({ supplier: z.any() }),
  execute: async ({ input, context }) => {
    const companyId = Array.isArray(context.user.company) ? context.user.company[0] : context.user.company;
    const { id, ...data } = input;

    if (id) {
      const existing = await Suppliers.findOne({ id });
      const ownerId = Array.isArray(existing?.owner) ? existing.owner[0] : existing?.owner;
      if (!existing || ownerId !== context.user.id) {
        throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      await Suppliers.update({ id, record: data });
      const supplier = await Suppliers.findOne({ id });
      return { supplier };
    } else {
      const record: any = { ...data, owner: context.user.id };
      if (companyId) record.company = companyId;
      const supplier = await Suppliers.create({ record });
      return { supplier };
    }
  },
});
