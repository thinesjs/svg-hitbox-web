import { useState, useRef, useEffect, useCallback } from "react";
import type { Hitbox } from "./types";

interface HitboxEditorProps {
  hitbox: Hitbox;
  onFieldsChange: (id: string, fields: Record<string, string>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const BUILTIN_KEYS = ["mode", "route", "stop"];

export default function HitboxEditor({ hitbox, onFieldsChange, onDelete, onClose }: HitboxEditorProps) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFields({ ...hitbox.fields });
    setNewKey("");
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [hitbox.id]);

  const updateField = useCallback((key: string, value: string) => {
    setFields((prev) => {
      const updated = { ...prev, [key]: value };
      onFieldsChange(hitbox.id, updated);
      return updated;
    });
  }, [hitbox.id, onFieldsChange]);

  const removeField = useCallback((key: string) => {
    setFields((prev) => {
      const updated = { ...prev };
      delete updated[key];
      onFieldsChange(hitbox.id, updated);
      return updated;
    });
  }, [hitbox.id, onFieldsChange]);

  const addCustomField = useCallback(() => {
    const key = newKey.trim();
    if (!key) return;
    setFields((prev) => {
      if (key in prev) return prev;
      const updated = { ...prev, [key]: "" };
      onFieldsChange(hitbox.id, updated);
      return updated;
    });
    setNewKey("");
  }, [newKey, hitbox.id, onFieldsChange]);

  const customKeys = Object.keys(fields).filter((k) => !BUILTIN_KEYS.includes(k));

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        width: 480,
        maxHeight: "50vh",
        overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Edit Hitbox</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
            {hitbox.id.slice(0, 8)} · {Math.round(hitbox.x)},{Math.round(hitbox.y)} · {Math.round(hitbox.width)}x{Math.round(hitbox.height)}
          </div>
        </div>
        <button
          onClick={() => onDelete(hitbox.id)}
          style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, marginRight: 8, cursor: "pointer" }}
        >
          Delete
        </button>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}
        >
          ×
        </button>
      </div>

      {/* Built-in fields */}
      {BUILTIN_KEYS.map((key, i) => (
        <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <label style={{ width: 60, fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>{key}</label>
          <input
            ref={i === 0 ? firstInputRef : undefined}
            type="text"
            value={fields[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={key}
            style={inputStyle}
          />
        </div>
      ))}

      {/* Custom fields */}
      {customKeys.map((key) => (
        <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <label style={{ width: 60, fontSize: 12, color: "var(--text-muted)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>
            {key}
          </label>
          <input
            type="text"
            value={fields[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => removeField(key)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}
            title="Remove field"
          >
            ×
          </button>
        </div>
      ))}

      {/* Add custom field */}
      <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(); } }}
          placeholder="New field name..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={addCustomField}
          disabled={!newKey.trim()}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "transparent",
            color: "var(--text-muted)",
            opacity: newKey.trim() ? 1 : 0.4,
            cursor: "pointer",
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 10px",
  fontSize: 13,
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--text)",
  outline: "none",
};
