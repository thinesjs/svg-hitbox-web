# Context Menu, Multi-Selection, Z-Order, Lock & Flip — Design Spec

## Problem

The hitbox labeller currently supports only single selection, has no right-click context menu, no z-order controls, no lock mechanism, and no way to select or operate on multiple hitboxes at once. This makes bulk operations tedious and the tool less capable than users expect from a Figma-style editor.

## Solution

Add a shadcn context menu with shape operations, multi-selection (Shift+click + marquee), z-order controls, lock/unlock, and flip (multi-selection). All interactions follow Figma conventions.

## Data Model Changes

### HitboxBase — add `locked`

```ts
interface HitboxBase {
  id: string;
  fields: Record<string, string>;
  locked?: boolean; // undefined/false = unlocked
}
```

`locked` is persisted in JSON export/import. The `migrateHitbox` function treats missing `locked` as `false`.

### Selection state

Replace `selectedId: string | null` with `selectedIds: string[]`.

- Empty array = nothing selected
- Array of one = single selection (edit panel shows)
- Array of 2+ = multi-selection (edit panel hidden, context menu available)
- Order matters: the last element is the "primary" selection (used to determine which hitbox the edit panel shows when exactly one is selected)

### Clipboard

Replace `clipboard: Hitbox | null` with `clipboard: Hitbox[]`. Copy captures all selected hitboxes (preserving their relative positions). Paste creates clones of all clipboard hitboxes with new IDs and offset positions.

### Z-order

Z-order remains implicit: `hitboxes[0]` is bottommost, `hitboxes[hitboxes.length - 1]` is topmost. This matches the existing `getHitboxAtPoint` iteration order and SVG paint order. No new fields needed — z-order operations reorder the `hitboxes` array.

### ViewBox type

Export the existing `ViewBox` interface (currently local to `hitboxGeometry.ts`) from `src/types.ts` so it can be shared across files:

