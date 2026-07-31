import { z } from 'zod';
import { createEndpoint, Licenses, ActivationLogs, ZiteError } from 'zite-integrations-backend-sdk';

const PLAN_DURATIONS: Record<string, number | null> = {
  'Lifetime': null,
  '1 Year': 365,
  '6 Month': 180,
  'Trial': 15,
};

function generateSegment(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export default createEndpoint({
  authenticated: true,
  description: 'Activate a license key for the current user',
  inputSchema: z.object({
    licenseKey: z.string().min(1),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ input, context }) => {
    const userId = context.user.id;
    const keyInput = input.licenseKey.trim().toUpperCase();

    // Brute-force check: count recent failed attempts (last 15 min)
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { records: recentAttempts } = await ActivationLogs.findAll({
      filters: {
        user: userId,
        action: 'Activation Attempt',
        timestamp: { gte: fifteenMinAgo as any },
      },
      limit: 10,
    });

    if (recentAttempts.length >= 5) {
      throw new ZiteError({
        code: 'RATE_LIMITED',
        message: 'Too many failed attempts. Please wait 15 minutes before trying again.',
      });
    }

    // Find the license by key
    const license = await Licenses.findOne({
      filters: { licenseKey: keyInput },
    });

    if (!license) {
      await ActivationLogs.create({
        record: { user: userId, action: 'Activation Attempt', failureReason: 'Invalid key' },
      });
      throw new ZiteError({ code: 'NOT_FOUND', message: 'Invalid license key. Please check and try again.' });
    }

    if (license.status === 'Active') {
      await ActivationLogs.create({
        record: { user: userId, license: license.id, action: 'Activation Attempt', failureReason: 'Already in use' },
      });
      throw new ZiteError({ code: 'CONFLICT', message: 'This license key is already activated by another account.' });
    }

    if (license.status === 'Disabled' || license.status === 'Revoked') {
      await ActivationLogs.create({
        record: { user: userId, license: license.id, action: 'Activation Attempt', failureReason: `Key is ${license.status}` },
      });
      throw new ZiteError({ code: 'FORBIDDEN', message: `This license key has been ${license.status?.toLowerCase()}.` });
    }

    if (license.status === 'Expired') {
      await ActivationLogs.create({
        record: { user: userId, license: license.id, action: 'Activation Attempt', failureReason: 'Key expired' },
      });
      throw new ZiteError({ code: 'FORBIDDEN', message: 'This license key has expired.' });
    }

    if (license.status !== 'Available') {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'This license key is not available for activation.' });
    }

    // Calculate expiry
    const now = new Date();
    const plan = license.plan || 'Trial';
    const durationDays = PLAN_DURATIONS[plan];
    let expiryDate: string | undefined;
    if (durationDays !== null && durationDays !== undefined) {
      const expiry = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      expiryDate = expiry.toISOString();
    }

    // Activate the license
    await Licenses.update({
      id: license.id,
      record: {
        status: 'Active',
        assignedTo: userId,
        activationDate: now.toISOString(),
        ...(expiryDate ? { expiryDate } : {}),
      },
    });

    // Log success
    await ActivationLogs.create({
      record: { user: userId, license: license.id, action: 'Activation Success' },
    });

    return { success: true, message: 'License activated successfully!' };
  },
});
