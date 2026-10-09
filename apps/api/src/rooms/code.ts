import { randomInt } from 'node:crypto'

// Crockford base32: no I, L, O, U. The same alphabet as apps/web/src/rooms/store.js.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

export function newRoomCode(): string {
  let text = ''
  for (let i = 0; i < 8; i++) text += ALPHABET[randomInt(ALPHABET.length)]
  return `${text.slice(0, 4)}-${text.slice(4)}`
}

export function isRoomCode(text: string): boolean {
  return CODE_RE.test(text)
}
