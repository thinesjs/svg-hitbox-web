import { useState } from "react";
import type { Hitbox } from "./types";

interface HitboxSidebarProps {
  hitboxes: Hitbox[];
  selectedId: string | null;
  svgFilename: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onLoadSvg: () => void;
  onImport: () => void;
  onExportJSON: () => void;
  onExportTS: () => void;
  drawMode: boolean;
  onToggleDrawMode: () => void;
}

export default function HitboxSidebar({
  hitboxes,
  selectedId,
  svgFilename,
  onSelect,
  onDelete,
  onLoadSvg,
  onImport,
  onExportJSON,
  onExportTS,
  drawMode,
  onToggleDrawMode,
}: HitboxSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? hitboxes.filter((hb) => {
        const q = search.toLowerCase();
        return Object.values(hb.fields).some((v) => v.toLowerCase().includes(q)) || hb.id.startsWith(q);
      })
    : hitboxes;

  return (
    <div
      style={{
        width: 280,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 16px 12px" }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
          Hitbox Labeller
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {svgFilename || "No SVG loaded"}
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 6 }}>
        <button onClick={onLoadSvg} style={toolBtn}>Load SVG</button>
        <button
          onClick={onToggleDrawMode}
          style={{
            ...toolBtn,
            background: drawMode ? "var(--accent)" : "transparent",
            color: drawMode ? "#fff" : "var(--text-muted)",
            border: drawMode ? "1px solid var(--accent)" : "1px solid var(--border)",
          }}
        >
          Draw
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "0 16px 8px" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hitboxes..."
          style={{
            width: "100%",
            padding: "5px 8px",
            fontSize: 12,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text)",
            outline: "none",
          }}
        />
      </div>

      {/* Hitbox count */}
      <div style={{ padding: "0 16px 4px", fontSize: 12, color: "var(--text-muted)" }}>
        {filtered.length}{search ? ` / ${hitboxes.length}` : ""} hitbox{hitboxes.length !== 1 ? "es" : ""}
      </div>

      {/* Hitbox list */}
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {filtered.map((hb) => {
          const label = hb.fields.stop || hb.fields.route || hb.fields.mode || hb.id.slice(0, 8);
          const isSelected = hb.id === selectedId;
          return (
            <div
              key={hb.id}
              onClick={() => onSelect(hb.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                background: isSelected ? "var(--surface-hover)" : "transparent",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)", flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                {Math.round(hb.width)}x{Math.round(hb.height)}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(hb.id); }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, padding: "2px 4px", flexShrink: 0 }}
                title="Delete hitbox"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Keyboard hints */}
      <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
        <div><kbd style={kbdStyle}>D</kbd> Toggle draw mode</div>
        <div><kbd style={kbdStyle}>Delete</kbd> Remove selected</div>
        <div><kbd style={kbdStyle}>Esc</kbd> Deselect</div>
        <div><kbd style={kbdStyle}>Scroll</kbd> Zoom</div>
      </div>

      {/* Import/Export */}
      <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={onImport} style={btnSecondary}>Import (.json)</button>
        <button onClick={onExportJSON} style={btnSecondary}>Save (.json)</button>
        <button onClick={onExportTS} style={btnPrimary}>Export (.ts)</button>
      </div>
    </div>
  );
}

const toolBtn: React.CSSProperties = {
  flex: 1,
  padding: "5px 8px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "transparent",
  color: "var(--text-muted)",
};

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 5px",
  fontSize: 10,
  background: "var(--border)",
  borderRadius: 3,
  fontFamily: "monospace",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  border: "none",
  borderRadius: 6,
  background: "var(--accent)",
  color: "#fff",
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "transparent",
  color: "var(--text-muted)",
};
