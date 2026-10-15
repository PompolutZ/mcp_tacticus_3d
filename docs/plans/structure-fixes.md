# Plan: Structure fixes

Requested by the user on 2026-10-15. Status: not started. Branch `structure-fixes`, worktree `../mcp_assist_3d-structure-fixes`, from main after these three plans merge into main, in this order: `docs/plans/review-fixes.md`, `docs/plans/split-large-files.md`, `docs/plans/remove-duplicates.md`. Step 14 runs only when no other plan branch is open (CLAUDE.md, "Worktrees").

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step:

- `pnpm format`, `pnpm lint` (no more warnings than before the step), `pnpm test`, `pnpm --filter web build`.
- A step that changes `apps/api`: also `pnpm --filter api typecheck`.
- From step 6 on: `pnpm typecheck`.
- `git grep -n "<old name or path>"` for each moved name: every pointer in `apps/web`, `docs/features` and `docs/plans` names the new place.

Paths are under `apps/web/src/` unless they start with `apps/`, `docs/` or `scripts/`. Line numbers are at `4698e42`. The three earlier plans move a lot of code (`Scene.jsx`, `RulerTool.jsx`, `Table.jsx`), so find the code by name.

## Request

A review of the repo found 11 problems in the structure: data from the network and the server, memory, layering, feature hooks, comments, types, lint, unused code and the `components/` folder. The user asked for one plan with all of them. The earlier three plans do other parts of the same review: `review-fixes.md` (side colors, schema guard and migrate chain, trimmed data and code split), `split-large-files.md` (`Scene.jsx` into hooks and layers with one `sceneApi` object, `RulerTool` `Tool` into hooks and `toolGeometry.js`, the `Table.jsx` effect into `rooms/openTableSession.js`), `remove-duplicates.md` (shared `SIDES`, `Dialog`, `ndc`/`nearestHit` helpers, a `localStorage` helper, `setBodyType` constants and more). This plan does not repeat their work. The three plans were written at the same time as this one and were not on disk when it was written. Before each step, the coder reads them and skips any item that they already did.

The behavior of the app does not change, except in steps 1, 2 and 8, which fix bugs.

## Facts

All findings were checked in the code at `4698e42`.

### 1. Live poses

- `parse` in `net/live.js` checks only that each value of `p` is a list of finite numbers. It does not check the count.
- `LiveSync.jsx` stores the numbers as they are (`store.set(key, { numbers: p[key], time })`). It skips unknown kinds (`isLiveKind`).
- `numbersToPose` in `net/livePose.js` destructures the list. A list that is too short gives `undefined` fields, and three.js and Rapier get `NaN`. This happens when the other browser runs a build with another number layout.
- `roundPiece(key, numbers)` in `net/live.js` already returns null for an unknown kind or a wrong count (it uses `LAYOUTS`).

### 2. Server table size

- `mergeTables` in `apps/api/src/rooms/table.ts` uses `Y.mergeUpdates`. A merged update keeps the content of deleted items. A `Y.Doc` with `gc: true` (the default) does not.
- Measured with yjs 13.6.33: 20,000 pose writes on 30 keys, merged every 500 writes. The client document is 184,309 bytes, the merged update 212,413 bytes. A `Y.Doc` that applies the merged update and encodes it again gives 184,309 bytes, and its content equals the client. The review measured 184 KB against 404 KB for another write pattern. Both show that the stored table grows faster than the document.
- Every table open downloads the stored table (`GET /rooms/:code/table`). The 1 MB limit (`MAX_TABLE` in `apps/api/src/routes/table.ts`) checks the merged size, so the extra bytes count against it.
- API tests use vitest: `apps/api/test/*.test.ts`. `apps/api/test/table.test.ts` exists.

### 3. Memory

- `ObjPiece` in `components/Terrain.jsx` makes a new `MeshStandardMaterial` per piece and never disposes it. `BundlePiece` in the same file disposes its materials in an effect cleanup. The terrain mounts again on every map change and every mat turn (`<Suspense key={`${mapId}-${matTurns}`}>` in `Scene.jsx`).
- `textured()` in `components/RulerTool.jsx` makes a new material on each call. It is called by `useRangeParts`, `DeployRangeTool` and `useMovementParts` in a `useMemo`. Nothing disposes it. `DeployRangeTool` mounts again on every model drag with Deploy Lock on.
- Same pattern, smaller: `Board` and `RoundMarkerMesh` in `components/ScoreBoard.jsx`, `useDieLook` and `trayMaterial` in `components/DiceTrayParts.jsx`. They mount once per table or change with the side color.
- No other leak was found. The scan: files with `new ...Material(`, `...Geometry(`, `...Texture(` against `dispose`; `addEventListener` against `removeEventListener`; `requestAnimationFrame` and `setInterval` against their cancel. The unbalanced listeners (`sound.js`, `net/peer.js`, `crash/errors.js`) are `once`, app-wide, or on objects that are dropped together with the listener.
- `useDragTool` in `RulerTool.jsx` makes a new `THREE.Vector3` on every drag frame (`const target = new THREE.Vector3()` in `useFrame`) and on every pointer move of a turn drag (`intersectPlane(dragPlane.current, new THREE.Vector3())`).

