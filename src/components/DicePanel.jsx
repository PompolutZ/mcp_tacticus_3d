import { useEffect, useRef } from 'react'
import { SYMBOLS, SYMBOL_NAMES } from '../dice/faces.js'
import { assetUrl } from '../assets/index.js'

// All 6 counts at 0, used before the tray has reported its first state.
const EMPTY_SHELF = Object.fromEntries(SYMBOLS.map(s => [s, 0]))

function iconUrl(symbol) {
  return assetUrl(`dice/icons/${symbol}.webp`)
}

// One tray's HUD panel: the inset box (empty here, Phase 6 draws into it), the well count,
// Roll/Clear, +N Crits, the 6 face counts with their "Reroll one / Change one to" menu, and the
// history. trayKey: 'blue' | 'red', also used for the color accent and to look up the tray's
// actions. state: the tray's last onChange payload, or null before the tray has reported one.
// trayActionsRef: the Map ref owned by App (tray key -> actions); read at click time, so a panel
// rendered before the tray mounts still works once it does. insetBoxRef: a callback ref for the
// inset box element (App collects these in its own insetBoxes map, for Phase 6).
// openMenuSymbol: the symbol whose menu is open on this panel, or null. onMenuToggle/onMenuClose:
// lifted to App so Escape can close the menu before its other Escape behavior.
export function DicePanel({
  trayKey, state, trayActionsRef, insetBoxRef, openMenuSymbol, onMenuToggle, onMenuClose, className = '',
}) {
  const panelRef = useRef(null)

  // A click outside the panel closes the open menu, the same pattern as CharacterSpawner's dropdown.
  useEffect(() => {
    if (openMenuSymbol == null) return
    function handlePointerDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onMenuClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openMenuSymbol, onMenuClose])

  const { well = 0, shelf = EMPTY_SHELF, critsAvailable = 0, history = [] } = state ?? {}
  const shelfTotal = SYMBOLS.reduce((sum, s) => sum + shelf[s], 0)
  const hasDice = well + shelfTotal > 0

  // Calls a tray action through the ref map, at click time, so a stale closure never matters.
  function call(action, ...args) {
    trayActionsRef.current.get(trayKey)?.[action]?.(...args)
  }

  return (
    <div ref={panelRef} className={`dice-panel dice-panel--${trayKey} ${className}`}>
      <div ref={insetBoxRef} className="dice-panel-inset" style={{ visibility: hasDice ? 'visible' : 'hidden' }} />
      <div className="group">
        <button type="button" className="chip" onClick={() => call('remove')}>−</button>
        <span className="dice-panel-well">{well}</span>
        <button type="button" className="chip" onClick={() => call('add')}>+</button>
        <button type="button" className="chip" onClick={() => call('roll')}>Roll</button>
        <button type="button" className="chip" onClick={() => call('clear')}>Clear</button>
      </div>
      <div className="group">
        <button type="button" className="chip" disabled={critsAvailable === 0} onClick={() => call('addCrits')}>
          +{critsAvailable} Crits
        </button>
      </div>
      <div className="dice-panel-faces">
        {SYMBOLS.map(symbol => (
          <div key={symbol} className="dice-panel-face">
            <button
              type="button"
              className="chip dice-panel-face-btn"
              title={SYMBOL_NAMES[symbol]}
              onClick={() => onMenuToggle(symbol)}
            >
              <img src={iconUrl(symbol)} alt={SYMBOL_NAMES[symbol]} className="dice-panel-icon" />
              <span>{shelf[symbol]}</span>
            </button>
            {openMenuSymbol === symbol && (
              <div className="dice-panel-menu">
                <button
                  type="button"
                  className="chip"
                  onClick={() => { call('reroll', symbol); onMenuClose() }}
                >
                  Reroll one
                </button>
                <span className="group-label">Change one to</span>
                {SYMBOLS.filter(other => other !== symbol).map(other => (
                  <button
                    key={other}
                    type="button"
                    className="chip dice-panel-menu-item"
                    onClick={() => { call('change', symbol, other); onMenuClose() }}
                  >
                    <img src={iconUrl(other)} alt={SYMBOL_NAMES[other]} className="dice-panel-icon" />
                    {SYMBOL_NAMES[other]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="dice-panel-history">
        {history.map(entry => (
          <div key={entry.id} className="dice-panel-history-entry">{entry.text}</div>
        ))}
      </div>
    </div>
  )
}
