import { useState, useEffect, useCallback } from "react";
import type { Hitbox } from "./types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const BUILTIN_KEYS = ["mode", "feed", "route", "stop", "name"];

interface BulkFieldEditorProps {
  hitboxes: Hitbox[];
  selectedIds: string[];
  onBulkFieldChange: (ids: string[], key: string, value: string) => void;
  onClose: () => void;
}

function getCommonValue(hitboxes: Hitbox[], selectedIds: string[], key: string): string | null {
  const selected = hitboxes.filter((h) => selectedIds.includes(h.id));
  if (selected.length === 0) return null;
  const first = selected[0].fields[key] ?? "";
  const allSame = selected.every((h) => (h.fields[key] ?? "") === first);
  return allSame ? first : null;
}

export default function BulkFieldEditor({
  hitboxes,
  selectedIds,
  onBulkFieldChange,
  onClose,
}: BulkFieldEditorProps) {
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});

  // Reset edited fields when selection changes
  useEffect(() => {
    setEditedFields({});
  }, [selectedIds]);

  const handleChange = useCallback(
    (key: string, value: string) => {
      setEditedFields((prev) => ({ ...prev, [key]: value }));
      onBulkFieldChange(selectedIds, key, value);
    },
    [selectedIds, onBulkFieldChange],
  );

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-popover border border-border rounded-xl p-4 w-[480px] shadow-xl">
      {/* Header */}
      <div className="flex items-center mb-3">
        <div className="flex-1">
          <div className="text-sm font-semibold">Edit {selectedIds.length} hitboxes</div>
        </div>
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

      {/* Built-in fields only */}
      {BUILTIN_KEYS.map((key) => {
        const common = getCommonValue(hitboxes, selectedIds, key);
        const isEdited = key in editedFields;
        const displayValue = isEdited ? editedFields[key] : (common ?? "");
        const placeholder = common === null && !isEdited ? "Mixed" : key;

        return (
          <div key={key} className="flex gap-2 mb-2 items-center">
            <Label className="w-14 text-right text-xs text-muted-foreground shrink-0">{key}</Label>
            <Input
              type="text"
              value={displayValue}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className="h-8 text-sm"
            />
          </div>
        );
      })}
    </div>
  );
}
