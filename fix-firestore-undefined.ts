import fs from 'fs';
let content = fs.readFileSync('src/mocks/zite-integrations-backend-sdk.ts', 'utf8');

const stripHelper = `
export class ZiteError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ZiteError';
  }
}

function stripUndefined(obj: any): any {
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj && typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        res[key] = stripUndefined(obj[key]);
      }
    }
    return res;
  }
  return obj;
}
`;

content = content.replace(/export class ZiteError[\s\S]*?\}\n\}/, stripHelper.trim());

content = content.replace(/const newRecord = \{ id, \.\.\.obj, createdAt: new Date\(\)\.toISOString\(\) \};/, "const newRecord = stripUndefined({ id, ...obj, createdAt: new Date().toISOString() });");
content = content.replace(/const updated = \{ \.\.\.docSnap\.data\(\), \.\.\.obj, updatedAt: new Date\(\)\.toISOString\(\) \};/, "const updated = stripUndefined({ ...docSnap.data(), ...obj, updatedAt: new Date().toISOString() });");

fs.writeFileSync('src/mocks/zite-integrations-backend-sdk.ts', content);
