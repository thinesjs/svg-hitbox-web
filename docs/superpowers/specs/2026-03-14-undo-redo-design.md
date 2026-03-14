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
  beginBatch: () => void;
  commitBatch: () => void;
}

function useHistory<T>(initialState: T, maxEntries?: number): UseHistoryReturn<T>;
```

- `maxEntries` defaults to 100. When the undo stack exceeds this, the oldest entry is dropped.
- `setState` accepts a value or updater function (same API as React's `useState` setter), so existing `setHitboxes(prev => ...)` call sites work without changes.
- `undo()` moves current state to redo stack, pops undo stack to current.
- `redo()` moves current state to undo stack, pops redo stack to current.
- `resetHistory(newState?)` clears both stacks. If `newState` is provided, sets that as current. Used on SVG load and JSON import — replaces `setHitboxes()` at those call sites (not called alongside it).
- `canUndo` / `canRedo` are derived from stack lengths.
- Internally uses `useRef` for the stacks (not state) to avoid re-renders when only the stacks change. Only the current value is React state.
- `undo` and `redo` are stable refs (wrapped in `useCallback` with no deps) so they don't cause re-renders of the keyboard handler effect.

### Batch API for continuous interactions

During drag and resize, `setHitboxes` is called on every pointer-move event (50-200+ times per drag). Without batching, each call would push to the undo stack, destroying all prior history.

- `beginBatch()` — snapshots the current state as the "pre-batch" state. Subsequent `setState` calls update the current value but do NOT push to the undo stack.
- `commitBatch()` — pushes the pre-batch snapshot onto the undo stack as a single undo entry, clears the redo stack. The current state (after all intermediate mutations) becomes the new "current."
- If `beginBatch()` is called without a matching `commitBatch()`, the batch is abandoned (no undo entry created). This is a safety net, not expected in practice.
- Internally, a `batchRef` holds the pre-batch snapshot (or `null` when not batching).

### Integration with canvas interactions

In `src/App.tsx`, expose `beginBatch` and `commitBatch` to `SvgCanvas` via new props, which forwards them to `useCanvasInteractions`. The canvas hook calls `beginBatch()` on pointer-down when starting a move/resize, and `commitBatch()` on pointer-up.

New props on `SvgCanvas`:
```ts
onBeginBatch: () => void;
onCommitBatch: () => void;
```

In `useCanvasInteractions.ts`, call `onBeginBatch()` at the start of a move/resize (when `type` transitions to `"moving"` or `"resizing"`) and `onCommitBatch()` on pointer-up.

## App.tsx changes

Replace:
```ts
const [hitboxes, setHitboxes] = useState<Hitbox[]>([]);
```

With:
```ts
const { state: hitboxes, setState: setHitboxes, undo, redo, canUndo, canRedo, resetHistory, beginBatch, commitBatch } = useHistory<Hitbox[]>([]);
```

All existing `setHitboxes` call sites remain unchanged — the hook's `setState` has the same signature.

Replace `setHitboxes` with `resetHistory(newState)` at these specific call sites:
- `handleLoadSvg` — replace `setHitboxes([])` with `resetHistory([])`
- `handleImportJSON` — replace `setHitboxes(migrated)` with `resetHistory(migrated)`
- localStorage mount effect — replace `setHitboxes(migrated)` with `resetHistory(migrated)`

After `undo()` or `redo()`, prune `selectedIds` to remove any IDs that no longer exist in the restored hitboxes array:
```ts
const handleUndo = useCallback(() => {
  undo();
  setSelectedIds(prev => prev.filter(id => hitboxesRef.current.some(h => h.id === id)));
}, [undo]);
```

## Keyboard shortcuts

Add to the existing keyboard handler in App.tsx (the `useEffect` at ~line 430), inside the `if (e.ctrlKey || e.metaKey)` branch, **before** existing copy/paste handlers:

1. Check `Shift+Z` first → `redo()` (must come before bare `z` check)
2. Then check `Z` → `undo()`

Add `handleUndo` and `handleRedo` to the `useEffect` dependency array.

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

In `HitboxContextMenu.tsx`, add "Undo" and "Redo" items at the top of the menu (before any existing items), with keyboard shortcut hints. Disabled when `canUndo` / `canRedo` is false. Separated from the rest of the menu with a `ContextMenuSeparator`.

New props on `HitboxContextMenuProps`:
```ts
onUndo: () => void;
onRedo: () => void;
canUndo: boolean;
canRedo: boolean;
```

## What is NOT undoable

- Selection (`selectedIds`) — but phantom selections are pruned after undo/redo
- Tool mode / draw shape
- Clipboard contents
- Pan / zoom
- Preview dialog state
- SVG file loading (loading a new SVG resets history)

## localStorage

Auto-save continues as before — it saves the current `hitboxes` value. History stacks are NOT persisted (cleared on page reload). This keeps localStorage usage predictable.

## Memory

At 100 max entries, with typical hitbox arrays of <500 objects (~50KB each as JSON), the stack would use ~5MB max. Negligible for a desktop browser tool.

## File structure

| Action | File | Change |
|--------|------|--------|
| Create | `src/useHistory.ts` | The custom hook with batch API |
| Modify | `src/App.tsx` | Replace `useState` with `useHistory`, add undo/redo shortcuts, pass batch/undo/redo props |
| Modify | `src/HitboxSidebar.tsx` | Add undo/redo buttons in header |
| Modify | `src/HitboxContextMenu.tsx` | Add undo/redo menu items |
| Modify | `src/SvgCanvas.tsx` | Pass batch props through to `useCanvasInteractions` |
| Modify | `src/useCanvasInteractions.ts` | Call `onBeginBatch` / `onCommitBatch` on drag start/end |

## Non-goals

- Persisting history across page reloads
- Undo for selection changes or tool mode
- Granular undo for drag operations (each drag = one undo step via batching)
