import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

// GET: Retrieve all glass types
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const glassTypes = await prisma.glassType.findMany({
      orderBy: { name: 'asc' },
    });

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
    const existing = await prisma.glassType.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Glass type with this name already exists' },
        { status: 400 }
      );
    }

    const newGlassType = await prisma.glassType.create({
      data: {
        name,
        price_per_sqm: price,
      },
    });

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
