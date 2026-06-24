import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterUserId = searchParams.get('user_id');
    const filterGlassTypeId = searchParams.get('glass_type_id');
    const startDateStr = searchParams.get('start_date');
    const endDateStr = searchParams.get('end_date');
    const sortBy = searchParams.get('sort_by') || 'created_at'; // total_price, created_at, area
    const sortOrderParam = searchParams.get('sort_order') || 'desc';
    const sortOrder: Prisma.SortOrder = sortOrderParam === 'asc' ? 'asc' : 'desc';

    // Build the query where clause dynamically
    const where: Prisma.QuoteWhereInput = {};

    if (filterUserId) {
      where.user_id = filterUserId;
    }

    if (filterGlassTypeId) {
      where.OR = [
        { glass_type_id: filterGlassTypeId },
        { items_json: { contains: filterGlassTypeId } }
      ];
    }

    if (startDateStr || endDateStr) {
      where.created_at = {};
      if (startDateStr) {
        where.created_at.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        // To cover the entire end date day, set it to the end of the day
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        where.created_at.lte = endDate;
      }
    }

    // Determine sort column
    let orderBy: Prisma.QuoteOrderByWithRelationInput = {};
    if (sortBy === 'price') {
      orderBy = { total_price: sortOrder };
    } else if (sortBy === 'area') {
      orderBy = { area: sortOrder };
    } else {
      orderBy = { created_at: sortOrder };
    }

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        glass_type: {
          select: { id: true, name: true, price_per_sqm: true },
        },
      },
      orderBy,
    });

    return NextResponse.json(quotes);
  } catch (error) {
    console.error('Error fetching admin quotes:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
