# Plan: Split large files

Requested by the user on 2026-10-15. Status: not started. Branch `split-large-files`, worktree `../mcp_assist_3d-split-large-files`, from main after `docs/plans/review-fixes.md` merges into main. This plan touches many files, so no other branch is open while it runs.

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step:

- `pnpm format`, `pnpm lint` (no more warnings than before the step), `pnpm test`, `pnpm --filter web build`.
- `pnpm fallow health <file> --complexity` for each file the step splits. Write the numbers of the split functions, before and after, in the Result.
- `grep -rn "<Old>.jsx" apps/web/src apps/web/scripts docs/features` for each split file: a pointer to a moved name points to its new file.
- Review the move with `git diff --color-moved=dimmed-zebra --color-moved-ws=allow-indentation-change`. Moved code shows as moved, not as changed.

Line numbers are at `4698e42`. They move after `review-fixes` merges. Find the code by name.

## Request

A code review found very large files. The user asked to split them. The behavior must not change.

1. `components/Scene.jsx`: `Scene` takes 100 props and has 29 refs and 63 hook calls. It owns the model registry, the claim and pose sync between browsers, the Q / E turns, the terrain fall plan, and it renders every piece.
2. App and Scene talk through 11 refs that App makes and Scene fills. Hooks such as `useCrisisTokens` call Scene through them.
3. `components/RulerTool.jsx`: `Tool` has 9 states and 15 effects. The file also has pure geometry, two shared hooks that `LosTool.jsx` imports from a component, the buttons and the other player's tools.
4. `Table.jsx`: one effect of 232 lines opens the table. The "host deleted the room" exit is written twice. `openTableDoc(name).then(...)` has no `.catch`, so an error leaves the loading screen on forever.
5. `App.jsx` is 1,109 lines again. Check if a split is worth it.
6. `components/CharacterModel.jsx`, `components/GameSetup.jsx`, `components/DiceTray.jsx`: split where they mix concerns.
7. `setup/useGameSetup.js` (26 params) and `useCrisisTokens` (20 params): the plan `structure-fixes` changes them. This plan does not make them worse.

Removing duplicated code is the later plan `remove-duplicates`. This plan removes a duplicate only where a move makes it free. The others are in "Left for remove-duplicates".

## Facts

### Tests, lint, numbers

- Web tests use `node:test` and `node:assert/strict`: `node --test "{src,scripts}/**/*.test.js"`. 806 tests pass at `4698e42`.
- `node --test` cannot load `.jsx`, a module that reads `import.meta.env`, or a module that imports `.json` without `with { type: 'json' }`. These do not load: `rooms/serverStore.js`, `rosters/cards.js`, `components/throwPath.js`, and the list in `split-app.md`, "Tests". A pure helper takes such lookups as arguments, as `cleanupCrisisTokens(tokens, cardOf)` does.
- These load in Node (checked): `three`, `yjs`, `y-protocols/awareness`, `net/{doc,live,ownership,presence,syncChannel,peer,signaling,traffic,fingerprint,debugFlags,ice}.js`, `rooms/{table,serverTable,store,tableDoc}.js`, `crash/reporter.js`, `dice/{tray,shelf,throw,stored,faces}.js`, `scoreboard/affiliations.js`, `setup/{setup,names,deckButton}.js`, `rosters/layout.js`, `components/storedTool.js`, `tabletools/layout.js`, `physics.js`, `net/livePose.js`.
- `pnpm lint`: 58 warnings at `4698e42`. In the files of this plan: `RulerTool.jsx` 8 (7 `exhaustive-deps`, 1 `refs`), `CharacterModel.jsx` 3, `Scene.jsx` 1 (the tray follow effect). A warning moves with its code.
- `pnpm fallow` (`health`): 319 functions above the thresholds (cyclomatic 20, cognitive 15, CRAP 30).

| Function | Cyclomatic | Cognitive | Lines |
|---|---|---|---|
| `Scene` (Scene.jsx:311) | 68 | 211 | 1,562 |
| `App` (App.jsx:91) | 54 | 116 | 1,019 |
| `Tool` (RulerTool.jsx:892) | 37 | 98 | 838 |
| roll flow frame (DiceTray.jsx:667) | 47 | 72 | 119 |
| `BoardPanel` (GameSetup.jsx:249) | 42 | 51 | 191 |
| `CharacterFigure` (CharacterModel.jsx:266) | 6 | 65 | 597 |
| open table `.then` (Table.jsx:202) | 27 | 25 | 109 |
| `Table` (Table.jsx:53) | 9 | 17 | 290 |
| `LosTool` (LosTool.jsx:189) | 5 | 35 | 191 |

File lines: `RulerTool.jsx` 1,910, `Scene.jsx` 1,872, `App.jsx` 1,109, `CharacterModel.jsx` 862, `DiceTray.jsx` 815, `GameSetup.jsx` 606, `LosTool.jsx` 423, `Table.jsx` 343.

### Map of Scene.jsx