```ts
export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

## Context Menu

Uses shadcn `ContextMenu` component (`pnpm dlx shadcn@latest add context-menu`).

A new file `src/HitboxContextMenu.tsx` wraps the canvas and provides the context menu. The menu content changes based on what's right-clicked.

### Triggering

Right-click on the canvas area triggers the context menu. The component determines what's under the cursor using `screenToSvg` + `getHitboxAtPoint`:

1. **Right-click on a hitbox that's already in the selection** → show menu for current selection
2. **Right-click on an unselected hitbox** → select it (replacing current selection), show single-selection menu
3. **Right-click on empty canvas** → clear selection, show canvas menu (paste only)

**Note:** The current `SvgCanvas.tsx` uses `setPointerCapture` only for left-button (button === 0) interactions. Right-click (button === 2) does not trigger pointer capture, so there is no conflict with the Radix context menu's pointer handling. The `HitboxContextMenu` wraps the canvas div and the `ContextMenuTrigger` is the canvas container itself.

### Paste position

- **Keyboard paste (⌘V):** Pastes at +20 SVG unit offset from the clipboard hitboxes' original positions.
- **Context menu paste on empty canvas:** Pastes centered at the cursor position (converted to SVG coordinates via `screenToSvg`). The clipboard hitboxes' relative positions are preserved — they are translated so the center of their bounding box lands at the cursor.

### Menu variants

**Single selection (1 hitbox selected):**

| Item | Shortcut | Condition |
|------|----------|-----------|
| Copy | ⌘C | — |
| Paste | ⌘V | Clipboard non-empty |
| Duplicate | ⌘D | — |
| — separator — | | |
| Bring to Front | | — |
| Bring Forward | | — |
| Send Backward | | — |
| Send to Back | | — |
| — separator — | | |
| Lock | | If unlocked |
| Unlock | | If locked |
| — separator — | | |
| Delete | ⌫ | Disabled if locked |

**Multi-selection (2+ hitboxes selected):**

| Item | Shortcut | Condition |
|------|----------|-----------|
| Copy | ⌘C | — |
| Paste | ⌘V | Clipboard non-empty |
| Duplicate | ⌘D | — |
| — separator — | | |
| Bring to Front | | — |
| Bring Forward | | — |
| Send Backward | | — |
| Send to Back | | — |
| — separator — | | |
| Flip Horizontal | | — |
| Flip Vertical | | — |
| — separator — | | |
| Lock All | | If any unlocked in selection |
| Unlock All | | If any locked in selection |
| — separator — | | |
| Delete | ⌫ | Disabled if all locked; deletes only unlocked |

For mixed selections (some locked, some unlocked), both "Lock All" and "Unlock All" appear, in that order.

**Empty canvas (nothing selected):**

| Item | Shortcut | Condition |
|------|----------|-----------|
| Paste | ⌘V | Clipboard non-empty |

### Context menu position

The shadcn `ContextMenu` positions itself at the cursor automatically. The menu must not interfere with canvas pointer events when closed.

## Multi-Selection

### Shift+click

- **Shift+click on a hitbox (canvas):** Toggles the hitbox in/out of the selection. Does not clear existing selection. The toggle fires on **pointer-up** (not pointer-down), matching Figma. This means Shift+mousedown does not immediately change the selection — if the user Shift+drags, the selection is unchanged (no toggle, no move). Only a clean Shift+click (minimal mouse movement between down and up) toggles.
- **Shift+click on a hitbox (sidebar):** Same behavior — toggles the hitbox in/out of the selection.
- **Click (no Shift) on a hitbox (canvas or sidebar):** Replaces entire selection with just that hitbox.
- **Click on empty canvas:** Clears selection entirely.

### Sidebar multi-selection

The sidebar's `onSelect` prop changes to support multi-selection:

- `onSelect(id: string)` — replaces selection (existing behavior, unchanged signature)
- New prop: `onToggleSelect(id: string)` — adds/removes from selection (called on Shift+click)
- The sidebar highlights all hitboxes in `selectedIds`, not just one.
- The sidebar prop changes from `selectedId: string | null` to `selectedIds: string[]`.

### Marquee (rubber-band) selection

**Behavior change:** Plain drag on empty canvas currently pans the view. This changes to:

- **Plain drag on empty canvas** → draws a marquee selection rectangle (dashed outline). On release, all hitboxes whose bounding box intersects the marquee rectangle are selected. If Shift is held during marquee, the intersected hitboxes are added to the existing selection instead of replacing it.
- **Marquee that selects zero hitboxes:** If no hitboxes intersect, the selection is cleared (or in Shift+marquee mode, the existing selection is unchanged).
- **Space+drag** → pan the view (hold Space, then drag). This matches Figma's panning behavior.
- **Middle-mouse drag** → pan the view (unchanged fallback).
- **Scroll wheel** → zoom (unchanged).

**Marquee hit-testing:** Intersection uses bounding-box overlap (via `hitboxBounds`). For circles, this means the circumscribing square is tested, not the circle's geometric boundary. This is intentional — it matches Figma's behavior and keeps hit-testing fast and simple.

**Marquee rendering:** The marquee rectangle is rendered as an absolutely positioned `<div>` in the canvas container (not inside the SVG overlay), using screen coordinates. This avoids coupling to the SVG transform. Style: 1px dashed `#58a6ff` border, `rgba(88, 166, 255, 0.08)` fill.

### Visual feedback

- Multi-selected hitboxes get the same blue highlight/stroke as single-selected hitboxes.
- **No resize handles** are shown for multi-selection. Resize handles only appear for single selection.
- A **dashed bounding box** is drawn around the entire multi-selection group (thin, light blue `#58a6ff`, dashed). This box is computed from the union of all selected hitboxes' bounding boxes.

### Group move

