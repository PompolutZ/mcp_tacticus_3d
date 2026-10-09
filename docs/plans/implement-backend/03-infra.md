# Step 3: Infra and first deploy

Detailed plan of step 3 in `docs/plans/implement-backend.md`. The design is in `docs/feature-backend.md` ("Infrastructure", "Secrets and config", "Database", "Deploy" → "From the user's machine") and `docs/feature-peer-to-peer.md` ("MongoDB connection").

## Goal

The API of step 2 runs in AWS Lambda and reaches the Atlas cluster. `infra/` defines every AWS resource in CDK. The user deploys from their machine with the deployer role. The API still has only `GET /health`, so a failed deploy points to CDK, roles, SSM or Atlas, not to routes. Step 4 moves the deploy to GitHub Actions, and uses the CI role that this step creates.

## Scope

In the step:
- `apps/api`: the Mongo store, the SSM reader, `lambda.ts` with the keep-alive event, `STORE=mongo` in `local.ts`, Mongo tests, `apps/api/.env.example`.
- `/health` returns 503 when the Mongo ping fails.
- `infra/`: the CDK app with `McpTacticusAccount` and `McpTacticusApi`, `put-secrets.ts`, `.env.example`, stack tests, `README.md` with all user commands.
- Root: `infra` in the workspace, `esbuild` as a root dev dependency.

Left for later steps:
- `.github/workflows/*`, the `gh` commands for the environment `prod` (step 4). The CI role is created now, because it is part of `McpTacticusAccount`.
- Indexes and collections (steps 6, 7, 8: each store creates its own indexes).
- The Discord SSM parameters (step 6). `put-secrets` already writes them when they are set.
- Web code that reads `VITE_API_URL` (step 6).
- Backend doc open questions 4 to 6.

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 3"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the web dev server or the API process.
- Do not run `aws`, `atlas`, `cdk deploy`, `cdk bootstrap` or `put-secrets`. Do not run any command with the user's AWS credentials. `cdk synth` runs without them (see phase 2 checks).
- Docker: the Mongo tests start and remove their own container with Testcontainers (decision 8). Docker must run. Start no other container.
- Do not commit and do not push. Leave all changes in the working tree.
- Temporary files go in the scratchpad: `/private/tmp/claude-501/-Users-olehlutsenko--dev-mcp-assist-3d/c73ce97d-fff7-40d5-acb9-917780e055b1/scratchpad/`.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: TypeScript, strict. Plain, short comments that say why. Match the style of `apps/api`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- Commands that pass arguments to a package script do not use `--` (step 1, decision 5).
- Never print, log or write a secret value: not in code, tests, docs, the **Result** or tool output.
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| Infra package | `infra/`, name `infra`, `"type": "module"`, private |
| API dependencies (new) | `mongodb` 7, `@hono/aws-lambda` 1. Dev: `@aws-sdk/client-ssm` 3, `@testcontainers/mongodb` 12 |
| Infra dependencies | `aws-cdk-lib` 2, `constructs` 10. Dev: `aws-cdk` (CLI), `@aws-sdk/client-ssm` 3, `@aws-sdk/credential-providers` 3, `typescript` 7, `tsx` 4, `vitest` 5, `@types/node` 24 |
| Root dev dependency | `esbuild` (latest 0.x) |
| Account and region | Account: from the AWS profile (`CDK_DEFAULT_ACCOUNT`). Region: `DEPLOY_REGION` in `infra/.env`, `eu-central-1` (decision 24) |
| Stacks | `McpTacticusAccount`, `McpTacticusApi` |
| Function | `mcptacticus-api` |
| Log group | `/aws/lambda/mcptacticus-api`, 1 week |
| Roles | `mcptacticus-deployer`, `mcptacticus-github-deploy` |
| Budget | `mcptacticus-monthly`, 1 USD |
| GitHub OIDC `sub` | `repo:PompolutZ@927235/mcp_tacticus_3d@1391287590:environment:prod` |
| Site origin | `https://mcptacticus3d.netlify.app` |
| SSM prefix | `/mcptacticus/prod/` |
| SSM parameters | `mongodb-uri`, `session-secret` now. `discord-client-id`, `discord-client-secret` in step 6 |
| Lambda env vars | `SSM_PREFIX=/mcptacticus/prod/`, `DB_NAME=assist3d`, `APP_VERSION`, `NODE_OPTIONS=--enable-source-maps` |
| Keep-alive event | `{ "keepAlive": true }`, once a day |
| Stack output | `ApiUrl` |
| CDK context (`cdk.json`) | `githubOidcProvider`: `"create"` or `"import"`. `reservedConcurrency`: a number, or `null` for none |
| `infra/.env` | `DEPLOY_REGION`, `BUDGET_EMAIL`, `MONGODB_URI`, `SESSION_SECRET`. Step 6: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| `apps/api/.env` | `STORE` (`memory` or `mongo`), `MONGODB_URI`, `DB_NAME` (default `assist3d`) |
| AWS profiles | `fxdx_admin` (admin user), `mcptacticus` (deployer role, with MFA) |
| Health response | 200 `{ ok: true, version, db: 'ok' \| 'none' }`. 503 `{ ok: false, version, db: 'error' }` |
| API scripts | `test`: `vitest run --project unit`. `test:mongo`: `vitest run --project mongo`. The rest unchanged |
| Infra scripts | `synth`: `cdk synth`. `cdk:deploy`: `cdk deploy McpTacticusApi --profile mcptacticus`. `cdk:deploy:account`: `cdk deploy McpTacticusAccount --profile fxdx_admin`. `put-secrets`: `tsx scripts/put-secrets.ts`. `typecheck`: `tsc`. `test`: `vitest run` |
| Mongo for tests | Testcontainers `MongoDBContainer('mongo:8')`, started by the `mongo` test project |
| Mongo for local dev (optional) | `docker run --rm -d --name assist3d-mongo -p 27017:27017 mongo:8`, `MONGODB_URI=mongodb://localhost:27017` |

Files:

