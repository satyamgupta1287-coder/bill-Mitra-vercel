import fs from 'fs';
let content = fs.readFileSync('src/pages/CreateInvoicePage.tsx', 'utf8');

// replace all case 'Retail Invoice': with empty except the first one?
// wait, easier to just search and replace.
let count = 0;
content = content.replace(/case 'Retail Invoice':/g, (match) => {
  count++;
  if (count === 1) return match; // keep first
  return ''; // remove subsequent
});
fs.writeFileSync('src/pages/CreateInvoicePage.tsx', content);