- Dragging any hitbox that's part of a multi-selection moves all selected hitboxes together.
- The delta is computed from drag start, applied to each hitbox's original position (non-cumulative, same pattern as single-hitbox move).
- **Locked hitboxes in the selection are excluded from the move** — they stay in place while unlocked ones move.
- **If all selected hitboxes are locked:** The drag gesture is a no-op. The cursor shows `not-allowed` briefly, then returns to normal. No panning or marquee behavior is triggered.
- ViewBox boundary clamping is applied per-hitbox individually.

### Alt+drag multi-duplication

When Alt is held during a drag on a multi-selection:

1. All selected hitboxes are cloned (new UUIDs, deep-copied fields).
2. The clones are inserted into the `hitboxes` array directly after their originals (preserving relative z-order).
3. The selection switches to the clones (originals are deselected).
4. The drag moves the clones while originals stay in place.
5. Locked hitboxes in the selection are also cloned — the clones are unlocked.

### Edit panel

- Shows only when exactly 1 hitbox is selected.
- Hidden when 0 or 2+ hitboxes are selected.
- No structural changes to `HitboxEditor.tsx`.

### Drawing while multi-selected

If the user switches to draw mode with a multi-selection active, draws a new hitbox, and `handleHitboxDrawn` fires, the selection is replaced with just the new hitbox (same as current behavior, which sets `selectedIds` to `[newHitbox.id]`).

## Z-Order Operations

Z-order is the position of a hitbox in the `hitboxes` array. Index 0 = bottom, last index = top.

All z-order operations work on the current selection (single or multi). When multiple hitboxes are selected, their relative order is preserved.

### Operations

**Bring to Front:** Move all selected hitboxes to the end of the array, preserving their relative order among themselves.

**Bring Forward:** Process selected hitboxes from top to bottom (highest index first). Each selected hitbox swaps with the nearest unselected hitbox above it. If the topmost selected hitbox is already at the last index (or only has other selected hitboxes above it), it stays put, and the next selected hitbox is processed.

Example: `[A, *B, C, *D, E]` → `[A, C, *B, E, *D]` (B leaps over C, D leaps over E).

**Send Backward:** Process selected hitboxes from bottom to top (lowest index first). Each selected hitbox swaps with the nearest unselected hitbox below it. If the bottommost selected hitbox is already at index 0, it stays put.

Example: `[A, *B, C, *D, E]` → `[*B, A, *D, C, E]` (B leaps over A, D leaps over C).

**Send to Back:** Move all selected hitboxes to the start of the array, preserving their relative order.

### Implementation

Pure functions in `src/hitboxGeometry.ts`:

```ts
function bringToFront(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[]
function bringForward(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[]
function sendBackward(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[]
function sendToBack(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[]
```

Each returns a new array with the same hitboxes in a new order.

## Lock

### Behavior

- **Locked hitboxes cannot be moved or resized from the canvas.** Specifically: drag-to-move and handle-drag-to-resize are no-ops on locked hitboxes. Click and Shift+click for selection still work normally. The hitbox is still a valid click target — it does not become "invisible" to pointer events.
- **Locked hitboxes cannot be deleted.** The Delete/Backspace key skips locked hitboxes. The context menu "Delete" item is disabled if all selected hitboxes are locked. If a mix of locked and unlocked are selected, Delete removes only the unlocked ones. After deletion, `selectedIds` is pruned to contain only the remaining (locked) hitboxes — they stay selected.
- **Locked hitboxes CAN be selected** — via click, Shift+click, or marquee. This allows users to unlock them via context menu.
- **Locked hitboxes CAN have fields edited** — the edit panel works normally for locked hitboxes.
- **Locked hitboxes are excluded from group move and flip** — they stay in place while unlocked hitboxes in the selection move/flip.

### Visual indicator

A small lock icon is drawn at the top-right corner of each locked hitbox's bounding box. The icon is scale-compensated (stays the same screen size regardless of zoom). The icon is a simple inline SVG padlock path (hardcoded `<path>` data — no icon library dependency), rendered in `#58a6ff` at approximately 12px screen size.

