import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET: List all users (Admin only)
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const usersSnap = await adminDb.collection('users').orderBy('name', 'asc').get();
    const users = [];

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const quotesCountSnap = await adminDb
        .collection('quotes')
        .where('user_id', '==', doc.id)
        .count()
        .get();

      users.push({
        id: doc.id,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        created_at: data.created_at,
        _count: {
          quotes: quotesCountSnap.data().count,
        },
      });
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: Create a new user (Admin only)
export async function POST(request: Request) {
  console.log('POST /api/admin/users: start');
  try {
    const adminUser = await getAuthUser();
    console.log('POST /api/admin/users: adminUser parsed', adminUser);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (adminUser.role !== 'admin' && adminUser.role !== 'supervisor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role, status } = body;

    if (!name || !email || !password || !role || !status) {
      return NextResponse.json(
        { error: 'All fields (name, email, password, role, status) are required' },
        { status: 400 }
      );
    }

    if (role !== 'admin' && role !== 'user' && role !== 'supervisor' && role !== 'security') {
      return NextResponse.json(
        { error: 'Invalid role. Role must be admin, supervisor, user or security' },
        { status: 400 }
      );
    }

    if (status !== 'active' && status !== 'inactive') {
      return NextResponse.json(
        { error: 'Invalid status. Status must be active or inactive' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingSnap = await adminDb
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const userRef = adminDb.collection('users').doc();
    const newUser = {
      id: userRef.id,
      name,
      email,
      password_hash: passwordHash,
      role,
      status,
      created_at: new Date().toISOString(),
    };

    await userRef.set(newUser);

    // Log CREATE_USER activity
    await logActivity(
      adminUser.id,
      adminUser.email,
      adminUser.name,
      'CREATE_USER',
      `Registered new user account: ${newUser.name} (${newUser.email}), Role: ${newUser.role}`
    );

    // Exclude password_hash in response
    const { password_hash, ...responseUser } = newUser;

    return NextResponse.json(responseUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
