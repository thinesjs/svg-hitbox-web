# Hitbox Labeller Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the station labeller into a general-purpose SVG hitbox labeller that lets users load any SVG, draw rectangular regions, tag them with flexible metadata, and export the data for building interactive overlays.

**Architecture:** Replace all station-specific components with hitbox-oriented ones. The app loads an SVG via file picker, renders it inline with pan/zoom, lets users drag-to-draw rectangles in SVG coordinate space, and edit flexible key-value metadata per hitbox. Data is exported as JSON (re-importable) or TypeScript.

**Tech Stack:** React 18, TypeScript 5, Vite 5, vanilla CSS with CSS variables. No additional dependencies. Use `pnpm` as the package manager.

**Prerequisites:** This directory is not a git repo. Run `git init` before the first commit if you want to track changes.

---

## File Structure

### Files to create:
- `src/types.ts` — Overwrite with `Hitbox` and `HitboxExport` interfaces
- `src/SvgCanvas.tsx` — SVG renderer with pan/zoom, drag-to-draw, hitbox rectangle overlays
- `src/HitboxSidebar.tsx` — Left panel: file picker, hitbox list with search, import/export buttons
- `src/HitboxEditor.tsx` — Bottom popover for editing selected hitbox metadata (key-value fields)

### Files to modify:
- `src/App.tsx` — Complete rewrite: hitbox state management, SVG loading, import/export logic
- `src/main.tsx` — No changes needed

### Files to delete:
- `src/MapView.tsx` — Replaced by `SvgCanvas.tsx`
- `src/Sidebar.tsx` — Replaced by `HitboxSidebar.tsx`
- `src/EditPopover.tsx` — Replaced by `HitboxEditor.tsx`
- `src/rawStations.json` — No longer needed (SVG loaded from file picker)

### Files to keep as-is:
- `src/index.css` — CSS variables and reset still apply
- `src/main.tsx` — Still renders `<App />`

---

## Chunk 1: Data Model, SVG Canvas with Pan/Zoom

### Task 1: Scaffold with types, file picker, SvgCanvas with pan/zoom

This is one atomic task — types, App, and SvgCanvas must all change together to avoid a broken intermediate state.

**Files:**
- Overwrite: `src/types.ts`
- Create: `src/SvgCanvas.tsx`
- Overwrite: `src/App.tsx`
- Delete: `src/MapView.tsx`, `src/Sidebar.tsx`, `src/EditPopover.tsx`, `src/rawStations.json`

- [ ] **Step 1: Write the Hitbox types**

Replace the contents of `src/types.ts` with:

```ts
export interface Hitbox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fields: Record<string, string>;
}

export interface HitboxExport {
  svgFilename: string;
  svgViewBox: string;
  hitboxes: Hitbox[];
}

export interface SvgData {
  filename: string;
  svgText: string;
  viewBox: { x: number; y: number; width: number; height: number };
}
```

- [ ] **Step 2: Create SvgCanvas with pan/zoom**

Create `src/SvgCanvas.tsx` — renders inline SVG with pan/zoom. This initial version has no drawing or hitbox overlay yet; those are added in Task 2.