### 4. Layering

Four `.js` files have six imports from `.jsx` files (`git grep -nE "from ['\"][^'\"]+\.jsx['\"]" -- 'apps/web/src/*.js'`):

| File | Imports |
|---|---|
| `components/throwPath.js` | `BASE_HALF_H`, `baseGroundY` from `CharacterModel.jsx` |
| `terrain/dropQuery.js` | `BASE_HALF_H` from `components/CharacterModel.jsx` |
| `rooms/preload.js` | `matUrl` from `Scene.jsx`, `pieceUrls` from `Terrain.jsx`, `modelUrls` from `CharacterModel.jsx` |
| `components/tacticFaceTexture.js` | `TacticFace` from `TacticFace.jsx` |

- `tacticFaceTexture.js` renders the React component into a canvas. That import is correct and stays.
- `baseGroundY` needs only `castDown` (`physics.js`), `BASE_HALF_H`, `BASE_RADIUS` and `NO_ROTATION`. `physics.js` and `components/terrainUnder.js` load in Node. So `throwPath.js` and `dropQuery.js` load in Node once `CharacterModel.jsx` is out of their imports.
- `modelUrls`, `pieceUrls` and `matUrl` use `assetUrl` (`assets/index.js`, `import.meta.glob`), so their new modules do not load in Node.
- Lint is oxlint, not eslint. oxlint 1.87 supports `no-restricted-imports` with `patterns`. A test config with `{ "group": ["**/*.jsx", "*.jsx"] }` on `apps/web/src`, `.jsx` files ignored, reports exactly the 6 imports above.

### 5. Feature hooks

- `useGameSetup` (`setup/useGameSetup.js`, 495 lines) takes 24 parameters, `useCrisisTokens` 20, `useCharacterActions` 17, `usePhaseActions` 16. They have no tests.
- `App` passes 101 props to `Scene`. `Scene` passes 23 props to `GameSetup`.
- The review said that the setup record is written two ways (`setSetup` and `table.setup.set`). This is not true: `useYRecord` returns `record.set`, so `setSetup` is `table.setup.set`. A real problem is close to it: several handlers compute the next setup from `setup` of the render, for example `setSetup(setPriority(setup, team))`, and not from the document.
- Writes from effects that run in both browsers:
  - `useRollOffReader` (E8): both browsers read the roll off when a fresh `throw` entry arrives and write the result. The log entry has a fixed id `rolloff:<setup id>:<throw id>`.
  - The reveal effect in `useGameSetup` (E9): when both squads are placed, both browsers write `lockWasSet` and Deploy Lock on. In a multiplayer room each browser reveals only its own side. The `revealed:` and `affiliation:` log entries have fixed ids, so a second run of the effect in the same browser adds nothing.
  - These writes work because both browsers write the same values and the log ids are fixed.
- The roll off cannot use "only the browser that threw writes". When both players throw at almost the same time, each browser may write its throw before the other shelf arrives. Then neither thrower sees both shelves, and nobody would read the roll off. Today the browser that gets the second throw reads it.
- `rosters/cards.js` and `characters/characters.js` do not load in Node (JSON imports). A pure module takes such lookups as arguments (`cleanupCrisisTokens(tokens, cardOf)` does this today). `net/doc.js` (`createTable`) loads in Node.
- `sideColors.js` is a module store read with `useSyncExternalStore`. React context does not reach inside `<Canvas>` (comment in `sideColors.js`), and `GameSetup` and other panels render inside the Canvas.

### 6. Comments that point to plans

- `git grep -nE 'docs/plans/|plans/|\(plan|[0-9]{2}-[a-z-]+\.md|decisions? [0-9]+' -- apps/web/src | wc -l` gives 156 lines: 57 in `components/`, 32 in `net/`, 12 in `Table.jsx`. The review counted 133 in 3D files with another pattern. Some lines are allowed: a pointer to a plan for a shortcut, or for a fact that only the plan has (CLAUDE.md, "Docs").
- `docs/features/peer-to-peer.md` already describes the claims and the poses: "Moving objects (physics)", "Rules" 1 to 9, "The follow", "Pose message", "Cursor message", "Dice". So most net comments can point there today. Only facts that are only in `docs/plans/implement-backend/09-moving-objects.md` ("Decisions that fill gaps in the design") or `05-yjs-state.md` must move first.

### 7. Types

