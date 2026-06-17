import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true },
    });

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
    const result = await prisma.$transaction(async (tx) => {
      const billCount = await tx.bill.count();
      const receiptNo = `RCP-${1000 + billCount + 1}`;

      // 1. Create the bill record
      const bill = await tx.bill.create({
        data: {
          receipt_no: receiptNo,
          invoice_id: id,
          amount_paid: paymentAmount,
          payment_method: paymentMethod,
          notes: notes || null,
        },
      });

      // 2. Compute the new totals
      const newAmountPaid = invoice.amount_paid + paymentAmount;
      const newBalanceDue = Math.max(0, invoice.total_amount - newAmountPaid);

      let newStatus = 'unpaid';
      if (newBalanceDue <= 0.01) {
        // Allow for minor floating point rounding
        newStatus = 'paid';
      } else if (newAmountPaid > 0) {
        newStatus = 'partially_paid';
      }

      // 3. Update the invoice status
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: newStatus,
        },
      });

      return { bill, updatedInvoice };
    });

    // Log the transaction activity
    await logActivity(
      user.id,
      user.email,
      user.name,
      'RECORD_PAYMENT',
      `Recorded payment of ${paymentAmount.toFixed(2)} GHS (${paymentMethod}) against Invoice ${invoice.invoice_no} (${invoice.customer.name})`
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
