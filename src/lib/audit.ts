import prisma from './db';

/**
 * Log an activity to the audit trails database.
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
    await prisma.activityLog.create({
      data: {
        user_id: userId,
        user_email: email,
        user_name: name,
        action,
        details,
      },
    });
  } catch (err) {
    console.error('Failed to log audit activity:', err);
  }
}
