import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

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

    // Pre-check for duplicate verification
    const existing = await prisma.securityVerification.findUnique({
      where: { invoice_id },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'This invoice has already been verified' },
        { status: 400 }
      );
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Double check duplicate in transaction
        const existingTx = await tx.securityVerification.findUnique({
          where: { invoice_id },
        });
        if (existingTx) {
          throw new Error('DUPLICATE_VERIFICATION');
        }

        // Generate unique clearance_ref CLR-XXXX
        const totalCount = await tx.securityVerification.count();
        let nextNum = 1001 + totalCount;
        let clearance_ref = '';
        let isUnique = false;
        while (!isUnique) {
          clearance_ref = `CLR-${nextNum}`;
          const duplicate = await tx.securityVerification.findUnique({
            where: { clearance_ref },
          });
          if (!duplicate) {
            isUnique = true;
          } else {
            nextNum++;
          }
        }

        // Create SecurityVerification
        const createdVerification = await tx.securityVerification.create({
          data: {
            invoice_id,
            officer_id: user.id,
            officer_name: user.name,
            signatory_name,
            signature_data,
            status,
            notes: notes || null,
            verified_at: new Date(verified_at || Date.now()),
            is_offline: !!is_offline,
            synced_at: new Date(),
            clearance_ref,
          },
        });

        // Create checklist items
        if (items && Array.isArray(items)) {
          for (const item of items) {
            await tx.securityVerificationItem.create({
              data: {
                verification_id: createdVerification.id,
                line_item_id: item.line_item_id,
                glass_type_name: item.glass_type_name,
                dimensions: item.dimensions,
                quantity: Number(item.quantity || 1),
                is_verified: !!item.is_verified,
                is_flagged: !!item.is_flagged,
                flag_notes: item.flag_notes || null,
              },
            });
          }
        }

        // Update Invoice status
        // "dispatched" if clean (i.e. status is dispatched) or "on_hold_discrepancy" if not
        const finalStatus = status === 'dispatched' ? 'dispatched' : 'on_hold_discrepancy';
        await tx.invoice.update({
          where: { id: invoice_id },
          data: { status: finalStatus },
        });

        // Save audit logs
        if (logs && Array.isArray(logs)) {
          for (const log of logs) {
            await tx.securityLog.create({
              data: {
                verification_id: createdVerification.id,
                officer_name: user.name,
                action: log.action,
                details: log.details,
                timestamp: new Date(log.timestamp || Date.now()),
                is_offline: !!log.is_offline,
              },
            });
          }
        } else {
          // If no offline logs passed, create a default submit log
          await tx.securityLog.create({
            data: {
              verification_id: createdVerification.id,
              officer_name: user.name,
              action: 'SUBMIT',
              details: `Verification submitted with status: ${status}`,
              timestamp: new Date(),
              is_offline: false,
            },
          });
        }

        return { createdVerification, clearance_ref };
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
        verification: result.createdVerification,
        clearance_ref: result.clearance_ref,
      });
    } catch (txErr: any) {
      if (txErr.message === 'DUPLICATE_VERIFICATION') {
        return NextResponse.json(
          { error: 'This invoice has already been verified' },
          { status: 400 }
        );
      }
      throw txErr;
    }
  } catch (error) {
    console.error('Error recording security verification:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const whereClause: any = {};
    // Security role gets only their own checks, others (admin/supervisor) get all checks
    if (user.role === 'security') {
      whereClause.officer_id = user.id;
    }

    const verifications = await prisma.securityVerification.findMany({
      where: whereClause,
      include: {
        invoice: {
          include: {
            customer: true,
          },
        },
        items: true,
      },
      orderBy: { verified_at: 'desc' },
    });

    return NextResponse.json(verifications);
  } catch (error) {
    console.error('Error fetching past verifications:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
