import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { initializeFirebaseDatabase } from './firebase-seed';

const JWT_SECRET = process.env.JWT_SECRET || 'glass-cutting-secret-key-12345';

export let dbSeeded = false;

function timeoutPromise<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function ensureDbSeeded() {
  if (!dbSeeded) {
    dbSeeded = true;
    console.log('Initiating lazy Firestore database seeding checks...');
    await timeoutPromise(initializeFirebaseDatabase(), 4000, 'Firestore seeding connection timed out')
      .then(() => {
        console.log('Firestore seeding verification finished successfully.');
      })
      .catch(err => {
        console.error('Lazy Firebase seeding failed or timed out:', err);
        dbSeeded = false; // Reset so that it retries on subsequent requests
      });
  }
}

export interface UserTokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function signToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<UserTokenPayload | null> {
  try {
    await ensureDbSeeded();
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}
