import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  exp: number;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload) as JwtPayload;
    
    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip public assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }
  
  const token = request.cookies.get('token')?.value;
  const payload = token ? parseJwt(token) : null;
  
  const isLoginPage = pathname === '/login';
  
  if (isLoginPage) {
    if (payload) {
      // Already logged in, redirect based on role
      const redirectUrl = payload.role === 'security'
        ? new URL('/security', request.url)
        : ((payload.role === 'admin' || payload.role === 'supervisor')
          ? new URL('/admin/dashboard', request.url) 
          : new URL('/dashboard', request.url));
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }
  
  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!payload) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('token'); // clear invalid token
      return response;
    }
    
    if (payload.role !== 'admin' && payload.role !== 'supervisor') {
      const target = payload.role === 'security' ? '/security' : '/dashboard';
      return NextResponse.redirect(new URL(target, request.url));
    }
    
    return NextResponse.next();
  }
  
  // Protect /dashboard routes (Staff calculator)
  if (pathname.startsWith('/dashboard')) {
    if (!payload) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('token'); // clear invalid token
      return response;
    }
    
    if (payload.role === 'security') {
      return NextResponse.redirect(new URL('/security', request.url));
    }
    
    return NextResponse.next();
  }

  // Protect /security routes (Security Gate)
  if (pathname.startsWith('/security')) {
    // Anyone is allowed to load the /security route so they can type their PIN.
    // Authorized access is verified client-side in security/page.tsx.
    return NextResponse.next();
  }
  
  // Root path / redirect to appropriate dashboard or login
  if (pathname === '/') {
    if (payload) {
      const redirectUrl = payload.role === 'security'
        ? new URL('/security', request.url)
        : ((payload.role === 'admin' || payload.role === 'supervisor')
          ? new URL('/admin/dashboard', request.url) 
          : new URL('/dashboard', request.url));
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

