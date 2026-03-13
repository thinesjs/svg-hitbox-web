#!/usr/bin/env python3
"""
Parse transit-map.svg and rewrite it with elements grouped by transit line.
Each line gets a <g id="line-{slug}"> wrapper so lines can be shown/hidden.

Handles both self-closing elements and nested <g> groups (numbered circles,
opacity groups, clip-path sub-groups, images).
"""

import re
import json
import sys
from pathlib import Path
from collections import defaultdict

SVG_INPUT = Path(__file__).parent.parent / "public" / "transit-map.svg"
SVG_OUTPUT = Path(__file__).parent.parent / "public" / "transit-map-grouped.svg"
STATIONS_JSON = Path(__file__).parent.parent / "src" / "rawStations.json"

# Line color -> (slug, display name)
LINE_COLORS = {
    "#fecf0a": ("lrt-kelana-jaya", "LRT Kelana Jaya"),
    "#db1e37": ("lrt-ampang-shah-alam", "LRT Ampang / Shah Alam"),
    "#057a40": ("lrt-sri-petaling", "LRT Sri Petaling"),
    "#c12334": ("ktm-batu-caves-pulau-sebang", "KTM Batu Caves - Pulau Sebang"),
    "#18488b": ("ktm-tanjung-malim-pelabuhan-klang", "KTM Tanjung Malim - Pelabuhan Klang"),
    "#3eb2e1": ("ktm-skypark", "KTM Skypark / Shuttle"),
    "#e57525": ("mrt-kajang", "MRT Kajang"),
    "#7a2430": ("mrt-putrajaya", "MRT Putrajaya"),
    "#80bb42": ("kl-monorail", "KL Monorail"),
    "#00a4b4": ("erl-klia", "ERL KLIA Transit"),
    "#94398e": ("mrl", "MRL"),
    "#124835": ("brt-sunway", "BRT Sunway"),
    "#78722e": ("ktm-tanjung-malim-ext", "KTM Tanjung Malim ext"),
}

SHARED_COLORS = {"#383938", "#bbbdbf", "#f9f9f6", "#f2f2f3", "#ef3842"}
TEXT_COLORS = {"#414142", "#11284b", "#fff", "#2a3b8f"}


def extract_position(element_str):
    """Extract approximate (x, y) center from an SVG element."""
    m = re.search(r'd="M([\d.]+),([\d.]+)', element_str)
    if m:
        return float(m.group(1)), float(m.group(2))
    # Try transform="translate(x y)"
    m = re.search(r'transform="translate\(([\d.]+)\s+([\d.]+)\)', element_str)
    if m:
        return float(m.group(1)), float(m.group(2))
    xm = re.search(r'\bx="([\d.]+)"', element_str)
    ym = re.search(r'\by="([\d.]+)"', element_str)
    if xm and ym:
        return float(xm.group(1)), float(ym.group(1))
    cxm = re.search(r'\bcx="([\d.]+)"', element_str)
    cym = re.search(r'\bcy="([\d.]+)"', element_str)
    if cxm and cym:
        return float(cxm.group(1)), float(cym.group(1))
    pm = re.search(r'points="([\d.]+)\s+([\d.]+)', element_str)
    if pm:
        return float(pm.group(1)), float(pm.group(2))
    return None


def get_fill_color(el):
    m = re.search(r'fill="(#[0-9a-fA-F]+)"', el)
    return m.group(1) if m else None


def get_stroke_color(el):
    m = re.search(r'stroke="(#[0-9a-fA-F]+)"', el)
    return m.group(1) if m else None


