// Writes the TTS Saved Object "Dice measure": a red block with scripts/tts-dice-measure.lua as its
// script. See scripts/README.md, "TTS dice measurement".
//
// TTS runs the script of a spawned object at once. So the block needs no Save & Play, no game
// reload and no own save, and it works in the Workshop mod too. Pasting the script into a block and
// pressing Save & Play did not work on 2026-10-01: the game reloaded without the block.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SCRIPT = path.resolve(import.meta.dirname, 'tts-dice-measure.lua')
const SAVED_OBJECTS = path.join(os.homedir(), 'Library/Tabletop Simulator/Saves/Saved Objects')
const NAME = 'Dice measure'

// The fields of a TTS block, copied from a red block in the mod save, with a new GUID, name,
// position and script. A file with these fields was spawned in TTS on 2026-10-01, and its script ran.
const block = {
  GUID: 'd1ce5a',
  Name: 'BlockSquare',
  Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 0, rotZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
  Nickname: NAME,
  Description: '',
  GMNotes: '',
  AltLookAngle: { x: 0, y: 0, z: 0 },
  ColorDiffuse: { r: 0.9264706, g: 0, b: 0 },
  LayoutGroupSortIndex: 0,
  Value: 0,
  Locked: false,
  Grid: true,
  Snap: true,
  IgnoreFoW: false,
  MeasureMovement: false,
  DragSelectable: true,
  Autoraise: true,
  Sticky: true,
  Tooltip: true,
  GridProjection: false,
  HideWhenFaceDown: false,
  Hands: false,
  LuaScript: fs.readFileSync(SCRIPT, 'utf8'),
  LuaScriptState: '',
  XmlUI: '',
}

// A Saved Object file has the same shape as a save file, with empty game fields.
const savedObject = {
  SaveName: '',
  Date: '',
  VersionNumber: '',
  GameMode: '',
  GameType: '',
  GameComplexity: '',
  Tags: [],
  Gravity: 0.5,
  PlayArea: 0.5,
  Table: '',
  Sky: '',
  Note: '',
  TabStates: {},
  LuaScript: '',
  LuaScriptState: '',
  XmlUI: '',
  ObjectStates: [block],
}

if (!fs.existsSync(SAVED_OBJECTS)) {
  console.error(`No TTS Saved Objects folder: ${SAVED_OBJECTS}`)
  process.exit(1)
}
const file = path.join(SAVED_OBJECTS, `${NAME}.json`)
fs.writeFileSync(file, JSON.stringify(savedObject, null, 2))
console.log(`Wrote ${file}`)
console.log(`In TTS: Objects > Saved Objects > ${NAME}`)
