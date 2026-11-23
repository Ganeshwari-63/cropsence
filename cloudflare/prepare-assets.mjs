import { readdir, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.resolve(scriptDirectory, '../client/dist')
const partDirectory = path.join(distDirectory, '__video_parts')
const maxAssetBytes = 20 * 1024 * 1024

async function walk(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(fullPath))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

await rm(partDirectory, { recursive: true, force: true })
await mkdir(partDirectory, { recursive: true })

const excludedFiles = []
const videoFiles = (await walk(path.join(distDirectory, 'videos')))
  .filter((file) => file.toLowerCase().endsWith('.mp4'))

for (const videoPath of videoFiles) {
  const info = await stat(videoPath)
  if (info.size <= maxAssetBytes) continue

  const name = path.basename(videoPath, path.extname(videoPath))
  const outputDirectory = path.join(partDirectory, name)
  await mkdir(outputDirectory, { recursive: true })
  const video = await readFile(videoPath)
  const parts = []

  for (let offset = 0, index = 0; offset < video.length; offset += maxAssetBytes, index += 1) {
    const fileName = `part-${String(index).padStart(4, '0')}.bin`
    await writeFile(path.join(outputDirectory, fileName), video.subarray(offset, offset + maxAssetBytes))
    parts.push(`/__video_parts/${name}/${fileName}`)
  }

  await writeFile(
    path.join(partDirectory, `${name}.json`),
    JSON.stringify({ size: video.length, chunkSize: maxAssetBytes, parts })
  )

  const relativePath = `/${path.relative(distDirectory, videoPath).split(path.sep).join('/')}`
  excludedFiles.push(relativePath)
  console.log(`Prepared ${relativePath}: ${(video.length / 1024 / 1024).toFixed(1)} MiB in ${parts.length} parts`)
}

if (excludedFiles.length) {
  await writeFile(
    path.join(distDirectory, '.assetsignore'),
    `${excludedFiles.join('\n')}\n`
  )
}

const securityHeaders = [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  X-Frame-Options: DENY',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Permissions-Policy: camera=(self), geolocation=(self), microphone=(self)',
  '  Cross-Origin-Opener-Policy: same-origin',
  '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
  "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  '/assets/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '/__video_parts/*',
  '  Cache-Control: public, max-age=31536000, immutable',
]
await writeFile(path.join(distDirectory, '_headers'), `${securityHeaders.join('\n')}\n`)

console.log('Cloudflare static assets are prepared.')
