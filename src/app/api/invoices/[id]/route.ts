import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        user: { select: { id: true, name: true, email: true } },
        line_items: {
          include: {
            glass_type: { select: { id: true, name: true, price_per_sqm: true } },
          },
        },
        bills: {
          orderBy: { payment_date: 'desc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (driver_name !== undefined) updateData.driver_name = driver_name;
    if (vehicle_no !== undefined) updateData.vehicle_no = vehicle_no;
    if (status !== undefined) updateData.status = status;

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
    });

    await logActivity(
      user.id,
      user.email,
      user.name,
      'UPDATE_INVOICE',
      `Updated invoice ${invoice.invoice_no}: ${JSON.stringify(updateData)}`
    );

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

