# Interactive SVG Viewer — Implementation Plan

## Goal

Build a React component that loads an SVG file + its hitbox data (exported from SvgHitbox as `.ts` or `.json`) and makes the defined regions interactive — clickable, hoverable, with access to the custom field values.

## Input Data Shape

The component consumes SvgHitbox's export format:

```ts
// Two hitbox shapes
interface RectHitbox {
  id: string;
  shape: "rect";
  x: number; y: number; width: number; height: number;
  fields: Record<string, string>;
}

interface CircleHitbox {
  id: string;
  shape: "circle";
  cx: number; cy: number; r: number;
  fields: Record<string, string>;
}

type Hitbox = RectHitbox | CircleHitbox;

// Top-level export
interface HitboxExport {
  svgFilename: string;       // "map.svg"
  svgViewBox: string;        // "0 0 1755.16 2844.49"
  hitboxes: Hitbox[];
}
```

`fields` is a freeform `Record<string, string>`. Common keys used by the labeller are `mode`, `route`, `stop`, but consumers should handle any keys.

---

## Architecture

```
InteractiveSvg (wrapper)
├── <svg> with inline SVG content (background layer)
├── <svg> overlay (same viewBox, on top)
│   └── For each hitbox:
│       ├── Invisible hit target (<rect> or <circle>, fill="transparent")
│       └── Optional visible highlight on hover/active
├── Tooltip / Popover (positioned near clicked hitbox)
└── Pan + Zoom (optional, wrap with react-zoom-pan-pinch or manual transform)
```

Two SVG layers share the same `viewBox` so coordinates align perfectly.

---

## Tasks

### Task 1: Core `InteractiveSvg` component

**Files:**
- Create: `src/components/InteractiveSvg.tsx`

**Props:**
```ts
interface InteractiveSvgProps {
  svgUrl: string;                    // URL or path to the SVG file
  hitboxes: Hitbox[];                // From the export
  viewBox: string;                   // "0 0 W H"
  onHitboxClick?: (hitbox: Hitbox) => void;
  onHitboxHover?: (hitbox: Hitbox | null) => void;
  renderTooltip?: (hitbox: Hitbox) => React.ReactNode;  // custom tooltip content
  hitboxStyle?: {
    idle?: React.CSSProperties;
    hover?: React.CSSProperties;
    active?: React.CSSProperties;
  };
}
```

**Implementation:**
- [ ] Fetch and inline the SVG into a container div (like SvgCanvas does now — `innerHTML` approach)
- [ ] Render an overlay `<svg>` with matching `viewBox` on top
- [ ] For each hitbox, render a transparent hit target shape with `pointerEvents: "all"`
- [ ] Larger hit targets for small hitboxes (minimum 20px effective radius for touch)
- [ ] Track `hoveredId` state — apply hover styles
- [ ] Call `onHitboxClick` / `onHitboxHover` callbacks
- [ ] Both layers scale together (shared CSS transform or parent container sizing)

**Hit target rendering:**
```tsx
{hitboxes.map((hb) =>
  hb.shape === "rect" ? (
    <rect
      key={hb.id}
      x={hb.x} y={hb.y} width={hb.width} height={hb.height}
      fill="transparent"
      style={{ cursor: "pointer", pointerEvents: "all" }}
      onPointerEnter={() => setHoveredId(hb.id)}
      onPointerLeave={() => setHoveredId(null)}
      onClick={() => onHitboxClick?.(hb)}
    />
  ) : (
    <circle
      key={hb.id}
      cx={hb.cx} cy={hb.cy} r={Math.max(hb.r, 10)}
      fill="transparent"
      style={{ cursor: "pointer", pointerEvents: "all" }}
      onPointerEnter={() => setHoveredId(hb.id)}
      onPointerLeave={() => setHoveredId(null)}
      onClick={() => onHitboxClick?.(hb)}
    />
  )
)}
```

---

