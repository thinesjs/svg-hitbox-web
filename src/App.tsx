import { useState, useCallback, useEffect, useRef } from "react";
import type { SvgData, Hitbox, HitboxExport, ToolMode, DrawShape } from "./types";
import SvgCanvas from "./SvgCanvas";
import HitboxSidebar from "./HitboxSidebar";
import HitboxEditor from "./HitboxEditor";
import { Button } from "@/components/ui/button";
import {
  bringToFront, bringForward, sendBackward, sendToBack,
  flipHorizontal, flipVertical,
} from "./hitboxGeometry";

function parseSvgViewBox(svgText: string): { x: number; y: number; width: number; height: number } {
  const vbMatch = svgText.match(/viewBox="([^"]+)"/);
  if (vbMatch) {
    const [x, y, w, h] = vbMatch[1].split(/[\s,]+/).map(Number);
    return { x, y, width: w, height: h };
  }
  const wMatch = svgText.match(/<svg[^>]*\bwidth="([\d.]+)/);
  const hMatch = svgText.match(/<svg[^>]*\bheight="([\d.]+)/);
  if (wMatch && hMatch) {
    return { x: 0, y: 0, width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) };
  }
  return { x: 0, y: 0, width: 800, height: 600 };
}

/** Migrate v1 hitbox data (no shape field) to v2 (shape: "rect") */
function migrateHitbox(h: unknown): Hitbox | null {
  if (typeof h !== "object" || h === null) return null;
  const obj = h as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.fields !== "object" || obj.fields === null) return null;

  if (obj.shape === "circle") {
    if (typeof obj.cx !== "number" || typeof obj.cy !== "number" || typeof obj.r !== "number") return null;
    return obj as unknown as Hitbox;
  }

  // Rect — either explicit shape or legacy (no shape field)
  if (typeof obj.x !== "number" || typeof obj.y !== "number" ||
      typeof obj.width !== "number" || typeof obj.height !== "number") return null;

  return { shape: "rect", ...obj } as unknown as Hitbox;
}

