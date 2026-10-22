import { isCustomModel } from '../../src/characters/customModels.js'

// A model file counts as present when the mod gave it (it is in `sources`) or when it is a listed
// custom model. A scan of a character whose mod has only a standee must keep figure "model".
export function hasModelFile(sources, customModels, key, file) {
  return file in sources || isCustomModel(customModels, key, file)
}
