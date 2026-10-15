# Plan: dice test run overnight in the Sandbox

Requested by the user on 2026-10-16. Status: Done.

Three coder steps, one commit each. Branch `dice-night-run`, worktree `../mcp_assist_3d-dice-night-run`.

## Request

A script that rolls dice in the real app on localhost for a whole night, while nobody is at the computer. It rolls 1 die and 5 dice (5 is the usual number in the game), with 1 click, 2 clicks, 3 clicks and 2 seconds of clicks, 1000 throws each. The results show how the dice behave and if the faces come up evenly.

## Facts

- The Sandbox is `http://localhost:5173/#sandbox` (`src/Root.jsx`). It needs no room and no second player.
- `DiceTray.jsx` has the roll flow: `add`, `roll`, `clear`, and the frame loop that reads the top face (`topFace`, `isTilted`) and moves dice to the shelf. The Roll button and the Roll key both call `roll()`.
- The die has 8 faces and 6 symbols (`src/dice/faces.js`): Hit and Blank are on 2 faces each, Crit, Wild, Block and Skull on 1 face each. For a fair die, each face comes up 1 time in 8.
- `scripts/dice-sim.mjs` already does the same count headless. It has no repeat clicks, and its rested dice can still be pushed. The night run is the real app, so it has neither gap.
- Chrome stops drawing frames in a window that is hidden or when the display sleeps. Then the physics stops too. The Mac must stay awake with the display on (`caffeinate -dis`), and Chrome needs the flags that turn off background throttling.
- A throw takes about 3 s to settle, plus 0.3 s on the shelf, plus Clear, plus 4.8" of fall for the new dice. With 2 s of clicks, a throw is about 2 s longer. 8 scenarios × 1000 throws take about 9–10 hours.
- Playwright (the library) is not in the repo. `playwright-cli` is installed globally, but a script needs the library.

## Decisions

1. **Test hook in the app, dev only.** With `#sandbox&dicetest` on the dev server, the own tray puts `window.__diceTest` on the page. A build leaves it out (`import.meta.env.DEV`). It has `add(n)`, `roll()`, `clear()`, `isIdle()` (no die in the air, in the well or sliding) and `takeRecords()`. `roll()` is the same function as the Roll button, so a click from the script does the same as a click by the player.
2. **One record per throw** (pure builder in `src/dice/`, with tests): dice count, clicks sent, clicks that acted, clicks that were blocked, and for each die: face number, symbol, the dot product of the top face (tilt), tilted yes/no, timed out (8 s), outside the well yes/no, lost and thrown again, time to rest. Also the time from the first click to the end of the throw.
3. **Clicks inside the page.** The page runs the click timer (`setTimeout`), not Node, so the time between clicks is exact. 2 and 3 clicks: 200 ms apart. 2 seconds of clicks: one click every 200 ms, so 10 clicks. Clicks after the first touch are blocked by the app, and the record counts them.
4. **One throw:** Clear, add N dice, wait until they rest, run the clicks, wait until all dice are on the shelf, store the record. Clear and add are used because the player does the same in the game.
5. **Runner: `scripts/dice-night-run.mjs`.** It uses the `playwright` library (new dev dependency, Chromium). Headed Chrome, because headless Chrome draws WebGL without the GPU and the frame timing would not be real. Flags: `--disable-background-timer-throttling`, `--disable-renderer-backgrounding`, `--disable-backgrounding-occluded-windows`. It starts `caffeinate -dis` for its own run time. It expects the dev server to run already.
   - Options: `--scenarios` (default all 8, in the order below), `--throws` (default 1000), `--url`.
   - It writes each record as one line to `apps/web/dice-runs/<date>/<scenario>.jsonl` at once. A crash loses only the throw in progress. A second start with the same folder continues where it stopped (`--resume`).
   - It prints progress every 50 throws and logs page errors. When the page crashes, it opens the page again and goes on.
   - `dice-runs/` is in `.gitignore`.
6. **Scenarios, in this order:** 5 dice × {1, 2, 3 clicks, 2 s of clicks}, then 1 die × the same 4. 5 dice first, because that is the usual case and gives 5 results per throw. The 1-die runs come last, so if the night is too short, the most useful data is already there.
7. **Report: `scripts/dice-night-report.mjs`.** It reads the folder and writes one Markdown file and prints it. For each scenario:
   - Faces: count of each of the 8 faces and the chi-squared test for an even spread (8 faces, 7 degrees of freedom, limit 14.07 at 5%). Symbols: count against the expected share (Hit and Blank 2/8, the others 1/8).
   - Tilted %, timed out %, outside the well %, lost %.
   - Time to rest: average, 95th percentile, max.
   - Clicks: sent, acted, blocked.
   - A last table puts all scenarios side by side, and next to them the `dice-sim.mjs` numbers for the same dice count.
   - In plain words in the file header: what chi-squared means here. With 1000 throws of 1 die, each face expects 125. A random spread of about ±11 per face is normal. The test can see a bias of about 3–4% per face, not a smaller one.