export default function App() {
  const [svgData, setSvgData] = useState<SvgData | null>(null);
  const [hitboxes, setHitboxes] = useState<Hitbox[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [drawShape, setDrawShape] = useState<DrawShape>("rect");
  const [clipboard, setClipboard] = useState<Hitbox[]>([]);

  // Refs for keyboard handler (avoid stale closures without extra deps)
  const hitboxesRef = useRef(hitboxes);
  hitboxesRef.current = hitboxes;
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // Load persisted state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hitbox-labeller-state");
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data.svgData) setSvgData(data.svgData);
      if (Array.isArray(data.hitboxes)) {
        const migrated = data.hitboxes.map(migrateHitbox).filter((h: Hitbox | null): h is Hitbox => h !== null);
        setHitboxes(migrated);
      }
    } catch {
      // Ignore corrupt data
    }
  }, []);

  // Auto-save to localStorage on change (debounced)
  useEffect(() => {
    if (!svgData) return;
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem("hitbox-labeller-state", JSON.stringify({ svgData, hitboxes }));
      } catch {
        // localStorage full or unavailable
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [svgData, hitboxes]);

  // Disable browser zoom (Ctrl+scroll, Ctrl+plus/minus, pinch)
  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const preventKeyZoom = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")) {
        e.preventDefault();
      }
    };
    document.addEventListener("wheel", preventZoom, { passive: false });
    document.addEventListener("keydown", preventKeyZoom);
    return () => {
      document.removeEventListener("wheel", preventZoom);
      document.removeEventListener("keydown", preventKeyZoom);
    };
  }, []);

  const handleLoadSvg = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svg";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setSvgData({ filename: file.name, svgText: text, viewBox: parseSvgViewBox(text) });
      setHitboxes([]);
      setSelectedIds([]);
      setToolMode("select");
    };
    input.click();
  }, []);

  const handleHitboxDrawn = useCallback((hitbox: Hitbox) => {
    setHitboxes((prev) => [...prev, hitbox]);
    setSelectedIds([hitbox.id]);
    setToolMode("select");
  }, []);

  const handleHitboxUpdate = useCallback((id: string, patch: Partial<Hitbox>) => {
    setHitboxes((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch } as Hitbox : h))
    );
  }, []);

  const handleDeleteSelected = useCallback(() => {
    const ids = new Set(selectedIdsRef.current);
    const lockedInSelection = new Set(
      hitboxesRef.current
        .filter((h) => ids.has(h.id) && h.locked)
        .map((h) => h.id)
    );
    setHitboxes((prev) => prev.filter((h) =>
      !ids.has(h.id) || lockedInSelection.has(h.id)
    ));
    setSelectedIds((prev) => prev.filter((id) => lockedInSelection.has(id)));
  }, []);

  const handleDeleteSingle = useCallback((id: string) => {
    const hb = hitboxesRef.current.find((h) => h.id === id);
    if (hb?.locked) return;
    setHitboxes((prev) => prev.filter((h) => h.id !== id));
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
  }, []);

  const handleFieldsChange = useCallback((id: string, fields: Record<string, string>) => {
    setHitboxes((prev) => prev.map((h) => (h.id === id ? { ...h, fields } : h)));
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds([id]);
    setToolMode("select");
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  }, []);

  // --- Z-order handlers ---

  const handleBringToFront = useCallback(() => {
    setHitboxes((prev) => bringToFront(prev, selectedIdsRef.current));
  }, []);

  const handleBringForward = useCallback(() => {
    setHitboxes((prev) => bringForward(prev, selectedIdsRef.current));
  }, []);

  const handleSendBackward = useCallback(() => {
    setHitboxes((prev) => sendBackward(prev, selectedIdsRef.current));
  }, []);

  const handleSendToBack = useCallback(() => {
    setHitboxes((prev) => sendToBack(prev, selectedIdsRef.current));
  }, []);

  // --- Lock handlers ---

  const handleLock = useCallback(() => {
    setHitboxes((prev) =>
      prev.map((h) => selectedIdsRef.current.includes(h.id) ? { ...h, locked: true } : h)
    );
  }, []);

  const handleUnlock = useCallback(() => {
    setHitboxes((prev) =>
      prev.map((h) => selectedIdsRef.current.includes(h.id) ? { ...h, locked: false } : h)
    );
  }, []);

  // --- Flip handlers ---

  const handleFlipHorizontal = useCallback(() => {
    if (!svgData) return;
    setHitboxes((prev) => flipHorizontal(prev, selectedIdsRef.current, svgData.viewBox));
  }, [svgData]);

  const handleFlipVertical = useCallback(() => {
    if (!svgData) return;
    setHitboxes((prev) => flipVertical(prev, selectedIdsRef.current, svgData.viewBox));
  }, [svgData]);

  // --- Import/Export ---

  const handleExportJSON = useCallback(() => {
    if (!svgData) return;
    const data: HitboxExport = {
      svgFilename: svgData.filename,
      svgViewBox: `${svgData.viewBox.x} ${svgData.viewBox.y} ${svgData.viewBox.width} ${svgData.viewBox.height}`,
      hitboxes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${svgData.filename.replace(/\.svg$/, "")}-hitboxes.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svgData, hitboxes]);

  const handleImportJSON = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        if (!Array.isArray(data.hitboxes)) {
          alert("Invalid hitbox JSON: missing hitboxes array");
          return;
        }
        const migrated = data.hitboxes.map(migrateHitbox);
        if (migrated.some((h: Hitbox | null) => h === null)) {
          alert("Invalid hitbox JSON: some entries have missing or invalid fields");
          return;
        }
        if (svgData && data.svgFilename && data.svgFilename !== svgData.filename) {
          const proceed = confirm(
            `This hitbox file was created for "${data.svgFilename}" but you have "${svgData.filename}" loaded. Import anyway?`
          );
          if (!proceed) return;
        }
        setHitboxes(migrated as Hitbox[]);
        setSelectedIds([]);
      } catch {
        alert("Invalid JSON file");
      }
    };
    input.click();
  }, [svgData]);

  const handleExportTS = useCallback(() => {
    if (!svgData) return;
    const lines: string[] = [];
    lines.push("export interface HitboxBase {");
    lines.push("  id: string;");
    lines.push("  fields: Record<string, string>;");
    lines.push("}");
    lines.push("");
    lines.push("export interface RectHitbox extends HitboxBase {");
    lines.push('  shape: "rect";');
    lines.push("  x: number;");
    lines.push("  y: number;");
    lines.push("  width: number;");
    lines.push("  height: number;");
    lines.push("}");
    lines.push("");
    lines.push("export interface CircleHitbox extends HitboxBase {");
    lines.push('  shape: "circle";');
    lines.push("  cx: number;");
    lines.push("  cy: number;");
    lines.push("  r: number;");
    lines.push("}");
    lines.push("");
    lines.push("export type Hitbox = RectHitbox | CircleHitbox;\n");
    lines.push(`export const svgFilename = ${JSON.stringify(svgData.filename)};\n`);
    lines.push(`export const svgViewBox = "${svgData.viewBox.x} ${svgData.viewBox.y} ${svgData.viewBox.width} ${svgData.viewBox.height}";\n`);
    lines.push("export const hitboxes: Hitbox[] = " + JSON.stringify(hitboxes, null, 2) + ";\n");

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${svgData.filename.replace(/\.svg$/, "")}-hitboxes.ts`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svgData, hitboxes]);

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey || e.metaKey) {
        // ⌘C / Ctrl+C — copy all selected hitboxes
        if (e.key.toLowerCase() === "c") {
          const ids = selectedIdsRef.current;
          if (ids.length === 0) return;
          e.preventDefault();
          const copied = hitboxesRef.current.filter((h) => ids.includes(h.id));
          if (copied.length > 0) setClipboard(copied);
          return;
        }

        // ⌘V / Ctrl+V — paste clipboard with +20 offset
        if (e.key.toLowerCase() === "v") {
          const cb = clipboardRef.current;
          if (cb.length === 0) return;
          e.preventDefault();
          const newHitboxes: Hitbox[] = cb.map((orig) => {
            const newId = crypto.randomUUID();
            if (orig.shape === "circle") {
              return { ...orig, id: newId, cx: orig.cx + 20, cy: orig.cy + 20, fields: { ...orig.fields }, locked: false };
            }
            return { ...orig, id: newId, x: orig.x + 20, y: orig.y + 20, fields: { ...orig.fields }, locked: false };
          });
          setHitboxes((prev) => [...prev, ...newHitboxes]);
          setSelectedIds(newHitboxes.map((h) => h.id));
          return;
        }

        // ⌘D / Ctrl+D — duplicate selected
        if (e.key.toLowerCase() === "d") {
          const ids = selectedIdsRef.current;
          if (ids.length === 0) return;
          e.preventDefault();
          const toDuplicate = hitboxesRef.current.filter((h) => ids.includes(h.id));
          const newHitboxes: Hitbox[] = toDuplicate.map((orig) => {
            const newId = crypto.randomUUID();
            if (orig.shape === "circle") {
              return { ...orig, id: newId, cx: orig.cx + 20, cy: orig.cy + 20, fields: { ...orig.fields }, locked: false };
            }
            return { ...orig, id: newId, x: orig.x + 20, y: orig.y + 20, fields: { ...orig.fields }, locked: false };
          });
          setHitboxes((prev) => [...prev, ...newHitboxes]);
          setSelectedIds(newHitboxes.map((h) => h.id));
          return;
        }

        // ⌘A / Ctrl+A — select all
        if (e.key.toLowerCase() === "a") {
          e.preventDefault();
          setSelectedIds(hitboxesRef.current.map((h) => h.id));
          return;
        }

        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          e.preventDefault();
          setToolMode("select");
          break;
        case "d":
          e.preventDefault();
          setToolMode("draw");
          break;
        case "r":
          e.preventDefault();
          setDrawShape("rect");
          break;
        case "c":
          e.preventDefault();
          setDrawShape("circle");
          break;
        case "escape":
          if (toolMode === "draw") {
            setToolMode("select");
          } else {
            setSelectedIds([]);
          }
          break;
        case "delete":
        case "backspace":
          if (selectedIdsRef.current.length > 0) {
            e.preventDefault();
            handleDeleteSelected();
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toolMode, handleDeleteSelected]);

  // --- Render ---

  const selectedHitbox = selectedIds.length === 1
    ? hitboxes.find((h) => h.id === selectedIds[0]) ?? null
    : null;

  if (!svgData) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4">
        <h1 className="text-xl font-bold">Hitbox Labeller</h1>
        <p className="text-sm text-muted-foreground">Load an SVG to start drawing hitboxes</p>
        <div className="flex gap-2">
          <Button onClick={handleLoadSvg}>Load SVG</Button>
          <Button variant="outline" onClick={handleImportJSON}>Import JSON</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <HitboxSidebar
        hitboxes={hitboxes}
        selectedId={selectedIds[0] ?? null}
        svgFilename={svgData.filename}
        toolMode={toolMode}
        drawShape={drawShape}
        onSelect={handleSelect}
        onDelete={handleDeleteSingle}
        onLoadSvg={handleLoadSvg}
        onImport={handleImportJSON}
        onExportJSON={handleExportJSON}
        onExportTS={handleExportTS}
        onToolModeChange={setToolMode}
        onDrawShapeChange={setDrawShape}
      />
      <div className="flex-1 relative overflow-hidden">
        <SvgCanvas
          svgData={svgData}
          hitboxes={hitboxes}
          selectedId={selectedIds[0] ?? null}
          toolMode={toolMode}
          drawShape={drawShape}
          onHitboxDrawn={handleHitboxDrawn}
          onHitboxUpdate={handleHitboxUpdate}
          onHitboxClick={handleSelect}
          onDeselect={() => setSelectedIds([])}
        />
        {selectedHitbox && (
          <HitboxEditor
            hitbox={selectedHitbox}
            onFieldsChange={handleFieldsChange}
            onDelete={handleDeleteSingle}
            onClose={() => setSelectedIds([])}
          />
        )}
      </div>
    </div>
  );
}