| Lines | Section | Owns |
|---|---|---|
| 118–195 | Constants, helpers | `TOOL_HOVER_HEIGHT`, turn constants, `samePose`, `SLEEP_AFTER_FRAMES`, `trayShapeOf` |
| 197–412 | Props | the props comment, 100 props |
| 413–469 | Registry and turn refs | `charBodies`, `worldRef`, `rapierRef`, `liveCharBody`, `charObjects`, `charLifts`, `trayObjects`, `terrainObjects`, `raycaster`, `tokenObjects`, `tokenCenters`; `placeLimits`, `limitTool`; `hoveredPiece`, `draggedPiece`, `toolTurns`, `toolLives`, `diceLives`, `received`, `turnsLeft`, `angleTool`, `turnHold` |
| 469–531 | View state, subscriptions, claims | `draggingCharId`, `rangeMark`, `moved`, `markMoved`; `otherOwned`, `otherDragKey`, `otherSpawn`, `otherLook`; E1; `claimTimes`, `claims`, `claimModel`; `sleepLater`, `posesRef`, `prevPoses`, `prevOther`, `overlapIds` |
| 533–569 | Models, overlap | `models`, `modelBases`, E2 |
| 571–622 | Lookups | `characterAt`, `terrainAt`, `terrainUnder` |
| 624–663 | Hover label | `hoverLabelId`, E3 |
| 665–694 | | `modelPosition`, `restPose`, `trackPiece` |
| 696–740 | Q / E turns | `turnPiece`, `addTurn`, `applyTurn`, F1 |
| 742–844 | Pose sync | `applyPose`, F2, E4–E7 |
| 846–885 | Piece actions | `liftPiece`, `floorPiece`, `returnModels` |
| 887–932 | Terrain fall | `pendingDrops`, `planFall`, E8 |
| 934–959 | Tool props, bridge | `turnProps`, E9 |
| 961–986 | Trays | `trayPositions`, `gruntLists`, `trayShape`, E10 |
| 988–1217 | Derived view | selection ids, deploy line, `matTokens`, `secureTokens`, `heldTokens`, `tokenViews`, `toolModels`, `applyPlaceLimits`, tool helpers, `rangeMarkOf`, `otherSelectedOf`, `otherTarget`, `angleLimit`, spawn places, `spectatorOverlay`, selection handlers |
| 1219–1302 | JSX: table | backdrop, `Physics`, pings, `LiveSync`, walls, mat, terrain |
| 1304–1381 | JSX | dice trays, score board, Priority marker, crisis cards, supply piles |
| 1382–1515 | JSX: tokens | crisis tokens, loose tokens, piles, drag preview, other spawn preview |
| 1517–1629 | JSX | table buttons, rack, tool ghost, tactic trays, roster cards, `GameSetup`, tactic cards, character trays |
| 1631–1721 | JSX: models | the props of each model |
| 1723–1835 | JSX: own tools | move, angle, LOS, the two deploy tools (1782–1811), range |
| 1836–1867 | JSX: other tools | `OtherLos`, `OtherTool` |

**Effect order in Scene.** E1 presence mark (497), E2 overlap interval (555), E3 hover label (627), F1 turn frame (726), F2 claim frame (757), E4 lost tie (792), E5 `posesRef` (794), E6 remote poses (801), E7 other claims (818), E8 terrain drops (919), E9 bridge (950), E10 tray follow (972). `useFrame` callbacks run in the order of their calls, so F1 runs before F2 in each frame. F2 reads `turnsLeft` as "busy".

### The 11 bridge refs

App makes them (App.jsx 122–415). Scene or its children fill them:

| Ref | Filled by | Called from |
|---|---|---|
| `characterAtRef` | Scene E9 | `drag/useTokenDrag.js` (`findCharacterAt`) |
| `modelPositionRef` | Scene E9 | `crisis/useCrisisTokens.js` |
| `returnModelsRef` | Scene E9 | `useCrisisTokens.js`, `characters/useCharacterActions.js` |
| `turnPieceRef` | Scene E9 | App keys and Toolbar `onTurn` |
| `liftPieceRef` | Scene E9 | App keys |
| `floorPieceRef` | Scene E9 | App keys |
| `terrainAtRef` | Scene E9 | `pieces/useTablePieces.js` (L key) |
| `terrainDropRef` | Scene E9 (`planFall`) | `useTablePieces.js` (terrain delete) |
| `modelDragRef` | Scene, model drag start and end (a value, not a function) | App key state |
| `addDiceRef` | `DiceTray` through `addRef` | App keys |
| `toolPointRef` | `ToolPoint` effect, null on unmount | `components/usePing.js`, `tabletools/useTableTools.js` |

No feature doc names these refs.

### Map of RulerTool.jsx

| Lines | Section |
|---|---|
| 32–60 | Constants |
| 62–82 | `textured`, `hullPoints` (meshes) |
| 84–223 | Geometry: `yawQuat`, `yawTo`, `wrapAngle`, `toolPose`, `toolShape`, `alongHalf`, `nearerHalf`, `turnAround`, `cornerSnapCenter`, `nearerCorner`, `snapPose`, `anglePose`, `aimPose`, `limitTurn`, `snapPoseOne`, `throwLine` |
| 225–260 | `useFootprintGround` |
| 262–439 | `useDragTool` |
| 441–461 | `useRestStore` |
| 463–489 | `RANGE_HALF_WIDTH`, `CONTACT_EPS`, `sameModel`, `lockKey`, `withinRangeOne`, `sameMark` |
| 491–594 | `RangeMark`, `ToolFootprint` |
| 596–728 | `RangeRuler`, `useRangeParts`, `DeployRangeTool`, `useMovementParts`, `MovementRuler`, `AngleRuler` |
| 730–858 | `BUTTON_STYLE`, `FLAT_HTML_Y`, `FlatHtml`, `PX_PER_INCH`, `PLACE_FILL`, `clickByKey`, `ToolButton`, `BendButton` |
| 860–1729 | `Tool` |
| 1731–1910 | `OtherToolBody`, `OtherRange`, `OtherMovement`, `OtherAngle`, `OtherTool` |

Importers: `Scene.jsx` (the three rulers, `DeployRangeTool`, `OtherTool`, `sameModel`), `LosTool.jsx` (`ToolFootprint`, `toolPose`, `turnAround`, `useDragTool`, `useRestStore`, `yawQuat`, `yawTo`), `ToolRack.jsx` (`useMovementParts`, `useRangeParts`).

