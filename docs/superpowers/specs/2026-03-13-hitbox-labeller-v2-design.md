# Hitbox Labeller v2 — Select/Move/Resize + shadcn Migration

## Problem

The current hitbox labeller can only create hitboxes — once drawn, they cannot be moved or resized. Editing requires deleting and redrawing. The UI uses bare inline CSS styles throughout instead of a component library. This makes the tool frustrating for precise hitbox placement and the code harder to maintain.

## Solution

Add select/move/resize interactions (Photoshop-style), support multiple shape types (rectangle and circle), and migrate the UI to shadcn components with Tailwind CSS classes.

## Tool Modes

Two modes, switchable via toolbar toggle or keyboard shortcuts:

### Select Mode (V) — default
- **Click hitbox** → selects it, shows 8 resize handles, opens Edit Hitbox panel
- **Drag selected hitbox body** → moves it (updates x, y in SVG coordinates)
- **Drag unselected hitbox** → selects it and begins moving in one gesture (like Figma)
- **Drag resize handle** → resizes it (updates x, y, width, height)
- **Click empty canvas** → deselects, closes panel
- **Drag empty canvas** → pans the view
- **Click hitbox in sidebar** → selects it, opens panel

### Draw Mode (D)
- **Shape selector** in the toolbar chooses what shape to draw (Rectangle or Circle)
- **Rectangle draw:** Click and drag → draws bounding box (dashed preview). Release creates hitbox if > 5 SVG units each side.
- **Circle draw:** Click and drag → draws circle from center to mouse position (dashed preview). Radius = distance from click point to current mouse position. Release creates hitbox if radius > 5 SVG units.
- **Click and drag on a hitbox** → draws new shape (not pan, not move)
- **Release** → creates hitbox, selects it, opens panel, returns to Select mode
- **Scroll wheel** → zooms (panning is not available via drag in draw mode; use scroll to zoom and reposition)

## Resize Handles

### Rectangle: 8-handle model
- 4 corner handles (nw, ne, sw, se) — resize both dimensions
- 4 edge midpoint handles (n, s, e, w) — resize one dimension
- Cursor changes to appropriate resize cursor on hover (nwse-resize, nesw-resize, ns-resize, ew-resize)
- Minimum hitbox size enforced: 5 SVG units each dimension

### Circle: 4-handle model
- 4 cardinal handles (n, s, e, w) positioned at the circle's edge
- All 4 handles adjust the radius uniformly — dragging any handle changes `r`
- Cursor: `ew-resize` for e/w handles, `ns-resize` for n/s handles
- Minimum radius enforced: 5 SVG units

### Common handle properties
- Visual size: 10x10px screen size, white fill with 2px blue (`#3b82f6`) border
- Hit area: 16x16px screen size (invisible, centered on the visual handle) — easier to grab
- Both visual and hit area are scale-compensated (stay the same screen size regardless of zoom)

## Move Behavior

- When cursor is over a selected hitbox body (not on a handle), cursor changes to `move`
- Dragging moves the hitbox, updating x/y coordinates
- If the Edit Panel is open, coordinates update live during drag
- Dragging an unselected hitbox selects it and begins the move in one gesture (mousedown selects, then mousemove moves)
- Hitboxes are clamped to the SVG viewBox during move — the hitbox cannot be dragged outside the viewBox boundaries

## Resize Boundary Constraints

### Rectangle
- Edges clamped to the SVG viewBox — cannot extend beyond
- Minimum size enforced: 5 SVG units per dimension
- Corner handle: opposite corner stays fixed
- Edge handle: opposite edge stays fixed

### Circle
- Circle clamped to the SVG viewBox — center ± radius must stay within bounds
- Minimum radius: 5 SVG units
- All cardinal handles adjust radius uniformly (center stays fixed)

## Edit Hitbox Panel

Replaces the current bottom popover with a **floating panel** (a positioned `<div>` using Tailwind classes and shadcn primitives):
- Rendered as a fixed-position panel at the bottom-center of the canvas area
- Does NOT use shadcn `Dialog` — a Dialog is modal by default and would block pointer events on the canvas
- Opens when a hitbox is selected (click on canvas or sidebar)
- Stays open while moving/resizing — coordinates display updates live
- Contains: hitbox ID (truncated), shape type badge, coordinates (rect: x, y, width, height; circle: cx, cy, r — read-only display), built-in fields (mode, route, stop), custom fields with add/remove
- Uses shadcn `Input`, `Label`, `Button` components for form elements
- Panel has `pointer-events: auto` but does NOT cover the full viewport — canvas remains fully interactive

**Important:** The panel must NOT block pointer events on the canvas. The user needs to interact with both the panel fields AND the canvas simultaneously (e.g., select a hitbox, type metadata, then drag to adjust position without closing the panel).

## shadcn Migration

### Init
```bash
pnpm dlx shadcn@latest init -t vite --preset avp4rpa
```

### Components to add
- `button` — Toolbar buttons, action buttons
- `input` — Field values, search
- `label` — Field labels
- `toggle-group` — Mode switcher (Select/Draw) and shape selector (Rectangle/Circle)
- `tooltip` — Toolbar button hints
- `scroll-area` — Sidebar hitbox list
- `separator` — Visual dividers
- `kbd` — Keyboard shortcut hints (usage: `<Kbd>V</Kbd>`, `<KbdGroup><Kbd>Ctrl</Kbd><Kbd>Z</Kbd></KbdGroup>`)