- `apps/web` has no `jsconfig.json`, no `tsconfig.json` and no `typecheck` script. The root `pnpm typecheck` runs `pnpm -r typecheck`, so a web script joins it.
- `apps/api` and `infra` use `typescript` `^7.0.2` and `tsconfig.base.json` (strict).
- `net/` imports nothing from other folders of `src/`. Its contracts: the document layout (`net/doc.js`), hello (`net/peer.js`, `net/signaling.js`), the awareness fields (`net/presence.js`, `net/ownership.js`) and the live packet (`net/live.js`).

### 8. Lint

- `pnpm lint` gives 58 warnings: 25 `react-hooks(exhaustive-deps)`, 24 `react(immutability)`, 5 `react(set-state-in-effect)`, 4 `react(refs)`. So `exhaustive-deps` is less than half, not "mostly".
- `exhaustive-deps` warnings by file: `RulerTool.jsx` 7, `CharacterModel.jsx` 3, `Root.jsx` 2, `TacticCard.jsx` 2, `CharacterTray.jsx` 2, one each in `useCrisisTokens.js`, `TurnHandle.jsx`, `TokenFace.jsx`, `Terrain.jsx`, `Scene.jsx`, `RosterCards.jsx`, `Preload.jsx`, `CrisisToken.jsx`, `CrisisCard.jsx`.
- 27 `eslint-disable ... exhaustive-deps` comments: `LosTool.jsx` 6, `Scene.jsx` 5, `DiceTray.jsx` 3, `CharacterModel.jsx` 3, `RulerTool.jsx` 2, and one each in `useBodyRef.js`, `useGameSetup.js`, `useAutoOpen.js`, `ToolDragGhost.jsx`, `TokenDragPreview.jsx`, `RosterCards.jsx`, `Ping.jsx`, `CrisisToken.jsx`.

### 9. Unused exports

`pnpm fallow dead-code` reports 27 unused exports and one unlisted dependency (`@dimforge/rapier3d-compat`). Most of the 27 are used inside their own file (for example `useTacticFaceTexture`, called by `useTacticFaceMap`), so only the `export` keyword goes. The list: `scripts/lib/tts.mjs` `downloadToCache`; `characters/models.js` `constructModelId`, `secondModelId`; `characters/trays.js` `TRAY_ON_LOCAL_Z`; `components/TacticFace.jsx` `FACE_FONTS`; `components/labelOcclusion.js` `MOVE_EPSILON`, `TURN_EPSILON`, `RAY_END_MARGIN`; `components/tacticFaceTexture.js` `CANVAS_WIDTH`, `CANVAS_HEIGHT`; `components/useTacticFaceTexture.js` `useTacticFaceTexture`; `crash/errors.js` `resetErrorsForTest`; `crash/reporter.js` `MAX_PER_PAGE`; `input/bindings.js` `WHEEL_CODES`, `sameInput`, `isKnownCode`, `RESERVED`; `physics.js` `LOWER_MARGIN`; `settings/settings.js` `DEFAULT_SPECTATOR_SIZE`, `DEFAULT_TURN_STEP`; `setup/deckButton.js` `deckProblem`; `tactics/faceIcons.js` `BODY_ICONS`, `PILL_ICONS`; `terrain/bundleColliders.js` `scaleVector`; `terrain/dropDown.js` `MIN_FALL`; `terrain/mapFace.js` `RANDOM_MAP_NAME`; `tokens/count.js` `pileToken`.

### 10. `components/`

- 111 files: 77 `.jsx`, 33 `.js`, 1 `.css`. 2D panels, 3D parts, hooks and pure helpers (`aimTurn.js`, `losBlock.js`, `rangeOne.js`) are in one folder.
- Feature folders exist already: `characters`, `crisis`, `dice`, `drag`, `game`, `log`, `pieces`, `rooms`, `rosters`, `scoreboard`, `settings`, `setup`, `tabletools`, `tactics`, `terrain`, `tokens`, `input`, `debug`.
- `git grep -c "components/"` finds 89 lines in `apps/web` and `docs/features`, in 18 feature docs. Plans name these paths too.

### 11. Re-renders

- No component uses `React.memo` (also in `split-app.md`, "Lint and build"). Each `App` state change renders `Scene` and every model again.
- `debug/FrameStats.jsx` exists for frame times.

## Decisions

