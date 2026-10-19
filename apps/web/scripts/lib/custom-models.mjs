// Files that a custom model (photos-to-glb) replaced. migrate-characters.mjs never writes them.
// The list is scripts/custom-models.json, see docs/features/custom-models.md.

import { normalizeAngle } from './turn-model.mjs'

// True when `file` of character `key` is in the list. The --force option does not change this.
export function isCustomModel(list, key, file) {
  return Boolean(list[key]?.[file])
}

// The turn-model part of the command of character `key`: ` && pnpm --filter web turn-model <key> <sum>`
const turnPart = (key) =>
  new RegExp(` && pnpm --filter web turn-model ${escapeRegExp(key)} (-?[0-9.]+)`)
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The sum of the turns that the command of a character already has (0 when none), in degrees
export function turnSumOf(command, key) {
  const match = command.match(turnPart(key))
  return match ? Number(match[1]) : 0
}

// The command with `degrees` added to its turn part. The sum is in -180..180. A sum of 0 removes the
// turn part: the file is then as the first command made it, and the record has no turn.
export function withTurn(command, key, degrees) {
  const sum = normalizeAngle(turnSumOf(command, key) + degrees)
  const bare = command.replace(turnPart(key), '')
  return sum === 0 ? bare : `${bare} && pnpm --filter web turn-model ${key} ${sum}`
}
