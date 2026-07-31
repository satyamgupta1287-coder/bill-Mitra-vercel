import { db } from './src/firebase';
import { doc, setDoc } from 'firebase/firestore';

async function seed() {
  const id = Math.random().toString(36).substring(7);
  await setDoc(doc(db, 'licenses', id), {
    id,
    licenseKey: 'BILLMITRA-TEST-KEY',
    plan: 'Lifetime',
    status: 'Available',
    createdAt: new Date().toISOString(),
  });
  console.log('Test license created!');
  process.exit(0);
}
seed();