Lock icon SVG path (simple padlock):
```
M6 8V6a4 4 0 1 1 8 0v2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1z
M8 6v2h4V6a2 2 0 1 0-4 0z
```
Rendered in a 16x16 viewBox, scaled to 12px screen size, positioned at the top-right of the bounding box.

### Sidebar indicator

Locked hitboxes show a small `🔒` indicator in the sidebar list item, between the shape indicator dot and the label. The sidebar delete button (`×`) is hidden for locked hitboxes.

### Context menu

- **Single selection:** Shows "Lock" if unlocked, "Unlock" if locked.
- **Multi-selection:** Shows "Lock All" if any are unlocked, "Unlock All" if any are locked. Both appear in that order when the selection is mixed.

## Flip (Multi-Selection Only)

Flip operates on 2+ selected hitboxes. It mirrors hitbox center positions relative to the selection's bounding box center.

### Flip Horizontal

1. Compute the bounding box of all selected hitboxes (union of their individual bounding boxes).
2. For each unlocked selected hitbox, mirror its center X position: `newCenterX = bbox.centerX + (bbox.centerX - oldCenterX)`.
3. Locked hitboxes in the selection are skipped.
4. Clamp to viewBox after flipping.

### Flip Vertical

Same as horizontal but mirrors center Y position: `newCenterY = bbox.centerY + (bbox.centerY - oldCenterY)`.

### Implementation

```ts
function flipHorizontal(hitboxes: Hitbox[], selectedIds: string[], viewBox: ViewBox): Hitbox[]
function flipVertical(hitboxes: Hitbox[], selectedIds: string[], viewBox: ViewBox): Hitbox[]
```

Returns new array with flipped hitboxes. Non-selected hitboxes are unchanged.

## Keyboard Shortcuts

### New shortcuts

| Key | Action |
|-----|--------|
| ⌘C | Copy selection to clipboard |
| ⌘V | Paste from clipboard (+20 SVG unit offset from original positions) |
| ⌘D | Duplicate selection (+20 offset, selects the duplicates) |
| ⌘A | Select all hitboxes |
| Delete / Backspace | Delete selected (skips locked) |
| Escape | If multi-selected → clear to empty. If single → deselect. If draw mode → switch to select. |
| Shift+click | Add/remove hitbox from selection |
| Space+drag | Pan the canvas |
| Alt+drag | Duplicate and move (works with multi-selection, see Alt+drag section) |

**Duplicate (⌘D) details:** Clones all selected hitboxes with new IDs and +20 SVG unit offset. The duplicates are selected (originals deselected), matching Figma behavior.

**Paste offset accumulation:** Each paste always offsets from the clipboard hitboxes' stored positions, not from the last paste. This means repeated ⌘V pastes stack on top of each other at the same +20 offset. This is the simplest behavior and avoids tracking paste count.

### Changed shortcuts

- **Plain drag on empty canvas:** Was pan, now marquee selection.
- **Ctrl/Cmd+C/V:** Already partially implemented, now operates on multi-selection and `Hitbox[]` clipboard.

### Existing shortcuts (unchanged)

| Key | Action |
|-----|--------|
| V | Select mode |
| D | Draw mode |
| R | Rect shape |
| C | Circle shape |
| Scroll | Zoom |

## Pointer Event Priority (Updated)

### Select Mode