```tsx
import { useRef, useState, useCallback, useEffect } from "react";
import type { SvgData } from "./types";

interface SvgCanvasProps {
  svgData: SvgData;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export default function SvgCanvas({ svgData }: SvgCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const { width: svgW, height: svgH } = svgData.viewBox;

  // Inject SVG inline
  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    el.innerHTML = svgData.svgText;
    const svg = el.querySelector("svg");
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.position = "absolute";
      svg.style.top = "0";
      svg.style.left = "0";
    }
  }, [svgData]);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fit to container on load
  useEffect(() => {
    if (containerSize.w === 0) return;
    const scaleX = containerSize.w / svgW;
    const scaleY = containerSize.h / svgH;
    const scale = Math.min(scaleX, scaleY) * 0.95;
    const x = (containerSize.w - svgW * scale) / 2;
    const y = (containerSize.h - svgH * scale) / 2;
    setTransform({ x, y, scale });
  }, [containerSize, svgW, svgH]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setTransform((t) => {
      const newScale = Math.min(Math.max(t.scale * factor, 0.1), 20);
      const ratio = newScale / t.scale;
      return { scale: newScale, x: mx - (mx - t.x) * ratio, y: my - (my - t.y) * ratio };
    });
  }, []);

  // Pan
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [transform]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTransform((t) => ({ ...t, x: panStart.current.tx + dx, y: panStart.current.ty + dy }));
  }, [isPanning]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: isPanning ? "grabbing" : "grab",
        background: "#0e1117",
        position: "relative",
      }}
    >
      {/* Zoom indicator */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", gap: 4, alignItems: "center" }}>
        <button onClick={() => setTransform((t) => {
          const newScale = Math.min(t.scale * 1.3, 20);
          const ratio = newScale / t.scale;
          const cx = containerSize.w / 2, cy = containerSize.h / 2;
          return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
        })} style={zoomBtnStyle}>+</button>
        <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 40, textAlign: "center", fontFamily: "monospace" }}>
          {Math.round(transform.scale * 100)}%
        </span>
        <button onClick={() => setTransform((t) => {
          const newScale = Math.max(t.scale / 1.3, 0.1);
          const ratio = newScale / t.scale;
          const cx = containerSize.w / 2, cy = containerSize.h / 2;
          return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
        })} style={zoomBtnStyle}>−</button>
      </div>

      {/* SVG layer */}
      <div
        ref={svgContainerRef}
        style={{
          width: svgW,
          height: svgH,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          background: "#ffffff",
        }}
      />
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};
```

- [ ] **Step 3: Create App with file picker**

