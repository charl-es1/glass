import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/db';
import ProjectsDrawingsClient from './ProjectsDrawingsClient';

interface DrawingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function DrawingsPage({ params }: DrawingsPageProps) {
  // 1. Verify Authentication
  const user = await getAuthUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;

  // Fetch dynamic glazing categories catalog (lazy initialize if empty)
  const catalogCount = await prisma.category.count();
  if (catalogCount === 0) {
    const { initializeGlazingCatalog } = await import('@/lib/glazing-seed');
    await initializeGlazingCatalog();
  }

  const catalog = await prisma.category.findMany({
    include: {
      subtypes: {
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
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

  // 3. Retrieve invoice details from SQLite DB
  let invoice = null;
  try {
    invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        line_items: {
          include: {
            glass_type: {
              select: {
                id: true,
                name: true,
                price_per_sqm: true,
              },
            },
          },
        },
        bills: true,
      },
    });
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
