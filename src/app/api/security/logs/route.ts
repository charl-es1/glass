import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
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

    const invoicesSnap = await adminDb.collection('invoices').get();
    const logs: any[] = [];

    invoicesSnap.docs.forEach((doc: any) => {
      const inv = doc.data();
      if (inv.security_verification && inv.security_verification.logs) {
        inv.security_verification.logs.forEach((log: any) => {
          logs.push({
            ...log,
            verification: {
              ...inv.security_verification,
              invoice: {
                id: doc.id,
                invoice_no: inv.invoice_no,
                driver_name: inv.driver_name,
                vehicle_no: inv.vehicle_no,
                status: inv.status,
              },
            },
          });
        });
      }
    });

    let filteredLogs = [...logs];

    if (officerName) {
      filteredLogs = filteredLogs.filter((l: any) => l.officer_name && l.officer_name.toLowerCase().includes(officerName.toLowerCase()));
    }

    if (action) {
      filteredLogs = filteredLogs.filter((l: any) => l.action === action);
    }

    if (status) {
      filteredLogs = filteredLogs.filter((l: any) => l.verification && l.verification.status === status);
    }

    if (invoiceNo) {
      filteredLogs = filteredLogs.filter(
        (l: any) => l.verification && l.verification.invoice && l.verification.invoice.invoice_no.toLowerCase().includes(invoiceNo.toLowerCase())
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      filteredLogs = filteredLogs.filter((l: any) => new Date(l.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      filteredLogs = filteredLogs.filter((l: any) => new Date(l.timestamp) <= end);
    }

    // Sort by timestamp desc
    filteredLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(filteredLogs);
  } catch (error) {
    console.error('Error fetching security audit logs:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