Overwrite `src/App.tsx`. This initial version has file picker, renders SvgCanvas, and manages hitbox/draw state (even though drawing isn't wired yet — state is declared here so Chunk 2 only modifies SvgCanvas).

```tsx
import { useState, useCallback } from "react";
import type { SvgData, Hitbox } from "./types";
import SvgCanvas from "./SvgCanvas";

function parseSvgViewBox(svgText: string): { x: number; y: number; width: number; height: number } {
  // Try viewBox attribute first
  const vbMatch = svgText.match(/viewBox="([^"]+)"/);
  if (vbMatch) {
    const [x, y, w, h] = vbMatch[1].split(/[\s,]+/).map(Number);
    return { x, y, width: w, height: h };
  }
  // Fallback: try width/height attributes on the root <svg>
  const wMatch = svgText.match(/<svg[^>]*\bwidth="([\d.]+)/);
  const hMatch = svgText.match(/<svg[^>]*\bheight="([\d.]+)/);
  if (wMatch && hMatch) {
    return { x: 0, y: 0, width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) };
  }
  // Last resort
  return { x: 0, y: 0, width: 800, height: 600 };
}

export default function App() {
  const [svgData, setSvgData] = useState<SvgData | null>(null);
  const [hitboxes, setHitboxes] = useState<Hitbox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);

  const handleLoadSvg = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svg";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setSvgData({
        filename: file.name,
        svgText: text,
        viewBox: parseSvgViewBox(text),
      });
      setHitboxes([]);
      setSelectedId(null);
      setDrawMode(false);
    };
    input.click();
  }, []);

  if (!svgData) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Hitbox Labeller</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Load an SVG to start drawing hitboxes
        </p>
        <button onClick={handleLoadSvg} style={loadBtnStyle}>
          Load SVG
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <SvgCanvas svgData={svgData} />
      </div>
    </div>
  );
}

const loadBtnStyle: React.CSSProperties = {
  padding: "10px 24px",
  fontSize: 14,
  fontWeight: 600,
  border: "none",
  borderRadius: 8,
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
};
```

- [ ] **Step 4: Delete old station-specific files**

```bash
rm src/MapView.tsx src/Sidebar.tsx src/EditPopover.tsx src/rawStations.json
```

- [ ] **Step 5: Verify it compiles**

```bash
pnpm run build
```

Expected: Clean build with no errors. The app shows a "Load SVG" landing page.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold hitbox labeller with types, file picker, and pan/zoom SVG canvas"
```

---

## Chunk 2: Drawing and Rendering Hitboxes

### Task 2: Drag-to-draw hitboxes with overlay rendering

**Files:**
- Overwrite: `src/SvgCanvas.tsx` — full rewrite with draw mode, hitbox overlay, drag preview
- Modify: `src/App.tsx` — wire drawing props to SvgCanvas

- [ ] **Step 1: Rewrite SvgCanvas with drawing and hitbox overlay**

Replace the entire `src/SvgCanvas.tsx` with the complete file below. This adds:
- Props for hitboxes, selectedId, drawMode, callbacks
- `screenToSvg` helper for coordinate conversion
- Draw mode: pointer handlers branch between panning and drawing
- Overlay `<svg>` with matching viewBox for hitbox rectangles and draw preview
- Click-on-background to deselect

```tsx
import { useRef, useState, useCallback, useEffect } from "react";
import type { SvgData, Hitbox } from "./types";

interface SvgCanvasProps {
  svgData: SvgData;
  hitboxes: Hitbox[];
  selectedId: string | null;
  drawMode: boolean;
  onHitboxDrawn: (rect: { x: number; y: number; width: number; height: number }) => void;
  onHitboxClick: (id: string) => void;
  onDeselect: () => void;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export default function SvgCanvas({
  svgData,
  hitboxes,
  selectedId,
  drawMode,
  onHitboxDrawn,
  onHitboxClick,
  onDeselect,
}: SvgCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Drawing state
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const drawStartRef = useRef<{ svgX: number; svgY: number } | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const { width: svgW, height: svgH } = svgData.viewBox;

  // Inject SVG inline
  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    el.innerHTML = svgData.svgText;
    const svg = el.querySelector("svg");
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.position = "absolute";
      svg.style.top = "0";
      svg.style.left = "0";
    }
  }, [svgData]);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fit to container on load
  useEffect(() => {
    if (containerSize.w === 0) return;
    const scaleX = containerSize.w / svgW;
    const scaleY = containerSize.h / svgH;
    const scale = Math.min(scaleX, scaleY) * 0.95;
    const x = (containerSize.w - svgW * scale) / 2;
    const y = (containerSize.h - svgH * scale) / 2;
    setTransform({ x, y, scale });
  }, [containerSize, svgW, svgH]);

  // Convert screen coords to SVG coords
  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const t = transformRef.current;
    return {
      x: (clientX - rect.left - t.x) / t.scale,
      y: (clientY - rect.top - t.y) / t.scale,
    };
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setTransform((t) => {
      const newScale = Math.min(Math.max(t.scale * factor, 0.1), 20);
      const ratio = newScale / t.scale;
      return { scale: newScale, x: mx - (mx - t.x) * ratio, y: my - (my - t.y) * ratio };
    });
  }, []);

  // Pointer down: start pan or draw
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (drawMode && e.button === 0) {
      // Start drawing
      const svgPt = screenToSvg(e.clientX, e.clientY);
      drawStartRef.current = { svgX: svgPt.x, svgY: svgPt.y };
      setDrawRect({ x: svgPt.x, y: svgPt.y, width: 0, height: 0 });
    } else {
      // Start panning
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    }
  }, [drawMode, transform, screenToSvg]);

  // Pointer move: pan or update draw preview
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (drawStartRef.current) {
      const svgPt = screenToSvg(e.clientX, e.clientY);
      const start = drawStartRef.current;
      const x = Math.min(start.svgX, svgPt.x);
      const y = Math.min(start.svgY, svgPt.y);
      const width = Math.abs(svgPt.x - start.svgX);
      const height = Math.abs(svgPt.y - start.svgY);
      setDrawRect({ x, y, width, height });
      return;
    }
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTransform((t) => ({ ...t, x: panStart.current.tx + dx, y: panStart.current.ty + dy }));
  }, [isPanning, screenToSvg]);

  // Pointer up: finish pan or finish draw
  const handlePointerUp = useCallback(() => {
    if (drawStartRef.current && drawRect) {
      // Minimum 5 SVG units each side to count as a hitbox
      if (drawRect.width > 5 && drawRect.height > 5) {
        onHitboxDrawn({ x: drawRect.x, y: drawRect.y, width: drawRect.width, height: drawRect.height });
      }
      drawStartRef.current = null;
      setDrawRect(null);
      return;
    }
    setIsPanning(false);
  }, [drawRect, onHitboxDrawn]);

  // Click on background to deselect (only fires if pointer didn't move much)
  const handleBackgroundClick = useCallback(() => {
    if (!drawMode && selectedId) {
      onDeselect();
    }
  }, [drawMode, selectedId, onDeselect]);

  const cursor = drawMode ? "crosshair" : isPanning ? "grabbing" : "grab";

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleBackgroundClick}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor,
        background: "#0e1117",
        position: "relative",
      }}
    >
      {/* Zoom indicator */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", gap: 4, alignItems: "center" }}>
        <button onClick={() => setTransform((t) => {
          const newScale = Math.min(t.scale * 1.3, 20);
          const ratio = newScale / t.scale;
          const cx = containerSize.w / 2, cy = containerSize.h / 2;
          return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
        })} style={zoomBtnStyle}>+</button>
        <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 40, textAlign: "center", fontFamily: "monospace" }}>
          {Math.round(transform.scale * 100)}%
        </span>
        <button onClick={() => setTransform((t) => {
          const newScale = Math.max(t.scale / 1.3, 0.1);
          const ratio = newScale / t.scale;
          const cx = containerSize.w / 2, cy = containerSize.h / 2;
          return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
        })} style={zoomBtnStyle}>−</button>
      </div>

      {/* SVG background layer */}
      <div
        ref={svgContainerRef}
        style={{
          width: svgW,
          height: svgH,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          background: "#ffffff",
        }}
      />

      {/* Hitbox overlay SVG */}
      <svg
        width={svgW}
        height={svgH}
        viewBox={`${svgData.viewBox.x} ${svgData.viewBox.y} ${svgW} ${svgH}`}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      >
        <g style={{ pointerEvents: "auto" }}>
          {/* Existing hitboxes */}
          {hitboxes.map((hb) => {
            const isSelected = hb.id === selectedId;
            const label = hb.fields.stop || hb.fields.route || hb.fields.mode || "";
            return (
              <g key={hb.id}>
                <rect
                  x={hb.x}
                  y={hb.y}
                  width={hb.width}
                  height={hb.height}
                  fill={isSelected ? "rgba(88, 166, 255, 0.25)" : "rgba(88, 166, 255, 0.12)"}
                  stroke={isSelected ? "#58a6ff" : "#58a6ff80"}
                  strokeWidth={isSelected ? 2 / transform.scale : 1 / transform.scale}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHitboxClick(hb.id);
                  }}
                />
                {label && transform.scale > 0.5 && (
                  <text
                    x={hb.x + hb.width / 2}
                    y={hb.y + hb.height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10 / transform.scale}
                    fill="#58a6ff"
                    style={{ pointerEvents: "none", fontWeight: 600 }}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Draw-in-progress rectangle */}
          {drawRect && drawRect.width > 0 && drawRect.height > 0 && (
            <rect
              x={drawRect.x}
              y={drawRect.y}
              width={drawRect.width}
              height={drawRect.height}
              fill="rgba(88, 166, 255, 0.15)"
              stroke="#58a6ff"
              strokeWidth={1.5 / transform.scale}
              strokeDasharray={`${4 / transform.scale} ${3 / transform.scale}`}
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      </svg>

      {/* Draw mode indicator */}
      {drawMode && (
        <div style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          background: "var(--accent)",
          color: "#fff",
          padding: "4px 12px",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
        }}>
          Draw Mode — drag to create hitbox
        </div>
      )}
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};
```

- [ ] **Step 2: Update App.tsx to wire drawing props**

Update `src/App.tsx` to pass all new props to SvgCanvas:

```tsx
import { useState, useCallback } from "react";
import type { SvgData, Hitbox } from "./types";
import SvgCanvas from "./SvgCanvas";

function parseSvgViewBox(svgText: string): { x: number; y: number; width: number; height: number } {
  const vbMatch = svgText.match(/viewBox="([^"]+)"/);
  if (vbMatch) {
    const [x, y, w, h] = vbMatch[1].split(/[\s,]+/).map(Number);
    return { x, y, width: w, height: h };
  }
  const wMatch = svgText.match(/<svg[^>]*\bwidth="([\d.]+)/);
  const hMatch = svgText.match(/<svg[^>]*\bheight="([\d.]+)/);
  if (wMatch && hMatch) {
    return { x: 0, y: 0, width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) };
  }
  return { x: 0, y: 0, width: 800, height: 600 };
}

export default function App() {
  const [svgData, setSvgData] = useState<SvgData | null>(null);
  const [hitboxes, setHitboxes] = useState<Hitbox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);

  const handleLoadSvg = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svg";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setSvgData({
        filename: file.name,
        svgText: text,
        viewBox: parseSvgViewBox(text),
      });
      setHitboxes([]);
      setSelectedId(null);
      setDrawMode(false);
    };
    input.click();
  }, []);

  const handleHitboxDrawn = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const newHitbox: Hitbox = {
      id: crypto.randomUUID(),
      ...rect,
      fields: {},
    };
    setHitboxes((prev) => [...prev, newHitbox]);
    setSelectedId(newHitbox.id);
    setDrawMode(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setHitboxes((prev) => prev.filter((h) => h.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  if (!svgData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Hitbox Labeller</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Load an SVG to start drawing hitboxes</p>
        <button onClick={handleLoadSvg} style={loadBtnStyle}>Load SVG</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar will be added in Task 3 */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <SvgCanvas
          svgData={svgData}
          hitboxes={hitboxes}
          selectedId={selectedId}
          drawMode={drawMode}
          onHitboxDrawn={handleHitboxDrawn}
          onHitboxClick={setSelectedId}
          onDeselect={() => setSelectedId(null)}
        />
        {/* Temporary draw mode toggle until sidebar exists */}
        <button
          onClick={() => setDrawMode((v) => !v)}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 10,
            padding: "6px 12px",
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: drawMode ? "var(--accent)" : "var(--surface)",
            color: drawMode ? "#fff" : "var(--text-muted)",
          }}
        >
          {drawMode ? "Drawing..." : "Draw"}
        </button>
      </div>
    </div>
  );
}

