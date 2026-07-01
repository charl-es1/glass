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

// POST: Record a payment against an invoice
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { amountPaid, paymentMethod, notes } = body;

    const paymentAmount = parseFloat(amountPaid);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be a positive number' },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }

    const invoice: any = await findInvoiceByIdOrFallback(id);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot record payments against a cancelled invoice' },
        { status: 400 }
      );
    }

    if (invoice.balance_due <= 0) {
      return NextResponse.json(
        { error: 'Invoice is already fully paid' },
        { status: 400 }
      );
    }

    // Execute the payment updates inside a database transaction
    const result = await adminDb.runTransaction(async (transaction: any) => {
      // 1. Calculate the next receipt number
      const invoicesSnap = await transaction.get(adminDb.collection('invoices'));
      let billCount = 0;
      invoicesSnap.docs.forEach((doc: any) => {
        const inv = doc.data();
        if (inv.bills) {
          billCount += inv.bills.length;
        }
      });
      const receiptNo = `RCP-${1000 + billCount + 1}`;

      const billId = adminDb.collection('invoices').doc().id; // generate unique ID
      const newBill = {
        id: billId,
        receipt_no: receiptNo,
        invoice_id: invoice.id,
        amount_paid: paymentAmount,
        payment_date: new Date().toISOString(),
        payment_method: paymentMethod,
        notes: notes || null,
        created_at: new Date().toISOString(),
      };

      // 2. Compute the new totals
      const newAmountPaid = (invoice.amount_paid || 0.0) + paymentAmount;
      const newBalanceDue = Math.max(0, invoice.total_amount - newAmountPaid);

      let newStatus = 'unpaid';
      if (newBalanceDue <= 0.01) {
        newStatus = 'paid';
      } else if (newAmountPaid > 0) {
        newStatus = 'partially_paid';
      }

      // 3. Update the invoice status and append the bill
      const invoiceRef = adminDb.collection('invoices').doc(invoice.id);
      const currentBills = invoice.bills || [];

      transaction.update(invoiceRef, {
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue,
        status: newStatus,
        bills: [...currentBills, newBill],
      });

      return { bill: newBill };
    });

    // Populate customer info for activity log if exists
    const custSnap = await adminDb.collection('customers').doc(invoice.customer_id).get();
    const customerName = custSnap.exists ? custSnap.data()?.name : 'Customer';

    // Log the transaction activity
    await logActivity(
      user.id,
      user.email,
      user.name,
      'RECORD_PAYMENT',
      `Recorded payment of ${paymentAmount.toFixed(2)} GHS (${paymentMethod}) against Invoice ${invoice.invoice_no} (${customerName})`
    );

    return NextResponse.json(result.bill, { status: 201 });
  } catch (error) {
    console.error('Error recording payment:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
