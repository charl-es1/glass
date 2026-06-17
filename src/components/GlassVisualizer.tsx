'use client';

import React, { useState, useEffect, useRef } from 'react';

interface GlassVisualizerProps {
  length: number;    // in meters
  width: number;     // in meters
  thickness: number; // in millimeters
  glassTypeName: string;
}

export default function GlassVisualizer({
  length,
  width,
  thickness,
  glassTypeName,
}: GlassVisualizerProps) {
  // SVG viewport size
  const viewWidth = 500;
  const viewHeight = 400;
  const centerX = viewWidth / 2;
  const centerY = viewHeight / 2;

  // Max bounds for the model inside the viewport
  const maxWidth = 260;
  const maxHeight = 180;

  // Default values for visualization if inputs are blank or invalid
  const valLength = length > 0 ? length : 1.0;
  const valWidth = width > 0 ? width : 1.0;
  const valThickness = thickness > 0 ? thickness : 6.0;

  // Track rotation state (angles in degrees)
  const [yaw, setYaw] = useState(-35); // Y-axis rotation
  const [pitch, setPitch] = useState(20); // X-axis rotation
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Idle auto-rotation loop
  useEffect(() => {
    if (isDragging) return;
    const interval = setInterval(() => {
      setYaw((y) => (y + 0.3) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, [isDragging]);

  // Scaling factor to map physical meters to pixels
  const scaleX = maxWidth / valLength;
  const scaleY = maxHeight / valWidth;
  const scale = Math.min(scaleX, scaleY);

  // Scaled dimensions in pixels
  const rectWidth = valLength * scale;
  const rectHeight = valWidth * scale;

  // Exaggerate thickness slightly in visualization so it is clearly visible as a 3D pane
  const visualThickness = Math.max(8, Math.min(50, valThickness * 2.2));

  // Center-relative bounds (dx, dy, dz)
  const dx = rectWidth / 2;
  const dy = rectHeight / 2;
  const dz = visualThickness / 2;

  // Rotation angles in radians
  const radYaw = (yaw * Math.PI) / 180;
  const radPitch = (pitch * Math.PI) / 180;

  // 3D Projection function: Rotates and projects a 3D coordinate (x, y, z) into 2D screen pixels (x, y)
  const projectPoint = (xVal: number, yVal: number, zVal: number) => {
    // 1. Rotate around Y-axis (Yaw)
    const x1 = xVal * Math.cos(radYaw) - zVal * Math.sin(radYaw);
    const y1 = yVal;
    const z1 = xVal * Math.sin(radYaw) + zVal * Math.cos(radYaw);

    // 2. Rotate around X-axis (Pitch)
    const x2 = x1;
    const y2 = y1 * Math.cos(radPitch) - z1 * Math.sin(radPitch);
    const z2 = y1 * Math.sin(radPitch) + z1 * Math.cos(radPitch);

    return {
      x: centerX + x2,
      y: centerY + y2,
      z: z2, // Keep Z depth for ordering faces
    };
  };

  // Vertices of the 3D Cuboid (Back-Bottom-Left to Front-Top-Right)
  // Vertex mapping:
  // V0: (-dx, -dy, -dz)  [Back, Top, Left]
  // V1: ( dx, -dy, -dz)  [Back, Top, Right]
  // V2: ( dx,  dy, -dz)  [Back, Bottom, Right]
  // V3: (-dx,  dy, -dz)  [Back, Bottom, Left]
  // V4: (-dx, -dy,  dz)  [Front, Top, Left]
  // V5: ( dx, -dy,  dz)  [Front, Top, Right]
  // V6: ( dx,  dy,  dz)  [Front, Bottom, Right]
  // V7: (-dx,  dy,  dz)  [Front, Bottom, Left]
  const vertices = [
    projectPoint(-dx, -dy, -dz), // V0
    projectPoint(dx, -dy, -dz),  // V1
    projectPoint(dx, dy, -dz),   // V2
    projectPoint(-dx, dy, -dz),  // V3
    projectPoint(-dx, -dy, dz),  // V4
    projectPoint(dx, -dy, dz),   // V5
    projectPoint(dx, dy, dz),    // V6
    projectPoint(-dx, dy, dz),   // V7
  ];

  // Define 6 faces of the cuboid with their drawing instructions
  const faces = [
    {
      name: 'back',
      indices: [1, 0, 3, 2],
      fill: 'url(#backFaceGrad)',
      stroke: 'rgba(56, 189, 248, 0.4)',
      strokeWidth: 1,
    },
    {
      name: 'left',
      indices: [0, 4, 7, 3],
      fill: 'url(#sideFaceGrad)',
      stroke: '#0ea5e9',
      strokeWidth: 1.5,
    },
    {
      name: 'right',
      indices: [1, 5, 6, 2],
      fill: 'url(#sideFaceGrad)',
      stroke: '#0ea5e9',
      strokeWidth: 1.5,
    },
    {
      name: 'top',
      indices: [0, 1, 5, 4],
      fill: 'url(#topFaceGrad)',
      stroke: '#38bdf8',
      strokeWidth: 1.8,
    },
    {
      name: 'bottom',
      indices: [3, 2, 6, 7],
      fill: 'url(#bottomFaceGrad)',
      stroke: 'rgba(2, 132, 199, 0.6)',
      strokeWidth: 1.2,
    },
    {
      name: 'front',
      indices: [4, 5, 6, 7],
      fill: 'url(#frontFaceGrad)',
      stroke: '#38bdf8',
      strokeWidth: 2.2,
    },
  ];

  // Calculate average depth (Z) of each face to perform Painter's algorithm depth-sorting
  const sortedFaces = faces
    .map((face) => {
      const avgZ = face.indices.reduce((sum, idx) => sum + vertices[idx].z, 0) / 4;
      return { ...face, avgZ };
    })
    .sort((a, b) => a.avgZ - b.avgZ); // Sort ascending (back faces first, front faces last)

  // Drag interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dxDrag = e.clientX - dragStart.current.x;
    const dyDrag = e.clientY - dragStart.current.y;
    setYaw((y) => (y + dxDrag * 0.5) % 360);
    setPitch((p) => Math.max(-80, Math.min(80, p - dyDrag * 0.5)));
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Touch interaction handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dxDrag = e.touches[0].clientX - dragStart.current.x;
    const dyDrag = e.touches[0].clientY - dragStart.current.y;
    setYaw((y) => (y + dxDrag * 0.5) % 360);
    setPitch((p) => Math.max(-80, Math.min(80, p - dyDrag * 0.5)));
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // --- Calculate 3D projected coordinates for dimension markings ---
  const offset = 42; // Pixel offset of dimension line from the face

  // 1. Length Dimension (Shifted above the top edge)
  const dLen1 = projectPoint(-dx, -dy - offset, dz);
  const dLen2 = projectPoint(dx, -dy - offset, dz);
  const dLenMid = projectPoint(0, -dy - offset - 10, dz);

  // 2. Width Dimension (Shifted left of the left edge)
  const dWid1 = projectPoint(-dx - offset, -dy, dz);
  const dWid2 = projectPoint(-dx - offset, dy, dz);
  const dWidMid = projectPoint(-dx - offset - 12, 0, dz);

  // 3. Thickness Dimension (Shifted left/above from the top-left depth edge)
  const dThick1 = projectPoint(-dx - offset + 15, -dy - offset + 15, -dz);
  const dThick2 = projectPoint(-dx - offset + 15, -dy - offset + 15, dz);
  const dThickMid = projectPoint(-dx - offset + 15, -dy - offset + 3, 0);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '380px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          overflow: 'visible',
          maxWidth: '500px',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <defs>
          {/* Glass Face Gradients */}
          <linearGradient id="frontFaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#0ea5e9" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="topFaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="backFaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#075985" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="sideFaceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.15" />
          </linearGradient>

          <linearGradient id="bottomFaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.4" />
          </linearGradient>

          {/* Dimension Line Arrowhead */}
          <marker
            id="arrow3d"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* --- Background Blueprint Grid Lines --- */}
        <g stroke="#1e293b" strokeWidth="0.5" opacity="0.25" strokeDasharray="5,5">
          <line x1={centerX} y1="0" x2={centerX} y2={viewHeight} />
          <line x1="0" y1={centerY} x2={viewWidth} y2={centerY} />
          <circle cx={centerX} cy={centerY} r="160" fill="none" />
        </g>

        {/* --- Outer Technical Blueprint Border --- */}
        <rect
          x="5"
          y="5"
          width={viewWidth - 10}
          height={viewHeight - 10}
          fill="none"
          stroke="#1e293b"
          strokeWidth="1"
          rx="8"
          opacity="0.4"
        />

        {/* --- Rotated 3D Cuboid Rendering --- */}
        <g>
          {sortedFaces.map((face) => {
            const pts = face.indices.map((idx) => `${vertices[idx].x},${vertices[idx].y}`).join(' ');
            return (
              <polygon
                key={face.name}
                points={pts}
                fill={face.fill}
                stroke={face.stroke}
                strokeWidth={face.strokeWidth}
                strokeLinejoin="round"
                style={{ transition: isDragging ? 'none' : 'fill 0.1s, stroke 0.1s' }}
              />
            );
          })}
        </g>

        {/* --- 3D Technical Corner Corner Ticks --- */}
        <g stroke="#f8fafc" strokeWidth="1" opacity="0.6">
          {vertices.map((v, i) => (
            <circle key={i} cx={v.x} cy={v.y} r="1.5" fill="#f8fafc" />
          ))}
        </g>

        {/* --- Dimension Lines, Ticks and Text Labels --- */}
        {length > 0 && width > 0 && (
          <g style={{ pointerEvents: 'none' }}>
            {/* 1. Length Dimension Markings */}
            <g stroke="#475569" strokeWidth="0.8" opacity="0.7">
              <line x1={vertices[4].x} y1={vertices[4].y} x2={dLen1.x} y2={dLen1.y} />
              <line x1={vertices[5].x} y1={vertices[5].y} x2={dLen2.x} y2={dLen2.y} />
            </g>
            <line
              x1={dLen1.x}
              y1={dLen1.y}
              x2={dLen2.x}
              y2={dLen2.y}
              stroke="#38bdf8"
              strokeWidth="1.2"
              markerStart="url(#arrow3d)"
              markerEnd="url(#arrow3d)"
            />
            <text
              x={dLenMid.x}
              y={dLenMid.y}
              fill="#f8fafc"
              fontSize="12px"
              fontWeight="600"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {valLength.toFixed(2)} m
            </text>

            {/* 2. Width Dimension Markings */}
            <g stroke="#475569" strokeWidth="0.8" opacity="0.7">
              <line x1={vertices[4].x} y1={vertices[4].y} x2={dWid1.x} y2={dWid1.y} />
              <line x1={vertices[7].x} y1={vertices[7].y} x2={dWid2.x} y2={dWid2.y} />
            </g>
            <line
              x1={dWid1.x}
              y1={dWid1.y}
              x2={dWid2.x}
              y2={dWid2.y}
              stroke="#38bdf8"
              strokeWidth="1.2"
              markerStart="url(#arrow3d)"
              markerEnd="url(#arrow3d)"
            />
            <text
              x={dWidMid.x}
              y={dWidMid.y}
              fill="#f8fafc"
              fontSize="12px"
              fontWeight="600"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {valWidth.toFixed(2)} m
            </text>

            {/* 3. Thickness Dimension Markings */}
            <g stroke="#475569" strokeWidth="0.8" opacity="0.6">
              <line x1={vertices[0].x} y1={vertices[0].y} x2={dThick1.x} y2={dThick1.y} />
              <line x1={vertices[4].x} y1={vertices[4].y} x2={dThick2.x} y2={dThick2.y} />
            </g>
            <line
              x1={dThick1.x}
              y1={dThick1.y}
              x2={dThick2.x}
              y2={dThick2.y}
              stroke="#38bdf8"
              strokeWidth="1"
              markerStart="url(#arrow3d)"
              markerEnd="url(#arrow3d)"
            />
            <text
              x={dThickMid.x}
              y={dThickMid.y}
              fill="#f8fafc"
              fontSize="11px"
              fontWeight="600"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {valThickness.toFixed(1)} mm
            </text>
          </g>
        )}

        {/* --- Rotating Technical Watermark Details --- */}
        <text
          x={18}
          y={32}
          fill="rgba(56, 189, 248, 0.4)"
          fontSize="10px"
          fontFamily="monospace"
          fontWeight="500"
        >
          SPECIFICATION: {glassTypeName ? glassTypeName.toUpperCase() : 'STANDARD GLASS'}
        </text>
        <text
          x={18}
          y={380}
          fill="rgba(148, 163, 184, 0.3)"
          fontSize="9px"
          fontFamily="monospace"
        >
          ROTATION: YAW={Math.round(yaw)}° PITCH={Math.round(pitch)}° | DRAG TO ROTATE
        </text>
      </svg>

      {(!length || !width) && (
        <span className="text-muted" style={{ fontSize: '0.825rem', marginTop: '4px' }}>
          Enter length and width to view 3D scale representation. Click and drag to rotate.
        </span>
      )}
    </div>
  );
}
