# Feature: Backend

Design. The order of the work is in `docs/plans/implement-backend.md`.

## Goal

The app gets a backend for login, online rooms, the table snapshot and signaling. The endpoints and the data are in `docs/feature-auth.md` and `docs/feature-peer-to-peer.md`. This doc describes the repo layout, the stack, the AWS resources, the deploy path and local development.

Every AWS resource is defined in code (CDK). Nobody creates or changes AWS resources in the AWS console.

## Summary

| Part | Choice |
|---|---|
| Repo | pnpm workspace: `apps/web`, `apps/api`, `infra`, `packages/*` |
| Language | TypeScript for `apps/api` and `infra`. The web app stays JavaScript |
| API | Hono 4 on one Lambda function URL |
| Runtime | Node.js 24 (`nodejs24.x`), arm64, 256 MB, 10 s timeout |
| Infra | AWS CDK v2 in TypeScript. Personal AWS account (profile `fxdx_admin`), region `eu-central-1`, one stage: prod |
| Database | New Atlas Free cluster in its own Atlas project, AWS `eu-central-1`, database `assist3d` |
| Secrets | SSM Parameter Store, `SecureString`. The Lambda reads them at cold start |
| Local dev | API in its own Node process (`@hono/node-server`). Vite forwards `/api` to it |
| Tests | Vitest. Route tests through `app.request()`. Mongo store tests with Testcontainers |
| Deploy | First from the user's machine with an assumed role. Then GitHub Actions with OIDC, on push to `main` |
| Web hosting | Netlify, `https://mcptacticus3d.netlify.app`. Build settings in `netlify.toml`, output in `apps/web/dist` |

## Repo layout

```
apps/web/            today's app: src, public, scripts, index.html, vite.config.js
apps/api/            Hono API
infra/               CDK app
packages/            empty at first
docs/                stays at the root, with README.md, ASSETS.md and CLAUDE.md
pnpm-workspace.yaml
package.json         root scripts, packageManager
tsconfig.base.json   shared TypeScript settings of api and infra
netlify.toml         Netlify build settings
```

- Package names are short: `web`, `api`, `infra`. So `pnpm --filter api test` works.
- The TTS migration scripts write into the web app's `src/`, so they move with it to `apps/web/scripts/`. `tools/` (AssetRipper; git ignores it) moves to `apps/web/tools/`.
- `packages/` gets code when web and api need the same code, for example the room code format. Not before.
- There is no Hono RPC client (`hc`). The web app is JavaScript, so the client types would check nothing. The web app calls the API with small `fetch` helpers in `apps/web/src/api/`.

### pnpm

- The root `package.json` pins the version in `packageManager`: an exact version, the latest pnpm 12 at the time of the move. Netlify reads this field. pnpm 11 and later download the pinned version when the installed one is different.
- `pnpm import` creates `pnpm-lock.yaml` from `package-lock.json`, so the versions stay the same. Then `package-lock.json` is deleted. CDK's `NodejsFunction` fails when one folder has two lock files.
- pnpm 11 and later stop the install when a package has an install script and no `allowBuilds` entry. `esbuild` has one, so `pnpm-workspace.yaml` has `allowBuilds: { esbuild: true }`. Testcontainers brings `ssh2`, `cpu-features` and `protobufjs`. Their scripts build an optional native part or only print a warning, so they get `false`.
- With pnpm, a package can import only the packages that it lists. Today's `src` and `scripts` import only listed packages. One exception: `scripts/dice-sim.mjs` loads Rapier by a fixed path inside `node_modules/@react-three/rapier/node_modules/`. pnpm keeps packages in another place, so the script must resolve this path from `@react-three/rapier`.
- No script is named `deploy`, because `pnpm deploy` is a built-in pnpm command.
- Root scripts: `pnpm dev` (web and api together), `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm format:check`.

## API

### Stack

- **Hono 4.** The Lambda adapter comes from the package `@hono/aws-lambda`. The import path `hono/aws-lambda` is deprecated and goes away in Hono 5. `@hono/aws-lambda` 1.0.1 was published on 2026-10-08. If its peer range needs Hono 5, use `hono/aws-lambda` until Hono 5 is stable.
- **TypeScript**, strict. CDK bundles it with esbuild for Lambda. Locally, `tsx` runs it.
- **zod** and `@hono/zod-validator` check request bodies, the same as wuclub `apiv2`.
- **`hono/jwt`** signs and checks the session token (HS256). It replaces `jose` from the auth doc. The token is the same, and the API has one dependency less.
- **`mongodb`**, the official driver.
- **`yjs`** merges the table snapshots on the server.
- **Vitest** for tests.

