import type {
  Hitbox,
  RectHitbox,
  CircleHitbox,
  BBox,
  HandlePosition,
  HandleInfo,
  ViewBox,
} from "./types";

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
  scale: number,
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

export function clampRectToViewBox(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  vb: ViewBox,
): { x: number; y: number; width: number; height: number } {
  const x = Math.max(vb.x, Math.min(rx, vb.x + vb.width - rw));
  const y = Math.max(vb.y, Math.min(ry, vb.y + vb.height - rh));
  return { x, y, width: rw, height: rh };
}

export function clampCircleToViewBox(
  cx: number,
  cy: number,
  r: number,
  vb: ViewBox,
): { cx: number; cy: number; r: number } {
  const maxR = Math.min(cx - vb.x, vb.x + vb.width - cx, cy - vb.y, vb.y + vb.height - cy, r);
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
  vb: ViewBox,
): { x: number; y: number; width: number; height: number } {
  const { x, y, width, height } = original;
  const right = x + width;
  const bottom = y + height;

  // Compute new edges based on handle
  let newLeft = x,
    newTop = y,
    newRight = right,
    newBottom = bottom;

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
  vb: ViewBox,
): { cx: number; cy: number; r: number } {
  // All handles adjust radius uniformly. Compute new radius based on
  // the distance from center to the dragged handle position.
  const handlePos = getHandlePositions(original).find((h) => h.position === handle)!;
  const newHandleX = handlePos.svgX + dx;
  const newHandleY = handlePos.svgY + dy;
  const newR = Math.max(
    MIN_SIZE,
    Math.sqrt((newHandleX - original.cx) ** 2 + (newHandleY - original.cy) ** 2),
  );
  return clampCircleToViewBox(original.cx, original.cy, newR, vb);
}

// --- Label helper ---

export function hitboxLabel(h: Hitbox): string {
  return h.fields.name || h.fields.stop || h.fields.route || h.fields.feed || h.fields.mode || h.id.slice(0, 8);
}

// --- Z-order operations ---

export function bringToFront(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[] {
  const sel = new Set(selectedIds);
  const unselected = hitboxes.filter((h) => !sel.has(h.id));
  const selected = hitboxes.filter((h) => sel.has(h.id));
  return [...unselected, ...selected];
}

export function sendToBack(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[] {
  const sel = new Set(selectedIds);
  const unselected = hitboxes.filter((h) => !sel.has(h.id));
  const selected = hitboxes.filter((h) => sel.has(h.id));
  return [...selected, ...unselected];
}

export function bringForward(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[] {
  const sel = new Set(selectedIds);
  const result = [...hitboxes];
  for (let i = result.length - 2; i >= 0; i--) {
    if (sel.has(result[i].id) && !sel.has(result[i + 1].id)) {
      [result[i], result[i + 1]] = [result[i + 1], result[i]];
    }
  }
  return result;
}

export function sendBackward(hitboxes: Hitbox[], selectedIds: string[]): Hitbox[] {
  const sel = new Set(selectedIds);
  const result = [...hitboxes];
  for (let i = 1; i < result.length; i++) {
    if (sel.has(result[i].id) && !sel.has(result[i - 1].id)) {
      [result[i], result[i - 1]] = [result[i - 1], result[i]];
    }
  }
  return result;
}

// --- Flip operations (multi-selection only) ---

export function selectionBounds(hitboxes: Hitbox[], selectedIds: string[]): BBox {
  const sel = new Set(selectedIds);
  const selected = hitboxes.filter((h) => sel.has(h.id));
  if (selected.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const h of selected) {
    const b = hitboxBounds(h);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function flipHorizontal(hitboxes: Hitbox[], selectedIds: string[], vb: ViewBox): Hitbox[] {
  const sel = new Set(selectedIds);
  const bounds = selectionBounds(hitboxes, selectedIds);
  const centerX = bounds.x + bounds.width / 2;
  return hitboxes.map((h) => {
    if (!sel.has(h.id) || h.locked) return h;
    const hb = hitboxBounds(h);
    const oldCenterX = hb.x + hb.width / 2;
    const newCenterX = centerX + (centerX - oldCenterX);
    if (h.shape === "circle") {
      const clamped = clampCircleToViewBox(newCenterX, h.cy, h.r, vb);
      return { ...h, cx: clamped.cx, cy: clamped.cy, r: clamped.r };
    }
    const newX = newCenterX - h.width / 2;
    const clamped = clampRectToViewBox(newX, h.y, h.width, h.height, vb);
    return { ...h, ...clamped };
  });
}

export function flipVertical(hitboxes: Hitbox[], selectedIds: string[], vb: ViewBox): Hitbox[] {
  const sel = new Set(selectedIds);
  const bounds = selectionBounds(hitboxes, selectedIds);
  const centerY = bounds.y + bounds.height / 2;
  return hitboxes.map((h) => {
    if (!sel.has(h.id) || h.locked) return h;
    const hb = hitboxBounds(h);
    const oldCenterY = hb.y + hb.height / 2;
    const newCenterY = centerY + (centerY - oldCenterY);
    if (h.shape === "circle") {
      const clamped = clampCircleToViewBox(h.cx, newCenterY, h.r, vb);
      return { ...h, cx: clamped.cx, cy: clamped.cy, r: clamped.r };
    }
    const newY = newCenterY - h.height / 2;
    const clamped = clampRectToViewBox(h.x, newY, h.width, h.height, vb);
    return { ...h, ...clamped };
  });
}

// --- Marquee selection ---

/** Returns IDs of hitboxes whose bounding box intersects the given rect (in SVG coords). */
export function hitboxesInMarquee(hitboxes: Hitbox[], marquee: BBox): string[] {
  return hitboxes
    .filter((h) => {
      const b = hitboxBounds(h);
      return (
        b.x < marquee.x + marquee.width &&
        b.x + b.width > marquee.x &&
        b.y < marquee.y + marquee.height &&
        b.y + b.height > marquee.y
      );
    })
    .map((h) => h.id);
}
