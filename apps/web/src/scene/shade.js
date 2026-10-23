// The shade of a piece: a tint of its materials that marks a state when the outline is not enough or not drawn.
// Plain module, no React. useOutline (SelectionOutlines.jsx) is the one owner: the shade is a function of the
// outline mode, so only one shade is on a mesh at a time and a change always starts from the original materials.
import { Color } from 'three'

// Overlap (characters/overlap.js): red glow, drawn also with the composer on.
// Selected: a darker orange than the outline color (OUTLINES.selected), because the shade is added to the
// colors of the material and a bright one would repaint it. Only with the composer off, when no outline is drawn.
const OVERLAP_SHADE = 0xaa1111
const SELECTED_SHADE = 0x9a6410
// Unlit materials (MeshBasicMaterial) have no emissive: their color moves this far to the shade color.
const UNLIT_MIX = 0.5

// The shade color for an outline mode, or null for none. composer: the composer is on (outlines are drawn).
// The mode already has the order overlap, then selected (outlineMode), so overlap wins over selected.
export function shadeFor(mode, composer) {
  if (mode === 'overlap') return OVERLAP_SHADE
  if (mode === 'selected' && !composer) return SELECTED_SHADE
  return null
}

function shadeMaterial(material, shade) {
  const copy = material.clone()
  if (copy.emissive) copy.emissive.set(shade)
  else if (copy.color) copy.color.lerp(new Color(shade), UNLIT_MIX)
  return copy
}

// The shades that are on now, one [[mesh, original material]] list each, for withoutShades
const shaded = new Set()

// Gives each mesh its own shaded copy of its material (the materials of a GLB are shared with the other models made
// from the same file). Returns the function that disposes the copies and puts the originals back.
export function applyShade(meshes, shade) {
  const saved = meshes.map((mesh) => [mesh, mesh.material])
  for (const [mesh, material] of saved) {
    mesh.material = Array.isArray(material)
      ? material.map((m) => shadeMaterial(m, shade))
      : shadeMaterial(material, shade)
  }
  shaded.add(saved)
  return () => {
    shaded.delete(saved)
    for (const [mesh, material] of saved) {
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose()
      mesh.material = material
    }
  }
}

// Runs draw with the original materials on every shaded mesh, then puts the shaded copies back. For a draw that must
// not show the state marks (the top view image, terrain/boardImage.js). draw must be synchronous, so no frame shows
// the meshes without their shade. The shades stay owned by useOutline: nothing is made or disposed here.
export function withoutShades(draw) {
  const copies = []
  for (const saved of shaded) {
    for (const [mesh, material] of saved) {
      copies.push([mesh, mesh.material])
      mesh.material = material
    }
  }
  try {
    return draw()
  } finally {
    for (const [mesh, copy] of copies) mesh.material = copy
  }
}
