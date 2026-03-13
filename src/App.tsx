import { useState, useCallback } from "react";
import type { SvgData, Hitbox } from "./types";
import SvgCanvas from "./SvgCanvas";

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

  if (!svgData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Hitbox Labeller</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Load an SVG to start drawing hitboxes</p>
        <button onClick={handleLoadSvg} style={loadBtnStyle}>Load SVG</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar will be added in Task 3 */}
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
        {/* Temporary draw mode toggle until sidebar exists */}
        <button
          onClick={() => setDrawMode((v) => !v)}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 10,
            padding: "6px 12px",
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: drawMode ? "var(--accent)" : "var(--surface)",
            color: drawMode ? "#fff" : "var(--text-muted)",
          }}
        >
          {drawMode ? "Drawing..." : "Draw"}
        </button>
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
