import fs from 'fs';
let content = fs.readFileSync('src/api/generateInvoicePdf.ts', 'utf8');
content = content.replace("outputSchema: z.object({ url: z.string() }),", "outputSchema: z.object({ url: z.string(), html: z.string().optional() }),");
content = content.replace("const { url } = await ZitePdf.renderHtml({", "return { url: '', html };\n    const { url } = await ZitePdf.renderHtml({");
fs.writeFileSync('src/api/generateInvoicePdf.ts', content);
