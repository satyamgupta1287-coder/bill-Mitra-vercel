import fs from 'fs';
let content = fs.readFileSync('src/mocks/zite-auth-sdk.ts', 'utf8');
content = content.replace(/loginWithEmail: async \(email, password\)/g, 'loginWithEmail: async (email: string, password: string)');
content = content.replace(/signUpWithEmail: async \(email, password\)/g, 'signUpWithEmail: async (email: string, password: string)');
fs.writeFileSync('src/mocks/zite-auth-sdk.ts', content);
