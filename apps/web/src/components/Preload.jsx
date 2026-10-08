import { useEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { TextureLoader } from 'three'

// Loads files before the table shows (docs/feature-rooms.md, "Loading"). It sits in the Canvas next to
// the scene, in the same Suspense boundary, so the scene mounts only when every file is in. R3F caches a
// load by the loader and the input, and the components use the same ones (useGLTF(url), useTexture(input)),
// so they get the files at once, also inside their own Suspense boundaries.
// files: { gltf: [url], textures: [url | [url]] }, see rooms/preload.js. Read only on mount.
export function Preload({ files }) {
  // Every load starts first, so the files load at the same time, not one after the other
  for (const url of files.gltf) useGLTF.preload(url)
  for (const input of files.textures) useLoader.preload(TextureLoader, input)
  // Each call suspends until its file is in. These are not React hooks, only cache reads.
  for (const url of files.gltf) useGLTF(url)
  for (const input of files.textures) useLoader(TextureLoader, input)
  return null
}

// Calls onReady once, when the content of its Suspense boundary commits. It sits after the scene in the
// Canvas, so that is when the scene and Preload have their files.
export function Ready({ onReady }) {
  useEffect(() => { onReady() }, [])
  return null
}
