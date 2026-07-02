import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const getFirebaseAdminApp = () => {
  const activeApps = getApps();
  if (activeApps.length > 0) {
    return activeApps[0]!;
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
      
      return initializeApp({
        credential: cert(credentials),
      });
    } catch (err) {
      console.error('Failed to initialize Firebase Admin with service account:', err);
    }
  }

  // Fallback to project ID
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'glass-cutting-app';
  return initializeApp({
    projectId,
  });
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
} as any as ReturnType<typeof getFirestore>;

export const adminAuth = {
  createUser(properties: any) {
    return getAdminAuth().createUser(properties);
  },
  deleteUser(uid: string) {
    return getAdminAuth().deleteUser(uid);
  }
} as any as ReturnType<typeof getAuth>;
