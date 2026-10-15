import { assetUrl } from '../assets/index.js'

// The files of a model (characters/models.js), as its component loads them: the GLB of a 3D model, or the
// front and back images of a standee, in this order. Scene passes them to the component, and
// rooms/preload.js loads the same before a table shows (docs/features/rooms.md, "Loading").
// Apart from files.js, because the migrate scripts load that in Node and assetUrl needs Vite.
export function modelUrls(model) {
  return model.figure === 'standee'
    ? { standee: [assetUrl(model.standeeFiles[0]), assetUrl(model.standeeFiles[1])] }
    : { gltf: assetUrl(model.file) }
}
