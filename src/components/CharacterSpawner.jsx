import { useState, useRef, useEffect } from 'react'
import { searchCharacters } from '../characters/roster.js'

export function CharacterSpawner({ onSpawn }) {
  const [query, setQuery] = useState('')
  const [player, setPlayer] = useState('blue')
  const [message, setMessage] = useState(null)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef()
  const timerRef = useRef()
  const results = query.length > 0 ? searchCharacters(query) : []

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  function showMessage(text) {
    clearTimeout(timerRef.current)
    setMessage(text)
    timerRef.current = setTimeout(() => setMessage(null), 3000)
  }

  function handleSelect(ch) {
    if (!ch.available) {
      showMessage(`${ch.name} doesn't have a 3D model in the app yet`)
      return
    }
    onSpawn({ ...ch, teamColor: player })
    setQuery('')
    setOpen(false)
    setMessage(null)
  }

  return (
    <div className="spawner" ref={wrapRef}>
      <div className="group">
        <span className="group-label">Spawn</span>
        <input
          type="text"
          className="chip spawner-input"
          placeholder="Name or MCT code"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setMessage(null) }}
          onFocus={() => query.length > 0 && setOpen(true)}
        />
        <button
          type="button"
          className={`chip${player === 'blue' ? ' chip--player-blue' : ''}`}
          onClick={() => setPlayer('blue')}
        >
          Blue
        </button>
        <button
          type="button"
          className={`chip${player === 'red' ? ' chip--player-red' : ''}`}
          onClick={() => setPlayer('red')}
        >
          Red
        </button>
      </div>
      {open && results.length > 0 && (
        <div className="spawner-dropdown">
          {results.slice(0, 20).map(ch => (
            <button
              key={ch.mctCode}
              type="button"
              className={`spawner-item${ch.available ? '' : ' spawner-item--unavailable'}`}
              onClick={() => handleSelect(ch)}
            >
              <span className="spawner-item-name">{ch.name}</span>
              <span className="spawner-item-code">{ch.mctCode}</span>
            </button>
          ))}
        </div>
      )}
      {message && <div className="spawner-message">{message}</div>}
    </div>
  )
}
