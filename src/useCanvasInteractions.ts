import { useRef, useState, useCallback, useEffect } from "react";
import type { SvgData, Hitbox, ToolMode, DrawShape, HandleInfo, BBox } from "./types";
import {
  getHitboxAtPoint,
  getHandleAtPoint,
  resizeRect,
  resizeCircle,
  moveHitbox,
  hitboxesInMarquee,
} from "./hitboxGeometry";

// --- Types ---

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface DrawPreview {
  shape: DrawShape;
  startSvg: { x: number; y: number };
  currentSvg: { x: number; y: number };
}

type InteractionState =
  | { type: "idle" }
  | { type: "panning"; startX: number; startY: number; startTx: number; startTy: number }
  | { type: "drawing"; startSvg: { x: number; y: number } }
  | {
      type: "moving";
      hitboxIds: string[];
      startSvg: { x: number; y: number };
      originals: Map<string, Hitbox>;
      shiftHeld: boolean;
      pointerStart: { x: number; y: number };
    }
  | {
      type: "resizing";
      hitboxId: string;
      handle: HandleInfo;
      startSvg: { x: number; y: number };
      original: Hitbox;
    }
  | {
      type: "marquee";
      startScreen: { x: number; y: number };
      startSvg: { x: number; y: number };
      shiftHeld: boolean;
      prevSelectedIds: string[];
    };

interface UseCanvasInteractionsProps {
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
}

interface UseCanvasInteractionsReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  svgContainerRef: React.RefObject<HTMLDivElement | null>;
  transform: Transform;
  cursor: string;
  drawPreview: DrawPreview | null;
  marqueeRect: { x: number; y: number; width: number; height: number } | null;
  containerSize: { w: number; h: number };
  screenToSvg: (clientX: number, clientY: number) => { x: number; y: number };
  handlers: {
    onWheel: (e: React.WheelEvent) => void;
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
  };
  setTransform: React.Dispatch<React.SetStateAction<Transform>>;
}

// --- Hook ---

