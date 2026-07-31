import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCU3FdURH--tQjUCGqtnfY9YbD8FQD4qyI",
  authDomain: "bill-mitra-management.firebaseapp.com",
  projectId: "bill-mitra-management",
  storageBucket: "bill-mitra-management.firebasestorage.app",
  messagingSenderId: "121051078417",
  appId: "1:121051078417:web:c3c1d903c7ea22c2d6f6b0",
  measurementId: "G-CKYX7XV5KX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log("Starting write...");
  try {
    await setDoc(doc(db, "test", "test"), { hello: "world" });
    console.log("Write success!");
  } catch (e) {
    console.error("Write failed:", e);
  }
  process.exit(0);
}
test();