### Code

```
apps/api/src/
  app.ts          createApp({ store, config }): the Hono app. No Lambda code and no Node server code
  lambda.ts       Lambda entry: reads the config from SSM once, creates the Mongo store, handle(app).
                  Also answers the keep-alive event
  local.ts        Node entry for dev: @hono/node-server, memory or Mongo store, the dev login route
  config.ts       the config type. Read from SSM (Lambda) or from process.env (local)
  routes/         health, auth, me, rooms, table, signal
  middleware/     user (token check), errors
  stores/         store interfaces, and a memory and a Mongo version of each
apps/api/test/    Vitest: routes through app.request(), with the memory store
```

- `createApp` gets the store and the config as arguments. So tests, local dev and the Lambda run the same routes with different stores.
- Only `local.ts` adds the dev login route (`POST /auth/dev`). esbuild bundles only the code that `lambda.ts` imports, so the Lambda does not contain the route.

### Routes

- The function URL serves the app at its root, so the routes have no prefix. In dev, Vite forwards `/api/*` to the API and removes `/api`.
- `GET /health` returns `{ ok, version, db }`. `version` is the git commit of the deploy. `db` is the result of a Mongo `ping`. This is the first route, and it checks every deploy.
- The other routes are in the auth doc ("Endpoints") and the peer-to-peer doc ("Endpoints").

### Binary bodies

The table snapshot is binary (`application/octet-stream`). Lambda base64-encodes a binary request body, and the adapter decodes it. The adapter also base64-encodes a binary response. Lambda allows 6 MB per request and per response. The snapshot limit is 1 MB, so it fits, also after base64.

### Errors and logs

- `app.onError` returns `{ error }` as JSON, with the status code. An unknown error returns 500. Its message goes to the log, not to the browser.
- One log line per request: method, path, status, time. Never the `Authorization` header or a token.

## Infrastructure

### CDK

- `aws-cdk-lib` 2.x and the `aws-cdk` CLI. The CLI has its own version numbers (2.1xxx), and it must be as new as the library or newer. On 2026-10-08: library 2.272.0, CLI 2.1145.0.
- TypeScript, run by `tsx`: `cdk.json` has `"app": "tsx bin/app.ts"`.
- Account: the personal account (profile `fxdx_admin`). Region: `eu-central-1`, the region of the Atlas cluster. Every poll is one round trip from the Lambda to Atlas, so they must be close.
- One stage: prod. Local dev uses the memory store or `mongo` in Docker.
- The account id is not in git. CDK reads it from the AWS profile (`CDK_DEFAULT_ACCOUNT`).
- `esbuild` is a dev dependency in the root `package.json`. So CDK bundles the Lambda on the machine. Without it, CDK bundles in Docker.

### Stacks

| Stack | Contents | Who deploys it |
|---|---|---|
| `McpTacticusAccount` | Deployer role, GitHub OIDC provider, CI role, budget alert | The user, with the admin user `fxdx_admin`. It changes rarely |
| `McpTacticusApi` | Lambda, function URL, log group, SSM read permission, keep-alive rule | The user with the deployer role at first. From step 4 of the plan, CI |

### McpTacticusApi

- **Function.** `NodejsFunction`, `nodejs24.x`, arm64, 256 MB, 10 s timeout. arm64 costs 20 % less per GB-second, and all dependencies are plain JavaScript. The bundle is minified and has source maps. `@aws-sdk/*` is not bundled, because the Node runtime has AWS SDK v3.
- **Function URL.** Auth type `NONE`. Since October 2025, a function URL needs two invoke permissions. CDK 2.220.0 and later adds both.
- **CORS** is set in the function URL config only:
  - Origin: `https://mcptacticus3d.netlify.app`.
  - Headers: `authorization`, `content-type`, `x-after` (the signaling poll).
  - Methods: GET, POST, PUT, PATCH, DELETE.
  - `maxAge`: 86400 seconds. Browsers use less: Chrome keeps a preflight result for at most 2 hours.
  - Hono's `cors()` is not used. With both, every response gets each CORS header twice, and browsers reject it.