## Steps

### Step 1. Test hook and throw record

- `src/dice/runRecord.js` (pure): builds the record of one throw from the dice entries and the click counts. Tests in `src/dice/runRecord.test.js`.
- `DiceTray.jsx`: collects the per-die data during the throw (time to rest, tilt dot, timed out, outside the well, lost), counts the clicks that acted and were blocked in `roll()`, and writes the record when the throw ends. Only when the hook is on. Nothing changes for normal play.
- `window.__diceTest` with the functions of decision 1, dev only, own tray only.
- Checks: format, lint, tests, build.

### Step 2. Night runner

- Add `playwright` as a dev dependency of `apps/web`, and install Chromium.
- `scripts/dice-night-run.mjs` as in decisions 3–6. A script entry `dice-night-run` in `package.json`.
- `.gitignore`: `apps/web/dice-runs/`.
- `scripts/README.md`: how to start the night run (dev server, Mac on power, the command), and what to leave alone (do not close or cover the Chrome window).
- Smoke run: `--throws 3` for all 8 scenarios against the dev server. This opens a browser, which is part of this request. Check that the JSONL files have 3 records each and `--resume` continues.
- Checks: format, lint, tests, build.

### Step 3. Report

- `scripts/dice-night-report.mjs` as in decision 7. A script entry `dice-night-report`.
- Test the chi-squared and percentile helpers (`scripts/lib/`, with tests).
- Run it on the smoke-run folder and check the output.
- `scripts/README.md`: how to read the report.
- Checks: format, lint, tests, build.

## How the user runs it

1. `pnpm --filter web dev` in the main dir (it is on the branch head).
2. `pnpm --filter web dice-night-run` in a second terminal. A Chrome window opens. Leave it visible, the Mac on power.
3. In the morning: `pnpm --filter web dice-night-report`.

## Results

(Filled in as the steps are done.)

### Step 1

Done. `src/dice/runRecord.js` (`buildRunRecord`) with 3 tests in `runRecord.test.js`. `DiceTray.jsx` collects the record and `window.__diceTest` (`add`, `roll`, `clear`, `isIdle`, `takeRecords`, `clicks`) behind `import.meta.env.DEV`, `#sandbox&dicetest` and the new `testHook` prop (Scene passes it for the own tray). `roll()` now returns acted true/false. 933 tests pass, lint 52 warnings (no new), `__diceTest` is not in `dist`. Commit: see git log "dice night run 1".

### Step 2

Done. `playwright` 1.64 (dev dependency of `apps/web`, Chromium installed), `scripts/dice-night-run.mjs`, script entry `dice-night-run`, `.gitignore` `apps/web/dice-runs/`, README section "Dice night run". The runner checks the dev server first, runs headed Chromium (1600x1000, 3 flags) with `caffeinate -dis -w <pid>`, reloads the page on crash or lost hook, logs page errors to `errors.log`, stops cleanly on Ctrl+C. A scenario file that exists without `--resume` stops the script. The Step 1 hook needed no change.

Smoke run (`--throws 3`, all 8 scenarios, then `--throws 4 --resume`): each file 3 records, then 4. 5d files have 5 dice entries, faces 1-8, clicksActed + clicksBlocked = clicksSent (one 5d-burst throw: 1 acted, 9 blocked). One 404 console error per page load (a missing static file, no effect). Seconds per throw (3-throw average): 5d-1c 4.5, 5d-2c 4.7, 5d-3c 5.2, 5d-burst 6.0, 1d-1c 3.5, 1d-2c 3.7, 1d-3c 4.5, 1d-burst 6.1. Estimate for 8 x 1000: about 38 s x 1000 = 10.6 hours.

### Step 3

Done. `scripts/lib/diceStats.mjs` (face and symbol counts, expected shares from `faces.js`, chi-squared, p-value via incomplete gamma, percentile, average, max) with 5 tests in `diceStats.test.js`. `scripts/dice-night-report.mjs` and script entry `dice-night-report`: arg = run folder (default newest in `dice-runs/`), writes `report.md` and prints it; header in plain words, side-by-side table first, then a section per scenario. The dice-sim numbers come from a child process (`dice-sim.mjs --throws 1000 --multi-throws 1000 --dice 5`, about 10 s), its result lines pasted as text, no parsing; on failure the report prints the command. `--no-sim` skips it. README section "Dice night run: report". The overnight run itself is the user's.

The smoke folder in the worktree was empty, so the report was checked on synthetic JSONL (3 scenarios, 40 lines each, 1 error line).
