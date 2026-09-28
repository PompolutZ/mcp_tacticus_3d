// Terrain pieces and map layouts from the TTS mod's "Terrain Database" object.
// Transforms stay in TTS coordinates, as in the mod, so they can be compared
// with the source. Terrain.jsx converts them to Three.js.

import { assetUrl } from '../assets/index.js'

// Mat top in TTS: the mat tile sits at y = 0.96 and is 0.1 thick
export const TTS_MAT_TOP = 1.06

// convex is the mod's collider flag. true: Unity uses the convex hull of the collider mesh.
// false: Unity uses the mesh triangles. The collider mesh is the visible mesh, unless the piece has a collider GLB.
export const TERRAIN_PIECES = {
  'mech-hangar': { mesh: assetUrl('terrain/mech-hangar.glb'), texture: assetUrl('terrain/mech-hangar.webp'), convex: false },
  'cosmic-barricade': { mesh: assetUrl('terrain/cosmic-barricade.glb'), texture: assetUrl('terrain/cosmic-barricade.webp'), convex: true },
  'crystals': { mesh: assetUrl('terrain/crystals.glb'), texture: assetUrl('terrain/crystals.webp'), convex: false },
  'panther-fountain': { mesh: assetUrl('terrain/panther-fountain.glb'), texture: assetUrl('terrain/panther-fountain.webp'), convex: true },
  'wakandan-street-light': { mesh: assetUrl('terrain/wakandan-street-light.glb'), texture: assetUrl('terrain/wakandan-street-light.webp'), convex: true },
  'wakanda-tree': { mesh: assetUrl('terrain/wakanda-tree.glb'), texture: assetUrl('terrain/wakanda-tree.webp'), convex: true },
  'panther-statue': { mesh: assetUrl('terrain/panther-statue.glb'), texture: assetUrl('terrain/panther-statue.webp'), convex: true },
  'vibranium-haller': { mesh: assetUrl('terrain/vibranium-haller.glb'), texture: assetUrl('terrain/vibranium-haller.webp'), convex: true },
  'truck': { mesh: assetUrl('terrain/truck.glb'), texture: assetUrl('terrain/truck.webp'), convex: true },
  'size-3-statue': { mesh: assetUrl('terrain/size-3-statue.glb'), texture: assetUrl('terrain/size-3-statue.webp'), convex: true },
  'asgard-ruins-size-4': { mesh: assetUrl('terrain/asgard-ruins-size-4.glb'), texture: assetUrl('terrain/asgard-ruins-size-4.webp'), convex: false, collider: assetUrl('terrain/asgard-ruins-size-4-collider.glb') },
  'size-2-devise': { mesh: assetUrl('terrain/size-2-devise.glb'), texture: assetUrl('terrain/size-2-devise.webp'), convex: true },
  'size-1-head': { mesh: assetUrl('terrain/size-1-head.glb'), texture: assetUrl('terrain/size-1-head.webp'), convex: true },
  'size-1-brazier': { mesh: assetUrl('terrain/size-1-brazier.glb'), texture: assetUrl('terrain/size-1-brazier.webp'), convex: true },
  'size-2-thinker': { mesh: assetUrl('terrain/size-2-thinker.glb'), texture: assetUrl('terrain/size-2-thinker.webp'), convex: true },
  'size-5-asgard-stairs': { mesh: assetUrl('terrain/size-5-asgard-stairs.glb'), texture: assetUrl('terrain/size-5-asgard-stairs.webp'), convex: false, collider: assetUrl('terrain/size-5-asgard-stairs-collider.glb') },
  'size-3-ruins': { mesh: assetUrl('terrain/size-3-ruins.glb'), texture: assetUrl('terrain/size-3-ruins.webp'), convex: false },
  'size-2-fire-pillar': { mesh: assetUrl('terrain/size-2-fire-pillar.glb'), texture: assetUrl('terrain/size-2-fire-pillar.webp'), convex: true },
}

