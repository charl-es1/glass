import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

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
    const duplicate = await prisma.user.findFirst({
      where: {
        email,
        id: { not: id },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'Another user already has this email' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Prisma.UserUpdateInput = {
      name,
      email,
      role,
      status,
    };

    // If password is provided, hash and update it
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

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
      },
    });

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

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Log DELETE_USER activity
    await logActivity(
      adminUser.id,
      adminUser.email,
      adminUser.name,
      'DELETE_USER',
      `Deleted user account: ${targetUser.name} (${targetUser.email})`
    );

    // Delete the user (Quotes will cascade delete automatically)
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