```
pnpm-workspace.yaml          + infra, allowBuilds for ssh2, cpu-features, protobufjs
package.json                 + devDependency esbuild
apps/api/
  package.json               + mongodb, @hono/aws-lambda, @aws-sdk/client-ssm, @testcontainers/mongodb; test scripts
  vitest.config.ts           projects unit and mongo
  .env.example
  src/
    lambda.ts                Lambda entry
    local.ts                 + STORE=mongo
    config.ts                + loadSsmParams(), requireParam()
    routes/health.ts         + 503
    stores/store.ts          + close()
    stores/memory.ts         + close()
    stores/mongo.ts          createMongoStore(), isAtlasUri()
  test/
    app.test.ts              + 503 test
    config.test.ts           SSM reader
    mongo-store.test.ts      unreachable server returns 'error'
    mongo-setup.ts           globalSetup of the mongo project: starts and stops the container
    mongo.mongo.test.ts      against the Testcontainers mongo
infra/
  package.json
  tsconfig.json
  cdk.json
  .env.example
  README.md
  bin/app.ts
  lib/account-stack.ts
  lib/api-stack.ts
  scripts/put-secrets.ts
  test/account-stack.test.ts
  test/api-stack.test.ts
```

## Decisions that fill gaps in the design

1. **Health when Mongo fails.** `/health` returns 503 and `{ ok: false, version, db: 'error' }`. Reason: `curl --fail` and the CI check of step 4 see the failure. The body still shows the version.
2. **Mongo store.** `createMongoStore({ uri, dbName, serverSelectionTimeoutMS = 5000 })` creates one `MongoClient` with `maxPoolSize: 2`. The driver connects on the first command. `ping()` runs `{ ping: 1 }` on the database. It returns `'ok'`, or `'error'` after it logs the error name and message (never the URI). `close()` closes the client. Tests pass a short timeout. No indexes yet: no collection exists.
3. **`Store.close()`.** New in the interface. The memory store does nothing. Tests close the Mongo client, and `local.ts` closes it on `SIGINT` and `SIGTERM`. The Lambda never closes it.
4. **SSM reader.** In `config.ts`:
   - `loadSsmParams(prefix, client)` calls `GetParametersByPath` with `WithDecryption: true`. It follows `NextToken`. It returns the values by short name (`mongodb-uri`), without the prefix.
   - `requireParam(params, name)` throws `Missing SSM parameter <prefix><name>` when a value is missing.
   - `Config` keeps only what routes use: `version` now. The Mongo URI goes only to the store.
5. **`lambda.ts`.** ES module with top-level await. At cold start it reads the SSM parameters, creates the Mongo store and the app, and calls `handle(app)` from `@hono/aws-lambda`. The exported `handler` checks for `{ keepAlive: true }` first: it pings Mongo, logs `keep-alive <db>`, and returns `{ db }`. Every other event goes to Hono. If `@hono/aws-lambda` cannot be installed, use `hono/aws-lambda` and record the reason.
6. **Local Mongo.** `local.ts` uses the Mongo store when `STORE=mongo`. It stops with an error when `MONGODB_URI` is missing, or when `isAtlasUri()` is true (the host ends with `.mongodb.net`). Reason: the design says that local dev never connects to Atlas, and the Atlas string is in `infra/.env` on the same machine. The start line becomes `API on http://localhost:8787 (store: memory)`.
7. **`apps/api/.env.example`** comes now, because `STORE`, `MONGODB_URI` and `DB_NAME` come now. Step 2 had it in step 6.
8. **Test projects.** `apps/api/vitest.config.ts` has two projects.
   - `unit`: `test/**/*.test.ts` without `*.mongo.test.ts`. It needs no Docker.
   - `mongo`: `test/**/*.mongo.test.ts`. Its `globalSetup` (`test/mongo-setup.ts`) starts `MongoDBContainer('mongo:8')` from `@testcontainers/mongodb`, gives the URI to the tests with Vitest `provide`/`inject`, and stops the container at the end. The container is a one-node replica set, so the client connects with `directConnection: true`.
   - Each test file uses its own database name (`assist3d_test_<random>`), so files can run in parallel on one container.
   - Reasons: `pnpm test` stays fast and needs no Docker. `test:mongo` needs no manual `docker run` and no `MONGODB_URI`, and it cannot run against Atlas. CI (step 4) runs both. GitHub runners have Docker, so CI needs no `mongo` service container.
9. **Bundle.** `NodejsFunction` with:
   - `entry` `apps/api/src/lambda.ts`, `projectRoot` the repo root, `depsLockFilePath` the root `pnpm-lock.yaml`.
   - `format` ESM, `target` `node24`, `mainFields` `['module', 'main']`, `minify`, `sourceMap`, `sourcesContent: false`.
   - `banner` with `createRequire`, because the `mongodb` driver is CommonJS and calls `require` for Node built-ins.
   - `externalModules` `['@aws-sdk/*']`. The Node 24 runtime has AWS SDK v3.
   - If esbuild cannot resolve an optional `mongodb` dependency (`kerberos`, `snappy`, `@mongodb-js/zstd`, `mongodb-client-encryption`, `socks`, `aws4`, `gcp-metadata`), add it to `externalModules` and record it.
10. **Root `esbuild`.** A dev dependency of the root `package.json`, as the design says. CDK finds the lock file at the repo root, and runs esbuild from there with `pnpm exec`. The phase 2 synth shows local bundling, not Docker.
11. **`APP_VERSION`.** `bin/app.ts` sets it to `git rev-parse --short HEAD`. It adds `-dirty` when `git status --porcelain` is not empty. Reason: the user deploys from their machine, and `/health` must show when the deployed code was not committed.
12. **Budget email.** `bin/app.ts` loads `infra/.env` when it exists (`process.loadEnvFile`). It adds `McpTacticusAccount` only when `BUDGET_EMAIL` is set. Otherwise it prints `McpTacticusAccount skipped: BUDGET_EMAIL is not set in infra/.env` to stderr. Reason: CDK synthesizes every stack of the app, also for `cdk deploy McpTacticusApi`. CI (step 4) has no email and never deploys the account stack. The email is not in git.
13. **Deployer role.** Trust: the account root principal, with the condition `aws:MultiFactorAuthPresent: true`. So the trust policy names no IAM user, and the admin user's own policy allows the assume. Permissions:
    - `sts:AssumeRole` on `arn:aws:iam::<account>:role/cdk-*`, with the condition `iam:ResourceTag/aws-cdk:bootstrap-role` in `deploy`, `file-publishing`, `image-publishing`, `lookup`.
    - `ssm:PutParameter`, `ssm:GetParameter`, `ssm:GetParameters`, `ssm:GetParametersByPath`, `ssm:DeleteParameter` on `parameter/mcptacticus` and `parameter/mcptacticus/*`.
