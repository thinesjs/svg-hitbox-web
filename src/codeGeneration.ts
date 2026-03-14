import type { Hitbox, HitboxExport, SvgData } from "./types";

/** Strip internal `locked` field from hitboxes to keep exports clean. */
function cleanHitboxesForExport(hitboxes: Hitbox[]): Hitbox[] {
  return hitboxes.map((h) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { locked, ...rest } = h;
    return rest as Hitbox;
  });
}

export function generateJsonString(hitboxes: Hitbox[], svgData: SvgData): string {
  const data: HitboxExport = {
    svgFilename: svgData.filename,
    svgViewBox: `${svgData.viewBox.x} ${svgData.viewBox.y} ${svgData.viewBox.width} ${svgData.viewBox.height}`,
    hitboxes: cleanHitboxesForExport(hitboxes),
  };
  return JSON.stringify(data, null, 2);
}

export function generateTsString(hitboxes: Hitbox[], svgData: SvgData): string {
  const lines: string[] = [];
  lines.push("export interface HitboxFields {");
  lines.push("  mode: 'rail' | 'bus';");
  lines.push("  feed: string;");
  lines.push("  route: string;");
  lines.push("  stop: string;");
  lines.push("  name: string;");
  lines.push("}");
  lines.push("");
  lines.push("export interface HitboxBase {");
  lines.push("  id: string;");
  lines.push("  fields: HitboxFields;");
  lines.push("}");
  lines.push("");
  lines.push("export interface RectHitbox extends HitboxBase {");
  lines.push('  shape: "rect";');
  lines.push("  x: number;");
  lines.push("  y: number;");
  lines.push("  width: number;");
  lines.push("  height: number;");
  lines.push("}");
  lines.push("");
  lines.push("export interface CircleHitbox extends HitboxBase {");
  lines.push('  shape: "circle";');
  lines.push("  cx: number;");
  lines.push("  cy: number;");
  lines.push("  r: number;");
  lines.push("}");
  lines.push("");
  lines.push("export type Hitbox = RectHitbox | CircleHitbox;\n");
  lines.push(`export const svgFilename = ${JSON.stringify(svgData.filename)};\n`);
  lines.push(
    `export const svgViewBox = "${svgData.viewBox.x} ${svgData.viewBox.y} ${svgData.viewBox.width} ${svgData.viewBox.height}";\n`,
  );
  lines.push(
    "export const hitboxes: Hitbox[] = " +
      JSON.stringify(cleanHitboxesForExport(hitboxes), null, 2) +
      ";\n",
  );
  return lines.join("\n");
}
