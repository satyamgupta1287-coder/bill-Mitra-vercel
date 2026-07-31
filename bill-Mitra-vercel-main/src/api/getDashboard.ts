import { z } from 'zod';
import { createEndpoint, Invoices, Customers } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    totalInvoices: z.number(),
    totalRevenue: z.number(),
    totalPending: z.number(),
    totalOverdue: z.number(),
    totalCustomers: z.number(),
    totalCgst: z.number(),
    totalSgst: z.number(),
    totalIgst: z.number(),
    recentInvoices: z.array(z.any()),
    monthlyRevenue: z.array(z.object({ month: z.string(), revenue: z.number() })),
  }),
  execute: async ({ input, context }) => {
    const { records: invoices } = await Invoices.findAll({ filters: { createdBy: context.user.id }, limit: 2000 });
    const { records: customers } = await Customers.findAll({ filters: { owner: context.user.id }, limit: 2000 });

    const totalRevenue = invoices.filter(i => i.status === 'Paid' || i.status === 'Partially Paid').reduce((s, i) => s + (i.amountPaid || 0), 0);
    const totalPending = invoices.filter(i => i.status === 'Pending' || i.status === 'Partially Paid').reduce((s, i) => s + (i.balanceDue || 0), 0);
    const totalOverdue = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + (i.balanceDue || 0), 0);
    const totalCgst = invoices.reduce((s, i) => s + (i.cgstAmount || 0), 0);
    const totalSgst = invoices.reduce((s, i) => s + (i.sgstAmount || 0), 0);
    const totalIgst = invoices.reduce((s, i) => s + (i.igstAmount || 0), 0);

    const monthlyMap: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.invoiceDate) {
        const d = new Date(inv.invoiceDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap[key] = (monthlyMap[key] || 0) + (inv.totalAmount || 0);
      }
    });
    const monthlyRevenue = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, revenue]) => ({ month, revenue }));

    const recentInvoices = invoices
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 10);

    return {
      totalInvoices: invoices.length,
      totalRevenue,
      totalPending,
      totalOverdue,
      totalCustomers: customers.length,
      totalCgst,
      totalSgst,
      totalIgst,
      recentInvoices,
      monthlyRevenue,
    };
  },
});
