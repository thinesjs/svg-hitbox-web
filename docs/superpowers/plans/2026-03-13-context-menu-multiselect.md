# Context Menu, Multi-Selection, Z-Order, Lock & Flip — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Figma-style context menu, multi-selection, z-order controls, lock/unlock, and flip to the hitbox labeller.

**Architecture:** Migrate from single selection (`selectedId: string | null`) to multi-selection (`selectedIds: string[]`). Extract canvas interaction logic into `useCanvasInteractions` hook. Add shadcn `ContextMenu` wrapper around canvas. All z-order/flip/lock operations are pure functions in `hitboxGeometry.ts`.

**Tech Stack:** React 18, TypeScript 5, Vite 5, pnpm, shadcn/ui (context-menu), Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-13-context-menu-multiselect-design.md`

---

## Chunk 1: Foundation

### Task 1: Types, Geometry Functions, and shadcn Context Menu Install

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hitboxGeometry.ts`
- Install: shadcn context-menu component

This task adds the `locked` field, exports `ViewBox`, and implements all pure geometry functions (z-order, flip, marquee intersection). No UI changes — just the data layer.

- [ ] **Step 1: Add `locked` to HitboxBase and export ViewBox in types.ts**

Replace the full `src/types.ts` with:

```ts
// --- Shape types (discriminated union) ---

export interface HitboxBase {
  id: string;
  fields: Record<string, string>;
  locked?: boolean;
}

export interface RectHitbox extends HitboxBase {
  shape: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleHitbox extends HitboxBase {
  shape: "circle";
  cx: number;
  cy: number;
  r: number;
}

export type Hitbox = RectHitbox | CircleHitbox;

// --- Tool state ---

export type ToolMode = "select" | "draw";
export type DrawShape = "rect" | "circle";

// --- Geometry ---

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface HandleInfo {
  position: HandlePosition;
  svgX: number;
  svgY: number;
  cursor: string;
}

// --- Export/Import ---

export interface HitboxExport {
  svgFilename: string;
  svgViewBox: string;
  hitboxes: Hitbox[];
}

export interface SvgData {
  filename: string;
  svgText: string;
  viewBox: ViewBox;
}
```

- [ ] **Step 2: Update hitboxGeometry.ts — use imported ViewBox, add z-order functions**

In `src/hitboxGeometry.ts`:
- Change the import to include `ViewBox`: `import type { Hitbox, RectHitbox, CircleHitbox, BBox, HandlePosition, HandleInfo, ViewBox } from "./types";`
- Remove the local `interface ViewBox { ... }` definition (lines 76-81)
- Add these z-order functions at the end of the file:

```ts
// --- Z-order operations ---

export function bringToFront(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[] {
  const sel = new Set(selectedIds);
  const unselected = hitboxes.filter((h) => !sel.has(h.id));
  const selected = hitboxes.filter((h) => sel.has(h.id));
  return [...unselected, ...selected];
}

export function sendToBack(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[] {
  const sel = new Set(selectedIds);
  const unselected = hitboxes.filter((h) => !sel.has(h.id));
  const selected = hitboxes.filter((h) => sel.has(h.id));
  return [...selected, ...unselected];
}

export function bringForward(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[] {
  const sel = new Set(selectedIds);
  const result = [...hitboxes];
  // Process from top to bottom (highest index first)
  for (let i = result.length - 2; i >= 0; i--) {
    if (sel.has(result[i].id) && !sel.has(result[i + 1].id)) {
      [result[i], result[i + 1]] = [result[i + 1], result[i]];
    }
  }
  return result;
}

export function sendBackward(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[] {
  const sel = new Set(selectedIds);
  const result = [...hitboxes];
  // Process from bottom to top (lowest index first)
  for (let i = 1; i < result.length; i++) {
    if (sel.has(result[i].id) && !sel.has(result[i - 1].id)) {
      [result[i], result[i - 1]] = [result[i - 1], result[i]];
    }
  }
  return result;
}
```

- [ ] **Step 3: Add flip functions to hitboxGeometry.ts**

Append to `src/hitboxGeometry.ts`:

```ts
// --- Flip operations (multi-selection only) ---

export function selectionBounds(hitboxes: Hitbox[], selectedIds: string[]): BBox {
  const sel = new Set(selectedIds);
  const selected = hitboxes.filter((h) => sel.has(h.id));
  if (selected.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const h of selected) {
    const b = hitboxBounds(h);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function flipHorizontal(hitboxes: Hitbox[], selectedIds: string[], vb: ViewBox): Hitbox[] {
  const sel = new Set(selectedIds);
  const bounds = selectionBounds(hitboxes, selectedIds);
  const centerX = bounds.x + bounds.width / 2;
  return hitboxes.map((h) => {
    if (!sel.has(h.id) || h.locked) return h;
    const hb = hitboxBounds(h);
    const oldCenterX = hb.x + hb.width / 2;
    const newCenterX = centerX + (centerX - oldCenterX);
    if (h.shape === "circle") {
      const clamped = clampCircleToViewBox(newCenterX, h.cy, h.r, vb);
      return { ...h, cx: clamped.cx, cy: clamped.cy, r: clamped.r };
    }
    const newX = newCenterX - h.width / 2;
    const clamped = clampRectToViewBox(newX, h.y, h.width, h.height, vb);
    return { ...h, ...clamped };
  });
}

export function flipVertical(hitboxes: Hitbox[], selectedIds: string[], vb: ViewBox): Hitbox[] {
  const sel = new Set(selectedIds);
  const bounds = selectionBounds(hitboxes, selectedIds);
  const centerY = bounds.y + bounds.height / 2;
  return hitboxes.map((h) => {
    if (!sel.has(h.id) || h.locked) return h;
    const hb = hitboxBounds(h);
    const oldCenterY = hb.y + hb.height / 2;
    const newCenterY = centerY + (centerY - oldCenterY);
    if (h.shape === "circle") {
      const clamped = clampCircleToViewBox(h.cx, newCenterY, h.r, vb);
      return { ...h, cx: clamped.cx, cy: clamped.cy, r: clamped.r };
    }
    const newY = newCenterY - h.height / 2;
    const clamped = clampRectToViewBox(h.x, newY, h.width, h.height, vb);
    return { ...h, ...clamped };
  });
}
```

- [ ] **Step 4: Add marquee intersection helper to hitboxGeometry.ts**

Append to `src/hitboxGeometry.ts`:

```ts
// --- Marquee selection ---

/** Returns IDs of hitboxes whose bounding box intersects the given rect (in SVG coords). */
export function hitboxesInMarquee(
  hitboxes: Hitbox[],
  marquee: BBox
): string[] {
  return hitboxes
    .filter((h) => {
      const b = hitboxBounds(h);
      return (
        b.x < marquee.x + marquee.width &&
        b.x + b.width > marquee.x &&
        b.y < marquee.y + marquee.height &&
        b.y + b.height > marquee.y
      );
    })
    .map((h) => h.id);
}
```