1. **A bad live pose is dropped by key, not by packet.** `parse` keeps the good keys of a packet. A peer with a newer layout of one kind still moves the other pieces.
2. **The server table is a compact `Y.Doc` encoding.** `mergeTables` applies the stored table and the update to a new `Y.Doc` and returns `Y.encodeStateAsUpdate`. A stored table becomes compact on its next write, because the stored bytes go through the same function. No migration script is needed.
3. **A material that a component makes is disposed by the component.** One shared hook, `useDisposeMaterials(obj)` (new `components/useDisposeMaterials.js`), disposes the materials of `obj` in an effect cleanup. `BundlePiece` uses it too. Tool materials are cached, one per player color (`toolMaterial(map, playerColor)`), because tools mount often and have only three looks (blue, red, no tint). A cached material is never disposed.
4. **Layering rule**: a `.js` file under `apps/web/src` does not import a `.jsx` file. oxlint `no-restricted-imports` checks it in an `overrides` entry for `apps/web/src/**/*.js`. `components/tacticFaceTexture.js` is the one exception, with a comment that says why. Fallow `architecture` boundaries were also possible, but `pnpm lint` runs after every change, and fallow does not.
5. **Names move to plain modules**: `BASE_RADIUS`, `BASE_HALF_H`, `baseGroundY` and `upright` to `characters/base.js`. `modelUrls` to `characters/files.js`. `pieceUrls` to `terrain/files.js`. `matUrl`, and `matImageUrl` from `SceneShared.jsx` that it needs, to `terrain/maps/index.js` next to `MAPS`. The components import them from there.
6. **Feature actions are plain modules.** One `create<Feature>Actions(table, env)` per feature. It writes only the document, each action in one `table.transact`, and reads the document (`table.X.read()`), not render state. `env` has the seat (`mySide`, `hiddenSquads`) and the lookups that do not load in Node (`rosterCard`, `parseRosterText`, `characterByCode`). An action returns what the UI needs to say (`{ restarted, unknown }`). It does not call `window.confirm`, the HUD or React setters. The thin hook keeps the confirm, the HUD message, local UI state (`openRoster`, the stored squad) and the effects.
7. **The actions reach the components through a module store**, as in `sideColors.js`: new `table/actions.js` with `setTableActions(actions)` and `useTableActions()`. React context does not reach inside the Canvas. `App` creates the actions once per table and seat (`useMemo` on `table`, `mySide`, `hiddenSquads`) and sets them. The props that only pass actions through `Scene` to `GameSetup` go away.
8. **Derived writes stay in both browsers, and are tested.** The roll off read and the Deploy Lock write stay in effects that run in both browsers, because "only the actor writes" loses the roll off when both players throw at the same time (Facts 5). The decision functions move to the actions module (`readRollOffWrite(doc)`, `deployLockWrite(doc)`). Each writes only when the document is not already in the target state, and each log entry keeps a fixed id. A `node:test` with two `Y.Doc`s that sync by updates runs both effects in both docs, in both orders and at the same time. It checks that both docs end equal, with one log entry. "Host writes" is not used: it stops the game while the host is away.
9. **Hooks with refs to the 3D scene stay hooks**: `useTablePieces`, `useTableTools`, `useTokenDrag`. They pass refs and selection more than they write the document. They can follow later, with their own plan.
10. **Types start with `net/` only**, with `checkJs` and `strict: false`. The message shapes get JSDoc `@typedef`s in a new `net/types.js`. Other folders join later, one folder per change, each with zero errors. `typescript` in `apps/web` uses the same version as `apps/api`.
11. **Each `eslint-disable` that stays has a reason** on the line above it, in the form `// Safe: <why>`. A warning that can be fixed is fixed. `react(immutability)`, `set-state-in-effect` and `refs` are not part of this plan.
12. **An unused export loses `export`** when its file uses it. It is deleted when nothing uses it. Tests count as users.
13. **No `React.memo` in this plan.** `split-large-files.md` changes the props of `Scene` (`sceneApi`) and step 7 removes more. Memo now would be measured against code that changes. This is a known limit, written here and in `docs/features/peer-to-peer.md`, "Code layout". A later plan measures with the React Profiler and `FrameStats` first.
14. **The folder move is the last step**, alone, with only moves and import changes (decision 4 of `split-app.md`: moved code shows as moved). The target folders are in step 14.
15. **The user tests at the end of the plan**, with the lists under "User" of every step. The user can also test after any step.

## Risks

1. **Code moved by the earlier plans.** `Scene.jsx`, `RulerTool.jsx` and `Table.jsx` are split before this plan. Each step finds the code by name, and names the new file in its Result.
2. **The earlier plans may have done an item.** For example `remove-duplicates.md` may remove some unused exports. The coder checks before each step and writes what was skipped.
3. **Effect order** (`split-app.md`, "Effect order in one commit"): E8 (roll-off reader) runs before E9 (reveal). Steps 7 and 8 keep the order of the hook calls in `App`.
4. **Stale closures**: a handler that reads render state today and the document after the change can behave differently while two writes come fast. Step 7 makes that change on purpose (Facts 5). Each moved handler is checked against its test.
5. **Server CPU**: decoding a 1 MB table into a `Y.Doc` per write costs more than `mergeUpdates`. Writes are rare (the table writer), so this is accepted. The API test measures nothing; the Lambda log line `table write body= merged=` shows the sizes.
6. **TypeScript 7 and JSDoc**: TS 7 does not support every JSDoc form of TS 5. Use plain `@typedef`, `@param` and `@returns`.
7. **Lint config**: an `overrides` entry with `files: ["apps/web/src/**/*.js"]` must not turn off the rules of the earlier overrides. Run `pnpm lint` and compare the warning count.
8. **The folder move breaks open branches.** Step 14 runs only when no other plan branch is open.

