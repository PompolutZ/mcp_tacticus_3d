import { assetUrl } from '../assets/index.js'
import { characterPortrait } from '../characters/files.js'
import { characterName, characterStamina } from '../characters/characters.js'
import { characterOnBoard } from '../characters/models.js'
import { tokenInfo } from '../crisis/cards.js'
import { crisisToken } from '../crisis/files.js'
import { heldTokensByCharacter } from '../game/heldTokens.js'
import { scoreFromMarkers } from '../scoreboard/board.js'
import { otherTeam, placedSides } from '../setup/setup.js'
import { playerName } from '../setup/names.js'
import { affiliationName } from '../scoreboard/affiliations.js'
import { characterToken } from '../tokens/files.js'
import { affiliationTokenKey } from '../tokens/affiliationTokens.js'
import { OnToken } from '../characters/TrayPopup.jsx'
import { useTableStore } from '../table/TableStoreContext.jsx'

// Power is 0 to 10 (the tray counter)
const MAX_POWER = 10

function Bar({ value, max, className, label }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={`spectator-bar ${className}`} title={`${label} ${value} / ${max}`}>
      <div className="spectator-bar-fill" style={{ width: `${percent}%` }} />
      <span className="spectator-bar-text">
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
      className="spectator-held"
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
      className="spectator-affiliation"
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
  return (
    <li className={off ? 'spectator-row spectator-row--off' : 'spectator-row'}>
      <img
        className="spectator-portrait"
        src={assetUrl(characterPortrait(character.key))}
        alt=""
        title={name}
        loading="lazy"
        draggable={false}
      />
      <div className="spectator-bars">
        <Bar
          value={character.damage ?? 0}
          max={stamina}
          label="Damage"
          className={
            character.side === 'injured' ? 'spectator-bar--injured' : 'spectator-bar--healthy'
          }
        />
        {!grunt && (
          <Bar
            value={character.power ?? 0}
            max={MAX_POWER}
            label="Power"
            className="spectator-bar--power"
          />
        )}
      </div>
      <div className="spectator-tokens">
        {held.map((token) => (
          <HeldMark key={token.id} token={token} />
        ))}
        {tokens.map(([key, count]) => (
          <OnToken key={key} tokenKey={key} count={count} />
        ))}
      </div>
      {ko && <span className="spectator-ko">KO</span>}
    </li>
  )
}

// Spectator view, HUD part: one column per squad, my squad left and the opponent right (the Sandbox and a
// single player room: Blue, the host, left). A header with the player name, VP and the round, then a row
// per character and grunt in squad order (no constructs). Read-only. See docs/features/spectator-view.md,
// "Squad columns".
// characters, tokens, poses, setup (the viewer's setup), scoreMarkers: App state.
// nameCtx (names, setup/names.js), mySide, hiddenSquads (the seat, rooms/seat.js) and size (percent, settings.spectator.size) come from the store of the table. libraryOpen and
// logOpen push the column on their side inward.
export default function SpectatorColumns({
  characters,
  tokens,
  poses,
  setup,
  scoreMarkers,
  affiliations,
  libraryOpen,
  logOpen,
}) {
  const nameCtx = useTableStore((s) => s.nameCtx)
  const mySide = useTableStore((s) => s.mySide)
  const hiddenSquads = useTableStore((s) => s.hiddenSquads)
  const size = useTableStore((s) => s.settings.spectator.size)
  const score = scoreFromMarkers(scoreMarkers)
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
        const className = `spectator-col spectator-col--${side}${pushed ? ' spectator-col--pushed' : ''}`
        return (
          <section
            key={team}
            className={className}
            style={{ '--spectator-size': size / 100 }}
            aria-label={`${playerName(team, nameCtx)}, squad`}
          >
            <header className="spectator-head">
              <span className="spectator-name">{playerName(team, nameCtx)}</span>
              {affiliations?.[team] && <AffiliationMark affiliation={affiliations[team]} />}
              <span>{score[team]} VP</span>
              {score.round && <span>Round {score.round}</span>}
            </header>
            {!hidden && (
              <ul className="spectator-list">
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