- **Preflight per URL.** Every request has an `Authorization` header, so the browser sends a preflight first. The browser keeps the preflight result per URL. Therefore the signaling poll URL must stay the same between polls: the poll sends `after` in the `x-after` header, not in the query.
- **Reserved concurrency** 10, if the account quota allows it. It limits the cost of abuse and the Atlas connections (10 × 2 of 500). AWS keeps 100 units unreserved, so the account quota must be above 110.
- **Log group** with 1 week retention.
- **Keep-alive.** An EventBridge rule calls the function once a day with `{ keepAlive: true }`, and the function pings Atlas. Atlas pauses a Free cluster after 30 days with no connections, and a hobby app can have a month with no players. This adds about 30 requests a month.
- **Env vars** (not secret): `SSM_PREFIX`, `DB_NAME`, `APP_VERSION` (the git commit).
- **Output** `ApiUrl`: the function URL. It goes into the Netlify env var `VITE_API_URL`.

### McpTacticusAccount

- **Deployer role** `mcptacticus-deployer`. The user assumes it from `fxdx_admin`, with MFA. It can only assume the CDK bootstrap roles and write SSM parameters under `/mcptacticus/`.
- **GitHub OIDC provider** (`iam.OidcProviderNative`). No thumbprint is needed: IAM checks GitHub's certificate itself. An account can have only one provider for `token.actions.githubusercontent.com`. If the account has one already, the stack imports it.
- **CI role** `mcptacticus-github-deploy`. It trusts only tokens of this repo for the GitHub environment `prod`. It can only assume the CDK bootstrap roles. The policy is the one in the CDK security guide: `sts:AssumeRole` with the condition `iam:ResourceTag/aws-cdk:bootstrap-role` in `deploy`, `file-publishing`, `image-publishing`, `lookup`.
- The repo was created after 2026-07-15, so GitHub uses the immutable subject format. The GitHub API confirms it (`use_immutable_subject: true`). The trust policy checks:
  - `aud` = `sts.amazonaws.com`
  - `sub` = `repo:PompolutZ@927235/mcp_tacticus_3d@1391287590:environment:prod`
  
  The old format `repo:PompolutZ/mcp_tacticus_3d:...` does not match.
- **Budget**: $1 per month. Email at 80 % of the actual cost and at 100 % of the forecast. The email address comes from `infra/.env`, not from git. The budget counts the whole account, wuclub included.

### Bootstrap

CDK needs `cdk bootstrap` once per account and region, with admin rights. It creates the `CDKToolkit` stack: an S3 bucket for the Lambda zip files, an ECR repository and 5 IAM roles. If wuclub `apiv2` was deployed to `eu-central-1` of this account, the bootstrap exists already.

## Secrets and config

| SSM parameter | Contents |
|---|---|
| `/mcptacticus/prod/mongodb-uri` | Atlas connection string, with the database user and password |
| `/mcptacticus/prod/discord-client-id` | Discord application id. The Discord terms count it as a credential |
| `/mcptacticus/prod/discord-client-secret` | Discord client secret |
| `/mcptacticus/prod/session-secret` | Key for the session token. Make it with `openssl rand -base64 48` |

- All four are `SecureString`. At cold start, the Lambda reads them with one `GetParametersByPath` call and keeps them in memory.
- CloudFormation cannot create `SecureString` parameters, so CDK does not create them. `infra/scripts/put-secrets.ts` writes them from `infra/.env` (git ignores it). The user runs it with the deployer profile.
- Lambda env vars are not used for secrets. CDK writes env var values in plain text into the template: in `cdk.out`, in the bootstrap S3 bucket, and in the Lambda console.
- Secrets Manager is not used, because it costs $0.40 per secret per month.
- Cost: standard parameters are free. The AWS managed key `aws/ssm` decrypts them. KMS gives 20,000 free requests a month, and the Lambda needs one per cold start.
- A new `session-secret` logs out every user (auth doc, "Session").
- Local dev reads the same values from `apps/api/.env` (git ignores it).

## Database

- An Atlas Free cluster (the old name is M0) in its own Atlas project, on AWS `eu-central-1`. It was created on 2026-10-08 in the Atlas UI. Atlas allows one Free cluster per project, so the second project can have its own.
- Database `assist3d`. The cluster is not shared with wuclub, so a problem in one cannot affect the other.
- `docs/plans/implement-backend/03-infra.md` ("First deploy commands") lists the Atlas CLI commands that set up the rest. So the setup can be repeated, and it is not done by clicks:
  - Database user `mcptacticus-api` with `readWrite@assist3d`.
  - IP access list `0.0.0.0/0`. The Lambda has no fixed IP address. A fixed address needs a NAT gateway, and a NAT gateway costs money.
