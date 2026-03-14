# Bulk Field Editor — Design Spec

## Summary

When multiple hitboxes are selected, show a bottom popover that displays the built-in fields (mode, feed, route, stop) with common values pre-filled or "Mixed" placeholder for differing values. Editing a field applies the new value to all selected hitboxes.

## Trigger

Shown when `selectedIds.length > 1`. Replaces the current behavior where multi-selection shows no editor.

## UI

Same position and styling as the single-hitbox `HitboxEditor` — absolute bottom-center popover, `480px` wide, rounded, shadow.

### Header

```
Edit 5 hitboxes                                          [×]
```

Shows count of selected hitboxes and a close button. No delete button (use context menu or keyboard for multi-delete). No coordinate display.

### Fields

Only the 4 built-in fields: `mode`, `feed`, `route`, `stop`. No custom fields section, no "Add field" input.

Each field input:
- If all selected hitboxes have the same value → show that value
- If values differ → empty input with "Mixed" placeholder
- Editing a field applies the value to all selected hitboxes immediately (on every keystroke, same as single editor)

## Component

New file: `src/BulkFieldEditor.tsx`

```ts
interface BulkFieldEditorProps {
  hitboxes: Hitbox[];
  selectedIds: string[];
  onBulkFieldChange: (ids: string[], key: string, value: string) => void;
  onClose: () => void;
}
```

- Computes common values by iterating selected hitboxes for each built-in key
- `onBulkFieldChange(ids, key, value)` — new callback that sets `fields[key] = value` on all hitboxes with the given IDs
- Local state tracks which fields the user has edited (to distinguish between "Mixed but untouched" and "user cleared the field")

## App.tsx changes

- Add `handleBulkFieldChange` callback:
  ```ts
  const handleBulkFieldChange = useCallback((ids: string[], key: string, value: string) => {
    setHitboxes((prev) =>
      prev.map((h) =>
        ids.includes(h.id) ? { ...h, fields: { ...h.fields, [key]: value } } : h,
      ),
    );
  }, []);
  ```
- Render `BulkFieldEditor` when `selectedIds.length > 1` (alongside or instead of the single HitboxEditor conditional)

## File structure

| Action | File | Change |
|--------|------|--------|
| Create | `src/BulkFieldEditor.tsx` | New component |
| Modify | `src/App.tsx` | Add `handleBulkFieldChange`, render `BulkFieldEditor` |

## Non-goals

- Custom fields in bulk mode
- Showing geometry/coordinates of multi-selection
- Inline delete button (context menu handles this)