## Step 1: Live poses checked on receive

Work:

1. `net/live.js`, `parse`: for each key of `p`, `roundPiece(key, p[key])`. When it returns null, drop the key. Otherwise keep the rounded numbers. Keep the `__proto__` check and the finite check. A packet with no good key and no `c` is still a packet (`deliver` sends nothing for it).
2. Comment on `parse`: a peer with another layout sends lists of another length, and they are dropped (`docs/features/peer-to-peer.md`, "Pose message").
3. `net/live.test.js`: a short list, a long list and an unknown kind are dropped; the good keys of the same packet stay; a dropped key does not change the stored sequence number of that key.
4. `docs/features/peer-to-peer.md`, "Pose message": "A bad packet is ignored" becomes: a key with the wrong count of numbers or an unknown kind is dropped; the rest of the packet is used.

User: in two browsers, drag a model, a tool, a crisis token and a tactic card. The other browser shows each move as before.

### Result

Done. `parse` in `net/live.js` runs `roundPiece` per key and drops keys with a wrong count or unknown kind; a non-finite value still drops the packet. 2 new tests in `net/live.test.js`. `docs/features/peer-to-peer.md` "Pose message" updated. Checks: format, lint (52 warnings, same), test, web build all pass.

## Step 2: Compact server table

Work:

1. `apps/api/src/rooms/table.ts`, `mergeTables`: a new `Y.Doc`, `Y.applyUpdate` of `stored`, then of `update`, return `Y.encodeStateAsUpdate(doc)`. Update the comment: the result is a compact document, without the content of deleted items.
2. `apps/api/test/table.test.ts` (or a new `apps/api/test/merge-tables.test.ts`, if the existing file tests only routes): many writes to one map key, merged every few writes. The result is smaller than `Y.mergeUpdates` of the same updates, and a doc that applies it has the same content as the client doc. A stored table made by `mergeUpdates` becomes compact after one `mergeTables`.
3. `docs/features/auth.md`, "Table on the server": the server stores the compact document; a table stored before this change becomes compact on its next write.

User: open a multiplayer room, move pieces, reload. The table is the same after the reload.

### Result

## Step 3: Material leaks, drag vectors

Work:

1. New `components/useDisposeMaterials.js`: `useDisposeMaterials(obj)`, an effect with cleanup that disposes each mesh material of `obj` (also material lists). Decision 3.
2. `components/Terrain.jsx`: `ObjPiece` and `BundlePiece` call it. `BundlePiece` loses its own effect.
3. `ScoreBoard.jsx` (`Board`, `RoundMarkerMesh`) and `DiceTrayParts.jsx` (`trayVisual`): call it. `useDieLook` returns a material without a mesh: dispose it in a `useEffect` cleanup on `[material]`.
4. `RulerTool.jsx` (or `toolGeometry.js` after `split-large-files.md`): `textured(obj, map, playerColor)` takes a cached material from a new `toolMaterial(map, playerColor)`, a `Map` keyed by map uuid and color. No dispose (decision 3).
5. `useDragTool`: one `Vector3` in a ref (or a module constant) for the frame target and one for the turn hit, reused.
6. No test: these modules use three.js scene objects and do not run in Node. Check with `pnpm --filter web build`.

User: turn the mat 10 times and change the map 5 times; the terrain looks as before. Drag a model 10 times with Deploy Lock on; the R3 tool shows each time. Tools in both colors and the tray show their tint. Drag and turn a tool. In Chrome DevTools, Memory, the count of `MeshStandardMaterial` does not grow with mat turns (optional).

### Result

## Step 4: Plain modules do not import components

Work:

1. New `characters/base.js`: `BASE_RADIUS`, `BASE_HALF_H`, `NO_ROTATION` (if `CharacterModel.jsx` keeps using it, import it from here), `upright`, `baseGroundY`. `CharacterModel.jsx` imports them. Decision 5.
2. `modelUrls` to `characters/files.js`, `pieceUrls` to `terrain/files.js`, `matUrl` and `matImageUrl` (now in `SceneShared.jsx`) to `terrain/maps/index.js`. Components and `rooms/preload.js` import from the new places. Fix the comments that name the old file (`Preload.jsx`, `docs/features/rooms.md`, "Loading").
3. `components/throwPath.js` and `terrain/dropQuery.js` import from `characters/base.js`.
4. Tests: `components/throwPath.test.js` and `terrain/dropQuery.test.js` with a fake `world` and `rapier` (the cast functions take them as arguments; follow `physics.test.js`). `characters/base.test.js` for `upright`. If a module still does not load in Node, write why in the Result and leave its test out.
5. `.oxlintrc.json`: an `overrides` entry for `apps/web/src/**/*.js` with `"no-restricted-imports": ["error", { "patterns": [{ "group": ["**/*.jsx", "*.jsx"], "message": "A plain module does not import a component. Move the shared name to a .js module." }] }]`. A second entry turns the rule off for `apps/web/src/components/tacticFaceTexture.js`, with a comment in that file. Decision 4. Risk 7.
6. Add the rule to `docs/features/` where the code layout is described (`peer-to-peer.md`, "Code layout", or the file that the earlier plans use for it).

