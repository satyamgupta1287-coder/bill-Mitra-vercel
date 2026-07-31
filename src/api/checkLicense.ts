import { z } from 'zod';
import { createEndpoint, Licenses } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  description: 'Check if the current user has a valid active license',
  inputSchema: z.object({}),
  outputSchema: z.object({
    hasValidLicense: z.boolean(),
    license: z.object({
      id: z.string(),
      plan: z.string(),
      status: z.string(),
      expiryDate: z.string().nullable(),
      activationDate: z.string().nullable(),
    }).nullable(),
  }),
  execute: async ({ context }) => {
    // Admin users always bypass license check
    if (context.user.role === 'Admin') {
      return { hasValidLicense: true, license: null };
    }

    // Find active license assigned to this user
    const { records } = await Licenses.findAll({
      filters: {
        assignedTo: context.user.id,
        status: 'Active',
      },
      limit: 1,
    });

    if (records.length === 0) {
      return { hasValidLicense: false, license: null };
    }

    const lic = records[0];

    // Check expiry
    if (lic.expiryDate && new Date(lic.expiryDate) < new Date()) {
      // Mark as expired
      await Licenses.update({ id: lic.id, record: { status: 'Expired' } });
      return { hasValidLicense: false, license: null };
    }

    return {
      hasValidLicense: true,
      license: {
        id: lic.id,
        plan: lic.plan || '',
        status: lic.status || '',
        expiryDate: lic.expiryDate || null,
        activationDate: lic.activationDate || null,
      },
    };
  },
});
