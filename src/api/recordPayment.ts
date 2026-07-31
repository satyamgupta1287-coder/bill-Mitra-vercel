import { z } from 'zod';
import { createEndpoint, Payments, Invoices, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    invoiceId: z.string(),
    amount: z.number(),
    paymentDate: z.string(),
    method: z.string(),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({ payment: z.any(), invoice: z.any() }),
  execute: async ({ input, context }) => {
    const companyId = Array.isArray(context.user.company) ? context.user.company[0] : context.user.company;
    const invoice = await Invoices.findOne({ id: input.invoiceId });
    if (!invoice) throw new ZiteError({ code: 'NOT_FOUND', message: 'Invoice not found' });

    const ownerId = Array.isArray(invoice.createdBy) ? invoice.createdBy[0] : invoice.createdBy;
    if (ownerId && ownerId !== context.user.id) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const refNum = `PAY-${Date.now().toString(36).toUpperCase()}`;
    const payment = await Payments.create({
      record: {
        paymentReference: refNum,
        invoice: input.invoiceId,
        amount: input.amount,
        paymentDate: input.paymentDate,
        method: input.method as any,
        notes: input.notes,
        company: companyId,
      },
    });

    const newPaid = (invoice.amountPaid || 0) + input.amount;
    const newBalance = (invoice.totalAmount || 0) - newPaid;
    let newStatus = invoice.status;
    if (newBalance <= 0) newStatus = 'Paid';
    else if (newPaid > 0) newStatus = 'Partially Paid';

    await Invoices.update({
      id: input.invoiceId,
      record: { amountPaid: newPaid, balanceDue: Math.max(0, newBalance), status: newStatus },
    });

    const updatedInvoice = await Invoices.findOne({ id: input.invoiceId });
    return { payment, invoice: updatedInvoice };
  },
});
