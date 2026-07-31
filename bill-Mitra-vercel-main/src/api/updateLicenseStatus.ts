import { z } from 'zod';
import { createEndpoint, Licenses, ActivationLogs, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  description: 'Disable or revoke a license (admin only)',
  inputSchema: z.object({
    licenseId: z.string(),
    action: z.enum(['disable', 'revoke']),
  }),
  outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const license = await Licenses.findOne({ id: input.licenseId });
    if (!license) {
      throw new ZiteError({ code: 'NOT_FOUND', message: 'License not found.' });
    }

    if (input.action === 'disable') {
      await Licenses.update({
        id: license.id,
        record: { status: 'Disabled' },
      });
      return { success: true, message: 'License disabled successfully.' };
    }

    // Revoke: unbind from user
    await Licenses.update({
      id: license.id,
      record: {
        status: 'Revoked',
        assignedTo: '' as any,
        activationDate: '' as any,
        expiryDate: '' as any,
      },
    });

    const userId = Array.isArray(license.assignedTo) ? license.assignedTo[0] : license.assignedTo;
    if (userId) {
      await ActivationLogs.create({
        record: { user: userId, license: license.id, action: 'Revoked' },
      });
    }

    return { success: true, message: 'License revoked successfully.' };
  },
});
