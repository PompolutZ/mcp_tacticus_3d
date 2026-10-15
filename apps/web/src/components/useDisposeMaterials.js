import { useEffect } from 'react'

// Dispose the materials of the meshes in obj (also material lists) when obj changes or the component unmounts.
// For a material that the component makes itself. A texture is not disposed, it is shared (useTexture cache).
export function useDisposeMaterials(obj) {
  useEffect(
    () => () =>
      obj.traverse((child) => {
        if (child.isMesh) [child.material].flat().forEach((m) => m.dispose())
      }),
    [obj],
  )
}
