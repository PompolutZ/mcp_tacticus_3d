// The bytes of the start table of a multiplayer room (docs/features/rooms.md, "Room"). The host's browser builds it. The terrain ids are fixed per map (mapTerrain), so a later fill of
// the map by another browser does not double the pieces (docs/features/rooms.md, "Room").
// It imports no module that reads import.meta.env, so node --test can load it.

import * as Y from 'yjs'
import { createTable, encodeTable, fillTable } from '../net/doc.js'
import { startTable } from './table.js'

// mapId null: a random room, the table has no map yet. rosters: { host, guest }, each { code } or null
export function startTableBytes(mapId, rosters) {
  const doc = new Y.Doc()
  fillTable(createTable(doc), { ...startTable(mapId), rosters })
  const bytes = encodeTable({ doc })
  doc.destroy()
  return bytes
}