14. **CI role.** As in the design. Trust: the GitHub OIDC provider, `StringEquals` on `aud` and `sub` (see "Names"). Permission: the same `sts:AssumeRole` statement as the deployer role. No SSM permission.
15. **OIDC provider.** With context `githubOidcProvider: "create"`, the stack creates `OidcProviderNative` for `https://token.actions.githubusercontent.com`, client id `sts.amazonaws.com`, no thumbprint. With `"import"`, it uses `OidcProviderNative.fromOidcProviderArn` with the fixed ARN `arn:aws:iam::<account>:oidc-provider/token.actions.githubusercontent.com`. The user's check sets the value (see "User").
16. **Reserved concurrency.** Context `reservedConcurrency`: `10` if the account quota is above 110, `null` if not. The user's check sets the value.
17. **SSM read permission of the Lambda.** `ssm:GetParametersByPath` on `parameter/mcptacticus/prod` and `parameter/mcptacticus/prod/*`. `GetParametersByPath` checks the ARN of the path itself, so both are needed. No `kms:Decrypt`: the key policy of the AWS managed key `aws/ssm` allows every principal of the account that calls through SSM.
18. **Function URL output.** The function URL ends with `/`. The README says to set `VITE_API_URL` without it. Step 6's API client also removes a trailing `/`.
19. **`put-secrets.ts`.**
    - It loads `infra/.env`. It maps `MONGODB_URI` → `mongodb-uri`, `SESSION_SECRET` → `session-secret`, `DISCORD_CLIENT_ID` → `discord-client-id`, `DISCORD_CLIENT_SECRET` → `discord-client-secret`.
    - It writes each value that is set as a `SecureString` with `Overwrite: true`. It prints the names that it wrote and the names that it skipped. Never a value.
    - Checks before any write: `MONGODB_URI` starts with `mongodb+srv://` or `mongodb://`. `SESSION_SECRET` has at least 32 characters.
    - Credentials: `fromIni` with the profile `AWS_PROFILE` or `mcptacticus`, and an `mfaCodeProvider` that asks for the code on the terminal. Reason: the SDK does not ask for an MFA code on its own. Region `eu-central-1`.
20. **Feature flags.** `cdk.json` gets the `context` feature flags of a new project of the installed CLI: `cdk init app --language typescript --generate-only` in the scratchpad. Reason: a new CDK app should use the current defaults.
21. **Stack tests.** `infra/test/` uses `aws-cdk-lib/assertions` with a fixed account and region. The test app sets the context `aws:cdk:bundling-stacks` to `[]`, so the tests do not run esbuild. The phase 2 synth checks the bundle.
22. **Log format.** Text, the Lambda default. The one log line per request of step 2 stays as it is.
23. **`allowBuilds` for Testcontainers.** `pnpm-workspace.yaml` gets `ssh2: false`, `cpu-features: false` and `protobufjs: false`. `false` skips the scripts, and pnpm does not stop the install.
    - `dockerode` → `docker-modem` → `ssh2` → `cpu-features`: the install scripts build an optional native part with `node-gyp`. `ssh2` works without it, and the tests do not use SSH.
    - `dockerode` → `@grpc/grpc-js` → `@grpc/proto-loader` → `protobufjs@7`: the postinstall script only prints a warning when a parent package uses a version range without `~`. Added on 2026-10-09, after the first phase 1 install stopped on it.
24. **Region.** `bin/app.ts` and `put-secrets.ts` read the region from `DEPLOY_REGION` in `infra/.env`. There is no default: both stop with `DEPLOY_REGION is not set in infra/.env`. `.env.example` has `eu-central-1` and the comment that the region must be the region of the Atlas cluster. Reason: every API request goes from the Lambda to Atlas and back, and the Lambda reads the SSM parameters in its own region. The name is not `AWS_REGION`, because the AWS SDK and the CDK CLI read that variable themselves. CI (step 4) has no `infra/.env`, so the workflow sets `DEPLOY_REGION`. Added on 2026-10-09, after phase 2.

## User, before phase 2

Read-only checks with the admin profile. They answer backend doc open questions 1 to 3, and set the two context values. Paste the output (without secrets) to the agent.

```sh
aws sts get-caller-identity --profile fxdx_admin
aws iam list-mfa-devices --profile fxdx_admin --query 'MFADevices[].SerialNumber'
aws cloudformation describe-stacks --stack-name CDKToolkit --region eu-central-1 --profile fxdx_admin --query "Stacks[0].Outputs[?OutputKey=='BootstrapVersion'].OutputValue" --output text
aws iam list-open-id-connect-providers --profile fxdx_admin
aws lambda get-account-settings --region eu-central-1 --profile fxdx_admin --query AccountLimit.ConcurrentExecutions
```

1. `get-caller-identity`: the ARN must be an IAM user (`:user/`). If it is an SSO role, decision 13 needs a change.
2. `list-mfa-devices`: the serial goes into the `mcptacticus` profile. If the list is empty, the user adds an MFA device to the IAM user first.
3. `CDKToolkit`: a version number, or "does not exist". Either way, the user runs the bootstrap command of the README. It creates the stack or updates it.
4. OIDC providers: if the list has `token.actions.githubusercontent.com`, `githubOidcProvider` is `"import"`. Otherwise `"create"`.
5. Concurrency: above 110 → `reservedConcurrency: 10`. Otherwise `null`.