const loadBtnStyle: React.CSSProperties = {
  padding: "10px 24px",
  fontSize: 14,
  fontWeight: 600,
  border: "none",
  borderRadius: 8,
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
};
```

- [ ] **Step 3: Verify drawing works**

```bash
pnpm run build
```

Expected: Clean build. Test manually: load an SVG, click Draw, drag to create a rectangle.

- [ ] **Step 4: Commit**

```bash
git add src/SvgCanvas.tsx src/App.tsx
git commit -m "feat: drag-to-draw hitbox rectangles with overlay rendering"
```

---

## Chunk 3: Sidebar, Metadata Editor, Import/Export

### Task 3: Sidebar with hitbox list, search, and all App logic

All remaining features are wired together in this task. The sidebar, editor, import/export, and keyboard shortcuts are added as a group because the sidebar references all export handlers — they must exist at compile time.

**Files:**
- Create: `src/HitboxSidebar.tsx`
- Create: `src/HitboxEditor.tsx`
- Overwrite: `src/App.tsx` — final version with all features

- [ ] **Step 1: Create HitboxSidebar component**

Create `src/HitboxSidebar.tsx` with hitbox list, search filter, draw toggle, and import/export buttons:

```tsx
import { useState } from "react";
import type { Hitbox } from "./types";

