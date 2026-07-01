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
      const trimmed = serviceAccountJson.trim();
      if (trimmed.startsWith('{')) {
        credentials = JSON.parse(trimmed);
      } else {
        // Read service account from file path
        credentials = JSON.parse(fs.readFileSync(trimmed, 'utf8'));
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

const adminApp = getFirebaseAdminApp();
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);

// Enable ignoreUndefinedProperties to prevent Firestore from crashing on undefined fields
try {
  adminDb.settings({ ignoreUndefinedProperties: true });
} catch (err) {
  // Ignore initialization errors if settings are already set
}

export { adminApp, adminDb, adminAuth };
