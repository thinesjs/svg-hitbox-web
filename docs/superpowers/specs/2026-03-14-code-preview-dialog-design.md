# Code Preview Dialog — Design Spec

## Summary

Add a dialog that previews the exported JSON and TypeScript code inline, with syntax highlighting and a copy button. Users can toggle between JSON and TS tabs without leaving the app.

## Trigger

A new "Preview" button in the sidebar's export section (alongside Import, Save, Export).

## UI Structure

```
┌─────────────────────────────────────────────┐
│  Code Preview                           [X] │
│                                             │
│  ┌──────┐ ┌──────┐                  [Copy]  │
│  │ JSON │ │  TS  │                          │
│  └──────┘ └──────┘                          │
│ ┌─────────────────────────────────────────┐ │
│ │ 1  {                                    │ │
│ │ 2    "svgFilename": "map.svg",          │ │
│ │ 3    "svgViewBox": "0 0 800 600",       │ │
│ │ 4    "hitboxes": [                      │ │
│ │ 5      {                                │ │
│ │ 6        "id": "abc-123",               │ │
│ │ 7        ...                            │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Components

### `CodePreviewDialog.tsx`

New file. Accepts:

```ts
interface CodePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsonCode: string;   // Pre-generated JSON string
  tsCode: string;     // Pre-generated TS string
}
```

Internals:
- Uses shadcn `Dialog` (needs to be added via `pnpm dlx shadcn@latest add dialog`)
- Uses shadcn `Tabs` (needs to be added via `pnpm dlx shadcn@latest add tabs`)
- `activeTab` state: `"json" | "ts"`, defaults to `"json"`
- Code block: `<pre>` with Shiki-highlighted HTML via `dangerouslySetInnerHTML`
- Wrapped in shadcn `ScrollArea` for overflow
- Copy button: uses `navigator.clipboard.writeText()`, shows "Copied!" for 2 seconds via local state

### Syntax highlighting — Shiki

- Dependency: `shiki` (~200KB, tree-shakeable)
- Use `codeToHtml()` with `lang: "json"` or `lang: "typescript"`
- Theme: `"github-dark"` (matches the app's dark UI)
- Highlight on tab switch and when code changes — memoize with `useMemo` or `useEffect` + state
- Since `codeToHtml` is async, initialize with unhighlighted `<pre><code>` and replace once Shiki resolves

### Sidebar changes

In `HitboxSidebar.tsx`, add a "Preview" button in the export section (between "Save (.json)" and "Export (.ts)"). Outline variant, same style as siblings.

### App.tsx changes

- Add `previewOpen` state (`boolean`)
- Add `generateJsonString()` and `generateTsString()` — extract the string generation logic from existing `onExportJSON` and `onExportTS` (currently they generate + download in one step; split so the string can be passed to the dialog)
- Pass `previewOpen`, `onPreviewOpenChange`, `jsonCode`, `tsCode` to `CodePreviewDialog`
- Memoize `jsonCode` and `tsCode` with `useMemo` keyed on `[hitboxes, svgData]` so they don't regenerate on every render

## Dependencies to add

- `shiki` — syntax highlighting

## shadcn components to add

- `dialog`
- `tabs`

## Behavior

1. User clicks "Preview" in sidebar
2. Dialog opens with JSON tab active
3. Code is syntax-highlighted with Shiki (github-dark theme)
4. User can switch to TS tab — code updates, highlighting updates
5. Copy button copies active tab's raw code string to clipboard
6. "Copied!" feedback shown for 2 seconds, then reverts to "Copy"
7. Dismiss via X button, Escape, or clicking outside overlay

## Non-goals

- Editing code in the dialog
- Monaco editor or any heavy editor component
- Line selection, search, or minimap
- Direct download from the dialog (existing export buttons handle that)
