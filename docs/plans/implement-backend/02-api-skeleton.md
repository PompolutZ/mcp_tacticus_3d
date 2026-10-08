# Step 2: API skeleton, local

Detailed plan of step 2 in `docs/plans/implement-backend.md`. The design is in `docs/feature-backend.md` ("Repo layout", "pnpm", "API", "Local development").

## Goal

`apps/api` gets a small Hono app with one route, `GET /health`, and its tests. It runs locally next to the web app, behind the Vite proxy. Step 3 deploys this same app to Lambda. The app is small on purpose: the first deploy should find problems with CDK, roles and Atlas, not with routes. Later steps add routes and stores to this layout.

## Scope

In the step:
- `apps/api`: `createApp`, `GET /health`, the error and 404 handlers, the log line, the config, the store interface with the memory store, the local Node entry, Vitest tests.
- Root `tsconfig.base.json`.
- Root scripts: `pnpm dev` starts web and api together. `pnpm test`, `pnpm typecheck`.
- `apps/web`: the Vite proxy for `/api`, and `apps/web/.env.development`.
- `README.md`: how to run and check the API.

Left for later steps:
- `lambda.ts`, the SSM config, the Mongo store, `STORE=mongo`, `@hono/aws-lambda`, root `esbuild` (step 3).
- What `/health` returns when the Mongo ping fails (step 3, with the Mongo store).
- zod, `hono/jwt`, the user middleware, the dev login, `apps/api/.env.example` (step 6).
- Code in `apps/web/src/api/` that reads `VITE_API_URL` (the first step whose web code calls the API).

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 2"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the web dev server or the API process. The user checks them.
- Do not commit and do not push. Leave all changes in the working tree.
- Temporary files go in the scratchpad: `/private/tmp/claude-501/-Users-olehlutsenko--dev-mcp-assist-3d/c73ce97d-fff7-40d5-acb9-917780e055b1/scratchpad/`.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: TypeScript, strict. Plain, short comments that say why. Match the style of the code around you.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- Commands that pass arguments to a package script do not use `--` (step 1, decision 5).
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| API package | `apps/api/`, name `api`, `"type": "module"`, private |
| Dependencies | `hono` 4 (latest 4.x), `@hono/node-server` 2 (peer `hono ^4`) |
| Dev dependencies | `typescript` 7, `tsx` 4, `vitest` 5, `@types/node` 24 |
| Port | `8787`, fixed in `local.ts` and in the Vite proxy |
| Health response | `{ ok: true, version: string, db: DbStatus }` |
| `DbStatus` | `'none' \| 'ok' \| 'error'`. The memory store returns `'none'` |
| Error body | `{ error: string }` |
| Log line | `GET /health 200 3ms`: method, path without the query, status, time |
| Env vars | `APP_VERSION`. Not set locally, so `version` is `'dev'` |
| API scripts | `dev`: `tsx watch src/local.ts`. `test`: `vitest run`. `typecheck`: `tsc` |
| Root scripts | `dev`: `pnpm --parallel --filter web --filter api dev`. `build`: unchanged. `test`: `pnpm -r test`. `typecheck`: `pnpm -r typecheck` |
| Dev API address | `apps/web/.env.development`: `VITE_API_URL=/api` |

Files:

```
tsconfig.base.json
apps/api/
  package.json
  tsconfig.json
  src/
    app.ts                createApp({ store, config })
    local.ts              Node entry for dev
    config.ts             Config type, configFromEnv()
    routes/health.ts      GET /health
    middleware/log.ts     one log line per request
    middleware/errors.ts  onError and notFound handlers
    stores/store.ts       Store interface, DbStatus
    stores/memory.ts      createMemoryStore()
  test/
    app.test.ts
```

## Decisions that fill gaps in the design

1. **Store interface.** `Store` has one method now: `ping(): Promise<DbStatus>`. Later steps add the users, rooms and messages stores to it, each with a memory and a Mongo version. Reason: `/health` needs only the ping, and an interface with no users has nothing to check it.
2. **Config.** `Config` has one field now: `version`. `configFromEnv(env)` reads `APP_VERSION`, with `'dev'` when it is not set. Step 3 adds the SSM reader for Lambda, and each later step adds the fields that it uses. Reason: a field with no reader is a guess.
3. **Route files.** Each file in `routes/` exports a function that takes `{ store, config }` and returns a Hono sub-app. `app.ts` mounts them with `app.route('/', …)`. Reason: the same pattern works for all later routes, and each route file gets only what it needs.
4. **Errors.** In `middleware/errors.ts`:
   - `onError`: an `HTTPException` returns its status and `{ error: err.message }`. Any other error returns 500 and `{ error: 'Internal server error' }`, and `console.error` logs the error.
   - `notFound`: 404 and `{ error: 'Not found' }`.
