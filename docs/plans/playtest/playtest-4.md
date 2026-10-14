# Plan: Bugs from the fourth playtest

Requested by the user on 2026-10-14. Status: not started.

Branch `playtest-4`, worktree `../mcp_assist_3d-playtest-4`, from main at `7b708f7`. One coder step and one commit for each step. Each step writes its **Result** below when it is done. Feature docs change in the same step as the code.

Checks of every step: `pnpm format`, `pnpm lint`, `pnpm test`, `pnpm --filter web build`.

Rule of every step (from the user): reuse existing hooks and functions. Extend a shared one before writing a new copy in a component.

## Bugs

1. Single player. After deployment, the setup panel still says "Deploy one model at a time … Press Power Phase when both squads are deployed."
2. LOS: a target partly behind a Tank (Size 4). The wide line stops at the tank corner. No thin clear line shows.
3. The "Powered by Netlify" badge covers the Power button.
4. Map "Will he get away with it": the Size 1 Money Bag floats in the air after the Lil Bandit under it was deleted (a throw deletes terrain).
5. Major. Joel dazed Daredevil. The app dropped Daredevil's Extract token, and the screen of Daredevil's owner turned black. The console shows Rapier errors: `null pointer passed to rust` (`removeRigidBody`, `setBodyType`) and `expected instance of Og` (`removeCollider`).
6. Joel dropped an Extract token on the table under Juggernaut. The app made Juggernaut hold it, so he held 2.
7. Request: players do not send their console logs. The app must send errors to the API by itself.

## Facts

Paths are under `apps/web/src/`.

### Setup panel (bug 1)

- Works as designed: setup ends only with the first Power Phase (`usePhaseActions.js:39-48`, `finishDeploy` in `setup/setup.js:266`). The panel hides at step `done` (`GameSetup.jsx:522`).
- The note says "Press Power Phase". The HUD button says **Power** (`PhaseButtons.jsx:25`), the table button "Auto Power Phase" (`TableButtons.jsx:41`). The badge of bug 3 covers the HUD button.
- No roll-off after deployment in the app. The only roll-off is the first setup step.

### LOS (bug 2)

- Timing bug in `useLosLine` (`LosTool.jsx:83-122`). Shift+1 sets the target and turns the line in the same frame. That frame is a turn, so it runs and sets `dirty = false` before the rest time (0.15 s). The sight block needs `time >= LOS_REST`, so it is skipped. Later frames return early because `dirty` is false. `clearSight` never runs.
- Geometry, filters and the tank collider are correct (checked).
- `losLength.test.js` tests only the pure functions, not the frame timing.

### Netlify badge (bug 3)

- No code ever removed it. Netlify added the badge on 2026-08-19 for new Free plan projects. Switch: Netlify UI, Project configuration > General > Powered by Netlify badge. No `netlify.toml` option.

### Terrain delete (bug 4)

- Every terrain piece is a fixed body at its map height (`Terrain.jsx:348`). It never falls.
- `handleTerrainRemove` (`pieces/useTablePieces.js:50-55`) only removes the piece from the list. Models on it fall by gravity, because Rapier wakes them.
- The table document stores `{ id, index, locked }` per piece (`docs/features/rooms.md`). It has no height.
- In the map, `size-1-money-bag` (y 2.774) stands on `size-2-lil-bandit` (y 1.986).

### Crash (bug 5)

- Rapier failed on the owner's browser after app code called a removed body. After the first fault, every Rapier call fails (same as commit `3a81b52`, `CharacterModel.jsx:782-786`). The first error is not in the console copy, so the first call is not proven.
- The app has no error boundary. R3F throws the error to the parent of `<Canvas>`, and React unmounts the whole root: black screen.
- The drop remounts the other player's range tool (`placeTool`, `useTableTools.js:192-205`, key `toolKey` in `Scene.jsx:1017`). On the owner's browser this removes and creates `OtherToolBody` (`RulerTool.jsx:1579-1676`).
- Places that can keep a removed body:
  - `<RigidBody ref={rigidRef}>` object refs are never cleared: `Tool` (`RulerTool.jsx:846`), `OtherToolBody` (`RulerTool.jsx:1579`, and `colliders.current[i]` at 1650), DiceTray.
  - Window listeners of `startPointerDrag` (`drag/pointerDrag.js:194-195`) live after unmount. `CharacterFigure` and `useDragTool` keep no `cancel` handle.
  - Body calls from effects and peer data with no check that the body still exists: `applyPose` (`Scene.jsx:720`), the `otherOwned` effect (`Scene.jsx:806-816`), `modelPosition` (`Scene.jsx:645`), `useDragTool` `endDrag` (`RulerTool.jsx:316`).

