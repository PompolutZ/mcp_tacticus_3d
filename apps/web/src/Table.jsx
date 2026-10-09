import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import App from './App.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'
import { useUser } from './auth/useUser.js'
import { SCHEMA, createTable, fillTable, tableSchema } from './net/doc.js'
import { getTable, putTable } from './rooms/serverStore.js'
import { hasLocalChanges, watchServerTable } from './rooms/serverTable.js'
import { deleteDoc, multiplayerDocName, roomDocName } from './rooms/store.js'
import { startTable } from './rooms/table.js'
import { openTableDoc, watchRoomRecord } from './rooms/tableDoc.js'

// The map on the mat when the Sandbox starts, a key in MAPS
const START_MAP = 'vibranium-heist'

// The IndexedDB database of a table: null for the Sandbox
function docName(room, userId) {
  if (!room) return null
  return room.multiplayer ? multiplayerDocName(userId, room.id) : roomDocName(room.id)
}

// The lobby message when the server does not give the table of a multiplayer room
function loadError(code, err) {
  if (err.status === 404) return `Room ${code} not found.`
  if (err.status === 403) return `You have no seat in room ${code}.`
  return `Could not load room ${code}. Try again.`
}

// One table: a room, or the Sandbox. Opens the Yjs document of the table, then mounts App with it. Root.jsx
// mounts a new Table for each room and the Sandbox. room: the room record (rooms/store.js) of a single player
// room, the room of rooms/roomPage.js (multiplayerRoom) for a multiplayer room, or null for the Sandbox.
// onExit(notice): opens the lobby, with a message when notice is set. See
// docs/plans/implement-backend/05-yjs-state.md, decisions 12 to 16, and 07-multiplayer-rooms.md, decisions
// 14 and 16.
export default function Table({ room = null, onExit }) {
  const { user } = useUser()
  const userId = user?.id
  // The bytes of a game file that replaced the table (Load game), or null
  const [game, setGame] = useState(null)
  // { table, storageFailed } when the document is open, see openTableDoc
  const [opened, setOpened] = useState(null)
  // The text of the warning when the writer of a multiplayer room stopped, or null
  const [serverWarning, setServerWarning] = useState(null)
  // The watcher of the room record (watchRoomRecord), or null
  const record = useRef(null)
  // The writer of the table to the server (watchServerTable), or null
  const writer = useRef(null)
  // The latest onExit, for the effect below, which must not run again when Root passes a new function
  const exit = useRef(onExit)
  useEffect(() => {
    exit.current = onExit
  })

  useEffect(() => {
    // React StrictMode runs this effect twice in dev. The first run ends before its document opens, so
    // it closes that document and changes nothing.
    let cancelled = false
    let doc = null
    const name = docName(room, userId)
    const code = room?.id
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') writer.current?.flush({ hidden: true })
    }

    // Ends the watchers and the document. Safe to call twice.
    function close() {
      document.removeEventListener('visibilitychange', onVisibility)
      record.current?.stop()
      record.current = null
      writer.current?.stop()
      writer.current = null
      doc?.destroy()
      doc = null
    }

    openTableDoc(name, game).then(async (result) => {
      doc = result.doc
      if (cancelled) {
        close()
        return
      }
      let serverBytes = null
      if (room?.multiplayer) {
        try {
          serverBytes = await getTable(code)
        } catch (err) {
          if (cancelled) return
          close()
          // The server has no table for this player: the copy in this browser is of no use
          if (err.status === 403 || err.status === 404) deleteDoc(name)
          exit.current(loadError(code, err))
          return
        }
        if (cancelled) return
        Y.applyUpdate(doc, serverBytes, 'server')
      }
      const table = createTable(doc)
      // A new table, or one of an older layout: before the first release all data is test data (decision 11)
      if (tableSchema(table) !== SCHEMA) {
        const rosters = room?.rosters ?? { blue: null, red: null }
        fillTable(table, { ...startTable(room?.mapId ?? START_MAP), rosters })
      }
      if (room && !room.multiplayer) record.current = watchRoomRecord(room.id, table, game !== null)
      if (room?.multiplayer) {
        writer.current = watchServerTable({
          doc,
          put: (bytes, options) => putTable(code, bytes, options),
          // The host deleted the room (decision 15)
          onGone() {
            close()
            deleteDoc(name)
            exit.current(`The host deleted room ${code}.`)
          },
          onStop: (text) =>
            setServerWarning(`This table is no longer saved on the server: ${text}`),
          // This browser has changes that the server does not have, for example from a closed page
          changed: hasLocalChanges(doc, serverBytes),
        })
        writer.current.flush()
        document.addEventListener('visibilitychange', onVisibility)
      }
      setOpened({ table, storageFailed: result.storageFailed })
    })
    return () => {
      cancelled = true
      close()
    }
  }, [room, userId, game])

  // The lobby reads the room records when it renders, which is before this table unmounts. So the record
  // gets the last change of the table first. A multiplayer room writes to the server at once.
  function handleExit() {
    record.current?.flush()
    writer.current?.flush()
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
      serverWarning={serverWarning}
      onExit={handleExit}
      onLoadGame={handleLoadGame}
    />
  )
}