1. If Space is held → begin panning (regardless of what's under cursor)
2. If pointer is on a resize handle of the (single) selected hitbox → resize (skip if hitbox is locked)
3. If Shift is held and pointer is on a hitbox → do nothing on pointer-down (toggle happens on pointer-up if no significant mouse movement; see Shift+click section)
4. If pointer is on a hitbox in the current selection → begin group move (skip locked hitboxes in group; or Alt+drag to duplicate group). If all selected are locked → no-op.
5. If pointer is on an unselected hitbox → select it (replace selection), begin move (unless locked, then just select)
6. If pointer is on empty canvas → begin marquee selection (Shift+marquee adds to selection)

### Draw Mode (unchanged)

1. Any mousedown on canvas → begin drawing the selected shape
2. Scroll wheel → zoom

## Pan Behavior Change

Current: plain drag on empty canvas pans.
New: Space+drag pans (or middle-mouse drag).

This is a breaking change from the current UX. The trade-off is enabling marquee selection, which is more valuable for the multi-select workflow. Space+drag is the Figma convention.

**Space key handling:**
- On keydown, set a `spaceHeld` flag (ref, not state — avoids re-renders).
- While `spaceHeld` is true, pointer down starts panning regardless of what's under the cursor.
- On keyup, clear the flag.
- The cursor changes to `grab` while Space is held, `grabbing` while Space+dragging.
- **Input guard:** The Space keydown handler must check `e.target` — if focus is on an `<input>` or `<textarea>`, Space should type a space character, not activate pan mode. Use the same guard as the existing keyboard shortcut handler (`e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement`).
- **`preventDefault()`:** Call `e.preventDefault()` on Space keydown (when not in an input) to suppress browser page-scroll behavior.

## File Changes

### Modified files

- **`src/types.ts`** — Add `locked?: boolean` to `HitboxBase`, export `ViewBox` interface
- **`src/App.tsx`** — Replace `selectedId` with `selectedIds: string[]`, replace `clipboard` with `Hitbox[]`, add z-order/lock/flip/duplicate handlers, update keyboard shortcuts for ⌘D and ⌘A, adapt all callbacks that used `selectedId`, pass `selectedIds` to sidebar/canvas/editor
- **`src/SvgCanvas.tsx`** — Extract interaction logic to hook, adapt for multi-selection rendering (group bounding box, no handles for multi), right-click event passthrough for context menu, space+drag pan, marquee selection, lock icon overlay. Props change: `selectedId` → `selectedIds`
- **`src/HitboxSidebar.tsx`** — Props change: `selectedId` → `selectedIds`, add `onToggleSelect` prop for Shift+click, lock indicator in list items, hide delete button for locked hitboxes, updated keyboard hints
- **`src/HitboxEditor.tsx`** — No structural changes; parent controls visibility (shown only when `selectedIds.length === 1`)
- **`src/hitboxGeometry.ts`** — Add z-order functions (`bringToFront`, `bringForward`, `sendBackward`, `sendToBack`), flip functions (`flipHorizontal`, `flipVertical`), marquee intersection helper (`hitboxesInMarquee`). Remove local `ViewBox` interface (use exported one from types.ts).

### New files

- `src/useCanvasInteractions.ts` — Custom hook extracted from SvgCanvas containing: pointer event handlers, interaction state machine, marquee logic, space-held tracking. SvgCanvas becomes primarily a render component.
- `src/HitboxContextMenu.tsx` — Context menu component with three variants (single, multi, canvas). Receives selection state and action callbacks as props.
- `src/components/ui/context-menu.tsx` — shadcn context-menu (generated by `pnpm dlx shadcn@latest add context-menu`)

## Import/Export Compatibility

- **Export:** `locked` field is included in JSON export when `true`. Hitboxes without `locked` or with `locked: false` omit the field for cleaner output.
- **Import:** `migrateHitbox` treats missing `locked` as `false`. Existing v1/v2 JSON files import without issues.
- **TypeScript export:** The exported types include the `locked` field.

## Out of Scope

- **Multi-select resize** — scaling all selected hitboxes proportionally. Only single-hitbox resize is supported.
- **Undo/redo** — not included in this iteration.
- **Keyboard z-order shortcuts** (e.g., ⌘+] / ⌘+[) — z-order is context-menu only for now.
- **Group/ungroup** — treating a multi-selection as a persistent group object.
- **Align/distribute** — snapping selected hitboxes to align edges or distribute spacing.
