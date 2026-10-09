# Plan: Backend and multiplayer

The order of the work, from today's app to the first release: a game between two real players on two machines. The designs are in:

- `docs/feature-backend.md`: repo, stack, AWS, deploy.
- `docs/feature-auth.md`: login, users, online rooms, table snapshot.
- `docs/feature-peer-to-peer.md`: signaling, WebRTC, Yjs, physics sync.
- `docs/feature-rooms.md`: offline rooms.

This plan is the overview: the steps, their order and why. Each step also gets its own detailed plan (see [Detailed plans](#detailed-plans)). Each step ends with a working app and a backend that can be deployed.

## Rules for every step

- Read `CLAUDE.md`, this plan, the detailed plan of the step, and the design sections that it names.
- Do not open the app in a browser. Check with type checks, tests and builds. The user checks the app in the browser.
- Coding agents do not run `aws`, `cdk deploy` or `cdk bootstrap`. They do not change settings in AWS, Atlas, Discord, Netlify or GitHub. They write the code and the commands, and the user runs them. Steps list these as **User**.
- No commit and no push unless the user asks.
- From step 8 on, the user tests in the three browser pairs of the peer-to-peer doc ("Local testing").
- Before the first release (step 12), all data is test data: in Atlas, and in the browsers' `localStorage` and IndexedDB. A change of the data format needs no migration. Delete the old data instead.

## Order

| Step | Content | Needs | Peer-to-peer phase | Auth phase | Detailed plan |
|---|---|---|---|---|---|
| 0 | Align the feature docs | — | | | — (the list is in the backend doc) |
| 1 | Monorepo | 0 | | | `01-monorepo.md` |
| 2 | API skeleton, local | 1 | | | `02-api-skeleton.md` |
| 2b | Lint and format | 2 | | | `02b-lint-format.md` |
| 3 | Infra and first deploy | 2 | 5 (AWS parts) | 4 (AWS parts) | `03-infra.md` |
| 4 | CI deploy | 3 | | | `04-ci.md` |
| 5 | Shared state in Yjs | 1 | 1 | | `05-yjs-state.md` |
| 6 | Login | 3 | | 1 | `06-login.md` |
| 7 | Online rooms | 5, 6 | | 2 | `07-online-rooms.md` |
| 8 | Two browsers | 7 | 2 | 3 | `08-two-browsers.md` |
| 9 | Moving objects | 8 | 3 | | `09-moving-objects.md` |
| 10 | Dice | 9 | 4 | | `10-dice.md` |
| 11 | Reconnect and stored game | 8 | 5 (the rest) | | `11-reconnect.md` |
| 12 | First release | 10, 11 | | 4 (the rest) | `12-release.md` |
| 13 | TURN | 12 | 6 | | `13-turn.md` |

The detailed plans are in `docs/plans/implement-backend/`.

- Steps 1 to 4 add no game feature. They make the path from code to AWS work while the API is small. So problems with pnpm, CDK, roles, Atlas or CI show early, one at a time.
- Step 5 is frontend only. Login (step 6) comes after it, because only the online features need login, and the first online feature is step 7.
- From step 3 on, every backend change is deployed when its step is done. Production shows no login and no online rooms until step 12, because the web app shows the login button only when `VITE_DISCORD_CLIENT_ID` is set.
- Step 12 is the first release. Steps 5 to 11 are tested locally, with dev login and the browser pairs. Then the app goes to production, and the user tests with another real person.

## Detailed plans

Every step from 1 to 13 gets a detailed plan before its work starts. The plan records the intent of the step and the path to it, so the work and the reasons can be read later. Step 0 has no own plan: its list of changes is in `docs/feature-backend.md` ("Relation to other features").

A detailed plan is written after the **Result** of the steps that it needs. So it uses what those steps found, not guesses. Steps 1 to 4 need only the decisions in the backend doc, so their plans can be written at once.

Each detailed plan has the format of `docs/plan-roster.md`, plus the intent:

1. **Goal.** What the step makes possible, and why it comes at this point.
2. **Scope.** What is in the step, and what is left for later steps.
3. **Rules for every phase.** The rules of this plan, plus rules of the step.
4. **Names.** Files, routes, types, env vars and commands that all phases use.
5. **Decisions that fill gaps in the design.** Each with its reason.
6. **Phases.** Each phase: what to read, numbered work, checks, the **User** actions, and a **Result** that the agent adds after the work.
7. **Done when.** The checks of the whole step.
8. **Risks and open questions.**

After a step, its result goes into two places: the **Result** of each phase in the detailed plan, and a short **Result** under the step in this plan.

## Step 0: Align the feature docs

Change the peer-to-peer, auth and rooms docs as listed in `docs/feature-backend.md` ("Relation to other features"). No code. Then the agents of later steps do not read old instructions: SAM, the Vite plugin, `infra/signal/`, `jose`, npm.

Done when: `grep -rn "SAM\|sam deploy\|vitePlugin\|infra/signal\|infra/api\|jose\|npm run" docs/feature-*.md` finds only text that explains the change.

**Result** (2026-10-08):
- Peer-to-peer, auth and rooms docs changed as listed. Both phase lists now point to this plan for the order.
- Also changed, for the same reason: web paths in the code layouts of the peer-to-peer and auth docs became `apps/web/src/`. `npx vite build` became type checks, tests and `pnpm --filter web build`. The Cloudflare TURN token is an SSM parameter. The auth code layout has `apps/web/src/api/client.js` (backend doc, "Repo layout").
- Gap filled: the poll header is `x-after`. The backend doc's CORS header list now has it. Without it, the preflight of the poll fails.
- The grep also finds `SAML` in the auth doc sources (Cognito pricing, not SAM), and `npm run` in the custom models, dice rolling and roster docs. Those commands are correct until step 1.

## Step 1: Monorepo

Read: backend doc "Repo layout", "pnpm", "Deploy" → "Netlify".

1. `pnpm import`: creates `pnpm-lock.yaml` from `package-lock.json` with the same versions. Delete `package-lock.json` and `node_modules`.
2. `git mv` of `src`, `public`, `scripts`, `index.html`, `vite.config.js` and `package.json` to `apps/web/`. The package name is `web`. Move `tools/` by hand, because git ignores it.
3. Root files:
   - `package.json`: private, `packageManager`, root scripts `dev` and `build`. Root `esbuild` comes in step 3.
   - `pnpm-workspace.yaml`: the package folders, `allowBuilds: { esbuild: true }`.
   - `.node-version`: 24.
   - `.gitignore`: `.env`, `cdk.out`, `apps/*/dist`, `apps/web/tools/`.
4. `apps/web/scripts/dice-sim.mjs`: resolve the Rapier path from `@react-three/rapier`.
5. `netlify.toml` at the root, as in the backend doc ("Netlify"): build command, publish directory `apps/web/dist`, `ignore` command.
6. Update paths and commands in `CLAUDE.md`, `README.md`, `ASSETS.md` and `apps/web/scripts/README.md`. The old plans (`docs/plan-*.md`) are history and stay as they are.

**User:**
- Netlify: no build setting changes are needed, because `netlify.toml` overrides them. Clear the old build command and publish directory in the UI after the merge.
- Netlify: rename the site to `mcptacticus3d` (auth doc, "Site name"). The address is then final from the start. The offline rooms on the old address are lost, which does not matter before the first release.

Done when:
- `pnpm install` shows no build script warnings.
- `pnpm --filter web build` works.
- `node apps/web/scripts/dice-sim.mjs` runs.
- The Netlify deploy preview of the branch builds, and the app looks the same (the user checks).

**Result:** Done on 2026-10-08. Details are in `docs/plans/implement-backend/01-monorepo.md`.
- The repo is a pnpm workspace (pnpm 12.10.0, Node 24). The web app is in `apps/web/`. `netlify.toml` is at the root.
- `pnpm install` has no build script warning and no peer warning.
- The build file list and the dice-sim results equal the baseline. One dependency differs: `three@0.170.0` is gone, because pnpm gives `stats-gl` only a peer `three`. The app does not use `stats-gl`. The user accepted it.
- pnpm 12.10.0 passes `--` to the script. Docs write `pnpm --filter web <script> <args>` without it.
- Root `esbuild` moved to step 3 (decision 3 of the detailed plan).
- On 2026-10-09 the user confirmed that the Netlify build works. The site answers at `https://mcptacticus3d.netlify.app`.

## Step 2: API skeleton, local

Read: backend doc "API", "Local development".

1. `apps/api`: `package.json` (`api`), `tsconfig.json` on top of the root `tsconfig.base.json`, Hono.
2. `app.ts` with `createApp({ store, config })`, `onError`, and `GET /health`. With the memory store, `db` is `"none"`.
3. `config.ts`, the store interface, the memory store.
4. `local.ts`: `@hono/node-server` on port 8787. Reads `apps/api/.env` if it exists.
5. Vitest: `/health`, and an unknown route returns 404 as JSON.
6. Root scripts: `pnpm dev` runs web and api together. `pnpm test`, `pnpm typecheck`.
7. `apps/web`: Vite proxy `/api` → `http://localhost:8787` without the `/api` prefix. `apps/web/.env.development` with `VITE_API_URL=/api`.

**User:** `pnpm dev`, then open `http://localhost:5173/api/health`.

Done when: `pnpm typecheck`, `pnpm test` and `pnpm --filter web build` pass.

**Result:** Done on 2026-10-09. Details are in `docs/plans/implement-backend/02-api-skeleton.md`. The user checks `pnpm dev` and `/api/health`.
- `apps/api` has a Hono app with `GET /health`, the error and 404 handlers, one log line per request, the memory store, and 5 Vitest tests.
- Installed: `hono@4.13.13`, `@hono/node-server@2.1.3`, `typescript@7.0.2` (works with Hono's types), `vitest@5.0.3`, `tsx@4.23.15`, `@types/node@24.19.1`.
- Vitest 5 uses `vite@6.4.4` as its peer, not Vite 8. No new build script warning.
- Root `dev` starts web and api. Root `test` and `typecheck` run only in `api`.
- Vite forwards `/api` to port 8787 without the prefix. `apps/web/.env.development` has `VITE_API_URL=/api`.

## Step 2b: Lint and format

Read: `docs/plans/implement-backend/02b-lint-format.md`.

One linter (oxlint) and one formatter (oxfmt) for the whole repo, with root config and root scripts `lint`, `format`, `format:check`. Phase 1 adds the tools, the config and the fixes. Phase 2 formats the repo in its own commit. Phase 3 adds `.git-blame-ignore-revs`.

**Result:** (added after phase 3)

## Step 3: Infra and first deploy

Read: backend doc "Infrastructure", "Secrets and config", "Database", "Deploy" → "From the user's machine". Peer-to-peer doc "MongoDB connection".

1. `infra/`: `cdk.json`, `bin/app.ts`, `lib/account-stack.ts`, `lib/api-stack.ts`, `scripts/put-secrets.ts`, `.env.example`.
2. `infra/README.md`:
   - check and run the bootstrap
   - the AWS profile
   - the Atlas CLI commands: database user, access list
   - the secrets
   - the deploy commands
3. `apps/api`:
   - `lambda.ts`: reads the config from SSM at cold start, uses the Mongo store, answers the keep-alive event.
   - The Mongo client with the connection rules of the peer-to-peer doc.
   - `/health` pings Mongo and returns `APP_VERSION`.
4. Mongo store tests: `pnpm --filter api test:mongo`. The tests start a `mongo` container in Docker with Testcontainers.

**User**, in this order:
1. Check whether the `CDKToolkit` stack exists in `eu-central-1`. If not, run `cdk bootstrap` with `fxdx_admin`.
2. Deploy `McpTacticusAccount` with `fxdx_admin`. Add the `mcptacticus` profile to `~/.aws/config`.
3. Atlas CLI: create the database user and the access list. Put the connection string and a new session secret in `infra/.env`. Run `put-secrets`. The Discord values come in step 6.
4. `pnpm --filter infra cdk:deploy`.
5. `curl <ApiUrl>/health` returns `"db": "ok"`. A preflight with `Origin: https://mcptacticus3d.netlify.app` returns the CORS headers.
6. Netlify: set `VITE_API_URL` to the `ApiUrl`.

Done when:
- `cdk synth` passes, and the stacks are deployed.
- `/health` in AWS reaches Atlas.
- The log group keeps logs for 1 week, and the budget exists.
- The answers to the backend doc's open questions 1 to 3 are in the **Result**.

## Step 4: CI deploy

Read: backend doc "Deploy" → "GitHub Actions".

1. `.github/workflows/ci.yml` and `.github/workflows/deploy-api.yml`. CI runs `pnpm lint` and `pnpm format:check`.
2. `infra/README.md`: the `gh` commands for the environment `prod` and the variable `AWS_DEPLOY_ROLE_ARN`.

**User:** run the `gh` commands. Merge a change in `apps/api` to `main`, and watch the deploy run.

Done when:
- A pull request runs the checks.
- A push to `main` that changes `apps/api` deploys, and `/health` returns the new commit.
- A push that changes only `apps/web` does not deploy the API.

## Step 5: Shared state in Yjs

Peer-to-peer phase 1. Read: peer-to-peer doc "State", "Yjs document", "Phases" (1).

Frontend only. The table state moves from `useState` into a Yjs document. Save and load of a game as a file. No network.

Done when:
- The app works as before (the user checks).
- The **Result** has the snapshot size of a full game. This answers auth doc open question 5 (the 1 MB limit and the write interval).

## Step 6: Login

Auth phase 1. Read: auth doc "Login flow", "Session", "Users", "Discord application", "Local testing". Backend doc "API".

1. `apps/api`:
   - Routes: `POST /auth/discord`, `GET /me`, `DELETE /me`.
   - `hono/jwt` for the token, and the user middleware.
   - The users store: memory and Mongo.
   - The dev login in `local.ts`.
   - Tests. The Discord calls are mocked.
2. `apps/web`:
   - `src/api/client.js`: base URL, JSON, errors, the `Authorization` header.
   - `src/auth/`: session, `useUser`, avatar.
   - `UserMenu.jsx` in the lobby header. Hidden when `VITE_DISCORD_CLIENT_ID` is not set.

**User:**
- Create the Discord application with the localhost redirect (auth doc, "Discord application"). Put the client id and secret in `apps/api/.env` and `apps/web/.env.local`, and in SSM with `put-secrets`.
- Do not set `VITE_DISCORD_CLIENT_ID` in Netlify yet.

Done when:
- Locally: Discord login and dev login work, and the session survives a reload.
- The API with the auth routes is deployed. Production shows no login button.

## Step 7: Online rooms

Auth phase 2. Read: auth doc "Online rooms", "Lobby and room UI".

1. `apps/api`:
   - The rooms store: memory and Mongo, with indexes and TTL indexes.
   - Room and seat routes, with the seat rules.
   - The table snapshot: `GET` and `PUT`, merged with `Y.mergeUpdates` and the `tableRev` filter.
   - Tests, including two writes at the same time.
2. `apps/web`:
   - One room list in the lobby.
   - The **Online** switch in the new room dialog.
   - The join page.
   - The snapshot writes: every 60 s, on **← Lobby**, and when the tab is hidden.

Done when: two dev-login users in two browsers can create a room, join it, and see the map and the host's roster. Another browser of the same user gets the saved table.

## Step 8: Two browsers

Peer-to-peer phase 2 and auth phase 3. Read: peer-to-peer doc "How a WebRTC connection starts", "Signaling service", "Connect flow", "Data channels", "Room and players". Auth doc "Identity in peer-to-peer games".

1. `apps/api`: signaling routes with the token and seat check. The API adds `user` to each message. The poll URL stays the same between polls.
2. `apps/web`:
   - `peer.js`, Yjs sync and awareness over the data channel.
   - Host and join in an online room.
   - Names and avatars in the room toolbar.
   - The version check and the `?build` flag.
3. Local coturn and `?relay`, if a browser pair cannot connect directly.

Done when: in the three browser pairs, discrete changes sync. Discrete changes are map, crisis cards, tokens, new characters, damage and power.

## Step 9: Moving objects

Peer-to-peer phase 3. Read: peer-to-peer doc "Moving objects (physics)".

Done when: both players can drag models and tokens, and each player uses only their own tools. The bytes per game are logged.

## Step 10: Dice

Peer-to-peer phase 4. Read: peer-to-peer doc "Dice".

Done when: each player rolls in their own tray, and the other player sees the dice fly and land on the same face.

## Step 11: Reconnect and stored game

The rest of peer-to-peer phase 5: reconnect, and the IndexedDB copy of the Yjs document. Read: peer-to-peer doc "Room and players" (reconnect).

Done when: after a reload or a dropped connection, the game continues without lost changes.

## Step 12: First release

The rest of auth phase 4. Read: auth doc "Privacy", "Discord application", "Site name".

The app goes to production, and the user plays a game with another real person.

1. The privacy page, and **Delete account** in the user menu.
2. Checks of the data rules: TTL indexes, nothing logged that the privacy page does not name.
3. A script that deletes the test data in Atlas: the collections `users`, `rooms` and `messages`. Production starts with no data.

**User:**
- Run the script that deletes the test data.
- Discord: add the production redirect `https://mcptacticus3d.netlify.app/` and the Privacy Policy URL.
- Netlify: set `VITE_DISCORD_CLIENT_ID`. The next build shows the login button.
- Play a game with another person, on two machines in two different networks.

Done when:
- Two players finish a game on two machines.
- The **Result** has the numbers: was the connection direct, Lambda requests per game, Atlas transfer per game.

From this step on, production data is real. A change of the data format needs a migration.

## Step 13: TURN

Peer-to-peer phase 6. Only if step 12 or later games show that direct connections fail too often. Read: peer-to-peer doc "STUN and TURN".

## Decisions

Made on 2026-10-08:

1. Yjs (step 5) comes before login (step 6). Only the online features need login.
2. The Netlify site is renamed in step 1, so the address is final from the start. Before the first release, all data is test data, and nothing is migrated.
3. Step 12 is the first release. The user tests it in production with another real person.
4. Every step from 1 to 13 gets a detailed plan that records its intent and its path. It is written before the step starts, after the results of the steps that it needs.