Note: `selectionBounds` is already declared with `export` above.

- [ ] **Step 5: Install shadcn context-menu**

Run: `pnpm dlx shadcn@latest add context-menu`

- [ ] **Step 6: Verify build**

Run: `pnpm run build`
Expected: Build succeeds with 0 errors. All existing functionality unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/hitboxGeometry.ts src/components/ui/context-menu.tsx package.json pnpm-lock.yaml
git commit -m "feat: add locked field, ViewBox export, z-order/flip/marquee geometry, context-menu component"
```

**Note on migrateHitbox:** The `locked?: boolean` field is optional, so `migrateHitbox` in App.tsx already handles it correctly — missing `locked` naturally becomes `undefined`, which is treated as unlocked. No changes needed.

---

### Task 2: App.tsx State Migration — Multi-Selection, Clipboard, Keyboard Shortcuts

**Files:**
- Modify: `src/App.tsx`

This task migrates the core state management from single selection to multi-selection. Every handler that references `selectedId` is updated to use `selectedIds: string[]`. Clipboard becomes `Hitbox[]`. Keyboard shortcuts are updated for ⌘D, ⌘A, and multi-select operations.

**Context for implementer:** Read the current `src/App.tsx` (358 lines). The key changes are:
- `selectedId: string | null` → `selectedIds: string[]` (empty = nothing)
- `clipboard: Hitbox | null` → `clipboard: Hitbox[]`
- All `setSelectedId(x)` → `setSelectedIds([x])` or `setSelectedIds([])`
- Delete must skip locked hitboxes
- Add ⌘D (duplicate), ⌘A (select all)
- Copy/paste operates on all selected hitboxes
- New `handleToggleSelect(id)` for Shift+click
- New handlers for z-order, lock, and flip operations (called from context menu)
- Refs (`hitboxesRef`, `clipboardRef`) update to match new types
- `selectedIdsRef` needed for keyboard handler

- [ ] **Step 1: Migrate state declarations and refs**

In `src/App.tsx`, replace the state + ref section (lines 41-52):

```ts
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [drawShape, setDrawShape] = useState<DrawShape>("rect");
  const [clipboard, setClipboard] = useState<Hitbox[]>([]);

  // Refs for keyboard handler (avoid stale closures without extra deps)
  const hitboxesRef = useRef(hitboxes);
  hitboxesRef.current = hitboxes;
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
```

Update the import to include the new geometry functions:
```ts
import type { SvgData, Hitbox, HitboxExport, ToolMode, DrawShape, ViewBox } from "./types";
```

Add geometry imports at the top:
```ts
import {
  bringToFront, bringForward, sendBackward, sendToBack,
  flipHorizontal, flipVertical, selectionBounds,
} from "./hitboxGeometry";
```

- [ ] **Step 2: Update localStorage persistence**

The load effect (lines 54-68) should change `setSelectedId` references:
- Remove any `setSelectedId` call in the load effect (we don't persist selection)

The save effect is fine — it saves `svgData` and `hitboxes`, not selection.

- [ ] **Step 3: Update all handler callbacks**

Replace/update each handler:

`handleLoadSvg`: change `setSelectedId(null)` → `setSelectedIds([])`

`handleHitboxDrawn`: change to `setSelectedIds([hitbox.id])`

`handleDelete`: Rewrite to handle multi-delete and skip locked:
```ts
  const handleDeleteSelected = useCallback(() => {
    setHitboxes((prev) => prev.filter((h) => {
      if (!selectedIdsRef.current.includes(h.id)) return true;
      return !!h.locked; // keep locked hitboxes
    }));
    setSelectedIds((prev) => {
      // Keep only locked hitboxes in selection
      const lockedIds = new Set(
        hitboxesRef.current.filter((h) => h.locked && prev.includes(h.id)).map((h) => h.id)
      );
      return prev.filter((id) => lockedIds.has(id));
    });
  }, []);
```

Also keep a single-delete handler for sidebar:
```ts
  const handleDeleteSingle = useCallback((id: string) => {
    const hb = hitboxesRef.current.find((h) => h.id === id);
    if (hb?.locked) return;
    setHitboxes((prev) => prev.filter((h) => h.id !== id));
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
  }, []);
```

`handleSelect`: replaces selection with single id:
```ts
  const handleSelect = useCallback((id: string) => {
    setSelectedIds([id]);
    setToolMode("select");
  }, []);
```

New `handleToggleSelect`:
```ts
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  }, []);
```

`handleImportJSON`: change `setSelectedId(null)` → `setSelectedIds([])`

- [ ] **Step 4: Add z-order, lock, and flip handler callbacks**

```ts
  // --- Z-order ---
  const handleBringToFront = useCallback(() => {
    setHitboxes((prev) => bringToFront(prev, selectedIdsRef.current));
  }, []);
  const handleBringForward = useCallback(() => {
    setHitboxes((prev) => bringForward(prev, selectedIdsRef.current));
  }, []);
  const handleSendBackward = useCallback(() => {
    setHitboxes((prev) => sendBackward(prev, selectedIdsRef.current));
  }, []);
  const handleSendToBack = useCallback(() => {
    setHitboxes((prev) => sendToBack(prev, selectedIdsRef.current));
  }, []);

  // --- Lock ---
  const handleLock = useCallback(() => {
    setHitboxes((prev) =>
      prev.map((h) => selectedIdsRef.current.includes(h.id) ? { ...h, locked: true } : h)
    );
  }, []);
  const handleUnlock = useCallback(() => {
    setHitboxes((prev) =>
      prev.map((h) => selectedIdsRef.current.includes(h.id) ? { ...h, locked: false } : h)
    );
  }, []);

  // --- Flip ---
  const handleFlipHorizontal = useCallback(() => {
    if (!svgData) return;
    setHitboxes((prev) => flipHorizontal(prev, selectedIdsRef.current, svgData.viewBox));
  }, [svgData]);
  const handleFlipVertical = useCallback(() => {
    if (!svgData) return;
    setHitboxes((prev) => flipVertical(prev, selectedIdsRef.current, svgData.viewBox));
  }, [svgData]);
