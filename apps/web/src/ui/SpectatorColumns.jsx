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
    <div className={`streamer-bar ${className}`} title={`${label} ${value} / ${max}`}>
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
    <img
      className="streamer-held"
      src={assetUrl(crisisToken(key))}
      alt={name}
      title={name}
      draggable={false}
    />
  )
}

// The affiliation token image of a side, its name as the title
function AffiliationMark({ affiliation }) {
  const name = affiliationName(affiliation)
  return (
    <img
      className="streamer-affiliation"
      src={assetUrl(characterToken(affiliationTokenKey(affiliation)))}
      alt={name}
      title={name}
      draggable={false}
    />
  )
}

// off: the character is off the mat. ko: and the deploy is over, so it is KO.
function Row({ character, held, off, ko }) {
  const name = characterName(character.key)
  const grunt = Boolean(character.host)
  const stamina = characterStamina(character.key, character.side)
  const tokens = Object.entries(character.tokens ?? {})
  const injured = character.side === 'injured' && !ko
  const tag = ko ? 'Knocked out' : injured ? 'Injured' : null
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
      <div className="streamer-main">
        <div className="streamer-top">
          <span className="streamer-portrait-wrap">
            <img
              className="streamer-portrait"
              src={assetUrl(characterPortrait(character.key))}
              alt=""
              title={name}
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
            <span className="streamer-char-name">{name}</span>
            {tag && (
              <span className={`streamer-state streamer-state--${ko ? 'ko' : 'injured'}`}>
                {tag}
              </span>
            )}
            {tokens.length > 0 && (
              <div className="streamer-tokens">
                {tokens.map(([key, count]) => (
                  <OnToken key={key} tokenKey={key} count={count} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="streamer-lower">
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
            {!grunt && (
              <Bar
                value={character.power ?? 0}
                max={MAX_POWER}
                label="Power"
                short="Pwr"
                className="streamer-bar--power"
              />
            )}
          </div>
          <div className="streamer-held-slot">
            {held.map((token) => (
              <HeldMark key={token.id} token={token} />
            ))}
          </div>
        </div>
      </div>
    </li>
  )
}

// Spectator view, HUD part: one column per squad, my squad left and the opponent right (the Sandbox and a
// single player room: Blue, the host, left). A header with the player name and the affiliation icon (VP and the round are on the scoreboard), then a row
// per character (name, tag, tokens, bars) and grunt in squad order (no constructs). Read-only. See docs/features/spectator-view.md,
// "Squad columns".
// characters, tokens, poses, setup (the viewer's setup), affiliations: App state.
// nameCtx (names, setup/names.js), mySide, hiddenSquads (the seat, rooms/seat.js) and size (percent, settings.spectator.size) come from the store of the table. libraryOpen and
// logOpen push the column on their side inward.
export default function SpectatorColumns({
  characters,
  tokens,
  poses,
  setup,
  affiliations,
  libraryOpen,
  logOpen,
}) {
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
        const side = i === 0 ? 'left' : 'right'
        const pushed = i === 0 ? libraryOpen : logOpen
        const className = `comic streamer-col streamer-col--${side}${pushed ? ' streamer-col--pushed' : ''}`
        return (
          <section
            key={team}
            className={className}
            style={{ '--spectator-size': size / 100 }}
            aria-label={`${playerName(team, nameCtx)}, squad`}
          >
            <header className={`streamer-head streamer-head--${colors[team]}`}>
              <span className="streamer-name">{playerName(team, nameCtx)}</span>
              {affiliations?.[team] && <AffiliationMark affiliation={affiliations[team]} />}
            </header>
            {!hidden && (
              <ul className="streamer-list">
                {characters
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
              </ul>
            )}
          </section>
        )
      })}
    </>
  )
}
