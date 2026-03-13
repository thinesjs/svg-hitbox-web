import { useState, useCallback, useEffect } from "react";
import type { SvgData, Hitbox, RectHitbox, HitboxExport, ToolMode, DrawShape } from "./types";
import SvgCanvas from "./SvgCanvas";
import HitboxSidebar from "./HitboxSidebar";
import HitboxEditor from "./HitboxEditor";
import { Button } from "@/components/ui/button";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [drawShape, setDrawShape] = useState<DrawShape>("rect");

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
      setSelectedId(null);
      setToolMode("select");
    };
    input.click();
  }, []);

  const handleHitboxDrawn = useCallback((hitbox: Hitbox) => {
    setHitboxes((prev) => [...prev, hitbox]);
    setSelectedId(hitbox.id);
    setToolMode("select");
  }, []);

  const handleHitboxUpdate = useCallback((id: string, patch: Partial<Hitbox>) => {
    setHitboxes((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch } as Hitbox : h))
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setHitboxes((prev) => prev.filter((h) => h.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const handleFieldsChange = useCallback((id: string, fields: Record<string, string>) => {
    setHitboxes((prev) => prev.map((h) => (h.id === id ? { ...h, fields } : h)));
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setToolMode("select");
  }, []);

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
        setSelectedId(null);
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
            setSelectedId(null);
          }
          break;
        case "delete":
        case "backspace":
          if (selectedId) {
            e.preventDefault();
            handleDelete(selectedId);
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toolMode, selectedId, handleDelete]);

  // --- Render ---

  const selectedHitbox = selectedId ? hitboxes.find((h) => h.id === selectedId) ?? null : null;

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
        selectedId={selectedId}
        svgFilename={svgData.filename}
        toolMode={toolMode}
        drawShape={drawShape}
        onSelect={handleSelect}
        onDelete={handleDelete}
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
          selectedId={selectedId}
          toolMode={toolMode}
          drawShape={drawShape}
          onHitboxDrawn={handleHitboxDrawn}
          onHitboxUpdate={handleHitboxUpdate}
          onHitboxClick={handleSelect}
          onDeselect={() => setSelectedId(null)}
        />
        {selectedHitbox && (
          <HitboxEditor
            hitbox={selectedHitbox}
            onFieldsChange={handleFieldsChange}
            onDelete={handleDelete}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