### Error reports (request 7)

- API: Hono in Lambda (`apps/api`), zod checks bodies (`middleware/validate.ts`, 400 with no zod details). Store: memory by default, Mongo with `STORE=mongo`, Atlas in production (`docs/features/backend.md`).
- Collections today: `users`, `rooms`, `messages`. The database user has `readWrite`, so the API can create a collection.
- Reserved concurrency 10 and the $1 budget alert limit the cost of abuse.
- `infra/scripts/delete-test-data.ts` reads `MONGODB_URI` from the infra env file. A read script can do the same.
- Privacy page: `apps/web/public/privacy.html`.

### Token hold (bug 6)

- `CrisisToken.jsx:299-317` `onEnd`: a `canHold` token is held when `findCharacterAt` finds a character. `characterAt` (`Scene.jsx:551-578`) casts the screen ray against the whole figure and the tray plates. A big figure covers the table around and behind its base.
- `handleTokenHold` (`useCrisisTokens.js:146-167`) has no limit.
- TTS: a token is held only when it touches the character tray (`onCollisionEnter` → `addObjective` in the Tray Spawner script, 5 slots). A token dropped on a model in TTS just lies there.

## Decisions

1. **Setup panel.** The note names the real button: "Press Power (bottom right) to start round 1", or "Auto Power Phase" when the setting puts it on the table. The panel gets a **Start round 1** button in the `deploy` step. It calls the same `handlePowerPhase`.
2. **LOS.** `dirty` is cleared only when the rest work runs. A turn still updates the length at once. The rest work runs once after `LOS_REST`. The scheduling moves to a pure helper in `losLength.js` with tests.
3. **Netlify.** The user turns the badge off in the Netlify UI. No code change.
4. **Terrain delete.** When a piece is deleted (Delete key or a throw), what stood on it goes down to the next surface below, straight down, with no physics push:
   - A terrain piece on it: cast down from its bottom without the deleted collider. Its new height is the next surface (another piece or the mat). The document gets an optional `y` per piece. `withPlacements` reads it.
   - A model on it: the app moves the body straight down to the next surface and sets its velocity to 0, instead of a free fall. The new pose is stored as after a drag.
   - A piece or model that stands on the moved piece goes down with it, by the same rule.
5. **Crash.**
   - An error boundary around the 3D view. On an error, it logs the error and mounts the scene again (new key, state read again from the document). The page never turns black.
   - The first uncaught error and the first Rapier error are logged with a clear prefix, so the next report shows the trigger.
   - Clear `RigidBody` and collider refs on unmount (`Tool`, `OtherToolBody`, DiceTray).
   - Keep the `cancel` handle of `startPointerDrag` in `CharacterFigure` and `useDragTool`, and call it on unmount.
   - One shared helper `liveBody(world, rb)` (`world.getRigidBody(rb.handle) === rb`). Use it before body calls from listeners, effects and peer data.
6. **Token hold, as TTS.** A token is held only when it is released on a tray card (the tray plate or a `[data-character-id]` element). A release on a model on the table puts the token on the table. No limit per character: players resolve rules. `character-trays.md` "Hold and drop" changes.

