import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
export const db = getFirestore(app);
export const auth = getAuth(app);
