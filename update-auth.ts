import fs from 'fs';
let content = fs.readFileSync('src/mocks/zite-auth-sdk.ts', 'utf8');
content = content.replace("import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';", "import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';");
content = content.replace("logout: () => {", "loginWithEmail: async (email, password) => { return await signInWithEmailAndPassword(auth, email, password); }, signUpWithEmail: async (email, password) => { return await createUserWithEmailAndPassword(auth, email, password); }, logout: () => {");
fs.writeFileSync('src/mocks/zite-auth-sdk.ts', content);
