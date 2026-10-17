// A seat of a room tile (docs/features/rooms.md, "Lobby"): a skewed plate with the name, and under it the
// roster link when onRoster is given. color: 'blue' or 'red' for a single player side; null for a
// multiplayer seat or a side of unknown color (a neutral plate). avatar: the image of the player, or null.
// align 'end' puts the second plate to the right.
export function SeatPlate({
  name,
  color = null,
  avatar = null,
  muted = false,
  onRoster,
  label,
  align,
}) {
  return (
    <div className={`seat${align === 'end' ? ' seat--end' : ''}`}>
      <span
        className={`seat-plate seat-plate--${color ?? 'neutral'}${muted ? ' seat-plate--muted' : ''}`}
      >
        {avatar && <img className="seat-avatar" src={avatar} alt="" draggable={false} />}
        <span className="seat-name">{name}</span>
      </span>
      {onRoster && (
        <button type="button" className="seat-roster" aria-label={label} onClick={onRoster}>
          Roster ›
        </button>
      )}
    </div>
  )
}
