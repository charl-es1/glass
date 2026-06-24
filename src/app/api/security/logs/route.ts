import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    // Managers (admin / supervisor) can view the logs
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceNo = searchParams.get('invoice_no');
    const officerName = searchParams.get('officer_name');
    const action = searchParams.get('action');
    const status = searchParams.get('status');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const whereClause: any = {};

    if (officerName) {
      whereClause.officer_name = { contains: officerName };
    }

    if (action) {
      whereClause.action = action;
    }

    // Filter by verification status or invoice_no
    if (status || invoiceNo) {
      whereClause.verification = {};
      if (status) {
        whereClause.verification.status = status;
      }
      if (invoiceNo) {
        whereClause.verification.invoice = {
          invoice_no: { contains: invoiceNo }
        };
      }
    }

    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) {
        whereClause.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.timestamp.lte = new Date(endDate);
      }
    }

    const logs = await prisma.securityLog.findMany({
      where: whereClause,
      include: {
        verification: {
          include: {
            invoice: {
              select: {
                id: true,
                invoice_no: true,
                driver_name: true,
                vehicle_no: true,
                status: true,
              }
            }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching security audit logs:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
