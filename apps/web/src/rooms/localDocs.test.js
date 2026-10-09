import { test } from 'node:test'
import assert from 'node:assert/strict'
import { staleDocNames } from './localDocs.js'

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