**Inside `Tool`.** States: `hovered`, `start`, `turn`, `mode`, `bendOn`, `snap`, `placeSide`, `placeOne`, `throwLock`. Effects in order: T1 `turnRef` (1153), T2 `angleRef` (1158), T3 hover (1169), T4 drag unmount (1174), T5 spawn (1265), T6 `latest` (1298), T7 `liveRef` (1302), then `useRestStore` (1313), T8 snapped piece gone (1334), `useOutline` (1338), T9 lock reset (1343), T10 Place (1349), T11 Place 1 (1376), T12 Throw (1406), T13 `limiting` (1439), T14 `limitTaken` (1443), T15 free tool ends Place 1 (1450). `modelsRef` is read only by `throwOthers`. The drag end callback of `useDragTool` (989) reads `latest`, which is declared later; it runs after the render, so this works today.

### Table.jsx

- The open effect (84–315) has 11 `let` locals and the `ended` list: `cancelled`, `doc`, `sync`, `awareness`, `ownership`, `presence`, `live`, `liveChannel`, `current`, `fingerprintTimer`. Refs outside it: `link`, `record`, `writer`, `trafficLog`, `exit`.
- "Host deleted the room": writer `onGone` (246–250) and `onState` with `gone` (290–294), the same three lines.
- `handleExit` flushes `record` and `writer`, logs traffic, then calls `onExit`. `connection.retry` calls `link.current?.retry()`.
- `net/peer.js` is the model for a plain module: it imports no module that reads `import.meta.env`, and everything outside is an argument.
- Uncaught errors and unhandled rejections go to `reportError(source, error)` in `crash/errors.js`.
- Root's `onExit(text)` opens the lobby and shows `text` as a notice.

### Other files

- `GameSetup.jsx`: `STEP_NAME`, `stepChoice` (65), `chooses` (101), `decides` (111) and `rollOffText` (175) are module functions, not inside a component. `stepChoice` calls `rosterCard`, which does not load in Node. `BoardPanel` builds the hint, note and controls of each step in one `if` chain.
- `CharacterModel.jsx`, `CharacterFigure`: lift (`lift`, `toggleLift`, `lowerLift`, `endLift`, `moveLift`), landing sound (`landed`, `listenLanding`, `useAfterPhysicsStep`, `bump`, `remoteBump`, `livePlace`), live follow (`follow`, `following`, `followLive`), looks (base color effect 664, overlap tint effect 679), drag (`onPointerDown`, the drag part of the frame, `toggleFloor`). Effect order: `useAfterPhysicsStep` (416), start asleep (541), `liftRef` (546), frame (566), remote mode (644), base color (664), tint (679), `useOutline`, `useHoverCursor`, hover (706), unmount (798).
- `DiceTray.jsx`: `shelfFromDocument` (65) is pure. The roll flow frame (667) has two pure parts: what a resting thrown die becomes (lost, wait, flat), and the stage of the tray (rolling, sliding, flat, waiting).
- `App.jsx`: hooks and wiring 91–741, JSX 742–1109. The Canvas/Scene JSX and the Toolbar JSX stay in `App` on purpose (`split-app.md`, decision 8).

## Decisions

1. **Move code without changing it.** A function body moves as it is. A hook result is destructured back into the same names, so call sites and JSX stay the same.
2. **No new `useCallback`, `useMemo` or `memo`.** Moved ones stay as they are (`claimModel` keeps its `useCallback`, `toolModels` its `useMemo`). Handlers are made again on every render, as today.
3. **Every builder that runs during render and holds a hook gets a `use*` name**, so the rules-of-hooks lint keeps the call order fixed.
4. **Each moved effect and `useFrame` keeps its place in the call order, its deps array and its `eslint-disable` comment.** A hook that holds an effect is called where the effect is now. Refs and state can move earlier or later; they have no order rule.
5. **One `sceneApi` ref, made in App, set by Scene in one place.** App makes `sceneApi = useRef(null)` at the top of `App` and passes it to Scene as `apiRef`. Scene sets `apiRef.current` in one effect on every render (the place of E9). The shape is built by `createSceneApi(parts)` in the new `components/sceneApi.js`, with the documented keys. No module-level registry: a module object lives longer than one table, so after a table change it can hold functions of an unmounted Scene; StrictMode mounts twice; and tests would share state. The ref lives as long as App, and App is mounted again for each table.
6. **Pure logic goes in `.js` files with `node:test` tests next to them.** A lookup that does not load in Node comes in as an argument (`cardOf`).
7. **Places.** Pure tool geometry goes to `components/toolGeometry.js`, next to `aimTurn.js`, `placeLock.js` and `rangeOne.js`. The tool hooks go to `tabletools/`. New Scene hooks go to `components/`, next to `Scene.jsx`. The open session goes to `rooms/openTableSession.js`.
8. **App gets no split other than `sceneApi`.** `split-app.md` decision 8 still holds: the Canvas/Scene and Toolbar JSX pass 100 and 40 props, so a wrapper only moves lines. The rest of `App` is hook wiring. The two hook signatures belong to `structure-fixes`. Step 5 removes 11 refs and 11 Scene props from App.
9. **Scene props stay one flat list** (minus the 11 refs, plus `apiRef`). Grouping them into objects only moves lines.
10. **The model JSX (1631–1721) stays in Scene.** It uses the registry, the claims, the turns, the deploy line and the place limits; a component would need about 30 props.
11. **Table error path.** When opening the table throws, the session closes what it opened, calls `reportError('promise', err)` (the report the unhandled rejection gives today), and exits to the lobby with the notice "Could not open the table. Try again." A cancelled open ignores the error.
12. **Free dedupe only.** The session has one `roomGone()` for the two "host deleted the room" paths, because both move into one module. Other duplicates are listed below.
13. **`useGameSetup` and `useCrisisTokens` signatures** do not grow. `sceneApi` replaces two ref params of `useCrisisTokens` with one.
14. **The user tests at the end** of the plan, with the "User" lists of every step. The user can also test after any step.

