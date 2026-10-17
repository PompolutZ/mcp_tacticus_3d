import { useMemo } from 'react'
import { isEmptyRoster } from './mct.js'
import { missingFiles, unknownCodesMessage } from './cards.js'
import './rosterField.css'

// "1 character", "10 characters"
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// What a roster text has, for example "10 characters · 10 tactic cards · 5 Secure · 5 Extract"
function rosterSummary(parsed) {
  return [
    count(parsed.characters.length, 'character'),
    count(parsed.tactics.length, 'tactic card'),
    `${parsed.secure.length} Secure`,
    `${parsed.extract.length} Extract`,
  ].join(' · ')
}

// The warning box for the roster cards that the app has no files for (missingFiles in rosters/cards.js),
// or null when it has all of them. Only characters and Team Tactic cards.
function MissingFiles({ parsed }) {
  const { models, tactics } = useMemo(() => missingFiles(parsed), [parsed])
  if (models.length === 0 && tactics.length === 0) return null
  return (
    <div className="new-room-missing">
      <span className="new-room-missing-title">
        The app does not have these cards, so they will not show
      </span>
      {models.length > 0 && (
        <span>
          No 3D model for {count(models.length, 'character')}: {models.join(', ')}
        </span>
      )}
      {tactics.length > 0 && (
        <span>
          No image for {count(tactics.length, 'tactic card')}: {tactics.join(', ')}
        </span>
      )}
    </div>
  )
}

// A roster field of the dialog, and what the app found in its text under it. label: the field name.
// color: 'blue' | 'red' for the input, or missing. text: the field text.
// plate: 'Blue' | 'Red' puts the color plate left of the input and hides the label (the new room dialog shows
// one heading for the fields). The look is in rosterField.css, for the dialog and the join page. parsed: the parsed text. optional: the field can stay empty. onChange(text). The first field has the focus
// when the dialog opens.
export function RosterField({ label, color, plate, text, parsed, optional, onChange }) {
  let status = null
  if (text.trim() && isEmptyRoster(parsed))
    status = <span className="new-room-error">No known MCT code in the text</span>
  else if (!isEmptyRoster(parsed)) {
    status = (
      <>
        <span>{rosterSummary(parsed)}</span>
        {parsed.unknown.length > 0 && (
          <span className="new-room-warning">{unknownCodesMessage(parsed.unknown)}</span>
        )}
        <MissingFiles parsed={parsed} />
      </>
    )
  }
  return (
    <>
      <label className={plate ? 'new-room-roster new-room-roster--plate' : 'new-room-roster'}>
        <span className={plate ? 'group-label new-room-label--hidden' : 'group-label'}>
          {label}
        </span>
        {plate && (
          <span
            className={`new-room-plate new-room-plate--${plate.toLowerCase()}`}
            aria-hidden="true"
          >
            {plate}
          </span>
        )}
        <input
          type="text"
          className={`chip ${color ? `chip--player-${color}` : ''} chip--text new-room-input${optional ? ' new-room-input--optional' : ''}`}
          placeholder={optional ? 'Optional — paste an MCT code' : 'Paste an MCT code'}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={!optional}
        />
      </label>
      <div className="new-room-status" aria-live="polite">
        {status}
      </div>
    </>
  )
}
