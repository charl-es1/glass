import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'run-test') {
    try {
      // Test the proxy-wrapped adminDb instance
      const testSnap = await adminDb.collection('users').get();
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