## Risks

1. **Stale closures are part of today's behavior.** The effects with `[]` or partial deps (E6, E7, E8, T5, T7) keep the functions of the render that ran them. These functions read refs, so this works. Do not add deps or change a ref read to a state read.
2. **Temporal dead zone.** `const` values from hooks are not hoisted. A value used during render must come after the hook that gives it. A closure that runs later (`latest` in the drag end of `Tool`, `applyPose` in `returnModels`) can name a later `const`.
3. **Frame order.** In Scene, F1 must stay before F2. Call `usePieceTurns` before `useModelSync`.
4. **A circle between turns and claims.** `addTurn` needs `claimModel`; F2 and E4 need `turnsLeft`. So the claims (`useModelClaims`), the turns (`usePieceTurns`) and the sync (`useModelSync`) are three hooks, called in today's order.
5. **New wrapper components** (`TokenLayer`, `OwnTools`, `OtherTools`) are always mounted, so their pieces do not mount again at runtime. Child effects run before parent effects, as for the tools today. Keys stay the same.
6. **`sceneApi` timing.** Today the 8 functions are set in a passive effect on every render, `addDice` and the tool point by child effects. The new wrappers read Scene's own refs at the call, so a call gives the same result. Before Scene's first effect, `sceneApi.current` is null; every caller uses `?.`, as with the refs today.
7. **StrictMode** runs the open effect twice in dev. The first session closes before its document opens, and closes that document.
8. **Lint warnings move with their code.** The count stays 58 (or the count after `review-fixes`). A warning that moves to a new file is not a new warning.

## Step 1: Tool geometry

Work:

1. New `components/toolGeometry.js`: `ANGLE_LIMIT`, `SIDES`, `OTHER`, `STRAIGHT`, `ANGLE_TURN`, `RANGE_HALF_WIDTH`, `MOVE_HALF_WIDTH`, `CONTACT_EPS`, `yawQuat`, `yawTo`, `wrapAngle`, `toolPose`, `toolShape`, `alongHalf`, `nearerHalf`, `turnAround`, `cornerSnapCenter`, `nearerCorner`, `snapPose`, `anglePose`, `aimPose`, `limitTurn`, `snapPoseOne`, `throwLine`, `sameModel`, `lockKey`, `withinRangeOne`, `sameMark` (RulerTool.jsx 41, 51–60, 84–223, 463–489). It imports `three` and `placeLock.js`, both load in Node.
2. `RulerTool.jsx`, `LosTool.jsx` and `Scene.jsx` import these names from the new file.
3. Test `components/toolGeometry.test.js`: `turnAround` keeps the distance to the pivot; `snapPose` for both sides and with no yaw (points to the mat center); `anglePose` puts both arm lines at `radius + halfWidth`; `aimPose` away and toward; `limitTurn` clamps to ±45° around `openYaw`; `snapPoseOne` at the mat center and off it; `throwLine` start, direction and distance; `nearerCorner` for four points; `withinRangeOne` at the edge with `CONTACT_EPS`; `sameMark` with null.

User: snap the range, movement and angle tools to a model; Range 1 snaps with a corner; Toward / Away aims at a model; a movement tool at an angle tool stays within 45°; Throw.

### Result

Done. New `components/toolGeometry.js` (constants, geometry, `sameModel`, `lockKey`, `withinRangeOne`, `sameMark`; each name exported, code unchanged). `RulerTool.jsx`, `LosTool.jsx`, `Scene.jsx` import from it. Test `toolGeometry.test.js` (12 tests). Pointer comments to moved names (`toolShape`, `alongHalf`, `snapPose`, `CONTACT_EPS`) now name `toolGeometry.js`.

- Checks: format, lint 58 warnings (same), test 841 pass (806 + review-fixes + 12 new), build ok.
- Fallow: `Tool` 838 lines before and after (its numbers do not change; the moved functions were below the thresholds). `RulerTool.jsx` 1,910 to 1,758 lines.
- Move diff: only `export` added to moved declarations.
- Deviation: `fromLocal` and `toLocal` imports dropped from `RulerTool.jsx` (only the geometry used them).

## Step 2: Shared tool hooks and footprint

Needs step 1.

Work:

1. New `tabletools/useDragTool.js`: `useDragTool`, with `HOVER_RATE` and `FLAT_HTML_Y` exported (`DeployRangeTool` uses the first, `FlatHtml` the second).
2. New `tabletools/useRestStore.js`: `useRestStore` with `REST_TIME`.
3. New `tabletools/useFootprintGround.js`: `useFootprintGround` with `HOVER_MARGIN` and `FOOTPRINT_CAST_HALF_H`.
4. New `components/ToolFootprint.jsx`: `ToolFootprint` and `RangeMark`.
5. `LosTool.jsx` imports from these files and from `toolGeometry.js`. It no longer imports `RulerTool.jsx`.

User: drag, turn and drop each tool and the Line of Sight tool; a tool hovers over terrain; reload and the tools stay where they were; the footprint turns green or red against the selected model; the range mark outline during a turn.

### Result

Done. New `tabletools/useDragTool.js` (`HOVER_RATE`, `FLAT_HTML_Y`), `tabletools/useRestStore.js` (`REST_TIME`), `tabletools/useFootprintGround.js` (`HOVER_MARGIN`, `FOOTPRINT_CAST_HALF_H`), `components/ToolFootprint.jsx` (`ToolFootprint`, `RangeMark`). Code moved as it is. `LosTool.jsx` no longer imports `RulerTool.jsx`. `RulerTool.jsx` imports the new files (and `HOVER_RATE`, `FLAT_HTML_Y` from `useDragTool.js`). Pointers `RangeMark in RulerTool.jsx` (CharacterModel, CrisisToken, SelectionOutlines, Scene) and `line-of-sight.md` now name `ToolFootprint.jsx`.

