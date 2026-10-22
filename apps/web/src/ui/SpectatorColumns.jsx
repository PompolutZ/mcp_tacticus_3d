import { assetUrl } from '../assets/index.js'
import { characterPortrait } from '../characters/files.js'
import { characterName, characterStamina } from '../characters/characters.js'
import { characterOnBoard } from '../characters/models.js'
import { tokenInfo } from '../crisis/cards.js'
import { crisisToken } from '../crisis/files.js'
import { heldTokensByCharacter } from '../game/heldTokens.js'
import { otherTeam, placedSides } from '../setup/setup.js'
import { playerName } from '../setup/names.js'
import { affiliationName } from '../scoreboard/affiliations.js'
import { characterToken } from '../tokens/files.js'
import { affiliationTokenKey } from '../tokens/affiliationTokens.js'
import { getTactic } from '../tactics/cards.js'
import { tacticCardBack } from '../tactics/files.js'
import { getToken } from '../tokens/tokens.js'
import { useYList } from '../net/useY.js'
import { teamTactics } from './teamTactics.js'
import { useRowFit } from './useRowFit.js'
import { Burst } from '../rooms/Burst.jsx'
import { OnToken } from '../characters/TrayPopup.jsx'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { useSideColors } from '../table/useSideColors.jsx'
import '../rooms/comicBase.js'
import './streamer.css'

// Power is 0 to 10 (the tray counter)
const MAX_POWER = 10

function Bar({ value, max, className, label, short }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={`streamer-bar ${className}`} aria-label={`${label} ${value} / ${max}`}>
      <span className="streamer-bar-label">{short}</span>
      <div className="streamer-bar-track">
        <div className="streamer-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="streamer-bar-value">
        {value}/{max}
      </span>
    </div>
  )
}

// A crisis token that the character holds, the face that is up
function HeldMark({ token }) {
  const key = token.up === 'front' ? token.frontKey : (token.backKey ?? token.frontKey)
  const name = tokenInfo(key)?.name ?? key
  return (
    <img className="streamer-held" src={assetUrl(crisisToken(key))} alt={name} draggable={false} />
  )
}

// The affiliation token image of a side, its name as the alt
function AffiliationMark({ affiliation }) {
  const name = affiliationName(affiliation)
  return (
    <img
      className="streamer-affiliation"
      src={assetUrl(characterToken(affiliationTokenKey(affiliation)))}
      alt={name}
      draggable={false}
    />
  )
}