- Atlas is not in CDK. The Atlas CloudFormation resources need the Atlas API key in Secrets Manager ($0.40 per month), and third-party extensions that are activated in the account.
- The connection rules of the peer-to-peer doc stay: one client per Lambda instance, `maxPoolSize: 2`, `serverSelectionTimeoutMS: 5000`, indexes created at cold start.

### Free cluster limits

| Limit | Use |
|---|---|
| 500 connections | At most 20 (10 instances × 2) |
| 100 operations per second | About 50 reads per second with 100 waiting hosts (peer-to-peer doc) |
| 10 GB in and 10 GB out per 7 days | About 25 MB of table writes per game, so about 400 games a week |
| 0.5 GB storage | About 5,000 rooms with a 100 KB table. Rooms and users have a 12-month TTL |
| No backups | Accepted. If the data is lost, players log in again, and online rooms are lost |
| Paused after 30 days with no connections | The keep-alive rule |

## Local development

| Part | Production | Local |
|---|---|---|
| Web | Netlify | Vite, `http://localhost:5173` |
| API | Lambda function URL | `tsx watch src/local.ts`, port 8787. Vite forwards `/api/*` to it |
| Store | Atlas | Memory (default), or `mongo` in Docker with `STORE=mongo` |
| Secrets | SSM | `apps/api/.env` |
| Discord | Redirect `https://mcptacticus3d.netlify.app/` | The same Discord application, redirect `http://localhost:5173/` |

- `pnpm dev` at the root starts both.
- The web app reads the API address from `VITE_API_URL`. In dev it is `/api`, set in `apps/web/.env.development`, which is in git because it is not secret. In production it is the function URL, set as a Netlify env var.
- In dev, the web app and the API have one origin, so there is no CORS. CORS is tested only against the deployed API.
- Local dev never connects to Atlas. So a bug in local code cannot change production data.
- This replaces the Vite plugin of the peer-to-peer doc and the auth doc. The API is its own package with its own Node process. The same Hono app runs in Lambda and in Node, so no code needs to convert requests into Lambda events.

## Deploy

### From the user's machine

The user adds a profile to `~/.aws/config`:

```ini
[profile mcptacticus]
role_arn = arn:aws:iam::<account id>:role/mcptacticus-deployer
source_profile = fxdx_admin
mfa_serial = <the MFA device of fxdx_admin>
region = eu-central-1
```

- `pnpm --filter infra cdk:deploy` runs `cdk deploy McpTacticusApi` with `AWS_PROFILE=mcptacticus`. The CLI asks for the MFA code.
- `pnpm --filter infra cdk:deploy:account` runs `cdk deploy McpTacticusAccount` with `AWS_PROFILE=fxdx_admin`. Only when that stack changes.
- Coding agents do not run `aws`, `cdk deploy` or `cdk bootstrap`. They write the code and the commands, and the user runs them.

### GitHub Actions

- `.github/workflows/ci.yml` runs on pull requests and on pushes to `main`:
  - `pnpm install --frozen-lockfile`
  - `pnpm lint` and `pnpm format:check`
  - type checks and tests. The Mongo store tests start a `mongo` container with Testcontainers. GitHub runners have Docker.
  - the web build
  - `cdk synth`
- `.github/workflows/deploy-api.yml` runs on pushes to `main` that change `apps/api/**`, `infra/**`, `packages/**` or `pnpm-lock.yaml`. It also has a manual run button (`workflow_dispatch`).
  - It uses the GitHub environment `prod` and `permissions: id-token: write`.
  - `aws-actions/configure-aws-credentials@v6` assumes the role in `vars.AWS_DEPLOY_ROLE_ARN`.
  - Then it runs `cdk deploy McpTacticusApi --require-approval never`, and checks `GET /health` for the new version.
  - `concurrency: deploy-api`, so two deploys never run at the same time.
- The environment `prod` accepts only the `main` branch. `gh api` creates it, and `gh variable set` sets the role ARN. So no GitHub settings are changed by clicks, and the account id is not in git.
- CI never deploys `McpTacticusAccount`.
- The repo is public, so GitHub Actions minutes are free.

### Netlify

The site is `https://mcptacticus3d.netlify.app`. Netlify builds the web app from git, as today. The build settings move from the Netlify UI into `netlify.toml` at the repo root:

```toml
[build]
  command = "pnpm --filter web build"
  publish = "apps/web/dist"
  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- apps/web packages package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version"
```

