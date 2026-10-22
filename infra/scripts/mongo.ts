import { existsSync } from 'node:fs'
import { MongoClient } from 'mongodb'

// Loads infra/.env (if there) and returns a client for MONGODB_URI. Throws if the URI is missing or not a Mongo URI.
export function mongoClient(): MongoClient {
  if (existsSync('.env')) process.loadEnvFile('.env')
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set in infra/.env')
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGODB_URI must start with mongodb+srv:// or mongodb://')
  }
  return new MongoClient(uri)
}

export const DB_NAME = '[REDACTED:DB_NAME]'
