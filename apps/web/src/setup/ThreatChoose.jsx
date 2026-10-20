import { chooserOf } from './setup.js'
import { threatChips } from './deckButton.js'
import { playerName } from './names.js'
import { rosterCard } from '../rosters/cards.js'
import { ChooseFrame } from '../crisis/ChooseFrame.jsx'
import { BreakdownTab } from '../rosters/BreakdownTab.jsx'

// The Maximum Threat overlay of the game setup, in the threat step (docs/features/setup-game.md, "Maximum
// Threat"): one button per crisis card ("Secure · 17"), the same chips as the table (setup/deckButton.js,
// threatChips: same action, lock and title). Under them the Breakdown of the chooser's squad options
// (rosters/BreakdownTab.jsx), a preview of what each threat gives. A pick closes the overlay. The other player
// sees a note and no buttons. The parent (App.jsx) owns the open state. onPick = setupActions.threat.
// parsed: { host, guest } → parsed roster | null. breakdownFor: from useBreakdownChoice.
export function ThreatChoose({ setup, parsed, ctx, breakdownFor, onPick, onClose }) {
  const chooser = chooserOf(setup)
  const active = !ctx.mySide || ctx.mySide === chooser
  const { locked, chips } = threatChips(setup, ctx, rosterCard)
  const breakdown = parsed[chooser] ? breakdownFor(chooser) : null
  return (
    <ChooseFrame
      tone="blue"
      tag={`${playerName(chooser, ctx)} · Maximum Threat`}
      title="Choose the Maximum Threat"
      onClose={onClose}
    >
      <div className="roster-comic-stage crisis-choose-stage threat-choose-stage">
        {active ? (
          <div className="threat-choose-buttons">
            {chips.map((chip) => (
              <button
                key={chip.type}
                type="button"
                className="comic-go"
                aria-disabled={locked !== null}
                title={chip.title}
                onClick={
                  locked === null
                    ? () => {
                        onPick(chip.value)
                        onClose()
                      }
                    : undefined
                }
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="crisis-choose-note">
            Waiting for {playerName(chooser, ctx)} to choose the Maximum Threat.
          </p>
        )}
        {breakdown && (
          <div className="roster-comic-breakdown">
            <BreakdownTab parsed={parsed[chooser]} breakdown={breakdown} />
          </div>
        )}
      </div>
    </ChooseFrame>
  )
}
