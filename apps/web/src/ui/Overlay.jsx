import { createPortal } from 'react-dom'

// A full-screen overlay that sits above everything else: CardPopup and LoadingOverlay. A dialog with controls
// (close button, focus, Escape) uses Dialog.jsx, which is built on this.
// Layer 3 of the stacking (see #root in index.css). Rendered through a portal straight into document.body,
// after #root, which is isolated: an overlay paints above all HUD, whatever the HUD z-index numbers, and
// never sits inside an ancestor that gets a transform or an opacity later. Its z-index in index.css only
// orders overlays among themselves (.loading 1, .card-popup 2, .new-room-backdrop 2). HUD panels (toolbar,
// Library, ...) stay plain children of App: the scene never covers them, so they do not need this.
export function Overlay({ className, onClick, onPointerDown, children }) {
  return createPortal(
    <div className={className} onClick={onClick} onPointerDown={onPointerDown}>
      {children}
    </div>,
    document.body,
  )
}
