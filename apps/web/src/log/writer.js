import { addEntry, addStatEntry, logEntry } from './log.js'
import { characterName } from '../characters/characters.js'
import { getToken } from '../tokens/tokens.js'

// The log writers of one table and one side. Plain functions, no hooks. App calls it every render.
// table: the document tables, mySide: the side of this browser (null: spectator)
export function logWriter(table, mySide) {
  // Adds a log entry (log/log.js). Call it in the same transaction as the change it tells. A fixed id is for
  // an effect that runs in both browsers: the same id makes one entry.
  function writeLog(kind, data, id) {
    table.log.set((list) => addEntry(list, logEntry(kind, mySide, data, id)))
  }
  // A Damage or Power entry, with the merge of clicks (addStatEntry). Same transaction rule as writeLog.
  function writeStatLog(ch, stat, from, to) {
    const data = { ...characterLogData(ch), stat, from, to }
    table.log.set((list) => addStatEntry(list, logEntry('stat', mySide, data)))
  }
  // The data that every character entry has: the side of the character gives the color of the entry
  function characterLogData(ch) {
    return { side: ch.team, characterId: ch.id, name: characterName(ch.key) }
  }

  // Data of a 'token' entry (log/log.js). key: the token key ('activated' is the one that Step 4 gives its own
  // sound), count: how many the character has after the change.
  function tokenEntryData(ch, key, on, count) {
    return {
      ...characterLogData(ch),
      key,
      tokenName: getToken(key)?.name ?? key,
      on,
      count,
    }
  }

  // An objective token that a character holds, or drops from its card (a 'held' entry). `token`: the entry of
  // `tokens` (its name comes from the front token), ch: the character.
  function writeHeldLog(ch, token, on) {
    if (!ch) return
    const tokenName = getToken(token.frontKey)?.name ?? token.frontKey
    writeLog('held', { ...characterLogData(ch), tokenId: token.id, tokenName, on })
  }

  return { writeLog, writeStatLog, characterLogData, tokenEntryData, writeHeldLog }
}
