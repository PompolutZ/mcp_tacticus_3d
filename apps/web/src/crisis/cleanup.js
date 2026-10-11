// Cleanup Phase rules for crisis tokens, as plain functions (no JSON, no React). See
// docs/plans/cleanup-phase.md, decision 6.

// New token list after the Cleanup Phase. cardOf(cardKey) → card with tokens and supply (getCard in
// cards.js), or null. A Source (its card has a flipOnly token with this front) turns to its front.
// A supply token (frontKey is the supply of its card) is removed, held or not. Others stay.
// Unchanged tokens keep their object.
export function cleanupCrisisTokens(tokens, cardOf) {
  const result = []
  for (const t of tokens) {
    const card = cardOf(t.cardKey)
    if (card?.supply && t.frontKey === card.supply) continue
    const isSource = card?.tokens?.some((e) => e.flipOnly && e.token === t.frontKey)
    result.push(isSource && t.up !== 'front' ? { ...t, up: 'front' } : t)
  }
  return result
}
