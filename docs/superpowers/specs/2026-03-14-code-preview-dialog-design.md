# Code Preview Dialog — Design Spec

## Summary

Add a dialog that previews the exported JSON and TypeScript code inline, with syntax highlighting and a copy button. Users can toggle between JSON and TS tabs without leaving the app.

## Trigger

A new "Preview" button in the sidebar's export section (alongside Import, Save, Export). Outline variant, matching Import and Save buttons. Placed after "Save (.json)" and before "Export (.ts)".

## UI Structure

```
┌─────────────────────────────────────────────┐
│  Code Preview                           [X] │
│                                             │
│  ┌──────┐ ┌──────┐                  [Copy]  │
│  │ JSON │ │  TS  │                          │
│  └──────┘ └──────┘                          │
│ ┌─────────────────────────────────────────┐ │
│ │ {                                       │ │
│ │   "svgFilename": "map.svg",             │ │
│ │   "svgViewBox": "0 0 800 600",          │ │
│ │   "hitboxes": [                         │ │
│ │     {                                   │ │
│ │       "id": "abc-123",                  │ │
│ │       ...                               │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

Dialog: `max-w-3xl w-full`, max height `80vh`. No line numbers. Code block scrolls vertically via `ScrollArea`.

## Components

### `src/CodePreviewDialog.tsx`

New file at `src/` (alongside other app-level components). Accepts:

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
  - Safety note: input is app-generated code only (not user-provided external content), so XSS risk is negligible. Do not extend this pattern to untrusted input without sanitization.
- Wrapped in shadcn `ScrollArea` for vertical overflow
- Copy button: uses `navigator.clipboard.writeText()` wrapped in try/catch, shows "Copied!" for 2 seconds via local state

### Syntax highlighting — Shiki

- Dependency: `shiki`
- Use fine-grained imports to minimize bundle size:
  ```ts
  import { createHighlighter } from "shiki";
  ```
  Create a single highlighter instance at module scope with only `json` + `typescript` langs and `github-light` theme.
- Theme: `"github-light"` (the app runs in light mode — no `.dark` class on `<html>`)
- Highlighting is async. Use `useEffect` + `useState` for the highlighted HTML string:
  1. On mount / when code or activeTab changes, call `highlighter.codeToHtml()`
  2. Store result in `highlightedHtml` state
  3. Until resolved, render raw code in a plain `<pre><code>` as fallback
- `useMemo` cannot be used here because `codeToHtml` returns a Promise.

### Sidebar changes

In `HitboxSidebar.tsx`:
- Add `onPreview: () => void` to `HitboxSidebarProps`
- Add a "Preview" button (outline variant) between "Save (.json)" and "Export (.ts)"

### App.tsx changes

- Add `previewOpen` boolean state
- Extract `generateJsonString(hitboxes, svgData)` and `generateTsString(hitboxes, svgData)` as pure functions — split out of the existing `onExportJSON` / `onExportTS` which currently generate + download in one step
- Generate code strings **lazily** — only compute when `previewOpen` is true:
  ```ts
  const jsonCode = previewOpen ? generateJsonString(hitboxes, svgData) : "";
  const tsCode = previewOpen ? generateTsString(hitboxes, svgData) : "";
  ```
  This avoids regenerating on every hitbox change when the dialog is closed.
- Render `<CodePreviewDialog>` with `open={previewOpen}`, `onOpenChange={setPreviewOpen}`, `jsonCode`, `tsCode`
- The sidebar/canvas already only renders when `svgData` is truthy (the `!svgData` case returns a landing screen), so the Preview button is never visible when there's no SVG loaded. Zero hitboxes is valid — shows an empty `hitboxes: []` array.

## Dependencies to add

- `shiki` — syntax highlighting

## shadcn components to add

- `dialog`
- `tabs`

## Behavior

1. User clicks "Preview" in sidebar
2. Dialog opens with JSON tab active, `max-w-3xl`, up to 80vh tall
3. Code is syntax-highlighted with Shiki (`github-light` theme)
4. User can switch to TS tab — highlighting updates via `useEffect`
5. Copy button copies active tab's raw code string to clipboard
6. "Copied!" feedback shown for 2 seconds, then reverts to "Copy"
7. Dismiss via X button, Escape, or clicking outside overlay
8. Tab resets to JSON each time dialog opens

## Non-goals

- Editing code in the dialog
- Monaco editor or any heavy editor component
- Line numbers, line selection, search, or minimap
- Direct download from the dialog (existing export buttons handle that)
- Keyboard shortcut for opening the dialog
