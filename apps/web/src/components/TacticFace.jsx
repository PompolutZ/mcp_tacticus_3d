import { Fragment, useLayoutEffect, useRef } from 'react'
import { parseBody } from '../tactics/faceBody.js'
import { bodyIconUrl, faceIconUrl } from '../tactics/faceIcons.js'
import { fitFace } from './tacticFaceFit.js'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/800.css'
import '@fontsource-variable/noto-sans/wdth.css'
import './TacticFace.css'

// Size of the face in CSS px. The 3D card texture (tacticFaceTexture.js) draws the same box.
export const FACE_WIDTH = 446
export const FACE_HEIGHT = 640

// Fonts the face uses, to wait for before the text is measured. fontsource files are loaded by their
// unicode range, so the text is a latin letter.
export const FACE_FONTS = [
  '500 14px "Barlow Condensed"',
  '600 20px "Barlow Condensed"',
  '800 31px "Barlow Condensed"',
  '400 19px "Noto Sans Variable"',
  '700 19px "Noto Sans Variable"',
]

const TYPE_LABELS = {
  active: 'Active',
  active_action: 'Active: Action',
  reactive: 'Reactive',
}

function Icon({ name }) {
  const url = bodyIconUrl(name)
  return url ? <img className="tactic-face-ic" src={url} alt="" /> : null
}

function Nodes({ nodes }) {
  return nodes.map((n, i) => <Node key={i} node={n} />)
}

function Node({ node }) {
  switch (node.t) {
    case 'text':
      return node.text
    case 'br':
      return <span className="tactic-face-br" />
    case 'row':
      return <span style={{ display: 'flex' }} />
    case 'icon':
      return <Icon name={node.name} />
    case 'bold':
      return (
        <b>
          <Nodes nodes={node.children} />
        </b>
      )
    case 'bullet':
      return (
        <ul>
          <li>
            <Nodes nodes={node.children} />
          </li>
        </ul>
      )
    case 'cond':
      return <span>{node.text}</span>
    case 'token':
      return (
        <span>
          <Nodes nodes={node.children} />
        </span>
      )
    case 'nobreak':
      return (
        <span className="tactic-face-nb">
          <Nodes nodes={node.children} />.
        </span>
      )
    default:
      return null
  }
}

const Body = ({ source, className = '' }) => (
  <div className={`tactic-face-body ${className}`}>
    <Nodes nodes={parseBody(source)} />
  </div>
)

// "Name (note)": the note is drawn smaller
function PillName({ name }) {
  const m = name.match(/^(.*?)\s*(\(.*\))$/)
  return (
    <span className="tactic-face-pname">
      <span>{m ? m[1] : name}</span>
      {m && <small>{m[2]}</small>}
    </span>
  )
}

function Pill({ type, name }) {
  return (
    <div className="tactic-face-pill">
      <span className="tactic-face-badge">
        <img src={faceIconUrl(`pill-${type}`)} alt="" />
      </span>
      <PillName name={name} />
    </div>
  )
}

const Stat = ({ icon, value }) => (
  <span className="tactic-face-stat">
    <img src={faceIconUrl(icon)} alt="" />
    {String(value)}
  </span>
)