7. **Error reports.** `POST /errors`, no login.
   - Body, checked with zod, only these fields, all plain strings: `message` (max 500), `stack` (max 8000), `version` (max 64), `agent` (user agent, max 300), `room` (max 16), `side` (a fixed set). An unknown field or a wrong type gives 400. A body over 16 KB is refused before parsing.
   - The server builds the stored document field by field and sets the time itself. It never stores the request body as it is, so no `$` operator or nested object reaches Mongo.
   - Collection `errors`, capped at 10 MB. Mongo deletes the oldest reports when it is full. No TTL. The memory store keeps the last 200.
   - A limit per IP in Lambda memory: 20 reports per minute, 429 above that. The IP is not stored.
   - No Discord id, no name, no IP in a report.
   - Browser: the error boundary of decision 5, `window` `error` and `unhandledrejection` send a report. At most 5 per page load. The same message once. The first error is always sent. URL query strings are cut from the stack. A failed send is ignored and never sends a report about itself.
   - Read: `infra/scripts/errors.ts` (`pnpm --filter infra errors`) prints the latest reports. It reads `MONGODB_URI` the same way as `delete-test-data.ts`. It removes control characters and terminal escape codes before it prints.
   - The privacy page gets one paragraph: what an error report contains, and that it has no account data.
   - The reports are untrusted text. A person can send a false report. They are hints only.

## Steps

1. **Crash safety** (bug 5, decision 5). Files: new error boundary component next to `App.jsx` `<Canvas>`, `components/RulerTool.jsx`, `components/DiceTray.jsx`, `components/CharacterModel.jsx`, `components/Scene.jsx`, `drag/pointerDrag.js` or a physics helper file for `liveBody`. Tests: `liveBody` with a fake world. Docs: the feature doc that covers the 3D table, a short note on recovery.
2. **Error reports** (request 7, decision 7). Files: new `apps/api/src/routes/errors.ts`, the store (memory and Mongo, capped collection created at start when missing), the app setup that mounts routes, the web API client, the error boundary and global listeners from step 1, `infra/scripts/errors.ts` and its `package.json` script, `apps/web/public/privacy.html`. Tests: API tests for a good body, an unknown field, a wrong type, a too long body, the rate limit, and that a `$` key never reaches the store. A web test for the per-page limits and the dedupe. Docs: `docs/features/backend.md` (route, collection, script, security).
3. **Token hold on the card only** (bug 6, decision 6). Files: `components/CrisisToken.jsx`, `drag/useTokenDrag.js`, `components/Scene.jsx` (`characterAt` callers for crisis tokens; character tokens keep the model target). Docs: `docs/features/character-trays.md`.
4. **LOS timing** (bug 2, decision 2). Files: `components/LosTool.jsx`, `components/losLength.js`, `components/losLength.test.js`. Tests: key change plus turn in one frame, then still frames, runs the sight test once; a turn before rest keeps the pending test; a turn after rest does not run it again.
5. **Setup panel** (bug 1, decision 1). Files: `components/GameSetup.jsx`. Docs: `docs/features/setup-game.md`.
6. **Fall on terrain delete** (bug 4, decision 4). Files: `pieces/useTablePieces.js`, `rooms/table.js` (`y`), `components/Terrain.jsx`, `components/Scene.jsx` (model move). The coder checks first how the throw deletes terrain, and reports if it uses another path. Tests: the pure part that finds what stands on a piece and the new height. Docs: `docs/features/maps.md` or `rooms.md` (the `y` field), `key-shortcuts.md` if the Delete row describes the fall.

**User:** turn off the Netlify badge (decision 3). After the merge and push to main, CI deploys the API with `POST /errors`.

## Results

### Step 1: Crash safety

Done.