def extract_content_elements(svg_text):
    """
    Extract all top-level visual elements from inside the main clip-path group.
    Returns list of (position_in_svg, element_string) tuples.
    Elements can be self-closing tags OR entire <g>...</g> blocks.
    """
    # Find the main content area: inside <g clip-path="url(#clippath)">...</g>
    # But we need to handle nested </g> properly
    clip_start = svg_text.find('<g clip-path="url(#clippath)">')
    if clip_start == -1:
        print("ERROR: Could not find main clip-path group")
        sys.exit(1)

    # Find the content start (after the opening tag)
    content_start = clip_start + len('<g clip-path="url(#clippath)">')

    # Now we need to find the matching </g> for this group
    # Count nested <g> tags
    depth = 1
    pos = content_start
    while depth > 0 and pos < len(svg_text):
        next_open = svg_text.find('<g', pos)
        next_close = svg_text.find('</g>', pos)
        if next_close == -1:
            break
        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 2
        else:
            depth -= 1
            if depth == 0:
                content_end = next_close
                break
            pos = next_close + 4

    content = svg_text[content_start:content_end]

    # Now extract top-level elements from this content
    # These are either:
    # 1. Self-closing: <path.../>, <rect.../>, <polygon.../>, <circle.../>, <line.../>, <image.../>
    # 2. Group blocks: <g ...>...</g> (possibly nested)
    elements = []
    pos = 0
    while pos < len(content):
        # Skip whitespace
        ws_match = re.match(r'\s+', content[pos:])
        if ws_match:
            pos += ws_match.end()
            if pos >= len(content):
                break

        # Try self-closing element
        sc_match = re.match(r'<(?:path|rect|polygon|circle|line|image)\b[^>]*/>', content[pos:])
        if sc_match:
            elements.append((content_start + pos, sc_match.group(0)))
            pos += sc_match.end()
            continue

        # Try opening <g> tag - capture entire group block
        g_match = re.match(r'<g\b', content[pos:])
        if g_match:
            # Find matching </g>
            g_depth = 0
            g_pos = pos
            g_end = None
            while g_pos < len(content):
                next_g_open = content.find('<g', g_pos + (2 if g_pos == pos else 0))
                next_g_close = content.find('</g>', g_pos + 1)
                if next_g_close == -1:
                    g_end = len(content)
                    break
                if g_depth == 0:
                    g_depth = 1
                    g_pos = pos + 2
                    continue
                if next_g_open != -1 and next_g_open < next_g_close:
                    g_depth += 1
                    g_pos = next_g_open + 2
                else:
                    g_depth -= 1
                    if g_depth == 0:
                        g_end = next_g_close + 4  # len('</g>')
                        break
                    g_pos = next_g_close + 4

            if g_end is not None:
                block = content[pos:g_end]
                elements.append((content_start + pos, block))
                pos = g_end
            else:
                pos += 1
            continue

        # Skip anything else
        pos += 1

    return elements


def classify_element(el_str, nearest_line_color_fn):
    """Classify an element (or group block) into a line slug or 'shared'."""
    fill = get_fill_color(el_str)
    stroke = get_stroke_color(el_str)

    # Stroked line paths
    if stroke and stroke in LINE_COLORS:
        return LINE_COLORS[stroke][0]

    # Filled with line color
    if fill and fill in LINE_COLORS:
        return LINE_COLORS[fill][0]

    # Shared colors
    if fill and fill in SHARED_COLORS:
        return "shared"
    if stroke and stroke in SHARED_COLORS:
        return "shared"

    # Text/label elements - assign by proximity
    if fill and fill in TEXT_COLORS:
        pos = extract_position(el_str)
        if pos:
            lc = nearest_line_color_fn(pos[0], pos[1])
            if lc and lc in LINE_COLORS:
                return LINE_COLORS[lc][0]
            elif lc == "#383938":
                return "shared"

    # Stroked borders
    if stroke and stroke == "#414142":
        pos = extract_position(el_str)
        if pos:
            lc = nearest_line_color_fn(pos[0], pos[1])
            if lc and lc in LINE_COLORS:
                return LINE_COLORS[lc][0]

    # For group blocks, try to classify by the colors/positions inside
    if el_str.startswith("<g"):
        # Check all colors inside the group
        inner_fills = set(re.findall(r'fill="(#[0-9a-fA-F]+)"', el_str))
        inner_strokes = set(re.findall(r'stroke="(#[0-9a-fA-F]+)"', el_str))
        all_colors = inner_fills | inner_strokes

        # If any line color is present, assign to that line
        for c in all_colors:
            if c in LINE_COLORS:
                return LINE_COLORS[c][0]

        # Try proximity from positions inside
        pos = extract_position(el_str)
        if pos:
            lc = nearest_line_color_fn(pos[0], pos[1])
            if lc and lc in LINE_COLORS:
                return LINE_COLORS[lc][0]

    return "shared"


