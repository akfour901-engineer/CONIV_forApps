
'use client';

import React, { createContext, useContext, useMemo, type ReactNode, useEffect, useState } from 'react';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

interface FirebaseProviderProps {
  children: ReactNode;
}

export function FirebaseProvider({ children }: FirebaseProviderProps) {
  const [firebaseInstances, setFirebaseInstances] = useState<FirebaseContextType>({
    app: null,
    auth: null,
    firestore: null,
  });

  useEffect(() => {
    // This effect runs only on the client, after the component mounts.
    if (typeof window !== 'undefined') {
      let app: FirebaseApp;
      if (!getApps().length) {
        try {
          app = initializeApp(firebaseConfig);
          console.log("Firebase initialized");
        } catch (error) {
          console.error("Firebase initialization error:", error);
          return;
        }
      } else {
        app = getApp();
      }

      const auth = getAuth(app);
      const firestore = getFirestore(app);

      setFirebaseInstances({ app, auth, firestore });
    }
  }, []); // The empty dependency array ensures this runs only once.

  return (
    <FirebaseContext.Provider value={firebaseInstances}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

export function useFirebaseApp() {
  return useFirebase().app;
}

export function useAuthContext() {
  return useFirebase().auth;
}

export function useFirestore() {
  return useFirebase().firestore;
}
