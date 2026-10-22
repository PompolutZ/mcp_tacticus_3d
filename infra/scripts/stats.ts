import { DB_NAME, mongoClient } from './mongo'
import { DEFAULT_DAYS, MAX_DAYS, formatStats, normalizeRow, statsPipeline } from './stats-lib'

const DAY_MS = 24 * 60 * 60 * 1000

async function main() {
  const arg = process.argv[2]
  const days = arg === undefined ? DEFAULT_DAYS : Number(arg)
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    throw new Error(`Usage: pnpm stats [days 1-${MAX_DAYS}]`)
  }
  // From the start of the UTC day, so the first day is whole.
  const today = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS)
  const since = new Date(today.getTime() - (days - 1) * DAY_MS)

  const client = mongoClient()
  try {
    const docs = await client
      .db(DB_NAME)
      .collection('events')
      .aggregate(statsPipeline(since))
      .toArray()
    console.log(`Events since ${since.toISOString().slice(0, 10)} (UTC), newest day first.`)
    console.log(formatStats(docs.map((d) => normalizeRow(d))))
  } finally {
    await client.close()
  }
}

await main()
