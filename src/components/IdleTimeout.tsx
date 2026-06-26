'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function IdleTimeout() {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 5 minutes in milliseconds
  const IDLE_TIME_LIMIT = 5 * 60 * 1000;

  useEffect(() => {
    // If we are on the login page, do not start the idle timer
    if (pathname === '/login') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    const logoutUser = async () => {
      try {
        console.log('User idle for 5 minutes. Logging out...');
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
          router.push('/login');
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Idle logout failed:', err);
        router.push('/login');
      }
    };

    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(logoutUser, IDLE_TIME_LIMIT);
    };

    // Set initial timer
    resetTimer();

    // Event listeners to detect activity
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup listeners and timer on unmount or pathname changes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [pathname, router]);

  return null;
}
