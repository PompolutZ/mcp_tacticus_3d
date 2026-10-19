# Plan: Performance stats for users

Requested by the user on 2026-10-19. Status: Step 1 done. Branch `perf-stats`, worktree `../mcp_assist_3d-perf-stats`, from main.

Each step makes one commit and writes its **Result** below. Paths are under `apps/web/` unless they start with `docs/`.

Checks of every code step: `pnpm format`, `pnpm lint` (no new warnings), `pnpm test`, `pnpm --filter web build`, `pnpm --filter web typecheck`.

## Request

Some users say the app lags in Chrome, but not in Brave or Edge (`render-performance.md`, Request). To choose the next steps of `render-performance.md`, the user needs numbers from these users' machines. The debug panel is only in the dev server, so users of the built app cannot see any numbers. This plan replaces step 1b of `render-performance.md` ("a small stats overlay").

## Facts

Found on 2026-10-19. Paths under `src/`.

- `debug/FrameStats.jsx` measures each frame inside the `<Canvas>`: `fps`, `worstMs`, `cpuMs`, `gpuMs`, draw calls, triangles, canvas size, pixel ratio. `useFrameStats()` gives the latest numbers. `gpuMs` uses `EXT_disjoint_timer_query_webgl2`: Chrome and Edge have it, Safari does not, Firefox only with a flag.
- `debug/DebugPanel.jsx` shows these numbers. App mounts `FrameStats` and `DebugPanel` only when `debug` is true, and `debug` is `import.meta.env.DEV && debugOn` (`App.jsx`). So `vite build` leaves them out.
- `renderer.js`: `rendererName(context)` reads the GPU name (with `WEBGL_debug_renderer_info` when the name is masked). `isSoftwareRenderer(name)` finds a CPU renderer. App calls them once in the Canvas `onCreated`.
- Settings: `settings/settings.js` (defaults, cleaning of saved values, tests in `settings/settings.test.js`), UI in `settings/SettingsPopup.jsx`. The Performance section has one switch, "Faster drawing (no outlines)" (`performance.composer`). Settings are per browser, in localStorage. Described in `docs/features/table-tools.md`, "Settings menu", and `docs/features/rendering.md`.
- Chrome, Brave and Edge use the same engine. Likely causes of a Chrome-only lag: Energy Saver (30 fps limit on battery), the Windows per-app GPU setting, extensions. The GPU name tells the second cause directly.

## Decisions

1. **A setting, not a URL parameter.** A switch "Show performance stats" in the Performance section. Users find it more easily than a URL parameter. Default off. It is a per-browser setting like the others.
2. **Load the code only when needed.** The overlay and `FrameStats` load with a dynamic `import()` (React `lazy`) only when the switch is on. Users who never turn it on download nothing extra.
3. **Reuse `FrameStats`.** It moves out of `debug/` (for example to `perf/FrameStats.jsx`), because it is no longer debug-only. `DebugPanel` keeps using it. No second copy of the measurement.
4. **Copy report, no automatic sending.** A "Copy report" button copies the numbers as plain text, to paste into Discord or a message. Sending numbers to the server needs consent and a backend part, so it is not done.
5. **The report has what decides the next step:** fps, slowest frame, `cpuMs`, `gpuMs` (or "not available"), GPU name, software renderer yes/no, browser name and version, OS, pixel ratio, canvas size, screen refresh hint (fps near 30, 60, 120), the "Faster drawing" setting, the number of pieces on the table.
6. **Browser name:** `navigator.userAgentData.brands` where it exists (Chrome, Edge), `navigator.brave` for Brave (Brave reports itself as Chrome), else the user agent string.

## Steps

### Step 1. Stats overlay and copy report

