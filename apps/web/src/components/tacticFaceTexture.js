import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import TacticFace, { FACE_HEIGHT, FACE_WIDTH } from './TacticFace.jsx'
import faceCss from './TacticFace.css?raw'
import { spikeFace, spikeFaceArt } from '../tactics/spikeFaces.js'
import barlow500 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2?url'
import barlow600 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2?url'
import barlow800 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff2?url'
import notoWdth from '@fontsource-variable/noto-sans/files/noto-sans-latin-wdth-normal.woff2?url'

// Draws a TacticFace into a canvas, for the texture of the 3D card. The canvas is FACE x SCALE:
// 446 x 640 CSS px at 1.63 gives 728 x 1045 px.
//
// Method: the face is mounted off screen so that the text can be measured and fitted. Then its DOM is
// serialized into an SVG <foreignObject> and drawn into the canvas as an image. An SVG that is loaded
// as an image cannot fetch files, so the fonts, the art and the icons are inlined as data URLs.
// The result is the same face that the page shows, with the same fonts and the same text fit.
export const FACE_SCALE = 1.63
export const CANVAS_WIDTH = 728
export const CANVAS_HEIGHT = 1045

const XHTML = 'http://www.w3.org/1999/xhtml'

// Latin subsets only, the same as the face needs for English text. Order: font-family, weight, url.
const FONT_FILES = [
  ['Barlow Condensed', '500', barlow500],
  ['Barlow Condensed', '600', barlow600],
  ['Barlow Condensed', '800', barlow800],
  ['Noto Sans Variable', '100 900', notoWdth],
]

const dataUrlCache = new Map()

// data: URL of a file, one fetch per URL
function toDataUrl(url) {
  if (url.startsWith('data:')) return Promise.resolve(url)
  let promise = dataUrlCache.get(url)
  if (!promise) {
    promise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`)
        return r.blob()
      })
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          }),
      )
    dataUrlCache.set(url, promise)
  }
  return promise
}

let fontCssPromise = null

// The @font-face rules with the font files inside
function fontCss() {
  fontCssPromise ??= Promise.all(
    FONT_FILES.map(async ([family, weight, url]) => {
      const data = await toDataUrl(url)
      const stretch = family === 'Noto Sans Variable' ? 'font-stretch: 62.5% 100%;' : ''
      return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};${stretch}src:url(${data}) format('woff2');}`
    }),
  ).then((rules) => rules.join('\n'))
  return fontCssPromise
}

// Mounts the face off screen, waits for the fit, returns the card element and a function that cleans up
function mountFace(art, card) {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${FACE_WIDTH}px;height:${FACE_HEIGHT}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  const ready = new Promise((resolve) => {
    root.render(createElement(TacticFace, { art, card, onReady: resolve }))
  })
  const cleanup = () => {
    root.unmount()
    host.remove()
  }
  return { host, ready, cleanup }
}

// The SVG text of the face. The DOM is copied, its images get data: URLs.
async function faceSvg(art, card) {
  const { host, ready, cleanup } = mountFace(art, card)
  let faceNode
  try {
    await ready
    faceNode = host.firstElementChild.cloneNode(true)
  } finally {
    cleanup()
  }
  await Promise.all(
    [...faceNode.querySelectorAll('img')].map(async (img) => {
      img.setAttribute('src', await toDataUrl(img.getAttribute('src')))
    }),
  )
  const css = `${await fontCss()}\n${faceCss}`
  // XMLSerializer writes valid XML (closed tags, escaped text), which an SVG needs
  const body = new XMLSerializer().serializeToString(faceNode)
  const style = `<style xmlns="${XHTML}">${css.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</style>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" ` +
    `viewBox="0 0 ${FACE_WIDTH} ${FACE_HEIGHT}">` +
    `<foreignObject x="0" y="0" width="${FACE_WIDTH}" height="${FACE_HEIGHT}">${style}${body}</foreignObject></svg>`
  )
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The face SVG did not load as an image'))
    img.src = src
  })
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))

const canvases = new Map()

// The canvas of the face of the card with this key (a spike key, see tactics/spikeFaces.js). One canvas
// per key, made once: the promise is cached.
export function tacticFaceCanvas(key) {
  let promise = canvases.get(key)
  if (!promise) {
    promise = drawFace(key)
    // A failed draw is tried again at the next call
    promise.catch(() => canvases.delete(key))
    canvases.set(key, promise)
  }
  return promise
}

async function drawFace(key) {
  const card = spikeFace(key)
  if (!card) throw new Error(`No face data for ${key}`)
  const svg = await faceSvg(spikeFaceArt(key), card)
  // A data: URL, not a blob: URL. Safari taints a canvas that gets a blob: SVG image.
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  // Safari can draw the first time before it has laid out the foreignObject content. A second draw
  // after a frame is cheap and gives the full image.
  await nextFrame()
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  if (import.meta.env.DEV) console.info(`tactic face ${key}: svg ${svg.length} chars`)
  return canvas
}
