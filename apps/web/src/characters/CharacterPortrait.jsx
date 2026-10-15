import { assetUrl } from '../assets/index.js'
import { characterPortrait } from './files.js'

// The portrait of a character (characters/<slug>/portrait.webp), or an empty circle or square of the same
// class when the character has no files in the app. The class gives the size and the shape.
// character: { slug, available } as in characters/characters.js.
export function CharacterPortrait({ character, className }) {
  if (!character?.available) return <span className={className} />
  return (
    <img
      className={className}
      src={assetUrl(characterPortrait(character.slug))}
      alt=""
      loading="lazy"
      draggable={false}
    />
  )
}
