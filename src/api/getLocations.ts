import { z } from 'zod';
import { createEndpoint, Locations, Products } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
  }),
  outputSchema: z.object({ locations: z.array(z.any()) }),
  execute: async ({ input, context }) => {
    const filters: any = { owner: context.user.id };
    const result = await Locations.findAll({ filters, limit: 500 });
    let locations = result.records;

    const productsRes = await Products.findAll({ filters: { owner: context.user.id }, limit: 1000 });
    const allProducts = productsRes.records;

    locations = locations.map((loc: any) => {
      const linked = allProducts.filter((p: any) =>
        p.locationId === loc.id || (p.rackLocation && p.rackLocation.trim().toLowerCase() === loc.name?.trim().toLowerCase())
      );
      return {
        ...loc,
        productCount: linked.length,
        products: linked,
      };
    });

    if (input.search) {
      const s = input.search.toLowerCase();
      locations = locations.filter((l: any) =>
        l.name?.toLowerCase().includes(s) || l.type?.toLowerCase().includes(s) || l.description?.toLowerCase().includes(s)
      );
    }

    return { locations };
  },
});
