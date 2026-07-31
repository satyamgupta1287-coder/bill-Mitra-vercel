import { z } from 'zod';
import { createEndpoint, UserSettings } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  description: 'Save user template settings',
  inputSchema: z.object({
    settingsId: z.string(),
    selectedTemplate: z.string().optional(),
    showLogo: z.boolean().optional(),
    showBankDetails: z.boolean().optional(),
    showSignature: z.boolean().optional(),
    showQrCode: z.boolean().optional(),
    customFooterText: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const existing = await UserSettings.findOne({ id: input.settingsId });
    if (!existing) {
      // Create new
      await UserSettings.create({
        record: {
          settingName: `Settings - ${context.user.email}`,
          user: context.user.id,
          selectedTemplate: input.selectedTemplate || 'Classic GST',
          showLogo: input.showLogo ?? true,
          showBankDetails: input.showBankDetails ?? true,
          showSignature: input.showSignature ?? true,
          showQrCode: input.showQrCode ?? false,
          customFooterText: input.customFooterText || '',
        },
      });
    } else {
      const record: Record<string, any> = {};
      if (input.selectedTemplate !== undefined) record.selectedTemplate = input.selectedTemplate;
      if (input.showLogo !== undefined) record.showLogo = input.showLogo;
      if (input.showBankDetails !== undefined) record.showBankDetails = input.showBankDetails;
      if (input.showSignature !== undefined) record.showSignature = input.showSignature;
      if (input.showQrCode !== undefined) record.showQrCode = input.showQrCode;
      if (input.customFooterText !== undefined) record.customFooterText = input.customFooterText;
      await UserSettings.update({ id: input.settingsId, record });
    }
    return { success: true };
  },
});
