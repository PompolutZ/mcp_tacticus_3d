import { useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector3 } from 'three'
import { BASE_DIAMETER } from '../characters/files.js'
import { poseOf } from '../rooms/table.js'
import { liveBody } from '../physics.js'
import { ndcFromClient, nearestHit } from '../drag/screenRay.js'

// The model registry of Scene: the maps from model id to body, object and lift, the Rapier world refs,
// and the lookups over them. No effect inside; Scene fills the maps through the children.
export function useModelRegistry({ models, characters }) {
  const { camera, gl, pointer } = useThree()
  // The maps below are keyed by model id: a character with a second form has two models (see
  // characters/models.js). The first model has the character's own id.
  // Model id → Rapier body. Tools read and move characters through it.
  const charBodies = useRef(new Map())
  // The Rapier world, set by WorldRef inside <Physics>. liveBody checks a body against it.
  const worldRef = useRef(null)
  const rapierRef = useRef(null)
  // The body of a model if it is still in the world, else undefined. For listeners, effects and peer data.
  // Only reads refs, so it is the same function on every render.
  const liveCharBody = useCallback((id) => {
    const body = charBodies.current.get(id)
    return liveBody(worldRef.current, body) ? body : undefined
  }, [])
  // Model id → 3D object. Tools find the character under the pointer with it.
  const charObjects = useRef(new Map())
  // Model id → its lift, { toggle(), down() }. See CharacterModel.jsx and liftPiece.
  const charLifts = useRef(new Map())
  // Character id → the tray's background plate. characterAt below hits this too, so a drop anywhere
  // on the tray finds the character (see CharacterTray.jsx).
  const trayObjects = useRef(new Map())
  // Terrain piece id → its visible mesh, for terrainAt
  const terrainObjects = useRef(new Map())
  const raycaster = useRef(new Raycaster())
  // Token id → 3D object, and token id → live center getter. The same purpose as charBodies and
  // charObjects, but a token has no Rapier body (see CrisisToken.jsx).
  const tokenObjects = useRef(new Map())
  const tokenCenters = useRef(new Map())
  const looseObjects = useRef(new Map())
  const looseCenters = useRef(new Map())

  // Body position and base radius of every model with a body, except the one with id `skip`
  function modelBases(skip) {
    const list = []
    for (const model of models) {
      if (model.id === skip) continue
      const body = liveCharBody(model.id)
      if (!body) continue
      const t = body.translation()
      list.push({
        id: model.id,
        x: t.x,
        y: t.y,
        z: t.z,
        radius: BASE_DIAMETER[model.base] / 2,
      })
    }
    return list
  }

  // Nearest character whose model (either one) or tray is under the client point (DOM pixels), or
  // null. Returns the character id. { models: false }: only the tray plates count (a crisis token is
  // held by the card only, "Hold and drop").
  function characterAt(clientX, clientY, { models: useModels = true } = {}) {
    raycaster.current.setFromCamera(ndcFromClient(gl.domElement, clientX, clientY), camera)
    return nearestHit(raycaster.current, [
      // A construct is not a drop target: a token dropped on it lands on whatever is under it, the table
      // or the mat (docs/features/character-trays.md, "Constructs")
      ...models
        .filter((model) => useModels && !model.construct)
        .map((model) => [model.character.id, charObjects.current.get(model.id)]),
      ...characters.map((ch) => [ch.id, trayObjects.current.get(ch.id)]),
    ])
  }

  // Id of the nearest terrain piece on the ray through ndc, or null. It reads refs and the camera only, so it is
  // the same function while the camera is (Terrain is memo).
  const terrainUnder = useCallback(
    (ndc) => {
      raycaster.current.setFromCamera(ndc, camera)
      return nearestHit(raycaster.current, terrainObjects.current)
    },
    [camera],
  )

  // Id of the nearest terrain piece under the pointer, locked or not, or null. A locked piece gets no
  // pointer events (see Terrain.jsx), so this casts its own ray from the last pointer position. With
  // the pointer off the canvas (over the HUD or a tray's controls), it is null.
  function terrainAt() {
    if (!gl.domElement.matches(':hover')) return null
    return terrainUnder(pointer)
  }

  // Live table position of a character's first model (Hold and drop, "Drop"): the Rapier body when there
  // is one, otherwise the 3D object's own position. Not the spawn position, so a character that moved
  // drops its token where it now stands. Returns null if neither is mounted yet.
  function modelPosition(id) {
    const body = liveCharBody(id)
    if (body) {
      const t = body.translation()
      return { x: t.x, z: t.z }
    }
    const object = charObjects.current.get(id)
    if (object) {
      const p = object.getWorldPosition(new Vector3())
      return { x: p.x, z: p.z }
    }
    return null
  }

  // The pose of a mounted model to store: its body position and rotation, or null. A lifted model (R) gives
  // the place under the lift, so it stands there when the table opens again.
  function restPose(id) {
    const body = liveCharBody(id)
    if (!body) return null
    return poseOf(charLifts.current.get(id)?.restPosition() ?? body.translation(), body.rotation())
  }

  return {
    charBodies,
    worldRef,
    rapierRef,
    charObjects,
    charLifts,
    trayObjects,
    terrainObjects,
    raycaster,
    tokenObjects,
    tokenCenters,
    looseObjects,
    looseCenters,
    liveCharBody,
    modelBases,
    characterAt,
    terrainAt,
    terrainUnder,
    modelPosition,
    restPose,
  }
}
