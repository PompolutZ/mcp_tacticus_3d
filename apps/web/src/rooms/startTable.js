// The bytes of the start table of a multiplayer room (docs/plans/implement-backend/07-multiplayer-rooms.md,
// decision 1). Only the host's browser builds it, because mapTerrain gives each piece a random id.
// It imports no module that reads import.meta.env, so node --test can load it.

import * as Y from 'yjs'
import { createTable, encodeTable, fillTable } from '../net/doc.js'
import { startTable } from './table.js'

// rosters: { blue, red }, each { code } or null
export function startTableBytes(mapId, rosters) {
  const doc = new Y.Doc()
  fillTable(createTable(doc), { ...startTable(mapId), rosters })
  const bytes = encodeTable({ doc })
  doc.destroy()
  return bytes
}
