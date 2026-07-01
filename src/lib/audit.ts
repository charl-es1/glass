import { adminDb } from './firebase-admin';

/**
 * Log an activity to the audit trails database (Firestore).
 * Safeguarded with a try-catch block to prevent logging failures from crashing parent requests.
 */
export async function logActivity(
  userId: string | null,
  email: string | null,
  name: string | null,
  action: string,
  details: string
) {
  try {
    await adminDb.collection('activity_logs').add({
      user_id: userId,
      user_email: email,
      user_name: name,
      action,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log audit activity:', err);
  }
}
