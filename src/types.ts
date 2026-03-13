// --- Shape types (discriminated union) ---

export interface HitboxBase {
  id: string;
  fields: Record<string, string>;
  locked?: boolean;
}

export interface RectHitbox extends HitboxBase {
  shape: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleHitbox extends HitboxBase {
  shape: "circle";
  cx: number;
  cy: number;
  r: number;
}

export type Hitbox = RectHitbox | CircleHitbox;

// --- Tool state ---

export type ToolMode = "select" | "draw";
export type DrawShape = "rect" | "circle";

// --- Geometry ---

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface HandleInfo {
  position: HandlePosition;
  svgX: number;
  svgY: number;
  cursor: string;
}

// --- Export/Import ---

export interface HitboxExport {
  svgFilename: string;
  svgViewBox: string;
  hitboxes: Hitbox[];
}

export interface SvgData {
  filename: string;
  svgText: string;
  viewBox: ViewBox;
}
