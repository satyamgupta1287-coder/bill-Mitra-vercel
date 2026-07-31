import { z } from 'zod';
import { createEndpoint, Licenses, ZiteError } from 'zite-integrations-backend-sdk';

function generateSegment(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function generateKey(): string {
  return `BILLMITRA-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
}

export default createEndpoint({
  authenticated: true,
  description: 'Generate new license keys (admin only)',
  inputSchema: z.object({
    plan: z.enum(['Lifetime', '1 Year', '6 Month', 'Trial']),
    quantity: z.number().min(1).max(25),
  }),
  outputSchema: z.object({
    keys: z.array(z.string()),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Only admins can generate licenses.' });
    }

    const keys: string[] = [];
    const records: { licenseKey: string; plan: string; status: string }[] = [];
    for (let i = 0; i < input.quantity; i++) {
      const key = generateKey();
      keys.push(key);
      records.push({ licenseKey: key, plan: input.plan, status: 'Available' });
    }

    await Licenses.bulkCreate({ records });

    return { keys };
  },
});
