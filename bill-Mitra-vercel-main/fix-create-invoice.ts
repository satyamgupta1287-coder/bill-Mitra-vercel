import fs from 'fs';

let content = fs.readFileSync('src/pages/CreateInvoicePage.tsx', 'utf8');

content = content.replace("    case 'Classic GST':\n    case 'Wholesale Invoice':\n      return 'pharma';", "    case 'Classic GST':\n    case 'Retail Invoice':\n    case 'Wholesale Invoice':\n    case 'Delivery Challan':\n      return 'pharma';");

fs.writeFileSync('src/pages/CreateInvoicePage.tsx', content);

