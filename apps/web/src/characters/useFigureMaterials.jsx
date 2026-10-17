import { useEffect } from 'react'
import { Color } from 'three'
import { COLOR_HEX } from '../sideColors.js'
import { useSideColor } from '../table/useSideColors.jsx'

// Red glow of the figure while it shows the overlap mark. Added to the colors of the material, so the
// textures stay visible.
const OVERLAP_TINT = 0xaa1111

// Shadows on, and the base (the material defaultMat) in `hex`. The material is cloned, because the materials of a
// GLB are shared with the other models made from the same file. Also used by the models page.
export function styleFigure(scene, hex) {
  const color = new Color(hex)
  scene.traverse((obj) => {
    if (!obj.isMesh) return
    obj.castShadow = true
    obj.receiveShadow = true
    if (obj.material?.name === 'defaultMat') {
      obj.material = obj.material.clone()
      obj.material.color = color
    }
  })
}

// The looks of a figure: the base color of its side and the red tint of the overlap mark.
export function useFigureMaterials(scene, team, showOverlap) {
  // team is a side. The base has the color of that side (sideColors.js).
  const playerColor = useSideColor(team)
  useEffect(() => {
    styleFigure(scene, COLOR_HEX[playerColor] ?? team)
  }, [scene, team, playerColor])

  // Red tint while the overlap mark is on. Each mesh gets its own copy of the material, because the
  // materials of a GLB are shared with the other models made from the same file.
  useEffect(() => {
    if (!showOverlap) return undefined
    const saved = []
    scene.traverse((obj) => {
      if (!obj.isMesh) return
      const tint = (m) => {
        const copy = m.clone()
        if (copy.emissive) copy.emissive.set(OVERLAP_TINT)
        return copy
      }
      saved.push([obj, obj.material])
      obj.material = Array.isArray(obj.material) ? obj.material.map(tint) : tint(obj.material)
    })
    return () => {
      for (const [obj, material] of saved) {
        for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) m.dispose()
        obj.material = material
      }
    }
  }, [scene, showOverlap])
}
