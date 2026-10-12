// JIMRAMI: download original Javanese hand-drum one-shot samples.
// Run from the *root of your project* with: node scripts/download-jim-drums.mjs
// No npm packages required. This downloads Artistic-2.0 licensed recordings
// by Digitópia / Casa da Música from Wikimedia Commons (see credits).
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const drums = {
  bass: 'Drums_kendhang_ageng_dha',
  dum: 'Drums_ketipung_small_dhung',
  tak: 'Drums_ciblon_medium_tak',
  wood: 'Drums_ciblon_medium_thung',
  tap: 'Drums_ciblon_medium_tong',
}
const dest = join(process.cwd(), 'public', 'audio', 'jim')
await mkdir(dest, { recursive: true })
let errors = 0
for (const [key, baseName] of Object.entries(drums)) {
  const file = `${baseName}_(Casa_da_Musica's_Javanese_gamelan).ogg`
  const hash = createHash('md5').update(file).digest('hex')
  const url = `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(file)}`
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'JIMRAMI-asset-download/1.0 (personal open source game project)' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = Buffer.from(await response.arrayBuffer())
    if (data.length < 4000) throw new Error('Download is unexpectedly small')
    await writeFile(join(dest, `${key}.ogg`), data)
    console.log(`✓ ${key}.ogg (${Math.round(data.length / 1024)} KB)`)
  } catch (error) {
    errors++
    console.error(`✗ ${key}.ogg failed: ${error.message}`)
  }
}
if (errors) {
  console.error(`\n${errors} download(s) failed. Check internet and retry.`)
  process.exitCode = 1
} else {
  console.log('\nAll real gendang samples installed. Works offline after deploying/building.')
}
