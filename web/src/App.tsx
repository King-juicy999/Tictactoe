import { useEffect } from 'react'
import {
  AngelicCinematicHero,
  type AngelicThresholdPayload,
} from '@/components/ui/cinematic-landing-hero'

/** Same-origin legacy shell (sirv-mounted repo root; see vite.config legacyPlayPlugin). */
const legacyGameHref = `${import.meta.env.BASE_URL.replace(/\/?$/, '')}/play/index.html`

/** Where `/play/...` should return on reload (SPA root for this deployment). */
function persistSpaHomeHref() {
  try {
    const baseRaw =
      typeof import.meta.env.BASE_URL === 'string' && import.meta.env.BASE_URL !== ''
        ? import.meta.env.BASE_URL
        : '/'
    const u = new URL(baseRaw, window.location.href)
    const path = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`
    sessionStorage.setItem('angelic_spa_home_href', path === '' ? '/' : path)
  } catch (_) {
    try {
      sessionStorage.setItem('angelic_spa_home_href', '/')
    } catch (_) {}
  }
}

export default function App() {
  useEffect(() => {
    persistSpaHomeHref()
  }, [])

  const handleEnterThreshold = ({ playerName }: AngelicThresholdPayload) => {
    const payload = { playerName, ts: Date.now() }
    const raw = JSON.stringify(payload)
    persistSpaHomeHref()
    try {
      sessionStorage.setItem('angelic_spa_launch', raw)
    } catch (_) {}
    try {
      sessionStorage.setItem('angelic_spa_skip_void', '1')
    } catch (_) {}
    try {
      sessionStorage.setItem('angelic_cinematic_gate', raw)
    } catch (_) {}
    window.location.assign(legacyGameHref)
  }

  return (
    <div
      className="overflow-x-hidden w-full min-h-screen"
      style={{ background: '#05060B' }}
    >
      <AngelicCinematicHero onEnterThreshold={handleEnterThreshold} />
    </div>
  )
}
