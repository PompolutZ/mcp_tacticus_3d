import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cacheTarget } from './tts.mjs'

const CDN = 'https://d37ev18qvj5a3m.cloudfront.net/tts'
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])
const WEBP = Uint8Array.from(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))

test('cacheTarget sends .unity3d to Assetbundles and .obj to Models, whatever the bytes', () => {
  assert.deepEqual(cacheTarget(`${CDN}/a/STORM_MODEL.unity3d`, PNG), {
    dir: 'Assetbundles',
    ext: 'unity3d',
  })
  assert.deepEqual(cacheTarget(`${CDN}/a/m.OBJ?x=1`, JPEG), { dir: 'Models', ext: 'obj' })
})

test('cacheTarget gives an image the extension of its type, not of its URL', () => {
  assert.deepEqual(cacheTarget(`${CDN}/a/x.jpg`, PNG), { dir: 'Images', ext: 'png' })
  assert.deepEqual(cacheTarget(`${CDN}/a/x.png`, JPEG), { dir: 'Images', ext: 'jpg' })
  assert.deepEqual(cacheTarget('https://steamusercontent-a.akamaihd.net/ugc/123/ABC/', WEBP), {
    dir: 'Images',
    ext: 'webp',
  })
})

test('cacheTarget returns null for a file of an unknown type', () => {
  assert.equal(cacheTarget(`${CDN}/a/x.png`, Buffer.from('<html>')), null)
  assert.equal(cacheTarget(`${CDN}/a/x.png`, new Uint8Array()), null)
})