- Checks: format, lint 58 warnings (same), test 841 pass, build ok.
- Fallow: `Tool` 37 / 98 / 838 lines before and after. `RulerTool.jsx` 1,758 to 1,396 lines.
- Move diff: only `export` and imports added or dropped.
- Deviation: `useThree`, `castDown`, `liveBody`, `startPointerDrag`, `footprintGap` and other imports unused after the move dropped from `RulerTool.jsx`. No tests added (hooks and `.jsx` do not load in Node).

## Step 3: RulerTool file split

Needs step 2.

Work:

1. New `components/ToolButtons.jsx`: `BUTTON_STYLE`, `FlatHtml`, `PX_PER_INCH`, `PLACE_FILL`, `clickByKey`, `ToolButton`, `BendButton`.
2. New `components/ToolParts.jsx`: `TEXTURE`, `textured`, `hullPoints`, `useRangeParts`, `useMovementParts`, `DeployRangeTool`.
3. New `components/OtherTool.jsx`: `noRaycast`, `OtherToolBody`, `OtherRange`, `OtherMovement`, `OtherAngle`, `OtherTool`. Its `refs` lint warning moves with it.
4. `RulerTool.jsx` keeps `Tool`, `RangeRuler`, `MovementRuler`, `AngleRuler`. `Scene.jsx` and `ToolRack.jsx` import from the new files.

User: the tool rack shows the tools in the player color; Deploy Lock shows the R3 tool along the edge during a model drag; in two browsers, the other player's tools move, bend and show their footprint; Place, Throw, Bend and Toward / Away buttons by click and by keyboard.

### Result

Done. New `components/ToolButtons.jsx` (`BUTTON_STYLE`, `FlatHtml`, `PX_PER_INCH`, `PLACE_FILL`, `clickByKey`, `ToolButton`, `BendButton`), `components/ToolParts.jsx` (`TEXTURE`, `textured`, `hullPoints`, `useRangeParts`, `useMovementParts`, `DeployRangeTool`), `components/OtherTool.jsx` (`noRaycast`, `OtherToolBody`, `OtherRange`, `OtherMovement`, `OtherAngle`, `OtherTool`; its `refs` warning moved with it). `RulerTool.jsx` keeps `Tool`, `RangeRuler`, `MovementRuler`, `AngleRuler`. `Scene.jsx` and `ToolRack.jsx` import from the new files. Pointers to `OtherToolBody` (LosTool.jsx) and `FlatHtml` (character-trays.md) name the new files.

- Checks: format, lint 58 warnings (same), test pass, build ok.
- Fallow: `Tool` 37 / 98 / 838 lines before and after. `RulerTool.jsx` 1,396 to 976 lines.
- Move diff: only `export` added to `FlatHtml`, `ToolButton`, `BendButton`, `hullPoints`, plus imports.
- Deviation: `hullPoints` exported (used by `Tool` and `OtherToolBody`). Other `RulerTool.jsx` pointers still name `Tool`, `RangeRuler`, which stay there.

## Step 4: Tool hooks

Needs step 3.

Work:

1. New `tabletools/useToolLimits.js`: Place, Place 1 and Throw. State `placeSide`, `placeOne`, `throwLock`; `lockedRef`, `modelsRef`; derived `placing`, `lockOne`, `throwing`, `placeButtonSide`, `lockMode`, `limiting`; effects T9–T15; `togglePlace`, `handlePlaceOne`, `handleThrow`, `throwOthers`. Called at T9's place, after `useOutline`. Takes one object: `selected`, `snap`, `turn`, `setTurn`, `tip`, `halfWidth`, `rigidRef`, `liveRb`, `world`, `rapier`, `models`, `onPlaceLimit`, `limitTaken`, `onLimitOn`. The 3 lint warnings of T10–T12 move with them.
2. New `tabletools/useToolStore.js`: `latest`, T6, T7 and the `useRestStore` call. Returns `latest`. Called at T6's place.
3. `toolGeometry.js` gets two pure functions, and `Tool` applies their result with the same body calls in the same order:
   - `spawnPose({ center, radius, angle, rangeOne, bendable, aimPoint, tip, halfWidth, open })`: the pose of T5.
   - `snapPlacement(pose, turn, center, radius, { angle, rangeOne, bendable, tip, halfWidth, open })`: the result of `snapTo`, `{ x, z, yaw, side, across, flipped }`, with `flipped` the flipped pose and turn or null. The angle branch keeps its own case (ground at the old yaw, no rotation, side `left`, no `across`).
4. Tests in `toolGeometry.test.js` for both, each branch.
5. `stepTool`, `dragPlan`, `snapTo` and the JSX stay in `Tool`.

If one of the pure functions needs more than the same reads in the same order, keep that code in `Tool` and write why in the Result.

User: Place, Place 2, Place 1 and Throw lock and limit a model drag; only one own tool has Place or Throw on; a free tool turns Place 1 off; tool spawn by key over a model, over the table, from the rack; the angle tool spawns aimed at the aim piece; a tool snaps when dragged onto a model; a movement tool flips to snap with its indented end; reload keeps tool pose, bend, snap and mode.

### Result

