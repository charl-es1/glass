import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

export async function POST() {
  const user = await getAuthUser();
  if (user) {
    await logActivity(
      user.id,
      user.email,
      user.name,
      'LOGOUT',
      'Logged out of the system'
    );
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  
  response.cookies.delete('token');
  
  return response;
}

