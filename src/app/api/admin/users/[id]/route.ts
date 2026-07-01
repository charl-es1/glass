import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

// PUT: Update user profile (Admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAuthUser();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (adminUser.role !== 'admin' && adminUser.role !== 'supervisor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, role, status, password } = body;

    if (!name || !email || !role || !status) {
      return NextResponse.json(
        { error: 'Fields (name, email, role, status) are required' },
        { status: 400 }
      );
    }

    if (role !== 'admin' && role !== 'user' && role !== 'supervisor' && role !== 'security') {
      return NextResponse.json(
        { error: 'Invalid role. Role must be admin, supervisor, user or security' },
        { status: 400 }
      );
    }

    // Check if email is duplicate
    const duplicateSnap = await adminDb
      .collection('users')
      .where('email', '==', email)
      .get();

    const duplicate = duplicateSnap.docs.find((doc: any) => doc.id !== id);
    if (duplicate) {
      return NextResponse.json(
        { error: 'Another user already has this email' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      name,
      email,
      role,
      status,
    };

    if (password && password.trim() !== '') {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    // Prevent deactivating own account
    if (id === adminUser.id && status === 'inactive') {
      return NextResponse.json(
        { error: 'You cannot deactivate your own admin account' },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection('users').doc(id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await userRef.update(updateData);

    const updatedUser = {
      id,
      name,
      email,
      role,
      status,
      created_at: userDoc.data()?.created_at,
    };

    // Log UPDATE_USER activity
    await logActivity(
      adminUser.id,
      adminUser.email,
      adminUser.name,
      'UPDATE_USER',
      `Updated user account: ${updatedUser.name} (${updatedUser.email}) - Role: ${updatedUser.role}, Status: ${updatedUser.status}`
    );

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a user account (Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAuthUser();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (adminUser.role !== 'admin' && adminUser.role !== 'supervisor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Prevent deleting own account
    if (id === adminUser.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own admin account' },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection('users').doc(id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = userDoc.data()!;

    // Log DELETE_USER activity
    await logActivity(
      adminUser.id,
      adminUser.email,
      adminUser.name,
      'DELETE_USER',
      `Deleted user account: ${targetUser.name} (${targetUser.email})`
    );

    // Delete the user document
    await userRef.delete();

    // Cascading deletion of quotes: find quotes by user_id and delete them
    const quotesSnap = await adminDb.collection('quotes').where('user_id', '==', id).get();
    const batch = adminDb.batch();
    quotesSnap.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
