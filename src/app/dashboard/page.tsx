'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GlassVisualizer from '@/components/GlassVisualizer';
import { jsPDF } from 'jspdf';
import styles from './dashboard.module.css';
import Footer from '@/components/Footer';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
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
  glass_type: {
    name: string;
    price_per_sqm: number;
  } | null;
  line_items?: any[];
  items_json?: string | null;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at?: string;
}

interface InvoiceLineItem {
  id: string;
  glass_type: { name: string };
  length: number;
  width: number;
  thickness: number;
  area: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Bill {
  id: string;
  receipt_no: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoice_no: string;
  customer_id: string;
  customer: Customer;
  due_date: string;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled' | 'ready_for_dispatch' | 'dispatched' | 'on_hold_discrepancy';
  subtotal: number;
  tax: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  created_at: string;
  line_items: InvoiceLineItem[];
  bills: Bill[];
  user?: { name: string };
  driver_name?: string | null;
  vehicle_no?: string | null;
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

export default function StaffDashboard() {
  const router = useRouter();

  // Core app state
  const [user, setUser] = useState<User | null>(null);
  const [glassTypes, setGlassTypes] = useState<GlassType[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<any | null>(null);

  const getBase64ImageFromUrl = (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      };
      img.onerror = (error) => {
        reject(error);
      };
      img.src = imageUrl;
    });
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const formatDateTime = (dateStr: string | Date | number) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(settings?.defaultLanguage || 'en');
    } catch {
      return String(dateStr);
    }
  };

  const formatDate = (dateStr: string | Date | number) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(settings?.defaultLanguage || 'en');
    } catch {
      return String(dateStr);
    }
  };


  const [activeTab, setActiveTabState] = useState<'calculator' | 'invoices'>(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('dashboard_active_tab');
      if (savedTab === 'calculator' || savedTab === 'invoices') {
        return savedTab;
      }
    }
    return 'calculator';
  });

  const setActiveTab = (tab: 'calculator' | 'invoices') => {
    setActiveTabState(tab);
    localStorage.setItem('dashboard_active_tab', tab);
  };

  const [invoiceViewTab, setInvoiceViewTab] = useState<'active' | 'paid'>('active');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dispatchFormOpen, setDispatchFormOpen] = useState(false);
  const [dispatchDriverName, setDispatchDriverName] = useState('');
  const [dispatchVehicleNo, setDispatchVehicleNo] = useState('');
  const [dispatchInvoice, setDispatchInvoice] = useState<Invoice | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [dueDateInput, setDueDateInput] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [taxInput, setTaxInput] = useState('0.00');
  const [invoiceDiscountInput, setInvoiceDiscountInput] = useState('');
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [customLineItems, setCustomLineItems] = useState<Array<{ glassTypeId: string; length: string; width: string; thickness: string; quantity: string }>>([]);

  // Bill payment recording fields
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Customer on-the-fly fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Calculator form inputs (New Flow)
  const [descriptionInput, setDescriptionInput] = useState('');
  const [qtyInput, setQtyInput] = useState('1');
  const [widthMmInput, setWidthMmInput] = useState('');
  const [heightMmInput, setHeightMmInput] = useState('');
  const [unitPriceInput, setUnitPriceInput] = useState('');
  const [selectedGlassId, setSelectedGlassId] = useState('');
  const [discountPercentageInput, setDiscountPercentageInput] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Calculator list & visualizer states
  const [quoteItems, setQuoteItems] = useState<Array<{
    id: string;
    ref: number;
    description: string;
    qty: number;
    widthMm: number;
    heightMm: number;
    areaSqm: number;
    unitPrice: number;
    amount: number;
    
    // Backward-compatible fields
    glassTypeId: string;
    glassTypeName: string;
    length: number;
    width: number;
    thickness: number;
    area: number;
    price: number;
    quantity: number;
  }>>([]);
  const [visualizedItem, setVisualizedItem] = useState<{
    length: number;
    width: number;
    thickness: number;
    glassTypeName: string;
  } | null>(null);

  // Auto-update description and unit price based on selected glass type preset
  useEffect(() => {
    if (!glassTypes.length || !selectedGlassId) return;
    const selected = glassTypes.find((gt) => gt.id === selectedGlassId);
    if (selected) {
      setDescriptionInput(selected.name);
      setUnitPriceInput(selected.price_per_sqm.toString());
    }
  }, [selectedGlassId, glassTypes]);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGlassId, setFilterGlassId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Load user details, glass types, and quotes history
  useEffect(() => {
    async function initData() {
      try {
        // 1. Fetch current user
        const userRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!userRes.ok) {
          router.push('/login');
          return;
        }
        const userData = await userRes.json();
        if (userData && userData.authenticated) {
          setUser(userData.user);
        } else {
          router.push('/login');
          return;
        }

        // Fetch system settings
        await fetchSettings();

        // 2. Fetch Glass Types
        const gtRes = await fetch('/api/glass-types', { cache: 'no-store' });
        if (gtRes.ok) {
          const gtData = await gtRes.json();
          setGlassTypes(gtData);
          if (gtData.length > 0) {
            setSelectedGlassId(gtData[0].id);
          }
        }

        // 3. Fetch User Quotes
        const quotesRes = await fetch('/api/quotes', { cache: 'no-store' });
        if (quotesRes.ok) {
          const quotesData = await quotesRes.json();
          setQuotes(quotesData);
        }

        // 4. Fetch Invoices and Customers
        const [invRes, custRes] = await Promise.all([
          fetch('/api/invoices', { cache: 'no-store' }),
          fetch('/api/admin/customers', { cache: 'no-store' }),
        ]);
        if (invRes.ok) setInvoices(await invRes.json());
        if (custRes.ok) setCustomers(await custRes.json());
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError('Error initializing dashboard. Please refresh.');
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [router]);

  // Logout handler
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // --- Invoicing, Customer, and Payment Handlers ---
  const loadInvoicesData = async () => {
    setInvoicesLoading(true);
    try {
      const [invRes, custRes, quotesRes] = await Promise.all([
        fetch('/api/invoices', { cache: 'no-store' }),
        fetch('/api/admin/customers', { cache: 'no-store' }),
        fetch('/api/quotes', { cache: 'no-store' }),
      ]);

      if (invRes.ok) setInvoices(await invRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (quotesRes.ok) setQuotes(await quotesRes.json());
    } catch (err) {
      console.error('Error loading invoices related data:', err);
      setError('Failed to load invoices or customers.');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!customerName) {
      setError('Customer name is required');
      return;
    }

    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customerName, email: customerEmail, phone: customerPhone }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }

      setSuccess('Customer created successfully!');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerFormOpen(false);
      setSelectedCustomerId(data.id);

      await loadInvoicesData();
    } catch (err: any) {
      setError(err.message || 'Error creating customer');
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedCustomerId) {
      setError('Please select a customer');
      return;
    }
    if (!dueDateInput) {
      setError('Please select a due date');
      return;
    }

    const payload = {
      customerId: selectedCustomerId,
      dueDate: dueDateInput,
      tax: parseFloat(taxInput) || 0.0,
      discount_percentage: (user?.role === 'admin' || user?.role === 'supervisor') ? parseFloat(invoiceDiscountInput) || 0.0 : 0.0,
      quotes: selectedQuoteIds,
      customItems: customLineItems.filter(item => item.glassTypeId && item.length && item.width && item.thickness && item.quantity),
    };

    if (payload.quotes.length === 0 && payload.customItems.length === 0) {
      setError('Please select at least one quote or add a custom line item');
      return;
    }

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invoice');
      }

      setSuccess(`Invoice ${data.invoice_no} created successfully!`);
      setInvoiceFormOpen(false);
      
      setSelectedCustomerId('');
      setDueDateInput(new Date().toISOString().split('T')[0]);
      setTaxInput('0.00');
      setInvoiceDiscountInput('');
      setSelectedQuoteIds([]);
      setCustomLineItems([]);

      await loadInvoicesData();
    } catch (err: any) {
      setError(err.message || 'Error generating invoice');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedInvoice) {
      setError('No invoice selected');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid positive payment amount');
      return;
    }

    try {
      const res = await fetch(`/api/invoices/${selectedInvoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPaid: amount, paymentMethod, notes: paymentNotes }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      setSuccess(`Payment receipt ${data.receipt_no} generated!`);
      setPaymentFormOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentMethod('Cash');
      setSelectedInvoice(null);

      await loadInvoicesData();
    } catch (err: any) {


      setError(err.message || 'Error recording payment');
    }
  };

  const handleMarkReadyForDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!dispatchInvoice) return;

    try {
      const res = await fetch(`/api/invoices/${dispatchInvoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ready_for_dispatch',
          driver_name: dispatchDriverName,
          vehicle_no: dispatchVehicleNo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update dispatch details');
      }

      setSuccess(`Invoice ${dispatchInvoice.invoice_no} is now ready for dispatch!`);
      setDispatchFormOpen(false);
      setDispatchDriverName('');
      setDispatchVehicleNo('');
      setDispatchInvoice(null);

      await loadInvoicesData();
    } catch (err: any) {
      setError(err.message || 'Error marking ready for dispatch');
    }
  };

  // Helper to extract thickness from description string
  const getThicknessFromDescription = (desc: string): number => {
    const match = desc.match(/(\d+(?:\.\d+)?)\s*mm/i);
    return match ? parseFloat(match[1]) : 6.0;
  };

  // Compute live calculations (New Flow)
  const parsedQty = parseInt(qtyInput);
  const parsedWidthMm = parseFloat(widthMmInput);
  const parsedHeightMm = parseFloat(heightMmInput);
  const parsedUnitPrice = parseFloat(unitPriceInput);

  const isQtyValid = !isNaN(parsedQty) && parsedQty >= 1;
  const isWidthMmValid = !isNaN(parsedWidthMm) && parsedWidthMm > 0;
  const isHeightMmValid = !isNaN(parsedHeightMm) && parsedHeightMm > 0;
  const isUnitPriceValid = !isNaN(parsedUnitPrice) && parsedUnitPrice >= 0;

  const calculatedArea = (isQtyValid && isWidthMmValid && isHeightMmValid)
    ? Math.round(((parsedWidthMm / 1000) * (parsedHeightMm / 1000) * parsedQty) * 10000) / 10000
    : 0;

  const calculatedAmount = (calculatedArea > 0 && isUnitPriceValid)
    ? Math.round(calculatedArea * parsedUnitPrice)
    : 0;

  const parsedThickness = getThicknessFromDescription(descriptionInput);
  const currentGlass = glassTypes.find((gt) => gt.id === selectedGlassId);
  const unitPricePreset = currentGlass ? currentGlass.price_per_sqm : 0;

  const rawDiscount = parseFloat(discountPercentageInput);
  const discountVal = !isNaN(rawDiscount) ? rawDiscount : 0;
  const hasDiscount = (user?.role === 'admin' || user?.role === 'supervisor') && discountVal > 0 && discountVal <= 100;
  const finalDiscountPercent = hasDiscount ? discountVal : 0;

  const discountAmountSingle = calculatedAmount * (finalDiscountPercent / 100);
  const totalPrice = calculatedAmount - discountAmountSingle;

  const baseGrandTotal = quoteItems.reduce((sum, item) => sum + (item.amount || item.price), 0);
  const discountAmountBulk = baseGrandTotal * (finalDiscountPercent / 100);
  const finalGrandTotal = Math.round(baseGrandTotal - discountAmountBulk);

  const visualLength = visualizedItem 
    ? (visualizedItem as any).length 
    : (isWidthMmValid ? parsedWidthMm / 1000 : 0);
  const visualWidth = visualizedItem 
    ? (visualizedItem as any).width 
    : (isHeightMmValid ? parsedHeightMm / 1000 : 0);
  const visualThickness = visualizedItem 
    ? (visualizedItem as any).thickness 
    : parsedThickness;
  const visualGlassTypeName = visualizedItem 
    ? (visualizedItem as any).glassTypeName || (visualizedItem as any).description
    : descriptionInput;

  const handleAddToQuoteList = () => {
    setError('');
    setSuccess('');

    if (!descriptionInput || !widthMmInput || !heightMmInput || !qtyInput || !unitPriceInput) {
      setError('Please fill in all inputs to calculate glass specification');
      return;
    }

    if (!isWidthMmValid || !isHeightMmValid || !isQtyValid || !isUnitPriceValid) {
      setError('Width, height, quantity, and unit price must be positive numbers');
      return;
    }

    const itemThickness = getThicknessFromDescription(descriptionInput);

    if (editingItemId) {
      // Edit mode: update existing item
      setQuoteItems((prev) =>
        prev.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                description: descriptionInput,
                qty: parsedQty,
                widthMm: parsedWidthMm,
                heightMm: parsedHeightMm,
                areaSqm: calculatedArea,
                unitPrice: parsedUnitPrice,
                amount: calculatedAmount,
                
                // Backward-compatible fields
                glassTypeId: selectedGlassId,
                glassTypeName: descriptionInput,
                length: parsedWidthMm / 1000,
                width: parsedHeightMm / 1000,
                thickness: itemThickness,
                area: calculatedArea,
                price: calculatedAmount,
                quantity: parsedQty
              }
            : item
        )
      );
      
      setVisualizedItem({
        length: parsedWidthMm / 1000,
        width: parsedHeightMm / 1000,
        thickness: itemThickness,
        glassTypeName: descriptionInput,
      } as any);

      setSuccess('Updated quote item successfully!');
      setEditingItemId(null);
    } else {
      // Add mode: append new item
      const nextRef = quoteItems.length > 0 
        ? Math.max(...quoteItems.map(item => (item as any).ref || 0)) + 1 
        : 1;

      const newItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        ref: nextRef,
        description: descriptionInput,
        qty: parsedQty,
        widthMm: parsedWidthMm,
        heightMm: parsedHeightMm,
        areaSqm: calculatedArea,
        unitPrice: parsedUnitPrice,
        amount: calculatedAmount,
        
        // Backward-compatible fields
        glassTypeId: selectedGlassId,
        glassTypeName: descriptionInput,
        length: parsedWidthMm / 1000,
        width: parsedHeightMm / 1000,
        thickness: itemThickness,
        area: calculatedArea,
        price: calculatedAmount,
        quantity: parsedQty
      };

      setQuoteItems((prev) => [...prev, newItem as any]);
      setVisualizedItem({
        length: parsedWidthMm / 1000,
        width: parsedHeightMm / 1000,
        thickness: itemThickness,
        glassTypeName: descriptionInput,
      } as any);

      setSuccess('Added item to current quote calculation!');
    }

    // Reset inputs for next item (except glass selection, description and quantity)
    setWidthMmInput('');
    setHeightMmInput('');
  };

  const handleEditQuoteItem = (item: any) => {
    setEditingItemId(item.id);
    setSelectedGlassId(item.glassTypeId || '');
    setDescriptionInput(item.description || item.glassTypeName || '');
    setQtyInput((item.qty || item.quantity || 1).toString());
    setWidthMmInput((item.widthMm || item.length * 1000).toString());
    setHeightMmInput((item.heightMm || item.width * 1000).toString());
    setUnitPriceInput((item.unitPrice || item.price / item.area || 0).toString());
    
    // Set visualizer
    setVisualizedItem({
      length: item.length,
      width: item.width,
      thickness: item.thickness || 6.0,
      glassTypeName: item.description || item.glassTypeName,
    } as any);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setWidthMmInput('');
    setHeightMmInput('');
    setSuccess('');
    setError('');
  };

  // Handle saving quote
  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    setSaveLoading(true);

    try {
      let payload: any;
      if (quoteItems.length > 0) {
        payload = {
          items: quoteItems.map((item) => ({
            ref: (item as any).ref,
            description: (item as any).description,
            qty: (item as any).qty,
            widthMm: (item as any).widthMm,
            heightMm: (item as any).heightMm,
            areaSqm: (item as any).areaSqm,
            unitPrice: (item as any).unitPrice,
            amount: (item as any).amount,
            thickness: (item as any).thickness || 6.0,
            glass_type_id: (item as any).glassTypeId || null,
            
            // Backward-compatible fields
            length: item.length,
            width: item.width,
            glass_type_name: (item as any).description
          })),
          discount_percentage: finalDiscountPercent,
        };
      } else {
        if (!descriptionInput || !widthMmInput || !heightMmInput || !qtyInput || !unitPriceInput) {
          setError('Please fill in all inputs or add items to the quote list');
          setSaveLoading(false);
          return;
        }

        if (!isWidthMmValid || !isHeightMmValid || !isQtyValid || !isUnitPriceValid) {
          setError('Width, height, quantity, and unit price must be positive numbers');
          setSaveLoading(false);
          return;
        }

        payload = {
          ref: 1,
          description: descriptionInput,
          qty: parsedQty,
          widthMm: parsedWidthMm,
          heightMm: parsedHeightMm,
          areaSqm: calculatedArea,
          unitPrice: parsedUnitPrice,
          amount: calculatedAmount,
          thickness: parsedThickness,
          glass_type_id: selectedGlassId || null,

          // Backward-compatible fields
          length: parsedWidthMm / 1000,
          width: parsedHeightMm / 1000,
          discount_percentage: finalDiscountPercent,
        };
      }

      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save quote');
      }

      setSuccess(quoteItems.length > 0 ? `Saved ${quoteItems.length} quotes successfully!` : 'Quote saved successfully!');
      
      // Reset inputs & list
      setDescriptionInput('');
      setQtyInput('1');
      setWidthMmInput('');
      setHeightMmInput('');
      setUnitPriceInput('');
      setDiscountPercentageInput('');
      setQuoteItems([]);
      setVisualizedItem(null);
      setEditingItemId(null);

      // Refresh quotes list
      const quotesRes = await fetch('/api/quotes', { cache: 'no-store' });
      if (quotesRes.ok) {
        const quotesData = await quotesRes.json();
        setQuotes(quotesData);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving quote';
      setError(errorMsg);
    } finally {
      setSaveLoading(false);
    }
  };

  const addTermsAndConditions = (doc: jsPDF) => {
    doc.addPage();
    
    // Background Banner
    doc.setFillColor(15, 22, 42); // deep navy
    doc.rect(0, 0, 210, 25, 'F');
    
    // Title
    doc.setTextColor(56, 189, 248); // primary light blue
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Terms & Conditions', 15, 16);
    
    doc.setTextColor(30, 41, 59);
    
    let y = 35;
    const margin = 15;
    const width = 180;
    
    const paragraphs = [
      {
        text: "All orders must be fully confirmed by the client before production begins. We will not be held responsible for any errors arising from unverified drawings or specifications.",
        isBold: false
      },
      {
        title: "Payment Terms:",
        text: "(1) For tempered glass production, a payment of 100% of the total amount is required before production. Any refund for order changes shall not exceed 10% of the total amount.\n(2) For aluminum doors and windows orders, a minimum deposit of 60% of the total amount is required upon order confirmation. An additional 20% shall be paid prior to installation, and the remaining 20% balance shall be settled in full upon completion and acceptance of the installation.",
        isBold: false
      },
      {
        title: "Pickup Period:",
        text: "All finished goods must be collected within 7 working days after the pickup notice is issued. Delays may incur additional storage charges.",
        isBold: false
      },
      {
        title: "Product Warranty:",
        text: "(1) Warranty for aluminum profiles (breakage, deformation, paint peeling): 5 years.\n(2) Warranty for hardware accessories, rubber seals, water leakage, and frame tilt: 3 years.\n(3) Glass breakage, normal wear and tear, and damage caused by force majeure are not covered under this warranty.",
        isBold: false
      },
      {
        title: "Glass Processing Accuracy:",
        text: "The dimensional tolerance for all processed glass is +/- 3.0mm. Slight color differences may occur due to material batch or surface treatment. This shall not be considered a defect.",
        isBold: false
      },
      {
        text: "All customized products are non-refundable and non-returnable once production has started.",
        isBold: true
      },
      {
        text: "We are not responsible for any damage during the processing of glass provided by the customer.",
        isBold: true
      }
    ];
    
    paragraphs.forEach((p) => {
      doc.setFontSize(8);
      if (p.title) {
        doc.setFont('Helvetica', 'bold');
        doc.text(p.title, margin, y);
        y += 4.5;
      }
      
      doc.setFont('Helvetica', p.isBold ? 'bold' : 'normal');
      const splitText = doc.splitTextToSize(p.text, width);
      doc.text(splitText, margin, y);
      y += (splitText.length * 4) + 5;
    });
    
    // Signatures (position dynamically based on remaining space, capped to ensure it fits on A4 page)
    y = Math.min(Math.max(y + 12, 230), 255);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y - 5, 195, y - 5);

    doc.setTextColor(30, 41, 59);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CHECK & CONFIRMED BY:', margin, y);
    y += 15;
    doc.text('SIGNATURE:', margin, y);
  };

  // PDF Generation for a saved Quote
  const handleExportPDF = async (quote: Quote) => {
    console.log("handleExportPDF called for quote:", quote);
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
      let logoBase64 = null;
      if (settings?.headerLogo?.url) {
        try {
          logoBase64 = await getBase64ImageFromUrl(settings.headerLogo.url);
        } catch (e) {
          console.error("Failed to load header logo base64:", e);
        }
      }

      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 15, 10, 38, 15);
      } else {
        doc.setTextColor(56, 189, 248); // primary light blue
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(settings?.siteTitle || 'GlassCut Manager', 15, 18);
      }
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.text('GLASS CUTTING PRICE ESTIMATE', 15, 26);
      doc.text('GHS Currency', 170, 18);

      // Metadata Block
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9.5);
      doc.text(`Quote ID: ${quote.id}`, 15, 52);
      doc.text(`Date: ${formatDateTime(quote.created_at)}`, 15, 59);
      doc.text(`Issued By: ${user?.name || 'Staff User'}`, 15, 66);

      // Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 73, 195, 73);

      // Validity & Production Disclaimer
      doc.setTextColor(30, 41, 59);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('• This quotation is valid for 3 days.', 15, 79);
      doc.text('• Estimated production time will be provided following the confirmation of technical drawings, where applicable.', 15, 84);

      let currentY = 107;

      if (quote.items_json) {
        // Render headers for multi-item table
        doc.setFillColor(13, 148, 136); // teal header bar
        doc.rect(15, 89, 180, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('Ref', 17, 95.5);
        doc.text('Description', 26, 95.5);
        doc.text('Qty', 85, 95.5);
        doc.text('Width(mm)', 97, 95.5);
        doc.text('Height(mm)', 118, 95.5);
        doc.text('Unit Price', 141, 95.5);
        doc.text('Area(m²)', 161, 95.5);
        doc.text('Amount', 181, 95.5);

        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        const parsedItems = JSON.parse(quote.items_json);
        parsedItems.forEach((item: any) => {
          doc.text(String(item.ref || 1), 17, currentY);
          const desc = item.description || item.glass_type_name || 'Glass';
          doc.text(desc.length > 27 ? desc.slice(0, 24) + '...' : desc, 26, currentY);
          doc.text(String(item.qty || item.quantity || 1), 85, currentY);
          doc.text(String(item.widthMm || Math.round(item.length * 1000)), 97, currentY);
          doc.text(String(item.heightMm || Math.round(item.width * 1000)), 118, currentY);
          doc.text((item.unitPrice || item.price / item.area || 0).toFixed(2), 141, currentY);
          doc.text((item.areaSqm || item.area || 0).toFixed(4), 161, currentY);
          doc.text(String(item.amount || Math.round(item.price)), 181, currentY);
          
          doc.setDrawColor(241, 245, 249);
          doc.line(15, currentY + 3, 195, currentY + 3);
          currentY += 9;
        });
      } else {
        // Render single-item list in columns
        doc.setFillColor(13, 148, 136); // teal header bar
        doc.rect(15, 89, 180, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('Ref', 17, 95.5);
        doc.text('Description', 26, 95.5);
        doc.text('Qty', 85, 95.5);
        doc.text('Width(mm)', 97, 95.5);
        doc.text('Height(mm)', 118, 95.5);
        doc.text('Unit Price', 141, 95.5);
        doc.text('Area(m²)', 161, 95.5);
        doc.text('Amount', 181, 95.5);

        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(30, 41, 59);

        const widthMm = quote.width ? Math.round(quote.width * 1000) : 0;
        const heightMm = quote.length ? Math.round(quote.length * 1000) : 0;
        const thickness = quote.thickness || 6.0;
        const desc = `${quote.glass_type?.name || 'Glass'} (${thickness.toFixed(1)}mm)`;
        const areaSqm = quote.area || 0;
        const unitPrice = quote.glass_type ? (quote.glass_type.price_per_sqm * thickness) : 0;
        const amount = Math.round(quote.total_price);

        doc.text('1', 17, currentY);
        doc.text(desc.length > 27 ? desc.slice(0, 24) + '...' : desc, 26, currentY);
        doc.text('1', 85, currentY);
        doc.text(String(heightMm), 97, currentY);
        doc.text(String(widthMm), 118, currentY);
        doc.text(unitPrice.toFixed(2), 141, currentY);
        doc.text(areaSqm.toFixed(4), 161, currentY);
        doc.text(String(amount), 181, currentY);

        doc.setDrawColor(241, 245, 249);
        doc.line(15, currentY + 3, 195, currentY + 3);
        currentY += 9;
      }

      // Price Summary Card
      const discountPercentage = (quote as any).discount_percentage || 0;
      if (discountPercentage > 0) {
        const subtotal = quote.total_price / (1 - discountPercentage / 100);
        const discountAmt = subtotal * (discountPercentage / 100);

        doc.setFillColor(240, 253, 250); // light green bg
        doc.rect(15, currentY + 4, 180, 27, 'F');
        doc.setDrawColor(16, 185, 129); // green border
        doc.rect(15, currentY + 4, 180, 27, 'D');

        doc.setTextColor(30, 41, 59); // dark text
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Subtotal:', 22, currentY + 11);
        doc.text(`${subtotal.toFixed(2)} GHS`, 150, currentY + 11);

        doc.setTextColor(185, 28, 28); // red discount text
        doc.text(`Discount (${discountPercentage}%):`, 22, currentY + 17);
        doc.text(`-${discountAmt.toFixed(2)} GHS`, 150, currentY + 17);

        doc.setTextColor(6, 95, 70); // deep green text
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Total Estimated Price:', 22, currentY + 24);
        doc.text(`${quote.total_price.toFixed(2)} GHS`, 150, currentY + 24);
      } else {
        doc.setFillColor(240, 253, 250); // light green bg
        doc.rect(15, currentY + 4, 180, 15, 'F');
        doc.setDrawColor(16, 185, 129); // green border
        doc.rect(15, currentY + 4, 180, 15, 'D');

        doc.setTextColor(6, 95, 70); // deep green text
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Total Estimated Price:', 22, currentY + 13);
        doc.text(`${quote.total_price.toFixed(2)} GHS`, 150, currentY + 13);
      }

      // Footer
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 268, 195, 268);

      let footerLogoBase64 = null;
      if (settings?.footerLogo?.url) {
        try {
          footerLogoBase64 = await getBase64ImageFromUrl(settings.footerLogo.url);
        } catch (e) {
          console.error("Failed to load footer logo base64:", e);
        }
      }

      if (footerLogoBase64) {
        doc.addImage(footerLogoBase64, 'PNG', 15, 270, 26, 10);
      } else {
        doc.setTextColor(30, 41, 59);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(settings?.siteTitle || 'GlassCut Manager', 15, 276);
      }

      doc.setTextColor(100, 116, 139);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Email: ${settings?.email || 'info@glasscutting.com'}  |  Phone: ${settings?.phone || '+233 24 123 4567'}`, 55, 275);
      doc.text(`Address: ${settings?.address || '123 Glass Lane, Industrial Area, Accra, Ghana'}`, 55, 279);

      doc.setTextColor(148, 163, 184);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Thank you for using our glass calculator services. This estimate is valid for 14 days.', 15, 287);

      addTermsAndConditions(doc);
      downloadPDF(doc, `GlassCut_Quote_${quote.id.slice(0, 8)}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
    }
  };

  const handleExportInvoicePDF = async (invoice: Invoice) => {
    console.log("handleExportInvoicePDF called for invoice:", invoice);
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
      let logoBase64 = null;
      if (settings?.headerLogo?.url) {
        try {
          logoBase64 = await getBase64ImageFromUrl(settings.headerLogo.url);
        } catch (e) {
          console.error("Failed to load header logo base64:", e);
        }
      }

      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 15, 10, 38, 15);
      } else {
        doc.setTextColor(56, 189, 248); // primary light blue
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(settings?.siteTitle || 'GlassCut Manager', 15, 18);
      }
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.text('OFFICIAL INVOICE', 15, 26);
      doc.text('GHS Currency', 170, 18);

      // Metadata Block Left
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9.5);
      doc.setFont('Helvetica', 'bold');
      doc.text('INVOICE TO:', 15, 50);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Customer Name: ${invoice.customer.name}`, 15, 56);
      doc.text(`Email: ${invoice.customer.email || 'N/A'}`, 15, 62);
      doc.text(`Phone: ${invoice.customer.phone || 'N/A'}`, 15, 68);

      // Metadata Block Right
      doc.setFont('Helvetica', 'bold');
      doc.text('INVOICE DETAILS:', 120, 50);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Invoice No: ${invoice.invoice_no}`, 120, 56);
      doc.text(`Date Issued: ${new Date(invoice.created_at).toLocaleDateString()}`, 120, 62);
      doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 120, 68);
      doc.text(`Issued By: ${invoice.user?.name || 'Staff'}`, 120, 74);

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

      invoice.line_items.forEach((item, index) => {
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

        const specText = `${item.glass_type.name} (${item.length.toFixed(2)}m x ${item.width.toFixed(2)}m x ${item.thickness.toFixed(1)}mm)`;
        
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
      doc.text(`${invoice.subtotal.toFixed(2)} GHS`, 170, currentY);
      currentY += 6;

      const invoiceDiscountPercent = (invoice as any).discount_percentage || 0;
      if (invoiceDiscountPercent > 0) {
        const discountAmt = invoice.subtotal * (invoiceDiscountPercent / 100);
        doc.setTextColor(185, 28, 28);
        doc.text(`Discount (${invoiceDiscountPercent}%):`, 120, currentY);
        doc.text(`-${discountAmt.toFixed(2)} GHS`, 170, currentY);
        doc.setTextColor(71, 85, 105);
        currentY += 6;
      }

      doc.text('Taxes / Levies:', 120, currentY);
      doc.text(`${invoice.tax.toFixed(2)} GHS`, 170, currentY);
      currentY += 6;

      doc.setFont('Helvetica', 'bold');
      doc.text('Total Amount Due:', 120, currentY);
      doc.text(`${invoice.total_amount.toFixed(2)} GHS`, 170, currentY);
      currentY += 8;

      // Status Badge Banner
      let badgeBg = [254, 242, 242]; // unpaid
      let badgeBorder = [252, 165, 165];
      let badgeText = [185, 28, 28];
      if (invoice.status === 'paid') {
        badgeBg = [240, 253, 250];
        badgeBorder = [16, 185, 129];
        badgeText = [6, 95, 70];
      } else if (invoice.status === 'partially_paid') {
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
      doc.text(`Invoice Status: ${invoice.status.toUpperCase().replace('_', ' ')}`, 22, currentY + 10);
      doc.text(`Balance Due: ${invoice.balance_due.toFixed(2)} GHS`, 120, currentY + 10);

      // Footer
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 268, 195, 268);

      let footerLogoBase64 = null;
      if (settings?.footerLogo?.url) {
        try {
          footerLogoBase64 = await getBase64ImageFromUrl(settings.footerLogo.url);
        } catch (e) {
          console.error("Failed to load footer logo base64:", e);
        }
      }

      if (footerLogoBase64) {
        doc.addImage(footerLogoBase64, 'PNG', 15, 270, 26, 10);
      } else {
        doc.setTextColor(30, 41, 59);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(settings?.siteTitle || 'GlassCut Manager', 15, 276);
      }

      doc.setTextColor(100, 116, 139);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Email: ${settings?.email || 'info@glasscutting.com'}  |  Phone: ${settings?.phone || '+233 24 123 4567'}`, 55, 275);
      doc.text(`Address: ${settings?.address || '123 Glass Lane, Industrial Area, Accra, Ghana'}`, 55, 279);

      doc.setTextColor(148, 163, 184);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('All payments should refer to the Invoice Number above. Payment terms are net due.', 15, 287);

      console.log("PDF data URL prefix:", doc.output('datauristring').substring(0, 150));
      addTermsAndConditions(doc);
      downloadPDF(doc, `GlassCut_Invoice_${invoice.invoice_no}.pdf`);
    } catch (err) {
      console.error('Invoice PDF generation error:', err);
    }
  };

  const handleExportReceiptPDF = async (bill: Bill, invoice: Invoice) => {
    console.log("handleExportReceiptPDF called for bill and invoice:", bill, invoice);
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
      let logoBase64 = null;
      if (settings?.headerLogo?.url) {
        try {
          logoBase64 = await getBase64ImageFromUrl(settings.headerLogo.url);
        } catch (e) {
          console.error("Failed to load header logo base64:", e);
        }
      }

      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 15, 10, 38, 15);
      } else {
        doc.setTextColor(56, 189, 248); // primary light blue
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(settings?.siteTitle || 'GlassCut Manager', 15, 18);
      }
      
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
      doc.text(`Customer Name: ${invoice.customer.name}`, 15, 56);
      doc.text(`Email: ${invoice.customer.email || 'N/A'}`, 15, 62);
      doc.text(`Phone: ${invoice.customer.phone || 'N/A'}`, 15, 68);

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
        invoice.line_items.forEach((item) => {
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
      doc.text(`Receipt Reference: ${bill.receipt_no}`, 120, summaryY + 11);

      // Footer
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 268, 195, 268);

      let footerLogoBase64 = null;
      if (settings?.footerLogo?.url) {
        try {
          footerLogoBase64 = await getBase64ImageFromUrl(settings.footerLogo.url);
        } catch (e) {
          console.error("Failed to load footer logo base64:", e);
        }
      }

      if (footerLogoBase64) {
        doc.addImage(footerLogoBase64, 'PNG', 15, 270, 26, 10);
      } else {
        doc.setTextColor(30, 41, 59);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(settings?.siteTitle || 'GlassCut Manager', 15, 276);
      }

      doc.setTextColor(100, 116, 139);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Email: ${settings?.email || 'info@glasscutting.com'}  |  Phone: ${settings?.phone || '+233 24 123 4567'}`, 55, 275);
      doc.text(`Address: ${settings?.address || '123 Glass Lane, Industrial Area, Accra, Ghana'}`, 55, 279);

      doc.setTextColor(148, 163, 184);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('This is a computer generated payment confirmation statement.', 15, 287);

      downloadPDF(doc, `GlassCut_Receipt_${bill.receipt_no}.pdf`);
    } catch (err) {
      console.error('Receipt PDF generation error:', err);
    }
  };

  // Filter quotes based on search and selected options
  const filteredQuotes = quotes.filter((q) => {
    // 1. Search Query (Glass Type Name or Quote ID)
    const glassNames = q.items_json
      ? JSON.parse(q.items_json).map((item: any) => item.glass_type_name).join(' ')
      : (q.glass_type?.name || '');

    const matchesSearch =
      glassNames.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.id.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Glass Type Option Filter
    let matchesGlass = true;
    if (filterGlassId) {
      if (q.items_json) {
        matchesGlass = JSON.parse(q.items_json).some((item: any) => item.glass_type_id === filterGlassId);
      } else {
        matchesGlass = q.glass_type_id === filterGlassId;
      }
    }

    // 3. Date Filters
    let matchesDate = true;
    const qDate = new Date(q.created_at);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      matchesDate = matchesDate && qDate >= start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && qDate <= end;
    }

    return matchesSearch && matchesGlass && matchesDate;
  });

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className="card-glass" style={{ textAlign: 'center', padding: '40px' }}>
          <div className={styles.spinner}></div>
          <p style={{ marginTop: '16px' }} className="text-muted">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.navBrand}>
          {settings?.headerLogo ? (
            <img 
              src={settings.headerLogo.url} 
              alt={settings.siteTitle || 'Logo'} 
              style={{ 
                height: '32px', 
                maxWidth: '180px', 
                objectFit: 'contain',
                marginRight: '8px'
              }} 
            />
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
              <span className="text-gradient" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                {settings?.siteTitle || 'GlassCut Manager'}
              </span>
            </>
          )}
          <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
            Staff Panel
          </span>
        </div>
        <div className={styles.navUser}>
          <div className={styles.userInfo}>
            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{user?.name}</span>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>{user?.email} ({user?.role})</span>
          </div>
          {(user?.role === 'admin' || user?.role === 'supervisor') && (
            <button 
              type="button"
              className="btn btn-secondary" 
              style={{ padding: '8px 14px', fontSize: '0.85rem', marginRight: '8px' }} 
              onClick={() => router.push('/admin/dashboard')}
            >
              {user.role === 'admin' ? 'Admin Panel' : 'Supervisor Panel'}
            </button>
          )}
          <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container" style={{ marginTop: '32px', paddingBottom: '60px' }}>
        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success" onClick={() => setSuccess('')} style={{ cursor: 'pointer' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <button
            className={`btn ${activeTab === 'calculator' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('calculator'); setError(''); setSuccess(''); }}
          >
            Calculator & Quotes
          </button>
          <button
            className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('invoices'); setError(''); setSuccess(''); loadInvoicesData(); }}
          >
            Invoices & Payments
          </button>
        </div>

        {/* ================= CALCULATOR TAB ================= */}
        {activeTab === 'calculator' && (
          <>
            <div className={styles.gridContainer}>
              {/* Left Side: Calculator Panel */}
              <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Price Calculator</h2>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Enter specifications below to compute prices in real time</p>
                </div>

                <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="glassPreset">Glass Selection Preset</label>
                    <select
                      id="glassPreset"
                      className="form-select"
                      value={selectedGlassId}
                      onChange={(e) => {
                        setSelectedGlassId(e.target.value);
                        setSuccess('');
                      }}
                    >
                      <option value="">-- Custom Description --</option>
                      {glassTypes.map((gt) => (
                        <option key={gt.id} value={gt.id}>
                          {gt.name} ({gt.price_per_sqm.toFixed(2)} GHS/m²)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="description">Description</label>
                    <input
                      type="text"
                      id="description"
                      className="form-input"
                      placeholder="e.g. 6MM CLEAR TEMPERED"
                      value={descriptionInput}
                      onChange={(e) => {
                        setDescriptionInput(e.target.value);
                        setSuccess('');
                      }}
                      required
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" htmlFor="qty">Qty</label>
                      <input
                        type="number"
                        id="qty"
                        min="1"
                        step="1"
                        className="form-input"
                        placeholder="e.g. 8"
                        value={qtyInput}
                        onChange={(e) => {
                          setQtyInput(e.target.value);
                          setSuccess('');
                          setVisualizedItem(null);
                        }}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" htmlFor="widthMm">Width (mm)</label>
                      <input
                        type="number"
                        id="widthMm"
                        min="1"
                        className="form-input"
                        placeholder="e.g. 800"
                        value={widthMmInput}
                        onChange={(e) => {
                          setWidthMmInput(e.target.value);
                          setSuccess('');
                          setVisualizedItem(null);
                        }}
                        required={quoteItems.length === 0}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" htmlFor="heightMm">Height (mm)</label>
                      <input
                        type="number"
                        id="heightMm"
                        min="1"
                        className="form-input"
                        placeholder="e.g. 1255"
                        value={heightMmInput}
                        onChange={(e) => {
                          setHeightMmInput(e.target.value);
                          setSuccess('');
                          setVisualizedItem(null);
                        }}
                        required={quoteItems.length === 0}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" htmlFor="areaSqm">Area (m²)</label>
                      <input
                        type="text"
                        id="areaSqm"
                        className="form-input"
                        value={calculatedArea.toFixed(4)}
                        readOnly
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" htmlFor="unitPrice">Unit Price (GHS per m²)</label>
                      <input
                        type="number"
                        id="unitPrice"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="e.g. 371.02"
                        value={unitPriceInput}
                        onChange={(e) => {
                          setUnitPriceInput(e.target.value);
                          setSuccess('');
                        }}
                        disabled={calculatedArea === 0}
                        required={calculatedArea > 0}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" htmlFor="amount">Amount (GHS)</label>
                      <input
                        type="text"
                        id="amount"
                        className="form-input"
                        value={calculatedAmount.toString()}
                        readOnly
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'not-allowed', fontWeight: 'bold', color: 'var(--primary)' }}
                      />
                    </div>
                  </div>

                  {/* Discount Input for Admin / Supervisor */}
                  {(user?.role === 'admin' || user?.role === 'supervisor') && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="discountPercentage">Discount (%)</label>
                      <input
                        type="number"
                        id="discountPercentage"
                        min="0"
                        max="100"
                        step="0.1"
                        className="form-input"
                        placeholder="e.g. 10"
                        value={discountPercentageInput}
                        onChange={(e) => {
                          setDiscountPercentageInput(e.target.value);
                          setSuccess('');
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button
                      type="button"
                      className={`btn ${editingItemId ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      disabled={!isWidthMmValid || !isHeightMmValid || !isQtyValid || !isUnitPriceValid}
                      onClick={handleAddToQuoteList}
                    >
                      {editingItemId ? 'Update Row' : 'Add to Quote List'}
                    </button>
                    {editingItemId && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </section>

              {/* Right Side: Visualizer Panel */}
              <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '400px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Interactive 3D Blueprint</h2>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Proportional 3D visualization. Click & drag to rotate.</p>
                </div>
                
                <div className={styles.visualizerContainer}>
                  <GlassVisualizer
                    length={visualLength}
                    width={visualWidth}
                    thickness={visualThickness}
                    glassTypeName={visualGlassTypeName}
                  />
                </div>
              </section>
            </div>

            {/* Quotation Builder Table */}
            <section className="card" style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Quotation Table</h2>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Current quote items. Valid for 3 days.</p>
                </div>
                {quoteItems.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', borderColor: 'var(--error)', color: 'var(--error)' }}
                    onClick={() => {
                      setQuoteItems([]);
                      setVisualizedItem(null);
                      setEditingItemId(null);
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {quoteItems.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '12px 8px' }}>Ref</th>
                        <th style={{ textAlign: 'left', padding: '12px 8px' }}>Description</th>
                        <th style={{ textAlign: 'center', padding: '12px 8px' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '12px 8px' }}>Width (mm)</th>
                        <th style={{ textAlign: 'right', padding: '12px 8px' }}>Height (mm)</th>
                        <th style={{ textAlign: 'right', padding: '12px 8px' }}>Unit Price (GHS)</th>
                        <th style={{ textAlign: 'right', padding: '12px 8px' }}>Area (m²)</th>
                        <th style={{ textAlign: 'right', padding: '12px 8px' }}>Amount (GHS)</th>
                        <th style={{ textAlign: 'center', padding: '12px 8px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteItems.map((item, idx) => (
                        <tr 
                          key={item.id} 
                          style={{ 
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' 
                          }}
                        >
                          <td style={{ padding: '12px 8px' }}>{item.ref}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 500 }}>{item.description}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>{item.qty}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>{item.widthMm}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>{item.heightMm}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>{item.unitPrice.toFixed(2)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>{item.areaSqm.toFixed(4)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>{item.amount}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => handleEditQuoteItem(item)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                                onClick={() => {
                                  setQuoteItems((prev) => prev.filter((i) => i.id !== item.id));
                                  if (visualizedItem && (visualizedItem as any).ref === item.ref) {
                                    setVisualizedItem(null);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      
                      {/* Discount and Grand Total rows */}
                      {finalDiscountPercent > 0 && (
                        <tr style={{ borderTop: '2px solid rgba(255,255,255,0.05)' }}>
                          <td colSpan={7} style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>Subtotal:</td>
                          <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>{baseGrandTotal} GHS</td>
                          <td></td>
                        </tr>
                      )}
                      {finalDiscountPercent > 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold', color: 'var(--error)' }}>
                            Discount ({finalDiscountPercent}%):
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold', color: 'var(--error)' }}>
                            -{discountAmountBulk.toFixed(2)} GHS
                          </td>
                          <td></td>
                        </tr>
                      )}
                      <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', fontSize: '1.05rem' }}>
                        <td colSpan={7} style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 'bold' }}>Grand Total:</td>
                        <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 'bold', color: 'var(--primary)' }}>
                          {finalGrandTotal} GHS
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saveLoading}
                      onClick={handleSaveQuote}
                      style={{ padding: '10px 24px' }}
                    >
                      {saveLoading ? 'Saving...' : `Save & Log Quotation (${quoteItems.length} items)`}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <span className="text-muted" style={{ fontSize: '0.9rem' }}>No items added to the quotation yet.</span>
                </div>
              )}
            </section>

            {/* Bottom Section: My Quotes History */}
            <section className="card" style={{ marginTop: '32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.35rem', marginBottom: '4px' }}>My Quotes History</h2>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Audit and manage past cut calculations you generated</p>
              </div>

              {/* Filter Bar */}
              <div className={styles.filterBar}>
                <input
                  type="text"
                  placeholder="Search by glass or ID..."
                  className="form-input"
                  style={{ flex: 2, minWidth: '200px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
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

                <div className={styles.dateInputs}>
                  <input
                    type="date"
                    className="form-input"
                    placeholder="Start"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-muted" style={{ display: 'flex', alignItems: 'center' }}>to</span>
                  <input
                    type="date"
                    className="form-input"
                    placeholder="End"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Quotes Table */}
              {filteredQuotes.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-muted">
                    <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="text-muted" style={{ marginTop: '12px' }}>No quotes found matching search filters.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Quote ID</th>
                        <th>Glass Option</th>
                        <th>Dimensions (L × W × T)</th>
                        <th>Area (m²)</th>
                        <th>Cost (GHS)</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((q) => (
                        <tr key={q.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {formatDate(q.created_at)}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {q.id.slice(0, 8)}
                          </td>
                          <td style={{ fontWeight: 500 }}>
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
                          <td>
                            {(q.area ?? 0).toFixed(2)} m²
                          </td>
                          <td style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            {q.total_price.toFixed(2)} GHS
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {q.line_items && q.line_items.length > 0 ? (
                                <span className="badge badge-success" style={{ padding: '6px 10px', fontSize: '0.75rem', textTransform: 'none' }}>
                                  Invoiced
                                </span>
                              ) : (
                                <span className="badge badge-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', textTransform: 'none', background: 'rgba(148, 163, 184, 0.05)', color: 'var(--text-muted)' }}>
                                  Unconverted
                                </span>
                              )}
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => handleExportPDF(q)}
                              >
                                Save PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* ================= INVOICES TAB ================= */}
        {activeTab === 'invoices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', marginBottom: '4px' }}>Invoices & Ledger Accounts</h2>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Generate invoices from quotes, customize line items, and record client installments</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setCustomerFormOpen(true)}>
                  Add Customer
                </button>
                <button className="btn btn-primary" onClick={() => {
                  setInvoiceFormOpen(true);
                  setCustomLineItems([]);
                }}>
                  Create Invoice
                </button>
              </div>
            </div>

            {/* Sub-tabs to filter between Active Ledger Accounts and Paid Invoices History */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginTop: '-8px' }}>
              <button
                type="button"
                className={`btn ${invoiceViewTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px' }}
                onClick={() => setInvoiceViewTab('active')}
              >
                Outstanding / Active Accounts
              </button>
              <button
                type="button"
                className={`btn ${invoiceViewTab === 'paid' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px' }}
                onClick={() => setInvoiceViewTab('paid')}
              >
                Paid Invoices History
              </button>
            </div>

            {invoicesLoading && invoices.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.spinner}></div>
                <p className="text-muted" style={{ marginTop: '12px' }}>Loading invoices...</p>
              </div>
            ) : invoices.filter((inv) => {
              const isPaid = inv.balance_due <= 0.01 || inv.status === 'paid';
              return invoiceViewTab === 'paid' ? isPaid : !isPaid;
            }).length === 0 ? (
              <div className={styles.emptyState}>
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-muted">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <p className="text-muted" style={{ marginTop: '12px' }}>
                  {invoiceViewTab === 'paid' ? 'No fully paid invoices history found.' : 'No active outstanding invoices found.'}
                </p>
              </div>
            ) : (
              <div className="table-container">

                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Customer Name</th>
                      <th>Issue Date</th>
                      <th>Due Date</th>
                      <th>Dispatch Info</th>
                      <th>Total (GHS)</th>
                      <th>Paid (GHS)</th>
                      <th>Balance (GHS)</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices
                      .filter((inv) => {
                        const isPaid = inv.balance_due <= 0.01 || inv.status === 'paid';
                        return invoiceViewTab === 'paid' ? isPaid : !isPaid;
                      })
                      .map((inv) => {
                      let badgeClass = 'badge-danger';
                      if (inv.status === 'paid') badgeClass = 'badge-success';
                      else if (inv.status === 'partially_paid') badgeClass = 'badge-primary';
                      else if (inv.status === 'ready_for_dispatch') badgeClass = 'badge-primary';
                      else if (inv.status === 'dispatched') badgeClass = 'badge-success';
                      else if (inv.status === 'on_hold_discrepancy') badgeClass = 'badge-danger';
                      
                      const badgeStyle = inv.status === 'partially_paid' ? { background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' } :
                                         inv.status === 'ready_for_dispatch' ? { background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' } :
                                         inv.status === 'dispatched' ? { background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' } :
                                         inv.status === 'on_hold_discrepancy' ? { background: 'rgba(244, 63, 94, 0.1)', color: '#f87171', border: '1px solid rgba(244, 63, 94, 0.2)' } : {};

                      return (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 600 }}>{inv.invoice_no}</td>
                          <td>
                            <span style={{ fontWeight: 500 }}>{inv.customer.name}</span>
                            <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                              {inv.customer.email || 'No Email'}
                            </span>
                          </td>
                          <td>{formatDate(inv.created_at)}</td>
                          <td>{formatDate(inv.due_date)}</td>
                          <td>
                            {inv.driver_name || inv.vehicle_no ? (
                              <div>
                                <span style={{ fontWeight: 500, display: 'block', fontSize: '0.85rem' }}>{inv.driver_name || 'No Driver'}</span>
                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>{inv.vehicle_no || 'No Vehicle'}</span>
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>Not assigned</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>{inv.total_amount.toFixed(2)}</td>
                          <td style={{ color: 'var(--success)' }}>{inv.amount_paid.toFixed(2)}</td>
                          <td style={{ color: inv.balance_due > 0 ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>
                            {inv.balance_due.toFixed(2)}
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`} style={badgeStyle}>
                              {inv.status.split('_').join(' ')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                onClick={() => handleExportInvoicePDF(inv)}
                              >
                                PDF
                              </button>
                              {inv.balance_due > 0.01 && inv.status !== 'cancelled' && (
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    setSelectedInvoice(inv);
                                    setPaymentAmount(inv.balance_due.toFixed(2));
                                    setPaymentFormOpen(true);
                                  }}
                                >
                                  Pay
                                </button>
                              )}
                              {inv.status === 'paid' && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: '0.8rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                  onClick={() => {
                                    setDispatchInvoice(inv);
                                    setDispatchDriverName(inv.driver_name || '');
                                    setDispatchVehicleNo(inv.vehicle_no || '');
                                    setDispatchFormOpen(true);
                                  }}
                                >
                                  Dispatch
                                </button>
                              )}
                              {['paid', 'ready_for_dispatch', 'dispatched'].includes(inv.status) && (
                                <a
                                  href={`/projects/${inv.id}/drawings`}
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: '0.8rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                                >
                                  Drawings
                                </a>
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

            {/* Receipt ledger logs */}
            {invoices.some(inv => inv.bills && inv.bills.length > 0) && (
              <section className="card" style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Recent Installments Receipt History</h3>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Receipt No</th>
                        <th>Invoice Ref</th>
                        <th>Customer</th>
                        <th>Date Paid</th>
                        <th>Method</th>
                        <th>Amount (GHS)</th>
                        <th style={{ textAlign: 'right' }}>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.flatMap(inv => (inv.bills || []).map(bill => ({ bill, inv })))
                        .sort((a, b) => new Date(b.bill.payment_date).getTime() - new Date(a.bill.payment_date).getTime())
                        .slice(0, 15)
                        .map(({ bill, inv }) => (
                          <tr key={bill.id}>
                            <td style={{ fontWeight: 600 }}>{bill.receipt_no}</td>
                            <td>{inv.invoice_no}</td>
                            <td>{inv.customer.name}</td>
                            <td>{formatDate(bill.payment_date)}</td>
                            <td>{bill.payment_method}</td>
                            <td style={{ color: 'var(--success)', fontWeight: 600 }}>{bill.amount_paid.toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                onClick={() => handleExportReceiptPDF(bill, inv)}
                              >
                                PDF Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ================= MODAL DIALOGS ================= */}

      {/* Add Customer Modal */}
      {customerFormOpen && (
        <div className={styles.modalOverlay}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Add Customer Profile</h3>
            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="custName">Customer Name</label>
                <input
                  type="text"
                  id="custName"
                  className="form-input"
                  placeholder="e.g. Acme Corporation"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="custEmail">Email Address</label>
                <input
                  type="email"
                  id="custEmail"
                  className="form-input"
                  placeholder="e.g. billing@acme.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="custPhone">Phone Number</label>
                <input
                  type="text"
                  id="custPhone"
                  className="form-input"
                  placeholder="e.g. +233 244 123456"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Create Profile
                </button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCustomerFormOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {invoiceFormOpen && (
        <div className={styles.modalOverlay}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Generate Customer Invoice</h3>
            
            <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className={styles.formRow} style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" htmlFor="invCustomer">Customer</label>
                  <select
                    id="invCustomer"
                    className="form-select"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone || 'No Phone'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" htmlFor="invDueDate">Due Date</label>
                  <input
                    type="date"
                    id="invDueDate"
                    className="form-input"
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Quotes roll-up */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Roll up Unconverted Quotes</label>
                {quotes.filter(q => !q.line_items || q.line_items.length === 0).length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>No unconverted quotes available.</p>
                ) : (
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {quotes.filter(q => !q.line_items || q.line_items.length === 0).map((q) => (
                      <label key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedQuoteIds.includes(q.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedQuoteIds([...selectedQuoteIds, q.id]);
                            } else {
                              setSelectedQuoteIds(selectedQuoteIds.filter(id => id !== q.id));
                            }
                          }}
                        />
                        <span>
                          Quote #{q.id.slice(0,8)} - {q.items_json ? (
                            <span>Grouped ({JSON.parse(q.items_json).length} items: {Array.from(new Set(JSON.parse(q.items_json).map((item: any) => item.glass_type_name))).join(', ')})</span>
                          ) : (
                            <span>{q.glass_type?.name} ({q.length?.toFixed(2)}m x {q.width?.toFixed(2)}m × {q.thickness?.toFixed(1)}mm)</span>
                          )} - <strong>{q.total_price.toFixed(2)} GHS</strong>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct builder custom lines */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>Direct Line Items</label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => setCustomLineItems([...customLineItems, { glassTypeId: glassTypes[0]?.id || '', length: '', width: '', thickness: '6.0', quantity: '1' }])}
                  >
                    + Add Direct Item
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {customLineItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="form-select"
                        style={{ flex: 2 }}
                        value={item.glassTypeId}
                        onChange={(e) => {
                          const updated = [...customLineItems];
                          updated[idx].glassTypeId = e.target.value;
                          setCustomLineItems(updated);
                        }}
                      >
                        {glassTypes.map((gt) => (
                          <option key={gt.id} value={gt.id}>
                            {gt.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="L (m)"
                        className="form-input"
                        style={{ flex: 1 }}
                        value={item.length}
                        onChange={(e) => {
                          const updated = [...customLineItems];
                          updated[idx].length = e.target.value;
                          setCustomLineItems(updated);
                        }}
                        required
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="W (m)"
                        className="form-input"
                        style={{ flex: 1 }}
                        value={item.width}
                        onChange={(e) => {
                          const updated = [...customLineItems];
                          updated[idx].width = e.target.value;
                          setCustomLineItems(updated);
                        }}
                        required
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Th (mm)"
                        className="form-input"
                        style={{ flex: 1 }}
                        value={item.thickness}
                        onChange={(e) => {
                          const updated = [...customLineItems];
                          updated[idx].thickness = e.target.value;
                          setCustomLineItems(updated);
                        }}
                        required
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        className="form-input"
                        style={{ flex: 1 }}
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...customLineItems];
                          updated[idx].quantity = e.target.value;
                          setCustomLineItems(updated);
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '6px 12px' }}
                        onClick={() => setCustomLineItems(customLineItems.filter((_, i) => i !== idx))}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="invDiscount">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    id="invDiscount"
                    className="form-input"
                    placeholder="e.g. 10"
                    value={invoiceDiscountInput}
                    onChange={(e) => setInvoiceDiscountInput(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="invTax">Taxes / Levies (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  id="invTax"
                  className="form-input"
                  placeholder="e.g. 0.00"
                  value={taxInput}
                  onChange={(e) => setTaxInput(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Generate Invoice
                </button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setInvoiceFormOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentFormOpen && selectedInvoice && (
        <div className={styles.modalOverlay}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Record Payment - {selectedInvoice.invoice_no}</h3>
            
            <div style={{ marginBottom: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', padding: '12px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="text-muted">Total Due:</span>
                <span style={{ fontWeight: 600 }}>{selectedInvoice.total_amount.toFixed(2)} GHS</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="text-muted">Total Paid:</span>
                <span style={{ color: 'var(--success)' }}>{selectedInvoice.amount_paid.toFixed(2)} GHS</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Outstanding Balance:</span>
                <span style={{ color: 'var(--error)', fontWeight: 600 }}>{selectedInvoice.balance_due.toFixed(2)} GHS</span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="payAmount">Amount Paid (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedInvoice.balance_due}
                  id="payAmount"
                  className="form-input"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="payMethod">Payment Method</label>
                <select
                  id="payMethod"
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="Mobile Money">Mobile Money (MoMo)</option>
                  <option value="Card">Credit/Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="payNotes">Payment Notes</label>
                <input
                  type="text"
                  id="payNotes"
                  className="form-input"
                  placeholder="e.g. Cash installment 1"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Confirm Payment
                </button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setPaymentFormOpen(false); setSelectedInvoice(null); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Preparation Modal */}
      {dispatchFormOpen && dispatchInvoice && (
        <div className={styles.modalOverlay}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Prepare Dispatch - {dispatchInvoice.invoice_no}</h3>
            
            <form onSubmit={handleMarkReadyForDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="driverName">Driver Name</label>
                <input
                  type="text"
                  id="driverName"
                  className="form-input"
                  placeholder="e.g. Samuel Amponsah"
                  value={dispatchDriverName}
                  onChange={(e) => setDispatchDriverName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="vehicleNo">Vehicle Reg No</label>
                <input
                  type="text"
                  id="vehicleNo"
                  className="form-input"
                  placeholder="e.g. GR-2023-26"
                  value={dispatchVehicleNo}
                  onChange={(e) => setDispatchVehicleNo(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Confirm Ready
                </button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setDispatchFormOpen(false); setDispatchInvoice(null); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Footer settings={settings} />
    </div>
  );
}
