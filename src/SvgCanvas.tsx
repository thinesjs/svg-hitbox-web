import { useRef, useState, useCallback, useEffect } from "react";
import type { SvgData } from "./types";

interface SvgCanvasProps {
  svgData: SvgData;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export default function SvgCanvas({ svgData }: SvgCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

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

  // Pan
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [transform]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTransform((t) => ({ ...t, x: panStart.current.tx + dx, y: panStart.current.ty + dy }));
  }, [isPanning]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: isPanning ? "grabbing" : "grab",
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

      {/* SVG layer */}
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
