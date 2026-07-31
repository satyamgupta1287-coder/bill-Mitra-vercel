import fs from 'fs';
let content = fs.readFileSync('src/api/saveCompany.ts', 'utf8');
content = content.replace("await Users.update({ id: context.user.id, record: { company: company.id } });", "try { await Users.update({ id: context.user.id, record: { company: company.id } }); } catch (e) { await Users.create({ record: { id: context.user.id, company: company.id } }); }");
fs.writeFileSync('src/api/saveCompany.ts', content);
