import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
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

    const quotesSnap = await adminDb.collection('quotes').get();
    const usersSnap = await adminDb.collection('users').get();
    const userMap = new Map(usersSnap.docs.map((doc: any) => [doc.id, { id: doc.id, name: doc.data().name, email: doc.data().email }]));

    const gtSnap = await adminDb.collection('glass_types').get();
    const gtMap = new Map(gtSnap.docs.map((doc: any) => [doc.id, { id: doc.id, name: doc.data().name, price_per_sqm: doc.data().price_per_sqm }]));

    let quotes = quotesSnap.docs.map((doc: any) => {
      const q = doc.data();
      const userDoc = userMap.get(q.user_id) || null;
      const glass_type = q.glass_type_id ? gtMap.get(q.glass_type_id) : null;
      return {
        id: doc.id,
        ...q,
        user: userDoc,
        glass_type,
      };
    }) as any[];

    // Filters
    if (filterUserId) {
      quotes = quotes.filter((q: any) => q.user_id === filterUserId);
    }
    if (filterGlassTypeId) {
      quotes = quotes.filter((q: any) => {
        if (q.glass_type_id === filterGlassTypeId) return true;
        if (q.items_json && q.items_json.includes(filterGlassTypeId)) return true;
        return false;
      });
    }
    if (startDateStr) {
      const start = new Date(startDateStr);
      quotes = quotes.filter((q: any) => new Date(q.created_at) >= start);
    }
    if (endDateStr) {
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
      quotes = quotes.filter((q: any) => new Date(q.created_at) <= end);
    }

    // Sort
    quotes.sort((a: any, b: any) => {
      let valA: any = new Date(a.created_at).getTime();
      let valB: any = new Date(b.created_at).getTime();

      if (sortBy === 'price') {
        valA = a.total_price || 0;
        valB = b.total_price || 0;
      } else if (sortBy === 'area') {
        valA = a.area || 0;
        valB = b.area || 0;
      }

      if (sortOrderParam === 'asc') {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      } else {
        return valA < valB ? 1 : valA > valB ? -1 : 0;
      }
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
