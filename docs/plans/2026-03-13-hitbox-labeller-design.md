# Hitbox Labeller Design

## Problem
The KL transit map SVG has no semantic structure — station regions can't be clicked or linked. We need a tool to define rectangular clickable regions over the SVG map, tag them with metadata, and export the data so transparent interactive overlays can be rendered on top of the SVG.

## Solution
Transform the existing station labeller into a general-purpose hitbox labeller tool:

1. **File picker** — Load any SVG from disk (not hardcoded to transit-map.svg)
2. **Freeform drag-to-draw** — Click and drag to draw rectangular selection areas over station regions on the SVG
3. **Flexible metadata** — Each hitbox gets custom fields:
   - Built-in: `mode` (e.g. "rail"), `route` (e.g. "PYL"), `stop` (e.g. "PY01")
   - Custom key-value pairs the user can add/remove
4. **Export** — Two formats:
   - **JSON** (re-importable): hitbox coordinates + metadata + source SVG filename
   - **TypeScript** (.ts): typed array of hitbox objects for use in React apps
5. **Import/edit** — Load previously saved JSON to continue editing hitboxes

## Data Shape

```ts
interface Hitbox {
  id: string;           // UUID
  x: number;            // SVG-space top-left x
  y: number;            // SVG-space top-left y
  width: number;        // SVG-space width
  height: number;       // SVG-space height
  fields: Record<string, string>;  // All metadata (mode, route, stop, custom)
}

interface HitboxExport {
  svgFilename: string;
  svgViewBox: string;
  hitboxes: Hitbox[];
}
```

## UI Layout

- **Left sidebar**: List of hitboxes with search/filter, import/export buttons
- **Main area**: SVG with pan/zoom, hitbox overlay rectangles, drag-to-draw interaction
- **Bottom/right panel**: Edit form for selected hitbox metadata

## Interaction Flow

1. User loads SVG via file picker
2. User drags to draw a rectangle over a station area
3. Edit panel appears with metadata fields
4. User fills in mode/route/stop/custom fields, presses Enter or clicks Save
5. Rectangle appears with label overlay
6. Repeat for all stations
7. Export as JSON (to continue later) or .ts (for the app)

## Key Decisions

- SVG coordinates (not screen coordinates) stored — ensures hitboxes remain valid regardless of zoom/pan
- SVG filename stored in export so the consumer knows which SVG the coordinates apply to
- Flexible key-value metadata rather than fixed schema — supports different map types
- JSON as primary save format (re-importable); .ts as final export format
