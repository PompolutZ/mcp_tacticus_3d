// The image of a user (docs/feature-auth.md, "Users"). user: { discordId, avatar }.
export function avatarUrl(user, size = 64) {
  if (user.avatar)
    return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=${size}`
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex(user.discordId)}.png`
}

// One of the 6 default avatars. A dev id is not a number, so it uses the sum of its character codes.
function defaultIndex(discordId) {
  if (/^\d+$/.test(discordId)) return Number((BigInt(discordId) >> 22n) % 6n)
  let sum = 0
  for (const ch of discordId) sum += ch.charCodeAt(0)
  return sum % 6
}
