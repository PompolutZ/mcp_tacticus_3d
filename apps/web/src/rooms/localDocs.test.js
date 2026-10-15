import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orphanRoomDocNames, staleDocNames, staleRoomIds, staleSquadCodes } from './localDocs.js'

test("only this user's multiplayer names that are not in the list", () => {
  const names = [
    'mcp-assist-3d/multiplayer/u1/AAAA-AAAA',
    'mcp-assist-3d/multiplayer/u1/BBBB-BBBB',
    'mcp-assist-3d/multiplayer/u2/CCCC-CCCC',
    'mcp-assist-3d/multiplayer/u10/DDDD-DDDD',
    'mcp-assist-3d/room/EEEE-EEEE',
    'other-db',
  ]
  assert.deepEqual(staleDocNames(names, 'u1', ['AAAA-AAAA']), [
    'mcp-assist-3d/multiplayer/u1/BBBB-BBBB',
  ])
  assert.deepEqual(staleDocNames(names, 'u1', []), [
    'mcp-assist-3d/multiplayer/u1/AAAA-AAAA',
    'mcp-assist-3d/multiplayer/u1/BBBB-BBBB',
  ])
})

test('stored squads of rooms that are not in the list', () => {
  assert.deepEqual(staleSquadCodes(['AAAA-AAAA', 'BBBB-BBBB'], ['AAAA-AAAA']), ['BBBB-BBBB'])
  assert.deepEqual(staleSquadCodes(['AAAA-AAAA'], ['AAAA-AAAA']), [])
  assert.deepEqual(staleSquadCodes([], []), [])
})

test('records with no version or an older one are stale, a newer one stays', () => {
  const records = [
    { id: 'A' },
    { id: 'B', version: 1 },
    { id: 'C', version: 2 },
    { id: 'D', version: 3 },
    { id: 'E', version: 4 },
    null,
    { version: 1 },
  ]
  assert.deepEqual(staleRoomIds(records, 3), ['A', 'B', 'C'])
})

test('single player databases without a record', () => {
  const names = [
    'mcp-assist-3d/room/AAAA-AAAA',
    'mcp-assist-3d/room/BBBB-BBBB',
    'mcp-assist-3d/multiplayer/u1/CCCC-CCCC',
    'other/room/DDDD-DDDD',
    'other-db',
  ]
  assert.deepEqual(orphanRoomDocNames(names, ['AAAA-AAAA']), ['mcp-assist-3d/room/BBBB-BBBB'])
  assert.deepEqual(orphanRoomDocNames(names, []), [
    'mcp-assist-3d/room/AAAA-AAAA',
    'mcp-assist-3d/room/BBBB-BBBB',
  ])
})
