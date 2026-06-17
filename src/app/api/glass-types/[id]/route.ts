import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

// PUT: Edit a glass type (Admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
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

    // Check if name is taken by another glass type
    const duplicate = await prisma.glassType.findFirst({
      where: {
        name,
        id: { not: id },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'Another glass type already has this name' },
        { status: 400 }
      );
    }

    const updated = await prisma.glassType.update({
      where: { id },
      data: {
        name,
        price_per_sqm: price,
      },
    });

    // Log UPDATE_GLASS_TYPE activity
    await logActivity(
      user.id,
      user.email,
      user.name,
      'UPDATE_GLASS_TYPE',
      `Updated glass type: ${updated.name} pricing to ${updated.price_per_sqm.toFixed(2)} GHS/m²`
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating glass type:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a glass type (Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if there are quotes using this glass type
    const quotesUsing = await prisma.quote.findFirst({
      where: { glass_type_id: id },
    });

    if (quotesUsing) {
      return NextResponse.json(
        { error: 'Cannot delete glass type as it is linked to existing quotes' },
        { status: 400 }
      );
    }

    const targetGlass = await prisma.glassType.findUnique({
      where: { id },
    });

    if (!targetGlass) {
      return NextResponse.json({ error: 'Glass type not found' }, { status: 404 });
    }

    // Log DELETE_GLASS_TYPE activity
    await logActivity(
      user.id,
      user.email,
      user.name,
      'DELETE_GLASS_TYPE',
      `Deleted glass type: ${targetGlass.name}`
    );

    await prisma.glassType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Glass type deleted' });
  } catch (error) {
    console.error('Error deleting glass type:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
