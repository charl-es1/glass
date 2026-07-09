import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getSystemSettings, saveSystemSettings } from '@/lib/settings';
import { systemSettingsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getSystemSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('API GET settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // 1. Authorize user (admin role required)
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    if (user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    // 2. Parse and validate payload
    const body = await request.json();
    const validation = systemSettingsSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: 'Validation failed', details: fieldErrors },
        { status: 400 }
      );
    }

    // 3. Save to database
    const saved = await saveSystemSettings(validation.data, user.id);
    return NextResponse.json(saved);
  } catch (error: any) {
    console.error('API PUT settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}