- Move `debug/FrameStats.jsx` to a shared place (Decision 3). Update the imports in `App.jsx` and `debug/DebugPanel.jsx`.
- `settings/settings.js`: `performance.stats` (default false, only `true` turns it on), cleaned like the others. Tests in `settings/settings.test.js`.
- `settings/SettingsPopup.jsx`: the switch "Show performance stats" in the Performance section, with one hint line: the numbers help find why the table is slow; "Copy report" copies them to send.
- New overlay component (for example `perf/PerfOverlay.jsx`), outside the Canvas, in a corner that does not cover the toolbar. It shows the numbers of Decision 5, updated by `useFrameStats`. A "Copy report" button uses `navigator.clipboard.writeText` and shows "Copied" for a moment. A close button turns the setting off.
- `App.jsx`: mount `FrameStats` (inside the Canvas) when `debug` or `performance.stats` is on. Mount the overlay when `performance.stats` is on. Both lazy loaded (Decision 2). Keep the GPU name from `onCreated` (`rendererName`) in the store or a ref, so the overlay can show it without a second WebGL query.
- The report text: a pure function (for example `perf/report.js`) from the stats, the environment and the setting to a few lines of `name: value`. Tests: each field of Decision 5 is in the text; a missing `gpuMs` gives "not available".
- Check in the build output that the overlay code is in its own chunk.
- `docs/features/rendering.md`: a section about the stats: what they show, why, that they load only when on, no sending. `docs/features/table-tools.md` "Settings menu": the new switch.
- User check in the browser: the switch is off by default; turning it on shows the overlay with numbers that change; "Copy report" puts the text on the clipboard; close turns the setting off; the setting stays after a reload; debug mode still shows its panel.

**Result:**
Done. `debug/FrameStats.jsx` moved to `perf/FrameStats.jsx` (`git mv`); `App.jsx` and `debug/DebugPanel.jsx` use it. New in `src/perf/`: `PerfOverlay.jsx` and `perf.css` (bottom left corner, comic style, Copy report / Copied, Close turns the setting off), `report.js` (`buildReport`, `refreshHint`), `browser.js` (`browserName`, `osName`, Decision 6), `report.test.js`. `settings/settings.js`: `performance.stats` (only `true` turns it on) with a test in `settings.test.js`; `SettingsPopup.jsx`: the switch and hint (the composer switch now keeps `stats` when it changes `performance`). `table/tableStore.js`: `gpuName`, set in the Canvas `onCreated`. `App.jsx`: `FrameStats` and `PerfOverlay` are `lazy` with `Suspense`; `FrameStats` mounts when debug or the setting is on. Docs: `rendering.md` new "Performance stats", `table-tools.md` Settings menu.
Chunks in `vite build`: `dist/assets/PerfOverlay-TuNTIa-s.js` 3.24 kB (+ `PerfOverlay-cf65yCWx.css` 0.42 kB) and `dist/assets/FrameStats-DGJW0hnE.js` 1.56 kB. The main `index` chunk has neither.
Checks: format, lint (40 warnings, same as main), test (web 1109 pass), build, typecheck all pass.
Not decided by the plan: pieces = characters + terrain + loose tokens; Copy report is disabled until the first numbers exist.

### Step 2. Measure on lagging users' machines

No code. The user asks one or more users whose Chrome lags to:

1. Turn on "Show performance stats", play for a minute on a full table, and copy the report. Do the same in Edge (or Brave), on the same table.
2. In Chrome, check: Energy Saver (Settings → Performance); the Windows graphics setting for Chrome (Settings → Display → Graphics); the same table in a guest window (no extensions).

How to read the two reports:
- Different GPU names: Windows gives Chrome the slower GPU. Fix: the Windows graphics setting.
- fps about 30 in Chrome: Energy Saver.
- Same GPU, higher `cpuMs` in Chrome, better in a guest window: an extension.
- Same in both browsers and both slow: the app. High `gpuMs` → `render-performance.md` step 2. High `cpuMs` → steps 4–6 there.

Write the reports (without personal data) and the conclusion in the Result. Then update the Status of `render-performance.md` step 1.

**Result:**

Baseline from a fast machine (the user's), to compare with the reports of lagging users:

```
FPS: 120
Slowest frame: 9.4 ms
CPU per frame: 1.8 ms
GPU per frame: 6.7 ms
GPU: ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)
Software renderer: no
Browser: Google Chrome 155
OS: macOS
Pixel ratio: 2
Canvas: 2976x2074
Screen refresh: near 120
Faster drawing: on
Pieces on table: 22
```

The app keeps up with the screen. The CPU time is small. The GPU uses about 80% of the 8.3 ms frame time at 120 Hz, mostly to draw about 6.2 million pixels (pixel ratio 2).
