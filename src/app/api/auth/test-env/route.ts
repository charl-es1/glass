import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const testGetFirebaseAdminApp = () => {
  const activeApps = getApps();
  // Use a unique name for the test app so it doesn't conflict with the default app
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
    console.log('Diagnostic test: starting...');
    const app = testGetFirebaseAdminApp();
    console.log('Diagnostic test: app initialized', app.name);
    const db = getFirestore(app);
    console.log('Diagnostic test: db resolved');
    
    // Attempt a real query to Firestore
    const testSnap = await db.collection('users').limit(1).get();
    console.log('Diagnostic test: Firestore read success, size:', testSnap.size);

    return NextResponse.json({
      status: 'success',
      message: 'Firebase Admin successfully initialized and connected to Firestore!',
      databaseConnected: true,
      usersFound: testSnap.size,
    });
  } catch (err: any) {
    console.error('Diagnostic test failed:', err);
    return NextResponse.json({
      status: 'error',
      message: `Firebase Admin initialization or query failed: ${err.message}`,
      stack: err.stack,
    });
  }
}
