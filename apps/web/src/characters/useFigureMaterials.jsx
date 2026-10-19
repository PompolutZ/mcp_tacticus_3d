import { useEffect } from 'react'
import { Color } from 'three'
import { COLOR_HEX } from '../sideColors.js'
import { useSideColor } from '../table/useSideColors.jsx'

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

// The looks of a figure: the base color of its side. The red tint of the overlap mark is done by useOutline.
export function useFigureMaterials(scene, team) {
  // team is a side. The base has the color of that side (sideColors.js).
  const playerColor = useSideColor(team)
  useEffect(() => {
    styleFigure(scene, COLOR_HEX[playerColor] ?? team)
  }, [scene, team, playerColor])
}
