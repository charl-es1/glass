import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export default async function IndexPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const payload = verifyToken(token);
  if (!payload) {
    redirect('/login');
  }

  if (payload.role === 'security') {
    redirect('/security');
  } else if (payload.role === 'admin' || payload.role === 'supervisor') {
    redirect('/admin/dashboard');
  } else {
    redirect('/dashboard');
  }
}
