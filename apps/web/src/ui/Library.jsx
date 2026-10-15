import { useMemo, useState } from 'react'
import { useHudMessage } from './useHudMessage.js'
import { assetUrl } from '../assets/index.js'
import { COLOR_NAME, useSideColors } from '../sideColors.js'
import { useTableActions } from '../table/actions.js'
import { TEAMS } from '../setup/setup.js'
import { libraryTeam } from './libraryTeam.js'
import { CHARACTERS } from '../characters/characters.js'
import { CharacterPortrait } from '../characters/CharacterPortrait.jsx'
import { TACTICS } from '../tactics/cards.js'
import { tacticCardBack } from '../tactics/files.js'
import { characterToken } from '../tokens/files.js'
import { TOKENS } from '../tokens/tokens.js'
import { TOKEN_GROUPS } from '../tokens/groups.js'

const TABS = [
  { tab: 'all', label: 'All' },
  { tab: 'characters', label: 'Characters' },
  { tab: 'tactics', label: 'Tactics' },
  { tab: 'tokens', label: 'Tokens' },
]
const TOKEN_MODES = [
  {
    mode: 'single',
    label: 'Single',
    title: 'A drag gives one token to a character, or puts one on the table',
  },
  {
    mode: 'pile',
    label: 'Pile',
    title: 'A drag puts a pile on the table. The pile never runs out.',
  },
]
// The All tab shows this many characters and tactic cards. "More" opens their own tab with all of them.
const ALL_TAB_LIMIT = { characters: 8, tactics: 6 }

// Characters with a 3D model first, then by name (CHARACTERS is sorted by name)
const LIBRARY_ROWS = [
  ...CHARACTERS.filter((ch) => ch.available),
  ...CHARACTERS.filter((ch) => !ch.available),
]

