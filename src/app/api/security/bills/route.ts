import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Invoices ready for dispatch, sorted by most recent
    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'ready_for_dispatch',
      },
      include: {
        customer: true,
        line_items: {
          include: {
            glass_type: { select: { name: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching dispatch bills:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
