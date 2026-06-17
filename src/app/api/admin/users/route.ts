import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

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

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
        _count: {
          select: { quotes: true },
        },
      },
      orderBy: { name: 'asc' },
    });

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
  try {
    const adminUser = await getAuthUser();
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
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: passwordHash,
        role,
        status,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
      },
    });

    // Log CREATE_USER activity
    await logActivity(
      adminUser.id,
      adminUser.email,
      adminUser.name,
      'CREATE_USER',
      `Registered new user account: ${newUser.name} (${newUser.email}), Role: ${newUser.role}`
    );

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
