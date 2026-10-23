import { Dialog } from '../ui/Dialog.jsx'

// The comic frame of the setup choose overlays (CrisisChoose.jsx, ThreatChoose.jsx): the roster popup frame
// (rosters/roster.css) with a header (tag, title; blue or red) and a scrolling stage. crisis.css styles it.
// tone: 'blue' | 'red'. children: the content of the stage.
export function ChooseFrame({ tone, tag, title, onClose, className = '', style, children }) {
  return (
    <Dialog
      backdropClassName="card-popup roster-popup-backdrop"
      className={`comic roster-comic crisis-choose ${className}`.trim()}
      style={style}
      closeClassName="roster-comic-close"
      label={title}
      onClose={onClose}
    >
      <header className={`roster-comic-head roster-comic-head--${tone}`}>
        <div className="roster-comic-head-row">
          <div className="roster-comic-heading">
            <div className="roster-comic-tag">{tag}</div>
            <h2 className="roster-comic-title">{title}</h2>
          </div>
        </div>
      </header>
      {children}
    </Dialog>
  )
}