User: throw and push a model onto terrain; drop a model on terrain; open a room with a map and characters (preload shows the mat and models in the first frame).

### Result

## Step 5: Unused exports

Work:

1. Each of the 27 exports in Facts 9: remove `export` when the file uses the name, delete the name when nothing uses it (decision 12). Check each with `pnpm fallow dead-code --trace <file>:<export>`.
2. `@dimforge/rapier3d-compat`: add it to `apps/web/package.json` dependencies with the version that `@react-three/rapier` installs (`pnpm why @dimforge/rapier3d-compat`).
3. Check: `pnpm fallow dead-code` reports 0 unused exports and 0 unlisted dependencies.

User: no visible change. Open the Sandbox and play one round.

### Result

## Step 6: Type check of `net/`

Work:

1. `apps/web/package.json`: `typescript` in devDependencies, the same version as `apps/api`. Script `"typecheck": "tsc -p jsconfig.json"`.
2. New `apps/web/jsconfig.json`: extends nothing from the strict base. `allowJs`, `checkJs`, `noEmit`, `strict: false`, `module: "Preserve"`, `target: "ES2024"`, `lib: ["ES2024", "DOM"]`, `skipLibCheck`, `include: ["src/net/**/*.js"]`, exclude `**/*.test.js`. Decision 10.
3. New `net/types.js` with JSDoc `@typedef`s: `LivePacket` (`{ s, p?, c? }`), `PieceKey`, `Hello` (the fields that `peer.js` and `signaling.js` send), `PresenceState` (the awareness fields of `presence.js` and `ownership.js`), and the table stores of `createTable`. Use them in `@param` / `@returns` of the exported functions of `net/`.
4. Fix the errors that the check finds. A fix that changes behavior is a bug: write it in the Result and ask before the fix.
5. `docs/features/peer-to-peer.md`, "Code layout": `net/types.js`, and `pnpm typecheck` checks `net/`.

User: no visible change. Two browsers join one room and move pieces.

### Result

## Step 7: Setup actions

Work:

1. New `table/actions.js`: the store of decision 7 (`setTableActions`, `useTableActions`), following `sideColors.js`.
2. New `setup/actions.js`: `createSetupActions(table, env)` with the document writes of `useGameSetup`: `loadRoster`, `removeRoster`, `restart`, `browse`, `override`, `priority`, `deck`, `pick`, `threat`, `edge`, `affiliation`, and `removeSetupPieces`, `clearPriorityMarker`. Each reads the document, not render state. Crisis cards and character removal are called through `env` until steps 9 and 10 move them. The random draws stay outside a React updater.
3. `setup/useGameSetup.js` keeps: the stored squad state, `viewSetup`, `parsedRosters`, the confirms, the HUD messages, `setOpenRoster`, and the effects. Its handlers call the actions. Its parameters drop the setters that the actions replace.
4. `App` creates the setup actions (`useMemo`) and sets the store. `GameSetup` reads `useTableActions().setup` and loses the action props; `Scene` loses the props that only passed them.
5. Tests `setup/actions.test.js` against `createTable(new Y.Doc())`, with fake lookups: each action's document change and log entry; restart removes only what the setup placed; override to `rollOff` clears the marker; `deck` and `pick` on the wrong step do nothing.
6. `docs/features/setup-game.md`: the code pointers name the new modules.

User: the whole game setup in the Sandbox: load and remove rosters, roll off by button and by dice, deck, picks, threat, turn the mat, edge, squads, Ready, affiliation, Prev / Next, Override, Restart setup. Then the same in two browsers.

### Result

## Step 8: Squads, reveal and derived writes

Needs step 7.

Work:

