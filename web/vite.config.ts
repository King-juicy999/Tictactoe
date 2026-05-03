import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Repo-root game (Vanilla index.html + script.js) — same-origin under `/play/` so SPA can hand off via sessionStorage.
 * Use `/play/index.html`; prefer this over hosting the standalone file from another origin.
 */
function legacyPlayPlugin(): Plugin {
  const repoRoot = path.resolve(__dirname, '..')
  return {
    name: 'legacy-play-repo-root',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url || '').split('?')[0]
        if (pathOnly === '/game-static' || pathOnly.startsWith('/game-static/')) {
          const rest =
            pathOnly === '/game-static'
              ? '/index.html'
              : pathOnly.slice('/game-static'.length)
          const loc = '/play' + (rest.startsWith('/') ? rest : `/${rest}`)
          res.statusCode = 302
          res.setHeader('Location', loc)
          res.end()
          return
        }
        next()
      })
      server.middlewares.use('/play', sirv(repoRoot, { dev: true }))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url || '').split('?')[0]
        if (pathOnly === '/game-static' || pathOnly.startsWith('/game-static/')) {
          const rest =
            pathOnly === '/game-static'
              ? '/index.html'
              : pathOnly.slice('/game-static'.length)
          const loc = '/play' + (rest.startsWith('/') ? rest : `/${rest}`)
          res.statusCode = 302
          res.setHeader('Location', loc)
          res.end()
          return
        }
        next()
      })
      server.middlewares.use('/play', sirv(repoRoot, { dev: true }))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), legacyPlayPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
