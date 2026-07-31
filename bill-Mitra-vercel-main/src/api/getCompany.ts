import { z } from 'zod';
import { createEndpoint, Companies } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ companyId: z.string().optional() }),
  outputSchema: z.object({ company: z.any().nullable() }),
  execute: async ({ input, context }) => {
    const companyId = input.companyId || (Array.isArray(context.user.company) ? context.user.company[0] : context.user.company);
    if (!companyId) return { company: null };
    const company = await Companies.findOne({ id: companyId });
    return { company: company || null };
  },
});
