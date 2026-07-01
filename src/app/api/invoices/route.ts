import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Retrieve invoices (authenticated users only)
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');

    let query: any = adminDb.collection('invoices');
    if (customerId) {
      query = query.where('customer_id', '==', customerId);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.get();
    
    // Optimizing lookups using local maps to avoid nested DB reads
    const gtSnap = await adminDb.collection('glass_types').get();
    const gtMap = new Map<string, any>(gtSnap.docs.map((doc: any) => [doc.id, doc.data()]));

    const custSnap = await adminDb.collection('customers').get();
    const custMap = new Map<string, any>(custSnap.docs.map((doc: any) => [doc.id, { id: doc.id, ...doc.data() }]));

    const userSnap = await adminDb.collection('users').get();
    const userMap = new Map<string, any>(userSnap.docs.map((doc: any) => [doc.id, { id: doc.id, name: doc.data().name, email: doc.data().email }]));

    const invoices = [];
    for (const doc of snap.docs) {
      const inv = doc.data();
      const customer = custMap.get(inv.customer_id) || null;
      const userDoc = userMap.get(inv.user_id) || null;

      const populatedLineItems = (inv.line_items || []).map((item: any) => {
        const gtData = gtMap.get(item.glass_type_id);
        const glass_type = gtData ? { id: item.glass_type_id, name: gtData.name } : null;
        return {
          ...item,
          glass_type,
        };
      });

      invoices.push({
        id: doc.id,
        ...inv,
        customer,
        user: userDoc,
        line_items: populatedLineItems,
        bills: inv.bills || [],
      });
    }

    // Sort by created_at desc (since Firestore compound index is not needed if we sort in memory)
    invoices.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: Generate a new invoice
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, dueDate, tax, quotes, customItems, discount_percentage } = body;

    if (!customerId || !dueDate) {
      return NextResponse.json(
        { error: 'Customer and due date are required' },
        { status: 400 }
      );
    }

    // Validate discount percentage if present
    const rawDiscount = parseFloat(discount_percentage);
    const parsedDiscount = !isNaN(rawDiscount) ? rawDiscount : 0.0;
    if (parsedDiscount < 0 || parsedDiscount > 100) {
      return NextResponse.json(
        { error: 'Discount percentage must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Only admin and supervisor can apply discount
    const finalDiscount = (user.role === 'admin' || user.role === 'supervisor') ? parsedDiscount : 0.0;
    const parsedTax = parseFloat(tax) || 0.0;
    const itemsToCreate: any[] = [];

    // 1. Process quote conversions if any
    if (quotes && Array.isArray(quotes) && quotes.length > 0) {
      for (const quoteId of quotes) {
        const quoteDoc = await adminDb.collection('quotes').doc(quoteId).get();
        if (!quoteDoc.exists) {
          return NextResponse.json(
            { error: `Quote ${quoteId} not found` },
            { status: 400 }
          );
        }
        const quote = quoteDoc.data()!;

        if (quote.invoice_id) {
          return NextResponse.json(
            { error: `Quote ${quoteId.slice(0, 8)} is already converted to an invoice.` },
            { status: 400 }
          );
        }

        if (quote.items_json) {
          const parsedItems = JSON.parse(quote.items_json);
          for (const item of parsedItems) {
            itemsToCreate.push({
              quote_id: quoteId,
              glass_type_id: item.glass_type_id,
              length: item.length,
              width: item.width,
              thickness: item.thickness,
              area: item.area,
              quantity: 1,
              unit_price: item.price,
              total_price: item.price,
            });
          }
        } else {
          itemsToCreate.push({
            quote_id: quoteId,
            glass_type_id: quote.glass_type_id!,
            length: quote.length!,
            width: quote.width!,
            thickness: quote.thickness!,
            area: quote.area!,
            quantity: 1,
            unit_price: quote.total_price,
            total_price: quote.total_price,
          });
        }
      }
    }

    // 2. Process custom direct line items if any
    if (customItems && Array.isArray(customItems) && customItems.length > 0) {
      for (const item of customItems) {
        const { glassTypeId, length, width, thickness, quantity } = item;
        const qty = parseInt(quantity) || 1;
        const len = parseFloat(length);
        const wid = parseFloat(width);
        const thick = parseFloat(thickness);

        if (!glassTypeId || isNaN(len) || len <= 0 || isNaN(wid) || wid <= 0 || isNaN(thick) || thick <= 0) {
          return NextResponse.json(
            { error: 'Invalid custom line item specifications.' },
            { status: 400 }
          );
        }

        const gtSnap = await adminDb.collection('glass_types').doc(glassTypeId).get();
        if (!gtSnap.exists) {
          return NextResponse.json(
            { error: 'Selected glass type for custom item does not exist.' },
            { status: 400 }
          );
        }
        const glassType = gtSnap.data()!;

        const area = len * wid;
        const unitPrice = area * glassType.price_per_sqm * thick;
        const totalPrice = unitPrice * qty;

        itemsToCreate.push({
          glass_type_id: glassTypeId,
          length: len,
          width: wid,
          thickness: thick,
          area,
          quantity: qty,
          unit_price: unitPrice,
          total_price: totalPrice,
        });
      }
    }

    if (itemsToCreate.length === 0) {
      return NextResponse.json(
        { error: 'An invoice must contain at least one quote or custom item.' },
        { status: 400 }
      );
    }

    // Compute subtotal, discount, and totals
    const subtotal = itemsToCreate.reduce((sum: number, item: any) => sum + item.total_price, 0);
    const discountAmount = subtotal * (finalDiscount / 100);
    const totalAmount = subtotal - discountAmount + parsedTax;

    // Use transaction to create invoice
    const result = await adminDb.runTransaction(async (transaction: any) => {
      const invoicesSnap = await transaction.get(adminDb.collection('invoices'));
      const invoiceCount = invoicesSnap.size;
      const invoiceNo = `INV-${1000 + invoiceCount + 1}`;

      const invoiceRef = adminDb.collection('invoices').doc();
      const invoiceData = {
        id: invoiceRef.id,
        invoice_no: invoiceNo,
        customer_id: customerId,
        user_id: user.id,
        issue_date: new Date().toISOString(),
        due_date: new Date(dueDate).toISOString(),
        status: 'unpaid',
        subtotal,
        discount_percentage: finalDiscount,
        tax: parsedTax,
        total_amount: totalAmount,
        amount_paid: 0.0,
        balance_due: totalAmount,
        line_items: itemsToCreate,
        bills: [],
        created_at: new Date().toISOString(),
      };

      transaction.set(invoiceRef, invoiceData);

      // Update associated quotes to mark them as converted
      if (quotes && Array.isArray(quotes)) {
        for (const quoteId of quotes) {
          const quoteRef = adminDb.collection('quotes').doc(quoteId);
          transaction.update(quoteRef, { invoice_id: invoiceRef.id });
        }
      }

      return invoiceData;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
