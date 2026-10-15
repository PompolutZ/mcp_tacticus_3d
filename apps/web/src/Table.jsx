import { useEffect, useRef, useState } from 'react'
import App from './App.jsx'
import { setReportContext } from './crash/reporter.js'
import { LoadingOverlay } from './rooms/LoadingOverlay.jsx'
import { useUser } from './auth/useUser.js'
import { buildOverride, delayFlag, dropFlag, relayFlag, schemaOverride } from './net/debugFlags.js'
import { SCHEMA } from './net/doc.js'
import { iceConfig } from './net/ice.js'
import { connectRoom } from './net/peer.js'
import { reportError } from './crash/errors.js'
import { getMessages, getTable, postMessage, putTable } from './rooms/serverStore.js'
import { watchServerTable } from './rooms/serverTable.js'
import { deleteDoc } from './rooms/store.js'
import { openTableSession } from './rooms/openTableSession.js'
import { openTableDoc, watchRoomRecord } from './rooms/tableDoc.js'

// What the session needs from the page and the server. The flags are read at each open.
const TABLE_DEPS = {
  openTableDoc,
  getTable,
  putTable,
  postMessage,
  getMessages,
  deleteDoc,
  watchRoomRecord,
  watchServerTable,
  connectRoom,
  createPeerConnection: (config) => new RTCPeerConnection(config),
  build: () => buildOverride() ?? import.meta.env.VITE_BUILD_ID,
  schema: () => schemaOverride() ?? SCHEMA,
  iceConfig: () => iceConfig({ dev: import.meta.env.DEV, relay: relayFlag() }),
  liveFlags: () => ({ drop: dropFlag(), delay: delayFlag() }),
  randomId: () => crypto.randomUUID(),
  reportError,
  document,
  window,
}

// One table: a room, or the Sandbox. Opens the Yjs document of the table, then mounts App with it. Root.jsx
// mounts a new Table for each room and the Sandbox. room: the room record (rooms/store.js) of a single player
// room, the room of rooms/roomPage.js (multiplayerRoom) for a multiplayer room, or null for the Sandbox.
// onExit(notice): opens the lobby, with a message when notice is set. See
// docs/features/peer-to-peer.md ("Yjs document", "Connect flow") and docs/features/rooms.md.
export default function Table({ room = null, onExit }) {
  const { user } = useUser()
  const userId = user?.id
  // { table, storageFailed } when the document is open, see openTableDoc
  const [opened, setOpened] = useState(null)
  // The text of the warning when the writer of a multiplayer room stopped, or null
  const [serverWarning, setServerWarning] = useState(null)
  // The connection to the other player, { state, peer, versionMismatch, schemaMismatch }, or null outside a multiplayer room
  const [connection, setConnection] = useState(null)
  // The open session (rooms/openTableSession.js), or null
  const sessionRef = useRef(null)
  // The latest onExit, for the effect below, which must not run again when Root passes a new function
  const exit = useRef(onExit)
  useEffect(() => {
    exit.current = onExit
  })

  // Error reports (crash/reporter.js) say which room and seat. A single player room stays local.
  const reportRoom = room?.multiplayer ? room.id : null
  const reportSide = room?.side ?? 'none'
  useEffect(() => {
    setReportContext(reportRoom ? { room: reportRoom, side: reportSide } : {})
    return () => setReportContext({})
  }, [reportRoom, reportSide])

  useEffect(() => {
    // React StrictMode runs this effect twice in dev. The first session closes before its document opens,
    // so it closes that document and changes nothing.
    const session = openTableSession({
      room,
      userId,
      deps: TABLE_DEPS,
      onOpen: setOpened,
      onServerWarning: setServerWarning,
      onConnection: setConnection,
      onExit: (notice) => exit.current(notice),
    })
    sessionRef.current = session
    return () => {
      session.close()
      sessionRef.current = null
    }
  }, [room, userId])

  // The lobby reads the room records when it renders, which is before this table unmounts. So the record
  // gets the last change of the table first. A multiplayer room writes to the server at once.
  function handleExit() {
    sessionRef.current?.flush()
    onExit()
  }

  if (!opened) return <LoadingOverlay ready={false} />
  return (
    <App
      key={opened.table.doc.guid}
      table={opened.table}
      room={room}
      storageFailed={opened.storageFailed}
      serverWarning={serverWarning}
      connection={connection && { ...connection, retry: () => sessionRef.current?.retry() }}
      userId={userId ?? null}
      ownership={opened.ownership}
      presence={opened.presence}
      live={opened.live}
      onExit={handleExit}
    />
  )
}