5. **Log line.** An own middleware in `middleware/log.ts` logs one line per request with `console.log`, after the response. It logs the path without the query, and never a header. Reason: Hono's `logger()` prints two lines per request (in and out). Step 3's first deploy shows the line in CloudWatch.
6. **`.env` loading.** `local.ts` calls `process.loadEnvFile()` when `apps/api/.env` exists. It finds the file from `import.meta.url`, so the current folder does not matter. It loads the file before it reads the config. No `dotenv` package: Node 24 has this built in.
7. **TypeScript settings.** `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `target` and `lib` `ES2024`, `module` `Preserve` (implies `moduleResolution` `Bundler`), `noEmit`, `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck`. `apps/api/tsconfig.json` extends it, adds `"types": ["node"]`, and includes `src` and `test`. Reasons: tsx, esbuild and Vitest run the code, and `tsc` only checks it. So imports have no file extensions, the same as the web app. `types` is set by hand, because new TypeScript versions do not load `@types/*` packages on their own.
8. **Versions.** TypeScript 7 (the latest), because `tsc` only checks types here. `@types/node` 24, because the Lambda runtime is Node 24. If `tsc` 7 fails on Hono's types, use the latest TypeScript 6 and put the reason in the **Result**. Safe-chain on this machine hides versions younger than its minimum age. Record the installed versions in the **Result**.
9. **Root scripts.** `pnpm --parallel` starts web and api with no extra package, and prefixes each output line with the package name. `pnpm -r test` and `pnpm -r typecheck` skip packages that have no such script. So the web app needs no stub scripts.
10. **Vite proxy.** `server.proxy` in `apps/web/vite.config.js`: `'/api'` → `http://localhost:8787`, with `rewrite` that removes the leading `/api`. Only the dev server gets it. Production calls the function URL directly (step 3).
11. **`apps/web/.env.development`** is in git. The `.gitignore` entry `.env` matches only files named exactly `.env`. Nothing reads `VITE_API_URL` in this step.
12. **No server start by agents.** The tests run the app through `app.request()`. The user starts `pnpm dev` and opens `/api/health`. This checks `local.ts`, the root `dev` script and the Vite proxy.

## Phase 1: The API package

Read: backend doc "Repo layout", "API" → "Stack", "Code", "Routes", "Errors and logs". Hono docs for `app.route`, `onError`, `notFound`, `HTTPException`, and `@hono/node-server` `serve`.

Work:
1. `tsconfig.base.json` at the root (decision 7).
2. `apps/api/package.json`, `apps/api/tsconfig.json` (see "Names"). `pnpm --filter api add hono @hono/node-server`, and the dev dependencies.
3. `stores/store.ts`, `stores/memory.ts` (decision 1).
4. `config.ts` (decision 2).
5. `middleware/errors.ts`, `middleware/log.ts` (decisions 4 and 5).
6. `routes/health.ts`: `GET /health` returns `{ ok: true, version: config.version, db: await store.ping() }`.
7. `app.ts`: `createApp({ store, config })`. Order: log middleware, routes, `onError`, `notFound`.
8. `local.ts`: load `.env` (decision 6), `configFromEnv(process.env)`, `createMemoryStore()`, `serve()` on port 8787. Log `API on http://localhost:8787` when it listens.
9. `test/app.test.ts`, with the memory store and `version: 'test'`:
   - `GET /health`: 200, JSON `{ ok: true, version: 'test', db: 'none' }`.
   - An unknown route: 404, JSON `{ error: 'Not found' }`.
   - A route that the test adds and that throws `new Error('secret')`: 500, JSON `{ error: 'Internal server error' }`. The body does not contain `secret`.
   - A route that the test adds and that throws `HTTPException(403, { message: 'No seat' })`: 403, JSON `{ error: 'No seat' }`.
   - `GET /health?x=1` writes exactly one `console.log` line, and it matches `/^GET \/health 200 \d+ms$/`.

Checks:
- `pnpm install` prints no warning about build scripts. Copy any peer dependency warnings into the **Result**.
- `pnpm --filter api typecheck` passes.
- `pnpm --filter api test` passes.
- `git diff --stat apps/web` is empty.

### Result

Status: done.

Files changed:
- New: `tsconfig.base.json`, `apps/api/package.json`, `apps/api/tsconfig.json`.
- New in `apps/api/src/`: `app.ts`, `local.ts`, `config.ts`, `routes/health.ts`, `middleware/log.ts`, `middleware/errors.ts`, `stores/store.ts`, `stores/memory.ts`.
- New: `apps/api/test/app.test.ts` (5 tests).
- Changed: `pnpm-lock.yaml`.

Facts:
- Installed: `hono@4.13.13`, `@hono/node-server@2.1.3`, `typescript@7.0.2`, `tsx@4.23.15`, `vitest@5.0.3`, `@types/node@24.19.1`.
- TypeScript 7 checks Hono's types with no error. No fallback to TypeScript 6.
- Vitest 5.0.3 uses `vite@6.4.4` as its peer, not Vite 8. The web app keeps its own Vite.
- `pnpm add` ran the `esbuild` install script for the new `esbuild@0.28.2` and `0.25.12`. `allowBuilds` already covers `esbuild`. No build script warning.
- `pnpm install` prints no peer warning. It prints only the known `three-mesh-bvh@0.7.8` deprecation.
- The test adds its throwing routes with `app.route` after `createApp`. They still get `onError` and `notFound`.

Checks:
- `pnpm install`: no build script warning. Pass.
- `pnpm --filter api typecheck`: pass.
- `pnpm --filter api test`: pass, 5 of 5.
- `git diff --stat apps/web`: empty. Pass.

Changes from the plan: none. Risk 2 said Vite 8. The real peer is Vite 6.4.4.

Open issues: none.

## Phase 2: Root scripts, Vite proxy, docs

Read: backend doc "Local development", "pnpm" (the root scripts).

Work:
1. Root `package.json`: the scripts in "Names".
2. `apps/web/vite.config.js`: decision 10.
3. `apps/web/.env.development`: `VITE_API_URL=/api`, with a comment line that says what reads it.
4. `README.md`, "Running locally": `pnpm dev` starts the web app and the API. The API listens on port 8787, and Vite forwards `/api/*` to it. `http://localhost:5173/api/health` shows the API status. `pnpm test` and `pnpm typecheck` check the API. Add `apps/api/` in one line to "Project structure", above the note that the tree is under `apps/web/`.
5. Add a short **Result** under step 2 in `docs/plans/implement-backend.md`.

Checks:
- `pnpm typecheck` and `pnpm test` at the root pass. Their output shows that they ran only in `api`.
- `pnpm --filter web build` passes.
- `node -e` with the `rewrite` function of `vite.config.js`: `/api/health` becomes `/health`. Or read the config and show the rule in the **Result**.
- `git status` shows only the files of this plan.

### Result

Status: done.

Files changed:
- `package.json`: root scripts `dev` (`pnpm --parallel --filter web --filter api dev`), `build`, `test`, `typecheck`.
- `apps/web/vite.config.js`: proxy `/api` to `http://localhost:8787`, with `rewrite` that removes `/api`.
- New: `apps/web/.env.development` (`VITE_API_URL=/api`, with a comment).
- `README.md`: `apps/api/` line in "Project structure", and the API text in "Running locally".
- `docs/plans/implement-backend.md`: **Result** under step 2.

Checks:
- `pnpm typecheck` at the root: pass. Only `api` ran (`$ tsc`).
- `pnpm test` at the root: pass. Only `api` ran (5 of 5).
- `pnpm --filter web build`: pass.
- `rewrite('/api/health')` from the loaded `vite.config.js` gives `/health`. Pass.
- `git status`: only the files of this plan, plus `pnpm-lock.yaml` and the phase 1 files.

Changes from the plan: none.

Open issues: the user checks `pnpm dev`, the proxy and Ctrl-C (see "User").

## User

After phase 2:
1. `pnpm install`, then `pnpm dev`. The output shows both `web` and `api`, and `API on http://localhost:8787`.
2. Open `http://localhost:5173/api/health`. It shows `{"ok":true,"version":"dev","db":"none"}`.
3. Open `http://localhost:5173/api/nothing`. It shows `{"error":"Not found"}`.
4. The app at `http://localhost:5173` works as before.
5. Ctrl-C stops both processes. A second `pnpm dev` starts with no "port in use" error.

## Done when

- `pnpm typecheck`, `pnpm test` and `pnpm --filter web build` pass.
- `pnpm install` shows no build script warnings.
- The user checks pass.

## Risks and open questions

1. **TypeScript 7.** It is the new native compiler. If Hono's types fail with it, decision 8 says to use TypeScript 6.
2. **Vitest 5 brings Vite 8 into `apps/api`.** Vite 8 is a peer dependency of Vitest 5. The web app keeps Vite 5. pnpm keeps the two apart. A new install script (for example in a native package) stops the install. Then stop and report: `allowBuilds` needs a decision.
3. **`pnpm --parallel` and Ctrl-C.** If the API process stays alive after Ctrl-C, port 8787 stays busy. User check 5 finds it.
4. **`process.loadEnvFile` and existing env vars.** Values that are set in the shell stay. The file does not override them.
