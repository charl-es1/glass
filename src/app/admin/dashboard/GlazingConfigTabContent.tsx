'use client';

import React, { useState } from 'react';
import {
  addCategory,
  updateCategory,
  deleteCategory,
  forceDeleteCategory,
  addSubType,
  updateSubType,
  deleteSubType,
} from '../glazing-config/actions';

interface SubType {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  defaultWidth: number;
  defaultHeight: number;
  operationalType: 'sliding' | 'hinged' | 'fixed' | 'awning';
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  subtypes: SubType[];
  created_at: string;
}

interface GlazingConfigTabContentProps {
  initialCategories: Category[];
  onCatalogChange: () => Promise<void>;
}

export default function GlazingConfigTabContent({
  initialCategories,
  onCatalogChange,
}: GlazingConfigTabContentProps) {
  const [subTab, setSubTab] = useState<'categories' | 'subtypes'>('categories');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Filter Sub-types by parent category
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');

  // Category Form States
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Sub-Type Form/Modal States
  const [subTypeName, setSubTypeName] = useState('');
  const [subTypeCategoryId, setSubTypeCategoryId] = useState('');
  const [subTypeWidth, setSubTypeWidth] = useState('');
  const [subTypeHeight, setSubTypeHeight] = useState('');
  const [subTypeOpType, setSubTypeOpType] = useState<'sliding' | 'hinged' | 'fixed' | 'awning'>('fixed');
  const [editingSubType, setEditingSubType] = useState<SubType | null>(null);
  const [subTypeModalOpen, setSubTypeModalOpen] = useState(false);

  // Deletion Warnings States
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteType, setPendingDeleteType] = useState<'category' | 'subtype' | null>(null);

  // --- Category Submissions ---
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!categoryName || categoryName.trim() === '') {
      setError('Category name is required.');
      return;
    }

    setActionLoading(true);
    try {
      let result;
      if (editingCategory) {
        result = await updateCategory(editingCategory.id, categoryName);
      } else {
        result = await addCategory(categoryName);
      }

      if (result.success) {
        setSuccess(editingCategory ? 'Category updated successfully!' : 'Category created successfully!');
        setCategoryName('');
        setEditingCategory(null);
        await onCatalogChange();
      } else {
        setError(result.error || 'Failed to submit category.');
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setError('');
    setSuccess('');
  };

  const handleCancelCategoryEdit = () => {
    setEditingCategory(null);
    setCategoryName('');
    setError('');
  };

  const triggerDeleteCategory = async (id: string) => {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const result = await deleteCategory(id);
      if (result.success) {
        setSuccess('Category deleted successfully.');
        await onCatalogChange();
      } else if (result.warning) {
        setDeleteWarning(result.warning);
        setPendingDeleteId(id);
        setPendingDeleteType('category');
      } else {
        setError(result.error || 'Deletion failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during category delete');
    } finally {
      setActionLoading(false);
    }
  };

  // --- Sub-type Submissions ---
  const handleSubTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!subTypeName || subTypeName.trim() === '') {
      setError('Product style name is required.');
      return;
    }
    if (!subTypeCategoryId) {
      setError('Parent category is required.');
      return;
    }

    const widthInt = parseInt(subTypeWidth, 10);
    const heightInt = parseInt(subTypeHeight, 10);

    if (isNaN(widthInt) || widthInt <= 0) {
      setError('Default Width must be a positive whole number (mm).');
      return;
    }
    if (isNaN(heightInt) || heightInt <= 0) {
      setError('Default Height must be a positive whole number (mm).');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        name: subTypeName.trim(),
        categoryId: subTypeCategoryId,
        defaultWidth: widthInt,
        defaultHeight: heightInt,
        operationalType: subTypeOpType,
      };

      let result;
      if (editingSubType) {
        result = await updateSubType(editingSubType.id, payload);
      } else {
        result = await addSubType(payload);
      }

      if (result.success) {
        setSuccess(editingSubType ? 'Product style updated successfully!' : 'Product style created successfully!');
        closeSubTypeModal();
        await onCatalogChange();
      } else {
        setError(result.error || 'Failed to submit product style.');
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openAddSubTypeModal = () => {
    setEditingSubType(null);
    setSubTypeName('');
    setSubTypeCategoryId(initialCategories.length > 0 ? initialCategories[0].id : '');
    setSubTypeWidth('');
    setSubTypeHeight('');
    setSubTypeOpType('fixed');
    setError('');
    setSuccess('');
    setSubTypeModalOpen(true);
  };

  const openEditSubTypeModal = (st: SubType) => {
    setEditingSubType(st);
    setSubTypeName(st.name);
    setSubTypeCategoryId(st.categoryId);
    setSubTypeWidth(st.defaultWidth.toString());
    setSubTypeHeight(st.defaultHeight.toString());
    setSubTypeOpType(st.operationalType);
    setError('');
    setSuccess('');
    setSubTypeModalOpen(true);
  };

  const closeSubTypeModal = () => {
    setSubTypeModalOpen(false);
    setEditingSubType(null);
  };

  const triggerDeleteSubType = async (id: string) => {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const result = await deleteSubType(id, false);
      if (result.success) {
        setSuccess('Product style deleted successfully.');
        await onCatalogChange();
      } else if (result.warning) {
        setDeleteWarning(result.warning);
        setPendingDeleteId(id);
        setPendingDeleteType('subtype');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during product style delete');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId || !pendingDeleteType) return;
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      let result;
      if (pendingDeleteType === 'category') {
        result = await forceDeleteCategory(pendingDeleteId);
      } else {
        result = await deleteSubType(pendingDeleteId, true);
      }

      if (result.success) {
        setSuccess(`${pendingDeleteType === 'category' ? 'Category' : 'Product style'} deleted successfully.`);
        await onCatalogChange();
      } else {
        setError(result.error || 'Failed to complete deletion safety action.');
      }
    } catch (err: any) {
      setError(err.message || 'Error executing safety deletion.');
    } finally {
      setActionLoading(false);
      setDeleteWarning(null);
      setPendingDeleteId(null);
      setPendingDeleteType(null);
    }
  };

  // Filter subtypes
  const activeCategory = initialCategories.find((c) => c.id === filterCategoryId);
  const displayedSubtypes = activeCategory
    ? activeCategory.subtypes
    : initialCategories.flatMap((c) => c.subtypes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Tab Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Glazing Catalog Config</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '4px' }}>
            Manage core glazing categories, style configurations, and default drafting dimensions
          </p>
        </div>
        
        {/* Toggle sub-tabs */}
        <div className="btn-group" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${subTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => { setSubTab('categories'); setError(''); setSuccess(''); }}
          >
            Manage Categories
          </button>
          <button
            type="button"
            className={`btn ${subTab === 'subtypes' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => { setSubTab('subtypes'); setError(''); setSuccess(''); }}
          >
            Manage Sub-Types
          </button>
        </div>
      </div>

      {/* Sub-tab warnings and alerts */}
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>{success}</span>
        </div>
      )}

      {/* VIEW A: CATEGORY CONFIGURATION */}
      {subTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            {/* Form Box */}
            <div className="card-glass" style={{ padding: '24px', height: 'fit-content' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', fontWeight: 600 }}>
                {editingCategory ? 'Edit Category Spec' : 'Add Core Category'}
              </h3>
              <form onSubmit={handleCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="catName">Category Name</label>
                  <input
                    type="text"
                    id="catName"
                    className="form-input"
                    placeholder="e.g. Shower Doors"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '10px' }}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                  </button>
                  {editingCategory && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelCategoryEdit}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List Box */}
            <div className="card-glass" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', fontWeight: 600 }}>Catalog Categories</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 12px' }}>Category Name</th>
                      <th style={{ padding: '8px 12px' }}>Slug Reference</th>
                      <th style={{ padding: '8px 12px' }}>Sub-styles</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialCategories.map((cat) => (
                      <tr key={cat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{cat.name}</td>
                        <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--primary)' }}>{cat.slug}</td>
                        <td style={{ padding: '12px' }}>
                          <span className="badge badge-primary" style={{ padding: '3px 8px' }}>
                            {cat.subtypes?.length || 0} styles
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleEditCategory(cat)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => triggerDeleteCategory(cat.id)}
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

          </div>
        </div>
      )}

      {/* VIEW B: SUB-TYPE CONFIGURATION */}
      {subTab === 'subtypes' && (
        <div className="card-glass" style={{ padding: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <span className="text-muted">Filter Category:</span>
              <select
                className="form-input"
                style={{ padding: '4px 10px', fontSize: '0.8rem', width: 'auto', marginBottom: 0 }}
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
              >
                <option value="all">All Categories</option>
                {initialCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              onClick={openAddSubTypeModal}
            >
              + Create Product Style
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Product Style</th>
                  <th style={{ padding: '8px 12px' }}>Slug Reference</th>
                  <th style={{ padding: '8px 12px' }}>Parent Category</th>
                  <th style={{ padding: '8px 12px' }}>Default Size</th>
                  <th style={{ padding: '8px 12px' }}>Operation</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedSubtypes.map((st) => {
                  const parent = initialCategories.find((c) => c.id === st.categoryId);
                  return (
                    <tr key={st.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{st.name}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.75rem' }}>{st.slug}</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{parent?.name || 'Unknown'}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                        {st.defaultWidth} × {st.defaultHeight} mm
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className="badge" style={{ padding: '2px 6px', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                          {st.operationalType}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => openEditSubTypeModal(st)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => triggerDeleteSubType(st.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {displayedSubtypes.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No design sub-types configured for this category selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT SUB-TYPE MODAL DIALOG --- */}
      {subTypeModalOpen && (
        <div className="fixed inset-0 bg-[#02040a]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <div className="card-glass animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 600 }}>
                {editingSubType ? 'Edit Style Config' : 'Configure Product Style'}
              </h3>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }} 
                onClick={closeSubTypeModal}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubTypeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Sub-Type Style Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Accordion Slide Panel"
                  value={subTypeName}
                  onChange={(e) => setSubTypeName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Parent Category</label>
                <select
                  required
                  className="form-input font-semibold"
                  value={subTypeCategoryId}
                  onChange={(e) => setSubTypeCategoryId(e.target.value)}
                >
                  {initialCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Default Width (mm)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="form-input font-mono"
                    placeholder="1200"
                    value={subTypeWidth}
                    onChange={(e) => setSubTypeWidth(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Default Height (mm)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="form-input font-mono"
                    placeholder="2000"
                    value={subTypeHeight}
                    onChange={(e) => setSubTypeHeight(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Operational indicator rules</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { id: 'fixed', label: 'Fixed Pane' },
                    { id: 'hinged', label: 'Hinged Swing' },
                    { id: 'sliding', label: 'Sliding Track' },
                    { id: 'awning', label: 'Projected / Awning' },
                  ].map((op) => (
                    <label
                      key={op.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px',
                        borderRadius: '8px',
                        border: subTypeOpType === op.id ? '1.5px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                        background: subTypeOpType === op.id ? 'rgba(56, 189, 248, 0.1)' : 'rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: subTypeOpType === op.id ? 'var(--primary)' : 'var(--text-muted)',
                      }}
                    >
                      <input
                        type="radio"
                        name="opType"
                        checked={subTypeOpType === op.id}
                        onChange={() => setSubTypeOpType(op.id as any)}
                        style={{ display: 'none' }}
                      />
                      <span>{op.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  {actionLoading ? 'Saving...' : editingSubType ? 'Update Style' : 'Create Style'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '10px' }}
                  onClick={closeSubTypeModal}
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- DELETION SAFETY WARNING MODAL --- */}
      {deleteWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 1100, padding: '16px' }}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '440px', padding: '24px', border: '1.5px solid var(--error)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--error)' }}>
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Deletion Safety Warning</h3>
            </div>
            
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
              {deleteWarning}
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="btn btn-danger"
                style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              >
                {actionLoading ? 'Deleting...' : 'Bypass Warning & Force Delete'}
              </button>
              <button
                onClick={() => {
                  setDeleteWarning(null);
                  setPendingDeleteId(null);
                  setPendingDeleteType(null);
                }}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              >
                Cancel Deletion
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