### Result

Answers of 2026-10-09:

1. Caller: the IAM user `fxdx_admin`. Decision 13 stays as it is.
2. MFA devices: none. An earlier setup had stopped before the device was enabled. The user added `arn:aws:iam::<account id>:mfa/<device name>` (Authenticator app) on 2026-10-09. This serial goes into `mfa_serial`.
3. `CDKToolkit`: bootstrap version 32. The region is bootstrapped already (by wuclub). The README bootstrap command (CDK CLI 2.1144.0) reported no changes on 2026-10-09, so version 32 is the current template.
4. OIDC providers: none. `githubOidcProvider` is `"create"`.
5. Lambda concurrency quota: 10. `reservedConcurrency` is `null`. The account quota still limits the cost of abuse and the Atlas connections (10 × 2 of 500). All functions of the account share these 10, also wuclub `apiv2`. AWS can raise the quota of a new account later. Then the limit is gone, and reserved concurrency 10 is possible again.

## Phase 1: API for Lambda and Mongo

Read: backend doc "API", "Secrets and config", "Database". Peer-to-peer doc "MongoDB connection". `@hono/aws-lambda` README. `mongodb` `MongoClient` options.

Work:
1. `pnpm-workspace.yaml`: decision 23. `pnpm --filter api add mongodb @hono/aws-lambda`, `pnpm --filter api add -D @aws-sdk/client-ssm @testcontainers/mongodb`.
2. `stores/store.ts`, `stores/memory.ts`: `close()` (decision 3).
3. `stores/mongo.ts`: decision 2, and `isAtlasUri(uri)`.
4. `config.ts`: decision 4.
5. `routes/health.ts`: decision 1.
6. `lambda.ts`: decision 5.
7. `local.ts`: decision 6.
8. `vitest.config.ts`, `test/mongo-setup.ts` and the scripts (decision 8).
9. `.env.example`: `STORE`, `MONGODB_URI`, `DB_NAME`, each with a one-line comment. The example URI is the Docker one.
10. Tests:
    - `app.test.ts`: a stub store whose `ping()` returns `'error'` → 503, `{ ok: false, version: 'test', db: 'error' }`.
    - `config.test.ts`: a fake SSM client with two pages → all values, by short name. `requireParam` with a missing name → the error names the parameter and contains no value.
    - `mongo-store.test.ts` (unit): `mongodb://127.0.0.1:1` with a 200 ms timeout → `'error'`. `isAtlasUri` → true for `mongodb+srv://u:p@cluster0.ab12c.mongodb.net/`, false for `mongodb://localhost:27017`.
    - `mongo.mongo.test.ts`: `ping()` → `'ok'`. `GET /health` with the Mongo store → 200 and `db: 'ok'`.
11. `README.md`, "Running locally": how to run the API with `mongo` in Docker (`STORE=mongo`). `pnpm --filter api test:mongo` needs Docker running, and starts its own container.

Checks:
- `pnpm install` prints no warning about build scripts. Copy any peer warnings into the **Result**.
- `pnpm --filter api typecheck` passes.
- `pnpm --filter api test` passes, and runs no Mongo test.
- `pnpm --filter api test:mongo` passes. After it, `docker ps` shows no `mongo` container. Record the run time and the first-run image pull in the **Result**.
- `git diff --stat apps/web` is empty.

### Result

Status: done.

Files changed:
- `pnpm-workspace.yaml`: `allowBuilds` has `ssh2`, `cpu-features`, `protobufjs` (all `false`).
- `apps/api/package.json`, `pnpm-lock.yaml`: new dependencies, test scripts.
- New in `apps/api/`: `vitest.config.ts`, `.env.example`, `src/lambda.ts`, `src/stores/mongo.ts`.
- Changed in `apps/api/src/`: `config.ts`, `local.ts`, `routes/health.ts`, `stores/store.ts`, `stores/memory.ts`.
- New in `apps/api/test/`: `config.test.ts`, `mongo-store.test.ts`, `mongo-setup.ts`, `mongo.mongo.test.ts`.
- Changed: `apps/api/test/app.test.ts` (503 test).
- Changed: `README.md` ("Running locally").

Facts:
- Installed: `mongodb@7.7.0`, `@hono/aws-lambda@1.0.0`, `@aws-sdk/client-ssm@3.1147.0`, `@testcontainers/mongodb@12.2.0`, `testcontainers@12.2.0`.
- `@grpc/grpc-js` and `protobufjs@7` come in through `dockerode` (Testcontainers). The first install stopped on the `protobufjs` script. Decision 23 now lists it.
- `pnpm install` prints no build script warning and no peer warning. It prints deprecation notes for `three-mesh-bvh@0.7.8` and `glob@10.5.0`.
- The `unit` project runs 14 tests in 3 files. It runs no Mongo test.
- Testcontainers found Docker Desktop with no `DOCKER_HOST` or other setting.
- `test:mongo`: first run 33 s (it includes the `mongo:8` pull, 838 MB). Second run 6 s.
- After `test:mongo`, `docker ps` shows no mongo container. The Ryuk helper (`testcontainers/ryuk`) stays up and is reused by the next run.
- `lambda.ts` only passes `tsc`. It cannot run locally.
- `requireParam(params, name, prefix = '')` has an optional third argument, so the error can show the full parameter path.
- `handler` is typed with `LambdaEvent` and `LambdaContext` from `@hono/aws-lambda`, plus a `KeepAliveEvent` type and a type guard. `lambda.ts` throws `SSM_PREFIX is not set` when the variable is missing.
- `isAtlasUri` is a case-insensitive regex on the whole string, so it also matches multi-host strings that `new URL` cannot parse.
- `mongo-setup.ts` types `inject('mongoUri')` with `declare module 'vitest'` (`ProvidedContext`).
- `mongo-setup.ts` provides the URI with `directConnection=true` already added. The tests use it as is.

