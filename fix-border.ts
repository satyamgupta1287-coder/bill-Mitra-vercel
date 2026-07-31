import fs from 'fs';

let content = fs.readFileSync('src/lib/invoiceTemplates.ts', 'utf8');

// 1. Add class "item-row" to the item tr
content = content.replace(
  "return `<tr>\n      <td style=\"text-align:center\">${i+1}</td>",
  "return `<tr class=\"item-row\">\n      <td style=\"text-align:center\">${i+1}</td>"
);

// 2. Add class "filler-row" below ${itemRows}
// The number of columns depends on config.title.
const fillerReplacement = `
        \${itemRows}
        <tr class="filler-row">
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          \${config.title === 'Retail Sale' ? '' : '<td style="border-bottom: none !important;"></td>'}
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
          <td style="border-bottom: none !important;"></td>
        </tr>
`;

content = content.replace(
  "<tbody>\n        ${itemRows}\n      </tbody>",
  "<tbody>\n          " + fillerReplacement + "\n        </tbody>"
);

// 3. Add CSS for item-row td
content = content.replace(
  ".items-table td { border: 1px solid #000; border-top: none; border-bottom: none; }",
  ".items-table td { border: 1px solid #000; border-top: none; border-bottom: none; vertical-align: top; }\n.item-row td { border-bottom: 1px solid #000 !important; }"
);

fs.writeFileSync('src/lib/invoiceTemplates.ts', content);
console.log('Fixed borders');
