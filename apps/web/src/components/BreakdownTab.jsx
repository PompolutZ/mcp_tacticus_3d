import { useMemo } from 'react'
import { characterByCode } from '../characters/characters.js'
import { rosterBreakdown } from '../rosters/cards.js'
import { MAX_BREAKDOWN_CHARACTERS } from '../rosters/breakdown.js'
import { affiliationName } from '../scoreboard/affiliations.js'
import { CharacterPortrait } from './CharacterPortrait.jsx'

// The Breakdown tab of the roster popup (RosterPopup.jsx): the squads that the roster can build for a threat
// value, read only. See docs/features/squad-breakdown.md, "Breakdown tab".
// parsed: the parsed roster. breakdown: { threats, threat, filters, onThreatChange }. threats: the values to
// choose from. threat: the selected value. filters: as NO_FILTERS (breakdown.js).
export function BreakdownTab({ parsed, breakdown }) {
  const { threats, threat, filters, onThreatChange } = breakdown
  // The combinations of every shown value, for the counts on the chips
  const byThreat = useMemo(
    () => new Map(threats.map((value) => [value, rosterBreakdown(parsed, value, filters)])),
    [parsed, threats, filters],
  )

  if (parsed.characters.length > MAX_BREAKDOWN_CHARACTERS) {
    return (
      <div className="breakdown">
        <p className="breakdown-line">
          This roster has more than {MAX_BREAKDOWN_CHARACTERS} characters, so there is no breakdown.
        </p>
      </div>
    )
  }

  const rows = byThreat.get(threat) ?? []
  return (
    <div className="breakdown">
      <div className="breakdown-threats">
        {threats.map((value) => (
          <button
            key={value}
            type="button"
            className={value === threat ? 'chip chip--active' : 'chip'}
            onClick={() => {
              if (value !== threat) onThreatChange(value)
            }}
          >
            {value} ({byThreat.get(value).length})
          </button>
        ))}
      </div>
      <p className="breakdown-line">
        {rows.length === 0
          ? `No squad fits threat ${threat}.`
          : `${rows.length} ${rows.length === 1 ? 'squad' : 'squads'}`}
      </p>
      <ul className="breakdown-list">
        {rows.map((row) => (
          <li key={row.places.join('-')} className="breakdown-row">
            <span className="breakdown-total">{row.threat}</span>
            <div className="breakdown-characters">
              {row.places.map((place) => {
                const character = characterByCode(parsed.characters[place].code)
                return (
                  <div key={place} className="breakdown-character">
                    <CharacterPortrait character={character} className="breakdown-portrait" />
                    <span className="breakdown-name">{character?.name}</span>
                  </div>
                )
              })}
            </div>
            <div className="breakdown-affiliations">
              {row.affiliations.map((a) => (
                <span key={a.key} className="breakdown-affiliation">
                  {affiliationName(a.key)}
                  {a.leader ? ' ★' : ''}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
