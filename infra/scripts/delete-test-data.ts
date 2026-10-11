import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { MongoClient } from 'mongodb'

const DB_NAME = 'assist3d'
// deleteMany, not drop, so the indexes stay.
const COLLECTIONS = ['users', 'rooms', 'messages']

if (existsSync('.env')) process.loadEnvFile('.env')

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI is not set in infra/.env')
if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
  throw new Error('MONGODB_URI must start with mongodb+srv:// or mongodb://')
}

const client = new MongoClient(uri)
// The host name only. The URI holds the password.
const { srvHost, hosts } = client.options
console.log(`Atlas host: ${srvHost ?? hosts.map((h) => h.host).join(', ')}`)
console.log(`Database: ${DB_NAME}`)

try {
  const db = client.db(DB_NAME)

  async function printCounts(label: string) {
    console.log(label)
    for (const name of COLLECTIONS) {
      console.log(`  ${name}: ${await db.collection(name).countDocuments()}`)
    }
  }

  await printCounts('Documents now:')

  const rl = createInterface({ input: process.stdin, output: process.stderr })
  let answer: string
  try {
    answer = await rl.question(`This deletes ALL documents above. Type ${DB_NAME} to confirm: `)
  } finally {
    rl.close()
  }
  if (answer.trim() !== DB_NAME) {
    console.log('Stopped. Nothing was deleted.')
    process.exitCode = 1
  } else {
    for (const name of COLLECTIONS) await db.collection(name).deleteMany({})
    await printCounts('Documents after:')
  }
} finally {
  await client.close()
}
