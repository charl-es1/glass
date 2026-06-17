import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { signToken } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin) {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        pin: pin,
        status: 'active',
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    // Sign JWT
    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Set token in cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set({
      name: 'token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    // Log LOGIN activity
    await logActivity(user.id, user.email, user.name, 'LOGIN', `Security officer logged in via PIN: ${user.name}`);

    return response;
  } catch (error) {
    console.error('Security login error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
