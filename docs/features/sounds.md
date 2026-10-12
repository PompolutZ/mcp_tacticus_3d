# Feature: Sounds

Status: partly built. Dice, token and ping sounds and the volume are built. The drop notice sound is in the files and the code, and plays when that feature is built.

## Goal

A short sound for the events that a player can miss: a dice throw, a token put on a character, and later the ping and the drop notice.

## Files

`src/assets/sounds/`, by Kenney, license CC0 (no credit needed). Each is a mono `.mp3`, 1 to 6 KB. `README.md` there has the sources and the `ffmpeg` command. Mp3 is used because Safari decodes it.

## Which sound plays when

| Group | Files | Plays |
|---|---|---|
| `dice` | `dice-throw-1..3` | A throw starts. Own throw: **Roll**. The other player's throw: when their dice go to the air. Many dice are one sound. |
| `token` | `chip-lay-1..3` | A token is put on a character, or an objective token is held, by any player |
| `activated` | `chips-stack-1..3` | The Activated token is put on a character, so the other player knows it was activated |
| `ping` | `bong_001` | A ping starts (not built yet) |
| `notice` | `question_001` | A dropped token waits for a side that this browser plays: once for each drop, only for the player that places. Not for the other player. Tokens that wait when the table opens play nothing. |

- A group has a random file for each play. The same group plays at most once in 80 ms.
- The token sounds come from the Log (`game-log.md`): each browser plays a sound for each new `token` or `held` entry that is put on (`on`). Entries that exist when the table opens, and entries older than 5 s, play nothing. One source, so both players hear the same sound. If the batch has Activated, that sound plays.
- The ping (`ping.md`): `bong_001` plays when a ping starts, in the browser that pings and in the other one. A ping that is older than 3 s when it arrives makes no sound.
- A token taken off, damage and Power make no sound.

## Volume

**Sound** slider in the Settings menu (`table-tools.md`), 0 to 100, default 60. 0 is off. Stored in this browser (localStorage, `mcp-assist-3d/settings`).

## First click

A browser blocks sound until the player clicks or presses a key. The app makes its audio context at the first `pointerdown` or `keydown`. A sound before that is skipped.

## Code

`src/sound.js` (`playSound(group)`, `setVolume`), `src/components/Ping.jsx` (the ping sound), `src/log/useLogSounds.js`, `soundOf` in `src/log/log.js`.

## Not built

- Other files. The player listens and asks for others if needed.
