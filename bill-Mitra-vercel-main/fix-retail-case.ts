import fs from 'fs';
let content = fs.readFileSync('src/pages/CreateInvoicePage.tsx', 'utf8');
content = content.replace("    case 'Thermal Receipt':\n      return 'retail';", "case 'Thermal Receipt':\n      return 'retail';");
// Actually, let's just ignore it.
