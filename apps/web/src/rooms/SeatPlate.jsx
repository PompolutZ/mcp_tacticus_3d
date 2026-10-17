// A seat of a room tile (docs/features/rooms.md, "Lobby"): a skewed plate with the name, and under it the
// roster link when onRoster is given. color: 'blue' or 'red' for a single player side; null for a
// multiplayer seat or a side of unknown color (a neutral plate). avatar: the image of the player, or null.
// align 'end' puts the second plate to the right. empty: a dashed white plate for a seat nobody has yet (the
// challenger of the join page). rosterText: the text of the roster link. note: a line of text under the plate
// instead of the link.
export function SeatPlate({
  name,
  color = null,
  avatar = null,
  muted = false,
  empty = false,
  rosterText = 'Roster ›',
  note,
  onRoster,
  label,
  align,
}) {
  return (
    <div className={`seat${align === 'end' ? ' seat--end' : ''}`}>
      <span
        className={`seat-plate seat-plate--${color ?? 'neutral'}${muted ? ' seat-plate--muted' : ''}${empty ? ' seat-plate--empty' : ''}`}
      >
        {avatar && <img className="seat-avatar" src={avatar} alt="" draggable={false} />}
        <span className="seat-name">{name}</span>
      </span>
      {onRoster && (
        <button type="button" className="seat-roster" aria-label={label} onClick={onRoster}>
          {rosterText}
        </button>
      )}
      {note && <span className="seat-note">{note}</span>}
    </div>
  )
}
