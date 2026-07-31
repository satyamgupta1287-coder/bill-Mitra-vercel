import fs from 'fs';
let content = fs.readFileSync('src/mocks/zite-endpoints-sdk.ts', 'utf8');

const replacement = `
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const wrap = (def: any) => async (input: any) => {
  const currentUser = auth.currentUser;
  const role = currentUser?.email === 'satyamgupta1287@gmail.com' ? 'Admin' : 'User';
  
  let userData: any = { id: currentUser?.uid || 'user-1', role, email: currentUser?.email };
  
  if (currentUser?.uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        userData = { ...userData, ...userDoc.data() };
      }
    } catch (e) {
      console.warn("Could not fetch user document", e);
    }
  }

  return await def.execute({ input: input || {}, context: { user: userData } });
};
`;

content = content.replace(/const wrap = \(def: any\) => async \(input: any\) => \{[\s\S]*?\};/, replacement.trim());
fs.writeFileSync('src/mocks/zite-endpoints-sdk.ts', content);
