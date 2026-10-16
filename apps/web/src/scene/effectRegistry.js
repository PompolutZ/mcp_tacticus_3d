// Effect objects of the SelectionOutlines passes, by mode, kept in React state. EffectComposer
// (@react-three/postprocessing 3) renders its children only after its own effect has made the
// composer, and an effect can be given again or cleared (a ref callback gets null on unmount and in
// StrictMode, a new object when the scene or camera changes). So the code that configures an effect
// runs from state, when the effect exists, not from a ref read at mount.

// New map with the effect of mode set, or removed when effect is null. The same map when nothing changed.
export function withEffect(map, mode, effect) {
  if (effect) {
    if (map[mode] === effect) return map
    return { ...map, [mode]: effect }
  }
  if (!(mode in map)) return map
  const { [mode]: _removed, ...rest } = map
  return rest
}

// True when every mode has an effect
export function hasAll(map, modes) {
  return modes.every((mode) => map[mode])
}
