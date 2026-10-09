import { MongoDBContainer } from '@testcontainers/mongodb'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string
  }
}

let container: Awaited<ReturnType<MongoDBContainer['start']>> | undefined

// Starts one Mongo for the whole project. Testcontainers removes it at the end.
export async function setup(project: TestProject) {
  container = await new MongoDBContainer('mongo:8').start()
  // One-node replica set: the clients must connect straight to it.
  project.provide('mongoUri', `${container.getConnectionString()}?directConnection=true`)
}

export async function teardown() {
  await container?.stop()
}
