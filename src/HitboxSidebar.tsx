import { useState, useMemo } from "react";
import type { Hitbox, ToolMode, DrawShape } from "./types";
import { hitboxBounds, hitboxLabel } from "./hitboxGeometry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HitboxSidebarProps {
  hitboxes: Hitbox[];
  selectedIds: string[];
  svgFilename: string | null;
  toolMode: ToolMode;
  drawShape: DrawShape;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onLoadSvg: () => void;
  onImport: () => void;
  onExportJSON: () => void;
  onExportTS: () => void;
  onToolModeChange: (mode: ToolMode) => void;
  onDrawShapeChange: (shape: DrawShape) => void;
}

export default function HitboxSidebar({
  hitboxes,
  selectedIds,
  svgFilename,
  toolMode,
  drawShape,
  onSelect,
  onToggleSelect,
  onDelete,
  onLoadSvg,
  onImport,
  onExportJSON,
  onExportTS,
  onToolModeChange,
  onDrawShapeChange,
}: HitboxSidebarProps) {
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = search
    ? hitboxes.filter((hb) => {
        const q = search.toLowerCase();
        return Object.values(hb.fields).some((v) => v.toLowerCase().includes(q)) || hb.id.startsWith(q);
      })
    : hitboxes;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-[280px] bg-sidebar border-r border-border flex flex-col overflow-hidden shrink-0">
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-base font-bold tracking-tight mb-1">SvgHitbox</h1>
          <p className="text-xs text-muted-foreground">{svgFilename || "No SVG loaded"}</p>
        </div>

        {/* Tool mode toggle */}
        <div className="px-4 pb-2">
          <ToggleGroup
            type="single"
            value={toolMode}
            onValueChange={(v) => { if (v) onToolModeChange(v as ToolMode); }}
            className="w-full"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="select" className="flex-1 text-xs gap-1">
                  Select <Kbd>V</Kbd>
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Select, move, and resize hitboxes</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="draw" className="flex-1 text-xs gap-1">
                  Draw <Kbd>D</Kbd>
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Draw new hitboxes on the canvas</TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </div>

        {/* Shape selector (only visible in draw mode) */}
        {toolMode === "draw" && (
          <div className="px-4 pb-2">
            <ToggleGroup
              type="single"
              value={drawShape}
              onValueChange={(v) => { if (v) onDrawShapeChange(v as DrawShape); }}
              className="w-full"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="rect" className="flex-1 text-xs gap-1">
                    ▭ Rect <Kbd>R</Kbd>
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Draw rectangles</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="circle" className="flex-1 text-xs gap-1">
                    ○ Circle <Kbd>C</Kbd>
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Draw circles</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </div>
        )}

        <Separator />

        {/* Toolbar */}
        <div className="px-4 py-2">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={onLoadSvg}>
            Load SVG
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hitboxes..."
            className="h-8 text-xs"
          />
        </div>

        {/* Count */}
        <div className="px-4 pb-1 text-xs text-muted-foreground">
          {filtered.length}{search ? ` / ${hitboxes.length}` : ""} hitbox{hitboxes.length !== 1 ? "es" : ""}
          {selectedIds.length > 1 && ` · ${selectedIds.length} selected`}
        </div>

        {/* Hitbox list */}
        <ScrollArea className="flex-1">
          <div className="py-1">
            {filtered.map((hb) => {
              const label = hitboxLabel(hb);
              const isSelected = selectedSet.has(hb.id);
              const bounds = hitboxBounds(hb);
              return (
                <div
                  key={hb.id}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      onToggleSelect(hb.id);
                    } else {
                      onSelect(hb.id);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer text-sm hover:bg-accent/10 ${
                    isSelected ? "bg-accent/20" : ""
                  }`}
                >
                  <span className={`w-2 h-2 rounded-sm shrink-0 ${
                    hb.shape === "circle" ? "rounded-full" : ""
                  } bg-primary`} />
                  {hb.locked && <span className="text-[10px]" role="img" aria-label="Locked">🔒</span>}
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {label}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {Math.round(bounds.width)}×{Math.round(bounds.height)}
                  </span>
                  {!hb.locked && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(hb.id); }}
                      className="text-muted-foreground hover:text-destructive text-sm px-1 shrink-0"
                      title="Delete hitbox"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />

        {/* Keyboard hints */}
        <div className="px-4 py-2 flex flex-col gap-1.5 text-[11px] text-muted-foreground">
          <div className="flex gap-2"><span><Kbd>V</Kbd> Select</span> <span><Kbd>D</Kbd> Draw</span></div>
          <div className="flex gap-2"><span><Kbd>R</Kbd> Rect</span> <span><Kbd>C</Kbd> Circle</span></div>
          <div className="flex gap-2"><span><Kbd>Del</Kbd> Remove</span> <span><Kbd>Esc</Kbd> Deselect</span></div>
          <div className="flex gap-2"><span><Kbd>⌘C</Kbd> Copy</span> <span><Kbd>⌘V</Kbd> Paste</span></div>
          <div className="flex gap-2"><span><Kbd>⌘D</Kbd> Duplicate</span> <span><Kbd>⌘A</Kbd> Select All</span></div>
          <div><Kbd>Space</Kbd>+Drag Pan  <Kbd>Alt</Kbd>+Drag Duplicate</div>
        </div>

        {/* Import/Export */}
        <div className="p-3 border-t border-border flex flex-col gap-1.5">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={onImport}>
            Import (.json)
          </Button>
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={onExportJSON}>
            Save (.json)
          </Button>
          <Button size="sm" className="w-full text-xs" onClick={onExportTS}>
            Export (.ts)
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