### Task 2: Hover highlight layer

**Files:**
- Modify: `src/components/InteractiveSvg.tsx`

- [ ] When `hoveredId` is set, render a visible highlight shape behind the hit target
- [ ] Default style: semi-transparent fill + colored stroke (user-overridable via `hitboxStyle`)
- [ ] Smooth opacity transition via CSS (`transition: opacity 150ms`)
- [ ] Optional: show the hitbox label (from `fields.stop || fields.route || fields.mode`) as a `<text>` element centered on the shape

---

### Task 3: Tooltip / Popover on click

**Files:**
- Create: `src/components/HitboxTooltip.tsx`
- Modify: `src/components/InteractiveSvg.tsx`

- [ ] On click, show a floating popover near the hitbox
- [ ] Position it above the hitbox center, flip if near viewport edge
- [ ] Default content: render all `fields` as a key-value list
- [ ] If `renderTooltip` prop is provided, use that instead (full control for consumer)
- [ ] Click outside or press Escape to dismiss
- [ ] On mobile: tap to open, tap elsewhere to close

**Default tooltip layout:**
```
┌──────────────────┐
│ Stop: Gombak      │
│ Route: Kelana Jaya │
│ Mode: LRT         │
└──────────────────┘
```

**Positioning:** Convert hitbox SVG coordinates to screen coordinates using `getScreenCTM()` on the overlay SVG element, then position the tooltip div absolutely.

---

### Task 4: Pan and Zoom

**Files:**
- Modify: `src/components/InteractiveSvg.tsx`

Two options (pick one based on preference):

**Option A: `react-zoom-pan-pinch`**
- [ ] Wrap both SVG layers in `<TransformWrapper>` / `<TransformComponent>`
- [ ] Pinch-to-zoom on mobile, scroll-to-zoom on desktop
- [ ] Double-tap/click to zoom in

**Option B: Manual transform (like SvgHitbox already does)**
- [ ] Reuse the wheel + pointer drag pattern from `useCanvasInteractions.ts`
- [ ] Apply CSS `transform: translate(x, y) scale(s)` to a wrapper div
- [ ] Space+drag for pan (optional)

Either way:
- [ ] Tooltip position must update when the view transforms
- [ ] Zoom controls (+ / − buttons) in a corner

---

### Task 5: Data loading helpers

**Files:**
- Create: `src/lib/loadHitboxData.ts`

- [ ] `loadFromJson(url: string): Promise<HitboxExport>` — fetch and parse .json export
- [ ] `loadFromModule(module: typeof import("./hitboxes")): HitboxExport` — extract from .ts export (which has `svgFilename`, `svgViewBox`, `hitboxes` as named exports)
- [ ] Validate shape at runtime (check required fields exist, log warnings for malformed entries)

---

### Task 6: Usage example / demo page

**Files:**
- Create: `src/demo/Demo.tsx` (or modify existing `App.tsx`)

- [ ] Load an SVG + its hitbox JSON
- [ ] Render `<InteractiveSvg>` with click handler that logs hitbox fields to console
- [ ] Show a sidebar or panel with the clicked hitbox's field data
- [ ] Demonstrate custom `renderTooltip` usage

---

## Non-goals (out of scope)

- Editing hitboxes (that's what SvgHitbox itself does)
- Server-side rendering
- Hitbox creation or modification at runtime
- Animation between states

## Dependencies

- `react-zoom-pan-pinch` (if Option A for Task 4)
- No other new deps required — everything else is vanilla React + SVG

## Key decisions for the implementer

1. **Where does this live?** Could be a separate package/repo, or a `viewer/` directory in this repo. The consumer imports the component and passes data.
2. **Tooltip library?** Can use Radix `Popover` (already in the project via shadcn) or a plain positioned div. Radix is heavier but handles edge detection.
3. **CSS approach?** Match the existing project: Tailwind CSS v4 + shadcn components.
