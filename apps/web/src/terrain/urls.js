import { assetUrl } from '../assets/index.js'
import { bundleColliders, matImage, pieceCollider, pieceMesh, pieceTexture } from './files.js'
import { TERRAIN_PIECES } from './pieces.js'
import { MAPS } from './maps/index.js'

// Asset URLs of terrain files. Apart from files.js, because the migrate scripts load that in Node and
// assetUrl needs Vite.

// The mat image of a mat name
export function matImageUrl(mat) {
  return assetUrl(matImage(mat))
}

// The mat image of a map. rooms/preload.js loads it before a table shows (docs/features/rooms.md, "Loading").
export function matUrl(mapId) {
  return matImageUrl(MAPS[mapId].mat)
}

// The files of a terrain piece, as TerrainPiece loads them: mesh, texture (null for a bundle piece, whose
// GLB has its materials), collider mesh of an OBJ piece or null, and the one collider GLB of a bundle piece
// (null if it has no mesh collider).
// rooms/preload.js loads the same before a table shows (docs/features/rooms.md, "Loading").
export function pieceUrls(key) {
  const piece = TERRAIN_PIECES[key]
  return {
    mesh: assetUrl(pieceMesh(key)),
    texture: piece.bundle ? null : assetUrl(pieceTexture(key)),
    collider: piece.collider ? assetUrl(pieceCollider(key)) : null,
    colliders: bundleColliderMeshes(key).length ? assetUrl(bundleColliders(key)) : null,
  }
}

// The `mesh` entries of a bundle piece
export function bundleColliderMeshes(key) {
  return (TERRAIN_PIECES[key].colliders ?? []).filter((entry) => entry.shape === 'mesh')
}
