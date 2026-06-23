'use client';

import React from 'react';

export interface GlazingDrawingCanvasProps {
  category: string;
  subType: string;
  width: number;  // overall width in mm
  height: number; // overall height in mm
  theme?: 'classic' | 'blueprint' | 'dark';
}

export default function GlazingDrawingCanvas({
  category,
  subType,
  width,
  height,
  theme = 'classic',
}: GlazingDrawingCanvasProps) {
  // SVG viewport
  const svgWidth = 800;
  const svgHeight = 550;
  
  const margin = 80;
  const drawWidth = svgWidth - margin * 2;
  const drawHeight = svgHeight - margin * 2;

  // Determine if it is shower glass (which gets a minimalist low-iron style)
  const isShower = category === 'showers';

  // 1. Theme configuration
  const themes = {
    classic: {
      bg: '#ffffff',
      frameFill: 'none',
      glassCyanGradStart: '#e0f7fa',
      glassCyanGradEnd: '#b2ebf2',
      glassMintGradStart: '#e2f1ed',
      glassMintGradEnd: '#b2dfdb',
      glassOpacity: 0.18,
      frameStroke: '#334155', // Charcoal steel
      frameStrokeWidth: isShower ? 2 : 10,
      mullionStrokeWidth: isShower ? 1.5 : 6,
      sashStroke: isShower ? '#94a3b8' : '#475569',
      sashStrokeWidth: isShower ? 1.5 : 3.5,
      dimensionLine: '#0f172a',
      dimensionText: '#0f172a',
      extensionLine: '#94a3b8',
      arrowStroke: '#f97316', // Orange
      swingStroke: '#64748b', // Dotted gray
      hardwareColor: '#475569', // Dark steel gray
      hardwareHighlight: '#94a3b8',
      wallLineColor: '#cbd5e1',
    },
    blueprint: {
      bg: '#0b2447',
      glassCyanGradStart: '#19376d',
      glassCyanGradEnd: '#576cbc',
      glassMintGradStart: '#115e59',
      glassMintGradEnd: '#0f766e',
      glassOpacity: 0.45,
      frameFill: 'none',
      frameStroke: '#ffffff',
      frameStrokeWidth: isShower ? 1.8 : 8,
      mullionStrokeWidth: isShower ? 1.2 : 5,
      sashStroke: '#38bdf8',
      sashStrokeWidth: isShower ? 1.2 : 2.5,
      dimensionLine: '#38bdf8',
      dimensionText: '#ffffff',
      extensionLine: '#1d4ed8',
      arrowStroke: '#facc15', // Yellow
      swingStroke: '#38bdf8',
      hardwareColor: '#93c5fd', // White/blue
      hardwareHighlight: '#ffffff',
      wallLineColor: '#1e3a8a',
    },
    dark: {
      bg: '#0f172a',
      glassCyanGradStart: '#1e293b',
      glassCyanGradEnd: '#334155',
      glassMintGradStart: '#0f2d2a',
      glassMintGradEnd: '#1e3f3b',
      glassOpacity: 0.5,
      frameFill: 'none',
      frameStroke: '#94a3b8',
      frameStrokeWidth: isShower ? 2 : 9,
      mullionStrokeWidth: isShower ? 1.5 : 5,
      sashStroke: '#64748b',
      sashStrokeWidth: isShower ? 1.5 : 2.5,
      dimensionLine: '#f1f5f9',
      dimensionText: '#f1f5f9',
      extensionLine: '#475569',
      arrowStroke: '#f97316',
      swingStroke: '#94a3b8',
      hardwareColor: '#64748b',
      hardwareHighlight: '#94a3b8',
      wallLineColor: '#1e293b',
    },
  }[theme];

  // 2. Physical aspect scaling
  // Note: Corner shower is handled in a custom 3D isometric projection inside the component.
  const isCornerEnclosure = subType === 'corner_shower_enclosure';

  const scaleX = drawWidth / width;
  const scaleY = drawHeight / height;
  const scale = Math.min(scaleX, scaleY);

  const finalDrawWidth = width * scale;
  const finalDrawHeight = height * scale;

  const startX = margin + (drawWidth - finalDrawWidth) / 2;
  const startY = margin + (drawHeight - finalDrawHeight) / 2;
  const endX = startX + finalDrawWidth;
  const endY = startY + finalDrawHeight;

  const midX = startX + finalDrawWidth / 2;
  const midY = startY + finalDrawHeight / 2;

  // 3. Sub-splits lists for inner dimension lines (horizontal and vertical splits)
  const vertSplits: number[] = [0];
  const horizSplits: number[] = [0];

  // Configure splits based on subType
  if (subType === 'sliding_window' || subType === 'double_casement_window' || subType === 'sliding_patio_door') {
    vertSplits.push(width / 2, width);
  } else if (subType === 'double_french_door') {
    vertSplits.push(width / 2, width);
  } else if (subType === 'door_sidelite') {
    const doorW = 850;
    vertSplits.push(doorW, width);
  } else if (subType === 'bifold_door') {
    vertSplits.push(width / 3, (width * 2) / 3, width);
  } else if (subType === 'double_casement_window') {
    vertSplits.push(width / 2, width);
  } else if (subType === 'fixed_casement' || subType === 'fc_right') {
    const leftW = Math.max(100, width - 595);
    vertSplits.push(leftW, width);
    horizSplits.push(700, height - 700, height);
  } else if (subType === 'multi_lite') {
    const col1W = 830;
    const col2W = (width - col1W) / 2;
    vertSplits.push(col1W, col1W + col2W, width);
    horizSplits.push(700, height - 700, height);
  } else if (subType === 'inline_shower_door') {
    // Left fixed panel (e.g. 400), Right hinged door (e.g. balance)
    const fixedPanelW = Math.min(width * 0.35, 400);
    vertSplits.push(fixedPanelW, width);
  } else if (subType === 'sliding_shower_enclosure') {
    vertSplits.push(width / 2, width);
  } else {
    // Single panels
    vertSplits.push(width);
  }

  // Ensure unique sorted splits
  const uniqueVertSplits = Array.from(new Set(vertSplits)).sort((a, b) => a - b);
  const uniqueHorizSplits = Array.from(new Set(horizSplits)).sort((a, b) => a - b);

  // Architectural tick marks
  const drawTick = (x: number, y: number) => {
    return (
      <line
        key={`tick-${x}-${y}`}
        x1={x - 4}
        y1={y + 4}
        x2={x + 4}
        y2={y - 4}
        stroke={themes.dimensionLine}
        strokeWidth="1.8"
      />
    );
  };

  // Operational Arrow drawing helper
  const drawArrow = (x: number, y: number, length: number, direction: 'left' | 'right') => {
    const head = 6;
    const halfLen = length / 2;
    const arrowXStart = direction === 'left' ? x + halfLen : x - halfLen;
    const arrowXEnd = direction === 'left' ? x - halfLen : x + halfLen;
    return (
      <g stroke={themes.arrowStroke} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" key={`arrow-${x}-${y}`}>
        <line x1={arrowXStart} y1={y} x2={arrowXEnd} y2={y} />
        {direction === 'left' ? (
          <polyline points={`${arrowXEnd + head},${y - 5} ${arrowXEnd},${y} ${arrowXEnd + head},${y + 5}`} />
        ) : (
          <polyline points={`${arrowXEnd - head},${y - 5} ${arrowXEnd},${y} ${arrowXEnd - head},${y + 5}`} />
        )}
      </g>
    );
  };

  // Glass reflections
  const renderReflections = (x: number, y: number, w: number, h: number) => {
    return (
      <g key={`refl-${x}-${y}`}>
        <line x1={x + 10} y1={y + h - 20} x2={x + w - 20} y2={y + 10} stroke="#ffffff" strokeWidth="0.8" strokeDasharray="15,12,5,10" opacity="0.15" />
        <line x1={x + 20} y1={y + h - 15} x2={x + w - 15} y2={y + 20} stroke="#ffffff" strokeWidth="0.8" strokeDasharray="10,12" opacity="0.1" />
      </g>
    );
  };

  // Hinge swing triangles
  const drawSwingTriangle = (x: number, y: number, w: number, h: number, hinge: 'left' | 'right' | 'top' | 'bottom') => {
    let path = '';
    if (hinge === 'left') {
      path = `M ${x + w},${y} L ${x},${y + h / 2} L ${x + w},${y + h}`;
    } else if (hinge === 'right') {
      path = `M ${x},${y} L ${x + w},${y + h / 2} L ${x},${y + h}`;
    } else if (hinge === 'top') {
      path = `M ${x},${y + h} L ${x + w / 2},${y} L ${x + w},${y + h}`;
    } else if (hinge === 'bottom') {
      path = `M ${x},${y} L ${x + w / 2},${y + h} L ${x + w},${y}`;
    }
    return (
      <path
        key={`swing-${x}-${y}-${hinge}`}
        d={path}
        fill="none"
        stroke={themes.swingStroke}
        strokeWidth="1.5"
        strokeDasharray="4,4"
      />
    );
  };

  // Round knob pull handle (showers)
  const drawShowerKnob = (x: number, y: number) => {
    return (
      <g key={`knob-${x}-${y}`} transform={`translate(${x}, ${y})`}>
        {/* Background contrast mask */}
        <circle cx="0" cy="0" r="8" fill={themes.bg} opacity="0.9" />
        <circle cx="0" cy="0" r="6" fill={themes.hardwareColor} stroke={themes.hardwareHighlight} strokeWidth="1.2" />
        <circle cx="0" cy="0" r="2" fill={themes.hardwareHighlight} />
      </g>
    );
  };

  // Door Lever handle (doors)
  const drawDoorLever = (x: number, y: number, orientation: 'left' | 'right') => {
    const scaleFactor = orientation === 'left' ? -1 : 1;
    return (
      <g key={`lever-${x}-${y}`} transform={`translate(${x}, ${y}) scale(${scaleFactor}, 1)`}>
        {/* Background contrast mask */}
        <rect x="-4" y="-20" width="8" height="40" rx="3" fill={themes.bg} opacity="0.9" />
        <rect x="-20" y="-5" width="20" height="10" rx="2" fill={themes.bg} opacity="0.9" />
        
        {/* Handle Backplate */}
        <rect x="-2" y="-18" width="6" height="36" rx="2" fill={themes.hardwareColor} stroke={themes.frameStroke} strokeWidth="1" />
        {/* Pivot hub */}
        <circle cx="1" cy="0" r="3.5" fill={themes.frameStroke} />
        {/* Lever Handle grip */}
        <rect x="-17" y="-3" width="17" height="6" rx="1.5" fill={themes.hardwareColor} stroke={themes.hardwareHighlight} strokeWidth="0.8" />
      </g>
    );
  };

  // Window lock handle
  const drawWindowHandle = (x: number, y: number) => {
    return (
      <g key={`handle-${x}-${y}`} transform={`translate(${x}, ${y})`}>
        {/* Background contrast mask */}
        <rect x="-5" y="-12" width="10" height="24" rx="3" fill={themes.bg} opacity="0.9" />
        <rect x="-2" y="-1" width="16" height="6" rx="2" fill={themes.bg} opacity="0.9" />

        {/* Backplate */}
        <rect x="-3" y="-10" width="6" height="20" rx="1.5" fill={themes.hardwareColor} stroke={themes.frameStroke} strokeWidth="0.8" />
        {/* Pivot */}
        <circle cx="0" cy="0" r="2.5" fill={themes.frameStroke} />
        {/* Lever */}
        <rect x="-1" y="0" width="12" height="4" rx="1" fill={themes.hardwareColor} stroke={themes.hardwareHighlight} strokeWidth="0.5" />
      </g>
    );
  };

  // Wall side dashed reference lines for shower
  const drawWallAnchor = (x: number, y: number, h: number, side: 'left' | 'right') => {
    return (
      <g key={`wall-${x}-${side}`}>
        <line x1={x} y1={y - 10} x2={x} y2={y + h + 10} stroke={themes.wallLineColor} strokeWidth="2" strokeDasharray="5,5" />
        {/* Wall indicator hatch marks */}
        {Array.from({ length: 8 }).map((_, idx) => {
          const hy = y + (idx * h) / 7;
          return (
            <line
              key={idx}
              x1={x}
              y1={hy}
              x2={side === 'left' ? x - 6 : x + 6}
              y2={hy - 4}
              stroke={themes.wallLineColor}
              strokeWidth="0.8"
            />
          );
        })}
      </g>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: themes.bg,
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
        border: `1px solid ${themes.frameStroke}`,
        transition: 'all 0.3s ease',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="glassGradientCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={themes.glassCyanGradStart} />
            <stop offset="100%" stopColor={themes.glassCyanGradEnd} />
          </linearGradient>
          <linearGradient id="glassGradientMint" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={themes.glassMintGradStart} />
            <stop offset="100%" stopColor={themes.glassMintGradEnd} />
          </linearGradient>
        </defs>

        {/* ---------------- 3D CORNER SHOWER ENCLOSURE RENDERER ---------------- */}
        {isCornerEnclosure ? (
          <g>
            {/* Draw 90 Degree Isometric Shower */}
            {/* Isometric coordinates mapping */}
            {/* Center base post */}
            {(() => {
              const baseCx = 400;
              const baseCy = 380;
              const shH = 260; // scaled height

              // Left Panel runs up-left at 30 degrees (dx=-140, dy=-80)
              // Right Panel runs up-right at 30 degrees (dx=140, dy=-80)
              const leftCornerX = baseCx - 150;
              const leftCornerY = baseCy - 80;
              
              const rightCornerX = baseCx + 150;
              const rightCornerY = baseCy - 80;

              return (
                <g>
                  {/* Blueprint grid background */}
                  {theme === 'blueprint' && (
                    <g stroke="rgba(56, 189, 248, 0.15)" strokeWidth="0.5" strokeDasharray="5,5">
                      <circle cx={baseCx} cy={baseCy - shH/2} r="160" fill="none" />
                      <line x1={baseCx} y1="0" x2={baseCx} y2={svgHeight} />
                    </g>
                  )}

                  {/* Wall boundary indicators */}
                  <line x1={leftCornerX} y1={leftCornerY} x2={leftCornerX} y2={leftCornerY - shH - 15} stroke={themes.wallLineColor} strokeWidth="1.5" strokeDasharray="4,4" />
                  <line x1={rightCornerX} y1={rightCornerY} x2={rightCornerX} y2={rightCornerY - shH - 15} stroke={themes.wallLineColor} strokeWidth="1.5" strokeDasharray="4,4" />
                  
                  {/* Left Glass Panel (Fixed Screen) */}
                  <polygon
                    points={`${leftCornerX},${leftCornerY} ${baseCx},${baseCy} ${baseCx},${baseCy - shH} ${leftCornerX},${leftCornerY - shH}`}
                    fill="url(#glassGradientMint)"
                    fillOpacity={themes.glassOpacity}
                    stroke={themes.sashStroke}
                    strokeWidth={themes.sashStrokeWidth}
                  />
                  
                  {/* Right Glass Panel (Sliding Door Screen) */}
                  <polygon
                    points={`${baseCx},${baseCy} ${rightCornerX},${rightCornerY} ${rightCornerX},${rightCornerY - shH} ${baseCx},${baseCy - shH}`}
                    fill="url(#glassGradientMint)"
                    fillOpacity={themes.glassOpacity}
                    stroke={themes.sashStroke}
                    strokeWidth={themes.sashStrokeWidth}
                  />

                  {/* Corner Structural Mullion Post */}
                  <line x1={baseCx} y1={baseCy} x2={baseCx} y2={baseCy - shH} stroke={themes.hardwareColor} strokeWidth="4" />
                  <circle cx={baseCx} cy={baseCy} r="3" fill={themes.hardwareColor} />
                  <circle cx={baseCx} cy={baseCy - shH} r="3" fill={themes.hardwareColor} />

                  {/* Top Chrome Support Rail */}
                  <line x1={leftCornerX} y1={leftCornerY - shH} x2={baseCx} y2={baseCy - shH} stroke={themes.hardwareColor} strokeWidth="3" />
                  <line x1={rightCornerX} y1={rightCornerY - shH} x2={baseCx} y2={baseCy - shH} stroke={themes.hardwareColor} strokeWidth="3" />

                  {/* Sliding rollers and arrows on the right door panel */}
                  <circle cx={baseCx + 45} cy={baseCy - shH + ((rightCornerY - baseCy) * 0.3)} r="4.5" fill={themes.hardwareColor} />
                  <circle cx={baseCx + 105} cy={baseCy - shH + ((rightCornerY - baseCy) * 0.7)} r="4.5" fill={themes.hardwareColor} />
                  
                  {/* 3D door handle knob */}
                  <circle cx={baseCx + 75} cy={baseCy - shH/2 + ((rightCornerY - baseCy) * 0.5)} r="8" fill={themes.bg} opacity="0.9" />
                  <circle cx={baseCx + 75} cy={baseCy - shH/2 + ((rightCornerY - baseCy) * 0.5)} r="6" fill={themes.hardwareColor} stroke={themes.hardwareHighlight} strokeWidth="1.2" />
                  <circle cx={baseCx + 75} cy={baseCy - shH/2 + ((rightCornerY - baseCy) * 0.5)} r="2" fill={themes.hardwareHighlight} />

                  {/* Dimension Line Left (Overall Width) */}
                  <g stroke={themes.dimensionLine} strokeWidth="0.8">
                    <line x1={leftCornerX - 25} y1={leftCornerY - 15} x2={baseCx - 25} y2={baseCy - 15} />
                    <line x1={leftCornerX} y1={leftCornerY} x2={leftCornerX - 28} y2={leftCornerY - 16} strokeDasharray="2,2" />
                    <line x1={baseCx} y1={baseCy} x2={baseCx - 28} y2={baseCy - 16} strokeDasharray="2,2" />
                    {drawTick(leftCornerX - 25, leftCornerY - 15)}
                    {drawTick(baseCx - 25, baseCy - 15)}
                  </g>
                  <text x={baseCx - 95} y={baseCy - 40} fill={themes.dimensionText} fontSize="11px" fontWeight="bold" fontFamily="monospace" transform="rotate(-25, 305, 340)">
                    {Math.round(width)} mm
                  </text>

                  {/* Dimension Line Right (Overall Depth) */}
                  <g stroke={themes.dimensionLine} strokeWidth="0.8">
                    <line x1={baseCx + 25} y1={baseCy - 15} x2={rightCornerX + 25} y2={rightCornerY - 15} />
                    <line x1={baseCx} y1={baseCy} x2={baseCx + 28} y2={baseCy - 16} strokeDasharray="2,2" />
                    <line x1={rightCornerX} y1={rightCornerY} x2={rightCornerX + 28} y2={rightCornerY - 16} strokeDasharray="2,2" />
                    {drawTick(baseCx + 25, baseCy - 15)}
                    {drawTick(rightCornerX + 25, rightCornerY - 15)}
                  </g>
                  <text x={baseCx + 95} y={baseCy - 40} fill={themes.dimensionText} fontSize="11px" fontWeight="bold" fontFamily="monospace" transform="rotate(25, 495, 340)">
                    900 mm
                  </text>

                  {/* Dimension Line Height (Vertical) */}
                  <g stroke={themes.dimensionLine} strokeWidth="0.8">
                    <line x1={rightCornerX + 20} y1={rightCornerY} x2={rightCornerX + 20} y2={rightCornerY - shH} />
                    <line x1={rightCornerX} y1={rightCornerY} x2={rightCornerX + 25} y2={rightCornerY} strokeDasharray="2,2" />
                    <line x1={rightCornerX} y1={rightCornerY - shH} x2={rightCornerX + 25} y2={rightCornerY - shH} strokeDasharray="2,2" />
                    {drawTick(rightCornerX + 20, rightCornerY)}
                    {drawTick(rightCornerX + 20, rightCornerY - shH)}
                  </g>
                  <text x={rightCornerX + 26} y={rightCornerY - shH/2} fill={themes.dimensionText} fontSize="11px" fontWeight="bold" fontFamily="monospace">
                    {Math.round(height)}
                  </text>

                  {/* 90-Degree Corner indicator */}
                  <path d={`M ${baseCx - 12},${baseCy - 6} L ${baseCx},${baseCy - 12} L ${baseCx + 12},${baseCy - 6}`} fill="none" stroke={themes.hardwareColor} strokeWidth="1" />
                  <text x={baseCx} y={baseCy + 18} textAnchor="middle" fill={themes.dimensionText} fontSize="10px" fontWeight="bold">90° CORNER POST</text>
                </g>
              );
            })()}
          </g>
        ) : (
          // ---------------- STANDARD 2D RENDERER FOR 14 OTHER PRODUCTS ----------------
          <g>
            {/* Wall reference columns for Walk-in Screens and Inline setups */}
            {isShower && (subType === 'fixed_shower_screen' || subType === 'inline_shower_door') && (
              <>
                {drawWallAnchor(startX, startY, finalDrawHeight, 'left')}
                {subType === 'fixed_shower_screen' && (
                  <line x1={endX} y1={startY} x2={endX} y2={endY} stroke={themes.wallLineColor} strokeWidth="1" strokeDasharray="2,2" />
                )}
              </>
            )}

            {/* A. Dynamic Glass Lites rendering */}
            {(() => {
              const components: React.ReactNode[] = [];
              let currentX = startX;

              uniqueVertSplits.slice(0, -1).forEach((val, idx) => {
                const paneWidthMm = uniqueVertSplits[idx + 1] - val;
                const paneW = paneWidthMm * scale;
                const paneH = finalDrawHeight;

                // Adjust for nested horizontal splits inside this column (e.g. Reference 2 fixed/casement/fixed)
                const hasHorizSplits = uniqueHorizSplits.length > 2 && (subType === 'fixed_casement' || subType === 'multi_lite') && idx > 0;
                
                // For Column 1 in multi-lites (Reference 3 sliding window setup)
                const isMultiLiteCol1 = subType === 'multi_lite' && idx === 0;

                if (hasHorizSplits) {
                  // Render 3 row panes (700 / awning / 700)
                  let currentY = startY;
                  uniqueHorizSplits.slice(0, -1).forEach((hVal, hIdx) => {
                    const rowHeightMm = uniqueHorizSplits[hIdx + 1] - hVal;
                    const rH = rowHeightMm * scale;
                    const isAwning = hIdx === 1; // Middle pane

                    components.push(
                      <g key={`pane-col-${idx}-row-${hIdx}`}>
                        {/* Glass */}
                        <rect
                          x={currentX + 3}
                          y={currentY + 3}
                          width={paneW - 6}
                          height={rH - 6}
                          fill={isShower ? 'url(#glassGradientMint)' : 'url(#glassGradientCyan)'}
                          fillOpacity={themes.glassOpacity}
                          stroke={themes.sashStroke}
                          strokeWidth={themes.sashStrokeWidth}
                        />
                        {renderReflections(currentX + 3, currentY + 3, paneW - 6, rH - 6)}

                        {/* Mid-Awning Indicator swing lines */}
                        {isAwning && (
                          <>
                            {drawSwingTriangle(currentX + 3, currentY + 3, paneW - 6, rH - 6, 'top')}
                            {drawWindowHandle(currentX + paneW / 2, currentY + rH - 12)}
                          </>
                        )}
                      </g>
                    );
                    currentY += rH;
                  });
                } else if (isMultiLiteCol1) {
                  // Reference 3 Col 1 is split: top 1340 fixed, bottom 1200 sliding
                  const topHMm = height - 1200;
                  const topH = topHMm * scale;
                  const botH = 1200 * scale;

                  components.push(
                    <g key={`pane-col1`}>
                      {/* Top Fixed */}
                      <rect
                        x={currentX + 3}
                        y={startY + 3}
                        width={paneW - 6}
                        height={topH - 6}
                        fill="url(#glassGradientCyan)"
                        fillOpacity={themes.glassOpacity}
                        stroke={themes.sashStroke}
                        strokeWidth={themes.sashStrokeWidth}
                      />
                      {renderReflections(currentX + 3, startY + 3, paneW - 6, topH - 6)}

                      {/* Bottom Sliding window */}
                      <rect
                        x={currentX + 3}
                        y={startY + topH + 3}
                        width={paneW - 6}
                        height={botH - 6}
                        fill="url(#glassGradientCyan)"
                        fillOpacity={themes.glassOpacity}
                        stroke={themes.sashStroke}
                        strokeWidth={themes.sashStrokeWidth}
                      />
                      {renderReflections(currentX + 3, startY + topH + 3, paneW - 6, botH - 6)}
                      {drawArrow(currentX + paneW / 2, startY + topH + botH / 2, 45, 'left')}
                    </g>
                  );
                } else {
                  // Standard Single Full Column Pane
                  const px = currentX + (isShower ? 1 : 4);
                  const py = startY + (isShower ? 1 : 4);
                  const pw = paneW - (isShower ? 2 : 8);
                  const ph = paneH - (isShower ? 2 : 8);

                  // Set glass colors (Mint gradient for showers, Cyan gradient for windows/doors)
                  const fillGrad = isShower ? 'url(#glassGradientMint)' : 'url(#glassGradientCyan)';

                  components.push(
                    <g key={`pane-col-${idx}`}>
                      <rect
                        x={px}
                        y={py}
                        width={pw}
                        height={ph}
                        fill={fillGrad}
                        fillOpacity={themes.glassOpacity}
                        stroke={themes.sashStroke}
                        strokeWidth={themes.sashStrokeWidth}
                      />
                      {renderReflections(px, py, pw, ph)}

                      {/* Mechanical and handle indicators */}
                      {/* 1. Casement Window (left side hinges) */}
                      {subType === 'casement_window' && (
                        <>
                          {drawSwingTriangle(px, py, pw, ph, 'left')}
                          {drawWindowHandle(px + pw - 12, py + ph / 2)}
                        </>
                      )}

                      {/* 2. Awning Window (top-hinged) */}
                      {subType === 'awning_window' && (
                        <>
                          {drawSwingTriangle(px, py, pw, ph, 'top')}
                          {drawWindowHandle(px + pw / 2, py + ph - 12)}
                        </>
                      )}

                      {/* 3. Tilt & Turn (swing left, tilt bottom) */}
                      {subType === 'tilt_turn_window' && (
                        <>
                          {drawSwingTriangle(px, py, pw, ph, 'left')}
                          {/* Hopper tilt triangle */}
                          <path d={`M ${px},${py} L ${px + pw/2},${py + ph} L ${px + pw},${py}`} fill="none" stroke={themes.swingStroke} strokeWidth="1" strokeDasharray="2,5" />
                          {drawWindowHandle(px + pw - 12, py + ph / 2)}
                        </>
                      )}

                      {/* 4. Sliding Window / Bypass Patio slider arrows */}
                      {(subType === 'sliding_window' || subType === 'sliding_patio_door') && (
                        drawArrow(px + pw / 2, py + ph / 2, 50, idx === 0 ? 'right' : 'left')
                      )}

                      {/* 5. Double Casement (left hinged left, right hinged right) */}
                      {subType === 'double_casement_window' && (
                        <>
                          {drawSwingTriangle(px, py, pw, ph, idx === 0 ? 'left' : 'right')}
                          {drawWindowHandle(idx === 0 ? px + pw - 12 : px + 12, py + ph / 2)}
                        </>
                      )}

                      {/* 6. Single Entry Door (left hinged) */}
                      {subType === 'single_hinged_door' && (
                        <>
                          {drawSwingTriangle(px, py, pw, ph, 'left')}
                          {drawDoorLever(px + pw - 14, py + ph / 2, 'right')}
                        </>
                      )}

                      {/* 7. Double French Doors */}
                      {subType === 'double_french_door' && (
                        <>
                          {drawSwingTriangle(px, py, pw, ph, idx === 0 ? 'left' : 'right')}
                          {drawDoorLever(idx === 0 ? px + pw - 14 : px + 14, py + ph / 2, idx === 0 ? 'right' : 'left')}
                        </>
                      )}

                      {/* 8. Door with Sidelite */}
                      {subType === 'door_sidelite' && (
                        idx === 0 ? (
                          <>
                            {drawSwingTriangle(px, py, pw, ph, 'left')}
                            {drawDoorLever(px + pw - 14, py + ph / 2, 'right')}
                          </>
                        ) : (
                          <text x={px + pw/2} y={py + 30} textAnchor="middle" fill={themes.dimensionText} fontSize="9px" fontWeight="600" opacity="0.3">FIXED</text>
                        )
                      )}

                      {/* 9. Bi-Folding Doors (Accordion folds) */}
                      {subType === 'bifold_door' && (
                        <g>
                          {/* Accordion indicator lines */}
                          {idx < 2 && (
                            <line x1={px + pw} y1={py} x2={px + pw + 25} y2={py + ph / 2} stroke={themes.swingStroke} strokeWidth="1" strokeDasharray="3,3" />
                          )}
                          {idx === 0 && drawArrow(px + pw/2, py + ph - 30, 40, 'right')}
                        </g>
                      )}

                      {/* 10. Shower Screen Header rod brace */}
                      {subType === 'fixed_shower_screen' && (
                        <g>
                          {/* Sleek top chrome rod */}
                          <line x1={startX - 15} y1={py + 15} x2={px + pw} y2={py + 15} stroke={themes.hardwareColor} strokeWidth="4" />
                          {/* Glass top metal connector sleeve */}
                          <rect x={px + pw - 12} y={py + 5} width="12" height="20" fill={themes.hardwareColor} />
                          {/* Wall mount plate */}
                          <rect x={startX - 18} y={py + 8} width="3" height="14" fill={themes.hardwareColor} />
                        </g>
                      )}

                      {/* 11. Hinged Shower Door (Inline Setup) */}
                      {subType === 'inline_shower_door' && (
                        idx === 0 ? (
                          // Left fixed screen
                          <text x={px + pw/2} y={py + 30} textAnchor="middle" fill={themes.dimensionText} fontSize="8px" fontWeight="600" opacity="0.3">FIXED GLASS</text>
                        ) : (
                          // Right active hinged glass door
                          <g>
                            {/* Glass-to-glass chrome hinges connecting to the left screen */}
                            <rect x={px - 8} y={py + ph * 0.2} width="16" height="24" fill={themes.hardwareColor} rx="1" stroke={themes.hardwareHighlight} strokeWidth="0.5" />
                            <rect x={px - 8} y={py + ph * 0.8} width="16" height="24" fill={themes.hardwareColor} rx="1" stroke={themes.hardwareHighlight} strokeWidth="0.5" />
                            
                            {/* Hinge swing triangle */}
                            {drawSwingTriangle(px, py, pw, ph, 'left')}

                            {/* Round knob handle */}
                            {drawShowerKnob(px + pw - 18, py + ph / 2)}

                            {/* Curved swing arc track line */}
                            <path
                              d={`M ${px + pw},${py + ph - 2} A ${pw},${pw} 0 0,1 ${px},${py + ph - 2}`}
                              fill="none"
                              stroke={themes.swingStroke}
                              strokeWidth="1.2"
                              strokeDasharray="3,3"
                            />
                          </g>
                        )
                      )}

                      {/* 12. Sliding Shower Enclosure (rollers and track support) */}
                      {subType === 'sliding_shower_enclosure' && (
                        <g>
                          {/* Rollers (2 chrome wheels at top of each pane) */}
                          <circle cx={px + pw * 0.2} cy={startY - 6} r="5" fill={themes.hardwareColor} stroke={themes.hardwareHighlight} strokeWidth="0.5" />
                          <circle cx={px + pw * 0.8} cy={startY - 6} r="5" fill={themes.hardwareColor} stroke={themes.hardwareHighlight} strokeWidth="0.5" />
                          
                          {/* Directional arrows */}
                          {drawArrow(px + pw/2, py + ph/2, 40, idx === 0 ? 'right' : 'left')}
                          
                          {/* Pull handles */}
                          {drawShowerKnob(idx === 0 ? px + pw - 14 : px + 14, py + ph / 2)}
                        </g>
                      )}

                    </g>
                  );
                }
                currentX += paneW;
              });

              return components;
            })()}

            {/* B. MAIN FRAME/BORDER BARS */}
            <rect
              x={startX}
              y={startY}
              width={finalDrawWidth}
              height={finalDrawHeight}
              fill={themes.frameFill}
              stroke={themes.frameStroke}
              strokeWidth={themes.frameStrokeWidth}
              strokeLinejoin="miter"
              style={{ pointerEvents: 'none' }}
            />

            {/* Mullions and transoms */}
            {uniqueVertSplits.slice(1, -1).map((val, idx) => {
              const sx = startX + val * scale;
              return (
                <line
                  key={`mullion-${idx}`}
                  x1={sx}
                  y1={startY}
                  x2={sx}
                  y2={endY}
                  stroke={themes.frameStroke}
                  strokeWidth={themes.mullionStrokeWidth}
                />
              );
            })}

            {uniqueHorizSplits.slice(1, -1).map((val, idx) => {
              // Only draw if horizontal split is valid
              if (subType === 'fixed_casement' || subType === 'multi_lite') {
                const sy = startY + val * scale;
                // Awning transom starts after Column 1
                const xStart = subType === 'fixed_casement' ? startX + uniqueVertSplits[1] * scale : startX;
                return (
                  <line
                    key={`transom-${idx}`}
                    x1={xStart}
                    y1={sy}
                    x2={endX}
                    y2={sy}
                    stroke={themes.frameStroke}
                    strokeWidth={themes.mullionStrokeWidth}
                  />
                );
              }
              return null;
            })}

            {/* C. SLIDING SHOWER HEADER SUPPORT BAR */}
            {subType === 'sliding_shower_enclosure' && (
              <g>
                {/* Horizontal support bar running across top */}
                <line x1={startX - 10} y1={startY - 12} x2={endX + 10} y2={startY - 12} stroke={themes.hardwareColor} strokeWidth="5" />
                <rect x={startX - 15} y={startY - 18} width="5" height="12" fill={themes.hardwareColor} />
                <rect x={endX + 10} y={startY - 18} width="5" height="12" fill={themes.hardwareColor} />
                
                {/* Low-profile bottom threshold guide line */}
                <line x1={startX} y1={endY + 2} x2={endX} y2={endY + 2} stroke={themes.hardwareColor} strokeWidth="3" />
              </g>
            )}

            {/* D. DIMENSION LINES (TOP OVERALL AND PANEL SPLITS) */}
            <g style={{ pointerEvents: 'none' }}>
              {/* Overall width line */}
              <line x1={startX} y1={startY - 50} x2={endX} y2={startY - 50} stroke={themes.dimensionLine} strokeWidth="1" />
              <line x1={startX} y1={startY} x2={startX} y2={startY - 55} stroke={themes.extensionLine} strokeWidth="0.8" strokeDasharray="2,2" />
              <line x1={endX} y1={startY} x2={endX} y2={startY - 55} stroke={themes.extensionLine} strokeWidth="0.8" strokeDasharray="2,2" />
              {drawTick(startX, startY - 50)}
              {drawTick(endX, startY - 50)}
              
              <rect x={midX - 22} y={startY - 60} width="44" height="18" fill={themes.bg} />
              <text x={midX} y={startY - 46} textAnchor="middle" fill={themes.dimensionText} fontSize="12px" fontWeight="bold" fontFamily="monospace">
                {Math.round(width)}
              </text>

              {/* Sub-panel width splits (top) */}
              {uniqueVertSplits.length > 2 && (
                <>
                  <line x1={startX} y1={startY - 25} x2={endX} y2={startY - 25} stroke={themes.dimensionLine} strokeWidth="0.8" />
                  {uniqueVertSplits.map((val) => {
                    const sx = startX + val * scale;
                    drawTick(sx, startY - 25);
                    if (val > 0 && val < width) {
                      return (
                        <line
                          key={`split-v-${val}`}
                          x1={sx}
                          y1={startY}
                          x2={sx}
                          y2={startY - 30}
                          stroke={themes.extensionLine}
                          strokeWidth="0.6"
                          strokeDasharray="2,2"
                        />
                      );
                    }
                    return null;
                  })}

                  {/* Render panel split text values */}
                  {(() => {
                    const texts: React.ReactNode[] = [];
                    uniqueVertSplits.slice(0, -1).forEach((val, idx) => {
                      const colW = uniqueVertSplits[idx + 1] - val;
                      const colMid = startX + (val + colW / 2) * scale;
                      texts.push(
                        <g key={`col-w-txt-${idx}`}>
                          <rect x={colMid - 18} y={startY - 33} width="36" height="15" fill={themes.bg} />
                          <text x={colMid} y={startY - 22} textAnchor="middle" fill={themes.dimensionText} fontSize="9px" fontWeight="bold" fontFamily="monospace">
                            {Math.round(colW)}
                          </text>
                        </g>
                      );
                    });
                    return texts;
                  })()}
                </>
              )}

              {/* Overall height line (left) */}
              <line x1={startX - 50} y1={startY} x2={startX - 50} y2={endY} stroke={themes.dimensionLine} strokeWidth="1" />
              <line x1={startX} y1={startY} x2={startX - 55} y2={startY} stroke={themes.extensionLine} strokeWidth="0.8" strokeDasharray="2,2" />
              <line x1={startX} y1={endY} x2={startX - 55} y2={endY} stroke={themes.extensionLine} strokeWidth="0.8" strokeDasharray="2,2" />
              {drawTick(startX - 50, startY)}
              {drawTick(startX - 50, endY)}

              <g transform={`translate(${startX - 50}, ${midY})`}>
                <rect x="-9" y="-22" width="18" height="44" fill={themes.bg} />
                <text x="0" y="4" textAnchor="middle" fill={themes.dimensionText} fontSize="12px" fontWeight="bold" fontFamily="monospace" transform="rotate(-90)">
                  {Math.round(height)}
                </text>
              </g>

              {/* Sub-panel height splits (left) */}
              {uniqueHorizSplits.length > 2 && (
                <>
                  <line x1={startX - 25} y1={startY} x2={startX - 25} y2={endY} stroke={themes.dimensionLine} strokeWidth="0.8" />
                  {uniqueHorizSplits.map((val) => {
                    const sy = startY + val * scale;
                    drawTick(startX - 25, sy);
                    if (val > 0 && val < height) {
                      return (
                        <line
                          key={`split-h-${val}`}
                          x1={startX}
                          y1={sy}
                          x2={startX - 30}
                          y2={sy}
                          stroke={themes.extensionLine}
                          strokeWidth="0.6"
                          strokeDasharray="2,2"
                        />
                      );
                    }
                    return null;
                  })}

                  {/* Render panel split height texts */}
                  {uniqueHorizSplits.slice(0, -1).map((val, idx) => {
                    const rowH = uniqueHorizSplits[idx + 1] - val;
                    const rowMid = startY + (val + rowH / 2) * scale;
                    return (
                      <g key={`row-h-txt-${idx}`} transform={`translate(${startX - 25}, ${rowMid})`}>
                        <rect x="-8" y="-18" width="16" height="36" fill={themes.bg} />
                        <text x="0" y="3" textAnchor="middle" fill={themes.dimensionText} fontSize="9px" fontWeight="bold" fontFamily="monospace" transform="rotate(-90)">
                          {Math.round(rowH)}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}
            </g>

            {/* Bottom Scale Label */}
            <text x={startX + 6} y={endY - 10} fill={themes.dimensionText} opacity="0.25" fontSize="9px" fontFamily="monospace" style={{ pointerEvents: 'none' }}>
              SCALE: 1:{(1 / scale).toFixed(1)} | DIMENSIONS IN MM
            </text>
          </g>
        )}

      </svg>
    </div>
  );
}
