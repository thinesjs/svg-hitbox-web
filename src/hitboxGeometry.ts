import type { Hitbox, RectHitbox, CircleHitbox, BBox, HandlePosition, HandleInfo } from "./types";

const MIN_SIZE = 5;

// --- Bounding box ---

export function hitboxBounds(h: Hitbox): BBox {
  if (h.shape === "circle") {
    return { x: h.cx - h.r, y: h.cy - h.r, width: h.r * 2, height: h.r * 2 };
  }
  return { x: h.x, y: h.y, width: h.width, height: h.height };
}

// --- Hit testing ---

export function pointInHitbox(px: number, py: number, h: Hitbox): boolean {
  if (h.shape === "circle") {
    const dx = px - h.cx;
    const dy = py - h.cy;
    return dx * dx + dy * dy <= h.r * h.r;
  }
  return px >= h.x && px <= h.x + h.width && py >= h.y && py <= h.y + h.height;
}

/** Returns topmost hitbox at point (last in array = topmost). */
export function getHitboxAtPoint(px: number, py: number, hitboxes: Hitbox[]): Hitbox | null {
  for (let i = hitboxes.length - 1; i >= 0; i--) {
    if (pointInHitbox(px, py, hitboxes[i])) return hitboxes[i];
  }
  return null;
}

// --- Handle positions ---

export function getHandlePositions(h: Hitbox): HandleInfo[] {
  if (h.shape === "circle") {
    return [
      { position: "n", svgX: h.cx, svgY: h.cy - h.r, cursor: "ns-resize" },
      { position: "e", svgX: h.cx + h.r, svgY: h.cy, cursor: "ew-resize" },
      { position: "s", svgX: h.cx, svgY: h.cy + h.r, cursor: "ns-resize" },
      { position: "w", svgX: h.cx - h.r, svgY: h.cy, cursor: "ew-resize" },
    ];
  }
  const { x, y, width: w, height: ht } = h;
  return [
    { position: "nw", svgX: x, svgY: y, cursor: "nwse-resize" },
    { position: "n", svgX: x + w / 2, svgY: y, cursor: "ns-resize" },
    { position: "ne", svgX: x + w, svgY: y, cursor: "nesw-resize" },
    { position: "e", svgX: x + w, svgY: y + ht / 2, cursor: "ew-resize" },
    { position: "se", svgX: x + w, svgY: y + ht, cursor: "nwse-resize" },
    { position: "s", svgX: x + w / 2, svgY: y + ht, cursor: "ns-resize" },
    { position: "sw", svgX: x, svgY: y + ht, cursor: "nesw-resize" },
    { position: "w", svgX: x, svgY: y + ht / 2, cursor: "ew-resize" },
  ];
}

/** Returns the handle at the given SVG point, or null. hitAreaSvg = 16 / scale. */
export function getHandleAtPoint(
  px: number,
  py: number,
  h: Hitbox,
  scale: number
): HandleInfo | null {
  const hitRadius = 8 / scale; // 16px screen hit area → 8px radius in SVG
  const handles = getHandlePositions(h);
  for (const handle of handles) {
    if (Math.abs(px - handle.svgX) <= hitRadius && Math.abs(py - handle.svgY) <= hitRadius) {
      return handle;
    }
  }
  return null;
}

// --- Clamping ---

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clampRectToViewBox(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  vb: ViewBox
): { x: number; y: number; width: number; height: number } {
  let x = Math.max(vb.x, Math.min(rx, vb.x + vb.width - rw));
  let y = Math.max(vb.y, Math.min(ry, vb.y + vb.height - rh));
  return { x, y, width: rw, height: rh };
}

export function clampCircleToViewBox(
  cx: number,
  cy: number,
  r: number,
  vb: ViewBox
): { cx: number; cy: number; r: number } {
  const maxR = Math.min(
    cx - vb.x,
    vb.x + vb.width - cx,
    cy - vb.y,
    vb.y + vb.height - cy,
    r
  );
  const clampedR = Math.max(MIN_SIZE, maxR);
  return {
    cx: Math.max(vb.x + clampedR, Math.min(cx, vb.x + vb.width - clampedR)),
    cy: Math.max(vb.y + clampedR, Math.min(cy, vb.y + vb.height - clampedR)),
    r: clampedR,
  };
}

// --- Move ---

export function moveHitbox(h: Hitbox, dx: number, dy: number, vb: ViewBox): Hitbox {
  if (h.shape === "circle") {
    const cx = h.cx + dx;
    const cy = h.cy + dy;
    const clamped = clampCircleToViewBox(cx, cy, h.r, vb);
    return { ...h, cx: clamped.cx, cy: clamped.cy };
  }
  const clamped = clampRectToViewBox(h.x + dx, h.y + dy, h.width, h.height, vb);
  return { ...h, ...clamped };
}

// --- Resize ---

export function resizeRect(
  original: RectHitbox,
  handle: HandlePosition,
  dx: number,
  dy: number,
  vb: ViewBox
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = original;
  const right = x + width;
  const bottom = y + height;

  // Compute new edges based on handle
  let newLeft = x, newTop = y, newRight = right, newBottom = bottom;

  if (handle.includes("w")) newLeft = Math.min(x + dx, right - MIN_SIZE);
  if (handle.includes("e")) newRight = Math.max(right + dx, x + MIN_SIZE);
  if (handle.includes("n")) newTop = Math.min(y + dy, bottom - MIN_SIZE);
  if (handle.includes("s")) newBottom = Math.max(bottom + dy, y + MIN_SIZE);

  // Clamp to viewBox
  newLeft = Math.max(vb.x, newLeft);
  newTop = Math.max(vb.y, newTop);
  newRight = Math.min(vb.x + vb.width, newRight);
  newBottom = Math.min(vb.y + vb.height, newBottom);

  // Enforce minimum size after clamping
  if (newRight - newLeft < MIN_SIZE) {
    if (handle.includes("w")) newLeft = newRight - MIN_SIZE;
    else newRight = newLeft + MIN_SIZE;
  }
  if (newBottom - newTop < MIN_SIZE) {
    if (handle.includes("n")) newTop = newBottom - MIN_SIZE;
    else newBottom = newTop + MIN_SIZE;
  }

  return { x: newLeft, y: newTop, width: newRight - newLeft, height: newBottom - newTop };
}

export function resizeCircle(
  original: CircleHitbox,
  handle: HandlePosition,
  dx: number,
  dy: number,
  vb: ViewBox
): { cx: number; cy: number; r: number } {
  // All handles adjust radius uniformly. Compute new radius based on
  // the distance from center to the dragged handle position.
  const handlePos = getHandlePositions(original).find((h) => h.position === handle)!;
  const newHandleX = handlePos.svgX + dx;
  const newHandleY = handlePos.svgY + dy;
  const newR = Math.max(
    MIN_SIZE,
    Math.sqrt(
      (newHandleX - original.cx) ** 2 + (newHandleY - original.cy) ** 2
    )
  );
  return clampCircleToViewBox(original.cx, original.cy, newR, vb);
}

// --- Label helper ---

export function hitboxLabel(h: Hitbox): string {
  return h.fields.stop || h.fields.route || h.fields.mode || h.id.slice(0, 8);
}