- The build output moves from `dist` to `apps/web/dist`. Paths in `netlify.toml` are relative to the base directory. The base directory stays unset, so it is the repo root.
- Netlify installs at the repo root. It finds `pnpm-lock.yaml` there, so it uses pnpm. It takes the pnpm version from `packageManager` and the Node version from `.node-version`.
- `netlify.toml` overrides the build command and the publish directory of the UI. So the UI needs no change. The old UI values (`npm run build`, `dist`) are not used any more. Clear them, so nobody reads them by mistake.
- The file comes in the same commit as the move. Older commits build with the UI values, and the new commit builds with the file. So the move needs no timing with a Netlify setting.
- The package directory setting stays empty. It tells Netlify where to find `netlify.toml` and Netlify Functions in a subfolder, and this site has neither.
- `ignore`: Netlify skips the build when the commit changes none of the listed paths. Examples: a commit that changes only `apps/api`, `infra` or `docs`. `git diff --quiet` exits with 0 when nothing changed, and 0 means "skip".
- `public/_headers` moves to `apps/web/public/_headers`. Vite copies it into `apps/web/dist`, so the cache headers keep working.
- Env vars: `VITE_API_URL` from step 3 of the plan, `VITE_DISCORD_CLIENT_ID` at the first release (step 12). The web app shows the login button only when `VITE_DISCORD_CLIENT_ID` is set. So production shows no login until the first release.

## Cost

| Item | Cost |
|---|---|
| Lambda and function URL | $0 within 1M requests and 400,000 GB-seconds a month, "Always Free". The limit is per account, so wuclub `apiv2` uses the same free requests if it runs in this account |
| CloudWatch Logs | $0 within the free 5 GB a month, with 1 week retention |
| SSM and KMS | $0. Standard parameters are free. 20,000 free KMS requests a month |
| EventBridge rule | $0 |
| S3 (bootstrap bucket) | About 1 MB per deploy for the Lambda zip. Cents per year |
| AWS Budgets | $0 |
| Atlas | $0, Free cluster |
| GitHub Actions | $0, public repo |

## Security

- Secrets are never in git, in Lambda env vars or in logs.
- The CI role works only for `main` through the environment `prod`, and it can only assume the CDK bootstrap roles.
- The bootstrap CloudFormation role has admin rights by default. So a deploy from CI can change any resource in the account, wuclub included. This is accepted for now, because only the user pushes to `main`. `cdk bootstrap --cloudformation-execution-policies` can narrow it later.
- Reserved concurrency and the budget alert limit the cost of abuse. To stop all traffic at once, set reserved concurrency to 0.
- The rest is in the security sections of the auth doc and the peer-to-peer doc.

## Relation to other features

- `docs/feature-peer-to-peer.md`:
  - "Parts": the SAM template becomes the CDK stack `McpTacticusApi`. The secret is an SSM parameter, not a `NoEcho` parameter. The database is the new Free cluster, not the wuclub cluster. The Atlas user is created with the Atlas CLI.
  - "Local testing": the Vite plugin becomes the API process behind the Vite proxy. `npm run dev` becomes `pnpm dev`. `VITE_SIGNAL_URL` becomes `VITE_API_URL`.
  - "Endpoints": the poll sends `after` in a header (see "Preflight per URL").
  - "Code layout": `infra/signal/` becomes `apps/api/src/` (routes, stores) and `infra/` (CDK).
  - "Phases": the AWS parts of phase 5 move to steps 3 and 4 of the plan.
  - Open questions 3 (account), 5 (cluster tier and region), 6 (access list) and 7 (shared cluster) are answered here. Open question 1 (Cloudflare Worker) stays open. Hono also runs on Cloudflare Workers, so a later move is smaller.
- `docs/feature-auth.md`:
  - `jose` becomes `hono/jwt`.
  - The secrets are SSM parameters, not `NoEcho` parameters.
  - "Code layout": `infra/api/*.mjs` becomes `apps/api/src/`. The dev login is in `local.ts`, not in `vitePlugin.mjs`.
  - "Phases": the deploy starts earlier (plan steps 3 and 4). Phase 4 keeps the release parts.
  - "Site name": the rename happens in plan step 1, not before phase 4. The offline rooms on the old address are lost. Before the first release this does not matter, because all data is test data.
  - Open question 4 (region) is answered: `eu-central-1`.
- `docs/feature-rooms.md`: the `src/` paths become `apps/web/src/`.
- `CLAUDE.md`, `README.md`, `ASSETS.md`, `scripts/README.md`: the new paths, and `pnpm --filter web build` instead of `npx vite build`.

## Decisions

Made on 2026-10-08:

