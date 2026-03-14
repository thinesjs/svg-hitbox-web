import { useState, useRef, useEffect, useCallback } from "react";
import type { Hitbox } from "./types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface HitboxEditorProps {
  hitbox: Hitbox;
  onFieldsChange: (id: string, fields: Record<string, string>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const BUILTIN_KEYS = ["mode", "feed", "route", "stop", "name"];

export default function HitboxEditor({
  hitbox,
  onFieldsChange,
  onDelete,
  onClose,
}: HitboxEditorProps) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFields({ ...hitbox.fields });
    setNewKey("");
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [hitbox.id]);

  const updateField = useCallback(
    (key: string, value: string) => {
      setFields((prev) => {
        const updated = { ...prev, [key]: value };
        onFieldsChange(hitbox.id, updated);
        return updated;
      });
    },
    [hitbox.id, onFieldsChange],
  );

  const removeField = useCallback(
    (key: string) => {
      setFields((prev) => {
        const updated = { ...prev };
        delete updated[key];
        onFieldsChange(hitbox.id, updated);
        return updated;
      });
    },
    [hitbox.id, onFieldsChange],
  );

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

  // Shape-specific coordinate display
  const coordDisplay =
    hitbox.shape === "circle"
      ? `cx:${Math.round(hitbox.cx)} cy:${Math.round(hitbox.cy)} r:${Math.round(hitbox.r)}`
      : `${Math.round(hitbox.x)},${Math.round(hitbox.y)} ${Math.round(hitbox.width)}×${Math.round(hitbox.height)}`;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-popover border border-border rounded-xl p-4 w-[480px] max-h-[50vh] overflow-y-auto shadow-xl">
      {/* Header */}
      <div className="flex items-center mb-3">
        <div className="flex-1">
          <div className="text-sm font-semibold">Edit Hitbox</div>
          <div className="text-xs text-muted-foreground font-mono">
            <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium mr-1.5">
              {hitbox.shape}
            </span>
            {hitbox.id.slice(0, 8)} · {coordDisplay}
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="mr-2 h-7 text-xs"
          onClick={() => onDelete(hitbox.id)}
          disabled={!!hitbox.locked}
        >
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground"
          onClick={onClose}
        >
          ×
        </Button>
      </div>

      <Separator className="mb-3" />

      {/* Built-in fields */}
      {BUILTIN_KEYS.map((key, i) => (
        <div key={key} className="flex gap-2 mb-2 items-center">
          <Label className="w-14 text-right text-xs text-muted-foreground shrink-0">{key}</Label>
          <Input
            ref={i === 0 ? firstInputRef : undefined}
            type="text"
            value={fields[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={key}
            className="h-8 text-sm"
          />
        </div>
      ))}

      {/* Custom fields */}
      {customKeys.map((key) => (
        <div key={key} className="flex gap-2 mb-2 items-center">
          <Label className="w-14 text-right text-xs text-muted-foreground shrink-0 overflow-hidden text-ellipsis">
            {key}
          </Label>
          <Input
            type="text"
            value={fields[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground shrink-0"
            onClick={() => removeField(key)}
            title="Remove field"
          >
            ×
          </Button>
        </div>
      ))}

      {/* Add custom field */}
      <div className="flex gap-2 mt-1 items-center">
        <Input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomField();
            }
          }}
          placeholder="New field name..."
          className="h-8 text-sm flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={addCustomField}
          disabled={!newKey.trim()}
        >
          + Add
        </Button>
      </div>
    </div>
  );
}
