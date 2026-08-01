import { z } from 'zod';
import { createEndpoint, Compositions, Products } from 'zite-integrations-backend-sdk';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
  }),
  outputSchema: z.object({ compositions: z.array(z.any()) }),
  execute: async ({ input, context }) => {
    const filters: any = { owner: context.user.id };
    const result = await Compositions.findAll({ filters, limit: 500 });
    let compositions = result.records;

    const productsRes = await Products.findAll({ filters: { owner: context.user.id }, limit: 1000 });
    const allProducts = productsRes.records;

    compositions = compositions.map((comp: any) => {
      const linked = allProducts.filter((p: any) =>
        p.compositionId === comp.id || (p.composition && p.composition.trim().toLowerCase() === comp.name?.trim().toLowerCase())
      );
      return {
        ...comp,
        productCount: linked.length,
        products: linked,
      };
    });

    if (input.search) {
      const s = input.search.toLowerCase();
      compositions = compositions.filter((c: any) =>
        c.name?.toLowerCase().includes(s) || c.description?.toLowerCase().includes(s)
      );
    }

    return { compositions };
  },
});
