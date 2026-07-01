import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all quotes
    const quotesSnap = await adminDb.collection('quotes').get();
    const quotes = quotesSnap.docs.map((doc: any) => doc.data());

    // 1. Total quotes generated
    const totalQuotes = quotes.length;

    // 2. Total estimated revenue
    const totalRevenue = quotes.reduce((sum: number, q: any) => sum + (q.total_price || 0), 0);

    // 3. Stats per Glass Type
    const glassTypesSnap = await adminDb.collection('glass_types').get();
    const glassStats = glassTypesSnap.docs
      .map((doc: any) => {
        const gt = doc.data();
        const gtQuotes = quotes.filter((q: any) => q.glass_type_id === doc.id);
        const count = gtQuotes.length;
        const revenue = gtQuotes.reduce((sum: number, q: any) => sum + (q.total_price || 0), 0);
        return {
          id: doc.id,
          name: gt.name,
          price_per_sqm: gt.price_per_sqm,
          count,
          revenue,
        };
      })
      .sort((a: any, b: any) => b.count - a.count);

    // 4. Stats per User (Staff metrics)
    const usersSnap = await adminDb.collection('users').get();
    const userStats = usersSnap.docs
      .map((doc: any) => {
        const u = doc.data();
        const uQuotes = quotes.filter((q: any) => q.user_id === doc.id);
        const count = uQuotes.length;
        const revenue = uQuotes.reduce((sum: number, q: any) => sum + (q.total_price || 0), 0);
        return {
          id: doc.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          count,
          revenue,
        };
      })
      .sort((a: any, b: any) => b.count - a.count);

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
