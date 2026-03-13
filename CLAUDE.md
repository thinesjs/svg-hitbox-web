# KL Transit Map - Interactive Station Labeller

## Project Purpose

This is a labelling tool for the Kuala Lumpur (KL) Klang Valley Integrated Transit Map. The end goal is to produce a clean `stations.ts` data file that maps every rail station to its SVG coordinates, so the SVG map can be made interactive in a React/TypeScript web app.

## Background

The source SVG (`public/transit-map.svg`) is the official RapidKL transit map. It has the following characteristics:

- 6002 lines, single flat structure under `<g id="Layer_1">`
- **Zero `<text>` elements** — all station labels are outlined paths (Illustrator "Create Outlines" was used)
- **No semantic IDs or data attributes** on station elements — only clipPath IDs exist
- Station dots are `<path>` elements drawing circles with radius 6.22, not `<circle>` elements
- Each station dot is typically two overlapping paths: a filled path + a stroked path at the same coordinates
- Interchange stations have a more complex double-circle/figure-eight shape with `stroke-width="1.8"`
- Everything is at the same nesting level — no `<g>` grouping per station
- SVG viewBox: `0 0 1755.16 2844.49`

## How Station Coordinates Were Extracted

A Python script parsed the SVG looking for `<path>` elements containing `6.22` (the circle radius) at least 4 times and under 300 chars long. The center point was calculated from the M (moveTo) coordinate and the direction of the first cubic bezier curve command. This produced 248 unique coordinate positions.

Station dot colors map to rail lines:

| Color | Line |
|-------|------|
| `#fecf0a` | LRT Kelana Jaya |
| `#db1e37` | LRT Ampang / Shah Alam |
| `#057a40` | LRT Sri Petaling |
| `#c12334` | KTM Batu Caves - Pulau Sebang |
| `#18488b` | KTM Tanjung Malim - Pelabuhan Klang |
| `#3eb2e1` | KTM Skypark / Shuttle |
| `#e57525` | MRT Kajang |
| `#7a2430` | MRT Putrajaya |
| `#80bb42` | KL Monorail |
| `#00a4b4` | ERL KLIA Transit |
| `#94398e` | MRL |
| `#124835` | BRT Sunway |
| `#78722e` | KTM Tanjung Malim extension |
| `#383938` | Interchange marker (gray) |

## Current State

- **248 station positions** extracted from SVG
- **234 pre-labelled** by cross-referencing a raster image of the map with coordinate positions — these names need verification, some will be wrong
- **14 unlabelled** — these show as red rings in the tool
- Station names were matched by visual position along each rail line, reading from a PNG render of the map. Errors are most likely on: KTM lines (light blue `#3eb2e1` and crimson `#c12334`), far-left/far-right edge stations, and interchange stations where multiple lines overlap

## Project Structure

```
station-labeller/
├── CLAUDE.md              # This file
├── index.html             # Vite entry
├── package.json           # React 18 + Vite 5 + TypeScript 5
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── transit-map.svg    # Source SVG map (read-only reference)
└── src/
    ├── main.tsx           # React entry
    ├── index.css          # Global styles (CSS variables, dark theme)
    ├── App.tsx            # Main app — state management, export logic, keyboard shortcuts
    ├── Sidebar.tsx        # Left panel — progress bar, line filter, visibility toggles, import/export buttons
    ├── MapView.tsx        # SVG map renderer with pan/zoom, station overlay circles, hit targets
    ├── EditPopover.tsx    # Bottom popover for editing station name, with nav buttons
    ├── types.ts           # RawStation and LineInfo interfaces
    └── rawStations.json   # The 248 station coordinate entries with pre-filled names
```

## Key Data Structures

### RawStation (in rawStations.json and types.ts)
```ts
{
  idx: number;        // Unique index (0-247)
  cx: number;         // SVG x coordinate
  cy: number;         // SVG y coordinate
  color: string;      // Hex color from SVG fill — identifies the rail line
  lineName: string;   // Human-readable line name
  isInterchange: boolean; // True if multiple line colors found at this coordinate
  name: string;       // Station name — empty string if unlabelled
}
```

### Exported Station (output of "Export stations.ts")
```ts
{
  id: string;           // e.g. "lrt_kelana_jaya-gombak"
  name: string;         // e.g. "Gombak"
  cx: number;
  cy: number;
  lineId: string;       // e.g. "lrt_kelana_jaya"
  lineColor: string;    // e.g. "#fecf0a"
  isInterchange: boolean;
}
```

## How the Labelling Tool Works

1. Renders SVG map as `<image>` inside an `<svg>` element
2. Overlays clickable `<circle>` elements at each extracted station coordinate
3. Green ring = labelled, red ring = unlabelled, blue ring = selected
4. Click a dot → bottom popover with name input → Enter saves and advances to next
5. Sidebar filters by line color and labelled/unlabelled status
6. "Save Progress" exports current state as JSON for re-import
7. "Export stations.ts" generates the final TypeScript file

## What Remains To Do

1. **Verify all 234 pre-filled station names** — compare against official RapidKL map
2. **Label the remaining ~14 stations** using the tool
3. **Handle interchange stations** — currently a station at an interchange coordinate only gets one line's color. The final app may need a station to belong to multiple lines. Consider restructuring to a `lines: string[]` array.
4. **Build the actual interactive map component** — once labelling is done:
   - Strip station circle paths from the original SVG (keep rail lines, labels, legend)
   - Inline the stripped SVG in a React component
   - Render station dots from `stations.ts` data as `<circle>` elements with `onClick`
   - Use event delegation or individual handlers
   - Add larger invisible hit targets (`r={20}`, `fill="transparent"`) for mobile
   - Wrap in `react-zoom-pan-pinch` for mobile pan/zoom
   - All elements share the same `viewBox` so scaling is automatic
5. **Decide what happens on station click** — tooltip, sidebar panel, modal, bottom sheet, navigation, etc.

## Tech Stack

- React 18
- TypeScript 5
- Vite 5
- No UI framework — vanilla CSS with CSS variables

## Commands

```bash
npm install
npm run dev      # Dev server
npm run build    # Production build
```
