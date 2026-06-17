import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Total quotes generated
    const totalQuotes = await prisma.quote.count();

    // 2. Total estimated revenue
    const revenueAggregate = await prisma.quote.aggregate({
      _sum: {
        total_price: true,
      },
    });
    const totalRevenue = revenueAggregate._sum.total_price || 0;

    // 3. Stats per Glass Type
    const glassTypes = await prisma.glassType.findMany({
      include: {
        quotes: {
          select: {
            total_price: true,
          },
        },
      },
    });

    const glassStats = glassTypes.map((gt) => {
      const count = gt.quotes.length;
      const revenue = gt.quotes.reduce((sum, q) => sum + q.total_price, 0);
      return {
        id: gt.id,
        name: gt.name,
        price_per_sqm: gt.price_per_sqm,
        count,
        revenue,
      };
    }).sort((a, b) => b.count - a.count); // sort by most frequent first

    // 4. Stats per User (Staff metrics)
    const users = await prisma.user.findMany({
      include: {
        quotes: {
          select: {
            total_price: true,
          },
        },
      },
    });

    const userStats = users.map((u) => {
      const count = u.quotes.length;
      const revenue = u.quotes.reduce((sum, q) => sum + q.total_price, 0);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        count,
        revenue,
      };
    }).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalQuotes,
      totalRevenue,
      glassStats,
      userStats,
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
