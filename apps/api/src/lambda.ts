import { SSMClient } from '@aws-sdk/client-ssm'
import { handle, type LambdaContext, type LambdaEvent } from '@hono/aws-lambda'
import { createApp } from './app'
import { loadSsmParams, requireParam, type Config } from './config'
import { createMongoStore } from './stores/mongo'

interface KeepAliveEvent {
  keepAlive: true
}

function isKeepAlive(event: unknown): event is KeepAliveEvent {
  return typeof event === 'object' && event !== null && (event as KeepAliveEvent).keepAlive === true
}

// Cold start: read the secrets once, then keep the app and the store.
const prefix = process.env.SSM_PREFIX
if (!prefix) throw new Error('SSM_PREFIX is not set')
const params = await loadSsmParams(prefix, new SSMClient({}))
const store = createMongoStore({
  uri: requireParam(params, 'mongodb-uri', prefix),
  dbName: process.env.DB_NAME ?? 'assist3d',
})
// Phase 2 replaces this with configFromSsm.
const config: Config = {
  version: process.env.APP_VERSION ?? 'dev',
  sessionSecret: requireParam(params, 'session-secret', prefix),
  discord: null,
}
const handleHttp = handle(createApp({ store, config, discord: null }))

// A daily ping gives Atlas a connection. Atlas pauses a Free cluster after 30 days with none.
export const handler = async (event: LambdaEvent | KeepAliveEvent, context?: LambdaContext) => {
  if (isKeepAlive(event)) {
    const db = await store.ping()
    console.log(`keep-alive ${db}`)
    return { db }
  }
  return handleHttp(event, context)
}
