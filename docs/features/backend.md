# Feature: Backend

Status: partly built.

Not built yet:

- The GitHub Actions workflows (`ci.yml`, `deploy-api.yml`). Every deploy is from the user's machine.
- `GET /ice` (ICE servers and TURN credentials), see `docs/features/peer-to-peer.md`.

The order of the work is in `docs/plans/implement-backend.md`.

## Goal

The app gets a backend for login, multiplayer rooms, the table snapshot and signaling. The endpoints and the data are in `docs/features/auth.md` and `docs/features/peer-to-peer.md`. This doc describes the repo layout, the stack, the AWS resources, the deploy path and local development.

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
| Web hosting | Netlify, `https://herotable3d.netlify.app`. Build settings in `netlify.toml`, output in `apps/web/dist` |

## Repo layout

```
apps/web/            the web app: src, public, scripts, index.html, vite.config.js
apps/api/            Hono API
infra/               CDK app
packages/            empty until web and api share code
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

- The root `package.json` pins the version in `packageManager`: an exact version of pnpm 12. Netlify reads this field. pnpm 11 and later download the pinned version when the installed one is different.
- The only lock file is `pnpm-lock.yaml`. CDK's `NodejsFunction` fails when one folder has two lock files.
- pnpm 11 and later stop the install when a package has an install script and no `allowBuilds` entry. `esbuild` has one, so `pnpm-workspace.yaml` has `allowBuilds: { esbuild: true }`. Testcontainers brings `ssh2`, `cpu-features` and `protobufjs`. Their scripts build an optional native part or only print a warning, so they get `false`.
- With pnpm, a package can import only the packages that it lists. `src` and `scripts` of the web app import only listed packages. `scripts/dice-sim.mjs` resolves the Rapier path from `@react-three/rapier`, because pnpm keeps packages in another place than a fixed path in `node_modules`.
- No script is named `deploy`, because `pnpm deploy` is a built-in pnpm command.
- Root scripts: `pnpm dev` (web and api together), `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm format:check`.

## API

### Stack

- **Hono 4.** The Lambda adapter comes from the package `@hono/aws-lambda`. The import path `hono/aws-lambda` is deprecated and goes away in Hono 5. `@hono/aws-lambda` 1.0.1 was published on 2026-10-08. If its peer range needs Hono 5, use `hono/aws-lambda` until Hono 5 is stable.
- **TypeScript**, strict. CDK bundles it with esbuild for Lambda. Locally, `tsx` runs it.
- **zod** and `@hono/zod-validator` check request bodies, the same as wuclub `apiv2`. The code imports `zod/mini` (`zod@4.6.5`, `@hono/zod-validator@0.9.1`). The Lambda `index.mjs` is 883 KB with `zod/mini`, and 1.32 MB with full `zod` With `yjs` it is 956 KB. `yjs` adds about 73 KB.
- **`hono/jwt`** signs and checks the session token (HS256). The API needs no extra JWT package.
- **`mongodb`**, the official driver.
- **`yjs`** (`13.6.33`, the version of the web app) checks and merges the table snapshots on the server (`Y.decodeUpdate`, `Y.mergeUpdates`).
- **Vitest** for tests.

### Code

```
apps/api/src/
  app.ts          createApp({ store, config }): the Hono app. No Lambda code and no Node server code
  lambda.ts       Lambda entry: reads the config from SSM once, creates the Mongo store, handle(app).
                  Also answers the keep-alive event
  local.ts        Node entry for dev: @hono/node-server, memory or Mongo store, the dev login route
  config.ts       the config type. Read from SSM (Lambda) or from process.env (local)
  auth/           token (session token), discord (Discord client)
  routes/         health, errors (POST of client error reports), events (POST of usage events), auth, devAuth (local only), me, board (GET and PUT of /me/board, GET of /me/board/image), rooms (room and seat routes, GET of /rooms/{code}/image), table (GET and PUT of the snapshot), signal (POST and GET of the messages)
  rooms/          code (room code), table (Yjs check and merge), read (room read, 404, host-gone cleanup), seats (seat cache, 30 s per room)
  middleware/     user (token check and user read), session (token check only, for polls), validate (body check), errors, log
  stores/         store interfaces, and a memory and a Mongo version of each
