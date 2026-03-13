import { useRef, useState, useCallback, useEffect } from "react";
import type { SvgData, Hitbox } from "./types";

interface SvgCanvasProps {
  svgData: SvgData;
  hitboxes: Hitbox[];
  selectedId: string | null;
  drawMode: boolean;
  onHitboxDrawn: (rect: { x: number; y: number; width: number; height: number }) => void;
  onHitboxClick: (id: string) => void;
  onDeselect: () => void;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export default function SvgCanvas({
  svgData,
  hitboxes,
  selectedId,
  drawMode,
  onHitboxDrawn,
  onHitboxClick,
  onDeselect,
}: SvgCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Drawing state
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const drawStartRef = useRef<{ svgX: number; svgY: number } | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const { width: svgW, height: svgH } = svgData.viewBox;

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

  // Pointer down: start pan or draw
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (drawMode && e.button === 0) {
      // Start drawing
      const svgPt = screenToSvg(e.clientX, e.clientY);
      drawStartRef.current = { svgX: svgPt.x, svgY: svgPt.y };
      setDrawRect({ x: svgPt.x, y: svgPt.y, width: 0, height: 0 });
    } else {
      // Start panning
      setIsPanning(true);
      const t = transformRef.current;
      panStart.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
    }
  }, [drawMode, screenToSvg]);

  // Pointer move: pan or update draw preview
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (drawStartRef.current) {
      const svgPt = screenToSvg(e.clientX, e.clientY);
      const start = drawStartRef.current;
      const x = Math.min(start.svgX, svgPt.x);
      const y = Math.min(start.svgY, svgPt.y);
      const width = Math.abs(svgPt.x - start.svgX);
      const height = Math.abs(svgPt.y - start.svgY);
      setDrawRect({ x, y, width, height });
      return;
    }
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTransform((t) => ({ ...t, x: panStart.current.tx + dx, y: panStart.current.ty + dy }));
  }, [isPanning, screenToSvg]);

  // Pointer up: finish pan or finish draw
  const handlePointerUp = useCallback(() => {
    if (drawStartRef.current && drawRect) {
      // Minimum 5 SVG units each side to count as a hitbox
      if (drawRect.width > 5 && drawRect.height > 5) {
        onHitboxDrawn({ x: drawRect.x, y: drawRect.y, width: drawRect.width, height: drawRect.height });
      }
      drawStartRef.current = null;
      setDrawRect(null);
      return;
    }
    setIsPanning(false);
  }, [drawRect, onHitboxDrawn]);

  // Click on background to deselect (only fires if pointer didn't move much)
  const handleBackgroundClick = useCallback(() => {
    if (!drawMode && selectedId) {
      onDeselect();
    }
  }, [drawMode, selectedId, onDeselect]);

  const cursor = drawMode ? "crosshair" : isPanning ? "grabbing" : "grab";

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleBackgroundClick}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor,
        background: "#0e1117",
        position: "relative",
      }}
    >
      {/* Zoom indicator */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", gap: 4, alignItems: "center" }}>
        <button onClick={() => setTransform((t) => {
          const newScale = Math.min(t.scale * 1.3, 20);
          const ratio = newScale / t.scale;
          const cx = containerSize.w / 2, cy = containerSize.h / 2;
          return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
        })} style={zoomBtnStyle}>+</button>
        <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 40, textAlign: "center", fontFamily: "monospace" }}>
          {Math.round(transform.scale * 100)}%
        </span>
        <button onClick={() => setTransform((t) => {
          const newScale = Math.max(t.scale / 1.3, 0.1);
          const ratio = newScale / t.scale;
          const cx = containerSize.w / 2, cy = containerSize.h / 2;
          return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
        })} style={zoomBtnStyle}>−</button>
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
        viewBox={`${svgData.viewBox.x} ${svgData.viewBox.y} ${svgW} ${svgH}`}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      >
        <g style={{ pointerEvents: "auto" }}>
          {/* Existing hitboxes */}
          {hitboxes.map((hb) => {
            const isSelected = hb.id === selectedId;
            const label = hb.fields.stop || hb.fields.route || hb.fields.mode || "";
            return (
              <g key={hb.id}>
                <rect
                  x={hb.x}
                  y={hb.y}
                  width={hb.width}
                  height={hb.height}
                  fill={isSelected ? "rgba(88, 166, 255, 0.25)" : "rgba(88, 166, 255, 0.12)"}
                  stroke={isSelected ? "#58a6ff" : "#58a6ff80"}
                  strokeWidth={isSelected ? 2 / transform.scale : 1 / transform.scale}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHitboxClick(hb.id);
                  }}
                />
                {label && transform.scale > 0.5 && (
                  <text
                    x={hb.x + hb.width / 2}
                    y={hb.y + hb.height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10 / transform.scale}
                    fill="#58a6ff"
                    style={{ pointerEvents: "none", fontWeight: 600 }}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Draw-in-progress rectangle */}
          {drawRect && drawRect.width > 0 && drawRect.height > 0 && (
            <rect
              x={drawRect.x}
              y={drawRect.y}
              width={drawRect.width}
              height={drawRect.height}
              fill="rgba(88, 166, 255, 0.15)"
              stroke="#58a6ff"
              strokeWidth={1.5 / transform.scale}
              strokeDasharray={`${4 / transform.scale} ${3 / transform.scale}`}
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      </svg>

      {/* Draw mode indicator */}
      {drawMode && (
        <div style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          background: "var(--accent)",
          color: "#fff",
          padding: "4px 12px",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
        }}>
          Draw Mode — drag to create hitbox
        </div>
      )}
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};
