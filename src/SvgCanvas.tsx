import { useEffect, useMemo } from "react";
import type { SvgData, Hitbox, ToolMode, DrawShape } from "./types";
import { Button } from "@/components/ui/button";
import { hitboxBounds, getHandlePositions, hitboxLabel, selectionBounds } from "./hitboxGeometry";
import { useCanvasInteractions } from "./useCanvasInteractions";

interface SvgCanvasProps {
  svgData: SvgData;
  hitboxes: Hitbox[];
  selectedIds: string[];
  toolMode: ToolMode;
  drawShape: DrawShape;
  onHitboxDrawn: (hitbox: Hitbox) => void;
  onHitboxUpdate: (id: string, patch: Partial<Hitbox>) => void;
  onHitboxMultiUpdate: (patches: Array<{ id: string; patch: Partial<Hitbox> }>) => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSetSelection: (ids: string[]) => void;
  onDeselect: () => void;
  onBeginBatch: () => void;
  onCommitBatch: () => void;
  screenToSvgRef?: React.MutableRefObject<
    ((cx: number, cy: number) => { x: number; y: number }) | null
  >;
}

export default function SvgCanvas({
  svgData,
  hitboxes,
  selectedIds,
  toolMode,
  drawShape,
  onHitboxDrawn,
  onHitboxUpdate,
  onHitboxMultiUpdate,
  onSelect,
  onToggleSelect,
  onSetSelection,
  onDeselect,
  onBeginBatch,
  onCommitBatch,
  screenToSvgRef,
}: SvgCanvasProps) {
  const {
    containerRef,
    svgContainerRef,
    transform,
    cursor,
    drawPreview,
    marqueeRect,
    containerSize,
    screenToSvg,
    handlers,
    setTransform,
  } = useCanvasInteractions({
    svgData,
    hitboxes,
    selectedIds,
    toolMode,
    drawShape,
    onHitboxDrawn,
    onHitboxUpdate,
    onHitboxMultiUpdate,
    onSelect,
    onToggleSelect,
    onSetSelection,
    onDeselect,
    onBeginBatch,
    onCommitBatch,
  });

  const { viewBox } = svgData;
  const { width: svgW, height: svgH } = viewBox;
  const scale = transform.scale;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Expose screenToSvg to parent via ref (for context menu, Task 5)
  useEffect(() => {
    if (screenToSvgRef) screenToSvgRef.current = screenToSvg;
  }, [screenToSvg, screenToSvgRef]);

  // Inject SVG inline
  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    el.innerHTML = svgData.svgText;
    const svg = el.querySelector("svg");
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.position = "absolute";
      svg.style.top = "0";
      svg.style.left = "0";
    }
  }, [svgData, svgContainerRef]);

  // Derived state
  const singleSelectedHitbox =
    selectedIds.length === 1 ? (hitboxes.find((h) => h.id === selectedIds[0]) ?? null) : null;

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      onWheel={handlers.onWheel}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      className="w-full h-full overflow-hidden relative select-none"
      style={{ cursor, background: "#0e1117" }}
    >
      {/* Zoom indicator */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 items-center">
        <Button
          variant="outline"
          size="icon"
          className="w-7 h-7"
          onClick={() =>
            setTransform((t) => {
              const newScale = Math.min(t.scale * 1.3, 20);
              const ratio = newScale / t.scale;
              const cx = containerSize.w / 2,
                cy = containerSize.h / 2;
              return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
            })
          }
        >
          +
        </Button>
        <span className="text-xs text-muted-foreground min-w-[40px] text-center font-mono">
          {Math.round(transform.scale * 100)}%
        </span>
        <Button
          variant="outline"
          size="icon"
          className="w-7 h-7"
          onClick={() =>
            setTransform((t) => {
              const newScale = Math.max(t.scale / 1.3, 0.1);
              const ratio = newScale / t.scale;
              const cx = containerSize.w / 2,
                cy = containerSize.h / 2;
              return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
            })
          }
        >
          −
        </Button>
      </div>

      {/* SVG background layer */}
      <div
        ref={svgContainerRef as React.RefObject<HTMLDivElement>}
        style={{
          width: svgW,
          height: svgH,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          background: "#ffffff",
        }}
      />

      {/* Hitbox overlay SVG */}
      <svg
        width={svgW}
        height={svgH}
        viewBox={`${viewBox.x} ${viewBox.y} ${svgW} ${svgH}`}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      >
        {/* Hitbox shapes */}
        {hitboxes.map((hb) => {
          const isSelected = selectedSet.has(hb.id);
          const label = hitboxLabel(hb);
          return (
            <g key={hb.id}>
              {hb.shape === "rect" ? (
                <rect
                  x={hb.x}
                  y={hb.y}
                  width={hb.width}
                  height={hb.height}
                  fill={isSelected ? "rgba(88, 166, 255, 0.25)" : "rgba(88, 166, 255, 0.12)"}
                  stroke={isSelected ? "#58a6ff" : "#58a6ff80"}
                  strokeWidth={isSelected ? 2 / scale : 1 / scale}
                />
              ) : (
                <circle
                  cx={hb.cx}
                  cy={hb.cy}
                  r={hb.r}
                  fill={isSelected ? "rgba(88, 166, 255, 0.25)" : "rgba(88, 166, 255, 0.12)"}
                  stroke={isSelected ? "#58a6ff" : "#58a6ff80"}
                  strokeWidth={isSelected ? 2 / scale : 1 / scale}
                />
              )}
              {label &&
                scale > 0.5 &&
                (() => {
                  const bounds = hitboxBounds(hb);
                  return (
                    <text
                      x={bounds.x + bounds.width / 2}
                      y={bounds.y + bounds.height / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10 / scale}
                      fill="#58a6ff"
                      style={{ pointerEvents: "none", fontWeight: 600 }}
                    >
                      {label}
                    </text>
                  );
                })()}
            </g>
          );
        })}

        {/* Resize handles for single selected hitbox (not locked) */}
        {selectedIds.length === 1 &&
          singleSelectedHitbox &&
          !singleSelectedHitbox.locked &&
          toolMode === "select" && (
            <g>
              {getHandlePositions(singleSelectedHitbox).map((handle) => {
                const handleSize = 10 / scale;
                return (
                  <rect
                    key={handle.position}
                    x={handle.svgX - handleSize / 2}
                    y={handle.svgY - handleSize / 2}
                    width={handleSize}
                    height={handleSize}
                    fill="white"
                    stroke="#3b82f6"
                    strokeWidth={2 / scale}
                  />
                );
              })}
            </g>
          )}

        {/* Group bounding box for multi-selection */}
        {selectedIds.length > 1 &&
          (() => {
            const bounds = selectionBounds(hitboxes, selectedIds);
            if (bounds.width === 0 && bounds.height === 0) return null;
            return (
              <rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                fill="none"
                stroke="#58a6ff"
                strokeWidth={1 / scale}
                strokeDasharray={`${4 / scale} ${3 / scale}`}
              />
            );
          })()}

        {/* Lock icon for locked hitboxes */}
        {hitboxes
          .filter((h) => h.locked)
          .map((hb) => {
            const b = hitboxBounds(hb);
            const iconSize = 12 / scale;
            const ix = b.x + b.width - iconSize * 0.2;
            const iy = b.y - iconSize * 0.8;
            return (
              <g
                key={`lock-${hb.id}`}
                transform={`translate(${ix}, ${iy}) scale(${iconSize / 16})`}
              >
                <path
                  d="M6 8V6a4 4 0 1 1 8 0v2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1z"
                  fill="#58a6ff"
                />
                <path d="M8 6v2h4V6a2 2 0 1 0-4 0z" fill="#1a1a2e" />
              </g>
            );
          })}

        {/* Draw preview */}
        {drawPreview &&
          (() => {
            const { shape, startSvg, currentSvg } = drawPreview;
            if (shape === "rect") {
              const x = Math.min(startSvg.x, currentSvg.x);
              const y = Math.min(startSvg.y, currentSvg.y);
              const w = Math.abs(currentSvg.x - startSvg.x);
              const h = Math.abs(currentSvg.y - startSvg.y);
              if (w < 1 && h < 1) return null;
              return (
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(88, 166, 255, 0.15)"
                  stroke="#58a6ff"
                  strokeWidth={1.5 / scale}
                  strokeDasharray={`${4 / scale} ${3 / scale}`}
                />
              );
            } else {
              const dx = currentSvg.x - startSvg.x;
              const dy = currentSvg.y - startSvg.y;
              const r = Math.sqrt(dx * dx + dy * dy);
              if (r < 1) return null;
              return (
                <circle
                  cx={startSvg.x}
                  cy={startSvg.y}
                  r={r}
                  fill="rgba(88, 166, 255, 0.15)"
                  stroke="#58a6ff"
                  strokeWidth={1.5 / scale}
                  strokeDasharray={`${4 / scale} ${3 / scale}`}
                />
              );
            }
          })()}
      </svg>

      {/* Marquee selection rectangle */}
      {marqueeRect && (
        <div
          style={{
            position: "absolute",
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.width,
            height: marqueeRect.height,
            border: "1px dashed #58a6ff",
            background: "rgba(88, 166, 255, 0.08)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        />
      )}

      {/* Mode indicator */}
      {toolMode === "draw" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-semibold">
          Draw {drawShape === "rect" ? "Rectangle" : "Circle"} — drag to create
        </div>
      )}
    </div>
  );
}
