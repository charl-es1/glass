import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

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

    // Build invoice filter
    const invoiceWhere: any = {};
    if (customerId) {
      invoiceWhere.customer_id = customerId;
    }
    if (status) {
      invoiceWhere.status = status;
    }
    if (startDate || endDate) {
      invoiceWhere.issue_date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        invoiceWhere.issue_date.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        invoiceWhere.issue_date.lte = end;
      }
    }

    // Exclude cancelled invoices from standard revenue stats unless explicitly filtered for
    const baseInvoiceWhere = { ...invoiceWhere };
    if (!status) {
      baseInvoiceWhere.status = { not: 'cancelled' };
    }

    const invoices = await prisma.invoice.findMany({
      where: baseInvoiceWhere,
      include: { customer: true },
      orderBy: { created_at: 'desc' },
    });

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);

    // Build bills filter
    const billWhere: any = {};
    if (customerId) {
      billWhere.invoice = { customer_id: customerId };
    }
    if (startDate || endDate) {
      billWhere.payment_date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        billWhere.payment_date.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        billWhere.payment_date.lte = end;
      }
    }

    // Don't include payments made against cancelled invoices
    billWhere.invoice = {
      ...(billWhere.invoice || {}),
      status: { not: 'cancelled' },
    };

    const bills = await prisma.bill.findMany({
      where: billWhere,
      include: {
        invoice: {
          include: { customer: true },
        },
      },
      orderBy: { payment_date: 'desc' },
    });

    const totalReceived = bills.reduce((sum, b) => sum + b.amount_paid, 0);
    const outstandingBalance = Math.max(0, totalInvoiced - totalReceived);

    // Top Customers analysis
    const customerAggregationMap: Record<string, { name: string; invoiced: number; received: number }> = {};
    for (const inv of invoices) {
      const cId = inv.customer_id;
      if (!customerAggregationMap[cId]) {
        customerAggregationMap[cId] = {
          name: inv.customer.name,
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
      .sort((a, b) => b.invoiced - a.invoiced)
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
