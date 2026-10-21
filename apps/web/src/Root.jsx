import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Lobby } from './rooms/Lobby.jsx'
import { JoinRoom } from './rooms/JoinRoom.jsx'
import { startSession } from './auth/session.js'
import { useUser } from './auth/useUser.js'
import { getRoom } from './rooms/serverStore.js'
import { multiplayerRoom, roomPage } from './rooms/roomPage.js'
import { openRoom } from './rooms/store.js'
import { isPlayableMap } from './rooms/table.js'
import { LoadingOverlay } from './rooms/LoadingOverlay.jsx'

// The table page (three.js, Rapier, models) is its own chunk. The prefetch in Root starts it once the lobby
// shows (docs/features/rooms.md, "Loading").
const loadTable = () => import('./Table.jsx')
const Table = lazy(loadTable)

// Dev-only page of all Team Tactic faces (#tactic-faces). import.meta.env.DEV is false in `vite build`, so the
// build leaves out the page and its chunk.
const TacticFaces = import.meta.env.DEV ? lazy(() => import('./debug/TacticFaces.jsx')) : null

// Dev-only models page (#models), left out of the build the same way
const ModelsPage = import.meta.env.DEV ? lazy(() => import('./debug/ModelsPage.jsx')) : null

// The page of the URL hash (docs/features/rooms.md, "Pages"): none → Lobby, #room=<code> → Room,
// #sandbox → Sandbox. #room=<code> is the room link format of docs/features/peer-to-peer.md.
function pageOf(hash) {
  const params = new URLSearchParams(hash.slice(1))
  if (params.has('room')) return { page: 'room', id: params.get('room') }
  if (params.has('sandbox')) return { page: 'sandbox' }
  if (import.meta.env.DEV && params.has('tactic-faces')) return { page: 'tactic-faces' }
  if (import.meta.env.DEV && params.has('models')) return { page: 'models' }
  return { page: 'lobby' }
}

// A room of this browser with a map that the app has, or null
function findRoom(id) {
  const room = openRoom(id)
  return room && isPlayableMap(room.mapId) ? room : null
}

// Opens the page of hash ('' is the lobby). replace: no new entry in the browser history.
function navigate(hash, replace = false) {
  const url = hash ? `#${hash}` : window.location.pathname + window.location.search
  if (replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
}

export default function Root() {
  const [hash, setHash] = useState(window.location.hash)
  // A message for the lobby, for example for a room link that is not in this browser
  const [notice, setNotice] = useState(null)
  // The answer of GET /rooms/{code} for the room page: { code, room } with the shape of roomPage's room
  // argument, or null. It is dropped when the room page closes, so each visit asks again.
  const [fetched, setFetched] = useState(null)
  const session = useUser()
  const userId = session.user?.id
  const page = pageOf(hash)
  // Read from storage each time the room page opens, so it has the map and rosters of the last save
  const singleRoom = useMemo(
    () => (page.page === 'room' ? findRoom(page.id) : null),
    [page.page, page.id],
  )
  // Which page the room link opens (docs/features/rooms.md, "Pages"). It is found again when the user changes.
  const route =
    page.page === 'room'
      ? roomPage({
          code: page.id,
          singleRoom,
          authOn: session.status !== 'off',
          session,
          room: fetched?.code === page.id ? fetched.room : undefined,
        })
      : null
  const apiRoom = route?.page === 'multiplayer' || route?.page === 'join' ? fetched.room : null
  // The same object until the room or the user changes, so Table does not open again
  const tableRoom = useMemo(
    () => (route?.page === 'multiplayer' ? multiplayerRoom(apiRoom, userId) : null),
    [route?.page, apiRoom, userId],
  )

  // Starts the table chunk while the player is in the lobby
  useEffect(() => {
    loadTable()
  }, [])

  // The back and forward buttons, and a hash typed into the address bar
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('popstate', onChange)
    window.addEventListener('hashchange', onChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('hashchange', onChange)
    }
  }, [])

  // A room link that cannot open, for example a code that is not in this browser, opens the lobby with a
  // message
  useEffect(() => {
    if (route?.page !== 'lobby') return
    setNotice(route.notice)
    go('', true)
  }, [hash, route?.page, route?.notice])

  // The room of a multiplayer link (the lobby also opens its rooms this way)
  useEffect(() => {
    if (route?.page !== 'fetch') return
    const code = page.id
    let cancelled = false
    getRoom(code)
      .then((room) => !cancelled && setFetched({ code, room }))
      .catch((err) => {
        if (cancelled) return
        setFetched({ code, room: err.status === 404 ? { notFound: true } : { failed: true } })
      })
    return () => {
      cancelled = true
    }
  }, [route?.page, page.id])

  // Leaving the room page drops the answer
  useEffect(() => {
    if (page.page !== 'room') setFetched(null)
  }, [page.page])

  // Once per page load (startSession keeps its promise). A login error shows in the lobby. After a login,
  // the page that the player left opens.
  useEffect(() => {
    startSession().then(({ returnHash, error }) => {
      if (error) setNotice(error)
      if (returnHash) go(returnHash, true)
    })
  }, [])

  function go(next, replace = false) {
    navigate(next, replace)
    setHash(window.location.hash)
  }

  function open(next) {
    setNotice(null)
    go(next)
  }

  // The lobby, with a message when a table could not open or the host deleted the room
  function handleExit(text) {
    if (text) setNotice(text)
    go('')
  }

  if (page.page === 'tactic-faces') {
    return (
      <Suspense fallback={null}>
        <TacticFaces />
      </Suspense>
    )
  }
  if (page.page === 'models') {
    return (
      <Suspense fallback={null}>
        <ModelsPage />
      </Suspense>
    )
  }
  if (page.page === 'sandbox')
    return (
      <Suspense fallback={<LoadingOverlay />}>
        <Table key="sandbox" onExit={handleExit} />
      </Suspense>
    )
  if (page.page === 'room') {
    if (route.page === 'single')
      return (
        <Suspense fallback={<LoadingOverlay />}>
          <Table key={singleRoom.id} room={singleRoom} onExit={handleExit} />
        </Suspense>
      )
    if (route.page === 'multiplayer')
      return (
        <Suspense fallback={<LoadingOverlay />}>
          <Table key={tableRoom.id} room={tableRoom} onExit={handleExit} />
        </Suspense>
      )
    if (route.page === 'join')
      return (
        <JoinRoom
          key={apiRoom.code}
          room={apiRoom}
          onJoined={(room) => setFetched({ code: room.code, room })}
          onExit={() => go('')}
        />
      )
    // wait, fetch, or the lobby while its message opens
    return <LoadingOverlay />
  }
  return (
    <Lobby
      notice={notice}
      onOpenRoom={(id) => open(`room=${id}`)}
      onOpenSandbox={() => open('sandbox')}
    />
  )
}
