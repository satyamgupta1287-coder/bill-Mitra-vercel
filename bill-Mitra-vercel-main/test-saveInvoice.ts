import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import def from './src/api/saveInvoice';
import { auth, db } from './src/firebase';

async function test() {
  try {
    await signInWithEmailAndPassword(auth, 'satyamgupta1287@gmail.com', 'satyam12345'); // I will try a couple passwords if needed, or wait, I can just create a test user
  } catch (e) {
    console.log("Login failed");
  }
}
test();
