import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fromIni } from '@aws-sdk/credential-providers'

const PREFIX = '/mcptacticus/prod/'
// infra/.env name -> SSM parameter name
const PARAMS: Record<string, string> = {
  MONGODB_URI: 'mongodb-uri',
  SESSION_SECRET: 'session-secret',
  DISCORD_CLIENT_ID: 'discord-client-id',
  DISCORD_CLIENT_SECRET: 'discord-client-secret',
}

if (existsSync('.env')) process.loadEnvFile('.env')

// The Lambda reads the parameters in its own region (see .env.example).
const region = process.env.DEPLOY_REGION
if (!region) throw new Error('DEPLOY_REGION is not set in infra/.env')

const values = new Map<string, string>()
const skipped: string[] = []
for (const [envName, param] of Object.entries(PARAMS)) {
  const value = process.env[envName]
  if (value) values.set(param, value)
  else skipped.push(param)
}

// Checks run before any write. Messages name the variable, never the value.
const uri = values.get('mongodb-uri')
if (uri !== undefined && !/^mongodb(\+srv)?:\/\//.test(uri)) {
  throw new Error('MONGODB_URI must start with mongodb+srv:// or mongodb://')
}
const secret = values.get('session-secret')
if (secret !== undefined && secret.length < 32) {
  throw new Error('SESSION_SECRET must have at least 32 characters')
}

// The SDK does not ask for an MFA code on its own.
const credentials = fromIni({
  profile: process.env.AWS_PROFILE ?? 'mcptacticus',
  mfaCodeProvider: async (serial) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr })
    try {
      return await rl.question(`MFA code for ${serial}: `)
    } finally {
      rl.close()
    }
  },
})
const client = new SSMClient({ region, credentials })

const written: string[] = []
for (const [param, value] of values) {
  await client.send(
    new PutParameterCommand({
      Name: PREFIX + param,
      Value: value,
      Type: 'SecureString',
      Overwrite: true,
    }),
  )
  written.push(param)
}
console.log(`Wrote: ${written.join(', ') || 'none'}`)
console.log(`Skipped (not set): ${skipped.join(', ') || 'none'}`)