Done. New `tabletools/useToolLimits.js` (Place, Place 1, Throw: state, effects T9-T15, handlers, `throwOthers`; called after `useOutline`), `tabletools/useToolStore.js` (`latest`, T6, T7, `useRestStore`; called at T6's place; returns `latest`). `toolGeometry.js` has `spawnPose` and `snapPlacement`; `Tool` applies their result with the same body calls. 6 tests added to `toolGeometry.test.js` (each branch). `RulerTool.jsx` 976 to 749 lines.

- Checks: format, lint 58 warnings (same), test 847 pass, build ok.
- Fallow: `Tool` 37 / 98 / 838 lines before; 27 / 75 / 619 lines after.
- Move diff: effects and handlers moved as they are; only the `snapTo` and spawn pose math became calls.
- Deviation: `snapTo` calls `angleLimit` before the flip body calls (it is a pure read of another tool). The angle branch skips `setRotation` and `across`, as before.
- Deviation: with the 3 warnings of T10-T12 moved out, the React compiler lint now reads `Tool` and reports 4 warnings it did not before (2 `immutability` on `dragChange` and `latest` in the drag callbacks, 2 `set-state-in-effect` in T5 and T8). The code is the same as before. Each has an `eslint-disable-next-line`, so the count stays 58.

## Step 5: One `sceneApi` ref

Work:

1. New `components/sceneApi.js`: `createSceneApi(parts)`, which returns the object below with exactly these keys. The comment at its top is the documented shape.
   - `characterAt(clientX, clientY, options)` → character id or null
   - `modelPosition(characterId)` → `{ x, z }` or null
   - `returnModels(characterId)`
   - `turnPiece(direction)`, `liftPiece()`, `floorPiece()` → HUD message or null
   - `terrainAt()` → terrain id or null; `planFall(terrainId)` → `{ terrain }`
   - `modelDragId()` → model id or null
   - `addDice(side, count)`
   - `pointAtPointer()`, `pointAtCenter()` (`ToolPoint.jsx`)
2. Scene: new prop `apiRef`. Scene keeps its own `modelDrag`, `addDice` and `toolPoint` refs and passes them where the App refs went (`ToolPoint`, `DiceTray addRef`, model drag start and end, `floorPiece`). E9 becomes one line: `apiRef.current = createSceneApi({...})`. The wrappers read the refs at the call.
3. App: `const sceneApi = useRef(null)` at the top. The 11 refs and their 11 Scene props go away. Callers use `sceneApi.current?.x(...)`: the key table, the key state (`modelDrag`), Toolbar `onTurn`, `useTokenDrag`, `useCrisisTokens`, `useCharacterActions`, `useTablePieces`, `useTableTools`, `usePing`. Each hook takes `sceneApi` in place of its refs.
4. Test `components/sceneApi.test.js`: the key list; each wrapper calls its part with the same arguments; `pointAtPointer` with no tool point gives undefined, as `toolPointRef.current?.atPointer()` does.
5. Update the props comment of Scene and the ref comments in App and in the hooks.

User: L over terrain; Delete of terrain with a model on it (the model falls); R lifts and lowers; R during a model drag switches the floor; Q / E on a model and a tool, by key and by the toolbar; number keys over the own dice tray; P; tool keys at the pointer and with nothing under it; a token drag onto a model and onto a tray; Dazed drop; the tray Remove button.

### Result

Done. New `components/sceneApi.js` (`createSceneApi(parts)`, `SCENE_API_KEYS`, shape documented at the top; a missing part throws) and `sceneApi.test.js` (5 tests). Scene has the prop `apiRef` and its own `modelDrag`, `addDice`, `toolPoint` refs; E9 is one `apiRef.current = createSceneApi({...})`. App makes `sceneApi = useRef(null)` at the top of `App`; the 11 refs and 11 Scene props are gone. `useTokenDrag`, `useCrisisTokens`, `useCharacterActions`, `useTablePieces`, `useTableTools`, `usePing`, the key table and Toolbar `onTurn` call `sceneApi.current?.x(...)`. Props comments in Scene, App and the hooks updated.

- Checks: format, lint 58 warnings (same), test 852 pass (847 + 5), build ok. Pointer grep: no old ref name left in `apps` or `docs/features`.
- Fallow: `Scene` 68 / 204 / 1,562 lines, 90 props (was 68 / 211, 100 props); `App` 55 / 106 / 984 lines (was 54 / 116, 1,019).
- Deviation: the key state `modelDrag` reads `(sceneApi.current?.modelDragId() ?? null) !== null`, so a null `sceneApi` gives false, as the old ref (null) did.
- Deviation: `addRef` of `DiceTray` and `ToolPoint` are always passed (Scene always has the refs); App passes no refs now.

## Step 6: Scene registry and terrain fall

Needs step 5.

Work:

1. New `components/useModelRegistry.js`: `useModelRegistry({ models, characters })`. Owns `charBodies`, `worldRef`, `rapierRef`, `charObjects`, `charLifts`, `trayObjects`, `terrainObjects`, `raycaster`, `tokenObjects`, `tokenCenters`, and `liveCharBody`, `modelBases`, `characterAt`, `terrainAt`, `terrainUnder`, `modelPosition`, `restPose`. Calls `useThree` itself. No effect inside. The `models` memo moves up, before the call.
2. New `components/useTerrainHoverLabel.js`: `hoverLabelId` and E3, with its deps and its `eslint-disable`. Called at E3's place.
3. New `components/useTerrainFall.js`: `pendingDrops`, `planFall`, E8. Takes `models`, `liveCharBody`, `charLifts`, `ownership`, `worldRef`, `rapierRef`, `terrainObjects`, `terrain`, `claimModel`, `applyPose`, `onModelRest`. Returns `planFall`. Called at E8's place.

User: everything of step 5 again; the hover label of terrain with labels off; a token drop onto a model and onto the tray plate; the overlap mark of two models; Delete of terrain under a model, also in two browsers.

### Result

Done. New `components/useModelRegistry.js` (refs, `liveCharBody`, `modelBases`, `characterAt`, `terrainAt`, `terrainUnder`, `modelPosition`, `restPose`; calls `useThree`, no effect), `components/useTerrainHoverLabel.js` (`hoverLabelId`, E3 with its deps and disable), `components/useTerrainFall.js` (`pendingDrops`, `planFall`, E8; returns `planFall`). The `models` memo is now before the registry call. Hooks are called at the old places of their code. `raycaster` is used only inside the registry, so Scene does not get it. Pointers to `characterAt` (useCrisisTokens, useTokenDrag, CharacterTray, character-trays.md) and `modelPosition` (useCrisisTokens) name `useModelRegistry.js`.

- Checks: format, test pass, build ok. Move diff: only moved code, imports, and the destructure and hook calls in `Scene`.
- Lint 59 warnings (was 58). New: `exhaustive-deps` on the `toolModels` memo in `Scene.jsx`. `liveCharBody` and the `.current` of the maps now come from a custom hook, so the rule no longer counts them as stable. The memo is unchanged. No `eslint-disable` added. The tray follow warning stays 1, with a longer list of names.
- Fallow: `Scene` 68 / 204 / 1,562 lines before; 68 / 192 / 1,385 lines after. `Scene.jsx` 1,872 to 1,688 lines.
- Deviation: none in the code split. `Scene` has no pointer to `terrainUnder` outside the hover hook.


## Step 7: Scene claims, turns, pose sync

Needs step 6.

Work:

1. New `components/useModelClaims.js`: `claimTimes`, `claims`, `claimModel`. Called where `claims` is now.
2. New `components/usePieceTurns.js`: `hoveredPiece`, `draggedPiece`, `toolTurns`, `turnsLeft`, `turnHold`, `trackPiece`, `turnPiece`, `addTurn`, `applyTurn`, F1. Takes `heldRotate`, `turnStep`, `claimModel`, `liveCharBody`. Called at F1's place.
3. New `components/useModelSync.js`: `sleepLater`, `posesRef`, `prevPoses`, `prevOther`, `applyPose`, F2, E4, E5, E6, E7. Takes `ownership`, `poses`, `otherOwned`, `models`, `liveCharBody`, `charLifts`, `turnsLeft`, `claimTimes`, `restPose`, `onModelRest`, `markMoved`. Returns `applyPose`. Called right after `usePieceTurns`. Risk 3 and 4.
4. `samePose` and `SLEEP_AFTER_FRAMES` move to `useModelSync.js`. The turn constants move to `usePieceTurns.js`.

User, two browsers: drag a model in one, it follows in the other and rests at the same place; both grab the same model (one wins, the other stops); Q / E held on a model and a tool; a turn during a drag; Escape during a drag drops the turn; reload: models start at their rest poses; a browser leaves during a drag, the other writes the rest pose.

### Result

## Step 8: Scene layers

Needs step 7.

Work:

1. `characters/trays.js`: `trayShapeOf(ch, characters, gruntLists)`, moved from Scene. Test in `trays.test.js`: a host, a grunt (slot and index), a grunt whose host is gone.
2. New `components/TokenLayer.jsx` (Scene 1382–1515): crisis tokens, loose tokens, piles, the drag preview, the other spawn preview. The `tokenViews` memo moves in (only the tokens use it). `NO_RAYCAST` and `HELD_STACK_STEP` move in.
3. New `components/OwnTools.jsx` (1723–1781, 1812–1835): move, angle, LOS and range tools. `limitTool` and `angleTool` move in; `angleLimit` moves in. Props: `ownTools`, `ownSide`, `onToolStore`, `onToolReturn`, `onToolRemove`, `toolSpawn`, `angleSpawn`, `selectedTools`, `onSelectedToolsChange`, `toolTarget`, `toolModels`, `toolModel`, `onSnap`, `placeLimits`, `setRangeMark`, `turnProps`. The two deploy tools stay in Scene.
4. New `components/OtherTools.jsx` (1836–1867): `otherTarget` moves in. Props: `otherTools`, `otherSide`, `otherLook`, `toolModels`, `received`.
5. `toolKey` goes where it is used: both tool files. It is one line.

User: crisis tokens (select, drag, turn, hold on a card, held on a grunt card), loose tokens and piles (drag, Shift move, Delete), the drag preview of each source, the other player's spawn preview; every own tool; the other player's tools and their target outline; Range 1 of the other player measures from its snapped model.

### Result

## Step 9: Open table session

Work:

1. New `rooms/openTableSession.js`: `openTableSession({ room, userId, deps, onOpen, onServerWarning, onConnection, onExit })` → `{ close(), flush(), retry() }`. It holds the body of the open effect: the locals, traffic, fingerprint, `close`, the server read, schema fill (with the guard of `review-fixes`), awareness, ownership, presence, live hub, room record, writer, connection, page events. `docName`, `loadError`, `START_MAP` and the timing constants move with it. `flush()` is the record flush, the writer flush and the traffic line of `handleExit`.
2. It imports the modules that load in Node directly. `deps` holds the rest: `openTableDoc`, `getTable`, `putTable`, `postMessage`, `getMessages`, `deleteDoc`, `watchRoomRecord`, `watchServerTable`, `connectRoom`, `createPeerConnection`, `build()`, `iceConfig()`, `liveFlags()` (drop and delay), `document`, `window`, `randomId()`, `reportError`. Functions, not values: today the flags are read at each open.
3. One `roomGone()` for both "host deleted the room" paths (Decision 12).
4. The error path (Decision 11): `.catch` on the open chain.
5. `Table.jsx`: module constant `TABLE_DEPS`; one effect that opens the session and closes it in its cleanup; `opened`, `serverWarning`, `connection` state as today; `sessionRef` in place of `link`, `record`, `writer`, `trafficLog`. `handleExit` calls `sessionRef.current?.flush()`, then `onExit()`. `connection.retry` calls `sessionRef.current?.retry()`.
6. Test `rooms/openTableSession.test.js` with fakes: the Sandbox opens a filled table with no connect call; a single player room starts the room record, and `flush` flushes it; a multiplayer room applies the server bytes; 403 and 404 delete the local copy and exit with the text of `loadError`; writer gone and `onState` gone both delete and exit once; `close()` before the document opens destroys it and gives no `onOpen`; an error in `openTableDoc` or in the fill gives the error exit and a `reportError` call, no `onOpen`; the guest writer pauses while connected.
7. Feature docs: `rooms.md` "Loading" gets the error behavior; the file tables in `rooms.md` and `peer-to-peer.md` name `rooms/openTableSession.js`; `peer-to-peer.md:166` names the session.

User: open the Sandbox, a single player room, a multiplayer room as host and as guest; reload in each; the host deletes the room while the guest is in it and while the guest's page is closed; a room code that does not exist; Try again after a failed connection; the traffic line in the console after leaving a multiplayer room; IndexedDB blocked (the warning shows, the table opens).

### Result

## Step 10: Setup texts

Work:

1. New `setup/setupText.js`: `STEP_NAME`, `stepChoice(setup, step, ctx, cardOf)`, `chooses`, `decides`, `rollOffText`. `stepChoice` gets `rosterCard` as `cardOf`, because `rosters/cards.js` does not load in Node. The rest moves unchanged.
2. `GameSetup.jsx` imports them. `BoardPanel` passes `rosterCard`.
3. Test `setup/setupText.test.js`: `stepChoice` for each step, with and without `mySide`; `chooses` for the own side, the other side and imperative; `decides`; `rollOffText` for a tie, more successes, equal successes with more Crits, equal Crits with more Wilds.

User: the whole setup, Sandbox and two browsers: the hint of each step, Prev / Next shows the choice of each done step, the roll off text.

### Result

## Step 11: Character model hooks

Work:

1. New `components/useModelLift.js`: `useModelLift({ liveRb, groundY, isDragging, remoteRef, rest })` → `{ lift, toggleLift, lowerLift, moveLift }` (`endLift` inside). No effect. Called after `remoteRef`.
2. New `components/useLandingSound.js`: `landed`, `listenLanding`, `bump`, `remoteBump`, `livePlace` and the `useAfterPhysicsStep` call. Returns `{ listenLanding, remoteBump, livePlace }`, so the remote mode effect keeps its two reset lines. Called before the start-asleep effect.
3. New `components/useLiveFollow.js`: `follow`, `following`, `setFollowing`, `followLive`. No effect.
4. New `components/useFigureMaterials.js`: `useFigureMaterials(scene, team, showOverlap)`: `useSideColor`, the base color effect and the tint effect. Called at the base color effect's place.
5. The drag, the frame, the remote mode effect and the JSX stay in `CharacterFigure`. The 3 lint warnings stay where their effects stay.

User: R lifts and lowers a model, also a sleeping one; a lift ends when Place moves the model; the landing sound on the mat and on terrain, also of the other player's model; in two browsers a model follows the other player's drag; the overlap tint; base colors after a side color change.

### Result

## Step 12: Dice tray helpers

Work:

1. New `dice/shelfStart.js`: `MAX_DICE`, `shelfFromDocument(trayKey, side)`. Test: shelf entries in order, a bad face and a missing order are skipped, at most 42 dice, `critsUsed`.
2. New `dice/rollFlow.js`:
   - `restOutcome({ lost, timedOut, tilted })` → `'lost'`, `'wait'` or `'flat'`.
   - `flowStage(entries)` → `{ rolling, sliding, flat, waiting }`, the loop before the shelf move.
   The frame calls them. `topFace` is still called once, only when the die stopped or timed out. Test both.

User: roll, reroll, add Crits, change a die, clear; a die that falls off the table comes back; a tilted die waits and is thrown again; number keys; reload keeps the shelf.

### Result

## Step 13: Final run

Work:

1. Remove leftover imports and pointers (`grep` of the old names).
2. Run `pnpm fallow`. Write in the Result: the lines of each split file; cyclomatic, cognitive and lines of the functions in the table of "Facts", before and after; the count of functions above the thresholds (319 at `4698e42`); the new functions above a threshold, if any.
3. Write the warning count of `pnpm lint`.

User: the full test, all the "User" lists above.

### Result

## Left for remove-duplicates

- Scene: `ownSide === 'guest' ? 'host' : 'guest'` three times; `otherTeam` exists in `setup/setup.js`.
- Scene: the two `DeployRangeTool` blocks differ only in the character and the body id.
- Scene: the two `onPlaceLimit` slot setters of the move and range tools.
- Nearest hit under a ray: `characterAt`, `terrainUnder` (Scene), `modelUnder` (Tool). Pointer to NDC: `characterAt`, the hover label (Scene), `useDragTool` (twice).
- Tool: "set translation at ground plus hover height, or keep y" four times (`snapTo` twice, `stepTool`, `handleMirror`). The bend clamp with `MAX_BEND` in `dragPlan` and `stepTool`.
- `DeployRangeTool` and `ToolFootprint`: the same footprint slot effect. `CharacterModel` and `RulerTool`: `HOVER_RATE = 25`. `CharacterModel` and `DiceTray`: `ZERO`.
- `OtherRange`, `OtherMovement`, `OtherAngle` repeat the parts of `RangeRuler`, `MovementRuler`, `AngleRuler`.
- `CharacterFigure`: the drag end and the drag cancel reset the same six values.
- Table: the teardown of the sync and live channel in `close` and `onChannelsEnd`.
- App: the popup check in `wheelState` and in the key `state`.
- GameSetup: `winner`, `other`, `first`, `second` in `stepChoice` and `BoardPanel`; the game rule copies (squad ready, affiliation choices).

## Open questions

None.
