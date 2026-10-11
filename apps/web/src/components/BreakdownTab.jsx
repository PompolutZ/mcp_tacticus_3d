import { useMemo, useState } from 'react'
import { characterByCode } from '../characters/characters.js'
import { rosterBreakdown } from '../rosters/cards.js'
import { MAX_BREAKDOWN_CHARACTERS, NO_FILTERS } from '../rosters/breakdown.js'
import { affiliationName } from '../scoreboard/affiliations.js'
import { affiliationToken } from '../scoreboard/files.js'
import { assetUrl } from '../assets/index.js'
import { CharacterPortrait } from './CharacterPortrait.jsx'

// The Breakdown tab of the roster popup (RosterPopup.jsx): the squads that the roster can build for a threat
// value. In the squad step, a click on a row chooses the squad. See docs/features/squad-breakdown.md,
// "Breakdown tab" and "Choose a squad".
// parsed: the parsed roster. breakdown: { threats, threat, filters, onThreatChange, onFiltersChange }. threats:
// the values to choose from. threat: the selected value. filters: as NO_FILTERS (breakdown.js).
// onFiltersChange gets the whole new filters object. chooseBlock: why a click does not choose a squad now,
// or null when it does. squadCharacters: the places of the current squad that this browser may show.
// onChoose(places): a click on a row.
export function BreakdownTab({ parsed, breakdown }) {
  const {
    threats,
    threat,
    filters,
    onThreatChange,
    onFiltersChange,
    chooseBlock,
    squadCharacters,
    onChoose,
  } = breakdown
  const canChoose = !chooseBlock
  const sameSquad = (places) =>
    places.length === squadCharacters.length && places.every((p) => squadCharacters.includes(p))
  const [filtersOpen, setFiltersOpen] = useState(false)
  // The combinations of every shown value, for the counts on the chips
  const byThreat = useMemo(
    () => new Map(threats.map((value) => [value, rosterBreakdown(parsed, value, filters)])),
    [parsed, threats, filters],
  )

  // The affiliations of all combinations at the shown values, with no filter, for the Affiliation list
  const affiliationKeys = useMemo(() => {
    const keys = new Set()
    if (parsed.characters.length <= MAX_BREAKDOWN_CHARACTERS) {
      for (const value of threats) {
        for (const row of rosterBreakdown(parsed, value, NO_FILTERS)) {
          for (const a of row.affiliations) keys.add(a.key)
        }
      }
    }
    // The chosen affiliation stays in the list, also when no combination has it now
    if (filters.affiliation && filters.affiliation !== '*') keys.add(filters.affiliation)
    return [...keys].sort((a, b) => affiliationName(a).localeCompare(affiliationName(b)))
  }, [parsed, threats, filters.affiliation])

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
  const filterCount = [
    filters.must.length > 0,
    filters.mustNot.length > 0,
    filters.affiliation !== null,
    filters.dual,
    filters.leader,
    filters.minSize !== null,
    filters.maxSize !== null,
  ].filter(Boolean).length
  const setFilters = (change) => onFiltersChange({ ...filters, ...change })
  // Put a place in one of the two rows, or take it out when it is there. It leaves the other row.
  const toggleCharacter = (key, other, place) =>
    setFilters({
      [key]: filters[key].includes(place)
        ? filters[key].filter((p) => p !== place)
        : [...filters[key], place],
      [other]: filters[other].filter((p) => p !== place),
    })
  // A min size above the max size moves the max size up, and the other way round
  const setMin = (minSize) =>
    setFilters({
      minSize,
      maxSize:
        minSize !== null && filters.maxSize !== null && minSize > filters.maxSize
          ? minSize
          : filters.maxSize,
    })
  const setMax = (maxSize) =>
    setFilters({
      maxSize,
      minSize:
        maxSize !== null && filters.minSize !== null && maxSize < filters.minSize
          ? maxSize
          : filters.minSize,
    })
  const characterRow = (key, other, label) => (
    <div className="breakdown-filter">
      <span className="breakdown-filter-label">{label}</span>
      <div className="breakdown-filter-chips">
        {parsed.characters.map((ch, place) => {
          const character = characterByCode(ch.code)
          return (
            <button
              key={place}
              type="button"
              className={
                filters[key].includes(place)
                  ? 'chip breakdown-icon-chip chip--active'
                  : 'chip breakdown-icon-chip'
              }
              aria-pressed={filters[key].includes(place)}
              onClick={() => toggleCharacter(key, other, place)}
            >
              <CharacterPortrait character={character} className="breakdown-chip-portrait" />
              {character?.name ?? ch.code}
            </button>
          )
        })}
      </div>
    </div>
  )
  const sizeRow = (label, values, selected, onSelect) => (
    <div className="breakdown-filter">
      <span className="breakdown-filter-label">{label}</span>
      <div className="breakdown-filter-chips">
        {values.map((value) => (
          <button
            key={value ?? 'any'}
            type="button"
            className={value === selected ? 'chip chip--active' : 'chip'}
            aria-pressed={value === selected}
            onClick={() => onSelect(value)}
          >
            {value ?? 'Any'}
          </button>
        ))}
      </div>
    </div>
  )
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
      <div>
        <button
          type="button"
          className={filtersOpen ? 'chip chip--active' : 'chip'}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          {filterCount > 0 ? `Filters (${filterCount})` : 'Filters'} {filtersOpen ? '▴' : '▾'}
        </button>
      </div>
      {filtersOpen && (
        <div className="breakdown-filters">
          {characterRow('must', 'mustNot', 'Must have')}
          {characterRow('mustNot', 'must', 'Must not have')}
          <div className="breakdown-filter">
            <span className="breakdown-filter-label">Affiliation</span>
            <div className="breakdown-filter-chips">
              {['*', ...affiliationKeys].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={
                    filters.affiliation === key
                      ? 'chip breakdown-icon-chip chip--active'
                      : 'chip breakdown-icon-chip'
                  }
                  aria-pressed={filters.affiliation === key}
                  onClick={() =>
                    setFilters({ affiliation: filters.affiliation === key ? null : key })
                  }
                >
                  {key !== '*' && (
                    <img
                      className="breakdown-chip-portrait"
                      src={assetUrl(affiliationToken(key))}
                      alt=""
                    />
                  )}
                  {key === '*' ? 'Any affiliation' : affiliationName(key)}
                </button>
              ))}
            </div>
          </div>
          <div className="breakdown-filter">
            <label className="breakdown-check">
              <input
                type="checkbox"
                checked={filters.dual}
                onChange={(e) => setFilters({ dual: e.target.checked })}
              />
              At least 2 affiliations
            </label>
            <label className="breakdown-check">
              <input
                type="checkbox"
                checked={filters.leader}
                onChange={(e) => setFilters({ leader: e.target.checked })}
              />
              With a leader
            </label>
          </div>
          {sizeRow('Min size', [null, 3, 4, 5, 6, 7], filters.minSize, setMin)}
          {sizeRow('Max size', [3, 4, 5, 6, 7, null], filters.maxSize, setMax)}
          <div>
            <button type="button" className="chip" onClick={() => onFiltersChange(NO_FILTERS)}>
              Clear filters
            </button>
          </div>
        </div>
      )}
      <p className="breakdown-line">
        {rows.length === 0
          ? filterCount > 0
            ? `No squad has threat ${threat} with these filters.`
            : `No squad has threat ${threat}.`
          : `${rows.length} ${rows.length === 1 ? 'squad' : 'squads'}`}
      </p>
      <p className="breakdown-line">
        {canChoose
          ? 'Click a squad to choose it. Choose the Team Tactic cards on the table.'
          : chooseBlock}
      </p>
      <ul className="breakdown-list">
        {rows.map((row) => (
          <li key={row.places.join('-')}>
            <div
              className={`breakdown-row${canChoose ? ' breakdown-row--click' : ''}${sameSquad(row.places) ? ' breakdown-row--squad' : ''}`}
              role={canChoose ? 'button' : undefined}
              tabIndex={canChoose ? 0 : undefined}
              onClick={canChoose ? () => onChoose(row.places) : undefined}
              onKeyDown={
                canChoose
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onChoose(row.places)
                      }
                    }
                  : undefined
              }
            >
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
