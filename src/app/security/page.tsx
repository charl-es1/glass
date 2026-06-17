'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import styles from './security.module.css';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface LineItem {
  id: string;
  glass_type: { name: string };
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  area: number;
}

interface Invoice {
  id: string;
  invoice_no: string;
  customer: Customer;
  driver_name: string | null;
  vehicle_no: string | null;
  created_at: string;
  line_items: LineItem[];
  status: string;
}

interface PastVerification {
  id: string;
  clearance_ref: string;
  verified_at: string;
  signatory_name: string;
  signature_data: string;
  status: string;
  is_offline: boolean;
  notes?: string | null;
  invoice: {
    invoice_no: string;
    customer: Customer;
    driver_name: string | null;
    vehicle_no: string | null;
  };
  items: Array<{
    glass_type_name: string;
    dimensions: string;
    quantity: number;
    is_verified: boolean;
    is_flagged: boolean;
    flag_notes?: string | null;
  }>;
}

export default function SecurityCheckpoint() {
  const router = useRouter();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [officerName, setOfficerName] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // App Layout State
  const [activeView, setActiveView] = useState<'pending' | 'history'>('pending');
  const [readyBills, setReadyBills] = useState<Invoice[]>([]);
  const [pastVerifications, setPastVerifications] = useState<PastVerification[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Online / Offline Status
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Inactivity Auto-Lock Timer (2 minutes)
  const lastActivityRef = useRef<number>(Date.now());

  // Security mode lock toggle
  const [isSecurityModeLocked, setIsSecurityModeLocked] = useState(true);

  // Verification Checklist State
  const [checkedItems, setCheckedItems] = useState<Record<string, { is_verified: boolean; is_flagged: boolean; flag_notes: string }>>({});
  const [signatoryName, setSignatoryName] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');

  // Flag Discrepancy Modal/Dialog state
  const [flagDialogItem, setFlagDialogItem] = useState<{ id: string; name: string } | null>(null);
  const [flagNotesInput, setFlagNotesInput] = useState('');

  // HTML5 Signature Canvas Pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Initialize and check online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync queue initially
    updatePendingSyncCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor Activity for Auto-Lock
  useEffect(() => {
    if (!isAuthenticated) return;

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'touchstart', 'scroll'];
    events.forEach((event) => window.addEventListener(event, recordActivity));

    const checkInterval = setInterval(() => {
      const inactiveMs = Date.now() - lastActivityRef.current;
      if (inactiveMs >= 120000) { // 2 minutes
        // Auto-lock: clear auth and return to pin screen
        handleLock();
      }
    }, 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      clearInterval(checkInterval);
    };
  }, [isAuthenticated]);

  // Periodic offline sync poll (every 15s)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (navigator.onLine && isAuthenticated) {
        syncOfflineQueue();
      }
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [isAuthenticated]);

  // Load dashboard data if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchBills();
      fetchPastVerifications();
    }
  }, [isAuthenticated]);

  // Check auth session on load
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user.role === 'security') {
            setOfficerName(data.user.name);
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        console.error('Failed checking gate session:', err);
      }
    }
    checkSession();
  }, []);

  // Update Pending Sync Count from localStorage
  const updatePendingSyncCount = () => {
    const queue = JSON.parse(localStorage.getItem('security_pending_sync') || '[]');
    setPendingSyncCount(queue.length);
  };

  // Fetch Bills from API (or local Cache if offline)
  const fetchBills = async () => {
    setLoading(true);
    setError('');
    try {
      if (navigator.onLine) {
        const res = await fetch('/api/security/bills');
        if (!res.ok) throw new Error('Failed to retrieve dispatch bills');
        const data = await res.json();
        setReadyBills(data);
        localStorage.setItem('security_cached_bills', JSON.stringify(data));
      } else {
        // Load from Cache
        const cached = localStorage.getItem('security_cached_bills');
        if (cached) {
          setReadyBills(JSON.parse(cached));
        } else {
          setReadyBills([]);
        }
      }
    } catch (err: any) {
      console.error(err);
      // Fallback to cache on error
      const cached = localStorage.getItem('security_cached_bills');
      if (cached) {
        setReadyBills(JSON.parse(cached));
      } else {
        setError(err.message || 'Failed to load bills.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch Past Verifications (officer history)
  const fetchPastVerifications = async () => {
    try {
      if (navigator.onLine) {
        const res = await fetch('/api/security/verify');
        if (res.ok) {
          const data = await res.json();
          setPastVerifications(data);
          localStorage.setItem('security_cached_verifications', JSON.stringify(data));
        }
      } else {
        const cached = localStorage.getItem('security_cached_verifications');
        if (cached) {
          setPastVerifications(JSON.parse(cached));
        }
      }
    } catch (err) {
      console.error('Error loading verification history:', err);
      const cached = localStorage.getItem('security_cached_verifications');
      if (cached) {
        setPastVerifications(JSON.parse(cached));
      }
    }
  };

  // PIN pad digit helper
  const handlePinDigit = (digit: string) => {
    setLoginError('');
    if (pinInput.length < 8) {
      setPinInput((prev) => prev + digit);
    }
  };

  const handlePinClear = () => {
    setPinInput('');
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput) return;

    setLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/security/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setOfficerName(data.user.name);
      setIsAuthenticated(true);
      setPinInput('');
      lastActivityRef.current = Date.now();
    } catch (err: any) {
      setLoginError(err.message || 'Invalid PIN code.');
      setPinInput('');
    } finally {
      setLoading(false);
    }
  };

  // Lock interface (Inactivity or manual lockout)
  const handleLock = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Failed logout request during lock:', err);
    }
    setIsAuthenticated(false);
    setPinInput('');
    setSelectedInvoice(null);
    setCheckedItems({});
    setSignatoryName('');
    setGeneralNotes('');
  };

  // Canvas Drawing logic for fingerprint signature capture
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI Canvas Scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.strokeStyle = '#38bdf8'; // neon light blue
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [selectedInvoice]);

  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const getCanvasTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const startDrawing = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (x: number, y: number) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Toggle check/verification item status
  const handleToggleItemCheck = (lineItemId: string, isCheck: boolean) => {
    setCheckedItems((prev) => {
      const current = prev[lineItemId] || { is_verified: false, is_flagged: false, flag_notes: '' };
      return {
        ...prev,
        [lineItemId]: {
          ...current,
          is_verified: isCheck,
          is_flagged: isCheck ? false : current.is_flagged, // clear flag if checked verified
        },
      };
    });
  };

  // Discrepancy Notes dialog helpers
  const handleOpenFlagDialog = (lineItemId: string, name: string) => {
    const current = checkedItems[lineItemId] || { is_verified: false, is_flagged: false, flag_notes: '' };
    setFlagNotesInput(current.flag_notes);
    setFlagDialogItem({ id: lineItemId, name });
  };

  const handleSaveFlagNotes = () => {
    if (!flagDialogItem) return;

    setCheckedItems((prev) => {
      const current = prev[flagDialogItem.id] || { is_verified: false, is_flagged: false, flag_notes: '' };
      return {
        ...prev,
        [flagDialogItem.id]: {
          ...current,
          is_verified: false, // cannot be verified if flagged
          is_flagged: true,
          flag_notes: flagNotesInput,
        },
      };
    });

    setFlagDialogItem(null);
    setFlagNotesInput('');
  };

  const handleClearFlag = (lineItemId: string) => {
    setCheckedItems((prev) => {
      const current = prev[lineItemId] || { is_verified: false, is_flagged: false, flag_notes: '' };
      return {
        ...prev,
        [lineItemId]: {
          ...current,
          is_flagged: false,
          flag_notes: '',
        },
      };
    });
  };

  // Calculations for checkpoint metrics
  const getVerificationProgress = () => {
    if (!selectedInvoice) return 0;
    const items = selectedInvoice.line_items;
    if (items.length === 0) return 0;

    let processed = 0;
    items.forEach((item) => {
      const state = checkedItems[item.id];
      if (state && (state.is_verified || state.is_flagged)) {
        processed++;
      }
    });

    return Math.round((processed / items.length) * 100);
  };

  // Check if form is fully ready to be verified/submitted
  const isSubmissionValid = () => {
    if (!selectedInvoice || !signatoryName) return false;
    const progress = getVerificationProgress();
    if (progress < 100) return false;

    // Check signature exists on canvas
    const canvas = canvasRef.current;
    if (!canvas) return false;

    // Direct check of blank canvas
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      return false; // Signature pad empty
    }

    return true;
  };

  // Submit exit checkpoint gate verification
  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedInvoice || !isSubmissionValid()) {
      setError('Please fill in all details, complete checklists, and sign the form.');
      return;
    }

    setLoading(true);

    const canvas = canvasRef.current;
    const signature_data = canvas ? canvas.toDataURL() : '';

    // Determine verification status
    // If any item is flagged, status is discrepancy hold
    const hasFlags = selectedInvoice.line_items.some((item) => {
      const state = checkedItems[item.id];
      return state && state.is_flagged;
    });

    const status = hasFlags ? 'on_hold_discrepancy' : 'dispatched';

    // Format checklist items for submission
    const items = selectedInvoice.line_items.map((item) => {
      const state = checkedItems[item.id] || { is_verified: false, is_flagged: false, flag_notes: '' };
      return {
        line_item_id: item.id,
        glass_type_name: item.glass_type.name,
        dimensions: `${item.length.toFixed(2)}m x ${item.width.toFixed(2)}m x ${item.thickness.toFixed(1)}mm`,
        quantity: item.quantity,
        is_verified: state.is_verified,
        is_flagged: state.is_flagged,
        flag_notes: state.flag_notes || null,
      };
    });

    // Device Audit logs
    const logs = [
      {
        action: 'VERIFY_START',
        details: `Verification initialized for ${selectedInvoice.invoice_no}`,
        timestamp: new Date().toISOString(),
        is_offline: !navigator.onLine,
      },
      ...selectedInvoice.line_items.map((item) => {
        const state = checkedItems[item.id] || { is_verified: false, is_flagged: false, flag_notes: '' };
        return {
          action: state.is_flagged ? 'FLAG_ITEM' : 'TICK_ITEM',
          details: state.is_flagged 
            ? `Flagged ${item.glass_type.name}: ${state.flag_notes}` 
            : `Verified ${item.glass_type.name} - ${item.length}m x ${item.width}m`,
          timestamp: new Date().toISOString(),
          is_offline: !navigator.onLine,
        };
      }),
      {
        action: 'SIGN',
        details: `Digital signature captured for signatory ${signatoryName}`,
        timestamp: new Date().toISOString(),
        is_offline: !navigator.onLine,
      },
      {
        action: 'SUBMIT',
        details: `Clearance pass requested. Final Status: ${status}`,
        timestamp: new Date().toISOString(),
        is_offline: !navigator.onLine,
      }
    ];

    const payload = {
      invoice_id: selectedInvoice.id,
      signatory_name: signatoryName,
      signature_data,
      status,
      notes: generalNotes || null,
      verified_at: new Date().toISOString(),
      is_offline: !navigator.onLine,
      items,
      logs,
    };

    try {
      if (navigator.onLine) {
        // Send directly online
        const res = await fetch('/api/security/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to submit gate pass');
        }

        setSuccess(`Dispatch cleared successfully! Clearance: ${data.clearance_ref}`);
        
        // Auto-download PDF containing synced Clearance Pass Ref
        generateClearancePDF(selectedInvoice, {
          clearance_ref: data.clearance_ref,
          verified_at: payload.verified_at,
          officer_name: officerName,
          signatory_name: signatoryName,
          signature_data,
          status,
          items,
        });

        // Reset verification board
        setSelectedInvoice(null);
        setCheckedItems({});
        setSignatoryName('');
        setGeneralNotes('');

        // Refresh lists
        await fetchBills();
        await fetchPastVerifications();
      } else {
        // Offline capability: Save to localStorage queue
        const queue = JSON.parse(localStorage.getItem('security_pending_sync') || '[]');
        queue.push(payload);
        localStorage.setItem('security_pending_sync', JSON.stringify(queue));
        updatePendingSyncCount();

        // Remove the invoice from local list so it doesn't get scanned twice
        setReadyBills((prev) => prev.filter((b) => b.id !== selectedInvoice.id));
        const currentCachedBills = JSON.parse(localStorage.getItem('security_cached_bills') || '[]');
        localStorage.setItem(
          'security_cached_bills', 
          JSON.stringify(currentCachedBills.filter((b: any) => b.id !== selectedInvoice.id))
        );

        setSuccess('Offline Mode: Exit clearance logged locally and queued for background sync!');

        // Generate Clearance Pass PDF with temporary OFFLINE ref
        const tempRef = `CLR-OFFLINE-${selectedInvoice.invoice_no}`;
        generateClearancePDF(selectedInvoice, {
          clearance_ref: tempRef,
          verified_at: payload.verified_at,
          officer_name: officerName,
          signatory_name: signatoryName,
          signature_data,
          status,
          items,
        });

        // Save verification to history locally as offline pending
        const localHistoryItem: PastVerification = {
          id: selectedInvoice.id,
          clearance_ref: tempRef,
          verified_at: payload.verified_at,
          signatory_name: signatoryName,
          signature_data,
          status,
          is_offline: true,
          notes: generalNotes || null,
          invoice: {
            invoice_no: selectedInvoice.invoice_no,
            customer: selectedInvoice.customer,
            driver_name: selectedInvoice.driver_name,
            vehicle_no: selectedInvoice.vehicle_no,
          },
          items,
        };

        setPastVerifications((prev) => [localHistoryItem, ...prev]);

        // Reset verification board
        setSelectedInvoice(null);
        setCheckedItems({});
        setSignatoryName('');
        setGeneralNotes('');
      }
    } catch (err: any) {
      setError(err.message || 'Error executing gate submission.');
    } finally {
      setLoading(false);
    }
  };

  // Sync offline queue submissions with backend
  const syncOfflineQueue = async () => {
    if (!navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem('security_pending_sync') || '[]');
    if (queue.length === 0) return;

    let successCount = 0;
    const remainingQueue = [];

    for (const payload of queue) {
      try {
        const res = await fetch('/api/security/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json();
          // If already verified, count as success to discard
          if (data.error && data.error.includes('already been verified')) {
            successCount++;
          } else {
            remainingQueue.push(payload);
          }
        }
      } catch (err) {
        remainingQueue.push(payload);
      }
    }

    localStorage.setItem('security_pending_sync', JSON.stringify(remainingQueue));
    updatePendingSyncCount();

    if (successCount > 0) {
      setSuccess(`Background Sync: Successfully synchronized ${successCount} offline clearances!`);
      await fetchBills();
      await fetchPastVerifications();
    }
  };

  // Client-Side PDF Generation containing Officer details & Signatures
  const generateClearancePDF = (invoice: Invoice, verification: any) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Banner Header
      doc.setFillColor(15, 22, 42); // deep navy
      doc.rect(0, 0, 210, 38, 'F');

      // Title branding
      doc.setTextColor(56, 189, 248); // primary light blue
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('GlassCut Exit Gate', 15, 18);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.text('GATE DISPATCH CLEARANCE CERTIFICATE', 15, 26);
      doc.text('Security Gate', 170, 18);

      // Metadata Block Left
      doc.setTextColor(30, 41, 59);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('VERIFICATION DETAILS:', 15, 50);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`Clearance Ref: ${verification.clearance_ref || 'PENDING SYNC'}`, 15, 58);
      doc.text(`Gate Pass Date: ${new Date(verification.verified_at).toLocaleString()}`, 15, 64);
      doc.text(`Officer In Charge: ${verification.officer_name}`, 15, 70);

      // Metadata Block Right
      doc.setFont('Helvetica', 'bold');
      doc.text('VEHICLE & DRIVER INFO:', 120, 50);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Driver Name: ${invoice.driver_name || 'N/A'}`, 120, 58);
      doc.text(`Vehicle Reg No: ${invoice.vehicle_no || 'N/A'}`, 120, 64);
      doc.text(`Invoice Reference: ${invoice.invoice_no}`, 120, 70);

      // Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 76, 195, 76);

      // Table Header Row
      doc.setFillColor(248, 250, 252);
      doc.rect(15, 82, 180, 10, 'F');
      
      doc.setTextColor(30, 41, 59);
      doc.setFont('Helvetica', 'bold');
      doc.text('Checked Line Item Spec / Dimensions', 18, 88.5);
      doc.text('Qty', 130, 88.5);
      doc.text('Status', 160, 88.5);

      // Details Rows
      doc.setFont('Helvetica', 'normal');
      let currentY = 100;

      verification.items.forEach((item: any) => {
        const spec = `${item.glass_type_name} (${item.dimensions || ''})`;
        doc.text(spec.length > 50 ? spec.slice(0, 47) + '...' : spec, 18, currentY);
        doc.text(item.quantity.toString(), 130, currentY);
        
        if (item.is_flagged) {
          doc.setTextColor(185, 28, 28); // red text
          doc.text('FLAGGED / DISCREPANT', 160, currentY);
          doc.setTextColor(30, 41, 59);
          if (item.flag_notes) {
            currentY += 5;
            doc.setFont('Helvetica', 'oblique');
            doc.setFontSize(8.5);
            doc.text(`Notes: ${item.flag_notes}`, 22, currentY);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9.5);
          }
        } else {
          doc.setTextColor(6, 95, 70); // green text
          doc.text('VERIFIED & CLEAN', 160, currentY);
          doc.setTextColor(30, 41, 59);
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(15, currentY + 3, 195, currentY + 3);
        currentY += 9;
      });

      // Overall Status box
      currentY += 5;
      let bg = [240, 253, 250];
      let border = [16, 185, 129];
      let text = [6, 95, 70];
      let statusStr = 'DISPATCHED - CLEAN';

      if (verification.status === 'on_hold_discrepancy') {
        bg = [254, 242, 242];
        border = [252, 165, 165];
        text = [185, 28, 28];
        statusStr = 'ON HOLD - DISCREPANCY DETECTED';
      }

      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(15, currentY, 180, 16, 'F');
      doc.setDrawColor(border[0], border[1], border[2]);
      doc.rect(15, currentY, 180, 16, 'D');

      doc.setTextColor(text[0], text[1], text[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Gate Verification Status: ${statusStr}`, 22, currentY + 10);

      // Signatures
      currentY += 25;
      doc.setTextColor(30, 41, 59);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`SIGNATORY RECEIVER NAME: ${verification.signatory_name.toUpperCase()}`, 15, currentY);
      
      if (verification.signature_data) {
        doc.addImage(verification.signature_data, 'PNG', 15, currentY + 5, 50, 25);
      }

      doc.text('DIGITAL SIGNATURE:', 15, currentY + 4);
      doc.line(15, currentY + 32, 65, currentY + 32);

      // Footer
      doc.setTextColor(148, 163, 184);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('This document certifies that gate exit screening was completed as per business protocol.', 15, 280);

      // Trigger download
      const filename = `GateClearance_${invoice.invoice_no}_${verification.clearance_ref || 'PENDING'}.pdf`;
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error('PDF clearance certificate generation error:', err);
    }
  };

  // Render Login state if not authenticated
  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className="card-glass" style={{ width: '100%', maxWidth: '440px', padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ marginBottom: '16px' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h1 className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>
              Security Exit Gate
            </h1>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Enter PIN code to unlock gate controller terminal</p>
          </div>

          <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* PIN Display Visualizer */}
            <div className={styles.pinDisplay}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div 
                  key={idx} 
                  className={`${styles.pinDot} ${pinInput.length > idx ? styles.pinDotActive : ''}`} 
                />
              ))}
            </div>

            {loginError && (
              <div className="alert alert-error" style={{ padding: '8px 12px', fontSize: '0.8rem', marginBottom: 0 }}>
                <span>{loginError}</span>
              </div>
            )}

            {/* Large Numeric Keypad optimized for tablet tap */}
            <div className={styles.keypadGrid}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className={styles.keypadBtn}
                  onClick={() => handlePinDigit(digit)}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.keypadBtn} ${styles.keypadBtnDanger}`}
                onClick={handlePinClear}
              >
                Clear
              </button>
              <button
                type="button"
                className={styles.keypadBtn}
                onClick={() => handlePinDigit('0')}
              >
                0
              </button>
              <button
                type="submit"
                className={`${styles.keypadBtn} ${styles.keypadBtnSuccess}`}
                disabled={pinInput.length === 0 || loading}
              >
                Go
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gateDashboard}>
      {/* Tablet Header Bar */}
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="text-gradient" style={{ fontWeight: 700, fontSize: '1.35rem' }}>
            Exit Gate Checkpoint
          </span>
          <div className={styles.statusBadge}>
            <div className={`${styles.statusIndicator} ${isOnline ? styles.statusOnline : styles.statusOffline}`} />
            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
              {isOnline ? 'Online' : 'Offline Mode'}
            </span>
          </div>
          {pendingSyncCount > 0 && (
            <span className="badge badge-primary" style={{ textTransform: 'none', background: 'var(--accent-hover)' }}>
              {pendingSyncCount} clearance(s) pending sync
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontWeight: 600, display: 'block', fontSize: '0.9rem' }}>{officerName}</span>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>Security Officer</span>
          </div>

          {/* Dedicated Security Mode Toggle */}
          <button
            type="button"
            className={`btn ${isSecurityModeLocked ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
            onClick={() => setIsSecurityModeLocked(!isSecurityModeLocked)}
          >
            {isSecurityModeLocked ? '🔒 Tablet Locked' : '🔓 Unlock Tablet'}
          </button>

          {!isSecurityModeLocked && (
            <button 
              type="button"
              className="btn btn-secondary" 
              style={{ padding: '8px 12px', fontSize: '0.8rem' }}
              onClick={() => router.push('/dashboard')}
            >
              Staff Dashboard
            </button>
          )}

          <button
            type="button"
            className="btn btn-danger"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            onClick={handleLock}
          >
            Lock Out
          </button>
        </div>
      </header>

      {/* Main tablet grid split */}
      <main className={styles.mainGrid}>
        {/* Left column: Listing & tabs */}
        <section className={styles.leftColumn}>
          <div className={styles.tabNav}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeView === 'pending' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveView('pending')}
            >
              Dispatch Queue ({readyBills.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeView === 'history' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveView('history')}
            >
              Clearance History ({pastVerifications.length})
            </button>
          </div>

          <div className={styles.listContainer}>
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {activeView === 'pending' ? (
              readyBills.length === 0 ? (
                <div className={styles.emptyQueue}>
                  <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-muted">
                    <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-muted" style={{ marginTop: '12px', fontSize: '0.9rem' }}>
                    No vehicle dispatch loads currently ready.
                  </p>
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    style={{ marginTop: '16px', fontSize: '0.85rem' }} 
                    onClick={fetchBills}
                  >
                    Refresh Queue
                  </button>
                </div>
              ) : (
                <div className={styles.scrollList}>
                  {readyBills.map((inv) => (
                    <div
                      key={inv.id}
                      className={`${styles.listItem} ${selectedInvoice?.id === inv.id ? styles.listItemActive : ''}`}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setCheckedItems({});
                        setSignatoryName(inv.driver_name || '');
                        setGeneralNotes('');
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>
                          {inv.invoice_no}
                        </span>
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                          {new Date(inv.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                        Customer: <strong style={{ color: 'var(--text-main)' }}>{inv.customer.name}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                        <div>
                          Driver: <strong style={{ color: 'var(--text-main)' }}>{inv.driver_name || 'N/A'}</strong>
                        </div>
                        <div>
                          Vehicle: <strong style={{ color: 'var(--text-main)' }}>{inv.vehicle_no || 'N/A'}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Verification History listing
              pastVerifications.length === 0 ? (
                <div className={styles.emptyQueue}>
                  <p className="text-muted">No clearance records logged yet.</p>
                </div>
              ) : (
                <div className={styles.scrollList}>
                  {pastVerifications.map((item) => (
                    <div key={item.id} className={styles.historyCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                          {item.invoice.invoice_no} ({item.clearance_ref})
                        </span>
                        <span className={`badge ${item.status === 'dispatched' ? 'badge-success' : 'badge-danger'}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                        <div>Driver: {item.invoice.driver_name} | Reg: {item.invoice.vehicle_no}</div>
                        <div>Signatory: {item.signatory_name}</div>
                        <div className="text-muted">Cleared: {new Date(item.verified_at).toLocaleString()}</div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '6px', fontSize: '0.75rem' }}
                        onClick={() => generateClearancePDF(
                          {
                            id: item.id,
                            invoice_no: item.invoice.invoice_no,
                            customer: item.invoice.customer,
                            driver_name: item.invoice.driver_name,
                            vehicle_no: item.invoice.vehicle_no,
                            created_at: item.verified_at,
                            line_items: [],
                            status: item.status,
                          },
                          item
                        )}
                      >
                        Print Clearance Receipt
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </section>

        {/* Right column: Verification workbench */}
        <section className={styles.rightColumn}>
          {selectedInvoice ? (
            <div className={styles.workbench}>
              {/* Load Info Header */}
              <div className={styles.workbenchHeader}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>
                    Verifying Load: {selectedInvoice.invoice_no}
                  </h2>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Verify quantity & glass specs against items list.
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem' }}>
                    Driver: <strong>{selectedInvoice.driver_name || 'N/A'}</strong>
                  </div>
                  <div style={{ fontSize: '0.9rem' }}>
                    Reg Plate: <strong>{selectedInvoice.vehicle_no || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ margin: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                  <span className="text-muted">Items Checked Progress</span>
                  <span>{getVerificationProgress()}%</span>
                </div>
                <div className={styles.progressTrack}>
                  <div 
                    className={styles.progressBar} 
                    style={{ width: `${getVerificationProgress()}%` }} 
                  />
                </div>
              </div>

              {/* Line items checklist */}
              <div className={styles.checklistFrame}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Line Items Verification checklist
                </h3>

                <div className={styles.checklistScroll}>
                  {selectedInvoice.line_items.map((item) => {
                    const state = checkedItems[item.id] || { is_verified: false, is_flagged: false, flag_notes: '' };
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`${styles.checkRow} ${state.is_verified ? styles.checkRowVerified : state.is_flagged ? styles.checkRowFlagged : ''}`}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, display: 'block', fontSize: '0.95rem' }}>
                            {item.glass_type.name}
                          </span>
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {item.length.toFixed(2)}m × {item.width.toFixed(2)}m × {item.thickness.toFixed(1)}mm
                          </span>
                          <span style={{ marginLeft: '12px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)' }}>
                            Qty: {item.quantity}
                          </span>
                          {state.is_flagged && state.flag_notes && (
                            <div className={styles.flagReasonText}>
                              ⚠️ Discrepancy Note: {state.flag_notes}
                            </div>
                          )}
                        </div>

                        {/* Checklist Buttons (optimized for fat-finger taps) */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {state.is_flagged ? (
                            <button
                              type="button"
                              className={styles.clearFlagBtn}
                              onClick={() => handleClearFlag(item.id)}
                            >
                              Clear Flag
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`${styles.flagBtn} ${state.is_flagged ? styles.flagBtnActive : ''}`}
                              onClick={() => handleOpenFlagDialog(item.id, item.glass_type.name)}
                            >
                              ⚠️ Flag
                            </button>
                          )}

                          <button
                            type="button"
                            className={`${styles.verifyBtn} ${state.is_verified ? styles.verifyBtnActive : ''}`}
                            onClick={() => handleToggleItemCheck(item.id, !state.is_verified)}
                          >
                            {state.is_verified ? '✓ Verified' : 'Verify'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Signatory name & Signature Capture Canvas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                {/* Signatory meta */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="signatory" style={{ fontSize: '0.85rem' }}>
                      Receiver Name / Signatory
                    </label>
                    <input
                      type="text"
                      id="signatory"
                      className="form-input"
                      style={{ padding: '12px 14px', fontSize: '1rem' }}
                      placeholder="e.g. Samuel (Driver / Cust)"
                      value={signatoryName}
                      onChange={(e) => setSignatoryName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="generalNotes" style={{ fontSize: '0.85rem' }}>
                      Gate Dispatch Notes
                    </label>
                    <textarea
                      id="generalNotes"
                      className="form-input"
                      style={{ height: '70px', resize: 'none', padding: '10px 14px', fontSize: '0.9rem' }}
                      placeholder="Any gate exit remarks..."
                      value={generalNotes}
                      onChange={(e) => setGeneralNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Draw Canvas pad */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span className="form-label" style={{ marginBottom: 0, fontSize: '0.85rem' }}>
                      Signature (Draw with finger)
                    </span>
                    <button
                      type="button"
                      className="btn-link"
                      style={{ fontSize: '0.75rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={clearSignature}
                    >
                      Clear Pad
                    </button>
                  </div>

                  <div className={styles.canvasFrame}>
                    <canvas
                      ref={canvasRef}
                      className={styles.signatureCanvas}
                      onMouseDown={(e) => {
                        const pos = getCanvasMousePos(e);
                        startDrawing(pos.x, pos.y);
                      }}
                      onMouseMove={(e) => {
                        const pos = getCanvasMousePos(e);
                        draw(pos.x, pos.y);
                      }}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        const pos = getCanvasTouchPos(e);
                        startDrawing(pos.x, pos.y);
                      }}
                      onTouchMove={(e) => {
                        e.preventDefault();
                        const pos = getCanvasTouchPos(e);
                        draw(pos.x, pos.y);
                      }}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                </div>
              </div>

              {/* Submit / Record Gate pass buttons */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '14px', fontSize: '1rem' }}
                  onClick={() => setSelectedInvoice(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn ${
                    selectedInvoice.line_items.some((item) => checkedItems[item.id]?.is_flagged)
                      ? 'btn-danger'
                      : 'btn-primary'
                  }`}
                  style={{ flex: 2, padding: '14px', fontSize: '1rem', fontWeight: 600 }}
                  disabled={!isSubmissionValid() || loading}
                  onClick={handleSubmitVerification}
                >
                  {loading 
                    ? 'Processing...' 
                    : selectedInvoice.line_items.some((item) => checkedItems[item.id]?.is_flagged)
                      ? 'Submit Discrepancy Hold ⚠️'
                      : 'Verify & Clear Dispatch ✓'
                  }
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.workbenchEmpty}>
              <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24" className="text-muted" style={{ marginBottom: '16px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>Gate Load Inspector</h3>
              <p className="text-muted" style={{ fontSize: '0.9rem', maxWidth: '320px' }}>
                Select an invoice load from the dispatch queue on the left to begin checking materials.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Flag Discrepancy Modal Dialog */}
      {flagDialogItem && (
        <div className={styles.modalOverlay}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--error)' }}>
              Flag Discrepancy
            </h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
              Explain the issue identified on: <strong>{flagDialogItem.name}</strong>
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="flagNotes">Reason for discrepancy hold</label>
              <textarea
                id="flagNotes"
                className="form-input"
                style={{ height: '100px', resize: 'none', padding: '10px' }}
                placeholder="e.g. Dimensions mismatch, glass cracked, quantity missing..."
                value={flagNotesInput}
                onChange={(e) => setFlagNotesInput(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                disabled={!flagNotesInput.trim()}
                onClick={handleSaveFlagNotes}
              >
                Apply Flag
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  setFlagDialogItem(null);
                  setFlagNotesInput('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
