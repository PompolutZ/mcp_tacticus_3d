import { useCallback, useMemo, useRef } from 'react'
import { modelKey } from '../characters/claims.js'

// The claims of Scene: the ownership that the models get, and claimModel for the actions of Scene.
export function useModelClaims({ ownership }) {
  // Piece key → time (s) of the last claim call of this browser, for the 0.2 s that a claim lasts
  const claimTimes = useRef(new Map())
  // The ownership that the models get: each claim sets the time of the claim
  const claims = useMemo(
    () =>
      ownership && {
        ...ownership,
        claim(key) {
          if (!ownership.claim(key)) return false
          claimTimes.current.set(key, performance.now() / 1000)
          return true
        },
      },
    [ownership],
  )
  // Claims the model before an action. False: the other player moves it, so the action does nothing.
  const claimModel = useCallback((id) => (claims ? claims.claim(modelKey(id)) : true), [claims])

  return { claimTimes, claims, claimModel }
}
