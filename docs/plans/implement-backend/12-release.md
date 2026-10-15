# Step 12: First release

Detailed plan of step 12 in `docs/plans/implement-backend.md`. The rest of auth phase 4. The design is in `docs/features/auth.md` ("Privacy", "Lobby and room UI", "Discord application", "Site name") and `docs/features/backend.md` ("Deploy", "Netlify", "Database"). Decision 2 changes the design: the privacy page is a static file, not `#privacy`.

## Goal

The user plays a game with another real person, in production, on two machines in two networks. Before the first real player logs in, the site has a privacy page and **Delete account**, as the Discord Developer Terms require (auth doc, "Privacy"). The test data in Atlas is gone, so production starts with no data.

After step 11:
- Only the auth routes are deployed (step 6, commit `6b5d1ef`). The room, table and signal routes of steps 7 and 8 are not deployed, because the deploy checks of steps 7 and 8 were not run. This plan first said they were deployed. The user deployed them in this step (see [User check results](#user-check-results)). The API code has not changed since step 8 Phase 1. Step 8 Phase 5 and step 11 changed only `apps/api/compose.yaml` and `apps/api/package.json`, which are not deployed.
- `DELETE /me` exists in the API (step 6). The web app has no **Delete account** button.
- There is no privacy page and no **Privacy** link.
- Production shows no login button, because Netlify has no `VITE_DISCORD_CLIENT_ID`.
- Discord has only the redirect `http://localhost:5173/`.

## Scope

In the step:
- The privacy page (decisions 2 and 3).
- **Delete account** in the user menu (decision 4).
- A check of the data rules: TTL indexes, logs, retention (Phase 2).
- A script that deletes the test data in Atlas (decision 5).
- The release tasks of the user, in order (decision 7).
- Docs.

Left for later:
- Step 4 (CI deploy) runs after this step (decision 1).
- TURN (step 13), only if direct connections fail too often.
- The many improvements that the first games will show.

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 12"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server or the API process. The user checks the app.
- Do not run `aws`, `cdk deploy`, `put-secrets` or the test data script. Do not connect to Atlas. The user runs these.
- Do not commit and do not push. The main model commits each finished phase. The user pushes.
- Temporary files go in the session's scratchpad directory.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: plain JavaScript in `apps/web`, TypeScript in `infra`. Plain, short comments that say why. Match the style of the code around you.
- Never log a token, a code, an SDP or a connection string.
- After a code change: `pnpm format` and `pnpm lint`.
- Docs and the privacy page: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| Privacy page | `apps/web/public/privacy.html`, served at `https://mcptacticus3d.netlify.app/privacy.html` (decision 2) |
| Privacy Policy URL in Discord | `https://mcptacticus3d.netlify.app/privacy.html` |
| **Privacy** link | The lobby footer, and the login note "Your opponent sees your Discord name and avatar." (`UserMenu.jsx`) |
| **Delete account** | A button in the user menu (`UserMenu.jsx`), under **Log out** |
| `deleteAccount()` | `auth/session.js`. `DELETE /me`, then the local data of the user, then log out (decision 4) |
| Test data script | `infra/scripts/delete-test-data.ts`, run with `pnpm --filter infra delete-test-data` (decision 5) |
| Controller and contact | The name and the contact of the person who runs the app, on the privacy page. The user gives them (open question 1) |

Files:

```
apps/web/
  public/privacy.html          new: the privacy page
  src/auth/UserMenu.jsx  + Delete account, + Privacy link in the login note
  src/rooms/Lobby.jsx     + footer with the Privacy link
  src/auth/session.js          + deleteAccount
  src/rooms/store.js           + delete the local multiplayer data of one user
  src/index.css                + footer, Delete account
infra/
  scripts/delete-test-data.ts  new (phase 2)
  package.json                 + delete-test-data, + mongodb (dev dependency)
```

## Decisions that fill gaps in the design

1. **Step 4 after step 12.** The user decided this on 2026-10-11: play the first game in production now, and add CI after it. Until step 4, the user deploys the API from their machine (`pnpm --filter infra cdk:deploy`). This step changes no API code, so it needs no API deploy. This changes decision 5 of the overview plan.
2. **The privacy page is a static HTML file.** The auth doc has `#privacy`, a page of the app. This plan uses `apps/web/public/privacy.html`. Reasons:
   - It loads without the app's JavaScript. The app bundle has three.js and the physics engine. A person who only wants to read the policy, or a Discord reviewer, does not need them.
   - It needs no change of the hash routing in `Root.jsx`.
   - Vite copies `public/` into the build, so it works in dev (`http://localhost:5173/privacy.html`) and on Netlify. `_headers` gives it the default cache rule: revalidate on every load.
   The page has its own small `<style>`: the dark background and the text color of the lobby. A link "← Back to the app" goes to `/`.
3. **The content of the privacy page.** Plain words, in this order. The rows of the auth doc ("Privacy") and the GDPR need each item.
   - **Who runs the app** and how to reach them (open question 1). The date of the policy.
   - **What the app stores, and why:**
     - After a Discord login: the Discord id, username, display name and avatar. The app uses them to show the player's name and avatar in the lobby and to the opponent, and to keep the seats of a room. Scope `identify` only: no email, no servers, no friends.
     - Multiplayer rooms: the map, the rosters, the seats, the game table, and the dates.
     - Messages that connect two browsers (signaling). They contain the network addresses (IP addresses) of the browser. They are deleted after 1 hour.
     - Technical logs of the server, with no game content and no tokens. They are deleted after 1 week. Phase 2 checks what they contain, and the page says it.
     - In the browser only: the login token, single player rooms, and a copy of each multiplayer table. They are not sent to anyone, except the copy of the multiplayer table, which syncs with the server and the opponent.
   - **Who gets data:**
     - The opponent: the name and the avatar. During a game, the two browsers connect directly, so each browser gets the other one's IP address.
     - Service providers: Netlify (hosts the site and sees the IP address of each visit), Amazon Web Services (runs the server, Frankfurt), MongoDB Atlas (the database, on AWS Frankfurt), Discord (the login; avatars load from Discord's servers), Google and Cloudflare (the STUN servers in `net/ice.js`, which see the IP address when two browsers connect).
     - No ads, no analytics, no tracking, no cookies. The browser storage holds only what the app needs.
     - All server data stays in the EU (Frankfurt).
   - **How long:** an account with no login and no app start for 12 months is deleted. A room with no change for 12 months is deleted. Signaling messages after 1 hour. Logs after 1 week.
   - **Your choices:**
     - **Delete account** in the user menu deletes the account and the room that the player hosts, with its table, at once. In rooms of other hosts the seat shows "Deleted player".
     - The player can remove the app in Discord: User Settings → Authorized Apps.
     - For a copy of the data, a correction, or any other question: the contact above.
     - The right to complain to the data protection authority of the player's country.
4. **Delete account.**
   - A browser confirm first: "Delete your account? This also deletes the room you host and its table. You cannot undo this."
   - `deleteAccount()`: `DELETE /me`. When it succeeds: delete this user's multiplayer data in this browser (the IndexedDB databases `mcp-assist-3d/multiplayer/<user id>/*` and the squad keys `mcp-assist-3d/squad/<user id>/*`), then log out the same way as **Log out**.
   - Single player rooms stay. They belong to the browser, not to the account (auth doc, decision 3).
   - When `DELETE /me` fails, the menu shows "Could not delete the account. Try again." The user stays logged in.
   - The button is only in the lobby, because the user menu is only in the lobby.
5. **Test data script.** `infra/scripts/delete-test-data.ts`, in the style of `put-secrets.ts`:
   - Reads `MONGODB_URI` from `infra/.env`, the Atlas connection string that `put-secrets` sends to SSM. It never prints it. It prints only the host name.
   - Prints the number of documents in `users`, `rooms` and `messages` of the database `assist3d`.
   - Asks the user to type `assist3d` to confirm. Any other answer stops it.
   - Runs `deleteMany({})` on the three collections, not `drop`, so the indexes stay. Prints the counts again.
   - `mongodb` becomes a dev dependency of `infra`, the same version as in `apps/api`.
6. **No API change, no deploy.** `DELETE /me` and the TTL indexes exist. If the check of Phase 2 finds a needed API change, Phase 2 stops and reports. Then the plan gets a deploy.
7. **The order of the release.** The privacy page and **Delete account** must be live before a real player can log in. The login button shows only when Netlify has `VITE_DISCORD_CLIENT_ID`. So:
   1. The user pushes `main`. Netlify builds the site with the privacy page. Production still shows no login.
   2. The user runs the test data script.
   3. Discord Developer Portal: the production redirect and the Privacy Policy URL.
   4. Netlify: `VITE_DISCORD_CLIENT_ID`, then a new deploy. Now production shows the login button.
   5. The user checks production alone (check 6).
   6. The game with the other person.
   The commands and clicks are in [User](#user).

## Phase 1: Privacy page and Delete account

Read: decisions 2 to 4. `auth/UserMenu.jsx`, `rooms/Lobby.jsx`, `auth/session.js`, `rooms/store.js` (`multiplayerDocName`, the squad keys, the cleanup of the lobby), `rooms/localDocs.js`, `api/client.js`, `apps/web/public/_headers`, `net/ice.js`, `index.css` (the lobby and `.user-menu` styles). In the API, only to see what `DELETE /me` does: `apps/api/src/routes/me.ts`.

Work:
1. `apps/web/public/privacy.html`: decisions 2 and 3. Where the controller and the contact go, use the text that the main model gives in this prompt (open question 1).
2. `UserMenu.jsx`: **Delete account** under **Log out** (decision 4). The login note gets a **Privacy** link to `/privacy.html`.
3. `Lobby.jsx`: a footer with a **Privacy** link. Small and muted, at the bottom of the lobby.
4. `auth/session.js`: `deleteAccount()`. `rooms/store.js`: a function that deletes the local multiplayer data of one user. Reuse the code of the lobby cleanup where it fits.
5. `index.css`: the styles.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass. The build output has `privacy.html`.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 1 to 4.

### Result

Done. Web tests 273 pass, 0 fail. Build passes, `dist/privacy.html` exists. `pnpm format` clean. Lint: no warning in the changed files (41 old ones elsewhere).

- `public/privacy.html`: decision 3, in its order. Inline `<style>` with the lobby colors (`--bg`, `--text`, `--muted`, `--accent`), text max 680 px, 16 px side gutter, no JavaScript. Controller: "its developer, a private person", mailto `pompolutz@gmail.com`, Discord `fxdxpz#5790`. Date 2026-10-11.
- Facts checked in code: scope `identify` (`auth/oauth.js`), STUN Google and Cloudflare (`net/ice.js`), message TTL `HOUR_MS` (`routes/signal.ts`), TTL indexes on `expiresAt` (`stores/mongo.ts`), logs `ONE_WEEK` (`infra/lib/api-stack.ts`), `DEPLOY_REGION=eu-central-1` in `infra/.env.example`. The 12 months for users and rooms are not checked here (Phase 2).
- `UserMenu.jsx`: **Delete account** under **Log out**, with the confirm text of decision 4 and the error "Could not delete the account. Try again." in the popup. **Privacy** link in the login note. `Lobby.jsx`: `<footer className="lobby-footer">` with **Privacy**.
- `auth/session.js`: `deleteAccount()`: `DELETE /me`, then `deleteUserData(userId)`, then `logout()`. The logout is in a `finally`, so it runs even when the local delete throws. It throws when `DELETE /me` fails.
- Deviation: the local delete is `deleteUserData(userId)` in `rooms/localDocs.js`, not `rooms/store.js`. It calls `deleteStaleSquads(userId, [])` and `deleteStaleDocs(userId, [])`. `localDocs.js` imports `store.js`, so the function in `store.js` would be an import cycle. No new test for it.
- `index.css`: `.lobby-footer`, `.user-delete`, link color in the note, `.user-popup` is a column.

For Phase 2:
- Check the 12 months of `expiresAt` for users and rooms, the 1 hour of messages (`HOUR_MS` in `signal.ts` is the only hint seen), and all `console.*` calls. Keep the log wording of decision 3 unless the check says otherwise.
- CORS: not looked at.
- The page says "Frankfurt" from `DEPLOY_REGION=eu-central-1` in the example file. The Atlas cluster region is not checked.
- `docs/features/auth.md` "Privacy" still says `#privacy` and has the row "Share API Data..." that the page matches.

## Phase 2: Data rules, test data script, docs

Read: decisions 1, 5 and 6. The **Result** of Phase 1. `apps/api/src/stores/mongo.ts`, `apps/api/src/stores/store.ts`, `apps/api/src/routes/*.ts`, `apps/api/src/lambda.ts`, `infra/lib/api-stack.ts`, `infra/scripts/put-secrets.ts`, `infra/package.json`, `infra/.env.example`.

Work:
1. Check the data rules, and write what you found in the **Result**. Change no API code (decision 6).
   - TTL indexes: `users`, `rooms` and `messages` have one on `expiresAt`. Which requests move `expiresAt` of a user (12 months) and of a room (12 months). Messages: 1 hour.
   - Logs: each `console.*` call in `apps/api/src` (not tests), and what it prints. Nothing may print a token, a Discord code, an SDP, an IP address, a connection string, or Discord data.
   - CloudWatch retention of the log group: 1 week. CORS: only the site origin.
   - If the privacy page says something that the code does not do, or the other way round, fix the page.
2. `infra/scripts/delete-test-data.ts` and the script `delete-test-data` in `infra/package.json` (decision 5). Add `MONGODB_URI` to `infra/.env.example` if it is not there.
3. Docs:
   - `docs/features/auth.md`: "Privacy": the page is `/privacy.html` (decision 2), and the Privacy Policy URL. "Discord application", item 3: the new URL. "Lobby and room UI": the footer link, **Delete account**, and "Reconnecting" in the toolbar states. "Phases": phase 4 is built (the user's release tasks are open).
   - `docs/features/backend.md`: "Deploy": step 4 comes after the first release (decision 1). `infra/` scripts: `delete-test-data`.
   - `docs/plans/implement-backend.md`: decision 8 (step 4 after step 12, decision 1 of this plan). The **Order** table and its notes: step 4 after step 12. The note "Step 4 keeps its number …" changes the same way. Steps 4 and 12 in the table: step 12 needs 10 and 11, step 4 needs 3 and 12.
   - `docs/plans/implement-backend/04-ci.md`: the "Postponed" note at the top: now after step 12.
   - `infra/README.md`: the test data script, with a warning that it deletes all data in production.
   - `README.md`: the privacy page and **Delete account**, if the README lists the lobby features.

Checks:
- `pnpm test`, `pnpm typecheck`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: the release (checks 5 to 9).

### Result

Done. No API code changed (decision 6). No API change is needed.

Data rules, checked in code:
- TTL indexes: `users`, `rooms` and `messages` each have `{ expiresAt: 1 }` with `expireAfterSeconds: 0` (`stores/mongo.ts`). Mongo deletes a document some seconds after its `expiresAt`.
- User `expiresAt` (12 months, `userExpiry`) moves on: login (`upsertDiscord`, used by `POST /auth/discord` and the dev login), and `GET /me` when the token is older than 1 day (`touch`). A player who only opens the app moves it once a day at most.
- Room `expiresAt` (12 months) moves on: create, join, and each table write (`PUT /rooms/:code/table`, `replaceTable`). Delete and reads do not move it. This matches "no change for 12 months".
- Message `expiresAt` is now + 1 hour (`HOUR_MS`, `routes/signal.ts`). `DELETE /me` also deletes the user's messages.
- CloudWatch: `RetentionDays.ONE_WEEK` (`infra/lib/api-stack.ts`).
- CORS: set on the function URL only. `allowedOrigins` is `https://mcptacticus3d.netlify.app` only, methods GET, POST, PUT, PATCH, DELETE, headers `authorization`, `content-type`, `x-after`. Not tested against the deployed API (check 9).
- `console.*` in `apps/api/src`, outside tests:
  - `middleware/log.ts`: `METHOD /path status Nms`. The path has the room code. No query, no headers, no IP.
  - `routes/table.ts`: `table write body=<n> merged=<n>`, two sizes.
  - `auth/discord.ts`: `discord call failed status=<n>` and `discord token request rejected status=<n>`. Status only, no body.
  - `lambda.ts`: `keep-alive ok|error`.
  - `stores/mongo.ts`: `mongo ping failed: <name>: <message>`. A Mongo message can name Atlas hosts, not the URI.
  - `middleware/errors.ts`: `console.error(err)` for an unknown error: the error and its stack. It is the one call that prints something that is not fixed text. A Mongo or Hono error holds no token, code or SDP, because the code never puts them in an error. It can name an Atlas host.
  - `local.ts`: dev start lines. Not in the Lambda.
  - No call prints a token, a Discord code, an SDP, an IP address, a connection string or Discord data.
- Atlas region: not checkable in code. Docs say the cluster is in `eu-central-1`, and `DEPLOY_REGION` must match it. The page says Frankfurt. The user can check it in Atlas.

Page fix: the logs paragraph now says each request leaves one line with the method, the path (with the room code), the status and the time. Everything else on the page matches the code.

Test data script: `infra/scripts/delete-test-data.ts`, script `delete-test-data`, `mongodb` `^7.7.0` in `infra` dev dependencies (same as `apps/api`), lockfile updated. `MONGODB_URI` was in `.env.example` already. The host name comes from `client.options`, so the URI is never printed. Not run.

Docs: `docs/features/auth.md` (Privacy, Discord application, Lobby and room UI, Phases, code layout), `docs/features/backend.md` (Deploy, scripts), `docs/plans/implement-backend.md` (decision 8, Order), `04-ci.md` note, `infra/README.md` (section "Delete the test data"), root `README.md`.

Checks: see the report of the phase. Tests, typecheck, web build, format and lint run at the end.

## User

After Phase 1, local (`pnpm dev`), with dev logins:
1. `http://localhost:5173/privacy.html` shows the privacy page. The text is right. "← Back to the app" opens the lobby.
2. The lobby footer has **Privacy**. Logged out, the login note has **Privacy** too. Both open the page.
3. Alice hosts a multiplayer room, Bob joins it. Bob also hosts a room of his own. Bob: user menu → **Delete account** → Cancel. Nothing changes. Then **Delete account** → OK. Bob is logged out. Alice's lobby: her room shows "Deleted player" in Bob's seat. Bob's own room is gone.
4. Bob logs in again as `bob`: a new empty account. Alice's room does not list for him.

The release, after Phase 2. Do the steps in this order (decision 7):
5. Push `main`: `git push`. Wait for the Netlify deploy. `https://mcptacticus3d.netlify.app/privacy.html` shows the page. The lobby has the **Privacy** link and still no login button.
6. Delete the test data: `pnpm --filter infra delete-test-data`. Check the counts, type `assist3d`. The counts after are 0.
7. Discord Developer Portal → the application:
   - OAuth2 → Redirects → **Add Redirect**: `https://mcptacticus3d.netlify.app/`. Type it by hand (open question 1 of the auth doc: the browser filled the field with the email). Keep `http://localhost:5173/`. **Save Changes**.
   - General Information → Privacy Policy URL: `https://mcptacticus3d.netlify.app/privacy.html`. **Save Changes**.
8. Netlify → the site → Site configuration → Environment variables → **Add a variable**: `VITE_DISCORD_CLIENT_ID`, the same value as in `apps/web/.env.local`. Then Deploys → **Trigger deploy** → **Deploy site**. A changed env var needs a new build.
9. Production, alone, in one browser:
   - The lobby shows **Log in with Discord**. Log in. The lobby shows your avatar and name.
   - Create a multiplayer room and open it. The toolbar shows "Waiting". DevTools → Console: no CORS errors. Network: a `messages` request every 2 s, each with status 200.
   - Make a change, then **← Lobby**: a `PUT .../table` with status 204.
   - **Copy link** works.

The game:
10. Send the room link to the other player. They open it, log in with Discord and join. Within a few seconds both toolbars show "Connected". If it shows "Could not connect": one network blocks direct connections (risk 1).
11. Play. After the game, both go **← Lobby**. Then write in the **Result** of this step:
    - The traffic line of each console: was the connection `direct`, how many bytes, how long.
    - Lambda requests per game: AWS console → Lambda → the function → Monitor → Invocations, the sum for the time of the game.
    - Atlas transfer per game: Atlas → the cluster → Metrics → Network, bytes in and out for the time of the game.
    - Anything that did not work or felt wrong.

### User check results

2026-10-11:
- Production `GET /rooms` gave 404. `/health` showed `6b5d1ef`, the API of step 6. The user ran `pnpm --filter infra cdk:deploy`. After it, `/health` shows `67a10b4-dirty`. Only docs were uncommitted, so the API code is the code of `67a10b4`.
- Checks 10 and 11: two players played one game in production, on two machines.
  - Connection: `direct` for all 96 min. One connection, no reconnect.
  - Traffic: one player sent 1.8 MB and received 2.9 MB. The other player's line has the same numbers the other way round. Total 4.7 MB. The estimate in the peer-to-peer doc ("Traffic per game") is about 35 MB for 2 h.
  - Lambda invocations: 395. The estimate is about 100. A browser polls only while it is not connected, 30 times a minute (`shouldPoll` in `net/peer.js`). So the waiting time decides most of the number. At 395 per game, the 1M free requests are enough for about 2,500 games a month.
  - Atlas: the 1-week chart has one point per hour. The highest point (13:17) has bytesIn 153 B/s, bytesOut 172 B/s and 0.11 requests/s. That is about 0.55 MB in, 0.62 MB out and 400 requests in that hour. The point before it is much lower, so the whole game is below 1 MB each way. The backend doc estimates about 25 MB of table writes per game. The free cluster limit of 10 GB in and 10 GB out per 7 days is enough for more than 10,000 such games a week.
  - `table fingerprint`: `579c863f` and `529c7e60`. They differ. Each browser logs it once, 2 s after the last change from when the connection opened. So one browser can log before the first sync data of the other browser arrives. The difference does not prove lost changes.
  - The other player's console: "Layer out of range, resetting to 2", 3 times. It comes from the `postprocessing` library: each new `OutlineEffect` takes a layer number from a shared counter, and the counter goes back to 2 after 31. It is harmless, because `SelectionOutlines.jsx` sets its own layers 10 to 16. It shows that the outline effects were created about 13 times or more.
- The user: everything else worked. The user's notes on the game went to another session.
- Not checked: both players open the room at the same time, and compare the new `table fingerprint` lines.

## Done when

- `pnpm test`, `pnpm typecheck`, `pnpm --filter web build` pass. `pnpm lint` has no new errors.
- Checks 1 to 9 pass.
- Two players finish a game on two machines (check 10 and 11).
- The **Result** has the numbers of check 11.

From this step on, production data is real. A change of the data format needs a migration.

## Risks and open questions

1. **The controller and the contact.** The privacy page must say who runs the app and how to reach them (GDPR). Answered on 2026-10-11: the email `pompolutz@gmail.com`, or Discord `fxdxpz#5790`. No name was given, so the page says that the developer of the app runs it. The user can add a name later.
2. **No TURN.** Production has only the STUN servers. Most home networks connect directly. Some mobile networks and company networks do not: both players then see "Could not connect". Then try another network. Step 13 adds TURN if this happens often.
3. **`bye` on page close** (step 8, risk 4). In production, the `keepalive` request needs a preflight. If the browser does not send it, the other player sees "Reconnecting" until the 15 minutes end, or until the page comes back.
4. **Two versions.** After a new deploy, a player with an old page sees the version warning. Both reload.
5. **The privacy page is not legal advice.** It covers the items of the Discord Developer Terms (auth doc, "Privacy") and the usual GDPR items. The user decides if it is enough.
6. **Flaky API test, found in Phase 2.** `apps/api/test/signal.test.ts`, "returns only newer messages for x-after", failed once in 5 runs: `['two','one']` instead of `['one','two']`. A message id is the server time in ms and 8 random characters. So two messages in the same ms sort by the random part. In production, one browser posts each message in its own HTTP request, so two messages of one peer in the same ms are rare. Not fixed in this step. A fix for later: a counter per API instance after the time.
