import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<{ id: string, role?: string, email?: string, firstName?: string, lastName?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          role: firebaseUser.email === 'satyamgupta1287@gmail.com' ? 'Admin' : 'User',
          email: firebaseUser.email || undefined,
          firstName: firebaseUser.displayName?.split(' ')[0] || 'User',
          lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || ''
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  return {
    user,
    isLoading,
    loginWithRedirect: () => {
      const provider = new GoogleAuthProvider();
      signInWithPopup(auth, provider);
    },
    loginWithEmail: async (email: string, password: string) => { return await signInWithEmailAndPassword(auth, email, password); }, signUpWithEmail: async (email: string, password: string) => { return await createUserWithEmailAndPassword(auth, email, password); }, logout: () => {
      signOut(auth);
    }
  };
}
