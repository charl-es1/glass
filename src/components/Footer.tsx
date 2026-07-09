'use client';

import React from 'react';

interface FooterProps {
  settings: {
    siteTitle: string;
    email: string;
    phone: string;
    address: string;
    footerLogo: {
      url: string;
      width: number;
      height: number;
    } | null;
  } | null;
}

export default function Footer({ settings }: FooterProps) {
  const currentYear = new Date().getFullYear();
  
  const siteTitle = settings?.siteTitle || 'GlassCut Manager';
  const email = settings?.email || 'info@glasscutting.com';
  const phone = settings?.phone || '+233 24 123 4567';
  const address = settings?.address || '123 Glass Lane, Industrial Area, Accra, Ghana';
  const footerLogo = settings?.footerLogo;

  return (
    <footer style={{
      marginTop: 'auto',
      padding: '40px 24px 30px',
      backgroundColor: 'var(--bg-card)',
      borderTop: '1px solid var(--border)',
      color: 'var(--text-main)',
      fontSize: '0.9rem',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '40px',
        marginBottom: '40px',
      }}>
        {/* Branding Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {footerLogo ? (
            <img 
              src={footerLogo.url} 
              alt={`${siteTitle} Footer Logo`} 
              style={{ 
                maxWidth: '100%', 
                width: `${footerLogo.width}px`, 
                height: `${footerLogo.height}px`, 
                objectFit: 'contain' 
              }} 
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
              <span className="text-gradient" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                {siteTitle}
              </span>
            </div>
          )}
          <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.6', maxWidth: '300px' }}>
            Enterprise-grade real-time price calculator and quote management system for premium glass cutting operations.
          </p>
        </div>

        {/* Contact Info Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1rem', borderBottom: '2px solid var(--border)', paddingBottom: '6px', width: 'fit-content' }}>
            Contact & Support
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="text-muted">Email:</span>
              <a href={`mailto:${email}`} style={{ color: 'var(--primary)' }}>{email}</a>
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="text-muted">Phone:</span>
              <a href={`tel:${phone}`} style={{ color: 'var(--primary)' }}>{phone}</a>
            </p>
          </div>
        </div>

        {/* Address & Localization Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1rem', borderBottom: '2px solid var(--border)', paddingBottom: '6px', width: 'fit-content' }}>
            Headquarters
          </h4>
          <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
            {address}
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        paddingTop: '20px',
        borderTop: '1px solid var(--border-light)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        fontSize: '0.8rem',
      }}>
        <p className="text-muted">
          &copy; {currentYear} {siteTitle}. All rights reserved.
        </p>
        <p className="text-muted" style={{ marginLeft: 'auto' }}>
          Reliable operational computing &bull; ISO Standard compliance
        </p>
      </div>
    </footer>
  );
}
