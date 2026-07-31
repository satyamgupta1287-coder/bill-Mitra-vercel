import fs from 'fs';
let content = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');
content = content.replace("catch { toast.error('Failed to save'); }", "catch (e: any) { toast.error('Failed to save: ' + (e.message || 'Unknown error')); }");
fs.writeFileSync('src/pages/SettingsPage.tsx', content);
