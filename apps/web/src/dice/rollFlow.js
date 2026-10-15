// Two pure parts of the dice tray roll flow frame. Plain module, so node --test can load it.

// What a thrown die that stopped (or timed out, or is lost) becomes: 'lost' (thrown again from
// above the well), 'wait' (tilted or did not rest in time, with rethrowTilted: waits for the other
// dice, then is thrown again) or 'flat' (reads its top face, nearest to up, and goes to the shelf).
// Without rethrowTilted a tilted or timed out die is 'flat'.
export function restOutcome({ lost, timedOut, tilted, rethrowTilted = false }) {
  if (lost) return 'lost'
  if (rethrowTilted && (timedOut || tilted)) return 'wait'
  return 'flat'
}

// The stage of the tray, from its dice entries: rolling (a die is thrown), sliding (a shelf die
// moves), flat (dice in the well with a symbol) and waiting (dice that wait to be thrown again).
export function flowStage(entries) {
  let rolling = false
  let sliding = false
  const flat = []
  const waiting = []
  for (const entry of entries) {
    if (entry.state === 'thrown') rolling = true
    else if (entry.state === 'well' && entry.symbol != null) flat.push(entry)
    else if (entry.state === 'well' && entry.waiting) waiting.push(entry)
    else if (entry.state === 'shelf' && entry.moving) sliding = true
  }
  return { rolling, sliding, flat, waiting }
}

// One physics step of one thrown die: did it touch something for the first time since the throw?
// A die thrown from a rest sits on the floor in the first step, so only a touch after it was off
// every contact (airborne) counts. Returns the new airborne and whether this step is a contact.
export function contactStep({ airborne, touching }) {
  if (!touching) return { airborne: true, contact: false }
  return { airborne, contact: airborne }
}

// Can Roll not throw now? After the first contact of a die of the throw, until the throw ends
// (no die thrown and none waiting): a player cannot wait for a bad face and throw again.
export function rollBlocked({ contacted, rolling, waiting }) {
  return contacted && (rolling || waiting)
}
