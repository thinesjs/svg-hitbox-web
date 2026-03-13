import { useRef, useState, useCallback, useEffect } from "react";
import type { SvgData, Hitbox, RectHitbox, CircleHitbox, ToolMode, DrawShape, HandleInfo } from "./types";
import { Button } from "@/components/ui/button";
import {
  hitboxBounds,
  pointInHitbox,
  getHitboxAtPoint,
  getHandlePositions,
  getHandleAtPoint,
  resizeRect,
  resizeCircle,
  moveHitbox,
  hitboxLabel,
} from "./hitboxGeometry";

interface SvgCanvasProps {
  svgData: SvgData;
  hitboxes: Hitbox[];
  selectedId: string | null;
  toolMode: ToolMode;
  drawShape: DrawShape;
  onHitboxDrawn: (hitbox: Hitbox) => void;
  onHitboxUpdate: (id: string, patch: Partial<Hitbox>) => void;
  onHitboxClick: (id: string) => void;
  onDeselect: () => void;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

type InteractionState =
  | { type: "idle" }
  | { type: "panning"; startX: number; startY: number; startTx: number; startTy: number }
  | { type: "drawing"; startSvg: { x: number; y: number } }
  | { type: "moving"; hitboxId: string; startSvg: { x: number; y: number }; original: Hitbox }
  | { type: "resizing"; hitboxId: string; handle: HandleInfo; startSvg: { x: number; y: number }; original: Hitbox };

export default function SvgCanvas({
  svgData,
  hitboxes,
  selectedId,
  toolMode,
  drawShape,
  onHitboxDrawn,
  onHitboxUpdate,
  onHitboxClick,
  onDeselect,
}: SvgCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [cursor, setCursor] = useState("grab");

  // Draw preview state
  const [drawPreview, setDrawPreview] = useState<{
    shape: DrawShape;
    startSvg: { x: number; y: number };
    currentSvg: { x: number; y: number };
  } | null>(null);

  // Interaction state (ref to avoid stale closures in pointer handlers)
  const interactionRef = useRef<InteractionState>({ type: "idle" });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const { viewBox } = svgData;
  const { width: svgW, height: svgH } = viewBox;

  const selectedHitbox = selectedId ? hitboxes.find((h) => h.id === selectedId) ?? null : null;

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
  }, [svgData]);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fit to container on load
  useEffect(() => {
    if (containerSize.w === 0) return;
    const scaleX = containerSize.w / svgW;
    const scaleY = containerSize.h / svgH;
    const scale = Math.min(scaleX, scaleY) * 0.95;
    const x = (containerSize.w - svgW * scale) / 2;
    const y = (containerSize.h - svgH * scale) / 2;
    setTransform({ x, y, scale });
  }, [containerSize, svgW, svgH]);

  // Convert screen coords to SVG coords
  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const t = transformRef.current;
    return {
      x: (clientX - rect.left - t.x) / t.scale,
      y: (clientY - rect.top - t.y) / t.scale,
    };
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setTransform((t) => {
      const newScale = Math.min(Math.max(t.scale * factor, 0.1), 20);
      const ratio = newScale / t.scale;
      return { scale: newScale, x: mx - (mx - t.x) * ratio, y: my - (my - t.y) * ratio };
    });
  }, []);

  // Cancel in-progress drawing on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && interactionRef.current.type === "drawing") {
        interactionRef.current = { type: "idle" };
        setDrawPreview(null);
        setCursor("grab");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // --- Pointer handlers ---

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const svgPt = screenToSvg(e.clientX, e.clientY);

    // Draw mode: always start drawing
    if (toolMode === "draw" && e.button === 0) {
      interactionRef.current = { type: "drawing", startSvg: svgPt };
      setDrawPreview({ shape: drawShape, startSvg: svgPt, currentSvg: svgPt });
      setCursor("crosshair");
      return;
    }

    // Select mode: check handles → selected hitbox → any hitbox → canvas
    if (toolMode === "select") {
      // 1. Resize handle
      if (selectedHitbox) {
        const handle = getHandleAtPoint(svgPt.x, svgPt.y, selectedHitbox, transformRef.current.scale);
        if (handle) {
          interactionRef.current = {
            type: "resizing",
            hitboxId: selectedHitbox.id,
            handle,
            startSvg: svgPt,
            original: selectedHitbox,
          };
          setCursor(handle.cursor);
          return;
        }
      }

      // 2-3. Hitbox body (selected or unselected)
      const hitAtPoint = getHitboxAtPoint(svgPt.x, svgPt.y, hitboxes);
      if (hitAtPoint) {
        if (hitAtPoint.id !== selectedId) {
          onHitboxClick(hitAtPoint.id);
        }
        interactionRef.current = {
          type: "moving",
          hitboxId: hitAtPoint.id,
          startSvg: svgPt,
          original: hitAtPoint,
        };
        setCursor("move");
        return;
      }
    }

    // 4. Empty canvas → pan
    const t = transformRef.current;
    interactionRef.current = {
      type: "panning",
      startX: e.clientX,
      startY: e.clientY,
      startTx: t.x,
      startTy: t.y,
    };
    setCursor("grabbing");
  }, [toolMode, drawShape, selectedId, selectedHitbox, hitboxes, screenToSvg, onHitboxClick]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const state = interactionRef.current;

    if (state.type === "idle") {
      // Update cursor based on what's under pointer
      const svgPt = screenToSvg(e.clientX, e.clientY);
      if (toolMode === "draw") {
        setCursor("crosshair");
        return;
      }
      if (selectedHitbox) {
        const handle = getHandleAtPoint(svgPt.x, svgPt.y, selectedHitbox, transformRef.current.scale);
        if (handle) {
          setCursor(handle.cursor);
          return;
        }
      }
      const hitAtPoint = getHitboxAtPoint(svgPt.x, svgPt.y, hitboxes);
      if (hitAtPoint) {
        setCursor(hitAtPoint.id === selectedId ? "move" : "pointer");
        return;
      }
      setCursor("grab");
      return;
    }

    if (state.type === "panning") {
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      setTransform((t) => ({ ...t, x: state.startTx + dx, y: state.startTy + dy }));
      return;
    }

    if (state.type === "drawing") {
      const svgPt = screenToSvg(e.clientX, e.clientY);
      setDrawPreview((prev) => prev ? { ...prev, currentSvg: svgPt } : null);
      return;
    }

    if (state.type === "moving") {
      const svgPt = screenToSvg(e.clientX, e.clientY);
      const dx = svgPt.x - state.startSvg.x;
      const dy = svgPt.y - state.startSvg.y;
      const moved = moveHitbox(state.original, dx, dy, viewBox);
      if (moved.shape === "circle") {
        onHitboxUpdate(state.hitboxId, { cx: moved.cx, cy: moved.cy });
      } else {
        onHitboxUpdate(state.hitboxId, { x: moved.x, y: moved.y });
      }
      return;
    }

    if (state.type === "resizing") {
      const svgPt = screenToSvg(e.clientX, e.clientY);
      const dx = svgPt.x - state.startSvg.x;
      const dy = svgPt.y - state.startSvg.y;
      if (state.original.shape === "rect") {
        const resized = resizeRect(state.original, state.handle.position, dx, dy, viewBox);
        onHitboxUpdate(state.hitboxId, resized);
      } else {
        const resized = resizeCircle(state.original, state.handle.position, dx, dy, viewBox);
        onHitboxUpdate(state.hitboxId, resized);
      }
      return;
    }
  }, [toolMode, selectedId, selectedHitbox, hitboxes, viewBox, screenToSvg, onHitboxUpdate]);

  const handlePointerUp = useCallback(() => {
    const state = interactionRef.current;

    if (state.type === "drawing" && drawPreview) {
      const { shape, startSvg, currentSvg } = drawPreview;
      if (shape === "rect") {
        const x = Math.min(startSvg.x, currentSvg.x);
        const y = Math.min(startSvg.y, currentSvg.y);
        const width = Math.abs(currentSvg.x - startSvg.x);
        const height = Math.abs(currentSvg.y - startSvg.y);
        if (width > 5 && height > 5) {
          onHitboxDrawn({
            shape: "rect",
            id: crypto.randomUUID(),
            x, y, width, height,
            fields: {},
          });
        }
      } else {
        const dx = currentSvg.x - startSvg.x;
        const dy = currentSvg.y - startSvg.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > 5) {
          onHitboxDrawn({
            shape: "circle",
            id: crypto.randomUUID(),
            cx: startSvg.x,
            cy: startSvg.y,
            r,
            fields: {},
          });
        }
      }
      setDrawPreview(null);
    }

    interactionRef.current = { type: "idle" };
    setCursor(toolMode === "draw" ? "crosshair" : "grab");
  }, [drawPreview, toolMode, onHitboxDrawn]);

  // Click handler for deselect (only fires on click, not drag)
  const clickStart = useRef<{ x: number; y: number } | null>(null);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    clickStart.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!clickStart.current) return;
    const dx = e.clientX - clickStart.current.x;
    const dy = e.clientY - clickStart.current.y;
    clickStart.current = null;
    // Only treat as click if pointer barely moved (< 5px)
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return;

    // If click was on a hitbox, don't deselect
    const svgPt = screenToSvg(e.clientX, e.clientY);
    if (getHitboxAtPoint(svgPt.x, svgPt.y, hitboxes)) return;

    if (selectedId && toolMode === "select") {
      onDeselect();
    }
  }, [selectedId, toolMode, hitboxes, screenToSvg, onDeselect]);

  // --- Render ---

  const scale = transform.scale;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className="w-full h-full overflow-hidden relative"
      style={{ cursor, background: "#0e1117" }}
    >
      {/* Zoom indicator */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 items-center">
        <Button
          variant="outline"
          size="icon"
          className="w-7 h-7"
          onClick={() => setTransform((t) => {
            const newScale = Math.min(t.scale * 1.3, 20);
            const ratio = newScale / t.scale;
            const cx = containerSize.w / 2, cy = containerSize.h / 2;
            return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
          })}
        >+</Button>
        <span className="text-xs text-muted-foreground min-w-[40px] text-center font-mono">
          {Math.round(transform.scale * 100)}%
        </span>
        <Button
          variant="outline"
          size="icon"
          className="w-7 h-7"
          onClick={() => setTransform((t) => {
            const newScale = Math.max(t.scale / 1.3, 0.1);
            const ratio = newScale / t.scale;
            const cx = containerSize.w / 2, cy = containerSize.h / 2;
            return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
          })}
        >−</Button>
      </div>

      {/* SVG background layer */}
      <div
        ref={svgContainerRef}
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
          const isSelected = hb.id === selectedId;
          const label = hitboxLabel(hb);
          return (
            <g key={hb.id}>
              {hb.shape === "rect" ? (
                <rect
                  x={hb.x} y={hb.y} width={hb.width} height={hb.height}
                  fill={isSelected ? "rgba(88, 166, 255, 0.25)" : "rgba(88, 166, 255, 0.12)"}
                  stroke={isSelected ? "#58a6ff" : "#58a6ff80"}
                  strokeWidth={isSelected ? 2 / scale : 1 / scale}
                />
              ) : (
                <circle
                  cx={hb.cx} cy={hb.cy} r={hb.r}
                  fill={isSelected ? "rgba(88, 166, 255, 0.25)" : "rgba(88, 166, 255, 0.12)"}
                  stroke={isSelected ? "#58a6ff" : "#58a6ff80"}
                  strokeWidth={isSelected ? 2 / scale : 1 / scale}
                />
              )}
              {label && scale > 0.5 && (() => {
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

        {/* Resize handles for selected hitbox */}
        {selectedHitbox && toolMode === "select" && (
          <g>
            {getHandlePositions(selectedHitbox).map((handle) => {
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

        {/* Draw preview */}
        {drawPreview && (() => {
          const { shape, startSvg, currentSvg } = drawPreview;
          if (shape === "rect") {
            const x = Math.min(startSvg.x, currentSvg.x);
            const y = Math.min(startSvg.y, currentSvg.y);
            const w = Math.abs(currentSvg.x - startSvg.x);
            const h = Math.abs(currentSvg.y - startSvg.y);
            if (w < 1 && h < 1) return null;
            return (
              <rect
                x={x} y={y} width={w} height={h}
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
                cx={startSvg.x} cy={startSvg.y} r={r}
                fill="rgba(88, 166, 255, 0.15)"
                stroke="#58a6ff"
                strokeWidth={1.5 / scale}
                strokeDasharray={`${4 / scale} ${3 / scale}`}
              />
            );
          }
        })()}
      </svg>

      {/* Mode indicator */}
      {toolMode === "draw" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-semibold">
          Draw {drawShape === "rect" ? "Rectangle" : "Circle"} — drag to create
        </div>
      )}
    </div>
  );
}