// The Library HUD panel, opened from a toolbar button: characters, Team Tactic cards and tokens, with
// one search field. See docs/features/library.md. The panel only hides when it is closed, so its
// search, tab, player and token mode stay.
// characters: the characters on the table (App state). The ones of the chosen player show green.
// seat: { multiplayer, ownSide, mySide } (rooms/seat.js). A multiplayer room adds for the own side only, with no
// "For" choice; a seat without a side adds nothing (libraryTeam.js).
// A click on a character with a 3D model calls the table action characters.spawn(ch) (table/actions.js); ch has
// team set to the chosen player.
// onSpawnTactic(key, team): a click on a tactic card. onGemOpen(code): a click on an Infinity Gem opens its card.
// onTokenDragStart(e, key, mode): a pointerdown on a token chip starts a drag in drag/useTokenDrag.js. mode:
// 'single' | 'pile'.
export function Library({ open, characters, seat, onSpawnTactic, onGemOpen, onTokenDragStart }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const colors = useSideColors()
  const { spawn: spawnCharacter } = useTableActions().characters
  const [chosen, setChosen] = useState('host')
  const team = libraryTeam(seat, chosen)
  const noSide = team === null
  const noSideReason = 'You have no side at this table'
  const [tokenMode, setTokenMode] = useState('single')
  const { hudMessage: message, showHudMessage: showMessage } = useHudMessage()

  const q = query.trim().toLowerCase()
  const found = useMemo(
    () => ({
      characters: q
        ? LIBRARY_ROWS.filter((ch) => ch.name.toLowerCase().includes(q) || ch.mctCode.startsWith(q))
        : LIBRARY_ROWS,
      tactics: q
        ? TACTICS.filter((card) => card.name.toLowerCase().includes(q) || card.id.startsWith(q))
        : TACTICS,
      tokens: q ? TOKENS.filter((t) => t.name.toLowerCase().includes(q)) : TOKENS,
    }),
    [q],
  )
  // Slugs of the chosen player's characters on the table. The spawn action blocks a second copy (characters/actions.js).
  const spawned = useMemo(
    () => new Set(characters.filter((c) => team && c.team === team).map((c) => c.key)),
    [characters, team],
  )

  if (!open) return null

  // A gem is not placed: a click opens its card. It goes onto a character from the roster.
  function handleTactic(card) {
    if (card.gem) {
      onGemOpen?.(card.id)
      return
    }
    if (noSide) return
    onSpawnTactic(card.key, team)
  }

  function handleCharacter(ch) {
    if (!ch.available) {
      showMessage(`${ch.name} doesn't have a 3D model in the app yet`)
      return
    }
    if (noSide) return
    spawnCharacter({ ...ch, team: team })
  }

  // In the All tab, a section shows its first items and a "More" button that opens its own tab
  function shown(kind) {
    const items = found[kind]
    return tab === 'all' && ALL_TAB_LIMIT[kind] ? items.slice(0, ALL_TAB_LIMIT[kind]) : items
  }

  // controls: optional elements on the right of the header
  function sectionHeader(kind, label, controls) {
    const hidden = found[kind].length - shown(kind).length
    return (
      <div className="library-section-header">
        <span className="group-label">{label}</span>
        {controls}
        {hidden > 0 && (
          <button type="button" className="library-more" onClick={() => setTab(kind)}>
            More ({hidden})
          </button>
        )}
      </div>
    )
  }

  const showKind = (kind) => (tab === 'all' || tab === kind) && found[kind].length > 0
  const nothing = ['characters', 'tactics', 'tokens'].every((kind) => !showKind(kind))

  return (
    <div className="library">
      <input
        type="text"
        className="chip library-search"
        placeholder="Search name or MCT code"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="library-row">
        {TABS.map((t) => (
          <button
            key={t.tab}
            type="button"
            className={`chip${tab === t.tab ? ' chip--active' : ''}`}
            onClick={() => setTab(t.tab)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {!seat.multiplayer && (
        <div className="library-row">
          <span className="group-label">For</span>
          {TEAMS.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip${team === t ? ` chip--player-${colors[t]}` : ''}`}
              title={`${COLOR_NAME[colors[t]]} player gets the characters and tactic cards`}
              onClick={() => setChosen(t)}
            >
              {COLOR_NAME[colors[t]]}
            </button>
          ))}
        </div>
      )}
      {message && <div className="library-message">{message}</div>}
      <div className="library-results">
        {showKind('characters') && (
          <section className="library-section">
            {sectionHeader('characters', 'Characters')}
            {shown('characters').map((ch) => {
              const onTable = spawned.has(ch.slug)
              const state = !ch.available
                ? ' library-character--unavailable'
                : onTable
                  ? ' library-character--spawned'
                  : ''
              return (
                <button
                  key={ch.mctCode}
                  type="button"
                  className={`library-character${state}`}
                  disabled={noSide && ch.available}
                  title={
                    noSide
                      ? noSideReason
                      : onTable
                        ? `${COLOR_NAME[colors[team]]} player has this character on the table`
                        : undefined
                  }
                  onClick={() => handleCharacter(ch)}
                >
                  <CharacterPortrait character={ch} className="library-portrait" />
                  <span className="library-character-name">{ch.name}</span>
                  <span className="library-code">{ch.mctCode}</span>
                </button>
              )
            })}
          </section>
        )}
        {showKind('tactics') && (
          <section className="library-section">
            {sectionHeader('tactics', 'Tactics')}
            <div className="library-tactics">
              {shown('tactics').map((card) => (
                <button
                  key={card.key}
                  type="button"
                  className={`library-tactic${card.gem ? ' library-tactic--gem' : ''}`}
                  disabled={noSide && !card.gem}
                  title={
                    noSide && !card.gem
                      ? noSideReason
                      : `${card.name} · ${card.id}${card.gem ? ' · Infinity Gem' : ''}`
                  }
                  onClick={() => handleTactic(card)}
                >
                  <img
                    className="library-tactic-image"
                    src={assetUrl(tacticCardBack(card.key))}
                    alt=""
                    loading="lazy"
                    draggable={false}
                  />
                  <span className="library-tactic-name">
                    {card.gem ? card.name.replace('Infinity Gem: ', '') : card.name}
                  </span>
                  {card.gem && <span className="library-tactic-tag">Infinity Gem</span>}
                </button>
              ))}
            </div>
          </section>
        )}
        {showKind('tokens') && (
          <section className="library-section">
            {sectionHeader(
              'tokens',
              'Tokens',
              <div className="library-row">
                {TOKEN_MODES.map((m) => (
                  <button
                    key={m.mode}
                    type="button"
                    className={`chip${tokenMode === m.mode ? ' chip--active' : ''}`}
                    title={m.title}
                    onClick={() => setTokenMode(m.mode)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>,
            )}
            {Object.entries(TOKEN_GROUPS).map(([group, label]) => {
              const tokens = found.tokens.filter((t) => t.group === group)
              return (
                tokens.length > 0 && (
                  <div key={group} className="library-token-group">
                    <span className="library-token-group-label">{label}</span>
                    <div className="library-tokens">
                      {tokens.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          className="token-chip"
                          title={t.description ? `${t.name}: ${t.description}` : t.name}
                          onPointerDown={(e) => onTokenDragStart(e, t.key, tokenMode)}
                        >
                          <img
                            className="token-chip-icon"
                            src={assetUrl(characterToken(t.key))}
                            alt={t.name}
                            draggable={false}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )
            })}
          </section>
        )}
        {nothing && <div className="library-empty">Nothing matches "{query}"</div>}
      </div>
    </div>
  )
}
