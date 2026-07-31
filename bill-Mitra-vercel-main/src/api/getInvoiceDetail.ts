import { z } from 'zod';
import { createEndpoint, Invoices, InvoiceItems, Customers, Companies, Payments, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ invoiceId: z.string() }),
  outputSchema: z.object({ invoice: z.any(), items: z.array(z.any()), customer: z.any().nullable(), company: z.any().nullable(), payments: z.array(z.any()) }),
  execute: async ({ input, context }) => {
    const invoice = await Invoices.findOne({ id: input.invoiceId });
    if (!invoice) throw new ZiteError({ code: 'NOT_FOUND', message: 'Invoice not found' });

    const ownerId = Array.isArray(invoice.createdBy) ? invoice.createdBy[0] : invoice.createdBy;
    if (ownerId && ownerId !== context.user.id) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const { records: items } = await InvoiceItems.findAll({ filters: { invoice: input.invoiceId }, limit: 100 });
    const customerId = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
    const customer = customerId ? await Customers.findOne({ id: customerId }) : null;
    const companyId = Array.isArray(invoice.company) ? invoice.company[0] : invoice.company;
    const company = companyId ? await Companies.findOne({ id: companyId }) : null;
    const { records: payments } = await Payments.findAll({ filters: { invoice: input.invoiceId }, limit: 100 });

    return { invoice, items, customer: customer || null, company: company || null, payments };
  },
});
