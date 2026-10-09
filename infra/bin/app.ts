import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { App } from 'aws-cdk-lib'
import { AccountStack } from '../lib/account-stack'
import { ApiStack } from '../lib/api-stack'

if (existsSync('.env')) process.loadEnvFile('.env')

// A deploy from the user's machine can include uncommitted code. /health shows it.
function gitVersion(): string {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()
  const dirty = git('status', '--porcelain') !== ''
  return git('rev-parse', '--short', 'HEAD') + (dirty ? '-dirty' : '')
}

const app = new App()
// No default: the region must match the Atlas cluster (see .env.example).
const region = process.env.DEPLOY_REGION
if (!region) throw new Error('DEPLOY_REGION is not set in infra/.env')
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region }

const reservedConcurrency = app.node.tryGetContext('reservedConcurrency') ?? null
if (reservedConcurrency !== null && typeof reservedConcurrency !== 'number') {
  throw new Error('Context reservedConcurrency must be a number or null')
}
const githubOidcProvider = app.node.tryGetContext('githubOidcProvider')
if (githubOidcProvider !== 'create' && githubOidcProvider !== 'import') {
  throw new Error('Context githubOidcProvider must be "create" or "import"')
}

new ApiStack(app, 'McpTacticusApi', { env, version: gitVersion(), reservedConcurrency })

// CI has no email and never deploys this stack, so the email is not in git.
const budgetEmail = process.env.BUDGET_EMAIL
if (budgetEmail) {
  new AccountStack(app, 'McpTacticusAccount', { env, budgetEmail, githubOidcProvider })
} else {
  console.error('McpTacticusAccount skipped: BUDGET_EMAIL is not set in infra/.env')
}
