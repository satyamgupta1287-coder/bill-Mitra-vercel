import { z } from 'zod';
import { createEndpoint, Compositions } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
  }),
  outputSchema: z.object({ composition: z.any() }),
  execute: async ({ input, context }) => {
    let composition;
    if (input.id) {
      composition = await Compositions.update({
        id: input.id,
        data: {
          name: input.name,
          description: input.description,
          category: input.category,
        },
      });
    } else {
      composition = await Compositions.create({
        data: {
          name: input.name,
          description: input.description,
          category: input.category,
          owner: context.user.id,
        },
      });
    }
    return { composition };
  },
});
