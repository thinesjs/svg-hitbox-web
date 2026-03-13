import { useState, useCallback, useEffect } from "react";
import type { SvgData, Hitbox, HitboxExport } from "./types";
import SvgCanvas from "./SvgCanvas";
import HitboxSidebar from "./HitboxSidebar";
import HitboxEditor from "./HitboxEditor";

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

export default function App() {
  const [svgData, setSvgData] = useState<SvgData | null>(null);
  const [hitboxes, setHitboxes] = useState<Hitbox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);

  const handleLoadSvg = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svg";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setSvgData({
        filename: file.name,
        svgText: text,
        viewBox: parseSvgViewBox(text),
      });
      setHitboxes([]);
      setSelectedId(null);
      setDrawMode(false);
    };
    input.click();
  }, []);

  const handleHitboxDrawn = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const newHitbox: Hitbox = {
      id: crypto.randomUUID(),
      ...rect,
      fields: {},
    };
    setHitboxes((prev) => [...prev, newHitbox]);
    setSelectedId(newHitbox.id);
    setDrawMode(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setHitboxes((prev) => prev.filter((h) => h.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const handleFieldsChange = useCallback((id: string, fields: Record<string, string>) => {
    setHitboxes((prev) => prev.map((h) => (h.id === id ? { ...h, fields } : h)));
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
        const data = JSON.parse(text) as HitboxExport;
        if (!Array.isArray(data.hitboxes)) {
          alert("Invalid hitbox JSON: missing hitboxes array");
          return;
        }
        const valid = data.hitboxes.every(
          (h) => typeof h.id === "string" && typeof h.x === "number" && typeof h.y === "number" &&
                 typeof h.width === "number" && typeof h.height === "number" && h.fields !== null && typeof h.fields === "object"
        );
        if (!valid) {
          alert("Invalid hitbox JSON: hitbox entries have missing or invalid fields");
          return;
        }
        if (svgData && data.svgFilename && data.svgFilename !== svgData.filename) {
          const proceed = confirm(
            `This hitbox file was created for "${data.svgFilename}" but you have "${svgData.filename}" loaded. Import anyway?`
          );
          if (!proceed) return;
        }
        setHitboxes(data.hitboxes);
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
    lines.push("export interface Hitbox {");
    lines.push("  id: string;");
    lines.push("  x: number;");
    lines.push("  y: number;");
    lines.push("  width: number;");
    lines.push("  height: number;");
    lines.push("  fields: Record<string, string>;");
    lines.push("}\n");
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

      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        setDrawMode((v) => !v);
      } else if (e.key === "Escape") {
        if (drawMode) {
          setDrawMode(false);
        } else {
          setSelectedId(null);
        }
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        handleDelete(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawMode, selectedId, handleDelete]);

  // --- Render ---

  const selectedHitbox = selectedId ? hitboxes.find((h) => h.id === selectedId) ?? null : null;

  if (!svgData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Hitbox Labeller</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Load an SVG to start drawing hitboxes</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleLoadSvg} style={loadBtnStyle}>Load SVG</button>
          <button onClick={handleImportJSON} style={{ ...loadBtnStyle, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            Import JSON
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <HitboxSidebar
        hitboxes={hitboxes}
        selectedId={selectedId}
        svgFilename={svgData.filename}
        onSelect={setSelectedId}
        onDelete={handleDelete}
        onLoadSvg={handleLoadSvg}
        onImport={handleImportJSON}
        onExportJSON={handleExportJSON}
        onExportTS={handleExportTS}
        drawMode={drawMode}
        onToggleDrawMode={() => setDrawMode((v) => !v)}
      />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <SvgCanvas
          svgData={svgData}
          hitboxes={hitboxes}
          selectedId={selectedId}
          drawMode={drawMode}
          onHitboxDrawn={handleHitboxDrawn}
          onHitboxClick={setSelectedId}
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

const loadBtnStyle: React.CSSProperties = {
  padding: "10px 24px",
  fontSize: 14,
  fontWeight: 600,
  border: "none",
  borderRadius: 8,
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
};
