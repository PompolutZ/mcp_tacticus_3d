// The name label that shows over a hovered model (CharacterModel.jsx).

// The pointer stays on a model this long (ms) before its name shows
export const NAME_LABEL_DELAY = 1000

// 'diamond' -> 'Diamond', 'iron-man-hulkbuster' -> 'Iron man hulkbuster'
const formName = (slug) => `${slug[0].toUpperCase()}${slug.slice(1).replace(/-/g, ' ')}`

// Name on the label of a model: the name of the card it stands for. The model of a second card has the
// name of the character and its form, for example 'Emma Frost (Diamond)'.
// model: an entry of characterModels (models.js). name: display name of the character.
export function modelLabel(model, name) {
  if (model.card !== 2) return name
  const form = model.character.secondForm
  return form ? `${name} (${formName(form)})` : name
}
