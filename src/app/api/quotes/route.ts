import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
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

    const quotes = await prisma.quote.findMany({
      where: { user_id: user.id },
      include: {
        glass_type: {
          select: { name: true, price_per_sqm: true },
        },
        line_items: true,
      },
      orderBy: { created_at: 'desc' },
    });

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
      const glassTypes = await prisma.glassType.findMany({
        where: { id: { in: glassTypeIds } },
      });

      const glassTypesMap = new Map(glassTypes.map((gt) => [gt.id, gt]));

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

      // Create a single grouped quote in database
      const newQuote = await prisma.quote.create({
        data: {
          user_id: user.id,
          glass_type_id: null,
          length: null,
          width: null,
          thickness: null,
          area: totalArea,
          total_price: finalTotalPrice,
          discount_percentage: finalDiscount,
          items_json: JSON.stringify(computedItems),
        },
        include: {
          glass_type: {
            select: { name: true, price_per_sqm: true },
          },
          line_items: true,
        },
      });

      // Log combined activity
      const quoteSummaries = computedItems.map(item => `${item.glass_type_name} (${item.length.toFixed(2)}m x ${item.width.toFixed(2)}m)`).join(', ');
      await logActivity(
        user.id,
        user.email,
        user.name,
        'CREATE_QUOTE',
        `Created grouped quote: [${quoteSummaries}] - Combined Total: ${finalTotalPrice.toFixed(2)} GHS (Discounted ${finalDiscount}%)`
      );

      return NextResponse.json(newQuote, { status: 201 });
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
    const glassType = await prisma.glassType.findUnique({
      where: { id: glass_type_id },
    });

    if (!glassType) {
      return NextResponse.json(
        { error: 'Selected glass type does not exist' },
        { status: 400 }
      );
    }

    // Compute area and price (including thickness multiplier)
    const area = len * wid;
    const basePrice = area * glassType.price_per_sqm * thick;
    const discountAmount = basePrice * (finalDiscount / 100);
    const finalTotalPrice = basePrice - discountAmount;

    // Save quote
    const newQuote = await prisma.quote.create({
      data: {
        user_id: user.id,
        glass_type_id,
        length: len,
        width: wid,
        thickness: thick,
        area,
        total_price: finalTotalPrice,
        discount_percentage: finalDiscount,
      },
      include: {
        glass_type: {
          select: { name: true, price_per_sqm: true },
        },
        line_items: true,
      },
    });

    // Log CREATE_QUOTE activity
    await logActivity(
      user.id,
      user.email,
      user.name,
      'CREATE_QUOTE',
      `Created quote for ${newQuote.glass_type?.name} (${len.toFixed(2)}m × ${wid.toFixed(2)}m × ${thick.toFixed(1)}mm) - Total: ${finalTotalPrice.toFixed(2)} GHS (Discounted ${finalDiscount}%)`
    );

    return NextResponse.json(newQuote, { status: 201 });
  } catch (error: any) {
    console.error('Error saving quote:', error);
    if (error instanceof Error && error.message.includes('Selected glass type does not exist')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
