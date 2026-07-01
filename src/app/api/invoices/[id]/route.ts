import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Helper function to find invoice by ID or human-readable number fallbacks
async function findInvoiceByIdOrFallback(id: string) {
  // 1. Try by document ID
  const docRef = adminDb.collection('invoices').doc(id);
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    return { id: docSnap.id, ...docSnap.data() };
  }

  // 2. Try by exact invoice_no
  const snapNo = await adminDb.collection('invoices').where('invoice_no', '==', id).limit(1).get();
  if (!snapNo.empty) {
    const doc = snapNo.docs[0]!;
    return { id: doc.id, ...doc.data() };
  }

  // 3. Try by uppercase invoice_no
  const snapUpper = await adminDb.collection('invoices').where('invoice_no', '==', id.toUpperCase()).limit(1).get();
  if (!snapUpper.empty) {
    const doc = snapUpper.docs[0]!;
    return { id: doc.id, ...doc.data() };
  }

  // 4. Try by quote_id in line_items
  const allSnap = await adminDb.collection('invoices').get();
  for (const doc of allSnap.docs) {
    const inv = doc.data();
    const hasQuote = (inv.line_items || []).some((item: any) => item.quote_id === id);
    if (hasQuote) {
      return { id: doc.id, ...inv };
    }
  }

  return null;
}

// GET: Retrieve a specific invoice by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const invoice: any = await findInvoiceByIdOrFallback(id);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Populate customer
    const custSnap = await adminDb.collection('customers').doc(invoice.customer_id).get();
    invoice.customer = custSnap.exists ? { id: custSnap.id, ...custSnap.data() } : null;

    // Populate user
    const userSnap = await adminDb.collection('users').doc(invoice.user_id).get();
    invoice.user = userSnap.exists ? { id: userSnap.id, name: userSnap.data()?.name, email: userSnap.data()?.email } : null;

    // Populate glass_types for line_items
    const gtSnap = await adminDb.collection('glass_types').get();
    const gtMap = new Map<string, any>(gtSnap.docs.map((doc: any) => [doc.id, doc.data()]));

    invoice.line_items = (invoice.line_items || []).map((item: any) => {
      const gtData = gtMap.get(item.glass_type_id);
      const glass_type = gtData ? { id: item.glass_type_id, name: gtData.name, price_per_sqm: gtData.price_per_sqm } : null;
      return {
        ...item,
        glass_type,
      };
    });

    invoice.bills = invoice.bills || [];

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT: Update invoice status, driver name, and vehicle reg number
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor' && user.role !== 'user')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { driver_name, vehicle_no, status } = body;

    const invoice: any = await findInvoiceByIdOrFallback(id);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (driver_name !== undefined) updateData.driver_name = driver_name;
    if (vehicle_no !== undefined) updateData.vehicle_no = vehicle_no;
    if (status !== undefined) {
      if (status === 'ready_for_dispatch' && invoice.status !== 'paid' && invoice.balance_due > 0.01) {
        return NextResponse.json(
          { error: 'Invoice must be fully paid before preparing for dispatch.' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    await adminDb.collection('invoices').doc(invoice.id).update(updateData);

    await logActivity(
      user.id,
      user.email,
      user.name,
      'UPDATE_INVOICE',
      `Updated invoice ${invoice.invoice_no}: ${JSON.stringify(updateData)}`
    );

    const updatedInvoice = {
      ...invoice,
      ...updateData,
    };

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
