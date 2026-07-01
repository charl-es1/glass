import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import ProjectsDrawingsClient from './ProjectsDrawingsClient';

interface DrawingsPageProps {
  params: Promise<{ id: string }>;
}

// Helper function to find invoice by ID or human-readable number fallbacks
async function findInvoiceByIdOrFallback(id: string) {
  // 1. Try by document ID
  const docRef = adminDb.collection('invoices').doc(id);
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    return { id: docSnap.id, ...docSnap.data() };
  }

  // 2. Try by exact invoice_no
  const snapNo = await adminDb.collection('invoices').where('invoice_no', '==', id).limit(1).get();
  if (!snapNo.empty) {
    const doc = snapNo.docs[0]!;
    return { id: doc.id, ...doc.data() };
  }

  // 3. Try by uppercase invoice_no
  const snapUpper = await adminDb.collection('invoices').where('invoice_no', '==', id.toUpperCase()).limit(1).get();
  if (!snapUpper.empty) {
    const doc = snapUpper.docs[0]!;
    return { id: doc.id, ...doc.data() };
  }

  // 4. Try by quote_id in line_items
  const allSnap = await adminDb.collection('invoices').get();
  for (const doc of allSnap.docs) {
    const inv = doc.data();
    const hasQuote = (inv.line_items || []).some((item: any) => item.quote_id === id);
    if (hasQuote) {
      return { id: doc.id, ...inv };
    }
  }

  return null;
}

export default async function DrawingsPage({ params }: DrawingsPageProps) {
  // 1. Verify Authentication
  const user = await getAuthUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;

  // Fetch glazing categories catalog from Firestore
  const categoriesSnap = await adminDb.collection('categories').get();
  const catalog = categoriesSnap.docs.map((doc: any) => {
    const data = doc.data();
    // Sort subtypes by name asc
    const subtypes = (data.subtypes || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
    return {
      id: doc.id,
      name: data.name,
      slug: data.slug,
      subtypes,
    };
  });

  // Sort categories by name asc
  catalog.sort((a: any, b: any) => a.name.localeCompare(b.name));

  const serializedCatalog = JSON.parse(JSON.stringify(catalog));

  // 2. Identify if it is a template/mock ID
  const isMock = ['ref1', 'ref2', 'ref3', 'ref4'].includes(id);

  if (isMock) {
    return (
      <ProjectsDrawingsClient
        invoice={null}
        mockId={id as 'ref1' | 'ref2' | 'ref3' | 'ref4'}
        user={user}
        catalogCategories={serializedCatalog}
      />
    );
  }

  // 3. Retrieve invoice details from Firestore
  let invoice: any = null;
  try {
    invoice = await findInvoiceByIdOrFallback(id);

    if (invoice) {
      // Populate customer
      const custSnap = await adminDb.collection('customers').doc(invoice.customer_id).get();
      invoice.customer = custSnap.exists ? { id: custSnap.id, ...custSnap.data() } : null;

      // Populate glass_types for line_items
      const gtSnap = await adminDb.collection('glass_types').get();
      const gtMap = new Map<string, any>(gtSnap.docs.map((doc: any) => [doc.id, doc.data()]));

      invoice.line_items = (invoice.line_items || []).map((item: any) => {
        const gtData = gtMap.get(item.glass_type_id);
        const glass_type = gtData ? { id: item.glass_type_id, name: gtData.name, price_per_sqm: gtData.price_per_sqm } : null;
        return {
          ...item,
          glass_type,
        };
      });

      invoice.bills = invoice.bills || [];
    }
  } catch (error) {
    console.error('Error fetching invoice details for drawings page:', error);
  }

  if (!invoice) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#070b19',
          padding: '24px',
        }}
      >
        <div
          className="card-glass"
          style={{
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
            border: '1px solid rgba(244, 63, 94, 0.2)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              padding: '16px',
              borderRadius: '50%',
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              color: '#f43f5e',
              marginBottom: '24px',
            }}
          >
            <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 style={{ marginBottom: '12px', fontSize: '1.6rem' }}>Invoice Not Found</h2>
          <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.95rem' }}>
            The drawings portal was accessed with an invalid invoice reference ID ({id}).
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <a href="/dashboard" className="btn btn-secondary">
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Serialize DB data structure to prevent raw-Date server/client boundary parsing warnings in Next.js
  const serializedInvoice = JSON.parse(JSON.stringify(invoice));

  return (
    <ProjectsDrawingsClient
      invoice={serializedInvoice}
      mockId={null}
      user={user}
      catalogCategories={serializedCatalog}
    />
  );
}
