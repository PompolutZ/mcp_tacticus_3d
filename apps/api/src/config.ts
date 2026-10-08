export interface Config {
  version: string
}

export function configFromEnv(env: Record<string, string | undefined>): Config {
  return { version: env.APP_VERSION ?? 'dev' }
}