function AttackPanel({ attack }) {
  return (
    <div className="tactic-face-panel">
      <div className="tactic-face-row">
        <Pill type={attack.type} name={attack.name} />
        <Stat icon="range" value={attack.range} />
        <Stat icon="stat-strength" value={attack.strength} />
        <Stat icon="stat-cost" value={attack.powerCost} />
      </div>
      {attack.steps.length > 0 && (
        <div className="tactic-face-steps">
          <ul>
            {attack.steps.map((s, i) => (
              <li key={i}>
                <Nodes nodes={parseBody(s)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SuperPowerPanel({ power }) {
  return (
    <div className="tactic-face-sp">
      <div className="tactic-face-panel">
        <div className="tactic-face-row">
          <Pill type={power.type} name={power.name} />
          {power.powerCost && (
            <span className="tactic-face-cost">
              <img src={faceIconUrl('stat-cost')} alt="" />
              {power.powerCost === '100' ? 'X' : power.powerCost}
            </span>
          )}
        </div>
        <div className="tactic-face-txt">
          <Nodes nodes={parseBody(power.body.replace(/\n$/, ''))} />
        </div>
      </div>
    </div>
  )
}

// The text blocks of the face, in the order of the card: the type and the body, the 1st superpower,
// the intermediary body, the other superpowers. A card with two types has no intermediary body.
function mainBlocks(card, powers) {
  const typed = (label, body) => (
    <Fragment key={label + body}>
      {label && <div className="tactic-face-type">{label}</div>}
      <Body source={body} />
    </Fragment>
  )
  const type = card.type
  const blocks = []
  if (type === 'both') {
    blocks.push(typed('Active', card.body), typed('Reactive', card.secondaryBody))
  } else if (type === 'reactive_reactive') {
    blocks.push(typed('Reactive', card.body), typed('Reactive', card.secondaryBody))
  } else if (type && type !== 'none') {
    blocks.push(typed(TYPE_LABELS[type], card.body))
  } else {
    blocks.push(typed(null, card.body))
  }
  const hasMid = type && type !== 'none' && type !== 'both' && type !== 'reactive_reactive'
  const mid = hasMid && card.intermediaryBody
  if (powers[0]) blocks.push(<SuperPowerPanel key="sp1" power={powers[0]} />)
  if (mid)
    blocks.push(<Body key="mid" source={card.intermediaryBody} className="tactic-face-mid" />)
  if (powers[1]) blocks.push(<SuperPowerPanel key="sp2" power={powers[1]} />)
  return blocks
}

// A Team Tactic face drawn from the card art and the Jarvis card data (see src/tactics/spike-faces.json).
// art: URL of the image under the text. card: the Jarvis entry. onReady(fontSize): called once the
// fonts have loaded and the text is fitted, for the texture (tacticFaceTexture.js).
// The face is FACE_WIDTH x FACE_HEIGHT CSS px, scale it with a transform.
export default function TacticFace({ art, card, onReady }) {
  const ref = useRef(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useLayoutEffect(() => {
    let cancelled = false
    Promise.all(FACE_FONTS.map((f) => document.fonts.load(f, 'A'))).then(() => {
      if (cancelled || !ref.current) return
      const size = fitFace(ref.current)
      onReadyRef.current?.(size)
    })
    return () => {
      cancelled = true
    }
  }, [card])

  const powers = (card.superPowers ?? []).filter((p) => p.form === 'front' || !p.form)
  const attacks = (card.attacks ?? []).filter((a) => a.form === 'normal')
  const affiliation = card.affiliation?.name ?? 'Unaffiliated'
  const feather = faceIconUrl('feather')

  return (
    <div className="tactic-face" ref={ref}>
      <img className="tactic-face-art" src={art} alt="" />
      <div className="tactic-face-title">{card.name}</div>
      <div className="tactic-face-sp1">
        <div className="tactic-face-atks">
          {attacks.map((a, i) => (
            <AttackPanel key={i} attack={a} />
          ))}
        </div>
      </div>
      <div className="tactic-face-main">
        <div className="tactic-face-aff">{affiliation}</div>
        {mainBlocks(card, powers)}
      </div>
      <div className="tactic-face-gap" />
      <div className="tactic-face-foot">
        <span className="tactic-face-c">©</span>
        <span className="tactic-face-t">MARVEL</span>
        <span className="tactic-face-c">©</span>
        <span className="tactic-face-t">AMG</span>
        {card.artist && <img src={feather} alt="" />}
        <span className="tactic-face-a">{(card.artist ?? '').replace('/', ' / ')}</span>
      </div>
    </div>
  )
}