### Style Migration
- Replace all `React.CSSProperties` inline style objects with Tailwind classes
- Replace CSS variable theme (`--bg`, `--surface`, etc.) with Tailwind/shadcn theme
- Remove `index.css` CSS variable definitions (shadcn provides its own theme)
- Keep bare CSS only for SVG overlay elements that need computed values (transform, dynamic positioning)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Switch to Select mode (set, not toggle — pressing V while already in Select is a no-op) |
| `D` | Switch to Draw mode (set, not toggle — pressing D while already in Draw is a no-op) |
| `R` | Set draw shape to Rectangle (only relevant in Draw mode) |
| `C` | Set draw shape to Circle (only relevant in Draw mode) |
| `Delete` / `Backspace` | Delete selected hitbox |
| `Escape` | If currently drawing (pointer down), cancel the in-progress rectangle and return to Select mode. If in Draw mode (idle), switch to Select mode. If in Select mode with a selection, deselect. |
| `Scroll` | Zoom canvas |

**Note:** This replaces the current `D` toggle behavior. `V` and `D` are now explicit mode-set operations.

**Sidebar interaction during Draw mode:** Clicking a hitbox in the sidebar always selects it and switches to Select mode, regardless of current mode.

## Data Model

**Breaking change:** The `Hitbox` interface is replaced with a discriminated union. Existing JSON exports (which only contain rectangles) are migrated on import by adding `shape: "rect"`.

```ts
type ToolMode = "select" | "draw";
type DrawShape = "rect" | "circle";

interface HitboxBase {
  id: string;
  fields: Record<string, string>;
}

interface RectHitbox extends HitboxBase {
  shape: "rect";
  x: number;       // top-left x, updated during move
  y: number;       // top-left y, updated during move
  width: number;   // updated during resize
  height: number;  // updated during resize
}

interface CircleHitbox extends HitboxBase {
  shape: "circle";
  cx: number;      // center x, updated during move
  cy: number;      // center y, updated during move
  r: number;       // radius, updated during resize
}

type Hitbox = RectHitbox | CircleHitbox;
```

### Helper: bounding box

For hit-testing, overlap detection, and sidebar display, a shared helper computes the bounding box of any hitbox:

```ts
function hitboxBounds(h: Hitbox): { x: number; y: number; width: number; height: number } {
  if (h.shape === "circle") return { x: h.cx - h.r, y: h.cy - h.r, width: h.r * 2, height: h.r * 2 };
  return { x: h.x, y: h.y, width: h.width, height: h.height };
}
```

### New/Changed Callback Props for SvgCanvas

```ts
// New — called during move/resize drag to update hitbox geometry
onHitboxUpdate: (id: string, patch: Partial<RectHitbox> | Partial<CircleHitbox>) => void;

// Changed — now passes the full hitbox (not just rect geometry)
onHitboxDrawn: (hitbox: Hitbox) => void;

// Existing — unchanged
onHitboxClick: (id: string) => void;
onDeselect: () => void;
```

### Import Migration

When importing a JSON file without `shape` fields on hitboxes, add `shape: "rect"` to each entry. This maintains backward compatibility with v1 exports.

## File Changes

### Modified files:
- `src/App.tsx` — mode state (`ToolMode`), floating panel integration, updated event flow, new callbacks for hitbox move/resize
- `src/SvgCanvas.tsx` — select/move/resize logic, handle rendering, mode-aware pointer handlers, scale-compensated handles
- `src/HitboxSidebar.tsx` — migrate to shadcn components (Button, Input, ScrollArea, ToggleGroup, Separator, Kbd)
- `src/HitboxEditor.tsx` — rewrite as floating panel content using shadcn primitives (Input, Label, Button)
- `src/index.css` — remove custom CSS variables, use Tailwind/shadcn theme
- `src/types.ts` — replace `Hitbox` with discriminated union (`RectHitbox | CircleHitbox`), add `ToolMode`, `DrawShape`, `hitboxBounds` helper

### New files:
- `src/components/ui/*` — shadcn component files (generated by `pnpm dlx shadcn@latest add <component>`)

## Interaction Details

### Pointer Event Priority (Select Mode)
1. If pointer is on a resize handle of the selected hitbox → resize
2. If pointer is on selected hitbox body → move
3. If pointer is on unselected hitbox → select it on mousedown, begin move on mousemove (single gesture)
4. If pointer is on empty canvas → pan (on drag) / deselect (on click)

### Pointer Event Priority (Draw Mode)
1. Any mousedown on canvas (empty or on hitbox) → begin drawing the selected shape (rect or circle)
2. Scroll wheel → zoom

### Overlapping Hitboxes
When multiple hitboxes overlap, the one rendered last (highest array index) is topmost and receives the click/drag. This matches SVG paint order — later elements are on top.

### Coordinate Updates During Move/Resize
- Store drag start position and original hitbox bounds on pointerdown
- On each pointermove, compute delta in SVG coordinates using `screenToSvg`
- Apply delta to original bounds (not cumulative — prevents drift)
- Clamp result to SVG viewBox boundaries
- Update hitbox state (triggers re-render of overlay + panel)
- On pointerup, finalize the position

## Style Migration: index.css

The current `index.css` contains:
1. CSS custom properties (`--bg`, `--surface`, etc.) — **remove**, replaced by shadcn/Tailwind theme
2. Global reset (`* { margin: 0; padding: 0; box-sizing: border-box }`) — **remove**, Tailwind's preflight handles this
3. `html, body, #root { height: 100%; overflow: hidden }` — **keep** as plain CSS in index.css or move to a Tailwind `@layer base` block
4. Custom scrollbar styles (`::-webkit-scrollbar`) — **remove**, shadcn `ScrollArea` provides its own scrollbar styling

## Out of Scope

- **Undo/redo** — not included in this iteration
- **Touch/mobile gestures** — pointer events are used (which cover touch), but pinch-to-zoom and multi-finger gestures are not explicitly handled
