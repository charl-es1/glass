import fs from 'fs';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

const getFirebaseAdminApp = () => {
  const { getApps, initializeApp, cert, getApp } = require('firebase-admin/app');
  const adminAppName = 'glass-cutting-admin';
  const activeApps = getApps();
  const existingApp = activeApps.find((app: any) => app.name === adminAppName);
  if (existingApp) {
    return existingApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      let credentials;
      let cleanJson = serviceAccountJson.trim();
      
      // Strip any wrapping single or double quotes
      if (cleanJson.startsWith("'") && cleanJson.endsWith("'")) {
        cleanJson = cleanJson.slice(1, -1).trim();
      } else if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
        cleanJson = cleanJson.slice(1, -1).trim();
      }

      if (cleanJson.startsWith('{')) {
        credentials = JSON.parse(cleanJson);
      } else {
        // Read service account from file path
        credentials = JSON.parse(fs.readFileSync(cleanJson, 'utf8'));
      }

      // Format private key correctly
      if (credentials && credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      
      try {
        return initializeApp({
          credential: cert(credentials),
        }, adminAppName);
      } catch (err: any) {
        if (err.code === 'app/duplicate-app' || err.message.includes('already exists')) {
          return getApp(adminAppName);
        }
        throw err;
      }
    } catch (err) {
      console.error('Failed to initialize Firebase Admin with service account:', err);
    }
  }

  // Fallback to project ID
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'glass-cutting-app';
  try {
    return initializeApp({
      projectId,
    }, adminAppName);
  } catch (err: any) {
    if (err.code === 'app/duplicate-app' || err.message.includes('already exists')) {
      return getApp(adminAppName);
    }
    throw err;
  }
};

let cachedApp: any = null;
let cachedDb: any = null;
let cachedAuth: any = null;

export function getFirebaseApp() {
  if (!cachedApp) {
    cachedApp = getFirebaseAdminApp();
  }
  return cachedApp;
}

export function getDb() {
  if (!cachedDb) {
    const { getFirestore } = require('firebase-admin/firestore');
    const app = getFirebaseApp();
    cachedDb = getFirestore(app);
    try {
      cachedDb.settings({ ignoreUndefinedProperties: true });
    } catch (err) {
      // Settings might already be set
    }
  }
  return cachedDb;
}

export function getAdminAuth() {
  if (!cachedAuth) {
    const { getAuth } = require('firebase-admin/auth');
    const app = getFirebaseApp();
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

// Plain object wrapper that delegates standard Firestore/Auth methods to the underlying
// initialized instance. This prevents build/bundling/framework-inspection crashes on Vercel.
export const adminDb = {
  collection(name: string) {
    return getDb().collection(name);
  },
  runTransaction(updateFunction: any) {
    return getDb().runTransaction(updateFunction);
  },
  batch() {
    return getDb().batch();
  }
} as any as Firestore;

export const adminAuth = {
  createUser(properties: any) {
    return getAdminAuth().createUser(properties);
  },
  deleteUser(uid: string) {
    return getAdminAuth().deleteUser(uid);
  }
} as any as Auth;
