import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const testGetFirebaseAdminApp = () => {
  const activeApps = getApps();
  const testAppName = 'test-diagnostic-app';
  const existingApp = activeApps.find(app => app.name === testAppName);
  if (existingApp) {
    return existingApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    let cleanJson = serviceAccountJson.trim();
    if (cleanJson.startsWith("'") && cleanJson.endsWith("'")) {
      cleanJson = cleanJson.slice(1, -1).trim();
    } else if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
      cleanJson = cleanJson.slice(1, -1).trim();
    }

    let credentials;
    if (cleanJson.startsWith('{')) {
      credentials = JSON.parse(cleanJson);
    } else {
      credentials = JSON.parse(fs.readFileSync(cleanJson, 'utf8'));
    }

    if (credentials && credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    return initializeApp({
      credential: cert(credentials),
    }, testAppName);
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'glass-cutting-app';
  return initializeApp({
    projectId,
  }, testAppName);
};

export async function GET() {
  try {
    const app = testGetFirebaseAdminApp();
    const db = getFirestore(app);
    
    // Get all users in the collection
    const usersSnap = await db.collection('users').get();
    const userEmails = usersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || 'missing-email',
        name: data.name || 'missing-name',
        role: data.role || 'missing-role',
      };
    });

    return NextResponse.json({
      status: 'success',
      totalUsers: usersSnap.size,
      users: userEmails,
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      message: `Failed to query users: ${err.message}`,
    });
  }
}
