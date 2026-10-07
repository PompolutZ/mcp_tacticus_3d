import { useEffect, useMemo, useState } from 'react'
import App from './App.jsx'
import { Lobby } from './components/Lobby.jsx'
import { openRoom } from './rooms/store.js'
import { MAPS } from './terrain/maps.js'

// The page of the URL hash (docs/feature-rooms.md, "Pages"): none → Lobby, #room=<code> → Room,
// #sandbox → Sandbox. #room=<code> is the room link format of docs/feature-peer-to-peer.md.
function pageOf(hash) {
  const params = new URLSearchParams(hash.slice(1))
  if (params.has('room')) return { page: 'room', id: params.get('room') }
  if (params.has('sandbox')) return { page: 'sandbox' }
  return { page: 'lobby' }
}

// A room of this browser with a map that the app has, or null
function findRoom(id) {
  const room = openRoom(id)
  return room && MAPS[room.mapId] ? room : null
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
  const page = pageOf(hash)
  // Read from storage each time the room page opens, so it has the table of the last save
  const room = useMemo(() => page.page === 'room' ? findRoom(page.id) : null, [hash])

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

  // A room code that is not in this browser opens the lobby with a message
  useEffect(() => {
    if (page.page !== 'room' || room) return
    setNotice(`Room ${page.id} is not in this browser.`)
    go('', true)
  }, [hash])

  function go(next, replace = false) {
    navigate(next, replace)
    setHash(window.location.hash)
  }

  function open(next) {
    setNotice(null)
    go(next)
  }

  if (page.page === 'sandbox') return <App key="sandbox" onExit={() => go('')} />
  if (page.page === 'room') return room && <App key={room.id} room={room} onExit={() => go('')} />
  return <Lobby notice={notice} onOpenRoom={id => open(`room=${id}`)} onOpenSandbox={() => open('sandbox')} />
}
