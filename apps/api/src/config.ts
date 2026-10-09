import type { SSMClient } from '@aws-sdk/client-ssm'
import { GetParametersByPathCommand } from '@aws-sdk/client-ssm'

// Only what routes use. The Mongo URI goes to the store, not here.
export interface DiscordConfig {
  clientId: string
  clientSecret: string
}

export interface Config {
  version: string
  sessionSecret: string
  // Null: Discord login is off (local only). The Lambda requires the values.
  discord: DiscordConfig | null
}

// The fallback secret comes from the caller. It must not live in a module that
// the Lambda imports.
export function configFromEnv(
  env: Record<string, string | undefined>,
  fallbackSessionSecret: string,
): Config {
  const { DISCORD_CLIENT_ID: clientId, DISCORD_CLIENT_SECRET: clientSecret } = env
  return {
    version: env.APP_VERSION ?? 'dev',
    sessionSecret: env.SESSION_SECRET || fallbackSessionSecret,
    discord: clientId && clientSecret ? { clientId, clientSecret } : null,
  }
}

// Reads all parameters under the prefix. Keys are short names, without the prefix.
export async function loadSsmParams(
  prefix: string,
  client: Pick<SSMClient, 'send'>,
): Promise<Record<string, string>> {
  const params: Record<string, string> = {}
  let next: string | undefined
  do {
    const res = await client.send(
      new GetParametersByPathCommand({ Path: prefix, WithDecryption: true, NextToken: next }),
    )
    for (const p of res.Parameters ?? []) {
      if (p.Name && p.Value !== undefined) params[p.Name.slice(prefix.length)] = p.Value
    }
    next = res.NextToken
  } while (next)
  return params
}

export function requireParam(params: Record<string, string>, name: string, prefix = ''): string {
  const value = params[name]
  if (value === undefined) throw new Error(`Missing SSM parameter ${prefix}${name}`)
  return value
}