// position and rotation (degrees) are TTS values. tint multiplies the texture, as in TTS.
// Exception: the mod tints the truck black (0, 0, 0), but the map card shows it olive, so the tint is left out.
export const MAPS = {
  // "Vibranium Heist" (strict map 285). "Survival of the Fittest" (306) has the same layout.
  'vibranium-heist': {
    name: 'Vibranium Heist',
    mat: assetUrl('wakanda-mat.webp'),
    placements: [
      { piece: 'crystals', position: [-16.723, 1.06, 12.843], rotation: [0, -45.01, 0], scale: 0.5, tint: [0.97, 0.01, 0.83] },
      { piece: 'crystals', position: [-15.284, 1.06, 6.679], rotation: [0, -45.01, 0], scale: 0.5, tint: [0.97, 0.01, 0.83] },
      { piece: 'vibranium-haller', position: [-12.794, 2.595, 0.73], rotation: [-0.02, -49.13, 0.2], scale: 3.35 },
      { piece: 'panther-statue', position: [-11.807, 3.916, 11.856], rotation: [0.01, 123.26, 0], scale: 3 },
      { piece: 'panther-statue', position: [-12.728, 2.488, -6.334], rotation: [0.01, 39.1, 0], scale: 1.5 },
      { piece: 'crystals', position: [-10.215, 1.06, 16.651], rotation: [0, -45.01, 0], scale: 0.5, tint: [0.97, 0.01, 0.83] },
      { piece: 'wakandan-street-light', position: [-9.878, 3.154, -14.787], rotation: [-0.02, -59.99, -0.03], scale: 2.2 },
      { piece: 'crystals', position: [-7.588, 1.06, 13.713], rotation: [0, -45.01, 0], scale: 0.5, tint: [0.97, 0.01, 0.83] },
      { piece: 'panther-fountain', position: [-5.953, 2.392, -10.683], rotation: [0.01, -135.01, -0.01], scale: 2.9 },
      { piece: 'wakanda-tree', position: [-4.763, 2.746, -3.64], rotation: [0, 45.06, 0], scale: 2.35 },
      { piece: 'cosmic-barricade', position: [-3.744, 1.052, 10.633], rotation: [0, -60.01, 0], scale: 1 },
      { piece: 'crystals', position: [-3.335, 1.06, 15.64], rotation: [0, -45.03, 0], scale: 0.5, tint: [0.97, 0.01, 0.83] },
      { piece: 'wakandan-street-light', position: [-3.29, 3.154, 3.474], rotation: [-0.02, -59.99, 0], scale: 2.2 },
      { piece: 'mech-hangar', position: [4.558, 1.06, -10.384], rotation: [0, -164.98, 0], scale: 0.775 },
      { piece: 'wakandan-street-light', position: [1.149, 3.154, 9.419], rotation: [0, 0.03, 0], scale: 2.2 },
      { piece: 'wakanda-tree', position: [5.006, 2.746, 0.039], rotation: [0.04, -132.15, 0], scale: 2.35 },
      { piece: 'wakanda-tree', position: [7.924, 2.746, 9.883], rotation: [0.02, -78.07, -0.02], scale: 2.35 },
      { piece: 'panther-statue', position: [7.777, 2.488, 15.972], rotation: [0.01, -134.97, 0], scale: 1.5 },
      { piece: 'truck', position: [11.968, 1.063, 4.13], rotation: [0, 102.22, 0], scale: 1.4 },
      { piece: 'panther-fountain', position: [13.004, 2.392, -2.38], rotation: [0.01, -29.98, 0.01], scale: 2.9 },
      { piece: 'panther-statue', position: [14.515, 3.916, -9.351], rotation: [0.01, -44.99, 0], scale: 3 },
      { piece: 'wakandan-street-light', position: [13.171, 3.154, 12.518], rotation: [-0.03, 0.03, -0.04], scale: 2.2 },
    ],
  },
  // "Battle For Asgard" (map 300 in the Terrain Database, Strict Maps)
  'battle-for-asgard': {
    name: 'Battle For Asgard',
    mat: assetUrl('battle-for-asgard-mat.webp'),
    // TTS rotation of the mat around Y. It is 180 for Vibranium Heist, and the app draws that mat with no turn.
    matRotation: 180,
    placements: [
      { piece: 'size-3-statue', position: [-15.922, 4.725, 13.219], rotation: [0.01, -119.98, 0], scale: 3.85 },
      { piece: 'asgard-ruins-size-4', position: [-12.968, 2.478, -13.371], rotation: [0.02, 60.01, -0.07], scale: 4.2 },
      { piece: 'size-3-statue', position: [-11.631, 4.725, 5.845], rotation: [0.01, -120.02, 0], scale: 3.85 },
      { piece: 'size-2-devise', position: [-12.075, 1.76, 0.064], rotation: [0, 90.17, 0.01], scale: 1.3 },
      { piece: 'size-1-head', position: [-11.401, 1.408, -6.05], rotation: [0, -104.97, 0], scale: 0.85 },
      { piece: 'size-1-brazier', position: [-9.381, 1.939, 12.704], rotation: [-0.05, 104.98, 0.02], scale: 0.925 },
      { piece: 'size-3-statue', position: [-7.109, 4.725, -2.581], rotation: [0.01, -120, 0], scale: 3.85 },
      { piece: 'size-1-head', position: [-6.472, 1.427, 6.735], rotation: [-0.01, -164.98, 0], scale: 0.9 },
      { piece: 'size-2-thinker', position: [-4.36, 1.054, -14.601], rotation: [0.08, -151.2, -0.1], scale: 1.55 },
      { piece: 'asgard-ruins-size-4', position: [-1.584, 2.477, 10.651], rotation: [0.01, -15.15, -0.07], scale: 4.2 },
      { piece: 'size-5-asgard-stairs', position: [2.449, 3.79, -8.721], rotation: [0.06, 60.03, 0.02], scale: 5.5 },
      { piece: 'size-2-thinker', position: [-3.493, 1.055, 3.011], rotation: [0.07, -29.99, -0.1], scale: 1.55 },
      { piece: 'size-2-devise', position: [0.016, 1.787, 0.024], rotation: [0, 0.01, 0.01], scale: 1.35 },
      { piece: 'size-1-brazier', position: [3.896, 1.94, -3.15], rotation: [-0.05, 104.97, 0.02], scale: 0.925 },
      { piece: 'size-3-ruins', position: [5.079, 1.178, 3.226], rotation: [0, -105, 0], scale: 1.05 },
      { piece: 'size-5-asgard-stairs', position: [12.175, 3.79, 12.037], rotation: [0.05, -119.99, 0.03], scale: 5.5 },
      { piece: 'size-1-brazier', position: [8.564, 1.94, -15.372], rotation: [-0.05, 104.99, 0.02], scale: 0.925 },
      { piece: 'size-1-head', position: [8.876, 1.428, -3.471], rotation: [0, -104.92, 0.06], scale: 0.9 },
      { piece: 'size-2-fire-pillar', position: [10.047, 3.535, 5.058], rotation: [-0.02, -104.96, 0.01], scale: 2.6 },
      { piece: 'size-2-devise', position: [14.951, 2.353, 0.469], rotation: [0, 75.01, 0.01], scale: 2.4 },
      { piece: 'size-2-fire-pillar', position: [13.528, 3.535, -5.808], rotation: [-0.02, -104.98, 0.03], scale: 2.6 },
      { piece: 'size-2-fire-pillar', position: [16.728, 3.535, -13.941], rotation: [-0.03, -104.99, 0.02], scale: 2.6 },
    ],
  },
}
