// Terrain pieces and map layouts from the TTS mod's "Terrain Database" object.
// Transforms stay in TTS coordinates, as in the mod, so they can be compared
// with the source. Terrain.jsx converts them to Three.js.

// Mat top in TTS: the mat tile sits at y = 0.96 and is 0.1 thick
export const TTS_MAT_TOP = 1.06

// convex is the mod's collider flag. true: Unity uses the convex hull of the mesh.
// false: Unity uses the mesh triangles. The mod's collider mesh is the visible mesh for all these pieces.
export const TERRAIN_PIECES = {
  'mech-hangar': { mesh: '/terrain/mech-hangar.obj', texture: '/terrain/mech-hangar.jpg', convex: false },
  'cosmic-barricade': { mesh: '/terrain/cosmic-barricade.obj', texture: '/terrain/cosmic-barricade.png', convex: true },
  'crystals': { mesh: '/terrain/crystals.obj', texture: '/terrain/crystals.jpg', convex: false },
  'panther-fountain': { mesh: '/terrain/panther-fountain.obj', texture: '/terrain/panther-fountain.jpg', convex: true },
  'wakandan-street-light': { mesh: '/terrain/wakandan-street-light.obj', texture: '/terrain/wakandan-street-light.jpg', convex: true },
  'wakanda-tree': { mesh: '/terrain/wakanda-tree.obj', texture: '/terrain/wakanda-tree.jpg', convex: true },
  'panther-statue': { mesh: '/terrain/panther-statue.obj', texture: '/terrain/panther-statue.jpg', convex: true },
  'vibranium-haller': { mesh: '/terrain/vibranium-haller.obj', texture: '/terrain/vibranium-haller.jpg', convex: true },
  'truck': { mesh: '/terrain/truck.obj', texture: '/terrain/truck.png', convex: true },
}

// position and rotation (degrees) are TTS values. tint multiplies the texture, as in TTS.
// Exception: the mod tints the truck black (0, 0, 0), but the map card shows it olive, so the tint is left out.
export const MAPS = {
  // "Vibranium Heist" (strict map 285). "Survival of the Fittest" (306) has the same layout.
  'vibranium-heist': {
    name: 'Vibranium Heist',
    mat: '/wakanda-mat.png',
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
}
