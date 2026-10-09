import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import App from './App.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'
import { useUser } from './auth/useUser.js'
import { buildOverride, delayFlag, dropFlag, relayFlag } from './net/debugFlags.js'
import { SCHEMA, createTable, fillTable, tableSchema } from './net/doc.js'
import { iceConfig } from './net/ice.js'
import { createLiveHub } from './net/live.js'
import { createOwnership } from './net/ownership.js'
import { connectRoom } from './net/peer.js'
import { createSignaling } from './net/signaling.js'
import { syncOverChannel } from './net/syncChannel.js'
import { getMessages, getTable, postMessage, putTable } from './rooms/serverStore.js'
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
// 14 and 16, and 08-two-browsers.md, decisions 11, 12 and 20.
export default function Table({ room = null, onExit }) {
  const { user } = useUser()
  const userId = user?.id
  // { table, storageFailed } when the document is open, see openTableDoc
  const [opened, setOpened] = useState(null)
  // The text of the warning when the writer of a multiplayer room stopped, or null
  const [serverWarning, setServerWarning] = useState(null)
  // The connection to the other player, { state, peer, versionMismatch }, or null outside a multiplayer room
  const [connection, setConnection] = useState(null)
  // The retry() of the connection (net/peer.js), or null
  const link = useRef(null)
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

    // The page closes or reloads: tell the other player (decision 20)
    const onPageHide = () => link.current?.stop({ keepalive: true })
    // Yjs sync over the open channel, or null
    let sync = null
    // The awareness of a multiplayer room (the claims) and the ownership on it, or null
    let awareness = null
    let ownership = null
    // The live hub of a multiplayer room and the live channel attached to it, or null
    let live = null
    let liveChannel = null

    // Ends the watchers and the document. Safe to call twice.
    function close() {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      sync?.stop()
      sync = null
      if (liveChannel) live?.detach(liveChannel)
      liveChannel = null
      live = null
      ownership?.destroy()
      ownership = null
      awareness?.destroy()
      awareness = null
      link.current?.stop()
      link.current = null
      record.current?.stop()
      record.current = null
      writer.current?.stop()
      writer.current = null
      doc?.destroy()
      doc = null
    }

    openTableDoc(name).then(async (result) => {
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
      const role = room?.host === userId ? 'host' : 'guest'
      if (room?.multiplayer) {
        awareness = new Awareness(doc)
        awareness.setLocalState({ owns: [] })
        ownership = createOwnership({ awareness, role })
        // The flags act on the packets that this browser receives (plan 09, decision 16)
        live = createLiveHub({ drop: dropFlag(), delay: delayFlag() })
      }
      if (room && !room.multiplayer) record.current = watchRoomRecord(room.id, table)
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
        // Only a multiplayer room connects. A single player room and the Sandbox make no signaling call.
        const peerId = crypto.randomUUID()
        link.current = connectRoom({
          role,
          userId,
          peerId,
          build: buildOverride() ?? import.meta.env.VITE_BUILD_ID,
          signaling: createSignaling({ code, peerId, post: postMessage, get: getMessages }),
          createPeerConnection: (config) => new RTCPeerConnection(config),
          iceConfig: iceConfig({ dev: import.meta.env.DEV, relay: relayFlag() }),
          // The open sync channel is synced at once. The sync stops with the channel or the table. The live
          // channel goes to the hub, and its close or the close of the table detaches it.
          onChannels({ sync: channel, live: liveSide }) {
            sync?.stop()
            const mine = syncOverChannel(doc, channel, awareness)
            sync = mine
            channel.addEventListener('close', () => mine.stop())
            if (liveChannel) live.detach(liveChannel)
            liveChannel = liveSide
            live.attach(liveSide)
            liveSide.addEventListener('close', () => {
              live?.detach(liveSide)
              if (liveChannel === liveSide) liveChannel = null
            })
          },
          onState(next) {
            // Both browsers have the same document while connected, so only the host writes (decision 11)
            if (role === 'guest') writer.current?.pause(next.state === 'connected')
            // The host deleted the room (decision 12)
            if (next.state === 'gone') {
              close()
              deleteDoc(name)
              exit.current(`The host deleted room ${code}.`)
              return
            }
            setConnection(next)
          },
        })
        window.addEventListener('pagehide', onPageHide)
      }
      setOpened({
        table,
        storageFailed: result.storageFailed,
        // The local version in a single player room and the Sandbox
        ownership: ownership ?? createOwnership({}),
        // The live hub of a multiplayer room, null in a single player room and the Sandbox
        live,
      })
    })
    return () => {
      cancelled = true
      close()
    }
  }, [room, userId])

  // The lobby reads the room records when it renders, which is before this table unmounts. So the record
  // gets the last change of the table first. A multiplayer room writes to the server at once.
  function handleExit() {
    record.current?.flush()
    writer.current?.flush()
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
      connection={connection && { ...connection, retry: () => link.current?.retry() }}
      userId={userId ?? null}
      ownership={opened.ownership}
      live={opened.live}
      onExit={handleExit}
    />
  )
}
