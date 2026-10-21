import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { createTable, fillTable, migrate, openAction, tableSchema } from '../net/doc.js'
import { tableFingerprint } from '../net/fingerprint.js'
import { createLiveHub } from '../net/live.js'
import { createOwnership } from '../net/ownership.js'
import { createPresence } from '../net/presence.js'
import { createSignaling } from '../net/signaling.js'
import { syncOverChannel } from '../net/syncChannel.js'
import { sumTraffic, trafficLine } from '../net/traffic.js'
import { hasLocalChanges } from './serverTable.js'
import { multiplayerDocName, roomDocName } from './store.js'
import { CUSTOM_MAP_ID, fillMap, startTable } from './table.js'

// Traffic: read every 60 s, logged every 10 min (docs/features/peer-to-peer.md, "Traffic per game")
const TRAFFIC_READ_MS = 60_000
const TRAFFIC_LOG_MS = 10 * 60_000
// The table fingerprint is logged after this long with no change (docs/features/peer-to-peer.md, "Local testing")
const FINGERPRINT_QUIET_MS = 2000

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

// The session of one open table: opens the document, then the watchers and the connection of the room.
// Table.jsx opens one in an effect and closes it in the cleanup. See docs/features/rooms.md, "Loading",
// and docs/features/peer-to-peer.md.
// room: as for Table (null for the Sandbox). userId: the user, or undefined.
// deps: what does not load in Node or reads the page, as functions or modules:
//   openTableDoc, getTable, putTable, postMessage, getMessages, deleteDoc, watchRoomRecord,
//   watchServerTable, connectRoom, createPeerConnection(config), reportError(source, error),
//   build(), schema(), iceConfig(), liveFlags() -> { drop, delay } (read at each open),
//   randomId(), document, window.
// onOpen({ table, storageFailed, ownership, presence, live }): the table is ready.
// onServerWarning(text): the writer of a multiplayer room stopped.
// onConnection(state): the connection to the other player changed.
// onExit(notice): the table cannot open or the room is gone: go to the lobby with this text.
// Returns { close(), flush(), retry() }. close() ends everything, also before the document opens.
// flush(): writes the waiting room record and table, and logs the traffic line.
export function openTableSession({
  room,
  userId,
  deps,
  onOpen,
  onServerWarning,
  onConnection,
  onExit,
}) {
  const { document, window } = deps
  // close() was called: the open chain stops and gives nothing
  let cancelled = false
  let doc = null
  const name = docName(room, userId)
  const code = room?.id
  // The retry() of the connection (net/peer.js), the watcher of the room record and the writer of the
  // table to the server, or null
  let link = null
  let record = null
  let writer = null
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') writer?.flush({ hidden: true })
  }

  // The page closes or reloads: tell the other player
  const onPageHide = () => link?.stop({ keepalive: true })
  // Yjs sync over the open channel, or null
  let sync = null
  // The awareness of a multiplayer room (the claims) and the ownership on it, or null
  let awareness = null
  let ownership = null
  // What the other player looks at (selection, tools, range mark) on the same awareness, or null
  let presence = null
  // The live hub of a multiplayer room and the live channel attached to it, or null
  let live = null
  let liveChannel = null

  // Traffic of this open table: the ended connections { sent, received, ms }, and the current one
  // { openedAt, last, readTimer, logTimer }. last is the latest read of traffic(), or null.
  const ended = []
  let current = null

  // The numbers of the current connection, from the last read
  function snapshot() {
    return {
      sent: current.last?.sent ?? 0,
      received: current.last?.received ?? 0,
      relayed: current.last?.relayed ?? false,
      ms: Date.now() - current.openedAt,
    }
  }

  // A closing page cannot wait for getStats(), so a line uses the last read value
  function logTraffic() {
    if (!current) return
    const connection = snapshot()
    console.info(trafficLine(connection, sumTraffic([...ended, connection])))
  }

  function startTraffic() {
    if (current) return
    const mine = { openedAt: Date.now(), last: null, readTimer: null, logTimer: null }
    current = mine
    mine.readTimer = setInterval(async () => {
      const read = await link?.traffic()
      if (read && current === mine) mine.last = read
    }, TRAFFIC_READ_MS)
    mine.logTimer = setInterval(logTraffic, TRAFFIC_LOG_MS)
  }

  // The connection ended: log it, and add it to the sum of the table. quiet: no line (the table closes).
  function endTraffic(quiet) {
    if (!current) return
    if (!quiet) logTraffic()
    const connection = snapshot()
    clearInterval(current.readTimer)
    clearInterval(current.logTimer)
    ended.push(connection)
    current = null
  }

  // Logs the table fingerprint once per connection, when the document had no change for 2 s after the
  // sync channel opened (docs/features/peer-to-peer.md, "Local testing"). A change inside the 2 s starts the 2 s again.
  let fingerprintTimer = null
  function onFingerprintUpdate() {
    clearTimeout(fingerprintTimer)
    fingerprintTimer = setTimeout(logFingerprint, FINGERPRINT_QUIET_MS)
  }
  function logFingerprint() {
    stopFingerprint()
    console.info(`table fingerprint ${tableFingerprint(doc)}`)
  }
  function startFingerprint() {
    stopFingerprint()
    doc.on('update', onFingerprintUpdate)
    onFingerprintUpdate()
  }
  function stopFingerprint() {
    clearTimeout(fingerprintTimer)
    fingerprintTimer = null
    doc?.off('update', onFingerprintUpdate)
  }

  // Ends the watchers and the document. Safe to call twice.
  function shutdown() {
    endTraffic(true)
    stopFingerprint()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    sync?.stop()
    sync = null
    if (liveChannel) live?.detach(liveChannel)
    liveChannel = null
    live = null
    ownership?.destroy()
    ownership = null
    presence?.destroy()
    presence = null
    awareness?.destroy()
    awareness = null
    link?.stop()
    link = null
    record?.stop()
    record = null
    writer?.stop()
    writer = null
    doc?.destroy()
    doc = null
  }

  // The host deleted the room (docs/features/peer-to-peer.md, "Connect flow"): the local copy is of no use
  function roomGone() {
    shutdown()
    deps.deleteDoc(name)
    onExit(`The host deleted room ${code}.`)
  }

  deps
    .openTableDoc(name)
    .then(async (result) => {
      doc = result.doc
      if (cancelled) {
        shutdown()
        return
      }
      let serverBytes = null
      if (room?.multiplayer) {
        try {
          serverBytes = await deps.getTable(code)
        } catch (err) {
          if (cancelled) return
          shutdown()
          // The server has no table for this player: the copy in this browser is of no use
          if (err.status === 403 || err.status === 404) deps.deleteDoc(name)
          onExit(loadError(code, err))
          return
        }
        if (cancelled) return
        Y.applyUpdate(doc, serverBytes, 'server')
      }
      const table = createTable(doc)
      // An empty table gets the start table. An older one is migrated; with no step it gets the start
      // table too (before the first release all data is test data). A newer one stays as it is.
      const schema = tableSchema(table)
      const action = openAction(schema)
      if (action === 'newer') {
        shutdown()
        onExit('This table was saved by a newer version of the app. Reload the page to update.')
        return
      }
      if (action === 'fill' || (action === 'migrate' && !migrate(table, schema))) {
        // The room record of a multiplayer room has no copy of the board (only the server table has it), so a
        // fill there would give a table with no mat and no terrain (docs/features/map-builder.md, "Board in a new room")
        if (room?.mapId === CUSTOM_MAP_ID && !room.board) {
          shutdown()
          onExit('The board of this room can not be rebuilt.')
          return
        }
        const rosters = room?.rosters ?? { host: null, guest: null }
        fillTable(table, { ...startTable(room?.mapId ?? START_MAP, room?.board), rosters })
      }
      // A random room: the map comes from the room (the guest joined). A table that already has one stays.
      if (room?.multiplayer) fillMap(table, room.mapId)
      const role = room?.host === userId ? 'host' : 'guest'
      if (room?.multiplayer) {
        awareness = new Awareness(doc)
        awareness.setLocalState({ owns: [] })
        ownership = createOwnership({ awareness, role })
        presence = createPresence({ awareness })
        // The flags act on the packets that this browser receives ("Debug flags")
        const { drop, delay } = deps.liveFlags()
        live = createLiveHub({ drop, delay })
      }
      if (room && !room.multiplayer) record = deps.watchRoomRecord(room.id, table)
      if (room?.multiplayer) {
        writer = deps.watchServerTable({
          doc,
          put: (bytes, options) => deps.putTable(code, bytes, options),
          onGone: roomGone,
          onStop: (text) => onServerWarning(`This table is no longer saved on the server: ${text}`),
          // This browser has changes that the server does not have, for example from a closed page
          changed: hasLocalChanges(doc, serverBytes),
        })
        writer.flush()
        document.addEventListener('visibilitychange', onVisibility)
        // Only a multiplayer room connects. A single player room and the Sandbox make no signaling call.
        const peerId = deps.randomId()
        link = deps.connectRoom({
          role,
          userId,
          peerId,
          build: deps.build(),
          schema: deps.schema(),
          signaling: createSignaling({
            code,
            peerId,
            post: deps.postMessage,
            get: deps.getMessages,
          }),
          createPeerConnection: deps.createPeerConnection,
          iceConfig: deps.iceConfig(),
          // The open sync channel is synced at once. The live channel goes to the hub. A traffic count is one
          // connection. onChannelsEnd ends all three, also when the connection closes with no close event
          // ("Connect flow").
          onChannels({ sync: channel, live: liveSide }) {
            startTraffic()
            startFingerprint()
            sync = syncOverChannel(doc, channel, awareness)
            liveChannel = liveSide
            live.attach(liveSide)
          },
          onChannelsEnd() {
            endTraffic(false)
            stopFingerprint()
            sync?.stop()
            sync = null
            if (liveChannel) live?.detach(liveChannel)
            liveChannel = null
          },
          onState(next) {
            // Both browsers have the same document while connected, so only the host writes (docs/features/auth.md, "Table on the server")
            if (role === 'guest') writer?.pause(next.state === 'connected')
            if (next.state === 'gone') {
              roomGone()
              return
            }
            onConnection(next)
          },
        })
        window.addEventListener('pagehide', onPageHide)
      }
      onOpen({
        table,
        storageFailed: result.storageFailed,
        // The local version in a single player room and the Sandbox
        ownership: ownership ?? createOwnership({}),
        presence: presence ?? createPresence({}),
        // The live hub of a multiplayer room, null in a single player room and the Sandbox
        live,
      })
    })
    .catch((err) => {
      if (cancelled) return
      // Close what the open made, report it as the unhandled rejection did, and leave
      shutdown()
      deps.reportError('promise', err)
      onExit('Could not open the table. Try again.')
    })

  return {
    close() {
      cancelled = true
      shutdown()
    },
    flush() {
      record?.flush()
      writer?.flush()
      logTraffic()
    },
    retry() {
      link?.retry()
    },
  }
}
