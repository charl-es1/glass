import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Retrieve aggregated financial reporting metrics (Admin only)
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
    const customerId = searchParams.get('customerId') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Fetch all invoices & customers to perform in-memory filter & aggregates
    const invoicesSnap = await adminDb.collection('invoices').get();
    const customersSnap = await adminDb.collection('customers').get();
    const custMap = new Map(customersSnap.docs.map((doc: any) => [doc.id, { id: doc.id, ...doc.data() }]));

    let invoices = invoicesSnap.docs.map((doc: any) => {
      const inv = doc.data();
      return {
        id: doc.id,
        ...inv,
        customer: custMap.get(inv.customer_id) || null,
      } as any;
    });

    // Apply filters to invoices
    if (customerId) {
      invoices = invoices.filter((inv: any) => inv.customer_id === customerId);
    }
    if (status) {
      invoices = invoices.filter((inv: any) => inv.status === status);
    } else {
      // Exclude cancelled invoices from standard revenue stats unless explicitly filtered for
      invoices = invoices.filter((inv: any) => inv.status !== 'cancelled');
    }
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      invoices = invoices.filter((inv: any) => new Date(inv.issue_date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      invoices = invoices.filter((inv: any) => new Date(inv.issue_date) <= end);
    }

    // Sort invoices by created_at desc
    invoices.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalInvoiced = invoices.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0);

    // Build bills list from invoices
    const bills: any[] = [];
    const allInvoices = invoicesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }) as any);

    for (const inv of allInvoices) {
      if (inv.status === 'cancelled') continue;
      if (customerId && inv.customer_id !== customerId) continue;

      const customer = custMap.get(inv.customer_id) || null;
      const invBills = inv.bills || [];

      for (const b of invBills) {
        const pDate = new Date(b.payment_date);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (pDate < start) continue;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (pDate > end) continue;
        }

        bills.push({
          ...b,
          invoice: {
            ...inv,
            customer,
          },
        });
      }
    }

    // Sort bills by payment_date desc
    bills.sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    const totalReceived = bills.reduce((sum: number, b: any) => sum + b.amount_paid, 0);
    const outstandingBalance = Math.max(0, totalInvoiced - totalReceived);

    // Top Customers analysis
    const customerAggregationMap: Record<string, { name: string; invoiced: number; received: number }> = {};

    for (const inv of invoices) {
      const cId = inv.customer_id;
      if (!customerAggregationMap[cId]) {
        customerAggregationMap[cId] = {
          name: inv.customer?.name || 'Unknown',
          invoiced: 0,
          received: 0,
        };
      }
      customerAggregationMap[cId].invoiced += inv.total_amount;
    }

    for (const b of bills) {
      const cId = b.invoice.customer_id;
      if (customerAggregationMap[cId]) {
        customerAggregationMap[cId].received += b.amount_paid;
      }
    }

    const topCustomers = Object.values(customerAggregationMap)
      .sort((a: any, b: any) => b.invoiced - a.invoiced)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        totalInvoiced,
        totalReceived,
        outstandingBalance,
      },
      topCustomers,
      recentInvoices: invoices.slice(0, 10),
      recentPayments: bills.slice(0, 10),
    });
  } catch (error) {
    console.error('Error generating financial reports:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
