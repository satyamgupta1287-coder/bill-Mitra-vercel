import { z } from 'zod';
import { createEndpoint, Companies, Users } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    companyId: z.string().optional(),
    companyName: z.string(),
    gstin: z.string().optional(),
    pan: z.string().optional(),
    state: z.string().optional(),
    stateCode: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
    phone: z.string().optional(),
    companyEmail: z.string().optional(),
    website: z.string().optional(),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
    upiId: z.string().optional(),
    invoicePrefix: z.string().optional(),
    termsAndConditions: z.string().optional(),
    dlNumber1: z.string().optional(),
    dlNumber2: z.string().optional(),
    logoUrl: z.string().optional(),
  }),
  outputSchema: z.object({ company: z.any() }),
  execute: async ({ input, context }) => {
    const { companyId, logoUrl, ...data } = input;
    const record: any = { ...data };
    if (logoUrl) record.logo = [{ url: logoUrl }];

    if (companyId) {
      await Companies.update({ id: companyId, record });
      const company = await Companies.findOne({ id: companyId });
      return { company };
    } else {
      const company = await Companies.create({ record });
      try { await Users.update({ id: context.user.id, record: { company: company.id } }); } catch (e) { await Users.create({ record: { id: context.user.id, company: company.id } }); }
      return { company };
    }
  },
});
