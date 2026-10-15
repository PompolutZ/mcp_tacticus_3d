import { mongoClient } from './mongo'

const DB_NAME = '[REDACTED:DB_NAME]'
const DEFAULT_COUNT = 20
const MAX_COUNT = 200

// Reports come from browsers, so they are not trusted. Cut terminal escape codes (OSC, CSI, short
// ones) and control characters before printing. Newlines and tabs stay in the stack.
/* eslint-disable no-control-regex */
function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b[@-Z\\-_]/g, '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '')
}
/* eslint-enable no-control-regex */

async function main() {
  const arg = process.argv[2]
  const count = arg === undefined ? DEFAULT_COUNT : Number(arg)
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`Usage: pnpm errors [count 1-${MAX_COUNT}]`)
  }

  const client = mongoClient()
  try {
    const docs = await client
      .db(DB_NAME)
      .collection('errors')
      .find({})
      .sort({ $natural: -1 })
      .limit(count)
      .toArray()
    if (docs.length === 0) console.log('No error reports.')
    for (const d of docs) {
      const time = d.time instanceof Date ? d.time.toISOString() : clean(d.time)
      const room = clean(d.room) || '-'
      const side = clean(d.side) || '-'
      console.log(`--- ${time} version=${clean(d.version)} room=${room} side=${side}`)
      console.log(`agent: ${clean(d.agent)}`)
      console.log(`message: ${clean(d.message)}`)
      console.log(clean(d.stack))
    }
    console.log(`${docs.length} report(s), newest first.`)
  } finally {
    await client.close()
  }
}

await main()
