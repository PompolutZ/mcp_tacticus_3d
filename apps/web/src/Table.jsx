import { useEffect, useRef, useState } from 'react'
import App from './App.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'
import { SCHEMA, createTable, fillTable, tableSchema } from './net/doc.js'
import { startTable } from './rooms/table.js'
import { openTableDoc, watchRoomRecord } from './rooms/tableDoc.js'

// The map on the mat when the Sandbox starts, a key in MAPS
const START_MAP = 'vibranium-heist'

// One table: a room, or the Sandbox. Opens the Yjs document of the table, then mounts App with it. Root.jsx
// mounts a new Table for each room and the Sandbox. room: the room record (rooms/store.js), or null for the
// Sandbox. onExit(): opens the lobby. See docs/plans/implement-backend/05-yjs-state.md, decisions 12 to 16.
export default function Table({ room = null, onExit }) {
  // The bytes of a game file that replaced the table (Load game), or null
  const [game, setGame] = useState(null)
  // { table, storageFailed } when the document is open, see openTableDoc
  const [opened, setOpened] = useState(null)
  // The watcher of the room record (watchRoomRecord), or null
  const record = useRef(null)

  useEffect(() => {
    // React StrictMode runs this effect twice in dev. The first run ends before its document opens, so
    // it closes that document and changes nothing.
    let cancelled = false
    let doc = null
    openTableDoc(room?.id ?? null, game).then((result) => {
      doc = result.doc
      if (cancelled) {
        doc.destroy()
        return
      }
      const table = createTable(doc)
      // A new table, or one of an older layout: before the first release all data is test data (decision 11)
      if (tableSchema(table) !== SCHEMA) {
        const rosters = room?.rosters ?? { blue: null, red: null }
        fillTable(table, { ...startTable(room?.mapId ?? START_MAP), rosters })
      }
      if (room) record.current = watchRoomRecord(room.id, table, game !== null)
      setOpened({ table, storageFailed: result.storageFailed })
    })
    return () => {
      cancelled = true
      record.current?.stop()
      record.current = null
      doc?.destroy()
    }
  }, [room, game])

  // The lobby reads the room records when it renders, which is before this table unmounts. So the record
  // gets the last change of the table first.
  function handleExit() {
    record.current?.flush()
    onExit()
  }

  // Load game (App.jsx, handleLoadGame): App unmounts, and the table opens again with the game
  function handleLoadGame(bytes) {
    setOpened(null)
    setGame(bytes)
  }

  if (!opened) return <LoadingOverlay ready={false} />
  return (
    <App
      key={opened.table.doc.guid}
      table={opened.table}
      room={room}
      storageFailed={opened.storageFailed}
      onExit={handleExit}
      onLoadGame={handleLoadGame}
    />
  )
}
