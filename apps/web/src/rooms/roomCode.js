// The room code: format and parsing. Pure. No React.

// Crockford base32: no I, L, O, U, so a code read aloud or typed is not mistaken. 8 characters are 40 bits,
// the room code of docs/features/peer-to-peer.md, "Security and abuse". Shown as two halves with a hyphen.
export const CODE_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CODE_LENGTH = 8

// The room code that text means, in its normal form (for example K7Q2-M9XD), or null. The text may have
// lower case, spaces and no hyphen. It may also be a room link (https://host/#room=K7Q2-M9XD): then only the
// value after `room=` counts. Other characters, including I, L, O and U, make it null.
export function parseRoomCode(text) {
  const raw = String(text ?? '')
  const at = raw.indexOf('room=')
  const value = at < 0 ? raw : (raw.slice(at + 5).split(/[&#\s]/)[0] ?? '')
  const chars = value.toUpperCase().replace(/[\s-]/g, '')
  if (chars.length !== CODE_LENGTH) return null
  if ([...chars].some((c) => !CODE_CHARS.includes(c))) return null
  const half = CODE_LENGTH / 2
  return `${chars.slice(0, half)}-${chars.slice(half)}`
}
