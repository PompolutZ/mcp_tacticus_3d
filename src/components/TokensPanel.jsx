import { useMemo, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { characterToken } from '../tokens/files.js'
import { TOKENS } from '../tokens/tokens.js'

const GROUP_LABELS = { condition: 'Conditions', status: 'Status', character: 'Character', tactic: 'Tactic' }
const GROUPS = Object.keys(GROUP_LABELS)

// The HUD "Tokens" panel, opened from a toolbar button: every migrated token, in groups, with a
// search field. Same purpose as the TTS "Token Tray" (see docs/characters-hud.md, "Give tokens by
// drag and drop"): a player can give a token that is not in a tray's Give row (Phase 5), for
// example a token from a Team Tactic card. A pointerdown on a chip starts a drag, handled in App.jsx.
export function TokensPanel({ open, onDragStart }) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const byGroup = useMemo(() => {
    const found = q ? TOKENS.filter(t => t.name.toLowerCase().includes(q)) : TOKENS
    return GROUPS.map(group => ({ group, tokens: found.filter(t => t.group === group) }))
      .filter(g => g.tokens.length > 0)
  }, [q])

  if (!open) return null

  return (
    <div className="tokens-panel">
      <input
        type="text"
        className="chip tokens-panel-search"
        placeholder="Search tokens…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="tokens-panel-groups">
        {byGroup.map(({ group, tokens }) => (
          <div key={group} className="tokens-panel-group">
            <span className="group-label">{GROUP_LABELS[group]}</span>
            <div className="tokens-panel-chips">
              {tokens.map(t => (
                <button
                  key={t.key}
                  type="button"
                  className="token-chip"
                  title={t.description ? `${t.name}: ${t.description}` : t.name}
                  onPointerDown={e => onDragStart(e, t.key)}
                >
                  <img className="token-chip-icon" src={assetUrl(characterToken(t.key))} alt={t.name} draggable={false} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {byGroup.length === 0 && <div className="tokens-panel-empty">No tokens match "{search}"</div>}
      </div>
    </div>
  )
}