1. `setup/actions.js`: `toggleSquad`, `chooseBreakdown`, `ready`, `revealSquad` (the document part of today's `revealSquad`), `readRollOffWrite(doc)` and `deployLockWrite(doc)` (decision 8). The stored squad stays in the hook (localStorage, own side only).
2. `setup/useRollOffReader.js` and the reveal effect in `useGameSetup.js` call these functions. Keep the effect order (Risk 3). Keep the fixed log ids. Remove the `eslint-disable` of the reveal effect if its deps become complete, otherwise add the reason (decision 11).
3. Tests `setup/derivedWrites.test.js`: two `Y.Doc`s that exchange updates. Cases: both browsers run the roll-off read after two throws that arrive in both orders and at the same time; both docs end with the same `rollOff`, one `rolloff:` log entry and the same Priority. Both squads placed in different docs at the same time: Deploy Lock on once, `lockSet` true, a hand toggle of Deploy Lock after that stays.
4. `docs/features/setup-game.md`: "Roll off" and "Deploy Lock" say that both browsers may write, and why (Facts 5).

User: in two browsers: both players throw the roll-off dice at the same moment (several tries); the result and the Log show once. Both press Ready at about the same time; both squads show, Deploy Lock turns on once; turn it off by hand, it stays off. Squad from the Breakdown tab. Squad not stored in this browser: the message shows.

### Result

## Step 9: Crisis token actions

Work:

1. New `crisis/actions.js`: `createCrisisActions(table, env)` with the document writes of `useCrisisTokens` (change a crisis card, mat tokens, supply take, token moves, give, remove). Lookups (`getCard`, `getToken`, `characterName`) in `env`.
2. `crisis/useCrisisTokens.js` keeps the refs (`modelPositionRef`, `returnModelsRef`, `controlsRef`, `wheelCameraRef`), the camera pan, sounds and selection. Fewer parameters.
3. `setup/actions.js` calls the crisis actions directly, not through `env`.
4. Tests `crisis/actions.test.js` against a `Y.Doc`.
5. `docs/features/crisis.md`: code pointers.

User: change a crisis card in the toolbar; Edge places the mission cards and tokens; take tokens from a supply pile; give a token to a character; remove a token; Edge with Red Priority turns the tokens.

### Result

## Step 10: Character and phase actions

Work:

1. New `characters/actions.js`: the document writes of `useCharacterActions` (spawn, remove, stats, tokens on the character, give). New `game/actions.js`: the document writes of `usePhaseActions` (phases, Priority, cleanup).
2. The hooks keep refs, HUD and selection. `setup/actions.js` calls character removal directly.
3. `App` sets `characters` and `phases` in the table actions store. Components that get these handlers only as pass-through props read the store.
4. Tests `characters/actions.test.js`, `game/actions.test.js` against a `Y.Doc`, with fake lookups.
5. `docs/features/character-trays.md`, `docs/features/round-phases.md`: code pointers.

User: spawn a character from the Library; Damage and Power in the tray; Stamina to 0; remove a character; each phase button; Priority click; cleanup phase. In two browsers, the other browser shows each change.

### Result

## Step 11: Comments point to features

Work:

1. List the lines with `git grep -nE 'docs/plans/|plans/|\(plan|[0-9]{2}-[a-z-]+\.md|decisions? [0-9]+' -- apps/web/src`. Write the count before and after in the Result.
2. For each line about lasting behavior: find the feature section that has the fact. If the fact is only in a plan (mostly `implement-backend/09-moving-objects.md`, "Decisions that fill gaps in the design", and `05-yjs-state.md`), add it to the feature first: `docs/features/peer-to-peer.md` for claims, poses, the live channel, the document layout and the table writer; other features for their parts.
3. Repoint the comment to the feature section. A pointer to a shortcut or a plan-only fact stays (CLAUDE.md, "Docs").
4. `Table.jsx` (and `rooms/openTableSession.js` after `split-large-files.md`): the 12 "decision" pointers.

User: no app change. Read the new parts of `docs/features/peer-to-peer.md`.

### Result

## Step 12: Hook deps, tools and 3D

Work:

1. `LosTool.jsx` (6 disables), the `RulerTool` hooks (7 warnings, 2 disables), `DiceTray.jsx` (3 disables), `CharacterModel.jsx` (3 warnings, 3 disables), `Scene.jsx` and its new hook files (1 warning, 5 disables), `Terrain.jsx` (1 warning).
2. For each: fix it (add the dep, move a value into a ref, move a function inside the effect) when the behavior stays the same. Otherwise write the reason (decision 11).
3. A change that makes an effect run more often in a drag or a frame is not a fix. Keep the disable and write why.

User: drag, turn and bend each tool; LOS tool on terrain and models; dice rolls in both trays; drag and lift a model; turn the mat.

### Result

## Step 13: Hook deps, the rest

Work:

1. The other warnings and disables of Facts 8: `Root.jsx`, `TacticCard.jsx`, `CharacterTray.jsx`, `useCrisisTokens.js` (if still there after step 9), `TurnHandle.jsx`, `TokenFace.jsx`, `RosterCards.jsx`, `Preload.jsx`, `CrisisToken.jsx`, `CrisisCard.jsx`, `useBodyRef.js`, `useAutoOpen.js`, `ToolDragGhost.jsx`, `TokenDragPreview.jsx`, `Ping.jsx`.
2. Same rules as step 12.
3. Check: `pnpm lint` shows 0 `exhaustive-deps` warnings, and every remaining `eslint-disable` has a reason.

User: open a room from the lobby and from a link; tactic cards (flip, peek); character tray; crisis token turn handle; ping; drag a token to a character.

### Result

## Step 14: Feature folders

Runs alone, when no other plan branch is open (Risk 8). Only moves and import path changes.

Work:

1. Move with `git mv`. Default target per file (the files that the earlier plans add go with their parent file):
   - `scene/`: `Scene.jsx` and its hook and layer files, `SceneShared.jsx`, `WorldRef.jsx`, `look.js`, `canvasEvents.js`, `KeyboardCamera.jsx`, `WheelCamera.jsx`, `LabelOcclusion.jsx`, `labelOcclusion.js`, `SelectionOutlines.jsx`, `Ping.jsx`, `usePing.js`, `RemoteCursor.jsx`, `LiveSync.jsx`, `useLiveFollow.js`, `Preload.jsx`, `DragFootprint.jsx`, `footprintProjection.js`, `useHoverCursor.js`, `useColorTexture.js`, `useDisposeMaterials.js`, `FaceMaterial.jsx`, `OnTable.jsx`.
   - `characters/`: `CharacterModel.jsx`, `CharacterPortrait.jsx`, `CharacterTray.jsx`, `TrayControls.jsx`, `TrayPopup.jsx`, `throwPath.js`, `terrainUnder.js`.
   - `tabletools/`: `RulerTool.jsx` and its hook files, `LosTool.jsx`, `losBlock.js`, `losLength.js`, `rangeOne.js`, `aimTurn.js`, `toolFlip.js`, `toolInput.js`, `storedTool.js`, `placeLock.js`, `ToolRack.jsx`, `ToolPoint.jsx`, `ToolDragGhost.jsx`, `TurnHandle.jsx`.
   - `dice/`: `DiceTray.jsx`, `DiceTrayParts.jsx`, `OtherDiceTray.jsx`, `DiceKeys.jsx`.
   - `terrain/`: `Terrain.jsx`.
   - `crisis/`: `CrisisCard.jsx`, `CrisisChoose.jsx`, `CrisisCompare.jsx`, `CrisisToken.jsx`.
   - `tokens/`: `LooseToken.jsx`, `TokenDragPreview.jsx`, `TokenFace.jsx`, `TokenPanel.jsx`, `TokenPile.jsx`, `TokenSolid.jsx`, `SupplyPile.jsx`.
   - `tactics/`: `TacticCard.jsx`, `TacticFace.jsx`, `TacticFace.css`, `TacticFaceScaled.jsx`, `TacticTray.jsx`, `tacticFaceFit.js`, `tacticFaceTexture.js`, `useTacticFaceTexture.js`, `useFaceCard.js`.
   - `rosters/`: `RosterCards.jsx`, `RosterField.jsx`, `RosterPopup.jsx`, `RosterPopupHost.jsx`, `RoomRosterPopup.jsx`, `BreakdownTab.jsx`, `CardPopup.jsx`, `useCardPeek.js`.
   - `setup/`: `GameSetup.jsx`. `game/`: `PhaseButtons.jsx`, `PriorityMarker.jsx`. `scoreboard/`: `ScoreBoard.jsx`. `log/`: `LogPanel.jsx`. `settings/`: `SettingsPopup.jsx`, `KeyBindings.jsx`.
   - `rooms/`: `Lobby.jsx`, `LobbyHeader.jsx`, `JoinRoom.jsx`, `NewRoomDialog.jsx`, `RoomPlayers.jsx`, `CopyLinkButton.jsx`, `LoadingOverlay.jsx`. `auth/`: `UserMenu.jsx`.
   - `ui/` (2D parts that many features use): `Overlay.jsx`, `Switch.jsx`, `Carousel.jsx`, `HudNotice.jsx`, `HudWarnings.jsx`, `useHudMessage.js`, `Toolbar.jsx`, `TableButtons.jsx`, `Library.jsx`, `SpectatorBadge.jsx`, `SpectatorColumns.jsx`, and the `Dialog` of `remove-duplicates.md`.
   - A file not listed (added by the earlier plans) goes with the feature it serves. Write each such choice in the Result.
2. Update every import. `components/` is empty after the move and is removed.
3. Update the paths in `docs/features`, `docs/plans` (CLAUDE.md allows path changes in done plans), `apps/web/scripts`, CSS comments, code comments, `.oxlintrc.json` (the `tacticFaceTexture.js` exception), `.fallowrc.json`.
4. Checks: `git grep -n "components/" -- apps/web docs` gives 0 lines (or only lines that do not mean this folder; list them). `git diff -M --stat` shows only renames plus import lines.

User: open the Sandbox and a two-browser room, play the setup and one round, use each tool, the Library, the Log and Settings.

### Result

## Step 15: Flaky signal test

Added after the plan started. A test in `apps/api/test/signal.test.ts` (signal / message) fails sometimes and passes on a rerun. Runs after step 14.

1. Run `pnpm --filter api test` in a loop (at least 30 runs) to reproduce it. Find the cause: timing, shared state between tests, order of messages, a clock.
2. Fix the cause in the test or in the code. No retries and no longer timeouts as the fix.
3. Checks: the loop passes 30 times in a row. The checks of every step.

### Result
