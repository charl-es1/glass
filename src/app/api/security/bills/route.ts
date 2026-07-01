import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snap = await adminDb
      .collection('invoices')
      .where('status', '==', 'ready_for_dispatch')
      .get();

    // Optimizing lookups using local maps to avoid nested DB reads
    const gtSnap = await adminDb.collection('glass_types').get();
    const gtMap = new Map<string, any>(gtSnap.docs.map((doc: any) => [doc.id, doc.data()]));

    const custSnap = await adminDb.collection('customers').get();
    const custMap = new Map<string, any>(custSnap.docs.map((doc: any) => [doc.id, { id: doc.id, ...doc.data() }]));

    const invoices = [];
    for (const doc of snap.docs) {
      const inv = doc.data();
      const customer = custMap.get(inv.customer_id) || null;

      const populatedLineItems = (inv.line_items || []).map((item: any) => {
        const gtData = gtMap.get(item.glass_type_id);
        const glass_type = gtData ? { id: item.glass_type_id, name: gtData.name } : null;
        return {
          ...item,
          glass_type,
        };
      });

      invoices.push({
        id: doc.id,
        ...inv,
        customer,
        line_items: populatedLineItems,
      });
    }

    // Sort by created_at desc in-memory
    invoices.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching dispatch bills:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
