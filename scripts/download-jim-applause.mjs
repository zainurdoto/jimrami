// JIMRAMI: install real concert-audience applause for JIM success.
// Run from project root: node scripts/download-jim-applause.mjs
// Author: Amada44, CC0 1.0, Wikimedia Commons.
// https://commons.wikimedia.org/wiki/File:Sound_Effects_-_Applause_after_a_concert.ogg
// No npm packages required.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const file = 'Sound Effects - Applause after a concert.ogg'
const wikiName = file.replaceAll(' ', '_')
const md5 = createHash('md5').update(wikiName).digest('hex')
const url = `https://upload.wikimedia.org/wikipedia/commons/${md5[0]}/${md5.slice(0, 2)}/${encodeURIComponent(wikiName)}`
const dest = join(process.cwd(), 'public', 'audio', 'jim')
try {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'JIMRAMI-asset-download/1.0 (personal game)' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = Buffer.from(await response.arrayBuffer())
  if (data.byteLength < 100_000 || data.subarray(0, 4).toString('ascii') !== 'OggS') {
    throw new Error('Server did not return a valid Ogg recording')
  }
  await mkdir(dest, { recursive: true })
  await writeFile(join(dest, 'crowd-applause.ogg'), data)
  console.log(`✓ Installed crowd-applause.ogg (${Math.round(data.length / 1024)} KB)`)
  console.log('Ready for offline browser / APK use after building the app.')
} catch (error) {
  console.error('✗ Could not download applause:', error.message)
  console.error('Alternative: download the original OGG from the Wikimedia Commons page,')
  console.error('rename it to crowd-applause.ogg, and put it in public/audio/jim/.')
  process.exitCode = 1
}