```

- [ ] **Step 5: Rewrite keyboard shortcuts handler**

Replace the entire keyboard shortcuts `useEffect` with:

```ts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const ids = selectedIdsRef.current;
      const hbs = hitboxesRef.current;
      const cb = clipboardRef.current;

      // Copy/paste/duplicate/select-all with Ctrl/Cmd
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "c":
            if (ids.length > 0) {
              e.preventDefault();
              const selected = hbs.filter((h) => ids.includes(h.id));
              setClipboard(selected);
            }
            return;
          case "v":
            if (cb.length > 0) {
              e.preventDefault();
              const newHbs = cb.map((h) => {
                const newId = crypto.randomUUID();
                if (h.shape === "circle") {
                  return { ...h, id: newId, cx: h.cx + 20, cy: h.cy + 20, locked: false, fields: { ...h.fields } };
                }
                return { ...h, id: newId, x: h.x + 20, y: h.y + 20, locked: false, fields: { ...h.fields } };
              });
              setHitboxes((prev) => [...prev, ...newHbs]);
              setSelectedIds(newHbs.map((h) => h.id));
            }
            return;
          case "d":
            if (ids.length > 0) {
              e.preventDefault();
              const selected = hbs.filter((h) => ids.includes(h.id));
              const dupes = selected.map((h) => {
                const newId = crypto.randomUUID();
                if (h.shape === "circle") {
                  return { ...h, id: newId, cx: h.cx + 20, cy: h.cy + 20, locked: false, fields: { ...h.fields } };
                }
                return { ...h, id: newId, x: h.x + 20, y: h.y + 20, locked: false, fields: { ...h.fields } };
              });
              setHitboxes((prev) => [...prev, ...dupes]);
              setSelectedIds(dupes.map((h) => h.id));
            }
            return;
          case "a":
            e.preventDefault();
            setSelectedIds(hbs.map((h) => h.id));
            return;
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          e.preventDefault();
          setToolMode("select");
          break;
        case "d":
          e.preventDefault();
          setToolMode("draw");
          break;
        case "r":
          e.preventDefault();
          setDrawShape("rect");
          break;
        case "c":
          e.preventDefault();
          setDrawShape("circle");
          break;
        case "escape":
          if (toolMode === "draw") {
            setToolMode("select");
          } else if (ids.length > 0) {
            setSelectedIds([]);
          }
          break;
        case "delete":
        case "backspace":
          if (ids.length > 0) {
            e.preventDefault();
            handleDeleteSelected();
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toolMode, handleDeleteSelected]);
```

- [ ] **Step 6: Update render section**

Replace the `selectedHitbox` computation and props:

```ts
  const selectedHitbox = selectedIds.length === 1
    ? hitboxes.find((h) => h.id === selectedIds[0]) ?? null
    : null;
