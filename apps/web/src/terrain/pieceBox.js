import { Box3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { pieceUrls } from './urls.js'

// The mesh box of a terrain piece, for the rest height of a new piece (restY in placementMove.js).
// The piece files load async, and the add needs the box before the piece is placed. So this loads the
// visible mesh GLB on its own, once per piece, and keeps the box. The browser caches the file, so the
// piece itself (useGLTF in Terrain.jsx) does not download it again. The scene is never mounted, so its
// box is in mesh space, like labelPosition in Terrain.jsx.

let loader = null
const boxes = new Map()

function gltfLoader() {
  if (!loader) {
    // The mesh GLBs are Draco compressed. The decoder path is the one of App.jsx (useGLTF.setDecoderPath).
    const draco = new DRACOLoader().setDecoderPath('/draco/')
    loader = new GLTFLoader().setDRACOLoader(draco)
  }
  return loader
}

// Promise of the Box3 of the mesh of piece `key`. A failed load is not kept, so a later add tries again.
export function loadPieceBox(key) {
  if (!boxes.has(key)) {
    const promise = gltfLoader()
      .loadAsync(pieceUrls(key).mesh)
      .then((gltf) => new Box3().setFromObject(gltf.scene))
    promise.catch(() => boxes.delete(key))
    boxes.set(key, promise)
  }
  return boxes.get(key).then((box) => box.clone())
}
