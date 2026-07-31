import { z } from 'zod';
import { createEndpoint, Licenses, Users, ZiteError } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  description: 'Get all licenses with user info (admin only)',
  inputSchema: z.object({
    search: z.string().optional(),
    statusFilter: z.string().optional(),
    planFilter: z.string().optional(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({
    licenses: z.array(z.object({
      id: z.string(),
      licenseKey: z.string(),
      plan: z.string(),
      status: z.string(),
      assignedToEmail: z.string().nullable(),
      assignedToName: z.string().nullable(),
      activationDate: z.string().nullable(),
      expiryDate: z.string().nullable(),
      createdAt: z.string().nullable(),
    })),
    stats: z.object({
      total: z.number(),
      active: z.number(),
      available: z.number(),
      expired: z.number(),
      disabled: z.number(),
      revoked: z.number(),
    }),
    hasMore: z.boolean(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const filters: any = {};
    if (input.statusFilter && input.statusFilter !== 'all') {
      filters.status = input.statusFilter;
    }
    if (input.planFilter && input.planFilter !== 'all') {
      filters.plan = input.planFilter;
    }
    if (input.search) {
      filters.licenseKey = { contains: input.search.toUpperCase() };
    }

    const { records, hasMore } = await Licenses.findAll({
      filters,
      offset: input.offset || 0,
      limit: input.limit || 50,
    });

    // Get assigned user emails
    const userIds = records
      .map(r => {
        const at = r.assignedTo;
        return Array.isArray(at) ? at[0] : at;
      })
      .filter(Boolean) as string[];

    let usersMap: Record<string, { email: string; name: string }> = {};
    if (userIds.length > 0) {
      const { records: users } = await Users.findAll({
        filters: { id: { in: userIds } },
        fields: ['id', 'email', 'name', 'firstName'],
        limit: 100,
      });
      users.forEach(u => {
        usersMap[u.id] = { email: u.email || '', name: u.name || u.firstName || '' };
      });
    }

    // Stats - get counts
    const allLicenses = await Licenses.findAll({ limit: 2000, fields: ['status'] });
    const stats = {
      total: allLicenses.records.length,
      active: allLicenses.records.filter(l => l.status === 'Active').length,
      available: allLicenses.records.filter(l => l.status === 'Available').length,
      expired: allLicenses.records.filter(l => l.status === 'Expired').length,
      disabled: allLicenses.records.filter(l => l.status === 'Disabled').length,
      revoked: allLicenses.records.filter(l => l.status === 'Revoked').length,
    };

    const licenses = records.map(r => {
      const userId = Array.isArray(r.assignedTo) ? r.assignedTo[0] : r.assignedTo;
      const user = userId ? usersMap[userId] : null;
      return {
        id: r.id,
        licenseKey: r.licenseKey || '',
        plan: r.plan || '',
        status: r.status || '',
        assignedToEmail: user?.email || null,
        assignedToName: user?.name || null,
        activationDate: r.activationDate || null,
        expiryDate: r.expiryDate || null,
        createdAt: r.createdAt || null,
      };
    });

    return { licenses, stats, hasMore };
  },
});