interface HitboxSidebarProps {
  hitboxes: Hitbox[];
  selectedId: string | null;
  svgFilename: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onLoadSvg: () => void;
  onImport: () => void;
  onExportJSON: () => void;
  onExportTS: () => void;
  drawMode: boolean;
  onToggleDrawMode: () => void;
}

export default function HitboxSidebar({
  hitboxes,
  selectedId,
  svgFilename,
  onSelect,
  onDelete,
  onLoadSvg,
  onImport,
  onExportJSON,
  onExportTS,
  drawMode,
  onToggleDrawMode,
}: HitboxSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? hitboxes.filter((hb) => {
        const q = search.toLowerCase();
        return Object.values(hb.fields).some((v) => v.toLowerCase().includes(q)) || hb.id.startsWith(q);
      })
    : hitboxes;

  return (
    <div
      style={{
        width: 280,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 16px 12px" }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
          Hitbox Labeller
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {svgFilename || "No SVG loaded"}
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 6 }}>
        <button onClick={onLoadSvg} style={toolBtn}>Load SVG</button>
        <button
          onClick={onToggleDrawMode}
          style={{
            ...toolBtn,
            background: drawMode ? "var(--accent)" : "transparent",
            color: drawMode ? "#fff" : "var(--text-muted)",
            border: drawMode ? "1px solid var(--accent)" : "1px solid var(--border)",
          }}
        >
          Draw
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "0 16px 8px" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hitboxes..."
          style={{
            width: "100%",
            padding: "5px 8px",
            fontSize: 12,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text)",
            outline: "none",
          }}
        />
      </div>

      {/* Hitbox count */}
      <div style={{ padding: "0 16px 4px", fontSize: 12, color: "var(--text-muted)" }}>
        {filtered.length}{search ? ` / ${hitboxes.length}` : ""} hitbox{hitboxes.length !== 1 ? "es" : ""}
      </div>

      {/* Hitbox list */}
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {filtered.map((hb) => {
          const label = hb.fields.stop || hb.fields.route || hb.fields.mode || hb.id.slice(0, 8);
          const isSelected = hb.id === selectedId;
          return (
            <div
              key={hb.id}
              onClick={() => onSelect(hb.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                background: isSelected ? "var(--surface-hover)" : "transparent",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)", flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                {Math.round(hb.width)}x{Math.round(hb.height)}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(hb.id); }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, padding: "2px 4px", flexShrink: 0 }}
                title="Delete hitbox"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Keyboard hints */}
      <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
        <div><kbd style={kbdStyle}>D</kbd> Toggle draw mode</div>
        <div><kbd style={kbdStyle}>Delete</kbd> Remove selected</div>
        <div><kbd style={kbdStyle}>Esc</kbd> Deselect</div>
        <div><kbd style={kbdStyle}>Scroll</kbd> Zoom</div>
      </div>

      {/* Import/Export */}
      <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={onImport} style={btnSecondary}>Import (.json)</button>
        <button onClick={onExportJSON} style={btnSecondary}>Save (.json)</button>
        <button onClick={onExportTS} style={btnPrimary}>Export (.ts)</button>
      </div>
    </div>
  );
}

const toolBtn: React.CSSProperties = {
  flex: 1,
  padding: "5px 8px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "transparent",
  color: "var(--text-muted)",
};

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 5px",
  fontSize: 10,
  background: "var(--border)",
  borderRadius: 3,
  fontFamily: "monospace",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  border: "none",
  borderRadius: 6,
  background: "var(--accent)",
  color: "#fff",
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "transparent",
  color: "var(--text-muted)",
};
```

- [ ] **Step 2: Create HitboxEditor component**

Create `src/HitboxEditor.tsx` — bottom popover with built-in fields (mode, route, stop), custom key-value pairs, and add/remove controls. Uses live-save via onChange (changes are applied immediately):

```tsx
import { useState, useRef, useEffect, useCallback } from "react";
import type { Hitbox } from "./types";

interface HitboxEditorProps {
  hitbox: Hitbox;
  onFieldsChange: (id: string, fields: Record<string, string>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const BUILTIN_KEYS = ["mode", "route", "stop"];

export default function HitboxEditor({ hitbox, onFieldsChange, onDelete, onClose }: HitboxEditorProps) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFields({ ...hitbox.fields });
    setNewKey("");
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [hitbox.id]);

  const updateField = useCallback((key: string, value: string) => {
    const updated = { ...fields, [key]: value };
    setFields(updated);
    onFieldsChange(hitbox.id, updated);
  }, [fields, hitbox.id, onFieldsChange]);

  const removeField = useCallback((key: string) => {
    const updated = { ...fields };
    delete updated[key];
    setFields(updated);
    onFieldsChange(hitbox.id, updated);
  }, [fields, hitbox.id, onFieldsChange]);

  const addCustomField = useCallback(() => {
    const key = newKey.trim();
    if (!key || key in fields) return;
    updateField(key, "");
    setNewKey("");
  }, [newKey, fields, updateField]);

  const customKeys = Object.keys(fields).filter((k) => !BUILTIN_KEYS.includes(k));

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        width: 480,
        maxHeight: "50vh",
        overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Edit Hitbox</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
            {hitbox.id.slice(0, 8)} · {Math.round(hitbox.x)},{Math.round(hitbox.y)} · {Math.round(hitbox.width)}x{Math.round(hitbox.height)}
          </div>
        </div>
        <button
          onClick={() => onDelete(hitbox.id)}
          style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, marginRight: 8, cursor: "pointer" }}
        >
          Delete
        </button>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}
        >
          ×
        </button>
      </div>

      {/* Built-in fields */}
      {BUILTIN_KEYS.map((key, i) => (
        <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <label style={{ width: 60, fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>{key}</label>
          <input
            ref={i === 0 ? firstInputRef : undefined}
            type="text"
            value={fields[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={key}
            style={inputStyle}
          />
        </div>
      ))}

      {/* Custom fields */}
      {customKeys.map((key) => (
        <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <label style={{ width: 60, fontSize: 12, color: "var(--text-muted)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>
            {key}
          </label>
          <input
            type="text"
            value={fields[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => removeField(key)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}
            title="Remove field"
          >
            ×
          </button>
        </div>
      ))}

      {/* Add custom field */}
      <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(); } }}
          placeholder="New field name..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={addCustomField}
          disabled={!newKey.trim()}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "transparent",
            color: "var(--text-muted)",
            opacity: newKey.trim() ? 1 : 0.4,
            cursor: "pointer",
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 10px",
  fontSize: 13,
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--text)",
  outline: "none",
};
```

- [ ] **Step 3: Write final App.tsx with all features**

Overwrite `src/App.tsx` with the complete final version including sidebar, editor, import/export, and keyboard shortcuts:

```tsx
import { useState, useCallback, useEffect } from "react";
import type { SvgData, Hitbox, HitboxExport } from "./types";
import SvgCanvas from "./SvgCanvas";
import HitboxSidebar from "./HitboxSidebar";
import HitboxEditor from "./HitboxEditor";

function parseSvgViewBox(svgText: string): { x: number; y: number; width: number; height: number } {
  const vbMatch = svgText.match(/viewBox="([^"]+)"/);
  if (vbMatch) {
    const [x, y, w, h] = vbMatch[1].split(/[\s,]+/).map(Number);
    return { x, y, width: w, height: h };
  }
  const wMatch = svgText.match(/<svg[^>]*\bwidth="([\d.]+)/);
  const hMatch = svgText.match(/<svg[^>]*\bheight="([\d.]+)/);
  if (wMatch && hMatch) {
    return { x: 0, y: 0, width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) };
  }
  return { x: 0, y: 0, width: 800, height: 600 };
}

export default function App() {
  const [svgData, setSvgData] = useState<SvgData | null>(null);
  const [hitboxes, setHitboxes] = useState<Hitbox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);

  const handleLoadSvg = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svg";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setSvgData({
        filename: file.name,
        svgText: text,
        viewBox: parseSvgViewBox(text),
      });
      setHitboxes([]);
      setSelectedId(null);
      setDrawMode(false);
    };
    input.click();
  }, []);

  const handleHitboxDrawn = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const newHitbox: Hitbox = {
      id: crypto.randomUUID(),
      ...rect,
      fields: {},
    };
    setHitboxes((prev) => [...prev, newHitbox]);
    setSelectedId(newHitbox.id);
    setDrawMode(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setHitboxes((prev) => prev.filter((h) => h.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const handleFieldsChange = useCallback((id: string, fields: Record<string, string>) => {
    setHitboxes((prev) => prev.map((h) => (h.id === id ? { ...h, fields } : h)));
  }, []);

  // --- Import/Export ---

  const handleExportJSON = useCallback(() => {
    if (!svgData) return;
    const data: HitboxExport = {
      svgFilename: svgData.filename,
      svgViewBox: `${svgData.viewBox.x} ${svgData.viewBox.y} ${svgData.viewBox.width} ${svgData.viewBox.height}`,
      hitboxes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${svgData.filename.replace(/\.svg$/, "")}-hitboxes.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svgData, hitboxes]);

  const handleImportJSON = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text) as HitboxExport;
        if (!Array.isArray(data.hitboxes)) {
          alert("Invalid hitbox JSON: missing hitboxes array");
          return;
        }
        // Validate structure of each hitbox
        const valid = data.hitboxes.every(
          (h) => typeof h.id === "string" && typeof h.x === "number" && typeof h.y === "number" &&
                 typeof h.width === "number" && typeof h.height === "number" && typeof h.fields === "object"
        );
        if (!valid) {
          alert("Invalid hitbox JSON: hitbox entries have missing or invalid fields");
          return;
        }
        // Warn if SVG filename doesn't match
        if (svgData && data.svgFilename && data.svgFilename !== svgData.filename) {
          const proceed = confirm(
            `This hitbox file was created for "${data.svgFilename}" but you have "${svgData.filename}" loaded. Import anyway?`
          );
          if (!proceed) return;
        }
        setHitboxes(data.hitboxes);
        setSelectedId(null);
      } catch {
        alert("Invalid JSON file");
      }
    };
    input.click();
  }, [svgData]);

  const handleExportTS = useCallback(() => {
    if (!svgData) return;
    const lines: string[] = [];
    lines.push("export interface Hitbox {");
    lines.push("  id: string;");
    lines.push("  x: number;");
    lines.push("  y: number;");
    lines.push("  width: number;");
    lines.push("  height: number;");
    lines.push("  fields: Record<string, string>;");
    lines.push("}\n");
    lines.push(`export const svgFilename = ${JSON.stringify(svgData.filename)};\n`);
    lines.push(`export const svgViewBox = "${svgData.viewBox.x} ${svgData.viewBox.y} ${svgData.viewBox.width} ${svgData.viewBox.height}";\n`);
    lines.push("export const hitboxes: Hitbox[] = " + JSON.stringify(hitboxes, null, 2) + ";\n");

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${svgData.filename.replace(/\.svg$/, "")}-hitboxes.ts`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svgData, hitboxes]);

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        setDrawMode((v) => !v);
      } else if (e.key === "Escape") {
        if (drawMode) {
          setDrawMode(false);
        } else {
          setSelectedId(null);
        }
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        handleDelete(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawMode, selectedId, handleDelete]);

  // --- Render ---

  const selectedHitbox = selectedId ? hitboxes.find((h) => h.id === selectedId) ?? null : null;

  if (!svgData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Hitbox Labeller</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Load an SVG to start drawing hitboxes</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleLoadSvg} style={loadBtnStyle}>Load SVG</button>
          <button onClick={handleImportJSON} style={{ ...loadBtnStyle, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            Import JSON
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <HitboxSidebar
        hitboxes={hitboxes}
        selectedId={selectedId}
        svgFilename={svgData.filename}
        onSelect={setSelectedId}
        onDelete={handleDelete}
        onLoadSvg={handleLoadSvg}
        onImport={handleImportJSON}
        onExportJSON={handleExportJSON}
        onExportTS={handleExportTS}
        drawMode={drawMode}
        onToggleDrawMode={() => setDrawMode((v) => !v)}
      />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <SvgCanvas
          svgData={svgData}
          hitboxes={hitboxes}
          selectedId={selectedId}
          drawMode={drawMode}
          onHitboxDrawn={handleHitboxDrawn}
          onHitboxClick={setSelectedId}
          onDeselect={() => setSelectedId(null)}
        />
        {selectedHitbox && (
          <HitboxEditor
            hitbox={selectedHitbox}
            onFieldsChange={handleFieldsChange}
            onDelete={handleDelete}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

const loadBtnStyle: React.CSSProperties = {
  padding: "10px 24px",
  fontSize: 14,
  fontWeight: 600,
  border: "none",
  borderRadius: 8,
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
};
```

- [ ] **Step 4: Verify everything compiles**

```bash
pnpm run build
```

Expected: Clean build with no errors.

- [ ] **Step 5: Manual end-to-end test**

Run `pnpm run dev` and test:
1. Load an SVG via file picker
2. Press D to enter draw mode, drag to create a rectangle
3. Verify hitbox appears in sidebar list and overlay
4. Click hitbox to select, fill in mode/route/stop fields
5. Add a custom field
6. Draw more hitboxes, search in sidebar
7. Delete a hitbox via sidebar or Delete key
8. Export JSON, reload page, import JSON — verify hitboxes restore
9. Check filename mismatch warning on import
10. Export .ts, verify file contents

- [ ] **Step 6: Commit**

```bash
git add src/HitboxSidebar.tsx src/HitboxEditor.tsx src/App.tsx
git commit -m "feat: add sidebar, metadata editor, import/export, and keyboard shortcuts"
```

---

## Summary of deliverables

| Task | What it delivers |
|------|-----------------|
| 1 | Types, file picker, SvgCanvas with pan/zoom, delete old station files |
| 2 | Drag-to-draw rectangles, hitbox overlay rendering with labels, deselect on click |
| 3 | Sidebar with search/filter, metadata editor, JSON/TS import/export, keyboard shortcuts |