apps/api/test/    Vitest: routes through app.request(), with the memory store
```

- `createApp` gets the store and the config as arguments. So tests, local dev and the Lambda run the same routes with different stores.
- Only `local.ts` adds the dev login route (`POST /auth/dev`). esbuild bundles only the code that `lambda.ts` imports, so the Lambda does not contain the route.

### Routes

- The function URL serves the app at its root, so the routes have no prefix. In dev, Vite forwards `/api/*` to the API and removes `/api`.
- `GET /health` returns `{ ok, version, db }`. `version` is the git commit of the deploy. `db` is the result of a Mongo `ping`. This is the first route, and it checks every deploy.
- `POST /errors` takes an error report from the browser. No login. See "Error reports".
- `POST /events` takes a usage event from the browser. No login. See "Events".
- The other routes are in the auth doc ("Endpoints") and the peer-to-peer doc ("Endpoints").

### Binary bodies

The table snapshot is binary (`application/octet-stream`). Lambda base64-encodes a binary request body, and the adapter decodes it. The adapter also base64-encodes a binary response. Lambda allows 6 MB per request and per response. The snapshot limit is 1 MB, so it fits, also after base64. `apps/api/test/lambda-binary.test.ts` sends a fake function URL event through the adapter and checks both directions.

### Errors and logs

- `app.onError` returns `{ error }` as JSON, with the status code. An unknown error returns 500. Its message goes to the log, not to the browser.
- One log line per request: method, path, status, time. Never the `Authorization` header or a token.

## Infrastructure

### CDK

- `aws-cdk-lib` 2.x and the `aws-cdk` CLI. The CLI has its own version numbers (2.1xxx), and it must be as new as the library or newer. The versions in use are in `package.json` of `infra`.
- TypeScript, run by `tsx`: `cdk.json` has `"app": "tsx bin/app.ts"`.
- Account: the personal account (profile `fxdx_admin`). Region: `eu-central-1`, the region of the Atlas cluster. Every poll is one round trip from the Lambda to Atlas, so they must be close.
- One stage: prod. Local dev uses the memory store or `mongo` in Docker.
- The account id is not in git. CDK reads it from the AWS profile (`CDK_DEFAULT_ACCOUNT`).
- `esbuild` is a dev dependency in the root `package.json`. So CDK bundles the Lambda on the machine. Without it, CDK bundles in Docker.

### Stacks

| Stack | Contents | Who deploys it |
|---|---|---|
| `McpTacticusAccount` | Deployer role, GitHub OIDC provider, CI role, budget alert | The user, with the admin user `fxdx_admin`. It changes rarely |
| `McpTacticusApi` | Lambda, function URL, log group, SSM read permission, keep-alive rule | The user with the deployer role. CI deploy is not built yet |

### McpTacticusApi

- **Function.** `NodejsFunction`, `nodejs24.x`, arm64, 256 MB, 10 s timeout. arm64 costs 20 % less per GB-second, and all dependencies are plain JavaScript. The bundle is minified and has source maps. `@aws-sdk/*` is not bundled, because the Node runtime has AWS SDK v3.
- **Function URL.** Auth type `NONE`. Since October 2025, a function URL needs two invoke permissions. CDK 2.220.0 and later adds both.
- **CORS** is set in the function URL config only:
  - Origin: `https://herotable3d.netlify.app`.
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
- `infra/scripts/delete-test-data.ts` (`pnpm --filter infra delete-test-data`) deletes all documents in `users`, `rooms`, `messages`, `customBoards`, `events` and `salts` of the database `assist3d`, and keeps the indexes. It reads `MONGODB_URI` from `infra/.env`, and asks to type `assist3d`. The user runs it once, before the first release. It needs `mongodb` as a dev dependency of `infra`.
- Lambda env vars are not used for secrets. CDK writes env var values in plain text into the template: in `cdk.out`, in the bootstrap S3 bucket, and in the Lambda console.
- Secrets Manager is not used, because it costs $0.40 per secret per month.
- Cost: standard parameters are free. The AWS managed key `aws/ssm` decrypts them. KMS gives 20,000 free requests a month, and the Lambda needs one per cold start.
- A new `session-secret` logs out every user (auth doc, "Session").
- Local dev reads the same values from `apps/api/.env` (git ignores it).

### Error reports

- The browser sends a report on an uncaught error, an unhandled rejection or a scene error (`apps/web/src/crash/reporter.js`). At most 5 per page load, the same message once, query strings cut from the text. A failed send is ignored.
- `POST /errors` has no login. The body has only these fields, all strings: `message` (max 500), `stack` (max 8000), `version` (max 64), `agent` (max 300), and optional `room` (max 16) and `side` (`host`, `guest` or `none`). An unknown field or a wrong type gives 400. A body over 16 KB gives 413, checked before parsing. A good report gives 204.
- The route builds the stored document field by field and sets `time` itself. The request body is never stored as it is, so no `$` operator or nested object reaches Mongo.
- Limit: 20 reports a minute for each IP address, in the memory of the Lambda instance. More gives 429. The address is the key of the limit only and is never stored. The map holds at most 2000 addresses. A cold instance starts empty, so this is a brake and not a wall. Reserved concurrency and the budget alert cover the rest.
- No CORS change: the function URL already allows `POST` and the `content-type` header.
- Store: `errors.add` and `errors.latest`. Memory keeps the last 200. Mongo uses the collection `errors`, capped at 10 MB, so Mongo deletes the oldest reports when it is full. No TTL. The store creates it with the indexes, before the first call, when it is missing.
- Read the reports with `pnpm --filter infra errors [count]` (default 20, newest first). It reads the Mongo URI from the infra env file, like `delete-test-data`. It strips control characters and terminal escape codes before it prints, because a browser can send any text.
- Read the usage counts with `pnpm --filter infra stats [days]` (default 30, newest day first). See `docs/features/analytics.md`.

### Events

- `POST /events` has no login and does not read the token. The body has `name` (one of the event names), optional `kind` (`solo` or `versus`) and `version` (string, longest in `MAX_VERSION`, `apps/api/src/stores/store.ts`). An unknown field, name or kind gives 400. A body over the limit (`MAX_BODY` in `apps/api/src/routes/events.ts`) gives 413. A good event gives 204. The lists are in `apps/api/src/stores/store.ts`. Intent and reasons: `docs/features/analytics.md`.
- A user agent that matches `bot|crawler|spider|headless` gets 204 and nothing is stored.
- The route builds the stored document field by field: `{ time, name, kind?, version, visitor, expiresAt }`. `visitor` is a short cut of `sha256(salt, ip, userAgent)` (`visitorHash` in `apps/api/src/routes/events.ts`). The salt is the one of the UTC day. The IP and the agent are never stored.
- Limit: `LIMIT_PER_MINUTE` events a minute for each IP address (`apps/api/src/routes/events.ts`), in the memory of the Lambda instance, with the same code as `POST /errors` (`apps/api/src/middleware/rateLimit.ts`). More gives 429.
- Store: `events.add` and `salts.forDay`. Mongo keeps the salt of the current day in the instance memory, so it asks Mongo once a day. The first instance of a day inserts the salt with `$setOnInsert`, the others read the same one.
- Indexes are created with the others: a TTL index on `events.expiresAt` and a TTL index on `salts.expiresAt`.

## Database

- An Atlas Free cluster (the old name is M0) in its own Atlas project, on AWS `eu-central-1`. It was created in the Atlas UI. Atlas allows one Free cluster per project, so the second project can have its own.
- Database `assist3d`. The cluster is not shared with wuclub, so a problem in one cannot affect the other.
- `docs/plans/implement-backend/03-infra.md` ("First deploy commands") lists the Atlas CLI commands that set up the rest. So the setup can be repeated, and it is not done by clicks:
  - Database user `mcptacticus-api` with `readWrite@assist3d`.
  - IP access list `0.0.0.0/0`. The Lambda has no fixed IP address. A fixed address needs a NAT gateway, and a NAT gateway costs money.
- Atlas is not in CDK. The Atlas CloudFormation resources need the Atlas API key in Secrets Manager ($0.40 per month), and third-party extensions that are activated in the account.
- Collections: `users`, `rooms`, `messages`, `customBoards`, `errors` (see "Error reports"), `events` and `salts` (see "Events"). `events` holds `{ time, name, kind?, version, visitor, expiresAt }`. `salts` holds `{ _id: day (YYYY-MM-DD), salt, expiresAt }`, deleted after `SALT_TTL_MS`. `customBoards` holds one record per user: `{ _id: userId, board, updatedAt, hasImage, image }` (`board.author`: the display name of the user at the last save; `image`: the top view as BSON binary, a WebP of at most 150 KB; a record saved before the images has neither `image` nor `hasImage`), no extra index. `boards.get` leaves `image` out (projection) and `boards.getImage` reads it. Binary responses such as `image/webp` go through the Lambda adapter base64 encoded (`test/lambda-binary.test.ts`). `DELETE /me` deletes it. A room on the custom board keeps its own copy in the `rooms` record (`boardName`, `boardAuthor`, `hasImage`, `image` as BSON binary), copied from `customBoards` by `POST /rooms`; `rooms.get` and `listForUser` leave `image` out (projection) and `rooms.getImage` reads it. It goes with the room (delete, `DELETE /me`, TTL). `messages` holds the signaling messages: `{ _id, room, from, to, type, data, user, expiresAt }`. The `_id` is 13 digits of the server time in ms, `-`, and 8 random characters, so it sorts by time. Indexes: `{ room: 1, _id: 1 }` and the TTL index `{ expiresAt: 1 }` with `expireAfterSeconds: 0`. `expiresAt` is 1 hour after the write. `DELETE /rooms/{code}` and `DELETE /me` delete the messages too.
- The connection rules of the peer-to-peer doc stay: one client per Lambda instance, `maxPoolSize: 2`, `serverSelectionTimeoutMS: 5000`, indexes created at cold start.

### Free cluster limits

| Limit | Use |
|---|---|
| 500 connections | At most 20 (10 instances × 2) |
| 100 operations per second | About 50 reads per second with 100 waiting hosts (peer-to-peer doc) |
| 10 GB in and 10 GB out per 7 days | Estimate: about 25 MB of table writes per game, so about 400 games a week. Measured in the first production game (96 min): below 1 MB each way |
| 0.5 GB storage | About 5,000 rooms with a 100 KB table. Rooms and users have a 12-month TTL |
| No backups | Accepted. If the data is lost, players log in again, and multiplayer rooms are lost |
| Paused after 30 days with no connections | The keep-alive rule |

## Local development

| Part | Production | Local |
|---|---|---|
| Web | Netlify | Vite, `http://localhost:5173` |
| API | Lambda function URL | `tsx watch src/local.ts`, port 8787. Vite forwards `/api/*` to it |
| Store | Atlas | Memory (default), or `mongo` in Docker with `STORE=mongo` |
| Secrets | SSM | `apps/api/.env` |
| Discord | Redirect `https://herotable3d.netlify.app/` | The same Discord application, redirect `http://localhost:5173/` |

- `pnpm dev` at the root starts both.
- The dev Mongo: `pnpm --filter api db:up` starts `mongo:8` from `apps/api/compose.yaml`, with a named volume. Set `STORE=mongo` in `apps/api/.env`. The data survives restarts of the API, so testers stay logged in. `db:down` stops it and keeps the data. `docker compose down -v` in `apps/api` deletes it. Port `127.0.0.1:27017`, no password.
- The web app reads the API address from `VITE_API_URL`. In dev it is `/api`, set in `apps/web/.env.development`, which is in git because it is not secret. In production it is the function URL, set as a Netlify env var.
- In dev, the web app and the API have one origin, so there is no CORS. CORS is tested only against the deployed API.
- Local dev never connects to Atlas. So a bug in local code cannot change production data.
- The API is its own package with its own Node process. The same Hono app runs in Lambda and in Node, so no code needs to convert requests into Lambda events.

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
- Until the GitHub Actions workflows are built, every deploy is from the user's machine.
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

The site is `https://herotable3d.netlify.app`. Netlify builds the web app from git, as today. The build settings are in `netlify.toml` at the repo root, not in the Netlify UI:

```toml
[build]
  command = "pnpm --filter web build"
  publish = "apps/web/dist"
  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- apps/web packages package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version"
```

- The build output is `apps/web/dist`. Paths in `netlify.toml` are relative to the base directory. The base directory stays unset, so it is the repo root.
- Netlify installs at the repo root. It finds `pnpm-lock.yaml` there, so it uses pnpm. It takes the pnpm version from `packageManager` and the Node version from `.node-version`.
- `netlify.toml` overrides the build command and the publish directory of the UI. The UI values should be empty, so nobody reads them by mistake.
- The package directory setting stays empty. It tells Netlify where to find `netlify.toml` and Netlify Functions in a subfolder, and this site has neither.
- `ignore`: Netlify skips the build when the commit changes none of the listed paths. Examples: a commit that changes only `apps/api`, `infra` or `docs`. `git diff --quiet` exits with 0 when nothing changed, and 0 means "skip".
- `_headers` is in `apps/web/public/`. Vite copies it into `apps/web/dist`, so the cache headers keep working.
- Env vars: `VITE_API_URL` (the function URL) and `VITE_DISCORD_CLIENT_ID`. The web app shows the login button only when `VITE_DISCORD_CLIENT_ID` is set.

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
- `POST /errors` has no login. Its body is small and strict, it has a per-IP limit, and it is capped in size (see "Error reports"). `POST /events` is the same (see "Events").
- Reserved concurrency and the budget alert limit the cost of abuse. To stop all traffic at once, set reserved concurrency to 0.
- The rest is in the security sections of the auth doc and the peer-to-peer doc.

## Relation to other features

- `docs/features/peer-to-peer.md`: the signaling routes are routes of this API. The AWS parts (CDK stacks, Atlas database user, budget alert) are in this doc.
- `docs/features/auth.md`: login, users, multiplayer rooms and the table snapshot are routes of this API. The secrets are SSM parameters. The dev login is in `local.ts`.
- `docs/features/rooms.md`: multiplayer rooms are stored by this API.

## Decisions

1. The repo becomes a pnpm workspace: `apps/web`, `apps/api`, `infra`, `packages/*`.
2. TypeScript for `apps/api` and `infra`. The web app stays JavaScript.
3. Hono 4 on one Lambda function URL.
4. CDK defines every AWS resource. No changes in the AWS console.
5. The existing personal AWS account, `eu-central-1`, one stage (prod).
6. A new Atlas Free cluster in its own project, AWS `eu-central-1`. Not shared with wuclub.
7. Every backend change is deployed when its work is done. Login stays hidden in production until the first release.
8. The first deploys run from the user's machine with an assumed role. Then GitHub Actions with OIDC deploys on every push to `main` that changes the backend.
9. Secrets are SSM `SecureString` parameters, read at cold start.
10. `hono/jwt` instead of `jose`.
11. CORS only in the function URL config.
12. The local API is its own Node process behind the Vite proxy. No Vite plugin.
13. Atlas is set up with Atlas CLI commands, not with CDK.
14. The site is `https://herotable3d.netlify.app`. Its build settings are in `netlify.toml` at the repo root, not in the Netlify UI.

## Open questions

1. **Bootstrap.** Is `eu-central-1` of this account bootstrapped already (by wuclub)? If yes, update it to the current bootstrap template.
   - Answered: yes, bootstrap version 32. The bootstrap command of the first deploy (CDK CLI 2.1144.0) reported no changes, so version 32 is the current template.
2. **GitHub OIDC provider.** Does the account have one already? If yes, the account stack imports it.
   - Answered: no. `cdk.json` has `githubOidcProvider: "create"`.
3. **Concurrency quota.** Is the account's Lambda concurrency quota above 110? If not, there is no reserved concurrency.
   - Answered: the quota is 10. `cdk.json` has `reservedConcurrency: null`. The quota of 10 still limits the cost of abuse and the Atlas connections (10 × 2 of 500). All functions of the account share it, also wuclub `apiv2`. AWS can raise the quota of a new account later. Then reserved concurrency 10 is possible again.
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
