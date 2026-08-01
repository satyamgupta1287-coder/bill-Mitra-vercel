import { z } from 'zod';
import { createEndpoint, Locations } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    name: z.string(),
    type: z.string().optional(),
    description: z.string().optional(),
  }),
  outputSchema: z.object({ location: z.any() }),
  execute: async ({ input, context }) => {
    let location;
    if (input.id) {
      location = await Locations.update({
        id: input.id,
        data: {
          name: input.name,
          type: input.type,
          description: input.description,
        },
      });
    } else {
      location = await Locations.create({
        data: {
          name: input.name,
          type: input.type,
          description: input.description,
          owner: context.user.id,
        },
      });
    }
    return { location };
  },
});