Checks:
- `pnpm install`: no build script warning. Pass.
- `pnpm --filter api typecheck`: pass.
- `pnpm --filter api test` and root `pnpm test`: pass, 14 of 14, no Mongo test.
- `pnpm --filter api test:mongo`: pass, 2 of 2. No mongo container after it. Pass.
- `git diff --stat apps/web`: empty. Pass.
- `pnpm --filter web build`: pass.

Changes from the plan: `protobufjs: false` added to decision 23 (coordinator decision). `requireParam` has the optional `prefix` argument.

Open issues: none.

## Phase 2: The CDK app

Read: backend doc "Infrastructure", "Secrets and config", "Deploy" → "From the user's machine", "Security". CDK docs for `NodejsFunction`, `FunctionUrl`, `OidcProviderNative`, `aws-cdk-lib/assertions`.

Work:
1. `pnpm-workspace.yaml`: add `infra`. Root: `pnpm add -Dw esbuild` (decision 10).
2. `infra/package.json`, `infra/tsconfig.json` (extends `../tsconfig.base.json`, `types: ["node"]`, includes `bin`, `lib`, `scripts`, `test`). The dependencies in "Names". Use the latest versions that install. The CLI must be as new as the library or newer.
3. `cdk.json`: `"app": "tsx bin/app.ts"`, the feature flags (decision 20), and `githubOidcProvider` and `reservedConcurrency` from the user's checks.
4. `lib/api-stack.ts`: `ApiStack` with props `version` and `reservedConcurrency`. Function (decision 9, design "McpTacticusApi"), log group, function URL with CORS, SSM permission (decision 17), keep-alive rule, output `ApiUrl`.
5. `lib/account-stack.ts`: `AccountStack` with props `budgetEmail` and `githubOidcProvider`. Deployer role (decision 13), OIDC provider (decision 15), CI role (decision 14), budget (design "McpTacticusAccount": email at 80 % of the actual cost and at 100 % of the forecast).
6. `bin/app.ts`: env `{ account: CDK_DEFAULT_ACCOUNT, region: 'eu-central-1' }`, decisions 11 and 12.
7. `scripts/put-secrets.ts`: decision 19.
8. `.env.example`: the names of "Names" with empty values, and a comment for each. `SESSION_SECRET`: `openssl rand -base64 48`.
9. Tests (decision 21):
   - Api stack: runtime `nodejs24.x`, `arm64`, 256 MB, 10 s, name `mcptacticus-api`. Env vars are exactly the four of "Names". Function URL `NONE` with the CORS of the design. Both invoke permissions. Log retention 7 days. The rule: `rate(1 day)` and the input `{"keepAlive":true}`. The SSM policy of decision 17. Reserved concurrency set with `10`, and absent with `null`. Output `ApiUrl`.
   - Account stack: the deployer trust has the MFA condition. Both roles have only the bootstrap `sts:AssumeRole` statement, plus SSM for the deployer. The CI trust has the exact `aud` and `sub`. One OIDC provider with `"create"`, none with `"import"`. The budget: 1 USD, monthly, two email notifications.

Checks:
- `pnpm install`: no build script warning.
- `pnpm --filter infra typecheck` and `pnpm --filter infra test` pass.
- Synth without the user's credentials, with a test email: `AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null DEPLOY_REGION=eu-central-1 BUDGET_EMAIL=test@example.com pnpm --filter infra synth --quiet`. It passes. The output shows local bundling, not Docker. Record the bundle size of `index.mjs` and any esbuild warnings.
- `grep` of `infra/cdk.out` for the test email finds it only in the account template. No file in `cdk.out` contains `mongodb+srv` or `SESSION_SECRET`.
- Synth without `BUDGET_EMAIL` prints the skip line and passes.
- Root `pnpm typecheck` and `pnpm test` run in `api` and `infra`.
- `pnpm --filter web build` passes.

### Result

Status: done. Two checks differ from the plan (see "Checks").

Files changed:
- `pnpm-workspace.yaml`: `infra` in `packages`.
- `package.json`, `pnpm-lock.yaml`: `esbuild` 0.28.2 as a root dev dependency.
- New `infra/`: `package.json`, `tsconfig.json`, `cdk.json`, `.env.example`, `bin/app.ts`, `lib/api-stack.ts`, `lib/account-stack.ts`, `scripts/put-secrets.ts`, `test/api-stack.test.ts`, `test/account-stack.test.ts`.

