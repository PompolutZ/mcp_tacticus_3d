# Feature: Sounds

Status: partly built. Dice and token sounds and the volume are built. The ping and the drop notice sounds are in the files and the code, and play when those features are built.

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
| `notice` | `question_001` | A dropped token waits for this player (not built yet) |

- A group has a random file for each play. The same group plays at most once in 80 ms.
- The token sounds come from the Log (`game-log.md`): each browser plays a sound for each new `token` or `held` entry that is put on (`on`). Entries that exist when the table opens, and entries older than 5 s, play nothing. One source, so both players hear the same sound. If the batch has Activated, that sound plays.
- A token taken off, damage and Power make no sound.

## Volume

**Sound** slider in the Settings menu (`table-tools.md`), 0 to 100, default 60. 0 is off. Stored in this browser (localStorage, `mcp-assist-3d/settings`).

## First click

A browser blocks sound until the player clicks or presses a key. The app makes its audio context at the first `pointerdown` or `keydown`. A sound before that is skipped.

## Code

`src/sound.js` (`playSound(group)`, `setVolume`), `src/log/useLogSounds.js`, `soundOf` in `src/log/log.js`.

## Not built

- Ping and drop notice sounds (they have their feature).
- Other files. The player listens and asks for others if needed.
