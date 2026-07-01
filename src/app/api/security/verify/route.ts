import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST: Record security gate exit verification
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      invoice_id,
      signatory_name,
      signature_data,
      status, // "dispatched" or "on_hold_discrepancy"
      notes,
      verified_at,
      is_offline,
      items,
      logs,
    } = body;

    if (!invoice_id || !signatory_name || !signature_data || !status) {
      return NextResponse.json(
        { error: 'Missing required verification fields' },
        { status: 400 }
      );
    }

    const invoiceRef = adminDb.collection('invoices').doc(invoice_id);
    
    // Execute inside a database transaction to prevent duplicates and race conditions
    const result = await adminDb.runTransaction(async (transaction: any) => {
      const invoiceSnap = await transaction.get(invoiceRef);
      if (!invoiceSnap.exists) {
        throw new Error('INVOICE_NOT_FOUND');
      }
      
      const invoice = invoiceSnap.data()!;
      if (invoice.security_verification) {
        throw new Error('DUPLICATE_VERIFICATION');
      }

      // Generate clearance_ref: Count how many invoices already have a clearance_ref
      const allInvoicesSnap = await transaction.get(adminDb.collection('invoices'));
      let verifiedCount = 0;
      allInvoicesSnap.docs.forEach((doc: any) => {
        if (doc.data().security_verification) {
          verifiedCount++;
        }
      });

      let nextNum = 1001 + verifiedCount;
      let clearance_ref = '';
      let isUnique = false;

      while (!isUnique) {
        clearance_ref = `CLR-${nextNum}`;
        const hasDuplicate = allInvoicesSnap.docs.some((doc: any) => {
          const inv = doc.data();
          return inv.security_verification && inv.security_verification.clearance_ref === clearance_ref;
        });

        if (!hasDuplicate) {
          isUnique = true;
        } else {
          nextNum++;
        }
      }

      // Build items
      const checklistItems = (items || []).map((it: any) => ({
        id: adminDb.collection('invoices').doc().id,
        line_item_id: it.line_item_id,
        glass_type_name: it.glass_type_name,
        dimensions: it.dimensions,
        quantity: Number(it.quantity || 1),
        is_verified: !!it.is_verified,
        is_flagged: !!it.is_flagged,
        flag_notes: it.flag_notes || null,
      }));

      // Build logs
      const verificationLogs = logs && Array.isArray(logs) 
        ? logs.map((l: any) => ({
            id: adminDb.collection('invoices').doc().id,
            officer_name: user.name,
            action: l.action,
            details: l.details,
            timestamp: new Date(l.timestamp || Date.now()).toISOString(),
            is_offline: !!l.is_offline,
          }))
        : [{
            id: adminDb.collection('invoices').doc().id,
            officer_name: user.name,
            action: 'SUBMIT',
            details: `Verification submitted with status: ${status}`,
            timestamp: new Date().toISOString(),
            is_offline: false,
          }];

      const securityVerification = {
        id: adminDb.collection('invoices').doc().id,
        invoice_id,
        officer_id: user.id,
        officer_name: user.name,
        signatory_name,
        signature_data,
        status,
        notes: notes || null,
        verified_at: new Date(verified_at || Date.now()).toISOString(),
        is_offline: !!is_offline,
        synced_at: new Date().toISOString(),
        clearance_ref,
        items: checklistItems,
        logs: verificationLogs,
      };

      const finalStatus = status === 'dispatched' ? 'dispatched' : 'on_hold_discrepancy';

      transaction.update(invoiceRef, {
        status: finalStatus,
        security_verification: securityVerification,
      });

      return { securityVerification, clearance_ref };
    });

    // Log activity to standard ActivityLog
    await logActivity(
      user.id,
      user.email,
      user.name,
      'VERIFY_INVOICE',
      `Officer verified invoice ${invoice_id} - status: ${status}, clearance: ${result.clearance_ref}`
    );

    return NextResponse.json({
      success: true,
      verification: result.securityVerification,
      clearance_ref: result.clearance_ref,
    });
  } catch (error: any) {
    console.error('Error recording security verification:', error);
    if (error.message === 'DUPLICATE_VERIFICATION') {
      return NextResponse.json(
        { error: 'This invoice has already been verified' },
        { status: 400 }
      );
    }
    if (error.message === 'INVOICE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// GET: Retrieve past verifications
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoicesSnap = await adminDb.collection('invoices').get();
    const customersSnap = await adminDb.collection('customers').get();
    const custMap = new Map(customersSnap.docs.map((doc: any) => [doc.id, { id: doc.id, ...doc.data() }]));

    const verifications: any[] = [];
    invoicesSnap.docs.forEach((doc: any) => {
      const inv = doc.data();
      if (inv.security_verification) {
        if (user.role === 'security' && inv.security_verification.officer_id !== user.id) {
          return;
        }

        const customer = custMap.get(inv.customer_id) || null;
        verifications.push({
          ...inv.security_verification,
          invoice: {
            ...inv,
            customer,
          },
          items: inv.security_verification.items || [],
        });
      }
    });

    // Sort by verified_at desc
    verifications.sort((a: any, b: any) => new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime());

    return NextResponse.json(verifications);
  } catch (error) {
    console.error('Error fetching past verifications:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
