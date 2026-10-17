import { useEffect, useRef } from 'react'
import { FocusScope } from '@react-aria/focus'
import { Overlay } from './Overlay.jsx'

// The shell of every dialog: CrisisChoose, CrisisCompare, NewRoomDialog, RosterPopup, SettingsPopup, TrayPopup
// (docs/features/key-shortcuts.md, "Dialogs"). It renders through Overlay, so the stacking is that of
// Overlay. It owns:
// - the backdrop rule: a click on the backdrop calls onClose only when the press also started on the backdrop,
//   so a drag that ends there (a carousel, a text selection) does not close it;
// - the × button (closeButton={false}: the content has its own);
// - role="dialog", aria-modal and aria-label on the element, tabIndex -1;
// - the focus: the dialog element takes the focus on open (not a button, so Enter or Space does not press ×),
//   Tab stays inside (FocusScope contain), and the focus goes back to the opener on close (restoreFocus);
// - Escape: closes the dialog, also when Escape is removed from the cancel binding. The listener is on the
//   document, so it runs before the window listener of the table keys, and stops the event, so the table
//   does not close the popups a second time. The key capture of Settings (KeyBindings.jsx) listens on the
//   window in the capture phase and stops the event first.
// backdropClassName: the class of the backdrop. className: the class of the element. as: 'div' or 'form'.
// closeClassName: a variant of the × button. The button is then the first child of the element (not a
// sibling of it), so a style can put it at a corner of the element; its look is in that style (the roster
// popup, RosterPopup.jsx). Without it, the button is the round one in the screen corner (.popup-close).
// The rest (onSubmit, ...) goes to the element.
export function Dialog({
  label,
  className,
  backdropClassName,
  closeClassName,
  onClose,
  closeButton = true,
  restoreFocus = true,
  as: Element = 'div',
  children,
  ...rest
}) {
  const pressedBackdrop = useRef(false)
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    ref.current?.focus()
    function handleKeyDown(e) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      closeRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const close = (
    <button
      type="button"
      className={closeClassName ?? 'popup-close'}
      aria-label="Close"
      onClick={onClose}
    >
      ×
    </button>
  )

  return (
    <Overlay
      className={backdropClassName}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose()
      }}
    >
      <FocusScope contain restoreFocus={restoreFocus}>
        {closeButton && !closeClassName && close}
        <Element
          {...rest}
          ref={ref}
          className={className}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
        >
          {closeButton && closeClassName && close}
          {children}
        </Element>
      </FocusScope>
    </Overlay>
  )
}
