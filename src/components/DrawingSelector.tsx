'use client';

import React from 'react';

export interface ProductType {
  id: string;
  name: string;
  defaultWidth: number; // in mm
  defaultHeight: number; // in mm
}

export interface ProductCategory {
  id: string;
  name: string;
  types: ProductType[];
}

export const PRODUCT_CATALOG: ProductCategory[] = [
  {
    id: 'windows',
    name: 'Window Systems',
    types: [
      { id: 'casement_window', name: 'Casement Window', defaultWidth: 800, defaultHeight: 1200 },
      { id: 'awning_window', name: 'Projected / Awning Window', defaultWidth: 1000, defaultHeight: 800 },
      { id: 'tilt_turn_window', name: 'Tilt and Turn Window', defaultWidth: 900, defaultHeight: 1300 },
      { id: 'fanlight_window', name: 'Fanlight Window (Fixed)', defaultWidth: 1200, defaultHeight: 600 },
      { id: 'sliding_window', name: 'Sliding Window', defaultWidth: 1500, defaultHeight: 1200 },
      { id: 'double_casement_window', name: '2-Opening Casement Window', defaultWidth: 1600, defaultHeight: 1200 },
    ],
  },
  {
    id: 'doors',
    name: 'Door Systems',
    types: [
      { id: 'single_hinged_door', name: 'Single Hinged Entry Door', defaultWidth: 900, defaultHeight: 2100 },
      { id: 'double_french_door', name: 'Double French Door', defaultWidth: 1800, defaultHeight: 2100 },
      { id: 'sliding_patio_door', name: 'Sliding Patio Door (Double Slider)', defaultWidth: 3300, defaultHeight: 2790 },
      { id: 'door_sidelite', name: 'Hinged Door with Fixed Sidelite', defaultWidth: 1350, defaultHeight: 2200 },
      { id: 'bifold_door', name: 'Bi-Folding Door System', defaultWidth: 3000, defaultHeight: 2400 },
    ],
  },
  {
    id: 'showers',
    name: 'Bathroom & Shower Glass',
    types: [
      { id: 'fixed_shower_screen', name: 'Fixed Walk-in Glass Screen', defaultWidth: 1000, defaultHeight: 2000 },
      { id: 'inline_shower_door', name: 'Hinged Shower Door (Inline Setup)', defaultWidth: 1200, defaultHeight: 2000 },
      { id: 'sliding_shower_enclosure', name: 'Sliding / Bypass Shower Enclosure', defaultWidth: 1500, defaultHeight: 2000 },
      { id: 'corner_shower_enclosure', name: '90-Degree Corner Enclosure', defaultWidth: 1200, defaultHeight: 2000 },
    ],
  },
];

interface DrawingSelectorProps {
  category: string;
  subType: string;
  width: number;
  height: number;
  theme: 'classic' | 'blueprint' | 'dark';
  catalog?: ProductCategory[];
  disabledDimensions?: boolean;
  onChangeCategory: (cat: string) => void;
  onChangeSubType: (type: string) => void;
  onChangeWidth: (w: number) => void;
  onChangeHeight: (h: number) => void;
  onChangeTheme: (theme: 'classic' | 'blueprint' | 'dark') => void;
}

export default function DrawingSelector({
  category,
  subType,
  width,
  height,
  theme,
  catalog,
  disabledDimensions = false,
  onChangeCategory,
  onChangeSubType,
  onChangeWidth,
  onChangeHeight,
  onChangeTheme,
}: DrawingSelectorProps) {
  const activeCatalog = catalog ?? PRODUCT_CATALOG;

  // Find current category catalog
  const currentCategory = activeCatalog.find((c) => c.id === category) || activeCatalog[0] || { id: '', name: '', types: [] };

  // Handle Category Change -> Update Category, reset SubType to first option of new category and apply default dimensions
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCatId = e.target.value;
    const cat = activeCatalog.find((c) => c.id === newCatId);
    if (cat && cat.types.length > 0) {
      const firstType = cat.types[0];
      onChangeCategory(newCatId);
      onChangeSubType(firstType.id);
      onChangeWidth(firstType.defaultWidth);
      onChangeHeight(firstType.defaultHeight);
    }
  };

  // Handle Sub-type Change -> Update SubType and apply default dimensions
  const handleSubTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTypeId = e.target.value;
    const type = currentCategory.types.find((t) => t.id === newTypeId);
    if (type) {
      onChangeSubType(newTypeId);
      onChangeWidth(type.defaultWidth);
      onChangeHeight(type.defaultHeight);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Cascading Selector Panel */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          Product Catalog
        </h3>
        
        {/* Category Dropdown */}
        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Product Category</label>
          <select
            className="form-select"
            value={category}
            onChange={handleCategoryChange}
            style={{ padding: '8px 12px', fontSize: '0.875rem' }}
          >
            {activeCatalog.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sub-Type Dropdown */}
        <div className="form-group" style={{ marginBottom: '4px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Design Style (Type)</label>
          <select
            className="form-select"
            value={subType}
            onChange={handleSubTypeChange}
            style={{ padding: '8px 12px', fontSize: '0.875rem' }}
          >
            {currentCategory.types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Physical Dimensions Config Panel */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          Dimensions Spec
        </h3>
        <div className="form-group" style={{ marginBottom: '12px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Width (mm)</label>
          <input
            type="number"
            className="form-input"
            value={width}
            disabled={disabledDimensions}
            onChange={(e) => onChangeWidth(Math.max(100, parseInt(e.target.value) || 0))}
            style={{
              padding: '6px 10px',
              fontSize: '0.9rem',
              opacity: disabledDimensions ? 0.65 : 1,
              cursor: disabledDimensions ? 'not-allowed' : 'auto',
              backgroundColor: disabledDimensions ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
            }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: '4px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Height (mm)</label>
          <input
            type="number"
            className="form-input"
            value={height}
            disabled={disabledDimensions}
            onChange={(e) => onChangeHeight(Math.max(100, parseInt(e.target.value) || 0))}
            style={{
              padding: '6px 10px',
              fontSize: '0.9rem',
              opacity: disabledDimensions ? 0.65 : 1,
              cursor: disabledDimensions ? 'not-allowed' : 'auto',
              backgroundColor: disabledDimensions ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
            }}
          />
        </div>
        {disabledDimensions && (
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '12px', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 500 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Locked to Paid Specifications
          </div>
        )}
      </div>

      {/* 3. Theme Selector Panel */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          Visual Workspace Theme
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'classic', name: 'Classic Shop Drawing' },
            { id: 'blueprint', name: 'Architect Blueprint' },
            { id: 'dark', name: 'Steel Dark Mode' },
          ].map((th) => (
            <button
              key={th.id}
              className={`btn ${theme === th.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                justifyContent: 'flex-start',
                fontSize: '0.825rem',
                padding: '8px 12px',
                borderRadius: '6px',
              }}
              onClick={() => onChangeTheme(th.id as 'classic' | 'blueprint' | 'dark')}
            >
              {th.name}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
