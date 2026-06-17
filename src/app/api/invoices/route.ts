import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

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

    const where: any = {};
    if (customerId) {
      where.customer_id = customerId;
    }
    if (status) {
      where.status = status;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        user: { select: { id: true, name: true, email: true } },
        line_items: {
          include: {
            glass_type: { select: { id: true, name: true } },
          },
        },
        bills: {
          orderBy: { payment_date: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

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
      const dbQuotes = await prisma.quote.findMany({
        where: {
          id: { in: quotes },
        },
        include: {
          glass_type: true,
          line_items: true,
        },
      });

      for (const quote of dbQuotes) {
        if (quote.line_items.length > 0) {
          return NextResponse.json(
            { error: `Quote ${quote.id.slice(0, 8)} is already converted to an invoice.` },
            { status: 400 }
          );
        }

        if (quote.items_json) {
          const parsedItems = JSON.parse(quote.items_json);
          for (const item of parsedItems) {
            itemsToCreate.push({
              quote_id: quote.id,
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
            quote_id: quote.id,
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

        const glassType = await prisma.glassType.findUnique({
          where: { id: glassTypeId },
        });

        if (!glassType) {
          return NextResponse.json(
            { error: 'Selected glass type for custom item does not exist.' },
            { status: 400 }
          );
        }

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
    const subtotal = itemsToCreate.reduce((sum, item) => sum + item.total_price, 0);
    const discountAmount = subtotal * (finalDiscount / 100);
    const totalAmount = subtotal - discountAmount + parsedTax;

    // Use transaction to write invoice and update invoice count
    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceCount = await tx.invoice.count();
      const invoiceNo = `INV-${1000 + invoiceCount + 1}`;

      return tx.invoice.create({
        data: {
          invoice_no: invoiceNo,
          customer_id: customerId,
          user_id: user.id,
          due_date: new Date(dueDate),
          status: 'unpaid',
          subtotal,
          discount_percentage: finalDiscount,
          tax: parsedTax,
          total_amount: totalAmount,
          balance_due: totalAmount,
          line_items: {
            create: itemsToCreate,
          },
        },
        include: {
          customer: true,
          line_items: {
            include: {
              glass_type: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