export function useCanvasInteractions({
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
}: UseCanvasInteractionsProps): UseCanvasInteractionsReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [cursor, setCursor] = useState("default");
  const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Refs to avoid stale closures in pointer handlers
  const drawPreviewRef = useRef(drawPreview);
  drawPreviewRef.current = drawPreview;
  const interactionRef = useRef<InteractionState>({ type: "idle" });
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const hitboxesRef = useRef(hitboxes);
  hitboxesRef.current = hitboxes;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const spaceHeldRef = useRef(false);

  const { viewBox } = svgData;
  const { width: svgW, height: svgH } = viewBox;

  // --- Observe container size ---
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

  // --- Fit to container on load ---
  useEffect(() => {
    if (containerSize.w === 0) return;
    const scaleX = containerSize.w / svgW;
    const scaleY = containerSize.h / svgH;
    const scale = Math.min(scaleX, scaleY) * 0.95;
    const x = (containerSize.w - svgW * scale) / 2;
    const y = (containerSize.h - svgH * scale) / 2;
    setTransform({ x, y, scale });
  }, [containerSize, svgW, svgH]);

  // --- Convert screen coords to SVG coords ---
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

  // --- Wheel zoom ---
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

  // --- Space key tracking ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " && !spaceHeldRef.current) {
        e.preventDefault();
        spaceHeldRef.current = true;
        if (interactionRef.current.type === "idle") setCursor("grab");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        spaceHeldRef.current = false;
        if (interactionRef.current.type === "idle") setCursor("default");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // --- Cancel in-progress drawing on Escape ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && interactionRef.current.type === "drawing") {
        interactionRef.current = { type: "idle" };
        setDrawPreview(null);
        setCursor("default");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // --- Pointer handlers ---

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Right-click is handled by shadcn ContextMenu — don't interfere
      if (e.button === 2) return;
      // Only capture left (0) and middle (1) button
      if (e.button !== 0 && e.button !== 1) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const svgPt = screenToSvg(e.clientX, e.clientY);

      // 1. Space held → pan (any button)
      if (spaceHeldRef.current) {
        const t = transformRef.current;
        interactionRef.current = {
          type: "panning",
          startX: e.clientX,
          startY: e.clientY,
          startTx: t.x,
          startTy: t.y,
        };
        setCursor("grabbing");
        return;
      }

      // 2. Middle button → pan
      if (e.button === 1) {
        const t = transformRef.current;
        interactionRef.current = {
          type: "panning",
          startX: e.clientX,
          startY: e.clientY,
          startTx: t.x,
          startTy: t.y,
        };
        setCursor("grabbing");
        return;
      }

      // 3. Draw mode → draw
      if (toolMode === "draw" && e.button === 0) {
        interactionRef.current = { type: "drawing", startSvg: svgPt };
        setDrawPreview({ shape: drawShape, startSvg: svgPt, currentSvg: svgPt });
        setCursor("crosshair");
        return;
      }

      // 4. Select mode
      if (toolMode === "select") {
        const selectedSet = new Set(selectedIdsRef.current);
        const singleSelected =
          selectedIdsRef.current.length === 1
            ? (hitboxesRef.current.find((h) => h.id === selectedIdsRef.current[0]) ?? null)
            : null;

        // 4a. Resize handle (single selection only, not locked)
        if (singleSelected && !singleSelected.locked) {
          const handle = getHandleAtPoint(
            svgPt.x,
            svgPt.y,
            singleSelected,
            transformRef.current.scale,
          );
          if (handle) {
            interactionRef.current = {
              type: "resizing",
              hitboxId: singleSelected.id,
              handle,
              startSvg: svgPt,
              original: singleSelected,
            };
            setCursor(handle.cursor);
            return;
          }
        }

        // 4b-e. Hitbox body
        const hit = getHitboxAtPoint(svgPt.x, svgPt.y, hitboxesRef.current);
        if (hit) {
          const isInSelection = selectedSet.has(hit.id);

          // 4b. Shift held → prepare for pointer-up toggle
          if (e.shiftKey) {
            const ids = isInSelection
              ? [...selectedIdsRef.current]
              : [...selectedIdsRef.current, hit.id];
            const originals = new Map(
              hitboxesRef.current.filter((h) => ids.includes(h.id)).map((h) => [h.id, h]),
            );
            interactionRef.current = {
              type: "moving",
              hitboxIds: ids,
              startSvg: svgPt,
              originals,
              shiftHeld: true,
              pointerStart: { x: e.clientX, y: e.clientY },
            };
            setCursor("move");
            return;
          }

          // 4c. Alt on hitbox → duplicate and move clones
          if (e.altKey) {
            const idsToClone = isInSelection ? [...selectedIdsRef.current] : [hit.id];
            const toClone = hitboxesRef.current.filter((h) => idsToClone.includes(h.id));
            const clones: Hitbox[] = toClone.map((h) => ({
              ...h,
              id: crypto.randomUUID(),
              locked: false,
              fields: { ...h.fields },
            }));
            clones.forEach((c) => onHitboxDrawn(c));
            onSetSelection(clones.map((c) => c.id));
            interactionRef.current = {
              type: "moving",
              hitboxIds: clones.map((c) => c.id),
              startSvg: svgPt,
              originals: new Map(clones.map((c) => [c.id, c])),
              shiftHeld: false,
              pointerStart: { x: e.clientX, y: e.clientY },
            };
            setCursor("copy");
            return;
          }

          // 4d. Hitbox in current selection → group move
          if (isInSelection) {
            const originalsList = hitboxesRef.current.filter((h) => selectedSet.has(h.id));
            const allLocked = originalsList.every((h) => h.locked);
            if (allLocked) {
              setCursor("not-allowed");
              setTimeout(() => setCursor("default"), 300);
              return;
            }
            interactionRef.current = {
              type: "moving",
              hitboxIds: [...selectedIdsRef.current],
              startSvg: svgPt,
              originals: new Map(originalsList.map((h) => [h.id, h])),
              shiftHeld: false,
              pointerStart: { x: e.clientX, y: e.clientY },
            };
            setCursor("move");
            return;
          }

          // 4e. Unselected hitbox → select it, begin move (unless locked)
          onSelect(hit.id);
          if (!hit.locked) {
            interactionRef.current = {
              type: "moving",
              hitboxIds: [hit.id],
              startSvg: svgPt,
              originals: new Map([[hit.id, hit]]),
              shiftHeld: false,
              pointerStart: { x: e.clientX, y: e.clientY },
            };
            setCursor("move");
          }
          return;
        }

        // 4f. Empty canvas → marquee
        interactionRef.current = {
          type: "marquee",
          startScreen: { x: e.clientX, y: e.clientY },
          startSvg: svgPt,
          shiftHeld: e.shiftKey,
          prevSelectedIds: e.shiftKey ? [...selectedIdsRef.current] : [],
        };
        setCursor("crosshair");
        return;
      }
    },
    [toolMode, drawShape, screenToSvg, onSelect, onSetSelection, onHitboxDrawn],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = interactionRef.current;

      if (state.type === "idle") {
        // Update cursor based on what's under pointer
        if (toolMode === "draw") {
          setCursor("crosshair");
          return;
        }
        if (spaceHeldRef.current) {
          setCursor("grab");
          return;
        }
        const svgPt = screenToSvg(e.clientX, e.clientY);
        const singleSelected =
          selectedIdsRef.current.length === 1
            ? (hitboxesRef.current.find((h) => h.id === selectedIdsRef.current[0]) ?? null)
            : null;
        if (singleSelected && !singleSelected.locked) {
          const handle = getHandleAtPoint(
            svgPt.x,
            svgPt.y,
            singleSelected,
            transformRef.current.scale,
          );
          if (handle) {
            setCursor(handle.cursor);
            return;
          }
        }
        const hitAtPoint = getHitboxAtPoint(svgPt.x, svgPt.y, hitboxesRef.current);
        if (hitAtPoint) {
          const selectedSet = new Set(selectedIdsRef.current);
          setCursor(selectedSet.has(hitAtPoint.id) ? "move" : "pointer");
          return;
        }
        setCursor("default");
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
        setDrawPreview((prev) => (prev ? { ...prev, currentSvg: svgPt } : null));
        return;
      }

      if (state.type === "moving") {
        const svgPt = screenToSvg(e.clientX, e.clientY);
        const dx = svgPt.x - state.startSvg.x;
        const dy = svgPt.y - state.startSvg.y;

        if (state.hitboxIds.length === 1) {
          // Single move
          const orig = state.originals.get(state.hitboxIds[0]);
          if (!orig || orig.locked) return;
          const moved = moveHitbox(orig, dx, dy, viewBox);
          if (moved.shape === "circle") {
            onHitboxUpdate(state.hitboxIds[0], { cx: moved.cx, cy: moved.cy });
          } else {
            onHitboxUpdate(state.hitboxIds[0], { x: moved.x, y: moved.y });
          }
        } else {
          // Group move — apply delta to each unlocked original
          const patches: Array<{ id: string; patch: Partial<Hitbox> }> = [];
          for (const id of state.hitboxIds) {
            const orig = state.originals.get(id);
            if (!orig || orig.locked) continue;
            const moved = moveHitbox(orig, dx, dy, viewBox);
            if (moved.shape === "circle") {
              patches.push({ id, patch: { cx: moved.cx, cy: moved.cy } });
            } else {
              patches.push({ id, patch: { x: moved.x, y: moved.y } });
            }
          }
          if (patches.length > 0) onHitboxMultiUpdate(patches);
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

      if (state.type === "marquee") {
        const minX = Math.min(state.startScreen.x, e.clientX);
        const minY = Math.min(state.startScreen.y, e.clientY);
        const w = Math.abs(e.clientX - state.startScreen.x);
        const h = Math.abs(e.clientY - state.startScreen.y);
        // Convert to screen-relative coords (relative to container)
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setMarqueeRect({ x: minX - rect.left, y: minY - rect.top, width: w, height: h });
        }
        // Live-preview selection
        const topLeft = screenToSvg(
          Math.min(state.startScreen.x, e.clientX),
          Math.min(state.startScreen.y, e.clientY),
        );
        const bottomRight = screenToSvg(
          Math.max(state.startScreen.x, e.clientX),
          Math.max(state.startScreen.y, e.clientY),
        );
        const svgMarquee: BBox = {
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        };
        const intersected = hitboxesInMarquee(hitboxesRef.current, svgMarquee);
        if (state.shiftHeld) {
          const merged = [...new Set([...state.prevSelectedIds, ...intersected])];
          onSetSelection(merged);
        } else {
          onSetSelection(intersected);
        }
        return;
      }
    },
    [toolMode, viewBox, screenToSvg, onHitboxUpdate, onHitboxMultiUpdate, onSetSelection],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }

      const state = interactionRef.current;
      const preview = drawPreviewRef.current;

      // Drawing finalization
      if (state.type === "drawing" && preview) {
        const { shape, startSvg, currentSvg } = preview;
        if (shape === "rect") {
          const x = Math.min(startSvg.x, currentSvg.x);
          const y = Math.min(startSvg.y, currentSvg.y);
          const width = Math.abs(currentSvg.x - startSvg.x);
          const height = Math.abs(currentSvg.y - startSvg.y);
          if (width > 5 && height > 5) {
            onHitboxDrawn({
              shape: "rect",
              id: crypto.randomUUID(),
              x,
              y,
              width,
              height,
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

      // Shift+click toggle (fires on pointer-up if pointer barely moved)
      if (state.type === "moving" && state.shiftHeld) {
        const dx = e.clientX - state.pointerStart.x;
        const dy = e.clientY - state.pointerStart.y;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
          // This was a Shift+click, not a Shift+drag → toggle
          const svgPt = screenToSvg(state.pointerStart.x, state.pointerStart.y);
          const hit = getHitboxAtPoint(svgPt.x, svgPt.y, hitboxesRef.current);
          if (hit) onToggleSelect(hit.id);
        }
      }

      // Marquee finalization
      if (state.type === "marquee") {
        // Selection was already set live in handlePointerMove.
        // If marquee was tiny (< 5px in any dimension) and no shift, treat as click-on-empty → deselect
        const dx = Math.abs(e.clientX - state.startScreen.x);
        const dy = Math.abs(e.clientY - state.startScreen.y);
        if (dx < 5 && dy < 5 && !state.shiftHeld) {
          onDeselect();
        }
        setMarqueeRect(null);
      }

      // Panning — revert cursor
      if (state.type === "panning") {
        setCursor(spaceHeldRef.current ? "grab" : "default");
      }

      interactionRef.current = { type: "idle" };
      if (state.type !== "panning") {
        setCursor(toolMode === "draw" ? "crosshair" : spaceHeldRef.current ? "grab" : "default");
      }
    },
    [toolMode, screenToSvg, onHitboxDrawn, onToggleSelect, onDeselect],
  );

  return {
    containerRef,
    svgContainerRef,
    transform,
    cursor,
    drawPreview,
    marqueeRect,
    containerSize,
    screenToSvg,
    handlers: {
      onWheel: handleWheel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
    setTransform,
  };
}
