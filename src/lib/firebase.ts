
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

// This file is designed to be safely imported on both server and client.
// Firebase services are initialized here and exported for direct use.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
export let isFirebaseInitialized = false;

// This check ensures the code only runs on the client-side.
if (typeof window !== 'undefined' && !getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    isFirebaseInitialized = true;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    // You might want to handle this error more gracefully
  }
} else if (typeof window !== 'undefined') {
  app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  isFirebaseInitialized = true;
}

// @ts-ignore
export { app, auth, db, storage };

// Functions to get initialized services (optional, but can be useful)
export function getFirebaseAuth(): Auth {
  if (!auth) {
    // This part should ideally not be reached if used correctly within the app
    // but serves as a safeguard.
    const app = getApp();
    auth = getAuth(app);
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    const app = getApp();
    db = getFirestore(app);
  }
  return db;
}
