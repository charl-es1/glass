import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import bcrypt from 'bcryptjs';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'run-test') {
    try {
      const app = testGetFirebaseAdminApp();
      const db = getFirestore(app);
      const testSnap = await db.collection('users').get();
      const users = testSnap.docs.map(doc => ({ id: doc.id, email: doc.data().email, role: doc.data().role }));
      
      // Test bcrypt call
      const testHash = await bcrypt.hash('testpassword', 10);
      const match = await bcrypt.compare('testpassword', testHash);

      return NextResponse.json({
        status: 'success',
        usersCount: testSnap.size,
        users,
        bcryptTest: `success (match: ${match})`,
      });
    } catch (err: any) {
      return NextResponse.json({
        status: 'error',
        message: err.message,
        stack: err.stack,
      });
    }
  }

  // HTML page
  return new NextResponse('Diagnostic page placeholder', {
    headers: { 'Content-Type': 'text/html' },
  });
}
