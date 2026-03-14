
// IMPORTANT: This file should NOT have the 'use server' directive at the top.
// It is a server-side utility module, not a collection of Server Actions.

import admin from 'firebase-admin';

// Define a global symbol to store the admin app instance.
// This prevents re-initialization across hot-reloads in development.
const ADMIN_APP_SYMBOL = Symbol.for('firebase-admin-app');

// Augment the global namespace to recognize our symbols.
declare global {
  var __FIREBASE_ADMIN_APP__: admin.app.App | undefined;
}

/**
 * Initializes the Firebase Admin SDK, ensuring it's only done once per server instance.
 * This pattern is safe for serverless environments.
 * @returns {admin.app.App} The initialized Firebase Admin App instance.
 * @throws {Error} If the Admin SDK cannot be initialized.
 */
function initializeFirebaseAdmin(): admin.app.App {
  if (globalThis.__FIREBASE_ADMIN_APP__) {
    return globalThis.__FIREBASE_ADMIN_APP__;
  }

  // Construct the service account object from environment variables
  const serviceAccount: admin.ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  // Corrected property name from project_id to projectId
  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    const errorMsg = "Firebase Admin SDK environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are not set.";
    console.error("CRITICAL: " + errorMsg);
    throw new Error(`CRITICAL_ADMIN_SDK_UNAVAILABLE: ${errorMsg}`);
  }

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log("Firebase Admin SDK initialized successfully from environment variables.");
    globalThis.__FIREBASE_ADMIN_APP__ = app;
    return app;

  } catch (error: any) {
    const errorMsg = `Firebase Admin SDK initialization failed: ${error.message}`;
    console.error("CRITICAL: " + errorMsg);
    // If initialization fails, we throw an error to prevent the app from running in a broken state.
    throw new Error(`CRITICAL_ADMIN_SDK_UNAVAILABLE: ${errorMsg}`);
  }
}

/**
 * A safe getter for the admin app instance. It initializes the app if not already done.
 * @returns {admin.app.App} The initialized Firebase Admin App instance.
 */
function getAdminApp(): admin.app.App {
    if (globalThis.__FIREBASE_ADMIN_APP__) {
        return globalThis.__FIREBASE_ADMIN_APP__;
    }
    return initializeFirebaseAdmin();
}

// These are convenience getters for the core services.
// They ensure the app is initialized before returning the service.
export function getDb() {
  return getAdminApp().firestore();
}

export function getAuth() {
  return getAdminApp().auth();
}

// For legacy imports that might expect these names directly.
export const adminDb = getDb();
export const adminAuth = getAuth();