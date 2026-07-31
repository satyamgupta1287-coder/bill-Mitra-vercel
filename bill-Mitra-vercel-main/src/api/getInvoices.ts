import { z } from 'zod';
import { createEndpoint, Invoices, Customers } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    type: z.string().optional(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({ invoices: z.array(z.any()), hasMore: z.boolean() }),
  execute: async ({ input, context }) => {
    const filters: any = { createdBy: context.user.id };
    if (input.status) filters.status = input.status;
    if (input.type) filters.type = input.type;
    if (input.search) filters.invoiceNumber = { contains: input.search };

    const result = await Invoices.findAll({ filters, offset: input.offset || 0, limit: input.limit || 50 });

    const customerIds = new Set<string>();
    result.records.forEach(inv => {
      const cid = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
      if (cid) customerIds.add(cid);
    });

    const customerMap: Record<string, string> = {};
    if (customerIds.size > 0) {
      const { records: custs } = await Customers.findAll({ filters: { id: { in: Array.from(customerIds) } }, limit: 100 });
      custs.forEach(c => { customerMap[c.id] = c.customerName || ''; });
    }

    const invoices = result.records.map(inv => ({
      ...inv,
      customerName: customerMap[Array.isArray(inv.customer) ? inv.customer[0] : (inv.customer || '')] || 'Unknown',
    }));

    return { invoices, hasMore: result.hasMore };
  },
});
