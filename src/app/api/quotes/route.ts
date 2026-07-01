import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET: Retrieve quotes for the currently logged-in user
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quotesSnap = await adminDb
      .collection('quotes')
      .where('user_id', '==', user.id)
      .orderBy('created_at', 'desc')
      .get();

    const quotes = [];
    for (const doc of quotesSnap.docs) {
      const q = doc.data();
      let glassType = null;
      if (q.glass_type_id) {
        const gtSnap = await adminDb.collection('glass_types').doc(q.glass_type_id).get();
        if (gtSnap.exists) {
          const gtData = gtSnap.data()!;
          glassType = {
            name: gtData.name,
            price_per_sqm: gtData.price_per_sqm,
          };
        }
      }
      quotes.push({
        id: doc.id,
        ...q,
        glass_type: glassType,
        line_items: [],
      });
    }

    return NextResponse.json(quotes);
  } catch (error) {
    console.error('Error fetching user quotes:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: Save a new quote
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { items, length, width, thickness, glass_type_id, discount_percentage } = body;

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

    // Check if bulk insert is requested
    if (items && Array.isArray(items) && items.length > 0) {
      // Validate all items
      for (const item of items) {
        const { length: len, width: wid, thickness: thick, glass_type_id: gtId } = item;
        if (len === undefined || wid === undefined || !gtId) {
          return NextResponse.json(
            { error: 'All items must have length, width, and glass type specified' },
            { status: 400 }
          );
        }
        const parsedLen = parseFloat(len);
        const parsedWid = parseFloat(wid);
        const parsedThick = thick !== undefined ? parseFloat(thick) : 6.0;
        if (isNaN(parsedLen) || parsedLen <= 0 || isNaN(parsedWid) || parsedWid <= 0 || isNaN(parsedThick) || parsedThick <= 0) {
          return NextResponse.json(
            { error: 'Length, width, and thickness must be positive numbers' },
            { status: 400 }
          );
        }
      }

      // Fetch all required glass types first to validate and compute
      const glassTypeIds = Array.from(new Set(items.map((item: any) => item.glass_type_id)));
      const glassTypesMap = new Map();

      for (const gtId of glassTypeIds) {
        const gtSnap = await adminDb.collection('glass_types').doc(gtId as string).get();
        if (gtSnap.exists) {
          glassTypesMap.set(gtId, gtSnap.data());
        }
      }

      // Parse and compute specifications
      const computedItems = [];
      let totalArea = 0;
      let grandTotal = 0;

      for (const item of items) {
        const { length: len, width: wid, thickness: thick, glass_type_id: gtId } = item;
        const parsedLen = parseFloat(len);
        const parsedWid = parseFloat(wid);
        const parsedThick = thick !== undefined ? parseFloat(thick) : 6.0;

        const glassType = glassTypesMap.get(gtId);
        if (!glassType) {
          return NextResponse.json(
            { error: `Selected glass type does not exist: ${gtId}` },
            { status: 400 }
          );
        }

        const area = parsedLen * parsedWid;
        const price = area * glassType.price_per_sqm * parsedThick;

        totalArea += area;
        grandTotal += price;

        computedItems.push({
          glass_type_id: gtId,
          glass_type_name: glassType.name,
          length: parsedLen,
          width: parsedWid,
          thickness: parsedThick,
          area,
          price,
        });
      }

      const discountAmount = grandTotal * (finalDiscount / 100);
      const finalTotalPrice = grandTotal - discountAmount;

      // Create a single grouped quote in Firestore
      const docRef = adminDb.collection('quotes').doc();
      const newQuote = {
        id: docRef.id,
        user_id: user.id,
        glass_type_id: null,
        length: null,
        width: null,
        thickness: null,
        area: totalArea,
        total_price: finalTotalPrice,
        discount_percentage: finalDiscount,
        items_json: JSON.stringify(computedItems),
        created_at: new Date().toISOString(),
      };

      await docRef.set(newQuote);

      // Log combined activity
      const quoteSummaries = computedItems
        .map((item) => `${item.glass_type_name} (${item.length.toFixed(2)}m x ${item.width.toFixed(2)}m)`)
        .join(', ');
      await logActivity(
        user.id,
        user.email,
        user.name,
        'CREATE_QUOTE',
        `Created grouped quote: [${quoteSummaries}] - Combined Total: ${finalTotalPrice.toFixed(2)} GHS (Discounted ${finalDiscount}%)`
      );

      const responseQuote = {
        ...newQuote,
        glass_type: null,
        line_items: [],
      };

      return NextResponse.json(responseQuote, { status: 201 });
    }

    // Fall back to single quote insert
    if (length === undefined || width === undefined || !glass_type_id) {
      return NextResponse.json(
        { error: 'Length, width, and glass type are required' },
        { status: 400 }
      );
    }

    const len = parseFloat(length);
    const wid = parseFloat(width);
    const thick = thickness !== undefined ? parseFloat(thickness) : 6.0;

    if (isNaN(len) || len <= 0 || isNaN(wid) || wid <= 0 || isNaN(thick) || thick <= 0) {
      return NextResponse.json(
        { error: 'Length, width, and thickness must be positive numbers' },
        { status: 400 }
      );
    }

    // Get glass type to retrieve the unit price
    const gtSnap = await adminDb.collection('glass_types').doc(glass_type_id).get();
    if (!gtSnap.exists) {
      return NextResponse.json(
        { error: 'Selected glass type does not exist' },
        { status: 400 }
      );
    }
    const glassType = gtSnap.data()!;

    // Compute area and price (including thickness multiplier)
    const area = len * wid;
    const basePrice = area * glassType.price_per_sqm * thick;
    const discountAmount = basePrice * (finalDiscount / 100);
    const finalTotalPrice = basePrice - discountAmount;

    // Save quote
    const docRef = adminDb.collection('quotes').doc();
    const newQuote = {
      id: docRef.id,
      user_id: user.id,
      glass_type_id,
      length: len,
      width: wid,
      thickness: thick,
      area,
      total_price: finalTotalPrice,
      discount_percentage: finalDiscount,
      created_at: new Date().toISOString(),
    };

    await docRef.set(newQuote);

    // Log CREATE_QUOTE activity
    await logActivity(
      user.id,
      user.email,
      user.name,
      'CREATE_QUOTE',
      `Created quote for ${glassType.name} (${len.toFixed(2)}m × ${wid.toFixed(2)}m × ${thick.toFixed(1)}mm) - Total: ${finalTotalPrice.toFixed(2)} GHS (Discounted ${finalDiscount}%)`
    );

    const responseQuote = {
      ...newQuote,
      glass_type: {
        name: glassType.name,
        price_per_sqm: glassType.price_per_sqm,
      },
      line_items: [],
    };

    return NextResponse.json(responseQuote, { status: 201 });
  } catch (error: any) {
    console.error('Error saving quote:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
