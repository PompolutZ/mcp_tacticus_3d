# Feature: Ping

Status: built.

## Goal

A player points at a place on the table. The other player sees and hears it, so "this one" needs no words.

## Use

- Key **P** (TTS uses P for the camera mode, the app has no camera modes). The ping is at the table, board or terrain point under the pointer. With the pointer off the table, or not over the canvas, nothing happens.
- Not while the focus is in a text field, with Ctrl, Cmd or Alt held, or while a popup or a drag is open. A held key does not repeat the ping.
- The ping is a down arrow that bounces above the point, and a ring on the surface. Both are in the color of the side of the player. It shows for 3 s, fades in the last 0.5 s, then goes. It sits on top of models and terrain: the arrow is not hidden by them.
- The sound `ping-bing` plays at the start (`sounds.md`). The volume slider sets it.
- A new ping of the same player replaces the last one. Each player has at most one ping on the table.

## Network

- The ping is the awareness field `ping`: `{ id, at: [x, y, z] }` (`peer-to-peer.md`). It is reliable, not the `live` channel, so no ping is lost.
- A browser shows a ping when its id is new. The 3 s start when the ping arrives, by the clock of the receiver, so a clock difference between two computers cannot hide a ping.
- The ping in the first state that a browser gets from the other player is from before the join: it shows nothing and makes no sound. So a reload within 3 s of a ping does not show the old ping. A player who leaves is forgotten, so a rejoin with the same old ping shows nothing too. Awareness sends a state again (a timer, or another field changes): the same id is not a new ping.
- The Sandbox and a single player room have no network. The ping shows only in the browser that pings.

## Code

`handlePingKey` in `src/components/usePing.js`, `PING_KEY` in `src/keyboard.js`, `atPointer` of `src/components/ToolPoint.jsx` (the point with `y`), `src/components/Ping.jsx`, the `ping` field in `src/net/presence.js`.
