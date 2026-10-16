// Half length of each tool: the distance from the middle to an outer tip. Plain module, no React, so the
// layout of the tool rack (layout.js) and its tests can read them in Node.

// X coordinate of the outer tip for each half, per movement tool type
export const MOVE_TIP = { short: 1.574, medium: 2.523, long: 3.535 }
// Per range tool mesh (2 to 5), the same
export const RANGE_TIP = { 2: 1.501, 3: 3.0, 4: 4.0, 5: 5.0 }

// Range tools are 1" wide (mesh spans z = ±0.5). The width is Range 1.
export const RANGE_HALF_WIDTH = 0.5

// Game ranges and moves are tool sizes (R1..R5, Short/Medium/Long), not inches. These two are the only place
// that turns a size into inches: the full long side of the tool (docs/features/range-movement-tools.md, "Sizes").
// Range 1 has no tool: it is the short side (width) of a range tool.
export function rangeLength(size) {
  if (size === 1) return 2 * RANGE_HALF_WIDTH
  const tip = RANGE_TIP[size]
  if (!tip) throw new RangeError(`No range tool of size ${size}`)
  return 2 * tip
}
export function moveLength(size) {
  const tip = MOVE_TIP[size]
  if (!tip) throw new RangeError(`No move tool of size ${size}`)
  return 2 * tip
}

// Player tints, keyed by color ('blue' | 'red'), not by side (sideColors.js), from the tools in the mod (3036795456). Every tool there has the same black and white
// texture (TOOLBOX_IMAGE_02) and a ColorDiffuse in its player's color. TTS multiplies the texture by it.
// sRGB, 0 to 1. Used by the tool meshes (RulerTool.jsx) and the drag outline (ToolDragGhost.jsx).
export const TOOL_TINT = { blue: [0.12, 0.53, 1], red: [0.86, 0.1, 0.09] }
