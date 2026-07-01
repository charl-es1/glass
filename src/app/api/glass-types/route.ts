import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET: Retrieve all glass types
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snap = await adminDb.collection('glass_types').orderBy('name', 'asc').get();
    const glassTypes = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(glassTypes);
  } catch (error) {
    console.error('Error fetching glass types:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: Add new glass type (Admin only)
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, price_per_sqm } = body;

    if (!name || price_per_sqm === undefined || price_per_sqm === null) {
      return NextResponse.json(
        { error: 'Name and price per square meter are required' },
        { status: 400 }
      );
    }

    const price = parseFloat(price_per_sqm);
    if (isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Price must be a positive number' },
        { status: 400 }
      );
    }

    // Check if name already exists
    const existingSnap = await adminDb
      .collection('glass_types')
      .where('name', '==', name)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json(
        { error: 'Glass type with this name already exists' },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection('glass_types').doc();
    const newGlassType = {
      id: docRef.id,
      name,
      price_per_sqm: price,
      updated_at: new Date().toISOString(),
    };

    await docRef.set(newGlassType);

    // Log CREATE_GLASS_TYPE activity
    await logActivity(
      user.id,
      user.email,
      user.name,
      'CREATE_GLASS_TYPE',
      `Created new glass type: ${newGlassType.name} with price ${newGlassType.price_per_sqm.toFixed(2)} GHS/m²`
    );

    return NextResponse.json(newGlassType, { status: 201 });
  } catch (error) {
    console.error('Error creating glass type:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
