'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';

// Country list populated according to ISO 3166-1
const COUNTRIES = [
  { code: 'GH', name: 'Ghana' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KE', name: 'Kenya' },
  { code: 'IN', name: 'India' },
];

interface LogoDetails {
  url: string;
  storagePath: string;
  width: number;
  height: number;
}

interface SystemSettings {
  siteTitle: string;
  email: string;
  phone: string;
  country: string;
  defaultLanguage: string;
  address: string;
  headerLogo: LogoDetails | null;
  footerLogo: LogoDetails | null;
  favicon: LogoDetails | null;
}

interface SystemSettingsTabContentProps {
  onSettingsUpdated?: () => void;
}

export default function SystemSettingsTabContent({ onSettingsUpdated }: SystemSettingsTabContentProps) {
  // DB States
  const [initialSettings, setInitialSettings] = useState<SystemSettings | null>(null);
  const [formData, setFormData] = useState<SystemSettings>({
    siteTitle: '',
    email: '',
    phone: '',
    country: 'GH - Ghana',
    defaultLanguage: 'en',
    address: '',
    headerLogo: null,
    footerLogo: null,
    favicon: null,
  });

  // UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<Record<string, string>>({});

  // File Upload states
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
  
  // Drag overlays
  const [dragOverField, setDragOverField] = useState<string | null>(null);

  // Input refs
  const headerLogoRef = useRef<HTMLInputElement>(null);
  const footerLogoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  // Fetch settings on load
  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        // Extract fields matching the schema
        const cleanSettings: SystemSettings = {
          siteTitle: data.siteTitle || '',
          email: data.email || '',
          phone: data.phone || '',
          country: data.country || 'GH - Ghana',
          defaultLanguage: data.defaultLanguage || 'en',
          address: data.address || '',
          headerLogo: data.headerLogo || null,
          footerLogo: data.footerLogo || null,
          favicon: data.favicon || null,
        };
        setInitialSettings(cleanSettings);
        setFormData(cleanSettings);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to fetch settings');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while loading settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Track if state is dirty
  const isDirty = initialSettings ? JSON.stringify(initialSettings) !== JSON.stringify(formData) : false;

  // Handle Input Changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent, field: string) => {
    e.preventDefault();
    setDragOverField(field);
  };

  const handleDragLeave = () => {
    setDragOverField(null);
  };

  const handleDrop = (e: React.DragEvent, field: string) => {
    e.preventDefault();
    setDragOverField(null);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFileUpload(files[0], field);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFileUpload(files[0], field);
    }
  };

  // Client Side File Validation and Upload logic
  const processFileUpload = async (file: File, field: string) => {
    setUploadingField(field);
    setWarningMsg((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });

    const isFavicon = field === 'favicon';
    const fileSize = file.size;
    const fileType = file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();

    // 1. Client-side Validation checks
    if (isFavicon) {
      // Favicon: Max 512KB, PNG/ICO/SVG
      const allowedExtensions = ['png', 'ico', 'svg'];
      const allowedTypes = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];
      
      if (!allowedTypes.includes(fileType) && !allowedExtensions.includes(ext || '')) {
        setError('Favicon must be of format PNG, ICO, or SVG.');
        setUploadingField(null);
        return;
      }
      if (fileSize > 512 * 1024) {
        setError('Favicon size must be less than 512KB.');
        setUploadingField(null);
        return;
      }
    } else {
      // Logos: Max 2MB, PNG/JPG/SVG/WebP
      const allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
      const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
      
      if (!allowedTypes.includes(fileType) && !allowedExtensions.includes(ext || '')) {
        setError('Logo must be of format PNG, JPG, SVG, or WebP.');
        setUploadingField(null);
        return;
      }
      if (fileSize > 2 * 1024 * 1024) {
        setError('Logo size must be less than 2MB.');
        setUploadingField(null);
        return;
      }
    }

    // 2. Aspect Ratio Warning (Check image dimensions using URL object)
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      
      const dimensionsPromise = new Promise<{ w: number; h: number }>((resolve) => {
        img.onload = () => resolve({ w: img.width, h: img.height });
        img.src = url;
      });

      const dims = await dimensionsPromise;
      URL.revokeObjectURL(url);

      if (isFavicon) {
        if (dims.w !== 16 || dims.h !== 16) {
          setWarningMsg((prev) => ({
            ...prev,
            [field]: `Recommendation warning: Favicon is ${dims.w}x${dims.h}px. Recommended size is 16x16px for optimal browser display.`
          }));
        }
      } else {
        const targetAspect = 230 / 90;
        const currentAspect = dims.w / dims.h;
        if (Math.abs(currentAspect - targetAspect) > 0.1) {
          setWarningMsg((prev) => ({
            ...prev,
            [field]: `Aspect ratio warning: Aspect ratio of uploaded image (${dims.w}x${dims.h}px) differs significantly from recommended 230:90.`
          }));
        }
      }

      // 3. Perform backend API upload
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('field', field);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (res.ok) {
        const uploadResult = await res.json();
        
        // Track the old file for pending deletion on successful save
        const previousFile = formData[field as keyof SystemSettings] as LogoDetails | null;
        if (previousFile?.storagePath) {
          setPendingDeletes((prev) => [...prev, previousFile.storagePath]);
        }

        setFormData((prev) => ({
          ...prev,
          [field]: {
            url: uploadResult.url,
            storagePath: uploadResult.storagePath,
            width: isFavicon ? 16 : 230,
            height: isFavicon ? 16 : 90,
          },
        }));
        setSuccess('File uploaded successfully! Remember to save changes.');
      } else {
        const errData = await res.json();
        setError(errData.error || 'File upload failed on the server.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during file upload handling.');
    } finally {
      setUploadingField(null);
    }
  };

  // Remove logo handler
  const handleRemoveFile = (field: string) => {
    const currentFile = formData[field as keyof SystemSettings] as LogoDetails | null;
    if (currentFile?.storagePath) {
      setPendingDeletes((prev) => [...prev, currentFile.storagePath]);
    }
    
    setFormData((prev) => ({
      ...prev,
      [field]: null,
    }));
    
    setWarningMsg((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });

    setSuccess('Image removed from form. Save to apply.');
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSuccess(null);

    // Simple client validation before sending
    if (!formData.siteTitle || formData.siteTitle.trim().length < 3) {
      setFieldErrors({ siteTitle: ['Site Title must be at least 3 characters'] });
      setSaving(false);
      return;
    }
    if (!formData.email) {
      setFieldErrors({ email: ['Email is required'] });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updated = await res.json();
        setInitialSettings(updated);
        setFormData(updated);
        setSuccess('System settings updated successfully across the platform!');
        
        // Settings successfully saved, delete old orphaned files from S3/disk
        if (pendingDeletes.length > 0) {
          for (const pathToDelete of pendingDeletes) {
            try {
              await fetch('/api/upload', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storagePath: pathToDelete }),
              });
            } catch (err) {
              console.error('Failed to clean up file:', pathToDelete, err);
            }
          }
          setPendingDeletes([]);
        }

        // Notify parent if relevant
        if (onSettingsUpdated) {
          onSettingsUpdated();
        }
      } else {
        const errData = await res.json();
        if (errData.details) {
          setFieldErrors(errData.details);
          setError('Validation failure: Please check your input fields.');
        } else {
          setError(errData.error || 'Failed to save settings.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while saving system settings.');
    } finally {
      setSaving(false);
    }
  };

  // Reset to last saved state
  const handleReset = () => {
    if (initialSettings) {
      setFormData(initialSettings);
      setSuccess('Restored form contents to last saved state.');
      setError(null);
      setFieldErrors({});
      setWarningMsg({});
      
      // Clean up uploads that were done in this session but discarded
      // For simplicity, we can let user know
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Fetching dynamic system configurations...</p>
        <style jsx global>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Notifications */}
      {error && (
        <div className="alert alert-error" style={{ margin: 0 }}>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ margin: 0 }}>
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}>
          {/* LEFT COLUMN: Logo & Favicon Uploads */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>System Brand Identity</h3>
              
              {/* 1. Header Logo Upload */}
              <div className="form-group" style={{ margin: 0 }}>
                <span className="form-label">Header Logo (Recommended: 230x90px)</span>
                
                <div 
                  onDragOver={(e) => handleDragOver(e, 'headerLogo')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'headerLogo')}
                  style={{
                    border: `2px dashed ${dragOverField === 'headerLogo' ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    backgroundColor: dragOverField === 'headerLogo' ? 'rgba(56, 189, 248, 0.05)' : 'rgba(7, 11, 25, 0.25)',
                    transition: 'var(--transition)',
                    minHeight: '140px',
                  }}
                >
                  {formData.headerLogo ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        border: '1px solid var(--border)', 
                        borderRadius: 'var(--radius-sm)', 
                        padding: '8px', 
                        backgroundColor: '#fff', 
                        width: '230px', 
                        height: '90px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img 
                          src={formData.headerLogo.url} 
                          alt="Header Logo Preview" 
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => headerLogoRef.current?.click()}
                          disabled={uploadingField !== null || saving}
                        >
                          Replace Logo
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-danger" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleRemoveFile('headerLogo')}
                          disabled={uploadingField !== null || saving}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                      </svg>
                      <p style={{ fontSize: '0.85rem' }}>Drag & drop or <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }} onClick={() => headerLogoRef.current?.click()}>Browse</span> to upload header logo</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supported: PNG, JPG, SVG, WebP (Max 2MB)</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={headerLogoRef}
                    style={{ display: 'none' }} 
                    accept=".png,.jpg,.jpeg,.svg,.webp"
                    onChange={(e) => handleFileChange(e, 'headerLogo')}
                  />
                </div>
                {uploadingField === 'headerLogo' && <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px' }}>Uploading...</p>}
                {warningMsg.headerLogo && <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '4px' }}>{warningMsg.headerLogo}</p>}
              </div>

              {/* 2. Footer Logo Upload */}
              <div className="form-group" style={{ margin: 0 }}>
                <span className="form-label">Footer Logo (Recommended: 230x90px)</span>
                
                <div 
                  onDragOver={(e) => handleDragOver(e, 'footerLogo')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'footerLogo')}
                  style={{
                    border: `2px dashed ${dragOverField === 'footerLogo' ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    backgroundColor: dragOverField === 'footerLogo' ? 'rgba(56, 189, 248, 0.05)' : 'rgba(7, 11, 25, 0.25)',
                    transition: 'var(--transition)',
                    minHeight: '140px',
                  }}
                >
                  {formData.footerLogo ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        border: '1px solid var(--border)', 
                        borderRadius: 'var(--radius-sm)', 
                        padding: '8px', 
                        backgroundColor: '#fff', 
                        width: '230px', 
                        height: '90px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img 
                          src={formData.footerLogo.url} 
                          alt="Footer Logo Preview" 
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => footerLogoRef.current?.click()}
                          disabled={uploadingField !== null || saving}
                        >
                          Replace Logo
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-danger" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleRemoveFile('footerLogo')}
                          disabled={uploadingField !== null || saving}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                      </svg>
                      <p style={{ fontSize: '0.85rem' }}>Drag & drop or <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }} onClick={() => footerLogoRef.current?.click()}>Browse</span> to upload footer logo</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supported: PNG, JPG, SVG, WebP (Max 2MB)</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={footerLogoRef}
                    style={{ display: 'none' }} 
                    accept=".png,.jpg,.jpeg,.svg,.webp"
                    onChange={(e) => handleFileChange(e, 'footerLogo')}
                  />
                </div>
                {uploadingField === 'footerLogo' && <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px' }}>Uploading...</p>}
                {warningMsg.footerLogo && <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '4px' }}>{warningMsg.footerLogo}</p>}
              </div>

              {/* 3. Favicon Upload */}
              <div className="form-group" style={{ margin: 0 }}>
                <span className="form-label">Tab Favicon (Recommended: 16x16px)</span>
                
                <div 
                  onDragOver={(e) => handleDragOver(e, 'favicon')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'favicon')}
                  style={{
                    border: `2px dashed ${dragOverField === 'favicon' ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    backgroundColor: dragOverField === 'favicon' ? 'rgba(56, 189, 248, 0.05)' : 'rgba(7, 11, 25, 0.25)',
                    transition: 'var(--transition)',
                    minHeight: '110px',
                  }}
                >
                  {formData.favicon ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ 
                        border: '1px solid var(--border)', 
                        borderRadius: 'var(--radius-sm)', 
                        padding: '12px', 
                        backgroundColor: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <img 
                          src={formData.favicon.url} 
                          alt="Favicon Preview" 
                          style={{ width: '16px', height: '16px', objectFit: 'contain' }} 
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>16x16 Pixel Scale</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => faviconRef.current?.click()}
                            disabled={uploadingField !== null || saving}
                          >
                            Replace
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-danger" 
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => handleRemoveFile('favicon')}
                            disabled={uploadingField !== null || saving}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.85rem' }}>Drag & drop or <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }} onClick={() => faviconRef.current?.click()}>Browse</span> to upload favicon</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accepted: PNG, ICO, SVG (Max 512KB)</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={faviconRef}
                    style={{ display: 'none' }} 
                    accept=".png,.ico,.svg"
                    onChange={(e) => handleFileChange(e, 'favicon')}
                  />
                </div>
                {uploadingField === 'favicon' && <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px' }}>Uploading...</p>}
                {warningMsg.favicon && <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '4px' }}>{warningMsg.favicon}</p>}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Settings Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>System Configurations</h3>
              
              {/* Branding Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 500 }}>Branding</h4>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="siteTitle">Site Title *</label>
                  <input
                    type="text"
                    id="siteTitle"
                    name="siteTitle"
                    className="form-input"
                    placeholder="e.g. GlassCut Manager"
                    value={formData.siteTitle}
                    onChange={handleInputChange}
                    required
                  />
                  {fieldErrors.siteTitle && (
                    <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.siteTitle[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* Contact Info Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 500 }}>Contact Details</h4>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="email">Public Contact Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="form-input"
                    placeholder="e.g. info@glasscutting.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                  {fieldErrors.email && (
                    <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.email[0]}
                    </span>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="phone">International Contact Phone *</label>
                  <input
                    type="text"
                    id="phone"
                    name="phone"
                    className="form-input"
                    placeholder="e.g. +233 24 123 4567"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                  />
                  {fieldErrors.phone && (
                    <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.phone[0]}
                    </span>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="country">Country *</label>
                  <select
                    id="country"
                    name="country"
                    className="form-select"
                    value={formData.country}
                    onChange={handleInputChange}
                    required
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={`${c.code} - ${c.name}`}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  {fieldErrors.country && (
                    <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.country[0]}
                    </span>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="address">Official Site Address *</label>
                  <textarea
                    id="address"
                    name="address"
                    className="form-input"
                    rows={4}
                    style={{ resize: 'vertical', minHeight: '80px' }}
                    placeholder="e.g. 123 Glass Lane, Industrial Area, Accra, Ghana"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                  />
                  {fieldErrors.address && (
                    <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.address[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* Localization Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 500 }}>Localization</h4>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="defaultLanguage">System Default Language *</label>
                  <select
                    id="defaultLanguage"
                    name="defaultLanguage"
                    className="form-select"
                    value={formData.defaultLanguage}
                    onChange={handleInputChange}
                    required
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.defaultLanguage && (
                    <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.defaultLanguage[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons Pane */}
        <div className="card" style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={!isDirty || saving || uploadingField !== null}
          >
            Reset to Last Saved
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isDirty || saving || uploadingField !== null}
          >
            {saving ? 'Saving System Settings...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
