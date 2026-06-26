'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DrawingSelector, { PRODUCT_CATALOG } from '@/components/DrawingSelector';
import GlazingDrawingCanvas from '@/components/GlazingDrawingCanvas';
import { jsPDF } from 'jspdf';

interface User {
  name: string;
  email: string;
  role: string;
}

interface InvoiceLineItem {
  id: string;
  glass_type: { name: string };
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  total_price: number;
}

interface Bill {
  id: string;
  receipt_no: string;
  amount_paid: number;
  payment_date: string;
}

interface Invoice {
  id: string;
  invoice_no: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  due_date: string;
  status: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  created_at: string;
  line_items: InvoiceLineItem[];
  bills: Bill[];
}

interface DBCategory {
  id: string;
  name: string;
  slug: string;
  subtypes: {
    id: string;
    name: string;
    slug: string;
    defaultWidth: number;
    defaultHeight: number;
    operationalType: string;
  }[];
}

interface ProjectsDrawingsClientProps {
  invoice: Invoice | null;
  mockId: 'ref1' | 'ref2' | 'ref3' | 'ref4' | null;
  user: User;
  catalogCategories?: DBCategory[];
}

export default function ProjectsDrawingsClient({
  invoice,
  mockId,
  user,
  catalogCategories,
}: ProjectsDrawingsClientProps) {
  const router = useRouter();

  // Map dynamic database catalog
  const catalog = React.useMemo(() => {
    if (!catalogCategories || catalogCategories.length === 0) {
      return PRODUCT_CATALOG;
    }
    return catalogCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      types: cat.subtypes.map((sub) => ({
        id: sub.id,
        name: sub.name,
        defaultWidth: sub.defaultWidth,
        defaultHeight: sub.defaultHeight,
      })),
    }));
  }, [catalogCategories]);

  // Find dynamic catalog defaults
  const initialCat = catalog[0] || { id: '', types: [] };
  const initialType = initialCat.types[0] || { id: '', defaultWidth: 800, defaultHeight: 1200 };

  // 1. Cascading State
  const [category, setCategory] = useState<string>(initialCat.id);
  const [subType, setSubType] = useState<string>(initialType.id);
  const [width, setWidth] = useState<number>(initialType.defaultWidth);
  const [height, setHeight] = useState<number>(initialType.defaultHeight);
  const [theme, setTheme] = useState<'classic' | 'blueprint' | 'dark'>('classic');
  const [paymentSimulating, setPaymentSimulating] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

  // Initialize category/subtype setup for invoice
  useEffect(() => {
    if (invoice && invoice.line_items && invoice.line_items.length > 0) {
      setCategory('windows');
      setSubType('casement_window');
    }
  }, [invoice]);

  // Update width and height when item changes or mockId changes
  useEffect(() => {
    if (mockId) {
      if (mockId === 'ref1') {
        setCategory('doors');
        setSubType('sliding_patio_door');
        setWidth(3300);
        setHeight(2790);
      } else if (mockId === 'ref2') {
        setCategory('windows');
        setSubType('fixed_casement');
        setWidth(3365);
        setHeight(2770);
      } else if (mockId === 'ref3') {
        setCategory('windows');
        setSubType('multi_lite');
        setWidth(1990);
        setHeight(2540);
      } else if (mockId === 'ref4') {
        setCategory('doors');
        setSubType('door_sidelite');
        setWidth(2700);
        setHeight(2200);
      }
    } else if (invoice) {
      const item = invoice.line_items?.[selectedItemIndex];
      if (item) {
        setWidth(Math.round(item.width * 1000) || 800);
        setHeight(Math.round(item.length * 1000) || 1200);
      }
    }
  }, [mockId, invoice, selectedItemIndex]);

  // Determine if payment is cleared
  const isPaid = invoice ? ['paid', 'ready_for_dispatch', 'dispatched'].includes(invoice.status) : true;

  // 2. Simulated payment trigger
  const handleSimulatePayment = async () => {
    if (!invoice) return;
    setPaymentSimulating(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaid: invoice.balance_due,
          paymentMethod: 'Cash',
          notes: 'Simulated Cash checkout to unlock technical drawings',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record payment');
      }

      alert('Simulation Successful! Invoice set to PAID.');
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Error executing payment simulation.');
    } finally {
      setPaymentSimulating(false);
    }
  };

  // 3. Bill of Materials calculations
  const glassAreaSqm = (width * height) / 1000000;
  const glassWeightKg = glassAreaSqm * 15;

  const getProfileLength = (): number => {
    const perimeter = 2 * (width + height);
    let innerMullions = 0;
    let innerTransoms = 0;

    if (subType === 'sliding_window' || subType === 'double_casement_window' || subType === 'sliding_patio_door' || subType === 'double_french_door') {
      innerMullions += height;
    } else if (subType === 'fixed_casement') {
      innerMullions += height;
      innerTransoms += 595 * 2;
    } else if (subType === 'multi_lite') {
      innerMullions += height * 2;
      innerTransoms += 830;
      innerTransoms += 580 * 2 * 2;
    } else if (subType === 'door_sidelite') {
      innerMullions += height;
    } else if (subType === 'bifold_door') {
      innerMullions += height * 2;
    } else if (subType === 'inline_shower_door') {
      innerMullions += height;
    } else if (subType === 'sliding_shower_enclosure') {
      innerMullions += height;
    }

    return (perimeter + innerMullions + innerTransoms) / 1000;
  };

  const aluminumProfileMeters = getProfileLength();

  // 4. Download SVG Drawing File
  const handleDownloadSVG = () => {
    const svgEl = document.querySelector('svg');
    if (!svgEl) {
      alert('Drawing element not found');
      return;
    }
    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `ShopDrawing_${invoice?.invoice_no || 'Ref'}_${subType}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  // 5. High-Resolution Blueprint PDF Exporter (using vector lines)
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pdfW = 297;
    const pdfH = 210;
    const padding = 12;

    // A. DRAW BORDER FRAME & BLUEPRINT CARD
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.8);
    doc.rect(padding, padding, pdfW - padding * 2, pdfH - padding * 2);
    
    doc.setLineWidth(0.3);
    doc.rect(padding + 2, padding + 2, pdfW - padding * 2 - 4, pdfH - padding * 2 - 4);

    // B. RENDER TITLE BLOCK (RIGHT SIDE BAR)
    const blockX = pdfW - padding - 65;
    const blockY = padding + 2;
    const blockW = 63;
    const blockH = pdfH - padding * 2 - 4;

    doc.line(blockX, blockY, blockX, blockY + blockH);

    // Block content header
    doc.setFillColor(15, 22, 42);
    doc.rect(blockX + 2, blockY + 2, blockW - 4, 18, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('GLASS APP DESIGNER', blockX + 6, blockY + 9);
    doc.setFontSize(7.5);
    doc.setFont('Helvetica', 'normal');
    doc.text('Manufacturing Shop Drawings', blockX + 6, blockY + 15);

    doc.setTextColor(15, 22, 42);
    doc.setFontSize(7);
    
    // Project info rows
    let currentBlockY = blockY + 28;
    const drawRow = (label: string, value: string) => {
      doc.setFont('Helvetica', 'bold');
      doc.text(label, blockX + 4, currentBlockY);
      doc.setFont('Helvetica', 'normal');
      doc.text(value.length > 25 ? value.slice(0, 22) + '...' : value, blockX + 24, currentBlockY);
      doc.setDrawColor(226, 232, 240);
      doc.line(blockX + 2, currentBlockY + 3, blockX + blockW - 2, currentBlockY + 3);
      currentBlockY += 9;
    };

    const currentCatalogCategory = catalog.find(c => c.id === category);
    const currentCatalogType = currentCatalogCategory?.types.find(t => t.id === subType);

    drawRow('INVOICE REF:', invoice?.invoice_no || `MOCK-${mockId?.toUpperCase() || 'PLAYGROUND'}`);
    drawRow('PRODUCT STYLE:', currentCatalogType?.name || subType);
    drawRow('CLIENT:', invoice?.customer.name || 'Glazing Catalog Reference');
    drawRow('DESIGNER:', user.name);
    drawRow('DATE:', new Date().toLocaleDateString());
    drawRow('WIDTH:', `${Math.round(width)} mm`);
    drawRow('HEIGHT:', `${Math.round(height)} mm`);
    drawRow('GLASS AREA:', `${glassAreaSqm.toFixed(2)} m²`);
    drawRow('FRAMING:', `${aluminumProfileMeters.toFixed(1)} m`);

    // Approved by Block
    doc.setFont('Helvetica', 'bold');
    doc.text('CHECK & CONFIRMED BY:', blockX + 4, blockY + blockH - 24);
    doc.line(blockX + 4, blockY + blockH - 12, blockX + blockW - 4, blockY + blockH - 12);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('CLIENT SIGNATURE / STAMP', blockX + 4, blockY + blockH - 8);

    // C. DRAW THE TECHNICAL SHOP VECTOR DRAWING ON THE LEFT CANVAS
    const canvasX = padding + 10;
    const canvasY = padding + 15;
    const canvasW = blockX - canvasX - 10;
    const canvasH = pdfH - padding * 2 - 25;

    // Architectural tick marks
    const pdfTick = (x: number, y: number) => {
      doc.setDrawColor(15, 22, 42);
      doc.setLineWidth(0.3);
      doc.line(x - 1.2, y + 1.2, x + 1.2, y - 1.2);
    };

    if (subType === 'corner_shower_enclosure') {
      // 3D Isometric PDF drawing
      const baseCx = canvasX + canvasW / 2;
      const baseCy = canvasY + canvasH - 25;
      const shH = canvasH - 45; // height

      const leftCornerX = baseCx - 45;
      const leftCornerY = baseCy - 22;
      
      const rightCornerX = baseCx + 45;
      const rightCornerY = baseCy - 22;

      // Fill glass screens (split quads into two triangles for native jsPDF support)
      doc.setFillColor(226, 241, 237);
      doc.triangle(leftCornerX, leftCornerY, baseCx, baseCy, baseCx, baseCy - shH, 'F');
      doc.triangle(leftCornerX, leftCornerY, baseCx, baseCy - shH, leftCornerX, leftCornerY - shH, 'F');
      
      doc.triangle(baseCx, baseCy, rightCornerX, rightCornerY, rightCornerX, rightCornerY - shH, 'F');
      doc.triangle(baseCx, baseCy, rightCornerX, rightCornerY - shH, baseCx, baseCy - shH, 'F');

      // Outlines
      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.4);
      doc.triangle(leftCornerX, leftCornerY, baseCx, baseCy, baseCx, baseCy - shH, 'D');
      doc.triangle(leftCornerX, leftCornerY, baseCx, baseCy - shH, leftCornerX, leftCornerY - shH, 'D');
      
      doc.triangle(baseCx, baseCy, rightCornerX, rightCornerY, rightCornerX, rightCornerY - shH, 'D');
      doc.triangle(baseCx, baseCy, rightCornerX, rightCornerY - shH, baseCx, baseCy - shH, 'D');

      // Center post & support braces
      doc.setDrawColor(120, 144, 156);
      doc.setLineWidth(0.8);
      doc.line(baseCx, baseCy, baseCx, baseCy - shH);
      doc.line(leftCornerX, leftCornerY - shH, baseCx, baseCy - shH);
      doc.line(rightCornerX, rightCornerY - shH, baseCx, baseCy - shH);

      // Height Dimension Line
      doc.line(rightCornerX + 6, rightCornerY, rightCornerX + 6, rightCornerY - shH);
      pdfTick(rightCornerX + 6, rightCornerY);
      pdfTick(rightCornerX + 6, rightCornerY - shH);
      doc.setTextColor(0);
      doc.setFontSize(6.5);
      doc.text(`${Math.round(height)}`, rightCornerX + 8, rightCornerY - shH / 2 + 2);

      // Width Dimension Line
      doc.line(leftCornerX - 8, leftCornerY - 4, baseCx - 8, baseCy - 4);
      pdfTick(leftCornerX - 8, leftCornerY - 4);
      pdfTick(baseCx - 8, baseCy - 4);
      doc.text(`${Math.round(width)} mm`, baseCx - 30, baseCy - 12);
    } else {
      // 2D Shop Drawing layout
      const pScaleX = canvasW / width;
      const pScaleY = canvasH / height;
      const pScale = Math.min(pScaleX, pScaleY);

      const pdfDrawW = width * pScale;
      const pdfDrawH = height * pScale;

      const startDrawX = canvasX + (canvasW - pdfDrawW) / 2;
      const startDrawY = canvasY + (canvasH - pdfDrawH) / 2;

      // Fill glass
      if (category === 'showers') {
        doc.setFillColor(226, 241, 237); // Mint
      } else {
        doc.setFillColor(224, 247, 250); // Cyan
      }
      doc.rect(startDrawX, startDrawY, pdfDrawW, pdfDrawH, 'F');

      // Frame border
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(category === 'showers' ? 0.4 : 1.6);
      doc.rect(startDrawX, startDrawY, pdfDrawW, pdfDrawH, 'D');

      // Splits lists
      const vertSplits: number[] = [0];
      const horizSplits: number[] = [0];

      if (subType === 'sliding_window' || subType === 'double_casement_window' || subType === 'sliding_patio_door' || subType === 'double_french_door' || subType === 'sliding_shower_enclosure') {
        vertSplits.push(width / 2, width);
      } else if (subType === 'door_sidelite') {
        vertSplits.push(850, width);
      } else if (subType === 'bifold_door') {
        vertSplits.push(width / 3, (width * 2) / 3, width);
      } else if (subType === 'fixed_casement') {
        const leftW = Math.max(100, width - 595);
        vertSplits.push(leftW, width);
        horizSplits.push(700, height - 700, height);
      } else if (subType === 'multi_lite') {
        const col1W = 830;
        const col2W = (width - col1W) / 2;
        vertSplits.push(col1W, col1W + col2W, width);
        horizSplits.push(700, height - 700, height);
      } else if (subType === 'inline_shower_door') {
        const fixedPanelW = Math.min(width * 0.35, 400);
        vertSplits.push(fixedPanelW, width);
      } else {
        vertSplits.push(width);
      }

      const uniqueVertSplits = Array.from(new Set(vertSplits)).sort((a, b) => a - b);
      const uniqueHorizSplits = Array.from(new Set(horizSplits)).sort((a, b) => a - b);

      // Draw vertical mullions
      for (let i = 1; i < uniqueVertSplits.length - 1; i++) {
        const mx = startDrawX + uniqueVertSplits[i] * pScale;
        doc.setLineWidth(category === 'showers' ? 0.3 : 1.0);
        doc.line(mx, startDrawY, mx, startDrawY + pdfDrawH);
      }

      // Draw horizontal transoms
      for (let i = 1; i < uniqueHorizSplits.length - 1; i++) {
        const sy = startDrawY + uniqueHorizSplits[i] * pScale;
        const xStart = subType === 'fixed_casement' ? startDrawX + uniqueVertSplits[1] * pScale : startDrawX;
        doc.setLineWidth(category === 'showers' ? 0.3 : 1.0);
        doc.line(xStart, sy, startDrawX + pdfDrawW, sy);
      }

      // Operational indicators
      uniqueVertSplits.slice(0, -1).forEach((val, idx) => {
        const paneWMm = uniqueVertSplits[idx + 1] - val;
        const pW = paneWMm * pScale;
        const pH = pdfDrawH;
        const px = startDrawX + val * pScale;
        const py = startDrawY;

        // Awning split middle pane
        if (uniqueHorizSplits.length > 2 && (subType === 'fixed_casement' || subType === 'multi_lite') && idx > 0) {
          const awningHeightMm = uniqueHorizSplits[2] - uniqueHorizSplits[1];
          const aH = awningHeightMm * pScale;
          const ay = startDrawY + uniqueHorizSplits[1] * pScale;
          
          doc.setLineDashPattern([1.5, 1.5], 0);
          doc.line(px + 1, ay + aH - 1, px + pW / 2, ay + 1);
          doc.line(px + pW - 1, ay + aH - 1, px + pW / 2, ay + 1);
          doc.setLineDashPattern([], 0);
        } else if (subType === 'casement_window') {
          doc.setLineDashPattern([1.5, 1.5], 0);
          doc.line(px + pW - 1, py + 1, px + 1, py + pH / 2);
          doc.line(px + pW - 1, py + pH - 1, px + 1, py + pH / 2);
          doc.setLineDashPattern([], 0);
        } else if (subType === 'single_hinged_door' || (subType === 'double_french_door') || (subType === 'door_sidelite' && idx === 0) || (subType === 'inline_shower_door' && idx === 1)) {
          const hingeLeft = idx === 0;
          doc.setLineDashPattern([1.5, 1.5], 0);
          if (hingeLeft) {
            doc.line(px + pW - 1, py + 1, px + 1, py + pH / 2);
            doc.line(px + pW - 1, py + pH - 1, px + 1, py + pH / 2);
          } else {
            doc.line(px + 1, py + 1, px + pW - 1, py + pH / 2);
            doc.line(px + 1, py + pH - 1, px + pW - 1, py + pH / 2);
          }
          doc.setLineDashPattern([], 0);
        } else if (subType === 'sliding_window' || subType === 'sliding_patio_door' || subType === 'sliding_shower_enclosure') {
          // Draw sliding arrows on PDF
          doc.setDrawColor(249, 115, 22);
          doc.setLineWidth(0.4);
          const arrowDir = idx === 0 ? 'right' : 'left';
          const ax = px + pW / 2;
          const ay = py + pH / 2;
          doc.line(ax - 5, ay, ax + 5, ay);
          if (arrowDir === 'left') {
            doc.line(ax - 5, ay, ax - 3, ay - 1.5);
            doc.line(ax - 5, ay, ax - 3, ay + 1.5);
          } else {
            doc.line(ax + 5, ay, ax + 3, ay - 1.5);
            doc.line(ax + 5, ay, ax + 3, ay + 1.5);
          }
        }
      });

      // Dimensioning labels
      doc.setTextColor(15, 22, 42);
      doc.setFontSize(7.5);
      doc.setFont('Helvetica', 'bold');
      
      const widthDimY = startDrawY - 8;
      doc.line(startDrawX, widthDimY, startDrawX + pdfDrawW, widthDimY);
      pdfTick(startDrawX, widthDimY);
      pdfTick(startDrawX + pdfDrawW, widthDimY);
      doc.text(`${Math.round(width)}`, startDrawX + pdfDrawW / 2, widthDimY - 1.5, { align: 'center' });

      const heightDimX = startDrawX - 8;
      doc.line(heightDimX, startDrawY, heightDimX, startDrawY + pdfDrawH);
      pdfTick(heightDimX, startDrawY);
      pdfTick(heightDimX, startDrawY + pdfDrawH);
      doc.text(`${Math.round(height)}`, heightDimX - 2, startDrawY + pdfDrawH / 2 + 2, { align: 'right' });
    }

    // E. ADD TERMS & CONDITIONS PAGE
    doc.addPage('a4', 'portrait');
    doc.setFillColor(15, 22, 42);
    doc.rect(0, 0, 210, 25, 'F');

    doc.setTextColor(56, 189, 248);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Terms & Conditions for Glazing Shop Drawings', 15, 16);

    doc.setTextColor(30, 41, 59);
    doc.setFont('Helvetica', 'normal');

    let y = 35;
    const margin = 15;
    const splitWidth = 180;

    const paragraphs = [
      { text: "1. All dimensions and drawing specifications on the preceding sheet must be thoroughly cross-checked by the site installation supervisor before glazing panels are scheduled for tempering.", isBold: true },
      { text: "2. The dimensional tolerance of tempered glass panels is +0.0mm / -2.0mm. Any corrections to the drawing must be formally accepted in writing.", isBold: false },
      { text: "3. Clear directional indicators represent movement sliding tracks. Hinge swing dotted lines represent casement awning configuration opening points.", isBold: false },
      { text: "4. Tempered safety glass panels once manufactured cannot be cut, drilled, or altered in size. Any modifications requested after client signature will result in full billing for re-manufacture.", isBold: true },
      { text: "5. Hardware positions, window handle installations, and gasket specifications conform strictly to the standard architectural designs depicted above.", isBold: false },
    ];

    paragraphs.forEach((p) => {
      doc.setFontSize(9);
      doc.setFont('Helvetica', p.isBold ? 'bold' : 'normal');
      const splitText = doc.splitTextToSize(p.text, splitWidth);
      doc.text(splitText, margin, y);
      y += (splitText.length * 5) + 6;
    });

    doc.save(`ShopDrawing_${invoice?.invoice_no || 'Ref'}_${subType}.pdf`);
  };

  // 6. Locked screen view if invoice is unpaid
  if (!isPaid) {
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
            maxWidth: '550px',
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
              marginBottom: '20px',
            }}
          >
            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 style={{ marginBottom: '12px', fontSize: '1.5rem' }}>Invoice Access Locked</h2>
          <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.925rem' }}>
            Technical manufacturing drawings are only accessible after full invoice payment.
            Invoice <strong>{invoice?.invoice_no}</strong> is currently pending clearance.
          </p>

          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              textAlign: 'left',
              marginBottom: '24px',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="text-muted">Total Invoice Cost:</span>
              <span style={{ fontWeight: 600 }}>{invoice?.total_amount.toFixed(2)} GHS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="text-muted">Installments Paid:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>{invoice?.amount_paid.toFixed(2)} GHS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
              <span className="text-muted">Outstanding Balance:</span>
              <span style={{ color: 'var(--error)', fontWeight: 600 }}>{invoice?.balance_due.toFixed(2)} GHS</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </button>
            <button
              className="btn btn-primary"
              disabled={paymentSimulating}
              onClick={handleSimulatePayment}
            >
              {paymentSimulating ? 'Processing...' : 'Simulate Payment (Unlock)'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 7. Render drawings workspace
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#070b19', padding: '24px 0' }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header Ribbon */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '20px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '1.8rem' }} className="text-gradient">
                Technical Shop Drawings Portal
              </h1>
              <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                Payment Verified
              </span>
            </div>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              {invoice
                ? `Invoice No: ${invoice.invoice_no} | Client: ${invoice.customer.name}`
                : `Reference Template Playground: ${mockId?.toUpperCase() || 'CUSTOM'}`}
            </p>
          </div>
          <div>
            <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Workspace layout grid */}
        <div className="workspace-grid" style={{ display: 'grid', gap: '24px' }}>
          
          {/* A. Left Sidebar Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Paid items dropdown */}
            {invoice && invoice.line_items && invoice.line_items.length > 0 && (
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  Select Invoice Item
                </h3>
                <div className="form-group" style={{ marginBottom: '4px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Paid Spec</label>
                  <select
                    className="form-select"
                    value={selectedItemIndex}
                    onChange={(e) => setSelectedItemIndex(parseInt(e.target.value))}
                    style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                  >
                    {invoice.line_items.map((item, idx) => (
                      <option key={item.id} value={idx}>
                        Item {idx + 1}: {item.glass_type.name} ({Math.round(item.width * 1000)} x {Math.round(item.length * 1000)} mm)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Drawing cascading selector component */}
            <DrawingSelector
              category={category}
              subType={subType}
              width={width}
              height={height}
              theme={theme}
              catalog={catalog}
              disabledDimensions={!!invoice}
              onChangeCategory={setCategory}
              onChangeSubType={setSubType}
              onChangeWidth={setWidth}
              onChangeHeight={setHeight}
              onChangeTheme={setTheme}
            />

            {/* Bill of Materials card */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                Estimated Bill of Materials
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Glass Area:</span>
                  <span style={{ fontWeight: 600 }}>{glassAreaSqm.toFixed(2)} m²</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Total Weight:</span>
                  <span style={{ fontWeight: 600 }}>{glassWeightKg.toFixed(1)} kg</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Frame Profiles:</span>
                  <span style={{ fontWeight: 600 }}>{aluminumProfileMeters.toFixed(1)} m</span>
                </div>
              </div>
            </div>

          </div>

          {/* B. Main Canvas Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Export options bar */}
            <div
              className="card"
              style={{
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                  Workspace: Active Editing
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '4px' }}
                  onClick={handleDownloadSVG}
                >
                  Download SVG
                </button>
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '4px' }}
                  onClick={handleExportPDF}
                >
                  Export PDF Document
                </button>
              </div>
            </div>

            {/* Render canvas drawing */}
            <div style={{ width: '100%' }}>
              <GlazingDrawingCanvas
                category={category}
                subType={subType}
                width={width}
                height={height}
                theme={theme}
              />
            </div>

          </div>

        </div>

      </div>
      
      {/* Global CSS overrides */}
      <style jsx global>{`
        .workspace-grid {
          display: grid;
          grid-template-columns: 1fr;
        }
        @media (min-width: 992px) {
          .workspace-grid {
            grid-template-columns: 290px 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
