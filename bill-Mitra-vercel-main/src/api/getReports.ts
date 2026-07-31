import { z } from 'zod';
import { createEndpoint, Invoices, Customers } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    reportType: z.string(),
  }),
  outputSchema: z.object({ data: z.any() }),
  execute: async ({ input, context }) => {
    const { records: invoices } = await Invoices.findAll({ filters: { createdBy: context.user.id }, limit: 2000 });
    const filtered = invoices.filter(inv => {
      if (!inv.invoiceDate) return false;
      if (input.startDate && inv.invoiceDate < input.startDate) return false;
      if (input.endDate && inv.invoiceDate > input.endDate) return false;
      return true;
    });

    if (input.reportType === 'sales') {
      const byMonth: Record<string, { revenue: number; count: number; tax: number }> = {};
      filtered.forEach(inv => {
        const m = inv.invoiceDate!.substring(0, 7);
        if (!byMonth[m]) byMonth[m] = { revenue: 0, count: 0, tax: 0 };
        byMonth[m].revenue += inv.totalAmount || 0;
        byMonth[m].count += 1;
        byMonth[m].tax += (inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0);
      });
      return { data: { summary: byMonth, totalRevenue: filtered.reduce((s, i) => s + (i.totalAmount || 0), 0), totalTax: filtered.reduce((s, i) => s + (i.cgstAmount || 0) + (i.sgstAmount || 0) + (i.igstAmount || 0), 0), count: filtered.length } };
    }

    if (input.reportType === 'gst') {
      const gstData = filtered.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        date: inv.invoiceDate,
        type: inv.type,
        subtotal: inv.subtotal || 0,
        cgst: inv.cgstAmount || 0,
        sgst: inv.sgstAmount || 0,
        igst: inv.igstAmount || 0,
        total: inv.totalAmount || 0,
        placeOfSupply: inv.placeOfSupply,
      }));
      return { data: { records: gstData, totalCgst: filtered.reduce((s, i) => s + (i.cgstAmount || 0), 0), totalSgst: filtered.reduce((s, i) => s + (i.sgstAmount || 0), 0), totalIgst: filtered.reduce((s, i) => s + (i.igstAmount || 0), 0) } };
    }

    if (input.reportType === 'customer') {
      const { records: customers } = await Customers.findAll({ filters: { owner: context.user.id }, limit: 500 });
      const custMap: Record<string, { name: string; revenue: number; count: number; outstanding: number }> = {};
      customers.forEach(c => { custMap[c.id] = { name: c.customerName || '', revenue: 0, count: 0, outstanding: 0 }; });
      filtered.forEach(inv => {
        const cid = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
        if (cid && custMap[cid]) {
          custMap[cid].revenue += inv.totalAmount || 0;
          custMap[cid].count += 1;
          custMap[cid].outstanding += inv.balanceDue || 0;
        }
      });
      return { data: { customers: Object.values(custMap).sort((a, b) => b.revenue - a.revenue) } };
    }

    return { data: {} };
  },
});
