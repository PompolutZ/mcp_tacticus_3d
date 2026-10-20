// Who gets Activated on a click at the Activated source of a host tray: a host with grunts activates the grunts
// first, then the host (docs/features/character-trays.md, "Grunts"). Returns the ids to give it to: the grunts
// of the host that lack it (and are not immune: isImmune(grunt)), else the host.
export function activationTargets(characters, hostId, isImmune = () => false) {
  const lacking = characters
    .filter((c) => c.host === hostId && !c.tokens?.activated && !isImmune(c))
    .map((c) => c.id)
  return lacking.length ? lacking : [hostId]
}
