import test from 'node:test'
import assert from 'node:assert/strict'
import { CODE_CHARS, CODE_LENGTH, parseRoomCode } from './roomCode.js'

test('a normal code stays the same', () => {
  assert.equal(parseRoomCode('K7Q2-M9XD'), 'K7Q2-M9XD')
})

test('lower case, spaces and a missing hyphen give the normal form', () => {
  for (const text of ['k7q2-m9xd', '  K7Q2-M9XD ', 'K7Q2M9XD', 'k7q2 m9xd', 'K 7 Q 2 - M 9 X D'])
    assert.equal(parseRoomCode(text), 'K7Q2-M9XD', text)
})

test('a wrong length is null', () => {
  const chars = [...CODE_CHARS]
  assert.equal(parseRoomCode(chars.slice(0, CODE_LENGTH - 1).join('')), null)
  assert.equal(parseRoomCode(chars.slice(0, CODE_LENGTH + 1).join('')), null)
  assert.equal(parseRoomCode(''), null)
  assert.equal(parseRoomCode(null), null)
})

test('a character outside the alphabet is null', () => {
  // I, L, O, U are not in the alphabet; the others are not letters or digits
  for (const text of ['K7Q2-M9XI', 'K7Q2-M9XL', 'K7Q2-M9XO', 'K7Q2-M9XU', 'K7Q2-M9X!', 'K7Q2_M9XD'])
    assert.equal(parseRoomCode(text), null, text)
})

test('a room link gives the code in it', () => {
  assert.equal(parseRoomCode('https://example.com/#room=K7Q2-M9XD'), 'K7Q2-M9XD')
  assert.equal(parseRoomCode(' https://example.com/app/#room=K7Q2-M9XD&x=1 '), 'K7Q2-M9XD')
})

test('a room link with a lower case code or no hyphen gives the normal form', () => {
  assert.equal(parseRoomCode('https://example.com/#room=k7q2-m9xd'), 'K7Q2-M9XD')
  assert.equal(parseRoomCode('https://example.com/#room=K7Q2M9XD'), 'K7Q2-M9XD')
})

test('a room link with a bad code is null', () => {
  for (const text of [
    'https://example.com/#room=K7Q2-M9XI',
    'https://example.com/#room=K7Q2',
    'https://example.com/#room=',
  ])
    assert.equal(parseRoomCode(text), null, text)
})