def main():
    svg_text = SVG_INPUT.read_text()
    stations = json.loads(STATIONS_JSON.read_text())

    station_points = [(s["cx"], s["cy"], s["color"]) for s in stations]

    def nearest_line_color(x, y, max_dist=80):
        best_d = max_dist
        best_color = None
        for sx, sy, sc in station_points:
            d = ((x - sx) ** 2 + (y - sy) ** 2) ** 0.5
            if d < best_d:
                best_d = d
                best_color = sc
        return best_color

    # Extract defs
    defs_match = re.search(r'(<defs>.*?</defs>)', svg_text, re.DOTALL)
    defs = defs_match.group(1) if defs_match else ""

    # Extract all content elements (self-closing + group blocks)
    elements = extract_content_elements(svg_text)
    print(f"Found {len(elements)} top-level content elements")

    # Also find content OUTSIDE the main clip-path but inside the SVG
    # (e.g., the RapidKL logo image wrapped in clippath-15)
    # Find everything after the main clip-path group closes
    clip_start = svg_text.find('<g clip-path="url(#clippath)">')
    # Find matching close
    depth = 1
    pos = clip_start + len('<g clip-path="url(#clippath)">')
    while depth > 0 and pos < len(svg_text):
        next_open = svg_text.find('<g', pos)
        next_close = svg_text.find('</g>', pos)
        if next_close == -1:
            break
        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 2
        else:
            depth -= 1
            pos = next_close + 4
    main_clip_end = pos

    # Content after main clip group, before </svg>
    after_clip = svg_text[main_clip_end:svg_text.rfind('</svg>')]
    # Extract any elements/groups from this region
    after_elements = []
    for m in re.finditer(r'(<g\b[^>]*>.*?</g>|<(?:path|rect|polygon|circle|line|image)\b[^>]*/>)', after_clip, re.DOTALL):
        after_elements.append(m.group(0))
    if after_elements:
        print(f"Found {len(after_elements)} elements outside main clip-path")

    # Classify elements
    groups = defaultdict(list)
    for svg_pos, el_str in elements:
        slug = classify_element(el_str, nearest_line_color)
        groups[slug].append(el_str)

    # After-clip elements go to shared
    for el_str in after_elements:
        groups["shared"].append(el_str)

    # Print stats
    total = 0
    for slug in sorted(groups.keys()):
        count = len(groups[slug])
        total += count
        print(f"  {slug:45s}: {count:5d} elements")
    print(f"  {'TOTAL':45s}: {total:5d}")

    # Rebuild SVG
    lines_out = []
    lines_out.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines_out.append('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1755.16 2844.49">')
    lines_out.append(f"  {defs}")
    lines_out.append("")
    lines_out.append('  <g clip-path="url(#clippath)">')
    lines_out.append("")

    # Shared/base first
    lines_out.append('    <g id="base" data-name="Shared">')
    for el in groups.get("shared", []):
        # Indent block elements properly
        for line in el.split("\n"):
            lines_out.append(f"      {line.strip()}")
    lines_out.append("    </g>")
    lines_out.append("")

    # Each transit line
    for color, (slug, name) in LINE_COLORS.items():
        if slug not in groups:
            continue
        lines_out.append(f'    <g id="line-{slug}" data-name="{name}" data-color="{color}">')
        for el in groups[slug]:
            for line in el.split("\n"):
                lines_out.append(f"      {line.strip()}")
        lines_out.append("    </g>")
        lines_out.append("")

    lines_out.append("  </g>")
    lines_out.append("</svg>")

    output = "\n".join(lines_out)
    SVG_OUTPUT.write_text(output)
    print(f"\nWritten to {SVG_OUTPUT} ({len(output)} bytes)")


if __name__ == "__main__":
    main()