// The Team tactics section of a column: the card images as the Library shows them, a used (flipped) one
// grey with a "Used" stamp
function TeamTactics({ list }) {
  return (
    <div className="streamer-tactics">
      <div className="streamer-tactics-head">
        <span className="streamer-tactics-title">Team tactics</span>
        <span className="streamer-tactics-count">
          {list.used} of {list.total} used
        </span>
      </div>
      <ul className="streamer-tactics-grid">
        {list.items.map((item) => (
          <li
            key={item.id}
            className={`streamer-tactic${item.used ? ' streamer-tactic--used' : ''}`}
          >
            <span className="streamer-tactic-card">
              <img
                className="streamer-tactic-image"
                src={assetUrl(tacticCardBack(item.key))}
                alt=""
                loading="lazy"
                draggable={false}
              />
              {item.used && <span className="streamer-tactic-stamp">Used</span>}
            </span>
            <span className="streamer-tactic-name">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const tacticName = (key) => getTactic(key)?.name ?? key

// Most small tokens in the name line of a row; more show as one "+N" chip (the full list is its aria-label)
const MAX_CHIPS = 3

// off: the character is off the mat. ko: and the deploy is over, so it is KO.
// The row has a fixed height: the tokens (on the character and held crisis tokens) are small chips in one
// line of the name row, so adding or removing one never changes the height.
function Row({ character, held, off, ko }) {
  const name = characterName(character.key)
  const grunt = Boolean(character.host)
  const stamina = characterStamina(character.key, character.side)
  const tokens = Object.entries(character.tokens ?? {})
  const injured = character.side === 'injured' && !ko
  const tag = ko ? 'Knocked out' : injured ? 'Injured' : null
  const chips = [
    ...held.map((token) => ({ id: `held-${token.id}`, node: <HeldMark token={token} /> })),
    ...tokens.map(([key, count]) => ({
      id: key,
      node: <OnToken tokenKey={key} count={count} />,
    })),
  ]
  const overflow = chips.length > MAX_CHIPS
  const shown = overflow ? chips.slice(0, MAX_CHIPS - 1) : chips
  const allNames = [
    ...held.map((token) => {
      const key = token.up === 'front' ? token.frontKey : (token.backKey ?? token.frontKey)
      return tokenInfo(key)?.name ?? key
    }),
    ...tokens.map(
      ([key, count]) => `${getToken(key)?.name ?? key}${count > 1 ? ` x${count}` : ''}`,
    ),
  ].join(', ')
  return (
    <li
      className={[
        'streamer-row',
        off && !ko && 'streamer-row--off',
        ko && 'streamer-row--ko',
        injured && 'streamer-row--injured',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="streamer-portrait-wrap">
        <img
          className="streamer-portrait"
          src={assetUrl(characterPortrait(character.key))}
          alt=""
          loading="lazy"
          draggable={false}
        />
        {ko && (
          <span className="streamer-ko-burst" aria-hidden="true">
            <Burst size={38} fontSize={14}>
              KO!
            </Burst>
          </span>
        )}
      </span>
      <div className="streamer-side">
        <div className="streamer-nameline">
          <span className="streamer-char-name">{name}</span>
          {tag && (
            <span className={`streamer-state streamer-state--${ko ? 'ko' : 'injured'}`}>{tag}</span>
          )}
          {chips.length > 0 && (
            <div className="streamer-tokens">
              {shown.map((chip) => (
                <span key={chip.id} className="streamer-chip">
                  {chip.node}
                </span>
              ))}
              {overflow && (
                <span className="streamer-more" role="img" aria-label={allNames}>
                  +{chips.length - shown.length}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="streamer-bars">
          <Bar
            value={character.damage ?? 0}
            max={stamina}
            label="Damage"
            short="Dmg"
            className={
              character.side === 'injured' ? 'streamer-bar--injured' : 'streamer-bar--healthy'
            }
          />
          {grunt ? (
            <div className="streamer-bar streamer-bar--empty" aria-hidden="true" />
          ) : (
            <Bar
              value={character.power ?? 0}
              max={MAX_POWER}
              label="Power"
              short="Pwr"
              className="streamer-bar--power"
            />
          )}
        </div>
      </div>
    </li>
  )
}

// One squad column. The rows scale down together when they do not fit (useRowFit.js).
function Column({ side, pushed, size, header, hidden, rows, tacticList }) {
  const { colRef, listRef, fit } = useRowFit(hidden ? 0 : rows.length, size / 100)
  const className = `comic streamer-col streamer-col--${side}${pushed ? ' streamer-col--pushed' : ''}`
  return (
    <section
      ref={colRef}
      className={className}
      style={{ '--spectator-size': size / 100, '--row-scale': fit.scale }}
      aria-label={header.label}
    >
      <header className={`streamer-head streamer-head--${header.color}`}>
        <span className="streamer-name">{header.name}</span>
        {header.affiliation && <AffiliationMark affiliation={header.affiliation} />}
      </header>
      {!hidden && (
        <ul ref={listRef} className="streamer-list">
          {rows}
        </ul>
      )}
      {!hidden && tacticList.total > 0 && <TeamTactics list={tacticList} />}
    </section>
  )
}

// Spectator view, HUD part: one column per squad, my squad left and the opponent right (the Sandbox and a
// single player room: Blue, the host, left). A header with the player name and the affiliation icon (VP and the round are on the scoreboard), then a row
// per character (portrait, name, tag, small tokens, bars) and grunt in squad order (no constructs). Read-only, pointer-events none (streamer.css). See docs/features/spectator-view.md,
// "Squad columns".
// characters, tokens, poses, setup (the viewer's setup), affiliations: App state. tactics: the list of the Team Tactic cards (the
// Team tactics section at the end of a column, none when the squad is hidden or has no cards).
// nameCtx (names, setup/names.js), mySide, hiddenSquads (the seat, rooms/seat.js) and size (percent, settings.spectator.size) come from the store of the table. libraryOpen and
// logOpen push the column on their side inward.
export default function SpectatorColumns({
  characters,
  tokens,
  poses,
  setup,
  affiliations,
  tactics,
  libraryOpen,
  logOpen,
}) {
  const [tacticCards] = useYList(tactics)
  const colors = useSideColors()
  const nameCtx = useTableStore((s) => s.nameCtx)
  const mySide = useTableStore((s) => s.mySide)
  const hiddenSquads = useTableStore((s) => s.hiddenSquads)
  const size = useTableStore((s) => s.settings.spectator.size)
  const held = heldTokensByCharacter(tokens)
  const placed = placedSides(setup)
  // A setup with no `deployed` field has no deploy step (setup/setup.js, setupStep)
  const afterDeploy = setup.deployed !== false
  const left = mySide ?? 'host'
  const sides = [left, otherTeam(left)]
  return (
    <>
      {sides.map((team, i) => {
        const hidden = Boolean(hiddenSquads && team !== mySide && !placed[team])
        return (
          <Column
            key={team}
            team={team}
            side={i === 0 ? 'left' : 'right'}
            pushed={i === 0 ? libraryOpen : logOpen}
            size={size}
            hidden={hidden}
            tacticList={teamTactics(tacticCards, team, tacticName)}
            header={{
              label: `${playerName(team, nameCtx)}, squad`,
              name: playerName(team, nameCtx),
              color: colors[team],
              affiliation: affiliations?.[team],
            }}
            rows={characters
              .filter((ch) => ch.team === team)
              .map((ch) => {
                const off = !characterOnBoard(ch, poses)
                return (
                  <Row
                    key={ch.id}
                    character={ch}
                    held={held.get(ch.id) ?? []}
                    off={off}
                    ko={off && afterDeploy}
                  />
                )
              })}
          />
        )
      })}
    </>
  )
}
