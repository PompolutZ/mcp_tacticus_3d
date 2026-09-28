// Terrain pieces from the TTS mod's "Terrain Database" object. One entry is one set of files.
// The key is the file name of the piece in src/assets/terrain (see files.js).
//
// name: the mod piece name without its Size. The Size is on each placement in maps.js, because the mod
//   uses the same files for pieces with different Sizes (for example Crystals: Size 1 and Size 2).
// convex: the mod's collider flag. true: Unity uses the convex hull of the collider mesh.
//   false: Unity uses the mesh triangles.
// collider: true when the mod has a separate collider mesh. Otherwise the collider mesh is the visible mesh.
export const TERRAIN_PIECES = {
  'mech-hangar': { name: 'Building', convex: false },
  'cosmic-barricade': { name: 'Cosmic Barricade', convex: true },
  'crystals': { name: 'Crystals', convex: false },
  'panther-fountain': { name: 'Panther Fountain', convex: true },
  'wakandan-street-light': { name: 'Wakandan Street light', convex: true },
  'wakanda-tree': { name: 'Wakanda Tree', convex: true },
  'panther-statue': { name: 'Panther Statue', convex: true },
  'vibranium-haller': { name: 'Vibranium Haller', convex: true },
  'truck': { name: 'Truck', convex: true },
  'size-3-statue': { name: 'Statue', convex: true },
  'asgard-ruins-size-4': { name: 'Asgard Ruins', convex: false, collider: true },
  'size-2-devise': { name: 'Devise', convex: true },
  'size-1-head': { name: 'Head', convex: true },
  'size-1-brazier': { name: 'Brazier', convex: true },
  'size-2-thinker': { name: 'Thinker', convex: true },
  'size-5-asgard-stairs': { name: 'Asgard Stairs', convex: false, collider: true },
  'size-3-ruins': { name: 'Ruins', convex: false },
  'size-2-fire-pillar': { name: 'Fire pillar', convex: true },
  'contruction-site-size-4': { name: 'Contruction Site', convex: true, collider: true },
  'pallet-of-barrels-size-2': { name: 'Pallet of Barrels', convex: true, collider: true },
  'size-3-hydra-turret': { name: 'Hydra Turret', convex: true },
  'size-3-hydra-power-station': { name: 'Hydra Power Station', convex: true },
  'barrel-stack-size-2': { name: 'Barrel Stack', convex: true },
  'size-4-hydra-tank': { name: 'Hydra Tank', convex: true },
  'size-4-talon-fighter': { name: 'Talon Fighter', convex: true },
  'size-3-hydra-missle-turret': { name: 'Hydra Missle Turret', convex: true },
}
