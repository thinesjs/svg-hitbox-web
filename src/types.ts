export interface Hitbox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fields: Record<string, string>;
}

export interface HitboxExport {
  svgFilename: string;
  svgViewBox: string;
  hitboxes: Hitbox[];
}

export interface SvgData {
  filename: string;
  svgText: string;
  viewBox: { x: number; y: number; width: number; height: number };
}
