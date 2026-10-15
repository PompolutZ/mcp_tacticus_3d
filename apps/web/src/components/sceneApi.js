// The calls App and its hooks make into Scene. App makes one ref, sceneApi = useRef(null), and passes
// it to Scene as apiRef. Scene sets apiRef.current = createSceneApi(parts) in an effect on every render,
// so the functions always see the latest characters and objects. Before Scene's first effect the ref
// holds null, so a caller writes sceneApi.current?.name(...), and an unknown result is undefined.
//
// The shape (exactly these keys):
//   characterAt(clientX, clientY, options) -> character id or null. 3D only: the model or the tray plate.
//   modelPosition(characterId) -> { x, z } or null. The live table position of a character.
//   returnModels(characterId): the models of that character go back to their places on the tray.
//   turnPiece(direction): Q / E turn of the dragged piece, else the one under the pointer.
//   liftPiece(): R lifts the character under the pointer or puts it back down.
//   floorPiece() -> HUD message or null. R during a model drag switches the floor.
//   terrainAt() -> terrain id or null. The terrain piece under the pointer, locked or not.
//   planFall(terrainId) -> { terrain }. What falls when that terrain piece is deleted.
//   modelDragId() -> model id or null. The own model that is dragged now.
//   addDice(side, count): clears the own dice tray of that side, then adds that many dice.
//   pointAtPointer(), pointAtCenter() -> { x, y, z } or null (undefined with no tool point yet).
//     Table points for a free tool spawn and the ping (ToolPoint.jsx).
//
// parts: the functions characterAt, modelPosition, returnModels, turnPiece, liftPiece, floorPiece,
// terrainAt, planFall, and the refs modelDrag (current: model id or null), addDice (current: side ->
// add function) and toolPoint (current: { atPointer(), atCenter() } or null). The wrappers read the
// refs at the call. A missing part throws here, so a typo does not fail silently later.

const FUNCTION_PARTS = [
  'characterAt',
  'modelPosition',
  'returnModels',
  'turnPiece',
  'liftPiece',
  'floorPiece',
  'terrainAt',
  'planFall',
]
const REF_PARTS = ['modelDrag', 'addDice', 'toolPoint']

export const SCENE_API_KEYS = [
  'characterAt',
  'modelPosition',
  'returnModels',
  'turnPiece',
  'liftPiece',
  'floorPiece',
  'terrainAt',
  'planFall',
  'modelDragId',
  'addDice',
  'pointAtPointer',
  'pointAtCenter',
]

export function createSceneApi(parts) {
  for (const name of FUNCTION_PARTS) {
    if (typeof parts?.[name] !== 'function') throw new Error(`sceneApi: part "${name}" is missing`)
  }
  for (const name of REF_PARTS) {
    if (!parts[name] || !('current' in parts[name])) {
      throw new Error(`sceneApi: ref part "${name}" is missing`)
    }
  }
  return {
    characterAt: (clientX, clientY, options) => parts.characterAt(clientX, clientY, options),
    modelPosition: (characterId) => parts.modelPosition(characterId),
    returnModels: (characterId) => parts.returnModels(characterId),
    turnPiece: (direction) => parts.turnPiece(direction),
    liftPiece: () => parts.liftPiece(),
    floorPiece: () => parts.floorPiece(),
    terrainAt: () => parts.terrainAt(),
    planFall: (terrainId) => parts.planFall(terrainId),
    modelDragId: () => parts.modelDrag.current,
    addDice: (side, count) => parts.addDice.current[side]?.(count),
    pointAtPointer: () => parts.toolPoint.current?.atPointer(),
    pointAtCenter: () => parts.toolPoint.current?.atCenter(),
  }
}
