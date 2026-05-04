/**
 * Express serves ../admin.html from the repo root; canonical admin UI is web/public/admin.html.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(webRoot, '..')
const src = path.join(webRoot, 'public', 'admin.html')
const dest = path.join(repoRoot, 'admin.html')

if (!fs.existsSync(src)) {
  console.error('[sync-admin-html-to-root] Missing', src)
  process.exit(1)
}
fs.copyFileSync(src, dest)
console.log('[sync-admin-html-to-root] Copied to', dest)
