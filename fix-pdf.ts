import fs from 'fs';

let content = fs.readFileSync('src/lib/invoiceTemplates.ts', 'utf8');

// 1. Fix CSS styles
content = content.replace(
  ".wrap { border: 1px solid #000; padding: 0; display: flex; flex-direction: column; min-height: 250mm; }",
  ".wrap { border: 1px solid #000; padding: 0; display: flex; flex-direction: column; height: auto; }"
);

content = content.replace(
  "td { padding: 4px 4px; border: 1px solid #000; font-size: 8pt; border-bottom: none; border-top: none; }",
  "td { padding: 4px 4px; border: 1px solid #000; font-size: 8pt; }"
);

content = content.replace(
  ".items-table-container { flex: 1; border-bottom: 1px solid #000; border-top: 1px solid #000; }",
  ".items-table-container { border-bottom: 1px solid #000; border-top: 1px solid #000; }"
);

content = content.replace(
  ".items-table td { border: 1px solid #000; border-top: none; border-bottom: none; vertical-align: top; }",
  ".items-table td { border: 1px solid #000; vertical-align: top; }"
);

content = content.replace(
  ".item-row td { border-bottom: 1px solid #000 !important; }",
  "" // remove
);

// 2. Remove filler row
const tbodyStart = "<tbody>";
const fillerRowIndex = content.indexOf('<tr class="filler-row">');
const tbodyEndIndex = content.indexOf('</tbody>', fillerRowIndex);

if (fillerRowIndex !== -1 && tbodyEndIndex !== -1) {
  const beforeFiller = content.substring(0, fillerRowIndex);
  const afterFiller = content.substring(tbodyEndIndex);
  content = beforeFiller + afterFiller;
}

fs.writeFileSync('src/lib/invoiceTemplates.ts', content);
console.log('Fixed PDF template layout');
