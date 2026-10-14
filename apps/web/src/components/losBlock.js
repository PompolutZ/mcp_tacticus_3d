// The block Size of the Line of Sight tool (docs/features/line-of-sight.md, "Block Size"): the Size of the
// looking target plus the Size of the terrain it stands on. Plain module, no React.

// Size of the terrain under a base: the largest of the sizes of the colliders it stands on. sizes: a number for a
// terrain collider, null for the table (terrainSize in losLength.js). 0 when it stands on the table.
export function standingTerrainSize(sizes) {
  return Math.max(0, ...sizes.filter((size) => size !== null))
}

// The block Size and its label. size: face-up Size of the character that sets it, the target, or the looker when
// there is no target. terrain: standingTerrainSize of that character. name: its name. own: no target, the
// looker's own Size.
export function losBlock({ size, terrain, name, own }) {
  const total = size + terrain
  return { size: total, label: `Size ${total} · ${own ? 'own' : name}` }
}