Facts:
- Installed: `aws-cdk-lib@2.272.0`, `constructs@10.8.1`, `aws-cdk@2.1144.0` (CLI), `@aws-sdk/client-ssm@3.1147.0`, `@aws-sdk/credential-providers@3.1147.0`. The CLI accepted the library with no version error.
- `cdk.json`: `app` is `tsx bin/app.ts`. `context` has the feature flags from `cdk init app` of the installed CLI, plus `githubOidcProvider: "create"` and `reservedConcurrency: null` (the user's answers).
- `pnpm install` prints no build script warning and no peer warning. It prints the same two deprecation notes as phase 1.
- Bundle `index.mjs`: 832.0 kb (851,963 bytes). Source map 952.2 kb. esbuild printed no warning. Bundling was local, not Docker.
- No optional `mongodb` dependency needed `externalModules`. Only `@aws-sdk/*` is external.
- The banner with `createRequire` is the first line of `index.mjs`.
- `APP_VERSION` in the synthesized template was `<commit>-dirty`, because the tree had changes.
- The template of `McpTacticusApi` has no `ReservedConcurrentExecutions` (`null`).
- `ApiStack` and `AccountStack` use `formatArn` for the SSM ARNs. The account id in the tests is a fake one.
- Unit tests: 16 in 2 files. Typecheck passes.

Checks:
- `pnpm install`: no build script warning. Pass.
- `pnpm --filter infra typecheck` and `test`: pass.
- Synth without credentials, with the test email: pass, local bundling.
- Synth without `BUDGET_EMAIL`: prints the skip line, passes.
- Test email in `cdk.out`: found in `McpTacticusAccount.template.json` and also in `tree.json`. Differs from the plan. `tree.json` is the construct tree, and CDK does not upload it. Not in the Api template, not in the bundle.
- `mongodb+srv` in `cdk.out`: found in the bundle `index.mjs`, as string literals of the `mongodb` driver (the scheme check and its error text). Differs from the plan. It is driver code, no connection string. `SESSION_SECRET` is in no file.
- Root `pnpm typecheck` and `pnpm test`: pass in `api` (14 tests) and `infra` (16 tests).
- `pnpm --filter web build`: pass.
- `pnpm lint`: 0 errors, 44 warnings (the React ones in `apps/web`). `pnpm format:check`: pass.

Changes from the plan:
- After the phase, the user asked for the region as an env var with a comment. `DEPLOY_REGION` replaced the fixed `eu-central-1` in `bin/app.ts` and `put-secrets.ts` (decision 24). Synth without it stops with the error. Synth with it passes.
- `vitest/expect-expect` does not know that the `Template` methods assert. So `.oxlintrc.json` has an override for `infra/test/**`: `has*` and `resourceCountIs` count as assertions. The rule still finds a test that asserts nothing.
- `cdk.json` `watch.exclude` is the one of `cdk init`, without `yarn.lock` and with `cdk.out`.
- `cdk.out` was in `.gitignore` already.

Open issues: none.

## Phase 3: README and docs

Read: backend doc "Bootstrap", "Database", "Deploy" → "From the user's machine". Atlas CLI docs for `dbusers create`, `accessLists create`, `clusters connectionStrings describe`.

Work:
1. `infra/README.md`, in the order of the user's work. Each step: the command, what it does, and how to check it.
   1. Tools: AWS CLI, Atlas CLI (`brew install mongodb-atlas-cli`).
   2. The read-only checks of "User, before phase 2".
   3. Bootstrap: `pnpm --filter infra exec cdk bootstrap aws://<account id>/eu-central-1 --profile fxdx_admin`. The region is the `DEPLOY_REGION` of `infra/.env`.
   4. `infra/.env` from `.env.example`. Deploy `McpTacticusAccount`.
   5. The `mcptacticus` profile in `~/.aws/config` (backend doc, "From the user's machine"). Before it: if `fxdx_admin` has no MFA device, add one in the console (IAM → Users → `fxdx_admin` → Security credentials → Assign MFA device → Authenticator app). Then `aws iam list-mfa-devices --profile fxdx_admin` shows the serial for `mfa_serial`.
   6. Atlas: `atlas auth login`, find the project id, the database user `mcptacticus-api` with `readWrite@assist3d` and a password from `openssl rand -hex 24` (hex needs no URL encoding), the access list `0.0.0.0/0` with a comment, the connection string. Tell the user to check the flags with `--help`, because Atlas CLI flags change between versions.
   7. `MONGODB_URI` and `SESSION_SECRET` in `infra/.env`. `pnpm --filter infra put-secrets`.
   8. `pnpm --filter infra cdk:deploy`.
   9. Checks: `curl` of `/health`. The CORS preflight with `Origin: https://mcptacticus3d.netlify.app`, `Access-Control-Request-Method: GET` and `Access-Control-Request-Headers: authorization`. The keep-alive with `aws lambda invoke --function-name mcptacticus-api --payload '{"keepAlive":true}' --cli-binary-format raw-in-base64-out --profile fxdx_admin`. The logs with `aws logs tail /aws/lambda/mcptacticus-api --since 10m --profile fxdx_admin`.
   10. Netlify: `VITE_API_URL` = `ApiUrl` without the trailing `/`.
   11. Later deploys: only step 8. `cdk:deploy:account` only when `account-stack.ts` changes.
   12. Emergency stop: `aws lambda put-function-concurrency … --reserved-concurrent-executions 0`, and how to undo it.
   13. A new `session-secret` logs out every user (from step 6 on).
2. Root `README.md`: one line for `infra/` in "Project structure".
3. `docs/feature-backend.md`, "Open questions": mark 1 to 3 as answered, with the answers from "User, before phase 2".
4. A short **Result** under step 3 in `docs/plans/implement-backend.md`.

Checks:
- Every command in `infra/README.md` uses names from "Names". No account id, email or secret is in the README.
- `git status` shows only the files of this plan.

### Result

Status: done. The user's work is in section "User".

Files changed:
- New: `infra/README.md`.
- `README.md`: one line for `infra/` in "Project structure".
- `docs/feature-backend.md`: open questions 1 to 3 have the answers of 2026-10-09.
- `docs/plans/implement-backend.md`: **Result** of step 3.
- This plan: this **Result**, and the order of section "User".

Facts:
- The README commands read the account id into `$ACCOUNT` and the function URL into `$API_URL`. So the README has no account id and no URL.
- The AWS commands with `fxdx_admin` have `--region eu-central-1`, because the region of that profile can be another one. The README says to use the `DEPLOY_REGION` of `infra/.env` if it differs.
- The README has more checks than the plan: the two roles, the OIDC provider, the budget, the SSM parameter names (no values) and the log retention.
- The Atlas commands are not tested. The README says to check the flags with `--help`.

Checks:
- The README commands use only names of "Names". No account id, email or secret. Pass.
- `git status`: only the files above. Pass.
- `pnpm format:check`: pass. `pnpm lint`: 0 errors, 44 warnings (the same React ones).

Changes from the plan:
- `infra/.env` comes before the bootstrap in the README and in section "User". Reason: the bootstrap region is the `DEPLOY_REGION` of `infra/.env`.
- The README has a short section "If a check fails". It is not in the plan.

Open issues:
- The Lambda reads the SSM parameters only at cold start. After `put-secrets` with a new value, the running instances keep the old value. Only a deploy that changes the function starts new instances. The user chose on 2026-10-09: after `put-secrets`, commit a change and deploy. The README says this in "Later deploys". No command forces new instances.

## User

After phase 3, in the order of "First deploy commands" below:
1. `infra/.env` with `DEPLOY_REGION` and `BUDGET_EMAIL`. Bootstrap.
2. `pnpm --filter infra cdk:deploy:account`.
3. The `mcptacticus` profile.
4. Atlas: database user, access list, connection string.
5. `MONGODB_URI` and `SESSION_SECRET` in `infra/.env`. `pnpm --filter infra put-secrets`.
6. `pnpm --filter infra cdk:deploy`.
7. `curl <ApiUrl>health` returns `"db":"ok"` and the commit. The preflight returns `access-control-allow-origin: https://mcptacticus3d.netlify.app`. The keep-alive returns `{"db":"ok"}`.
8. Paste the `REPORT` line of the first request from the logs (it has `Init Duration` and `Duration`). It goes into the **Result**.
9. Netlify: set `VITE_API_URL`.

### Result

Done on 2026-10-09. The user ran items 1 to 9. All checks passed, and the user reported no problems.

Not recorded: the `REPORT` line of item 8. So the cold start time (risk 6) is not measured yet. Every cold start logs it, so a later check can measure it: `aws logs tail` with `--filter-pattern "Init Duration"`.

## First deploy commands

Moved from `infra/README.md` on 2026-10-09, after the first deploy. Use them again for a new AWS account or a new Atlas cluster. `infra/README.md` keeps the commands for a new machine and for later deploys.

The user runs these steps in this order. Coding agents do not run them.

The commands use the region `eu-central-1`, the `DEPLOY_REGION` of `.env.example`. If `infra/.env` has another region, use it in the commands.

### 1. Tools

```sh
brew install awscli mongodb-atlas-cli
```

The profile `fxdx_admin` must work: `aws sts get-caller-identity --profile fxdx_admin` shows the IAM user.

### 2. Read-only checks

The commands and what to do with each answer are in "User, before phase 2". The answers of 2026-10-09 are in its **Result**.

### 3. `infra/.env`

```sh
cp infra/.env.example infra/.env
```

Set `DEPLOY_REGION` and `BUDGET_EMAIL`. The other values come in steps 7 and 8.

### 4. Bootstrap

```sh
ACCOUNT=$(aws sts get-caller-identity --profile fxdx_admin --query Account --output text)
pnpm --filter infra exec cdk bootstrap aws://$ACCOUNT/eu-central-1 --profile fxdx_admin
```

- The bootstrap creates the `CDKToolkit` stack: an S3 bucket for the Lambda zip files, an ECR repository and 5 IAM roles. The deploys of both stacks use these roles.
- If the stack exists, the command updates it to the template of the installed CDK CLI. It keeps the options of the earlier bootstrap, because CDK uses the previous values of the parameters that the command does not set.
- The next steps use `$ACCOUNT` too. In a new terminal, set it again.
- It runs once. Run it again only when a deploy stops with an error that asks for a newer bootstrap version. A newer CDK version can need one.

Check: the `CDKToolkit` command of step 2 prints the bootstrap version.

### 5. Deploy `McpTacticusAccount`

```sh
pnpm --filter infra cdk:deploy:account
```

CDK shows the IAM changes and asks for a yes.

Check:

```sh
aws iam get-role --role-name mcptacticus-deployer --profile fxdx_admin --query Role.Arn --output text
aws iam get-role --role-name mcptacticus-github-deploy --profile fxdx_admin --query Role.Arn --output text
aws iam list-open-id-connect-providers --profile fxdx_admin
aws budgets describe-budget --account-id $ACCOUNT --budget-name mcptacticus-monthly --profile fxdx_admin --query Budget.BudgetLimit
```

The two role ARNs, one provider that ends with `token.actions.githubusercontent.com`, and a budget of 1 USD.

### 6. The profile `mcptacticus`

The deployer role trusts only a caller with MFA. If `fxdx_admin` has no MFA device, add one in the AWS console: IAM → Users → `fxdx_admin` → Security credentials → Assign MFA device → Authenticator app.

This command adds the profile to `~/.aws/config`. It reads the role ARN and the MFA serial from AWS, so the profile has no placeholders. Run it once. If the file has a `[profile mcptacticus]` already, delete that block first.

```sh
cat >> ~/.aws/config <<EOF

[profile mcptacticus]
role_arn = $(aws iam get-role --role-name mcptacticus-deployer --profile fxdx_admin --query Role.Arn --output text)
source_profile = fxdx_admin
mfa_serial = $(aws iam list-mfa-devices --profile fxdx_admin --query 'MFADevices[0].SerialNumber' --output text)
region = eu-central-1
EOF
```

The result has this form:

```ini
[profile mcptacticus]
role_arn = arn:aws:iam::<account id>:role/mcptacticus-deployer
source_profile = fxdx_admin
mfa_serial = arn:aws:iam::<account id>:mfa/<device name>
region = eu-central-1
```

- The role trusts the account, not a named user. The policy of `fxdx_admin` must allow `sts:AssumeRole`. An admin user has this permission.
- The commands with this profile ask for the MFA code. AWS accepts each code only once. When two commands ask within the same 30 seconds, wait for the next code.

Check:

```sh
aws sts get-caller-identity --profile mcptacticus
```

The ARN has `assumed-role/mcptacticus-deployer`.

### 7. Atlas

The Free cluster exists already (created in the Atlas UI). These commands add the database user and the IP access list. Atlas CLI flags change between versions, so check each command with `--help` first.

```sh
atlas auth login
atlas projects list
PROJECT=<id of the project of the cluster>
atlas clusters list --projectId $PROJECT
```

The database user `mcptacticus-api` with read and write access to the database `assist3d` only. A hex password needs no URL encoding in the connection string.

```sh
PW=$(openssl rand -hex 24)
atlas dbusers create --username mcptacticus-api --password "$PW" --role readWrite@assist3d --projectId $PROJECT
```

The access list allows every IP address, because the Lambda has no fixed IP address. A fixed address needs a NAT gateway, and a NAT gateway costs money.

```sh
atlas accessLists create 0.0.0.0/0 --type cidrBlock --comment "mcptacticus-api: Lambda has no fixed IP address" --projectId $PROJECT
```

The connection string:

```sh
atlas clusters connectionStrings describe <cluster name> --projectId $PROJECT
```

It prints `standardSrv`: `mongodb+srv://<cluster host>`. The JSON output of `atlas clusters list` has the same value. Build the full string in the same terminal, because `$PW` is there:

```sh
echo "mongodb+srv://mcptacticus-api:$PW@<cluster host>/"
```

Copy the output into `MONGODB_URI` in `infra/.env`. The string has the password, so do not paste it anywhere else.

Check:

```sh
atlas dbusers describe mcptacticus-api --projectId $PROJECT
atlas accessLists list --projectId $PROJECT
```

Atlas can need a few minutes to apply both.

A cluster created in the Atlas UI can have entries from "Auto Setup": a database user with `atlasAdmin` and an access list entry with the IP address of your machine. With `0.0.0.0/0`, that user can log in from any address. The app uses neither. Find and delete them:

```sh
atlas dbusers list --projectId $PROJECT
atlas dbusers delete <user name> --projectId $PROJECT
atlas accessLists delete <ip address>/32 --projectId $PROJECT
```

### 8. Secrets

```sh
openssl rand -base64 48
```

Copy the output into `SESSION_SECRET` in `infra/.env`. Then:

```sh
pnpm --filter infra put-secrets
```

- It asks for the MFA code.
- It writes each value of `infra/.env` that is set as an SSM `SecureString` under `/mcptacticus/prod/`.
- It prints the names that it wrote and the names that it skipped, never a value. Now: `Wrote: mongodb-uri, session-secret`. The Discord values come in step 6 of the plan.
- It stops before any write when `MONGODB_URI` does not start with `mongodb+srv://` or `mongodb://`, or when `SESSION_SECRET` has fewer than 32 characters.

Check (names and types only, no values):

```sh
aws ssm get-parameters-by-path --path /mcptacticus/prod/ --profile fxdx_admin --region eu-central-1 --query 'Parameters[].[Name,Type]' --output text
```

### 9. Deploy `McpTacticusApi`

```sh
pnpm --filter infra cdk:deploy
```

It asks for the MFA code. CDK bundles the Lambda with esbuild on this machine, shows the IAM changes and asks for a yes. At the end it prints `McpTacticusApi.ApiUrl`.

### 10. Checks

The URL of the API ends with `/`:

```sh
API_URL=$(aws cloudformation describe-stacks --stack-name McpTacticusApi --profile fxdx_admin --region eu-central-1 --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
```

Health:

```sh
curl -sS ${API_URL}health
```

It returns `{"ok":true,"version":"<commit>","db":"ok"}`. A version that ends with `-dirty` means that the deploy had uncommitted changes.

CORS preflight:

```sh
curl -sS -o /dev/null -D - -X OPTIONS ${API_URL}health \
  -H 'Origin: https://mcptacticus3d.netlify.app' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization'
```

The headers have `access-control-allow-origin: https://mcptacticus3d.netlify.app`.

Keep-alive:

```sh
aws lambda invoke --function-name mcptacticus-api --payload '{"keepAlive":true}' --cli-binary-format raw-in-base64-out --profile fxdx_admin --region eu-central-1 /dev/stdout
```

It prints `{"db":"ok"}`.

Logs:

```sh
aws logs tail /aws/lambda/mcptacticus-api --since 10m --profile fxdx_admin --region eu-central-1
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/mcptacticus-api --profile fxdx_admin --region eu-central-1 --query 'logGroups[].retentionInDays'
```

- The first command shows one line per request, `keep-alive ok`, and a `REPORT` line for each call. The `REPORT` line of the first call has `Init Duration`: the time of the cold start.
- The second command prints `[7]`.

### 11. Netlify

Set the Netlify env var `VITE_API_URL` to the `ApiUrl` without the trailing `/`:

```sh
echo ${API_URL%/}
```

Netlify: Site configuration → Environment variables → Add a variable. No web code reads it before step 6 of the plan.

## Done when

- `pnpm typecheck`, `pnpm test`, `pnpm --filter api test:mongo` (Docker running) and `pnpm --filter web build` pass.
- `cdk synth` passes without credentials.
- Both stacks are deployed. `/health` in AWS returns `db: "ok"`.
- The log group keeps logs for 1 week, and the budget exists.
- The answers to backend doc open questions 1 to 3 are in the **Result**.

## Risks and open questions

1. **CDK CLI and library versions.** Safe-chain shows the CLI 2.1144.0 and the library 2.272.0 (2026-10-09). If synth says that the CLI is too old for the library, use the newest library that the CLI accepts. Record it.
2. **ES module bundle.** Two parts can fail only in AWS: the `createRequire` banner for `mongodb`, and the import of `@aws-sdk/client-ssm` from the runtime. Both show as a cold start error in the logs. The fix for the second: bundle the SSM client (remove it from `externalModules`).
3. **KMS.** Decision 17 needs no `kms:Decrypt`. If the logs show `AccessDeniedException` from KMS, add `kms:Decrypt` with the condition `kms:ViaService` `ssm.eu-central-1.amazonaws.com`.
4. **MFA and SSO.** Decision 13 needs an IAM user with an MFA device. The user's checks show it before phase 2.
5. **Reserved concurrency.** A value that the quota does not allow fails the deploy. The user's check sets it before the deploy.
6. **Cold start.** SSM, the bundle and the first TLS connection to Atlas add time to the first request. The `Init Duration` of user check 8 measures it. If it is near the 10 s timeout, this needs a decision.
7. **Atlas CLI flags.** The agent cannot run the Atlas CLI. The user checks the README commands with `--help`.
8. **Testcontainers on macOS.** Testcontainers finds Docker Desktop through the Docker socket, and starts a helper container (Ryuk) that removes the test containers. If it cannot find the socket, the fix is `DOCKER_HOST` or `TESTCONTAINERS_*` env vars. Record what was needed.