- New `src/crash/errors.js`: `reportError`, `subscribeErrors` (hook for step 2), `installErrorListeners` (window `error`, `unhandledrejection`; first error logged as `[first error]`). Installed in `main.jsx`.
- New `src/crash/SceneBoundary.jsx` around `<Canvas>` in `App.jsx`: logs `[scene error]`, mounts again with a new key, 3 errors in 10 s give a Reload fallback (`restartCount.js`, tested).
- `physics.js`: `liveBody(world, rb)`; test `physics.live.test.js` with a fake world.
- New `useBodyRef.js` (shared hook: `rigidRef`, `liveRb()`, clears refs on unmount) used in `Tool` and `OtherToolBody` (also `groups`, `colliders`). New `WorldRef.jsx` gives `Scene` the Rapier world (`Scene` renders `<Physics>`, so it has no `useRapier`). All `Scene` reads of `charBodies` go through `liveCharBody` (`applyPose`, `otherOwned` effect, `modelPosition`).
- `useDragTool` and `CharacterFigure` keep the `startPointerDrag` handle and call `cancel('unmount')` on unmount. `endDrag`, `canStart` and the drag callbacks check `liveBody`. A cancel with reason `unmount` does not put the body back, as `lost`.
- `DiceTray`: `startShelfMove` and `reroll` check `liveBody`; `Die` clears `entry.body` on unmount.
- Doc: `features/table-tools.md` "Recovery".
- Not done: the Rapier calls inside `useFrame` and physics step callbacks are not wrapped (the body is in the world there). The boundary cannot catch an error thrown in `useFrame`: it reaches the `window` listener only. Lint: 3 new `exhaustive-deps` warnings in `RulerTool.jsx` (`liveRb`), same kind as the old ones.

### Step 2: Error reports

Done.

- API: new `routes/errors.ts` (`POST /errors`, zod strict object, `bodyLimit` 16 KB gives 413, per-IP 20 a minute in memory gives 429, 204 on success). IP from `requestContext.http.sourceIp` (Lambda) or the socket (Node), else `unknown`. The map is bounded to 2000 entries. Mounted in `app.ts`.
- Store: `errors` (`add`, `latest`) in the interface, memory (last 200) and Mongo (capped 10 MB collection, created in `ready()` with the indexes, code 48 ignored).
- Web: new `crash/reporter.js` (5 per page, dedupe, query strings cut, failed send ignored) subscribed in `main.jsx`. Version is `VITE_BUILD_ID`. `Table.jsx` sets room and side (multiplayer only; side `none` with no seat).
- `infra/scripts/errors.ts` and the `errors` script. `privacy.html` and `docs/features/backend.md` updated.
- CORS: no change needed.
- Tests: `apps/api/test/errors.test.ts`, the capped collection in `mongo.mongo.test.ts`, `crash/reporter.test.js`.
- Deploy: the API must be deployed for the route to exist. Until then the browser gets 404 and ignores it.

### Step 3: Token hold on the card only

Done.

- `Scene.jsx` `characterAt(x, y, { models })`: `models: false` skips model objects (plates only). `findCharacterAt` in `useTokenDrag.js` passes the option through (DOM `data-character-id` still counts).
- `CrisisToken.jsx` `onEnd`: `canHold` lookup uses `{ models: false }`; a release on a model moves the token to the release point.
- Supply pile take (`handleTokenRelease`): lookup uses `models: !supplyCard`, so over a model it gives `supplyTable`. Character tokens keep the model target.
- Docs: `character-trays.md` (Give table, ray hit, Hold, decision 3), `crisis.md` (supply).
- No new test: no pure part (the ray cast and DOM lookup); `tokenDropTarget` unchanged.

### Step 4: LOS timing

Done.

- `losLength.js`: `LOS_REST`, `newLosSchedule`, `losFrame(st, key, yaw, dt)` -> `{ run, sight, reset }`. `dirty` is cleared only when rested; the sight test runs once, on the first run after rest.
- `useLosLine` uses `losFrame`. `OtherLos` uses the same hook, so it is fixed too.
- Tests in `losLength.test.js`: key change plus turn then still frames (sight once), turn before rest, turn after rest, turn runs at once.
- No feature doc change.

### Step 5: Setup panel

Done.

- `GameSetup.jsx`: deploy note names Power (bottom right) or Auto Power Phase by setting; **Start round 1** chip in the deploy step. New props `powerOnTable`, `onStartRound`.
- `Scene.jsx`: passes `tableButtons.show.power` and `() => tableButtons.onPowerPhase(playedSides)` (same `handlePowerPhase` and sides as the HUD Power button). The HUD button has no side limit or disabled state, so none here.
- Docs: `setup-game.md` deploy row. `round-phases.md` did not repeat the text.