```

Update `HitboxSidebar` props: `selectedId={selectedId}` → `selectedIds={selectedIds}`, add `onToggleSelect={handleToggleSelect}`.

Update `SvgCanvas` props: `selectedId={selectedId}` → `selectedIds={selectedIds}`, `onDeselect={() => setSelectedIds([])}`.

Update editor visibility: `{selectedHitbox && (` stays the same since `selectedHitbox` is only non-null for single selection.

Update `handleFieldsChange` and `handleDelete` props on `HitboxEditor` to use `handleDeleteSingle`.

- [ ] **Step 7: Verify build**

Run: `pnpm run build`
Expected: TypeScript errors in SvgCanvas.tsx and HitboxSidebar.tsx because their props interfaces still expect `selectedId`. This is expected — those files are updated in Tasks 3 and 4. The build may fail here; that's OK. Verify App.tsx itself has no type errors by checking the error output is only from downstream components.

**Alternative:** If you want a clean build at this point, you can temporarily add adapter props in App.tsx that compute `selectedId` from `selectedIds[0]` and pass that. But this is wasteful — the downstream tasks will fix the types.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: migrate App.tsx to multi-selection state model with z-order/lock/flip handlers"
```

---

## Chunk 2: Canvas and Sidebar

### Task 3: SvgCanvas — Extract useCanvasInteractions Hook + Multi-Select Interactions

**Files:**
- Create: `src/useCanvasInteractions.ts`
- Modify: `src/SvgCanvas.tsx`

This is the largest task. Extract all pointer interaction logic from `SvgCanvas.tsx` into a custom hook, then extend it with: marquee selection, Space+drag panning, Shift+click toggle (on pointer-up), group move, locked hitbox guards, and Alt+drag multi-duplication.

**Context for implementer:** Read the current `src/SvgCanvas.tsx` (540 lines). The interaction logic (lines 34-357) becomes the hook. SvgCanvas keeps only rendering (lines 359-539). The hook returns: `{ cursor, transform, drawPreview, marqueeRect, containerRef, svgContainerRef, handlers }`.

- [ ] **Step 1: Create useCanvasInteractions.ts**

Create `src/useCanvasInteractions.ts`. This hook encapsulates all canvas pointer interaction state and handlers. **Read the current `src/SvgCanvas.tsx` first** — the existing interaction code (lines 34-357) forms the foundation of this hook.

**Type definitions (at top of file):**

```ts
import { useRef, useState, useCallback, useEffect } from "react";
import type { SvgData, Hitbox, ToolMode, DrawShape, HandleInfo, BBox } from "./types";
import {
  hitboxBounds,
  getHitboxAtPoint,
  getHandlePositions,
  getHandleAtPoint,
  resizeRect,
  resizeCircle,
  moveHitbox,
  hitboxesInMarquee,
  selectionBounds,
} from "./hitboxGeometry";

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface DrawPreview {
  shape: DrawShape;
  startSvg: { x: number; y: number };
  currentSvg: { x: number; y: number };
}

type InteractionState =
  | { type: "idle" }
  | { type: "panning"; startX: number; startY: number; startTx: number; startTy: number }
  | { type: "drawing"; startSvg: { x: number; y: number } }
  | { type: "moving"; hitboxIds: string[]; startSvg: { x: number; y: number }; originals: Hitbox[]; shiftHeld: boolean; pointerStart: { x: number; y: number } }
  | { type: "resizing"; hitboxId: string; handle: HandleInfo; startSvg: { x: number; y: number }; original: Hitbox }
  | { type: "marquee"; startScreen: { x: number; y: number }; startSvg: { x: number; y: number }; shiftHeld: boolean; prevSelectedIds: string[] };

interface UseCanvasInteractionsProps {
  svgData: SvgData;
  hitboxes: Hitbox[];
  selectedIds: string[];
  toolMode: ToolMode;
  drawShape: DrawShape;
  onHitboxDrawn: (hitbox: Hitbox) => void;
  onHitboxUpdate: (id: string, patch: Partial<Hitbox>) => void;
  onHitboxMultiUpdate: (patches: Array<{ id: string; patch: Partial<Hitbox> }>) => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSetSelection: (ids: string[]) => void;
  onDeselect: () => void;
}
```

Note: `moving` state now includes `shiftHeld` and `pointerStart` (screen coords) to detect Shift+click vs Shift+drag on pointer-up.

**Return type:**
```ts
interface UseCanvasInteractionsReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  svgContainerRef: React.RefObject<HTMLDivElement>;
  transform: Transform;
  cursor: string;
  drawPreview: DrawPreview | null;
  marqueeRect: { x: number; y: number; width: number; height: number } | null;
  containerSize: { w: number; h: number };
  screenToSvg: (clientX: number, clientY: number) => { x: number; y: number };
  handlers: {
    onWheel: (e: React.WheelEvent) => void;
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
  };
  setTransform: React.Dispatch<React.SetStateAction<Transform>>;
}
```

**IMPORTANT:** Do NOT include `onContextMenu` in the handlers. The shadcn ContextMenu wrapper (Task 5) handles right-click via Radix's built-in event handling. Calling `e.preventDefault()` on `contextmenu` would prevent the Radix menu from opening.

**Space key tracking (with proper cursor lifecycle):**
```ts
const spaceHeldRef = useRef(false);

useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === " " && !spaceHeldRef.current) {
      e.preventDefault();
      spaceHeldRef.current = true;
      // Only change cursor if not already in an interaction
      if (interactionRef.current.type === "idle") setCursor("grab");
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " ") {
      spaceHeldRef.current = false;
      // Revert cursor — but only if we're in idle state (interaction in progress has its own cursor)
      if (interactionRef.current.type === "idle") setCursor("default");
    }
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}, []);
```

**handlePointerDown — complete code:**

```ts
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  // Right-click is handled by shadcn ContextMenu — don't interfere
  if (e.button === 2) return;
  // Only capture left (0) and middle (1) button
  if (e.button !== 0 && e.button !== 1) return;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  const svgPt = screenToSvg(e.clientX, e.clientY);

  // 1. Space held → pan (any button)
  if (spaceHeldRef.current) {
    const t = transformRef.current;
    interactionRef.current = { type: "panning", startX: e.clientX, startY: e.clientY, startTx: t.x, startTy: t.y };
    setCursor("grabbing");
    return;
  }

  // 2. Middle button → pan
  if (e.button === 1) {
    const t = transformRef.current;
    interactionRef.current = { type: "panning", startX: e.clientX, startY: e.clientY, startTx: t.x, startTy: t.y };
    setCursor("grabbing");
    return;
  }

  // 3. Draw mode → draw
  if (toolMode === "draw" && e.button === 0) {
    interactionRef.current = { type: "drawing", startSvg: svgPt };
    setDrawPreview({ shape: drawShape, startSvg: svgPt, currentSvg: svgPt });
    setCursor("crosshair");
    return;
  }

  // 4. Select mode
  if (toolMode === "select") {
    const selectedSet = new Set(selectedIdsRef.current);
    const singleSelected = selectedIdsRef.current.length === 1
      ? hitboxesRef.current.find((h) => h.id === selectedIdsRef.current[0]) ?? null
      : null;

    // 4a. Resize handle (single selection only, not locked)
    if (singleSelected && !singleSelected.locked) {
      const handle = getHandleAtPoint(svgPt.x, svgPt.y, singleSelected, transformRef.current.scale);
      if (handle) {
        interactionRef.current = { type: "resizing", hitboxId: singleSelected.id, handle, startSvg: svgPt, original: singleSelected };
        setCursor(handle.cursor);
        return;
      }
    }

    // 4b-e. Hitbox body
    const hit = getHitboxAtPoint(svgPt.x, svgPt.y, hitboxesRef.current);
    if (hit) {
      const isInSelection = selectedSet.has(hit.id);

      // 4b. Shift held → prepare for pointer-up toggle (do nothing now, handle on up)
      if (e.shiftKey) {
        // Start a "moving" with shiftHeld=true. On pointer-up, if barely moved, toggle.
        // We still enter the moving state so that Shift+drag can do group move.
        const ids = isInSelection ? [...selectedIdsRef.current] : [...selectedIdsRef.current, hit.id];
        const originals = hitboxesRef.current.filter((h) => ids.includes(h.id));
        interactionRef.current = {
          type: "moving", hitboxIds: ids, startSvg: svgPt, originals,
          shiftHeld: true, pointerStart: { x: e.clientX, y: e.clientY },
        };
        setCursor("move");
        return;
      }

      // 4c. Alt on hitbox → duplicate and move clones
      if (e.altKey) {
        const idsToClone = isInSelection ? [...selectedIdsRef.current] : [hit.id];
        const toClone = hitboxesRef.current.filter((h) => idsToClone.includes(h.id));
        const clones: Hitbox[] = toClone.map((h) => ({
          ...h, id: crypto.randomUUID(), locked: false, fields: { ...h.fields },
        }));
        // Insert clones into hitboxes array (via onHitboxDrawn for each)
        clones.forEach((c) => onHitboxDrawn(c));
        onSetSelection(clones.map((c) => c.id));
        interactionRef.current = {
          type: "moving", hitboxIds: clones.map((c) => c.id), startSvg: svgPt,
          originals: clones, shiftHeld: false, pointerStart: { x: e.clientX, y: e.clientY },
        };
        setCursor("copy");
        return;
      }

      // 4d. Hitbox in current selection → group move
      if (isInSelection) {
        const originals = hitboxesRef.current.filter((h) => selectedSet.has(h.id));
        const allLocked = originals.every((h) => h.locked);
        if (allLocked) {
          setCursor("not-allowed");
          setTimeout(() => setCursor("default"), 300);
          return; // no-op
        }
        interactionRef.current = {
          type: "moving", hitboxIds: [...selectedIdsRef.current], startSvg: svgPt,
          originals, shiftHeld: false, pointerStart: { x: e.clientX, y: e.clientY },
        };
        setCursor("move");
        return;
      }

      // 4e. Unselected hitbox → select it, begin move (unless locked)
      onSelect(hit.id);
      if (!hit.locked) {
        interactionRef.current = {
          type: "moving", hitboxIds: [hit.id], startSvg: svgPt,
          originals: [hit], shiftHeld: false, pointerStart: { x: e.clientX, y: e.clientY },
        };
        setCursor("move");
      }
      return;
    }

    // 4f. Empty canvas → marquee
    interactionRef.current = {
      type: "marquee", startScreen: { x: e.clientX, y: e.clientY }, startSvg: svgPt,
      shiftHeld: e.shiftKey, prevSelectedIds: e.shiftKey ? [...selectedIdsRef.current] : [],
    };
    setCursor("crosshair");
    return;
  }
}, [toolMode, drawShape, screenToSvg, onSelect, onSetSelection, onHitboxDrawn]);
```

**handlePointerMove — complete code (showing key additions):**

Copy the existing panning/drawing/resizing logic from `SvgCanvas.tsx`. Add these new sections:

```ts
// In the moving handler — support group move:
if (state.type === "moving") {
  const svgPt = screenToSvg(e.clientX, e.clientY);
  const dx = svgPt.x - state.startSvg.x;
  const dy = svgPt.y - state.startSvg.y;

  if (state.hitboxIds.length === 1) {
    // Single move (unchanged from current code)
    const orig = state.originals[0];
    if (orig.locked) return;
    const moved = moveHitbox(orig, dx, dy, viewBox);
    if (moved.shape === "circle") {
      onHitboxUpdate(state.hitboxIds[0], { cx: moved.cx, cy: moved.cy });
    } else {
      onHitboxUpdate(state.hitboxIds[0], { x: moved.x, y: moved.y });
    }
  } else {
    // Group move — apply delta to each unlocked original
    const patches: Array<{ id: string; patch: Partial<Hitbox> }> = [];
    for (let i = 0; i < state.originals.length; i++) {
      const orig = state.originals[i];
      if (orig.locked) continue;
      const moved = moveHitbox(orig, dx, dy, viewBox);
      if (moved.shape === "circle") {
        patches.push({ id: state.hitboxIds[i], patch: { cx: moved.cx, cy: moved.cy } });
      } else {
        patches.push({ id: state.hitboxIds[i], patch: { x: moved.x, y: moved.y } });
      }
    }
    if (patches.length > 0) onHitboxMultiUpdate(patches);
  }
  return;
}

// Marquee — compute screen-space rect for rendering + live preview selection:
if (state.type === "marquee") {
  const minX = Math.min(state.startScreen.x, e.clientX);
  const minY = Math.min(state.startScreen.y, e.clientY);
  const w = Math.abs(e.clientX - state.startScreen.x);
  const h = Math.abs(e.clientY - state.startScreen.y);
  // Convert to screen-relative coords (relative to container)
  const rect = containerRef.current?.getBoundingClientRect();
  if (rect) {
    setMarqueeRect({ x: minX - rect.left, y: minY - rect.top, width: w, height: h });
  }
  // Live-preview selection
  const topLeft = screenToSvg(Math.min(state.startScreen.x, e.clientX), Math.min(state.startScreen.y, e.clientY));
  const bottomRight = screenToSvg(Math.max(state.startScreen.x, e.clientX), Math.max(state.startScreen.y, e.clientY));
  const svgMarquee: BBox = {
    x: topLeft.x, y: topLeft.y,
    width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y,
  };
  const intersected = hitboxesInMarquee(hitboxesRef.current, svgMarquee);
  if (state.shiftHeld) {
    const merged = [...new Set([...state.prevSelectedIds, ...intersected])];
    onSetSelection(merged);
  } else {
    onSetSelection(intersected);
  }
  return;
}
```

**handlePointerUp — complete code (showing key additions):**

```ts
const handlePointerUp = useCallback((e: React.PointerEvent) => {
  const state = interactionRef.current;

  // Drawing finalization (same as existing, creates rect or circle hitbox)
  if (state.type === "drawing" && drawPreview) {
    // ... (copy from existing SvgCanvas.tsx lines 300-331)
    setDrawPreview(null);
  }

  // Shift+click toggle (fires on pointer-up if pointer barely moved)
  if (state.type === "moving" && state.shiftHeld) {
    const dx = e.clientX - state.pointerStart.x;
    const dy = e.clientY - state.pointerStart.y;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      // This was a Shift+click, not a Shift+drag → toggle
      // Find the hitbox that was under the original click
      const svgPt = screenToSvg(state.pointerStart.x, state.pointerStart.y);
      const hit = getHitboxAtPoint(svgPt.x, svgPt.y, hitboxesRef.current);
      if (hit) onToggleSelect(hit.id);
    }
  }

  // Marquee finalization
  if (state.type === "marquee") {
    // Selection was already set live in handlePointerMove.
    // If marquee was tiny (< 5px in any dimension) and no shift, treat as click-on-empty → deselect
    const dx = Math.abs(e.clientX - state.startScreen.x);
    const dy = Math.abs(e.clientY - state.startScreen.y);
    if (dx < 5 && dy < 5 && !state.shiftHeld) {
      onDeselect();
    }
    setMarqueeRect(null);
  }

  // Panning — revert cursor
  if (state.type === "panning") {
    setCursor(spaceHeldRef.current ? "grab" : "default");
  }

  interactionRef.current = { type: "idle" };
  if (state.type !== "panning") {
    setCursor(toolMode === "draw" ? "crosshair" : spaceHeldRef.current ? "grab" : "default");
  }
}, [drawPreview, toolMode, screenToSvg, onHitboxDrawn, onToggleSelect, onDeselect]);
```

**Refs needed inside the hook:**
```ts
const hitboxesRef = useRef(hitboxes);
hitboxesRef.current = hitboxes;
const selectedIdsRef = useRef(selectedIds);
selectedIdsRef.current = selectedIds;
```

The rest of the hook (containerRef, svgContainerRef, ResizeObserver, fit-to-container, screenToSvg, handleWheel, Escape to cancel drawing) is copied directly from the existing `SvgCanvas.tsx` lines 52-152. Refactor these into the hook unchanged.

- [ ] **Step 2: Add onHitboxMultiUpdate handler to App.tsx**

In `src/App.tsx`, add this callback after `handleHitboxUpdate`:

```ts
  const handleHitboxMultiUpdate = useCallback(
    (patches: Array<{ id: string; patch: Partial<Hitbox> }>) => {
      setHitboxes((prev) =>
        prev.map((h) => {
          const p = patches.find((p) => p.id === h.id);
          return p ? { ...h, ...p.patch } as Hitbox : h;
        })
      );
    },
    []
  );
```

Pass it as `onHitboxMultiUpdate={handleHitboxMultiUpdate}` to `SvgCanvas`.

Also add `onSetSelection` prop:
```ts
  const handleSetSelection = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);
```

- [ ] **Step 3: Rewrite SvgCanvas.tsx to use the hook**

Strip all interaction state and handlers from `SvgCanvas.tsx`. The component becomes a pure renderer:

```ts
interface SvgCanvasProps {
  svgData: SvgData;
  hitboxes: Hitbox[];
  selectedIds: string[];
  toolMode: ToolMode;
  drawShape: DrawShape;
  onHitboxDrawn: (hitbox: Hitbox) => void;
  onHitboxUpdate: (id: string, patch: Partial<Hitbox>) => void;
  onHitboxMultiUpdate: (patches: Array<{ id: string; patch: Partial<Hitbox> }>) => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSetSelection: (ids: string[]) => void;
  onDeselect: () => void;
}
```

Call the hook:
```ts
const {
  containerRef, svgContainerRef, transform, cursor, drawPreview,
  marqueeRect, containerSize, screenToSvg, handlers, setTransform,
} = useCanvasInteractions({ svgData, hitboxes, selectedIds, toolMode, drawShape, ... });
```

**Rendering changes — concrete code:**

Update `isSelected` check: `const isSelected = selectedIds.includes(hb.id);`

Resize handles: only when `selectedIds.length === 1` and the single selected hitbox is not locked:
```tsx
{selectedIds.length === 1 && singleSelectedHitbox && !singleSelectedHitbox.locked && toolMode === "select" && (
  <g>
    {getHandlePositions(singleSelectedHitbox).map((handle) => {
      const handleSize = 10 / scale;
      return (
        <rect key={handle.position} x={handle.svgX - handleSize / 2} y={handle.svgY - handleSize / 2}
          width={handleSize} height={handleSize} fill="white" stroke="#3b82f6" strokeWidth={2 / scale} />
      );
    })}
  </g>
)}
```

**Group bounding box** — dashed rect around multi-selection (inside the overlay SVG):
```tsx
{selectedIds.length > 1 && (() => {
  const bounds = selectionBounds(hitboxes, selectedIds);
  if (bounds.width === 0 && bounds.height === 0) return null;
  return (
    <rect
      x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height}
      fill="none" stroke="#58a6ff" strokeWidth={1 / scale}
      strokeDasharray={`${4 / scale} ${3 / scale}`}
    />
  );
})()}
```

**Lock icon** — padlock at top-right of each locked hitbox (inside the overlay SVG, scale-compensated):
```tsx
{hitboxes.filter((h) => h.locked).map((hb) => {
  const b = hitboxBounds(hb);
  const iconSize = 12 / scale;
  const ix = b.x + b.width - iconSize * 0.2;
  const iy = b.y - iconSize * 0.8;
  return (
    <g key={`lock-${hb.id}`} transform={`translate(${ix}, ${iy}) scale(${iconSize / 16})`}>
      <path d="M6 8V6a4 4 0 1 1 8 0v2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1z" fill="#58a6ff" />
      <path d="M8 6v2h4V6a2 2 0 1 0-4 0z" fill="#1a1a2e" />
    </g>
  );
})}
```

**Marquee div** — absolutely positioned over the canvas container (NOT in the SVG), using screen-relative coords:
```tsx
{marqueeRect && (
  <div
    style={{
      position: "absolute",
      left: marqueeRect.x,
      top: marqueeRect.y,
      width: marqueeRect.width,
      height: marqueeRect.height,
      border: "1px dashed #58a6ff",
      background: "rgba(88, 166, 255, 0.08)",
      pointerEvents: "none",
      zIndex: 20,
    }}
  />
)}
```

Also add `screenToSvgRef` prop (see Task 5 Step 3):
```ts
screenToSvgRef?: React.MutableRefObject<((cx: number, cy: number) => { x: number; y: number }) | null>;
```

Set it inside SvgCanvas:
```ts
useEffect(() => {
  if (screenToSvgRef) screenToSvgRef.current = screenToSvg;
}, [screenToSvg, screenToSvgRef]);
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: May still have TypeScript errors in HitboxSidebar.tsx (Task 4 fixes it). Canvas interactions should work.

- [ ] **Step 5: Commit**

```bash
git add src/useCanvasInteractions.ts src/SvgCanvas.tsx src/App.tsx
git commit -m "feat: extract useCanvasInteractions hook, add marquee/space-pan/group-move/lock-guard"
```

---

### Task 4: HitboxSidebar — Multi-Selection, Lock Indicators, Keyboard Hints

**Files:**
- Modify: `src/HitboxSidebar.tsx`

- [ ] **Step 1: Update props interface**

```ts
interface HitboxSidebarProps {
  hitboxes: Hitbox[];
  selectedIds: string[];
  svgFilename: string | null;
  toolMode: ToolMode;
  drawShape: DrawShape;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onLoadSvg: () => void;
  onImport: () => void;
  onExportJSON: () => void;
  onExportTS: () => void;
  onToolModeChange: (mode: ToolMode) => void;
  onDrawShapeChange: (shape: DrawShape) => void;
}
```

- [ ] **Step 2: Update component body**

- Destructure new props: `selectedIds`, `onToggleSelect`
- Change `isSelected`: `const isSelected = selectedIds.includes(hb.id);`
- Change click handler to support Shift+click:
```tsx
onClick={(e) => {
  if (e.shiftKey) {
    onToggleSelect(hb.id);
  } else {
    onSelect(hb.id);
  }
}}
```
- Add lock indicator after shape dot: `{hb.locked && <span className="text-[10px]">🔒</span>}`
- Hide delete button for locked hitboxes: `{!hb.locked && <button ...>×</button>}`

- [ ] **Step 3: Update keyboard hints**

Replace the keyboard hints section:
```tsx
<div className="px-4 py-2 flex flex-col gap-1.5 text-[11px] text-muted-foreground">
  <div className="flex gap-2"><span><Kbd>V</Kbd> Select</span> <span><Kbd>D</Kbd> Draw</span></div>
  <div className="flex gap-2"><span><Kbd>R</Kbd> Rect</span> <span><Kbd>C</Kbd> Circle</span></div>
  <div className="flex gap-2"><span><Kbd>Del</Kbd> Remove</span> <span><Kbd>Esc</Kbd> Deselect</span></div>
  <div className="flex gap-2"><span><Kbd>⌘C</Kbd> Copy</span> <span><Kbd>⌘V</Kbd> Paste</span></div>
  <div className="flex gap-2"><span><Kbd>⌘D</Kbd> Duplicate</span> <span><Kbd>⌘A</Kbd> Select All</span></div>
  <div><Kbd>Space</Kbd>+Drag Pan  <Kbd>Alt</Kbd>+Drag Duplicate</div>
</div>
```

- [ ] **Step 4: Update selection count display**

Add multi-selection count info to the count section:
```tsx
<div className="px-4 pb-1 text-xs text-muted-foreground">
  {filtered.length}{search ? ` / ${hitboxes.length}` : ""} hitbox{hitboxes.length !== 1 ? "es" : ""}
  {selectedIds.length > 1 && ` · ${selectedIds.length} selected`}
</div>
```

- [ ] **Step 5: Verify build**

Run: `pnpm run build`
Expected: Build succeeds with 0 errors. All props now match.

- [ ] **Step 6: Commit**

```bash
git add src/HitboxSidebar.tsx
git commit -m "feat: sidebar multi-selection, shift+click toggle, lock indicators"
```

---

## Chunk 3: Context Menu and Integration

### Task 5: HitboxContextMenu Component

**Files:**
- Create: `src/HitboxContextMenu.tsx`
- Modify: `src/App.tsx` (wrap canvas area with context menu)

- [ ] **Step 1: Create HitboxContextMenu.tsx**

Create `src/HitboxContextMenu.tsx`:

```tsx
import type { ReactNode } from "react";
import type { Hitbox } from "./types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface HitboxContextMenuProps {
  children: ReactNode;
  selectedIds: string[];
  hitboxes: Hitbox[];
  clipboard: Hitbox[];
  onCopy: () => void;
  onPaste: (cursorSvgPoint?: { x: number; y: number }) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  /** Called on right-click — selects hitbox under cursor, returns SVG point for paste positioning */
  onContextTarget: (e: React.MouseEvent) => void;
  /** SVG coordinates of the last right-click — used for paste-at-cursor */
  contextSvgPoint: { x: number; y: number } | null;
}

export default function HitboxContextMenu({
  children,
  selectedIds,
  hitboxes,
  clipboard,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onLock,
  onUnlock,
  onFlipHorizontal,
  onFlipVertical,
  onContextTarget,
  contextSvgPoint,
}: HitboxContextMenuProps) {
  const selectedHitboxes = hitboxes.filter((h) => selectedIds.includes(h.id));
  const hasSelection = selectedIds.length > 0;
  const isMulti = selectedIds.length > 1;
  const allLocked = selectedHitboxes.length > 0 && selectedHitboxes.every((h) => h.locked);
  const anyLocked = selectedHitboxes.some((h) => h.locked);
  const anyUnlocked = selectedHitboxes.some((h) => !h.locked);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={onContextTarget}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {/* Copy/Paste/Duplicate */}
        {hasSelection && (
          <ContextMenuItem onSelect={onCopy}>
            Copy<ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {clipboard.length > 0 && (
          <ContextMenuItem onSelect={() => onPaste(contextSvgPoint ?? undefined)}>
            Paste<ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {hasSelection && (
          <ContextMenuItem onSelect={onDuplicate}>
            Duplicate<ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        {/* Z-order */}
        {hasSelection && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onBringToFront}>Bring to Front</ContextMenuItem>
            <ContextMenuItem onSelect={onBringForward}>Bring Forward</ContextMenuItem>
            <ContextMenuItem onSelect={onSendBackward}>Send Backward</ContextMenuItem>
            <ContextMenuItem onSelect={onSendToBack}>Send to Back</ContextMenuItem>
          </>
        )}

        {/* Flip (multi only) */}
        {isMulti && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onFlipHorizontal}>Flip Horizontal</ContextMenuItem>
            <ContextMenuItem onSelect={onFlipVertical}>Flip Vertical</ContextMenuItem>
          </>
        )}

        {/* Lock/Unlock */}
        {hasSelection && (
          <>
            <ContextMenuSeparator />
            {anyUnlocked && (
              <ContextMenuItem onSelect={onLock}>
                {isMulti ? "Lock All" : "Lock"}
              </ContextMenuItem>
            )}
            {anyLocked && (
              <ContextMenuItem onSelect={onUnlock}>
                {isMulti ? "Unlock All" : "Unlock"}
              </ContextMenuItem>
            )}
          </>
        )}

        {/* Delete */}
        {hasSelection && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={allLocked ? undefined : onDelete}
              disabled={allLocked}
              className={allLocked ? "text-muted-foreground" : "text-destructive"}
            >
              Delete<ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        {/* Empty canvas — only paste */}
        {!hasSelection && clipboard.length === 0 && (
          <ContextMenuItem disabled className="text-muted-foreground">
            No actions available
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
```

- [ ] **Step 2: Wire context menu in App.tsx**

Import `HitboxContextMenu` and wrap the canvas area:

In the render section of `App.tsx`, wrap the `<div className="flex-1 relative overflow-hidden">` with the context menu. The `onContextTarget` callback uses `screenToSvg` from SvgCanvas (exposed via ref or passed up) to determine what was right-clicked and adjust selection accordingly.

For simplicity, handle the right-click target detection in App.tsx:

```tsx
import { getHitboxAtPoint } from "./hitboxGeometry";
```

Add a ref to get screenToSvg from SvgCanvas:
```tsx
const screenToSvgRef = useRef<((cx: number, cy: number) => { x: number; y: number }) | null>(null);
```

In SvgCanvas, expose `screenToSvg` via the ref (pass `screenToSvgRef` as prop, set it in useEffect).

Add state for storing the right-click SVG point:
```tsx
const [contextSvgPoint, setContextSvgPoint] = useState<{ x: number; y: number } | null>(null);
```

The `onContextTarget` handler — stores the cursor SVG point and adjusts selection:
```tsx
const handleContextTarget = useCallback((e: React.MouseEvent) => {
  if (!screenToSvgRef.current) return;
  const svgPt = screenToSvgRef.current(e.clientX, e.clientY);
  setContextSvgPoint(svgPt);
  const hit = getHitboxAtPoint(svgPt.x, svgPt.y, hitboxesRef.current);
  if (hit) {
    if (!selectedIdsRef.current.includes(hit.id)) {
      setSelectedIds([hit.id]);
    }
  } else {
    setSelectedIds([]);
  }
}, []);
```

**Note on stale state:** The `setSelectedIds` call is synchronous, but React may not flush the update before the Radix menu reads `selectedIds`. To handle this, the `HitboxContextMenu` component receives both `selectedIds` (from state) and the `onContextTarget` fires before Radix opens the menu. Radix's `ContextMenu` delays rendering the content portal until after the next microtask, so the React state update from `setSelectedIds` will have flushed by the time the menu content renders. If this causes issues in practice, the implementer should use `flushSync` from `react-dom` inside `handleContextTarget`.

Wrap in render:
```tsx
<HitboxContextMenu
  selectedIds={selectedIds}
  hitboxes={hitboxes}
  clipboard={clipboard}
  onCopy={handleCopy}
  onPaste={handlePaste}
  onDuplicate={handleDuplicate}
  onDelete={handleDeleteSelected}
  onBringToFront={handleBringToFront}
  onBringForward={handleBringForward}
  onSendBackward={handleSendBackward}
  onSendToBack={handleSendToBack}
  onLock={handleLock}
  onUnlock={handleUnlock}
  onFlipHorizontal={handleFlipHorizontal}
  onFlipVertical={handleFlipVertical}
  onContextTarget={handleContextTarget}
  contextSvgPoint={contextSvgPoint}
>
  <div className="flex-1 relative overflow-hidden">
    <SvgCanvas ... />
    {selectedHitbox && <HitboxEditor ... />}
  </div>
</HitboxContextMenu>
```

Add `handleCopy`, `handlePaste`, `handleDuplicate` callbacks (extract from keyboard handler into reusable callbacks):

```tsx
const handleCopy = useCallback(() => {
  const selected = hitboxesRef.current.filter((h) => selectedIdsRef.current.includes(h.id));
  if (selected.length > 0) setClipboard(selected);
}, []);

const handlePaste = useCallback((cursorSvgPoint?: { x: number; y: number }) => {
  const cb = clipboardRef.current;
  if (cb.length === 0) return;

  let newHbs: Hitbox[];
  if (cursorSvgPoint) {
    // Context menu paste: center clipboard group at cursor position
    const bounds = selectionBounds(cb, cb.map((h) => h.id));
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const offsetX = cursorSvgPoint.x - cx;
    const offsetY = cursorSvgPoint.y - cy;
    newHbs = cb.map((h) => {
      const newId = crypto.randomUUID();
      if (h.shape === "circle") {
        return { ...h, id: newId, cx: h.cx + offsetX, cy: h.cy + offsetY, locked: false, fields: { ...h.fields } };
      }
      return { ...h, id: newId, x: h.x + offsetX, y: h.y + offsetY, locked: false, fields: { ...h.fields } };
    });
  } else {
    // Keyboard paste: +20 offset from original positions
    newHbs = cb.map((h) => {
      const newId = crypto.randomUUID();
      if (h.shape === "circle") {
        return { ...h, id: newId, cx: h.cx + 20, cy: h.cy + 20, locked: false, fields: { ...h.fields } };
      }
      return { ...h, id: newId, x: h.x + 20, y: h.y + 20, locked: false, fields: { ...h.fields } };
    });
  }
  setHitboxes((prev) => [...prev, ...newHbs]);
  setSelectedIds(newHbs.map((h) => h.id));
}, []);

const handleDuplicate = useCallback(() => {
  const ids = selectedIdsRef.current;
  const hbs = hitboxesRef.current;
  if (ids.length === 0) return;
  const selected = hbs.filter((h) => ids.includes(h.id));
  const dupes = selected.map((h) => {
    const newId = crypto.randomUUID();
    if (h.shape === "circle") {
      return { ...h, id: newId, cx: h.cx + 20, cy: h.cy + 20, locked: false, fields: { ...h.fields } };
    }
    return { ...h, id: newId, x: h.x + 20, y: h.y + 20, locked: false, fields: { ...h.fields } };
  });
  setHitboxes((prev) => [...prev, ...dupes]);
  setSelectedIds(dupes.map((h) => h.id));
}, []);
```

Then simplify the keyboard handler to call these instead of duplicating logic.

- [ ] **Step 3: Expose screenToSvg from SvgCanvas**

Add a prop to SvgCanvas:
```ts
screenToSvgRef?: React.MutableRefObject<((cx: number, cy: number) => { x: number; y: number }) | null>;
```

In the hook or SvgCanvas, set it:
```ts
useEffect(() => {
  if (screenToSvgRef) screenToSvgRef.current = screenToSvg;
}, [screenToSvg, screenToSvgRef]);
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Build succeeds with 0 errors. Context menu should appear on right-click.

- [ ] **Step 5: Commit**

```bash
git add src/HitboxContextMenu.tsx src/App.tsx src/SvgCanvas.tsx
git commit -m "feat: add context menu with z-order, lock, flip, copy/paste/duplicate"
```

---

### Task 6: Final Integration, Edge Cases, and Polish

**Files:**
- Modify: `src/App.tsx` (if needed)
- Modify: `src/SvgCanvas.tsx` (if needed)
- Modify: `src/useCanvasInteractions.ts` (if needed)
- Modify: `src/HitboxEditor.tsx` (lock-aware delete button)

This task handles remaining edge cases and final polish.

- [ ] **Step 1: HitboxEditor lock-awareness**

In `src/HitboxEditor.tsx`, disable the Delete button when the hitbox is locked:

```tsx
<Button
  variant="destructive"
  size="sm"
  className="mr-2 h-7 text-xs"
  onClick={() => onDelete(hitbox.id)}
  disabled={!!hitbox.locked}
>
  Delete
</Button>
```

- [ ] **Step 2: Export compatibility — strip locked: false**

In `src/App.tsx`, add a helper function to strip `locked: false` from exports (avoids TypeScript union destructuring issues):

```ts
function cleanHitboxesForExport(hitboxes: Hitbox[]): Hitbox[] {
  return hitboxes.map((h) => {
    if (h.locked) return h;
    // Remove the locked field when it's falsy
    const clean = { ...h };
    delete clean.locked;
    return clean;
  });
}
```

Update `handleExportJSON` — use `cleanHitboxesForExport(hitboxes)` instead of `hitboxes` in the export data:
```ts
const data: HitboxExport = {
  svgFilename: svgData.filename,
  svgViewBox: `${svgData.viewBox.x} ${svgData.viewBox.y} ${svgData.viewBox.width} ${svgData.viewBox.height}`,
  hitboxes: cleanHitboxesForExport(hitboxes),
};
```

Update `handleExportTS` — use `cleanHitboxesForExport(hitboxes)` in the JSON.stringify call:
```ts
lines.push("export const hitboxes: Hitbox[] = " + JSON.stringify(cleanHitboxesForExport(hitboxes), null, 2) + ";\n");
```

- [ ] **Step 3: Update localStorage save to match**

The localStorage save already saves full hitboxes with `locked` field — this is fine for local persistence. No change needed.

- [ ] **Step 4: Verify full build**

Run: `pnpm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Manual verification checklist**

Run `pnpm run dev` and verify:
- [ ] Single click selects, shows edit panel
- [ ] Shift+click adds/removes from selection
- [ ] Marquee drag selects hitboxes
- [ ] Space+drag pans the canvas
- [ ] Middle-mouse drag pans
- [ ] Scroll zooms
- [ ] Right-click on hitbox shows context menu
- [ ] Right-click on empty canvas shows paste-only menu
- [ ] Copy/paste works (⌘C, ⌘V) with +20 offset
- [ ] Context menu paste places hitboxes at cursor position
- [ ] Duplicate works (⌘D)
- [ ] Select all works (⌘A)
- [ ] Bring to Front/Forward/Backward/Back works
- [ ] Lock/Unlock works, locked hitbox shows lock icon
- [ ] Locked hitbox can't be moved or resized
- [ ] Locked hitbox can't be deleted
- [ ] Locked hitbox can be selected and fields edited
- [ ] Flip Horizontal/Vertical works for multi-selection
- [ ] Alt+drag duplicates (single and multi)
- [ ] Group move works for multi-selection
- [ ] Delete skips locked in mixed selection
- [ ] JSON import/export preserves locked field
- [ ] localStorage persistence works

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: final integration, edge cases, lock-aware editor, clean exports"
```
