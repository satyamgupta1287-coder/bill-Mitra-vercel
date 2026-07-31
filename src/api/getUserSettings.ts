import { z } from 'zod';
import { createEndpoint, UserSettings } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  description: 'Get or create user template settings',
  inputSchema: z.object({}),
  outputSchema: z.object({
    settings: z.object({
      id: z.string(),
      selectedTemplate: z.string(),
      showLogo: z.boolean(),
      showBankDetails: z.boolean(),
      showSignature: z.boolean(),
      showQrCode: z.boolean(),
      customFooterText: z.string(),
    }),
  }),
  execute: async ({ context }) => {
    let settings = await UserSettings.findOne({ filters: { user: context.user.id } });

    if (!settings) {
      settings = await UserSettings.create({
        record: {
          settingName: `Settings - ${context.user.email}`,
          user: context.user.id,
          selectedTemplate: 'Classic GST',
          showLogo: true,
          showBankDetails: true,
          showSignature: true,
          showQrCode: false,
          customFooterText: '',
        },
      });
    }

    return {
      settings: {
        id: settings.id,
        selectedTemplate: settings.selectedTemplate || 'Classic GST',
        showLogo: settings.showLogo ?? true,
        showBankDetails: settings.showBankDetails ?? true,
        showSignature: settings.showSignature ?? true,
        showQrCode: settings.showQrCode ?? false,
        customFooterText: settings.customFooterText || '',
      },
    };
  },
});
