# Undo / Redo — Design Spec

## Summary

Add undo/redo for all hitbox mutations using a snapshot-based history stack. Accessible via keyboard shortcuts, sidebar buttons, and context menu items.

## Approach

Snapshot-based: store full `Hitbox[]` arrays on a stack. On each mutation, push the previous state onto the undo stack and clear the redo stack. Simple, no changes needed to existing mutation logic.

## `useHistory` hook

New file: `src/useHistory.ts`

```ts
interface UseHistoryReturn<T> {
  state: T;
  setState: (valueOrUpdater: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: (newState?: T) => void;
}

function useHistory<T>(initialState: T, maxEntries?: number): UseHistoryReturn<T>;
```

- `maxEntries` defaults to 50. When the undo stack exceeds this, the oldest entry is dropped.
- `setState` accepts a value or updater function (same API as React's `useState` setter), so existing `setHitboxes(prev => ...)` call sites work without changes.
- `undo()` moves current state to redo stack, pops undo stack to current.
- `redo()` moves current state to undo stack, pops redo stack to current.
- `resetHistory(newState?)` clears both stacks. If `newState` is provided, sets that as current. Used on SVG load and JSON import.
- `canUndo` / `canRedo` are derived from stack lengths.
- Internally uses `useRef` for the stacks (not state) to avoid re-renders when only the stacks change. Only the current value is React state.

## App.tsx changes

Replace:
```ts
const [hitboxes, setHitboxes] = useState<Hitbox[]>([]);
```

With:
```ts
const { state: hitboxes, setState: setHitboxes, undo, redo, canUndo, canRedo, resetHistory } = useHistory<Hitbox[]>([]);
```

All existing `setHitboxes` call sites remain unchanged — the hook's `setState` has the same signature.

Call `resetHistory()` when:
- Loading a new SVG (`handleLoadSvg` — after `setHitboxes([])`)
- Importing JSON (`handleImportJSON` — after `setHitboxes(migrated)`)
- Loading from localStorage on mount (after `setHitboxes(migrated)`)

For localStorage load and JSON import, use `resetHistory(newState)` to set the initial state without pushing to the undo stack.

## Keyboard shortcuts

Add to the existing keyboard handler in App.tsx (the `useEffect` at ~line 430):

- `Cmd+Z` / `Ctrl+Z` → `undo()`
- `Cmd+Shift+Z` / `Ctrl+Shift+Z` → `redo()`

These go in the `if (e.ctrlKey || e.metaKey)` branch, before the existing copy/paste handlers.

## Sidebar buttons

In `HitboxSidebar.tsx`, add two icon buttons in the header area (next to the "SvgHitbox" title). Use Remix Icon arrows:

```tsx
import { RiArrowGoBackLine, RiArrowGoForwardLine } from "@remixicon/react";
```

Two small ghost-variant buttons, disabled when `canUndo` / `canRedo` is false. Placed in a flex row with the title.

New props on `HitboxSidebarProps`:
```ts
onUndo: () => void;
onRedo: () => void;
canUndo: boolean;
canRedo: boolean;
```

## Context menu

In `HitboxContextMenu.tsx`, add "Undo" and "Redo" items at the top of the menu (before any existing items), with keyboard shortcut hints (`Cmd+Z` / `Cmd+Shift+Z`). Disabled when `canUndo` / `canRedo` is false.

New props on `HitboxContextMenuProps`:
```ts
onUndo: () => void;
onRedo: () => void;
canUndo: boolean;
canRedo: boolean;
```

## What is NOT undoable

- Selection (`selectedIds`)
- Tool mode / draw shape
- Clipboard contents
- Pan / zoom
- Preview dialog state
- SVG file loading (loading a new SVG resets history)

## localStorage

Auto-save continues as before — it saves the current `hitboxes` value. History stacks are NOT persisted (cleared on page reload). This keeps localStorage usage predictable.

## Memory

At 50 max entries, with typical hitbox arrays of <500 objects (~50KB each as JSON), the stack would use ~2.5MB max. Negligible for a desktop browser tool.

## File structure

| Action | File | Change |
|--------|------|--------|
| Create | `src/useHistory.ts` | The custom hook |
| Modify | `src/App.tsx` | Replace `useState` with `useHistory`, add undo/redo shortcuts, pass props |
| Modify | `src/HitboxSidebar.tsx` | Add undo/redo buttons in header |
| Modify | `src/HitboxContextMenu.tsx` | Add undo/redo menu items |

## Non-goals

- Persisting history across page reloads
- Undo for selection changes or tool mode
- Granular undo for drag operations (each pointer-up commits one snapshot, not per-pixel)
- Undo grouping / batching (each `setHitboxes` call = one undo step)
