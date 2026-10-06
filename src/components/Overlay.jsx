import { createPortal } from 'react-dom'

// A dialog-like overlay (full-screen, sits above everything else): CardPopup, LoadingOverlay.
// Rendered through a portal straight into document.body, so it can never end up inside the 3D
// scene's isolated stacking context (see .scene-root in index.css) or any other ancestor that
// might get a transform or an opacity later -- its z-index in index.css is all that ever decides
// where it stacks. Panels that are part of the HUD layout (toolbar, Library, dice panel, ...)
// stay plain children of App: they are never covered by the scene, so they do not need this.
export function Overlay({ className, onClick, children }) {
  return createPortal(
    <div className={className} onClick={onClick}>{children}</div>,
    document.body,
  )
}
