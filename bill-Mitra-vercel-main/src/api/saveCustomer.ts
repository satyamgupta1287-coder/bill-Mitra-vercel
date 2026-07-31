import { z } from 'zod';
import { createEndpoint, Customers, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    customerName: z.string(),
    customerType: z.enum(['Retailer', 'Wholesaler', 'Challan']).optional(),
    gstin: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    billingAddress: z.string().optional(),
    billingCity: z.string().optional(),
    billingState: z.string().optional(),
    billingStateCode: z.string().optional(),
    billingPincode: z.string().optional(),
    shippingAddress: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingState: z.string().optional(),
    shippingPincode: z.string().optional(),
  }),
  outputSchema: z.object({ customer: z.any() }),
  execute: async ({ input, context }) => {
    const { id, ...data } = input;
    const companyId = Array.isArray(context.user.company) ? context.user.company[0] : context.user.company;

    if (id) {
      const existing = await Customers.findOne({ id });
      const ownerId = Array.isArray(existing?.owner) ? existing.owner[0] : existing?.owner;
      if (!existing || ownerId !== context.user.id) {
        throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      await Customers.update({ id, record: data });
      const customer = await Customers.findOne({ id });
      return { customer };
    } else {
      const record: any = { ...data, owner: context.user.id };
      if (companyId) record.company = companyId;
      const customer = await Customers.create({ record });
      return { customer };
    }
  },
});
