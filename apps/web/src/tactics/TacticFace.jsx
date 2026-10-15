import { Fragment, useLayoutEffect, useRef } from 'react'
import { assetUrl } from '../assets/index.js'
import { parseBody } from './faceBody.js'
import { bodyIconUrl, faceIconUrl, hasBodyIcon } from './faceIcons.js'
import { tacticCardBack } from './files.js'
import { fitFace, cachedFaceSize } from './tacticFaceFit.js'
import { useFaceCard } from './useFaceCard.js'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/800.css'
import '@fontsource-variable/noto-sans/wdth.css'
import './TacticFace.css'

// Size of the face in CSS px, the 2.5 x 3.5 shape of the card. The 3D card texture
// (tacticFaceTexture.js) draws the same box.
export const FACE_WIDTH = 457
export const FACE_HEIGHT = 640

// Fonts the face uses, to wait for before the text is measured. fontsource files are loaded by their
// unicode range, so the text is a latin letter.
const FACE_FONTS = [
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

// Body markup; an id without an icon is plain text
const parse = (source) => parseBody(source, hasBodyIcon)

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
    <Nodes nodes={parse(source)} />
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

// The threat level of a gem: the round badge and a short black pill with the number
const Threat = ({ value }) => (
  <div className="tactic-face-threat">
    <span className="tactic-face-threat-badge">
      <img src={faceIconUrl('threat-level')} alt="" />
    </span>
    <span className="tactic-face-threat-pill">{String(value)}</span>
  </div>
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
                <Nodes nodes={parse(s)} />
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
          <Nodes nodes={parse(power.body.replace(/\n$/, ''))} />
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

// A Team Tactic face drawn from the card art and the Jarvis card data (src/tactics/jarvis-tactics-text.json,
// docs/features/team-tactic-cards.md, "Generated face"). tacticKey: the key in cards.json. While the data
// loads, the face shows the art at opacity 0.2 on the card color, without text.
// onReady(fontSize): called once the fonts have loaded and the text is fitted, for the texture
// (tacticFaceTexture.js) and the dev page. The font size is fitted once per key (tacticFaceFit.js).
// The face is FACE_WIDTH x FACE_HEIGHT CSS px, scale it with a transform (TacticFaceScaled.jsx).
export default function TacticFace({ tacticKey, onReady }) {
  const ref = useRef(null)
  const onReadyRef = useRef(onReady)
  const card = useFaceCard(tacticKey)

  useLayoutEffect(() => {
    onReadyRef.current = onReady
  })

  useLayoutEffect(() => {
    if (!card || !ref.current) return undefined
    let cancelled = false
    // A key that was fitted before has its size at once, so the text does not jump when the fonts arrive
    const known = cachedFaceSize(tacticKey)
    if (known) ref.current.style.setProperty('--fs', `${known}px`)
    Promise.all(FACE_FONTS.map((f) => document.fonts.load(f, 'A'))).then(() => {
      if (cancelled || !ref.current) return
      onReadyRef.current?.(fitFace(ref.current, tacticKey))
    })
    return () => {
      cancelled = true
    }
  }, [card, tacticKey])

  const art = <img className="tactic-face-art" src={assetUrl(tacticCardBack(tacticKey))} alt="" />
  if (!card) {
    return (
      <div className="tactic-face" ref={ref}>
        {art}
      </div>
    )
  }

  const powers = (card.superPowers ?? []).filter((p) => p.form === 'front' || !p.form)
  const attacks = (card.attacks ?? []).filter((a) => a.form === 'normal')
  const hasThreat = card.threatLevel != null
  const affiliation = card.affiliation ?? 'Unaffiliated'
  const feather = faceIconUrl('feather')

  return (
    <div className="tactic-face" ref={ref}>
      {art}
      <div className="tactic-face-title">{card.name}</div>
      <div className="tactic-face-sp1">
        <div className="tactic-face-atks">
          {attacks.map((a, i) => (
            <AttackPanel key={i} attack={a} />
          ))}
        </div>
      </div>
      {/* A card with a threat level (an Infinity Gem) has the threat pill instead of the affiliation, the
          type and the body, and its text sits at the lower end */}
      <div className={`tactic-face-main${hasThreat ? ' tactic-face-main--end' : ''}`}>
        {hasThreat ? (
          <Threat value={card.threatLevel} />
        ) : (
          <>
            <div className="tactic-face-aff">{affiliation}</div>
            {mainBlocks(card, powers)}
          </>
        )}
        {hasThreat && powers.map((p, i) => <SuperPowerPanel key={i} power={p} />)}
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
