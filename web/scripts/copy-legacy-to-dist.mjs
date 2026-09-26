/**
 * Vite dev uses middleware to serve ../ under /play — production builds need the same files in dist/play.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const publicDir = path.join(webRoot, 'public')
const distPlay = path.join(webRoot, 'dist', 'play')

const publicFiles = [
  'styles.css',
  'script.js',
  'guidebook-cinematic.js',
  'animations.js',
  'angelic-socket-config.js',
  'madara.webp',
  'demon.avif',
  'button.mp3',
  'evil laugh.wav',
  'scream.wav',
  'dark-ambience.wav',
  'Romantic Rap Instrumental - _Story_ _ Love Rap Beat(MP3_320K).mp3',
  'blackbear - hot girl bummer [Low Budget Video](MP3_128K)_[cut_13sec].mp3',
  'blackbear - hot girl bummer [Low Budget Video](MP3_128K)_[cut_2sec].mp3',
]

const socketClient = path.join(publicDir, 'socket.io.min.js')

fs.mkdirSync(distPlay, { recursive: true })

for (const f of publicFiles) {
  const src = path.join(publicDir, f)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distPlay, f))
  }
}

const serverOut = path.join(distPlay, 'server')
fs.mkdirSync(serverOut, { recursive: true })
for (const f of ['behavior_analyzer.js', 'ai_learning.js']) {
  const src = path.join(publicDir, 'server', f)
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(serverOut, f))
}

if (fs.existsSync(socketClient)) {
  fs.copyFileSync(socketClient, path.join(distPlay, 'socket.io.min.js'))
}

const indexSrc = path.join(publicDir, 'index.html')
let html = fs.readFileSync(indexSrc, 'utf8')
html = html.replace(
  '<script src="/socket.io/socket.io.js"></script>',
  '<script src="socket.io.min.js"></script>',
)
fs.writeFileSync(path.join(distPlay, 'index.html'), html)

console.log('[copy-legacy-to-dist] Wrote', distPlay)