1. The repo becomes a pnpm workspace: `apps/web`, `apps/api`, `infra`, `packages/*`.
2. TypeScript for `apps/api` and `infra`. The web app stays JavaScript.
3. Hono 4 on one Lambda function URL.
4. CDK defines every AWS resource. No changes in the AWS console.
5. The existing personal AWS account, `eu-central-1`, one stage (prod).
6. A new Atlas Free cluster in its own project, AWS `eu-central-1`. Not shared with wuclub.
7. The backend is deployed early, as an API with only `GET /health`. After that, every backend step deploys when it is done. Login stays hidden in production until the first release.
8. The first deploys run from the user's machine with an assumed role. Then GitHub Actions with OIDC deploys on every push to `main` that changes the backend.
9. Secrets are SSM `SecureString` parameters, read at cold start.
10. `hono/jwt` instead of `jose`.
11. CORS only in the function URL config.
12. The local API is its own Node process behind the Vite proxy. No Vite plugin.
13. Atlas is set up with Atlas CLI commands, not with CDK.
14. The site is `https://mcptacticus3d.netlify.app`. Its build settings are in `netlify.toml` at the repo root, not in the Netlify UI.

## Open questions

1. **Bootstrap.** Is `eu-central-1` of this account bootstrapped already (by wuclub)? If yes, update it to the current bootstrap template.
   - Answered on 2026-10-09: yes, bootstrap version 32. The bootstrap command of the first deploy (CDK CLI 2.1144.0) reported no changes, so version 32 is the current template.
2. **GitHub OIDC provider.** Does the account have one already? If yes, the account stack imports it.
   - Answered on 2026-10-09: no. `cdk.json` has `githubOidcProvider: "create"`.
3. **Concurrency quota.** Is the account's Lambda concurrency quota above 110? If not, there is no reserved concurrency.
   - Answered on 2026-10-09: the quota is 10. `cdk.json` has `reservedConcurrency: null`. The quota of 10 still limits the cost of abuse and the Atlas connections (10 × 2 of 500). All functions of the account share it, also wuclub `apiv2`. AWS can raise the quota of a new account later. Then reserved concurrency 10 is possible again.
4. **Shared free tier.** How many Lambda requests does wuclub `apiv2` use per month in this account?
5. **CloudFormation execution policy.** Narrow it from admin rights to the services that the stacks use?
6. **Hono 5.** The first release candidate came out on 2026-10-08. Move to it when it is stable.

## Sources

- [Hono releases](https://github.com/honojs/hono/releases) and [Hono Lambda adapter source](https://github.com/honojs/hono/blob/main/src/adapter/aws-lambda/handler.ts): function URL events, base64 bodies, `hono/aws-lambda` deprecated.
- [Lambda function URL CORS](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html#urls-cors) and [function URL auth](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html): two invoke permissions since October 2025.
- [Lambda limits](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html): 6 MB payload, quotas of new accounts.
- [Lambda runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html): `nodejs24.x` is the latest GA runtime.
- [CDK versioning](https://docs.aws.amazon.com/cdk/v2/guide/versioning.html), [NodejsFunction](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs-readme.html), [bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html), [CDK security best practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices-security.html).
- [CDK SecretValue](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.SecretValue.html): Lambda env vars expose secrets.
- [SSM parameter in CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-ssm-parameter.html), [ssm-secure dynamic references](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/dynamic-references-ssm-secure-strings.html), [SSM pricing](https://aws.amazon.com/systems-manager/pricing/), [KMS pricing](https://aws.amazon.com/kms/pricing/), [Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/).
- [configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials), [GitHub OIDC in AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [immutable subject claims](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens), [IAM OIDC providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html).
- [Netlify monorepos](https://docs.netlify.com/build/configure-builds/monorepos/), [Netlify dependencies](https://docs.netlify.com/build/configure-builds/manage-dependencies/).
- [pnpm 11 release](https://github.com/pnpm/pnpm/releases/tag/v11.0.0), [pnpm 12 release](https://github.com/pnpm/pnpm/releases/tag/v12.0.0), [pnpm build settings](https://pnpm.io/settings/build).
- [Atlas Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [Atlas AWS regions](https://www.mongodb.com/docs/atlas/reference/amazon-aws/), [Atlas CLI clusters create](https://www.mongodb.com/docs/atlas/cli/current/command/atlas-clusters-create/), [Atlas CloudFormation resources](https://github.com/mongodb/mongodbatlas-cloudformation-resources).
- [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/) and [Free Tier plans](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html).
