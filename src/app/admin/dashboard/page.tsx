'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import styles from './admin.module.css';
import GlazingConfigTabContent from './GlazingConfigTabContent';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  _count?: { quotes: number };
}

interface GlassType {
  id: string;
  name: string;
  price_per_sqm: number;
}

interface Quote {
  id: string;
  user_id: string;
  glass_type_id: string | null;
  length: number | null;
  width: number | null;
  thickness: number | null;
  area: number;
  total_price: number;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  glass_type: {
    id: string;
    name: string;
    price_per_sqm: number;
  } | null;
  items_json?: string | null;
}

interface DashboardMetrics {
  totalQuotes: number;
  totalRevenue: number;
  glassStats: Array<{ id: string; name: string; price_per_sqm: number; count: number; revenue: number }>;
  userStats: Array<{ id: string; name: string; email: string; role: string; status: string; count: number; revenue: number }>;
}

interface ActivityLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  details: string;
  created_at: string;
}

const downloadPDF = (doc: any, filename: string) => {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Delay revocation to prevent race conditions where the browser starts the download after the URL is revoked
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

export default function AdminDashboard() {
  const router = useRouter();



  // Navigation & Authentication state
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'glass' | 'users' | 'quotes' | 'logs' | 'reports' | 'security' | 'glazing-config'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Core Data Lists
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [glassTypes, setGlassTypes] = useState<GlassType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState<any[]>([]);
  const [glazingLoading, setGlazingLoading] = useState(false);

  // Security Exit Audits state
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [securityVerifications, setSecurityVerifications] = useState<any[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [filterSecurityInvoiceNo, setFilterSecurityInvoiceNo] = useState('');
  const [filterSecurityOfficer, setFilterSecurityOfficer] = useState('');
  const [filterSecurityStatus, setFilterSecurityStatus] = useState('');
  const [selectedVerification, setSelectedVerification] = useState<any | null>(null);

  // Financial reports state
  const [reportsData, setReportsData] = useState<any>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reportCustomerId, setReportCustomerId] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  // Modal / Form states - Glass Types CRUD
  const [glassFormOpen, setGlassFormOpen] = useState(false);
  const [editingGlass, setEditingGlass] = useState<GlassType | null>(null);
  const [glassName, setGlassName] = useState('');
  const [glassPrice, setGlassPrice] = useState('');
  const [glassFormError, setGlassFormError] = useState('');

  // Modal / Form states - Users CRUD
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [userStatus, setUserStatus] = useState('active');
  const [userFormError, setUserFormError] = useState('');

  // Quotes Filtering states
  const [filterUserId, setFilterUserId] = useState('');
  const [filterGlassId, setFilterGlassId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date | price | area
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/admin/logs', { cache: 'no-store' });
      if (res.ok) {
        setLogs(await res.json());
      } else {
        console.error('Failed to fetch logs:', res.statusText);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportCustomerId) params.append('customerId', reportCustomerId);
      if (reportStatus) params.append('status', reportStatus);
      if (reportStartDate) params.append('startDate', reportStartDate);
      if (reportEndDate) params.append('endDate', reportEndDate);

      const [reportsRes, customersRes] = await Promise.all([
        fetch(`/api/admin/reports?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/admin/customers', { cache: 'no-store' }),
      ]);

      if (reportsRes.ok) {
        setReportsData(await reportsRes.json());
      }
      if (customersRes.ok) {
        setCustomers(await customersRes.json());
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to fetch financial reports.');
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchSecurityData = async () => {
    setSecurityLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSecurityInvoiceNo) params.append('invoice_no', filterSecurityInvoiceNo);
      if (filterSecurityOfficer) params.append('officer_name', filterSecurityOfficer);
      if (filterSecurityStatus) params.append('status', filterSecurityStatus);

      const [logsRes, verificationsRes] = await Promise.all([
        fetch(`/api/security/logs?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/security/verify', { cache: 'no-store' }),
      ]);

      if (logsRes.ok) setSecurityLogs(await logsRes.json());
      if (verificationsRes.ok) setSecurityVerifications(await verificationsRes.json());
    } catch (err) {
      console.error('Failed to fetch security data:', err);
      setError('Failed to load security audit records.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleResolveHold = async (invoiceId: string) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispatched' }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resolve hold');
      }
      
      setSuccess('Discrepancy hold resolved successfully. Status updated to dispatched!');
      setSelectedVerification(null);
      await fetchSecurityData();
      await loadAllData();
    } catch (err: any) {
      setError(err.message || 'Error resolving hold');
    }
  };

  const loadAllData = async () => {
    try {
      const [metricsRes, gtRes, usersRes, quotesRes] = await Promise.all([
        fetch('/api/admin/metrics', { cache: 'no-store' }),
        fetch('/api/glass-types', { cache: 'no-store' }),
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/quotes', { cache: 'no-store' }),
      ]);

      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (gtRes.ok) setGlassTypes(await gtRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (quotesRes.ok) setQuotes(await quotesRes.json());
      
      if (activeTab === 'logs') {
        fetchLogs();
      }
      if (activeTab === 'security') {
        fetchSecurityData();
      }
      if (activeTab === 'glazing-config') {
        fetchGlazingCatalog();
      }
    } catch (err) {
      console.error('Error reloading admin lists:', err);
    }
  };

  // Load initial dashboard details
  useEffect(() => {
    async function initAdmin() {
      try {
        // 1. Verify admin identity
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!meRes.ok) {
          router.push('/login');
          return;
        }
        const meData = await meRes.json();
        if (meData.authenticated && (meData.user.role === 'admin' || meData.user.role === 'supervisor')) {
          setAdminUser(meData.user);
          if (meData.user.role === 'supervisor') {
            setActiveTab('users');
          }
        } else {
          router.push('/dashboard'); // Staff gets redirected to calculator
          return;
        }

        // 2. Fetch admin data lists
        await loadAllData();
      } catch (err) {
        console.error('Init admin error:', err);
        setError('Error loading administrator details.');
      } finally {
        setLoading(false);
      }
    }

    initAdmin();
  }, [router]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, reportCustomerId, reportStatus, reportStartDate, reportEndDate]);

  useEffect(() => {
    if (activeTab === 'security') {
      fetchSecurityData();
    }
  }, [activeTab, filterSecurityInvoiceNo, filterSecurityOfficer, filterSecurityStatus]);

  const fetchGlazingCatalog = async () => {
    setGlazingLoading(true);
    try {
      const { getCatalog } = await import('../glazing-config/actions');
      const data = await getCatalog();
      setCatalogCategories(data as any);
    } catch (err: any) {
      console.error('Error fetching glazing catalog:', err);
      setError('Failed to fetch glazing catalog configurations.');
    } finally {
      setGlazingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'glazing-config') {
      fetchGlazingCatalog();
    }
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // --- Glass Types CRUD Submit ---
  const handleGlassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlassFormError('');

    if (!glassName || !glassPrice) {
      setGlassFormError('Please fill in all fields');
      return;
    }

    const price = parseFloat(glassPrice);
    if (isNaN(price) || price <= 0) {
      setGlassFormError('Price must be a positive number');
      return;
    }

    const url = editingGlass ? `/api/glass-types/${editingGlass.id}` : '/api/glass-types';
    const method = editingGlass ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: glassName, price_per_sqm: price }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit glass type');
      }

      setSuccess(editingGlass ? 'Glass type updated successfully!' : 'Glass type created successfully!');
      
      // Close & Reset
      setGlassFormOpen(false);
      setEditingGlass(null);
      setGlassName('');
      setGlassPrice('');
      
      // Refresh Lists
      await loadAllData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error processing request';
      setGlassFormError(errorMsg);
    }
  };

  const startEditGlass = (gt: GlassType) => {
    setEditingGlass(gt);
    setGlassName(gt.name);
    setGlassPrice(gt.price_per_sqm.toString());
    setGlassFormError('');
    setGlassFormOpen(true);
  };

  const handleDeleteGlass = async (id: string) => {
    const bypass = typeof window !== 'undefined' && window.location.search.includes('bypassConfirm');
    if (!bypass && !window.confirm('Are you sure you want to delete this glass type?')) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/glass-types/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete glass type');
      }

      setSuccess('Glass type deleted successfully.');
      await loadAllData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error deleting glass type';
      setError(errorMsg);
    }
  };

  // --- Users CRUD Submit ---
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');

    if (!userName || !userEmail || !userRole || !userStatus) {
      setUserFormError('Name, email, role, and status are required');
      return;
    }

    // Require password only for new users
    if (!editingUser && !userPassword) {
      setUserFormError('Password is required for new users');
      return;
    }

    const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
    const method = editingUser ? 'PUT' : 'POST';

    const payload: Partial<User> & { password?: string } = {
      name: userName,
      email: userEmail,
      role: userRole,
      status: userStatus,
    };

    if (userPassword) {
      payload.password = userPassword;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save user');
      }

      setSuccess(editingUser ? 'User updated successfully!' : 'User created successfully!');
      
      // Close & Reset
      setUserFormOpen(false);
      setEditingUser(null);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      setUserRole('user');
      setUserStatus('active');
      
      // Refresh Lists
      await loadAllData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error processing request';
      setUserFormError(errorMsg);
    }
  };

  const startEditUser = (u: User) => {
    setEditingUser(u);
    setUserName(u.name);
    setUserEmail(u.email);
    setUserRole(u.role);
    setUserStatus(u.status);
    setUserPassword(''); // blank out password field (optional override)
    setUserFormError('');
    setUserFormOpen(true);
  };

  const handleDeleteUser = async (id: string) => {
    if (id === adminUser?.id) {
      setError('You cannot delete your own admin account.');
      return;
    }
    const bypass = typeof window !== 'undefined' && window.location.search.includes('bypassConfirm');
    if (!bypass && !window.confirm('Are you sure you want to delete this user? This will also delete all their quotes.')) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setSuccess('User deleted successfully.');
      await loadAllData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error deleting user';
      setError(errorMsg);
    }
  };

  // --- Dynamic sorting and filtering of quotes list ---
  const filteredQuotes = quotes.filter((q) => {
    const matchesUser = filterUserId ? q.user_id === filterUserId : true;
    const matchesGlass = filterGlassId ? q.glass_type_id === filterGlassId : true;
    
    let matchesDate = true;
    const qDate = new Date(q.created_at);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      matchesDate = matchesDate && qDate >= start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23,59,59,999);
      matchesDate = matchesDate && qDate <= end;
    }

    return matchesUser && matchesGlass && matchesDate;
  }).sort((a, b) => {
    const factor = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'price') {
      return (a.total_price - b.total_price) * factor;
    } else if (sortBy === 'area') {
      return ((a.area ?? 0) - (b.area ?? 0)) * factor;
    } else {
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * factor;
    }
  });

  // --- CSV Export ---
  const handleExportCSV = () => {
    try {
      const headers = ['Quote ID', 'Date/Time', 'Staff Name', 'Glass Type', 'Length (m)', 'Width (m)', 'Thickness (mm)', 'Area (m²)', 'Price (GHS)'];
      const rows = filteredQuotes.map((q) => [
        q.id,
        new Date(q.created_at).toLocaleString(),
        q.user.name,
        q.items_json
          ? Array.from(new Set(JSON.parse(q.items_json).map((item: any) => item.glass_type_name))).join(' | ')
          : (q.glass_type?.name || 'N/A'),
        q.items_json ? 'Grouped' : (q.length?.toFixed(2) || 'N/A'),
        q.items_json ? 'Grouped' : (q.width?.toFixed(2) || 'N/A'),
        q.items_json
          ? JSON.parse(q.items_json).map((item: any) => item.thickness.toFixed(1)).join(' | ')
          : (q.thickness || 6.0).toFixed(1),
        (q.area ?? 0).toFixed(2),
        q.total_price.toFixed(2),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `GlassCut_Global_Quotes_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV export failed:', err);
    }
  };

  const handleExportInvoicePDF = async (invoice: any) => {
    console.log("admin handleExportInvoicePDF called for:", invoice);
    try {
      let fullInvoice = invoice;
      if (!invoice.line_items || invoice.line_items.length === 0) {
        setReportsLoading(true);
        const res = await fetch(`/api/invoices/${invoice.id}`, { cache: 'no-store' });
        setReportsLoading(false);
        if (res.ok) {
          fullInvoice = await res.json();
        } else {
          setError('Failed to fetch detailed invoice information.');
          return;
        }
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Background Banner
      doc.setFillColor(15, 22, 42); // deep navy
      doc.rect(0, 0, 210, 38, 'F');

      // Title
      doc.setTextColor(56, 189, 248); // primary light blue
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('GlassCut Manager', 15, 18);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.text('OFFICIAL INVOICE (ADMIN VIEW)', 15, 26);
      doc.text('GHS Currency', 170, 18);

      // Metadata Block Left
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9.5);
      doc.setFont('Helvetica', 'bold');
      doc.text('INVOICE TO:', 15, 50);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Customer Name: ${fullInvoice.customer.name}`, 15, 56);
      doc.text(`Email: ${fullInvoice.customer.email || 'N/A'}`, 15, 62);
      doc.text(`Phone: ${fullInvoice.customer.phone || 'N/A'}`, 15, 68);

      // Metadata Block Right
      doc.setFont('Helvetica', 'bold');
      doc.text('INVOICE DETAILS:', 120, 50);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Invoice No: ${fullInvoice.invoice_no}`, 120, 56);
      doc.text(`Date Issued: ${new Date(fullInvoice.created_at).toLocaleDateString()}`, 120, 62);
      doc.text(`Due Date: ${new Date(fullInvoice.due_date).toLocaleDateString()}`, 120, 68);
      doc.text(`Issued By: ${fullInvoice.user?.name || 'Staff'}`, 120, 74);

      // Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 80, 195, 80);

      // Table Header Row
      doc.setFillColor(248, 250, 252);
      doc.rect(15, 87, 180, 10, 'F');
      
      doc.setTextColor(30, 41, 59);
      doc.setFont('Helvetica', 'bold');
      doc.text('Item Specification / Dimension', 18, 93.5);
      doc.text('Qty', 120, 93.5);
      doc.text('Unit GHS', 142, 93.5);
      doc.text('Total GHS', 170, 93.5);

      // Details Rows
      doc.setFont('Helvetica', 'normal');
      let currentY = 104;

      (fullInvoice.line_items || []).forEach((item: any) => {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
          doc.setFillColor(248, 250, 252);
          doc.rect(15, currentY - 7, 180, 10, 'F');
          doc.setTextColor(30, 41, 59);
          doc.setFont('Helvetica', 'bold');
          doc.text('Item Specification / Dimension', 18, currentY - 1.5);
          doc.text('Qty', 120, currentY - 1.5);
          doc.text('Unit GHS', 142, currentY - 1.5);
          doc.text('Total GHS', 170, currentY - 1.5);
          doc.setFont('Helvetica', 'normal');
          currentY += 7;
        }

        const specText = `${item.glass_type?.name || 'Glass'} (${item.length.toFixed(2)}m x ${item.width.toFixed(2)}m x ${item.thickness.toFixed(1)}mm)`;
        
        doc.text(specText.length > 50 ? specText.slice(0, 47) + '...' : specText, 18, currentY);
        doc.text(item.quantity.toString(), 122, currentY);
        doc.text(item.unit_price.toFixed(2), 142, currentY);
        doc.text(item.total_price.toFixed(2), 170, currentY);
        
        doc.setDrawColor(241, 245, 249);
        doc.line(15, currentY + 3, 195, currentY + 3);
        currentY += 9;
      });

      // Subtotals & Balance Block
      currentY += 5;
      doc.setDrawColor(226, 232, 240);
      doc.line(15, currentY, 195, currentY);
      currentY += 8;

      doc.setFont('Helvetica', 'normal');
      doc.text('Subtotal:', 120, currentY);
      doc.text(`${fullInvoice.subtotal.toFixed(2)} GHS`, 170, currentY);
      currentY += 6;

      doc.text('Taxes / Levies:', 120, currentY);
      doc.text(`${fullInvoice.tax.toFixed(2)} GHS`, 170, currentY);
      currentY += 6;

      doc.setFont('Helvetica', 'bold');
      doc.text('Total Amount Due:', 120, currentY);
      doc.text(`${fullInvoice.total_amount.toFixed(2)} GHS`, 170, currentY);
      currentY += 8;

      // Status Badge Banner
      let badgeBg = [254, 242, 242]; // unpaid
      let badgeBorder = [252, 165, 165];
      let badgeText = [185, 28, 28];
      if (fullInvoice.status === 'paid') {
        badgeBg = [240, 253, 250];
        badgeBorder = [16, 185, 129];
        badgeText = [6, 95, 70];
      } else if (fullInvoice.status === 'partially_paid') {
        badgeBg = [255, 251, 235];
        badgeBorder = [245, 158, 11];
        badgeText = [146, 64, 14];
      }

      doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
      doc.rect(15, currentY, 180, 16, 'F');
      doc.setDrawColor(badgeBorder[0], badgeBorder[1], badgeBorder[2]);
      doc.rect(15, currentY, 180, 16, 'D');

      doc.setTextColor(badgeText[0], badgeText[1], badgeText[2]);
      doc.setFontSize(11);
      doc.text(`Invoice Status: ${fullInvoice.status.toUpperCase().replace('_', ' ')}`, 22, currentY + 10);
      doc.text(`Balance Due: ${fullInvoice.balance_due.toFixed(2)} GHS`, 120, currentY + 10);

      // Footer
      doc.setTextColor(148, 163, 184);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('All payments should refer to the Invoice Number above. Payment terms are net due.', 15, 280);

      downloadPDF(doc, `GlassCut_Invoice_${fullInvoice.invoice_no}.pdf`);
    } catch (err) {
      console.error('Invoice PDF generation error:', err);
      setError('Error generating invoice PDF.');
    }
  };

  const handleExportReceiptPDF = (bill: any, invoice: any) => {
    console.log("admin handleExportReceiptPDF called for:", bill, invoice);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Background Banner
      doc.setFillColor(15, 22, 42); // deep navy
      doc.rect(0, 0, 210, 38, 'F');

      // Title
      doc.setTextColor(56, 189, 248); // primary light blue
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('GlassCut Manager', 15, 18);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.text('OFFICIAL PAYMENT RECEIPT', 15, 26);
      doc.text('GHS Currency', 170, 18);

      // Metadata Block Left
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9.5);
      doc.setFont('Helvetica', 'bold');
      doc.text('RECEIVED FROM:', 15, 50);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Customer Name: ${invoice.customer?.name || 'Client'}`, 15, 56);
      doc.text(`Email: ${invoice.customer?.email || 'N/A'}`, 15, 62);
      doc.text(`Phone: ${invoice.customer?.phone || 'N/A'}`, 15, 68);

      // Metadata Block Right
      doc.setFont('Helvetica', 'bold');
      doc.text('RECEIPT DETAILS:', 120, 50);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Receipt No: ${bill.receipt_no}`, 120, 56);
      doc.text(`Date Paid: ${new Date(bill.payment_date).toLocaleDateString()}`, 120, 62);
      doc.text(`Payment Method: ${bill.payment_method}`, 120, 68);
      doc.text(`Reference Invoice: ${invoice.invoice_no}`, 120, 74);

      // Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 80, 195, 80);

      // Receipt Description Table
      doc.setFillColor(248, 250, 252);
      doc.rect(15, 87, 180, 10, 'F');
      
      doc.setTextColor(30, 41, 59);
      doc.setFont('Helvetica', 'bold');
      doc.text('Payment Description / Notes', 18, 93.5);
      doc.text('Amount Received', 150, 93.5);
      let currentY = 106;
      doc.setFont('Helvetica', 'bold');
      doc.text(`${bill.amount_paid.toFixed(2)} GHS`, 150, currentY);

      doc.setFont('Helvetica', 'normal');
      if (bill.notes && bill.notes.trim() !== '') {
        doc.text(`Notes: ${bill.notes}`, 18, currentY);
        currentY += 6;
      }

      doc.setFont('Helvetica', 'bold');
      doc.text('Items Paid For:', 18, currentY);
      currentY += 6;

      doc.setFont('Helvetica', 'normal');
      if (invoice.line_items && invoice.line_items.length > 0) {
        invoice.line_items.forEach((item: any) => {
          const itemText = `${item.quantity}x ${item.glass_type?.name || 'Glass'} (${item.thickness}mm) - ${item.length.toFixed(2)}m x ${item.width.toFixed(2)}m`;
          doc.text(itemText, 22, currentY);
          currentY += 6;
        });
      } else {
        doc.text(`Installment payment for Invoice ${invoice.invoice_no}`, 22, currentY);
        currentY += 6;
      }

      const tableBottomY = currentY + 2;
      doc.setDrawColor(226, 232, 240);
      doc.line(15, tableBottomY, 195, tableBottomY);

      // Balance summary block
      let summaryY = tableBottomY + 12;
      doc.setFont('Helvetica', 'normal');
      doc.text('Invoice Total Amount:', 120, summaryY);
      doc.text(`${invoice.total_amount.toFixed(2)} GHS`, 170, summaryY);
      summaryY += 8;

      doc.text('Total Amount Paid so far:', 120, summaryY);
      doc.text(`${invoice.amount_paid.toFixed(2)} GHS`, 170, summaryY);
      summaryY += 8;

      doc.setFont('Helvetica', 'bold');
      doc.text('Remaining Balance Due:', 120, summaryY);
      doc.text(`${invoice.balance_due.toFixed(2)} GHS`, 170, summaryY);

      // Receipt footer card
      summaryY += 15;
      doc.setFillColor(240, 253, 250); // green bg
      doc.rect(15, summaryY, 180, 18, 'F');
      doc.setDrawColor(16, 185, 129); // green border
      doc.rect(15, summaryY, 180, 18, 'D');

      doc.setTextColor(6, 95, 70); // deep green text
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Thank you for your business!', 22, summaryY + 11);
      doc.text(`Receipt Reference: ${bill.receipt_no}`, 120, summaryY + 11);;

      // Footer
      doc.setTextColor(148, 163, 184);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('This is a computer generated payment confirmation statement.', 15, 280);

      downloadPDF(doc, `GlassCut_Receipt_${bill.receipt_no}.pdf`);
    } catch (err) {
      console.error('Receipt PDF generation error:', err);
      setError('Error generating payment receipt PDF.');
    }
  };

  const renderActionBadge = (action: string) => {
    let className = 'badge';
    let style = {};
    
    if (action === 'LOGIN') {
      className += ' badge-success';
    } else if (action === 'LOGOUT') {
      style = { background: 'rgba(148, 163, 184, 0.1)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.2)' };
    } else if (action.startsWith('CREATE_')) {
      className += ' badge-primary';
    } else if (action.startsWith('UPDATE_')) {
      style = { background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' };
    } else if (action.startsWith('DELETE_')) {
      className += ' badge-danger';
    } else {
      className += ' badge-primary';
    }

    return (
      <span className={className} style={style}>
        {action.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className="card-glass" style={{ textAlign: 'center', padding: '40px' }}>
          <div className={styles.spinner}></div>
          <p style={{ marginTop: '16px' }} className="text-muted">Loading Admin Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminContainer}>
      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.navBrand}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="3" y1="9" x2="21" y2="9" />
          </svg>
          <span className="text-gradient" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
            GlassCut Manager
          </span>
          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
            {adminUser?.role === 'supervisor' ? 'Supervisor Portal' : 'Admin Portal'}
          </span>
        </div>
        <div className={styles.navUser}>
          <div className={styles.userInfo}>
            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{adminUser?.name}</span>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>{adminUser?.email} ({adminUser?.role})</span>
          </div>
          <button 
            type="button"
            className="btn btn-secondary" 
            style={{ padding: '8px 14px', fontSize: '0.85rem', marginRight: '8px' }} 
            onClick={() => router.push('/dashboard')}
          >
            Staff Dashboard
          </button>
          <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Admin Panel Body */}
      <div className={styles.panelBody}>
        {/* Sidebar Nav */}
        <aside className={styles.sidebar}>
          {adminUser?.role === 'admin' && (
            <>
              <button
                className={`${styles.sidebarLink} ${activeTab === 'overview' ? styles.active : ''}`}
                onClick={() => { setActiveTab('overview'); setError(''); setSuccess(''); }}
              >
                Overview & Metrics
              </button>
              <button
                className={`${styles.sidebarLink} ${activeTab === 'glass' ? styles.active : ''}`}
                onClick={() => { setActiveTab('glass'); setError(''); setSuccess(''); }}
              >
                Manage Glass Types
              </button>
              <button
                className={`${styles.sidebarLink} ${activeTab === 'glazing-config' ? styles.active : ''}`}
                onClick={() => { setActiveTab('glazing-config'); setError(''); setSuccess(''); }}
              >
                Glazing Catalog Config
              </button>
            </>
          )}
          <button
            className={`${styles.sidebarLink} ${activeTab === 'users' ? styles.active : ''}`}
            onClick={() => { setActiveTab('users'); setError(''); setSuccess(''); }}
          >
            Manage User Accounts
          </button>
          <button
            className={`${styles.sidebarLink} ${activeTab === 'security' ? styles.active : ''}`}
            onClick={() => { setActiveTab('security'); setError(''); setSuccess(''); fetchSecurityData(); }}
          >
            Security Exit Audits
          </button>
          {adminUser?.role === 'admin' && (
            <>
              <button
                className={`${styles.sidebarLink} ${activeTab === 'quotes' ? styles.active : ''}`}
                onClick={() => { setActiveTab('quotes'); setError(''); setSuccess(''); }}
              >
                Audit All Quotes
              </button>
              <button
                className={`${styles.sidebarLink} ${activeTab === 'logs' ? styles.active : ''}`}
                onClick={() => { setActiveTab('logs'); setError(''); setSuccess(''); fetchLogs(); }}
              >
                Activity Logs
              </button>
              <button
                className={`${styles.sidebarLink} ${activeTab === 'reports' ? styles.active : ''}`}
                onClick={() => { setActiveTab('reports'); setError(''); setSuccess(''); fetchReports(); }}
              >
                Financial Reports
              </button>
            </>
          )}
        </aside>

        {/* Content Pane */}
        <main className={styles.contentPane}>
          {/* Success/Error Banners */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '20px' }}>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success" style={{ marginBottom: '20px' }} onClick={() => setSuccess('')}>
              <span>{success}</span>
            </div>
          )}

          {/* ================= OVERVIEW TAB ================= */}
          {activeTab === 'overview' && metrics && (
            <div className={styles.tabContent}>
              <div className={styles.paneHeader}>
                <h1 style={{ fontSize: '1.5rem' }}>Overview & Metrics</h1>
                <p className="text-muted" style={{ fontSize: '0.875rem' }}>Real-time usage analytics and estimated revenue summary</p>
              </div>

              {/* KPI Cards */}
              <div className={styles.kpiContainer}>
                <div className="card" style={{ flex: 1 }}>
                  <span className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Estimates Logged
                  </span>
                  <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary)', marginTop: '8px' }}>
                    {metrics.totalQuotes}
                  </div>
                </div>

                <div className="card" style={{ flex: 1 }}>
                  <span className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Estimated Revenue
                  </span>
                  <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success)', marginTop: '8px' }}>
                    {metrics.totalRevenue.toFixed(2)} GHS
                  </div>
                </div>
              </div>

              {/* Data breakdowns grid */}
              <div className={styles.metricsGrid}>
                {/* Popular Glass types */}
                <div className="card">
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Frequently Selected Glass Options</h3>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Glass Type</th>
                          <th>Quotes Count</th>
                          <th>Revenue Generated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.glassStats.map((gs) => (
                          <tr key={gs.id}>
                            <td style={{ fontWeight: 500 }}>{gs.name}</td>
                            <td>{gs.count}</td>
                            <td style={{ color: 'var(--success)', fontWeight: 600 }}>{gs.revenue.toFixed(2)} GHS</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Staff performance metrics */}
                <div className="card">
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Staff Activity Summary</h3>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Estimates Logged</th>
                          <th>Total Estimates Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.userStats.map((us) => (
                          <tr key={us.id}>
                            <td style={{ fontWeight: 500 }}>{us.name}</td>
                            <td>
                              <span className={`badge ${us.role === 'admin' ? 'badge-success' : 'badge-primary'}`}>
                                {us.role}
                              </span>
                            </td>
                            <td>{us.count}</td>
                            <td style={{ color: 'var(--success)', fontWeight: 600 }}>{us.revenue.toFixed(2)} GHS</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= GLAZING CONFIG CATALOG TAB ================= */}
          {activeTab === 'glazing-config' && (
            <div className={styles.tabContent}>
              {glazingLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading glazing configurations...
                </div>
              ) : (
                <GlazingConfigTabContent
                  initialCategories={catalogCategories}
                  onCatalogChange={fetchGlazingCatalog}
                />
              )}
            </div>
          )}

          {/* ================= GLASS TYPES TAB ================= */}
          {activeTab === 'glass' && (
            <div className={styles.tabContent}>
              <div className={styles.paneHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem' }}>Manage Glass Types</h1>
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>Register glass configurations and update base square meter pricing (scaled per mm thickness)</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingGlass(null);
                    setGlassName('');
                    setGlassPrice('');
                    setGlassFormError('');
                    setGlassFormOpen(true);
                  }}
                >
                  Add Glass Type
                </button>
              </div>

              {/* Glass Types CRUD Modal Dialog */}
              {glassFormOpen && (
                <div className={styles.modalOverlay}>
                  <div className="card-glass" style={{ width: '100%', maxWidth: '450px' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
                      {editingGlass ? 'Edit Glass Configuration' : 'Add New Glass Option'}
                    </h3>
                    
                    {glassFormError && (
                      <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                        <span>{glassFormError}</span>
                      </div>
                    )}

                    <form onSubmit={handleGlassSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="modalGlassName">Name / Spec</label>
                        <input
                          type="text"
                          id="modalGlassName"
                          className="form-input"
                          placeholder="e.g. Tempered Safety Glass (8mm)"
                          value={glassName}
                          onChange={(e) => setGlassName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="modalGlassPrice">Base Price per m² per mm thickness (GHS/m²/mm)</label>
                        <input
                          type="number"
                          id="modalGlassPrice"
                          step="0.01"
                          min="0.01"
                          className="form-input"
                          placeholder="e.g. 1.00"
                          value={glassPrice}
                          onChange={(e) => setGlassPrice(e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                          {editingGlass ? 'Update Details' : 'Register Glass'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ flex: 1 }}
                          onClick={() => setGlassFormOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Glass Types List */}
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Base Price (GHS/m²/mm)</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {glassTypes.map((gt) => (
                      <tr key={gt.id}>
                        <td style={{ fontWeight: 600 }}>{gt.name}</td>
                        <td style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          {gt.price_per_sqm.toFixed(2)} GHS/m²/mm
                        </td>
                        <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => startEditGlass(gt)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => handleDeleteGlass(gt.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= USERS TAB ================= */}
          {activeTab === 'users' && (
            <div className={styles.tabContent}>
              <div className={styles.paneHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem' }}>Manage User Accounts</h1>
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>Control credential access, add staff, and toggle active/inactive status</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingUser(null);
                    setUserName('');
                    setUserEmail('');
                    setUserPassword('');
                    setUserRole('user');
                    setUserStatus('active');
                    setUserFormError('');
                    setUserFormOpen(true);
                  }}
                >
                  Create User
                </button>
              </div>

              {/* User Edit / Add Modal Form */}
              {userFormOpen && (
                <div className={styles.modalOverlay}>
                  <div className="card-glass" style={{ width: '100%', maxWidth: '480px' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
                      {editingUser ? `Edit Account - ${editingUser.name}` : 'Create New User Account'}
                    </h3>
                    
                    {userFormError && (
                      <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                        <span>{userFormError}</span>
                      </div>
                    )}

                    <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="modalUserName">Name</label>
                        <input
                          type="text"
                          id="modalUserName"
                          className="form-input"
                          placeholder="e.g. Richard Staff"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="modalUserEmail">Email Address</label>
                        <input
                          type="email"
                          id="modalUserEmail"
                          className="form-input"
                          placeholder="e.g. richard@glasscutting.com"
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="modalUserPassword">
                          {editingUser ? 'Reset Password (Leave blank to keep current)' : 'Account Password'}
                        </label>
                        <input
                          type="password"
                          id="modalUserPassword"
                          className="form-input"
                          placeholder={editingUser ? 'Type new password to override' : 'Enter initial password'}
                          value={userPassword}
                          onChange={(e) => setUserPassword(e.target.value)}
                          required={!editingUser}
                        />
                      </div>

                      <div className={styles.formRow}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label className="form-label" htmlFor="modalUserRole">Role</label>
                          <select
                            id="modalUserRole"
                            className="form-select"
                            value={userRole}
                            onChange={(e) => setUserRole(e.target.value)}
                          >
                            <option value="user">User (Staff)</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="admin">Admin</option>
                            <option value="security">Security Officer</option>
                          </select>                        </div>
                        
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label className="form-label" htmlFor="modalUserStatus">Status</label>
                          <select
                            id="modalUserStatus"
                            className="form-select"
                            value={userStatus}
                            onChange={(e) => setUserStatus(e.target.value)}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive (Deactivated)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                          {editingUser ? 'Save Changes' : 'Register User'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ flex: 1 }}
                          onClick={() => setUserFormOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Users List */}
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Quotes Created</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`badge ${u.role === 'admin' ? 'badge-success' : 'badge-primary'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {u._count?.quotes || 0} quotes
                        </td>
                        <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => startEditUser(u)}
                          >
                            Edit / Reset
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={u.id === adminUser?.id}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= AUDIT QUOTES TAB ================= */}
          {activeTab === 'quotes' && (
            <div className={styles.tabContent}>
              <div className={styles.paneHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem' }}>Audit All Quotes</h1>
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>Global search logs of every quote generated by staff</p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleExportCSV}
                  disabled={filteredQuotes.length === 0}
                  style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Export CSV ({filteredQuotes.length})
                </button>
              </div>

              {/* Filters Block */}
              <div className={styles.filterBar}>
                {/* Filter by Staff */}
                <select
                  className="form-select"
                  style={{ flex: 1, minWidth: '150px' }}
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                >
                  <option value="">All Staff Members</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>

                {/* Filter by Glass Type */}
                <select
                  className="form-select"
                  style={{ flex: 1, minWidth: '150px' }}
                  value={filterGlassId}
                  onChange={(e) => setFilterGlassId(e.target.value)}
                >
                  <option value="">All Glass Options</option>
                  {glassTypes.map((gt) => (
                    <option key={gt.id} value={gt.id}>
                      {gt.name}
                    </option>
                  ))}
                </select>

                {/* Sort Selector */}
                <select
                  className="form-select"
                  style={{ flex: 1, minWidth: '120px' }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="date">Sort by Date</option>
                  <option value="price">Sort by Price</option>
                  <option value="area">Sort by Area</option>
                </select>

                {/* Sort Order */}
                <select
                  className="form-select"
                  style={{ flex: 0.5, minWidth: '100px' }}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>

                {/* Dates */}
                <div className={styles.dateInputs}>
                  <input
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-muted">to</span>
                  <input
                    type="date"
                    className="form-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Table */}
              {filteredQuotes.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className="text-muted">No quotes recorded matching the selected filter criteria.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Created By</th>
                        <th>Glass Spec</th>
                        <th>Dimensions</th>
                        <th>Area (m²)</th>
                        <th>Price (GHS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((q) => (
                        <tr key={q.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {new Date(q.created_at).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {q.user.name}
                            <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'normal' }}>
                              {q.user.email}
                            </span>
                          </td>
                          <td>
                            {q.items_json ? (
                              <span style={{ fontSize: '0.85rem' }}>
                                {Array.from(new Set(JSON.parse(q.items_json).map((item: any) => item.glass_type_name))).join(', ')}
                              </span>
                            ) : (
                              q.glass_type?.name || 'N/A'
                            )}
                          </td>
                          <td>
                            {q.items_json ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {JSON.parse(q.items_json).map((item: any, idx: number) => (
                                  <div key={idx}>
                                    {item.length.toFixed(2)}m × {item.width.toFixed(2)}m × {item.thickness.toFixed(1)}mm
                                  </div>
                                ))}
                              </div>
                            ) : (
                              (q.length !== null && q.width !== null) ? `${q.length.toFixed(2)}m × ${q.width.toFixed(2)}m × ${(q.thickness || 6.0).toFixed(1)}mm` : 'N/A'
                            )}
                          </td>
                          <td>{(q.area ?? 0).toFixed(2)} m²</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                            {q.total_price.toFixed(2)} GHS
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= ACTIVITY LOGS TAB ================= */}
          {activeTab === 'logs' && (
            <div className={styles.tabContent}>
              <div className={styles.paneHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem' }}>Activity & Audit Logs</h1>
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>Real-time chronological record of system operations and staff events</p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}
                >
                  {logsLoading ? (
                    <>
                      <div className={styles.spinner} style={{ width: '16px', height: '16px', margin: 0 }}></div>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      Refresh Logs
                    </>
                  )}
                </button>
              </div>

              {/* Table */}
              {logsLoading && logs.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.spinner} style={{ marginBottom: '16px' }}></div>
                  <p className="text-muted">Loading activity logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className="text-muted">No activity logs recorded in the system.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: '20%' }}>Date & Time</th>
                        <th style={{ width: '25%' }}>User Context</th>
                        <th style={{ width: '15%' }}>Action</th>
                        <th style={{ width: '40%' }}>Activity Summary Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td>
                            {log.user_name || log.user_email ? (
                              <>
                                <span style={{ fontWeight: 600 }}>{log.user_name || 'N/A'}</span>
                                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                                  {log.user_email || 'N/A'}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted" style={{ fontStyle: 'italic' }}>System / Guest</span>
                            )}
                          </td>
                          <td>{renderActionBadge(log.action)}</td>
                          <td style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= FINANCIAL REPORTS TAB ================= */}
          {activeTab === 'reports' && (
            <div className={styles.tabContent}>
              <div className={styles.paneHeader}>
                <h1 style={{ fontSize: '1.5rem' }}>Financial Reports & Revenue Analytics</h1>
                <p className="text-muted" style={{ fontSize: '0.875rem' }}>View total invoiced, payments collected, outstanding balances, and filter by customer or date range</p>
              </div>

              {/* Filters Block */}
              <div className={styles.filterBar}>
                {/* Filter by Customer */}
                <select
                  className="form-select"
                  style={{ flex: 1, minWidth: '180px' }}
                  value={reportCustomerId}
                  onChange={(e) => setReportCustomerId(e.target.value)}
                >
                  <option value="">All Customers</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'No Phone'})
                    </option>
                  ))}
                </select>

                {/* Filter by Status */}
                <select
                  className="form-select"
                  style={{ flex: 1, minWidth: '150px' }}
                  value={reportStatus}
                  onChange={(e) => setReportStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                {/* Date range */}
                <div className={styles.dateInputs}>
                  <input
                    type="date"
                    className="form-input"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    placeholder="Start Date"
                  />
                  <span className="text-muted">to</span>
                  <input
                    type="date"
                    className="form-input"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    placeholder="End Date"
                  />
                </div>

                {/* Clear filters button */}
                {(reportCustomerId || reportStatus || reportStartDate || reportEndDate) && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                    onClick={() => {
                      setReportCustomerId('');
                      setReportStatus('');
                      setReportStartDate('');
                      setReportEndDate('');
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {reportsLoading && !reportsData ? (
                <div className={styles.emptyState}>
                  <div className={styles.spinner} style={{ marginBottom: '16px' }}></div>
                  <p className="text-muted">Loading reports...</p>
                </div>
              ) : (
                <>
                  {/* KPI Summary Cards */}
                  <div className={styles.kpiContainer}>
                    <div className="card" style={{ flex: 1 }}>
                      <span className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Total Amount Invoiced
                      </span>
                      <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--primary)', marginTop: '8px' }}>
                        {(reportsData?.summary?.totalInvoiced || 0).toFixed(2)} GHS
                      </div>
                    </div>

                    <div className="card" style={{ flex: 1 }}>
                      <span className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Total Amount Received
                      </span>
                      <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--success)', marginTop: '8px' }}>
                        {(reportsData?.summary?.totalReceived || 0).toFixed(2)} GHS
                      </div>
                    </div>

                    <div className="card" style={{ flex: 1 }}>
                      <span className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Outstanding Balance
                      </span>
                      <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--error)', marginTop: '8px' }}>
                        {(reportsData?.summary?.outstandingBalance || 0).toFixed(2)} GHS
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid (Top Customers & Payments) */}
                  <div className={styles.metricsGrid}>
                    {/* Top Customers card */}
                    <div className="card">
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Top Performing Customers</h3>
                      {(!reportsData?.topCustomers || reportsData.topCustomers.length === 0) ? (
                        <p className="text-muted" style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>No customer invoicing records found.</p>
                      ) : (
                        <div className="table-container">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Customer Name</th>
                                <th>Total Invoiced</th>
                                <th>Total Paid</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportsData.topCustomers.map((tc: any, index: number) => (
                                <tr key={index}>
                                  <td style={{ fontWeight: 500 }}>{tc.name}</td>
                                  <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{tc.invoiced.toFixed(2)} GHS</td>
                                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{tc.received.toFixed(2)} GHS</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Recent Payments logs */}
                    <div className="card">
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Recent Installment Payments</h3>
                      {(!reportsData?.recentPayments || reportsData.recentPayments.length === 0) ? (
                        <p className="text-muted" style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>No payment records found.</p>
                      ) : (
                        <div className="table-container">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Receipt No</th>
                                <th>Invoice</th>
                                <th>Amount</th>
                                <th>Method</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportsData.recentPayments.map((p: any) => (
                                <tr key={p.id}>
                                  <td style={{ fontWeight: 600 }}>{p.receipt_no}</td>
                                  <td>
                                    <span style={{ fontWeight: 500 }}>{p.invoice.invoice_no}</span>
                                    <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                                      {p.invoice.customer.name}
                                    </span>
                                  </td>
                                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{p.amount_paid.toFixed(2)}</td>
                                  <td>{p.payment_method}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                      onClick={() => handleExportReceiptPDF(p, p.invoice)}
                                    >
                                      Receipt PDF
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Invoices Ledger block */}
                  <section className="card" style={{ marginTop: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Invoices History Ledger</h3>
                    {(!reportsData?.recentInvoices || reportsData.recentInvoices.length === 0) ? (
                      <p className="text-muted" style={{ fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '24px' }}>
                        No invoices generated matching filters.
                      </p>
                    ) : (
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Invoice No</th>
                              <th>Customer</th>
                              <th>Issue Date</th>
                              <th>Due Date</th>
                              <th>Total Amount</th>
                              <th>Paid</th>
                              <th>Balance</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>PDF</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportsData.recentInvoices.map((inv: any) => {
                              let badgeClass = 'badge-danger';
                              if (inv.status === 'paid') badgeClass = 'badge-success';
                              else if (inv.status === 'partially_paid') badgeClass = 'badge-primary';
                              
                              const badgeStyle = inv.status === 'partially_paid' ? { background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' } : {};

                              return (
                                <tr key={inv.id}>
                                  <td style={{ fontWeight: 600 }}>{inv.invoice_no}</td>
                                  <td>
                                    <span style={{ fontWeight: 500 }}>{inv.customer.name}</span>
                                    <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                                      {inv.customer.email || 'No Email'}
                                    </span>
                                  </td>
                                  <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                                  <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                                  <td style={{ fontWeight: 600 }}>{inv.total_amount.toFixed(2)} GHS</td>
                                  <td style={{ color: 'var(--success)' }}>{inv.amount_paid.toFixed(2)} GHS</td>
                                  <td style={{ color: inv.balance_due > 0 ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>
                                    {inv.balance_due.toFixed(2)} GHS
                                  </td>
                                  <td>
                                    <span className={`badge ${badgeClass}`} style={badgeStyle}>
                                      {inv.status.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      className="btn btn-secondary"
                                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                      onClick={() => handleExportInvoicePDF(inv)}
                                    >
                                      PDF
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

          {/* ================= SECURITY EXIT AUDITS TAB ================= */}
          {activeTab === 'security' && (
            <div className={styles.tabContent}>
              <div className={styles.paneHeader}>
                <h1 style={{ fontSize: '1.5rem' }}>Security Exit Audits & Clearance passes</h1>
                <p className="text-muted" style={{ fontSize: '0.875rem' }}>Track gate dispatches, check material checklists, review driver signatures, and resolve holds</p>
              </div>

              {/* Filters Block */}
              <div className={styles.filterBar}>
                {/* Filter by Invoice No */}
                <input
                  type="text"
                  placeholder="Filter by Invoice No..."
                  className="form-input"
                  style={{ flex: 1, minWidth: '150px' }}
                  value={filterSecurityInvoiceNo}
                  onChange={(e) => setFilterSecurityInvoiceNo(e.target.value)}
                />

                {/* Filter by Officer */}
                <input
                  type="text"
                  placeholder="Filter by Officer Name..."
                  className="form-input"
                  style={{ flex: 1, minWidth: '150px' }}
                  value={filterSecurityOfficer}
                  onChange={(e) => setFilterSecurityOfficer(e.target.value)}
                />

                {/* Filter by Status */}
                <select
                  className="form-select"
                  style={{ flex: 1, minWidth: '150px' }}
                  value={filterSecurityStatus}
                  onChange={(e) => setFilterSecurityStatus(e.target.value)}
                >
                  <option value="">All Verification Statuses</option>
                  <option value="dispatched">Dispatched (Clean)</option>
                  <option value="on_hold_discrepancy">On Hold (Discrepancy)</option>
                </select>

                {(filterSecurityInvoiceNo || filterSecurityOfficer || filterSecurityStatus) && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                    onClick={() => {
                      setFilterSecurityInvoiceNo('');
                      setFilterSecurityOfficer('');
                      setFilterSecurityStatus('');
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {securityLoading && securityVerifications.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.spinner} style={{ marginBottom: '16px' }}></div>
                  <p className="text-muted">Loading security exit data...</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  {/* Verifications table */}
                  <div className="card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Gate Exit Clearances</h3>
                    {securityVerifications.length === 0 ? (
                      <p className="text-muted" style={{ fontStyle: 'italic', padding: '16px 0' }}>No exit gate clearance records found.</p>
                    ) : (
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Clearance Ref</th>
                              <th>Invoice Ref</th>
                              <th>Customer</th>
                              <th>Driver / Vehicle</th>
                              <th>Officer</th>
                              <th>Checked Date</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {securityVerifications
                              .filter((v: any) => {
                                const matchesInv = filterSecurityInvoiceNo ? v.invoice.invoice_no.toLowerCase().includes(filterSecurityInvoiceNo.toLowerCase()) : true;
                                const matchesOff = filterSecurityOfficer ? v.officer_name.toLowerCase().includes(filterSecurityOfficer.toLowerCase()) : true;
                                const matchesStat = filterSecurityStatus ? v.status === filterSecurityStatus : true;
                                return matchesInv && matchesOff && matchesStat;
                              })
                              .map((v: any) => {
                                const isDiscrepancy = v.status === 'on_hold_discrepancy';
                                const badgeClass = isDiscrepancy ? 'badge-danger' : 'badge-success';
                                const badgeStyle = isDiscrepancy 
                                  ? { background: 'rgba(244, 63, 94, 0.1)', color: '#f87171', border: '1px solid rgba(244, 63, 94, 0.2)' }
                                  : { background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' };

                                return (
                                  <tr key={v.id}>
                                    <td style={{ fontWeight: 600 }}>{v.clearance_ref}</td>
                                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{v.invoice.invoice_no}</td>
                                    <td>{v.invoice.customer?.name}</td>
                                    <td>
                                      <span style={{ fontWeight: 500, display: 'block' }}>{v.invoice.driver_name || 'N/A'}</span>
                                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{v.invoice.vehicle_no || 'N/A'}</span>
                                    </td>
                                    <td>{v.officer_name}</td>
                                    <td>{new Date(v.verified_at).toLocaleString()}</td>
                                    <td>
                                      <span className={`badge ${badgeClass}`} style={badgeStyle}>
                                        {v.status.split('_').join(' ')}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                          onClick={() => setSelectedVerification(v)}
                                        >
                                          Details
                                        </button>
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                          onClick={() => {
                                            generateClearancePassPDF(v.invoice, v);
                                          }}
                                        >
                                          PDF
                                        </button>
                                        {isDiscrepancy && (
                                          <button
                                            className="btn btn-primary"
                                            style={{ padding: '6px 10px', fontSize: '0.8rem', backgroundColor: 'var(--accent)' }}
                                            onClick={() => handleResolveHold(v.invoice_id)}
                                          >
                                            Resolve
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Audit Logs table */}
                  <div className="card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Detailed Exit Gate Audit Trails</h3>
                    {securityLogs.length === 0 ? (
                      <p className="text-muted" style={{ fontStyle: 'italic', padding: '16px 0' }}>No detailed gate check logs found.</p>
                    ) : (
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Timestamp</th>
                              <th>Officer Name</th>
                              <th>Invoice Ref</th>
                              <th>Action Type</th>
                              <th>Action Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {securityLogs.map((log: any) => (
                              <tr key={log.id}>
                                <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                <td style={{ fontWeight: 600 }}>{log.officer_name}</td>
                                <td>{log.verification?.invoice?.invoice_no || 'N/A'}</td>
                                <td>
                                  <span className="badge badge-primary" style={{ textTransform: 'uppercase' }}>
                                    {log.action.replace('_', ' ')}
                                  </span>
                                </td>
                                <td>{log.details}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Verification details modal overlay */}
      {selectedVerification && (
        <div className={styles.modalOverlay}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
              Clearance Pass Details - {selectedVerification.clearance_ref}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px', marginBottom: '20px' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>Load Information</h4>
                <div style={{ fontSize: '0.9rem', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Invoice Ref: <strong>{selectedVerification.invoice.invoice_no}</strong></div>
                  <div>Driver Name: {selectedVerification.invoice.driver_name || 'N/A'}</div>
                  <div>Vehicle Plate: {selectedVerification.invoice.vehicle_no || 'N/A'}</div>
                  <div>Customer Profile: {selectedVerification.invoice.customer?.name}</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>Security Check Details</h4>
                <div style={{ fontSize: '0.9rem', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Officer Name: {selectedVerification.officer_name}</div>
                  <div>Gate Scan Date: {new Date(selectedVerification.verified_at).toLocaleString()}</div>
                  <div>Signatory Receiver: {selectedVerification.signatory_name}</div>
                  <div>Offline Subscribed: {selectedVerification.is_offline ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Line Items Checklist Results</h4>
              <div className="table-container">
                <table className="table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Glass Specification</th>
                      <th>Qty</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedVerification.items || []).map((item: any, index: number) => (
                      <tr key={index}>
                        <td>{item.glass_type_name} ({item.dimensions})</td>
                        <td>{item.quantity}</td>
                        <td>
                          {item.is_flagged ? (
                            <div>
                              <span className="badge badge-danger">Flagged</span>
                              {item.flag_notes && (
                                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>
                                  Note: {item.flag_notes}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="badge badge-success">Verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedVerification.notes && (
              <div style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '4px' }}>Officer Gate Notes:</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedVerification.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Digital Signature Captured:</h4>
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '4px', display: 'flex', padding: '6px' }}>
                  {selectedVerification.signature_data ? (
                    <img
                      src={selectedVerification.signature_data}
                      alt="Digital Signature"
                      style={{ height: '70px', objectFit: 'contain' }}
                    />
                  ) : (
                    <span className="text-muted" style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#000' }}>No signature image</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                {selectedVerification.status === 'on_hold_discrepancy' && (
                  <button
                    className="btn btn-primary"
                    style={{ backgroundColor: 'var(--success)' }}
                    onClick={() => handleResolveHold(selectedVerification.invoice_id)}
                  >
                    Resolve Hold & Clear Load
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedVerification(null)}
                >
                  Close Detail Panel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const generateClearancePassPDF = (invoice: any, verification: any) => {
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

    (verification.items || []).forEach((item: any) => {
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
