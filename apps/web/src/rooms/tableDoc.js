// The Yjs document of a table: in IndexedDB for a room, in memory for the Sandbox. Also keeps the room record
// in step with the document. See docs/plans/implement-backend/05-yjs-state.md, decisions 12, 13 and 16.

import * as Y from 'yjs'
import { IndexeddbPersistence, clearDocument } from 'y-indexeddb'
import { saveRoomRecord } from './store.js'

// IndexedDB loads a table in far less time. A database that cannot open never answers, so this ends the wait.
const LOAD_TIMEOUT = 5000
// The room record is written at most this often (ms) while the table changes
const RECORD_INTERVAL = 2000

// A new document, with the content of a game file when there is one
function newDoc(game) {
  const doc = new Y.Doc()
  if (game) Y.applyUpdate(doc, game)
  return doc
}

const wait = (ms) => new Promise((resolve) => setTimeout(() => resolve(false), ms))

// Opens the document of a table. name: the IndexedDB database name (roomDocName, multiplayerDocName in
// rooms/store.js), or null for the Sandbox. game: the bytes of a game file that
// replaces the table (checked by readGame in net/doc.js), or null. Resolves to { doc, storageFailed }.
// storageFailed: the room could not use IndexedDB, so its table is in memory only.
export async function openTableDoc(name, game) {
  if (!name) return { doc: newDoc(game), storageFailed: false }
  try {
    // A Yjs update adds to a document and cannot replace it, so a loaded game starts a new database
    if (game) await clearDocument(name)
    const doc = newDoc(game)
    // The persistence first stores what the doc has (a loaded game), then loads the stored updates
    const persistence = new IndexeddbPersistence(name, doc)
    const synced = await Promise.race([persistence.whenSynced.then(() => true), wait(LOAD_TIMEOUT)])
    if (synced) return { doc, storageFailed: false }
    // Also ends the persistence, so a late load does not change the table in memory
    doc.destroy()
  } catch {
    // IndexedDB is turned off
  }
  return { doc: newDoc(game), storageFailed: true }
}

// Keeps the record of a room in step with its table: at most every RECORD_INTERVAL after a change of the
// table, when the page closes, and at the end. changed: the table has just changed (a loaded game), so
// updatedAt changes now. Returns { flush, stop }. flush(): writes a waiting change now. stop(): ends it.
export function watchRoomRecord(roomId, table, changed) {
  const save = (tableChanged) =>
    saveRoomRecord(
      roomId,
      { mapId: table.game.get('mapId'), rosters: table.rosters.read() },
      tableChanged,
    )
  let timer = null
  const flush = () => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
    save(true)
  }
  const onUpdate = () => {
    timer ??= setTimeout(flush, RECORD_INTERVAL)
  }
  save(changed)
  table.doc.on('update', onUpdate)
  window.addEventListener('pagehide', flush)
  return {
    flush,
    stop() {
      table.doc.off('update', onUpdate)
      window.removeEventListener('pagehide', flush)
      flush()
    },
  }
}
