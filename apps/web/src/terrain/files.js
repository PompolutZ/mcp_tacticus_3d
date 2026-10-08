// Names of the terrain files in src/assets. The files are named after the piece key or the mat name,
// so pieces.js and maps.js have no paths. scripts/migrate-terrain.mjs writes the files with these names.
// Plain functions without Vite imports, so that the script can use them too.

// Mesh of a piece: GLB
export const pieceMesh = key => `terrain/${key}.glb`
// Color texture of an OBJ piece: WebP
export const pieceTexture = key => `terrain/${key}.webp`
// Collider mesh of an OBJ piece with collider: true
export const pieceCollider = key => `terrain/${key}-collider.glb`
// Collider mesh number n (from 1) of a bundle piece
export const bundleCollider = (key, n) => `terrain/${key}-collider-${n}.glb`
// Mat image of a map
export const matImage = mat => `${mat}-mat.webp`
// Map card of a map, by its key in MAPS: the image of the card in the mod's Terrain Database. The lobby
// shows it (docs/feature-rooms.md)
export const mapCard = id => `maps/${id}.webp`
// The back of a map card. The new room dialog shows it for Random map. The maps of the app have the same
// back in the mod.
export const MAP_CARD_BACK = 'maps/back.webp'
