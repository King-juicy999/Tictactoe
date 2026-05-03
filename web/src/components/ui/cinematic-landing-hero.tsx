import React, { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { cn } from '@/lib/utils'

/** GSAP labels for click-to-advance through the post-intro timeline (see autoShowTl). */
const HERO_ANIM_SKIP_MARKERS = [
  'cardIn',
  'heroSkip_postExpand',
  'heroSkip_postMockup',
  'heroSkip_postBoard',
  'heroSkip_postSides',
  'heroSkip_postDetail',
  'heroSkip_ctaReveal',
  'heroSkip_pullbackDone',
] as const

export type AngelicGameOpponentMode = 'ai' | 'player'

export interface AngelicThresholdPayload {
  playerName: string
  mode: AngelicGameOpponentMode
}

export interface AngelicCinematicHeroProps
  extends React.HTMLAttributes<HTMLDivElement> {
  brandName?: string
  tagline1?: string
  tagline2?: string
  cardHeading?: string
  cardDescription?: React.ReactNode
  metricValue?: number
  metricLabel?: string
  ctaHeading?: string
  ctaDescription?: string
  /** Placeholder on the ritual name field under the CTA heading */
  namePlaceholder?: string
  ctaPrimaryLabel?: string
  ctaSecondaryLabel?: string
  defaultOpponentMode?: AngelicGameOpponentMode
  onEnterThreshold?: (payload: AngelicThresholdPayload) => void
}

export function AngelicCinematicHero({
  brandName = 'Angelic',
  tagline1 = 'An adaptive intelligence.',
  tagline2 = 'It never forgets.',
  cardHeading = 'Five wins. No mercy.',
  cardDescription = (
    <>
      <span className="text-white font-semibold">Angelic</span> is a
      psychological tic-tac-toe engine that learns your opening patterns,
      counters your strategy, and escalates with every loss. Power-ups. Camera
      anti-cheat. No second chances.
    </>
  ),
  metricValue = 5,
  metricLabel = 'Games · Level I',
  ctaHeading = 'Declare your name.',
  ctaDescription = 'Step through the threshold. The AI is already watching.',
  namePlaceholder = 'your name…',
  ctaPrimaryLabel = 'Enter the Threshold',
  ctaSecondaryLabel = 'Observe the Void',
  defaultOpponentMode = 'ai',
  onEnterThreshold,
  className,
  ...props
}: AngelicCinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mainCardRef = useRef<HTMLDivElement>(null)
  const mockupRef = useRef<HTMLDivElement>(null)
  const orbitalRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<number>(0)
  const introTlRef = useRef<gsap.core.Timeline | null>(null)
  const autoShowTlRef = useRef<gsap.core.Timeline | null>(null)
  const heroAnimSkipIdxRef = useRef(0)
  const [playerNameDraft, setPlayerNameDraft] = useState('')
  const [opponentMode, setOpponentMode] =
    useState<AngelicGameOpponentMode>(defaultOpponentMode)
  const [nameInvalid, setNameInvalid] = useState(false)

  function submitThreshold() {
    const trimmed = playerNameDraft.trim()
    if (!trimmed) {
      setNameInvalid(true)
      return
    }
    setNameInvalid(false)
    if (onEnterThreshold) {
      onEnterThreshold({ playerName: trimmed, mode: opponentMode })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function advanceHeroAnimOnClick(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = e.target as HTMLElement | null
    if (el?.closest('button, a, input, textarea, select, label')) return

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const intro = introTlRef.current
    const auto = autoShowTlRef.current
    if (!intro || !auto) return

    if (intro.progress() < 1) {
      intro.progress(1)
      return
    }

    let i = heroAnimSkipIdxRef.current
    const cur = auto.time()
    while (i < HERO_ANIM_SKIP_MARKERS.length) {
      const label = HERO_ANIM_SKIP_MARKERS[i]
      const tMark = auto.labels[label as string] as number | undefined
      i += 1
      if (typeof tMark === 'number' && tMark > cur + 0.05) {
        auto.tweenTo(label, { duration: 0.35, ease: 'power2.out' })
        break
      }
    }
    heroAnimSkipIdxRef.current = i
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(requestRef.current)

      requestRef.current = requestAnimationFrame(() => {
        if (mainCardRef.current && mockupRef.current) {
          const rect = mainCardRef.current.getBoundingClientRect()
          const mouseX = e.clientX - rect.left
          const mouseY = e.clientY - rect.top

          mainCardRef.current.style.setProperty('--mouse-x', `${mouseX}px`)
          mainCardRef.current.style.setProperty('--mouse-y', `${mouseY}px`)

          const xVal = (e.clientX / window.innerWidth - 0.5) * 2
          const yVal = (e.clientY / window.innerHeight - 0.5) * 2

          gsap.to(mockupRef.current, {
            rotationY: xVal * 12,
            rotationX: -yVal * 12,
            ease: 'power3.out',
            duration: 1.2,
          })
        }
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(requestRef.current)
    }
  }, [])

  /** Slow 3D ritual rings behind the name / path CTA — light on mobile, off when reduced-motion. */
  useEffect(() => {
    const root = orbitalRef.current
    if (!root) return
    const inner = root.querySelector('.cta-angelic-pfx-inner')
    if (!inner) return
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const mobile = window.innerWidth < 768
    const ctx = gsap.context(() => {
      gsap.to(inner, {
        rotationY: 360,
        rotationX: mobile ? 7 : 15,
        duration: mobile ? 46 : 34,
        repeat: -1,
        ease: 'none',
      })
      const ringB = inner.querySelector('.cta-angelic-pfx-ring--b')
      if (ringB) {
        gsap.to(ringB, {
          rotationZ: -360,
          duration: mobile ? 58 : 48,
          repeat: -1,
          ease: 'none',
        })
      }
    }, root)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const isMobile = window.innerWidth < 768
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    introTlRef.current = null
    autoShowTlRef.current = null
    heroAnimSkipIdxRef.current = 0

    /** First beat after intro typography: linger on headline view. */
    const HOLD_FIRST_VIEW_SEC = 2
    /** Mockup / copy board “reading window” beforename CTA. */
    const HOLD_CARD_DETAIL_SEC = 6

    const ctx = gsap.context(() => {
      gsap.set('.text-track-angelic', {
        autoAlpha: 0,
        y: 60,
        scale: 0.85,
        filter: 'blur(20px)',
        rotationX: -20,
      })
      gsap.set('.text-days-angelic', {
        autoAlpha: 1,
        clipPath: 'inset(0 100% 0 0)',
      })
      gsap.set('.main-card-angelic', {
        y: window.innerHeight + 200,
        autoAlpha: 1,
      })
      gsap.set(
        [
          '.card-left-text-angelic',
          '.card-right-text-angelic',
          '.mockup-scroll-wrapper-angelic',
          '.floating-badge-angelic',
          '.board-widget',
        ],
        { autoAlpha: 0 },
      )
      gsap.set('.cta-wrapper-angelic', {
        autoAlpha: 0,
        scale: 0.8,
        filter: 'blur(30px)',
      })

      if (prefersReduced) {
        gsap.set('.text-track-angelic', {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          rotationX: 0,
        })
        gsap.set('.text-days-angelic', { clipPath: 'inset(0 0% 0 0)' })
        gsap.set('.hero-text-wrapper-angelic', { autoAlpha: 0 })
        gsap.set('.main-card-angelic', { autoAlpha: 0, pointerEvents: 'none' })
        gsap.set('.cta-wrapper-angelic', {
          autoAlpha: 1,
          scale: 1,
          filter: 'blur(0px)',
        })
        return
      }

      const introTl = gsap.timeline({ delay: 0.3 })
      introTlRef.current = introTl
      introTl
        .to('.text-track-angelic', {
          duration: 1.8,
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          rotationX: 0,
          ease: 'expo.out',
        })
        .to(
          '.text-days-angelic',
          {
            duration: 1.4,
            clipPath: 'inset(0 0% 0 0)',
            ease: 'power4.inOut',
          },
          '-=1.0',
        )

      const autoShowTl = gsap.timeline({ paused: true })
      autoShowTlRef.current = autoShowTl

      autoShowTl
        .to({}, { duration: HOLD_FIRST_VIEW_SEC })
        .addLabel('cardIn')
        .to(
          ['.hero-text-wrapper-angelic', '.bg-grid-angelic'],
          {
            scale: 1.15,
            filter: 'blur(20px)',
            opacity: 0.2,
            ease: 'power2.inOut',
            duration: 2,
          },
          'cardIn',
        )
        .to(
          '.main-card-angelic',
          { y: 0, ease: 'power3.inOut', duration: 2 },
          'cardIn',
        )
        .to(
          '.main-card-angelic',
          {
            width: '100%',
            height: '100%',
            borderRadius: '0px',
            ease: 'power3.inOut',
            duration: 1.5,
          },
          '>',
        )
        .addLabel('heroSkip_postExpand', '+=0')
        .fromTo(
          '.mockup-scroll-wrapper-angelic',
          {
            y: 300,
            z: -500,
            rotationX: 50,
            rotationY: -30,
            autoAlpha: 0,
            scale: 0.6,
          },
          {
            y: 0,
            z: 0,
            rotationX: 0,
            rotationY: 0,
            autoAlpha: 1,
            scale: 1,
            ease: 'expo.out',
            duration: 2.5,
          },
          '-=0.8',
        )
        .addLabel('heroSkip_postMockup', '+=0')
        .fromTo(
          '.board-widget',
          { y: 40, autoAlpha: 0, scale: 0.95 },
          {
            y: 0,
            autoAlpha: 1,
            scale: 1,
            stagger: 0.15,
            ease: 'back.out(1.2)',
            duration: 1.5,
          },
          '-=1.5',
        )
        .addLabel('heroSkip_postBoard', '+=0')
        .to(
          '.progress-ring-angelic',
          { strokeDashoffset: 60, duration: 2, ease: 'power3.inOut' },
          '-=1.2',
        )
        .to(
          '.counter-val-angelic',
          {
            innerHTML: metricValue,
            snap: { innerHTML: 1 },
            duration: 2,
            ease: 'expo.out',
          },
          '-=2.0',
        )
        .fromTo(
          '.floating-badge-angelic',
          {
            y: 100,
            autoAlpha: 0,
            scale: 0.7,
            rotationZ: -10,
          },
          {
            y: 0,
            autoAlpha: 1,
            scale: 1,
            rotationZ: 0,
            ease: 'back.out(1.5)',
            duration: 1.5,
            stagger: 0.2,
          },
          '-=2.0',
        )
        .fromTo(
          '.card-left-text-angelic',
          { x: -50, autoAlpha: 0 },
          {
            x: 0,
            autoAlpha: 1,
            ease: 'power4.out',
            duration: 1.5,
          },
          '-=1.5',
        )
        .fromTo(
          '.card-right-text-angelic',
          { x: 50, autoAlpha: 0, scale: 0.8 },
          {
            x: 0,
            autoAlpha: 1,
            scale: 1,
            ease: 'expo.out',
            duration: 1.5,
          },
          '<',
        )
        .addLabel('heroSkip_postSides', '+=0')
        .to({}, { duration: HOLD_CARD_DETAIL_SEC })
        .addLabel('heroSkip_postDetail', '+=0')
        .set('.hero-text-wrapper-angelic', { autoAlpha: 0 })
        .set('.cta-wrapper-angelic', { autoAlpha: 1 })
        .addLabel('heroSkip_ctaReveal', '+=0')
        .to({}, { duration: 1.5 })
        .to(
          [
            '.mockup-scroll-wrapper-angelic',
            '.floating-badge-angelic',
            '.card-left-text-angelic',
            '.card-right-text-angelic',
          ],
          {
            scale: 0.9,
            y: -40,
            z: -200,
            autoAlpha: 0,
            ease: 'power3.in',
            duration: 1.2,
            stagger: 0.05,
          },
        )
        .to(
          '.main-card-angelic',
          {
            width: isMobile ? '92vw' : '85vw',
            height: isMobile ? '92vh' : '85vh',
            borderRadius: isMobile ? '32px' : '40px',
            ease: 'expo.inOut',
            duration: 1.8,
          },
          'pullback',
        )
        .to(
          '.cta-wrapper-angelic',
          {
            scale: 1,
            filter: 'blur(0px)',
            ease: 'expo.inOut',
            duration: 1.8,
          },
          'pullback',
        )
        .addLabel('heroSkip_pullbackDone', '+=0')
        .to('.main-card-angelic', {
          y: -window.innerHeight - 300,
          ease: 'power3.in',
          duration: 1.5,
        })

      introTl.eventCallback('onComplete', () => {
        autoShowTl.play(0)
      })
    }, containerRef)

    return () => {
      introTlRef.current = null
      autoShowTlRef.current = null
      ctx.revert()
    }
  }, [metricValue])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-screen h-screen overflow-hidden flex items-center justify-center antialiased',
        className,
      )}
      style={{
        perspective: '1500px',
        background:
          'radial-gradient(1200px 800px at 15% 0%, rgba(134,168,199,0.12) 0%, transparent 62%), radial-gradient(900px 600px at 85% 10%, rgba(200,169,110,0.10) 0%, transparent 58%), linear-gradient(180deg, #05060B 0%, #0B0E1E 100%)',
        fontFamily: "'Cormorant Garamond', serif",
        color: '#F2F0FF',
      }}
      onPointerDown={advanceHeroAnimOnClick}
      {...props}
    >
      <div className="film-grain" aria-hidden="true" />

      <div
        className="bg-grid-angelic absolute inset-0 z-0 pointer-events-none opacity-50"
        aria-hidden="true"
      />

      <div
        className="hero-text-wrapper-angelic absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 will-change-transform"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <p
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(0.6rem, 1.6vw, 0.72rem)',
            letterSpacing: '0.42em',
            textTransform: 'uppercase',
            color: '#C8A96E',
            marginBottom: '1rem',
            opacity: 0.9,
          }}
        >
          ∴ EST. IN THE VOID ∴
        </p>

        <h1
          className="text-track-angelic gsap-reveal text-3d-angelic"
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(3rem, 10vw, 6rem)',
            fontWeight: 900,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: '0.25rem',
          }}
        >
          {tagline1}
        </h1>

        <h1
          className="text-days-angelic gsap-reveal text-silver-angelic"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(2rem, 7vw, 4.5rem)',
            fontWeight: 700,
            fontStyle: 'italic',
            letterSpacing: '0.06em',
            marginBottom: '0',
          }}
        >
          {tagline2}
        </h1>
      </div>

      <div className="cta-wrapper-angelic pointer-events-auto absolute inset-0 z-10 flex max-h-[100dvh] w-screen flex-col overflow-hidden pt-[max(0.35rem,env(safe-area-inset-top))] pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center gsap-reveal will-change-transform">
        <div className="relative z-[3] flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-4 [-webkit-overflow-scrolling:touch]">
          <div
            ref={orbitalRef}
            className="cta-angelic-pfx pointer-events-none relative z-0 mx-auto mt-1 flex w-[min(88vw,420px)] max-h-[min(22vh,200px)] shrink-0 aspect-square items-center justify-center opacity-[0.42] sm:mt-2 sm:max-h-[min(28vh,260px)] sm:opacity-[0.52]"
            aria-hidden="true"
            style={{ perspective: '1100px' }}
          >
            <div className="cta-angelic-pfx-inner">
              <span className="cta-angelic-pfx-ring" />
              <span className="cta-angelic-pfx-ring cta-angelic-pfx-ring--b" />
              <span className="cta-angelic-pfx-ring cta-angelic-pfx-ring--c" />
            </div>
          </div>

          <div className="relative z-[3] flex w-full max-w-xl flex-col items-center pb-3 sm:max-w-2xl">
        <p
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(0.58rem,1.5vw,0.68rem)',
            letterSpacing: '0.38em',
            textTransform: 'uppercase',
            color: '#C8A96E',
            marginBottom: '0.55rem',
            opacity: 0.75,
          }}
        >
          ∴ EST. IN THE VOID ∴
        </p>

        <div className="void-divider" />

        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(1.35rem, 5.5vw, 2.85rem)',
            fontWeight: 900,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '0.45rem',
            lineHeight: 1.12,
          }}
          className="text-silver-angelic"
        >
          {ctaHeading}
        </h2>

        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 'clamp(0.88rem, 2.2vw, 1.15rem)',
            color: 'rgba(242,240,255,0.72)',
            marginBottom: '0.75rem',
            maxWidth: '34rem',
            lineHeight: 1.45,
          }}
        >
          {ctaDescription}
        </p>

        <div className="cta-name-block-angelic">
          <label className="cta-name-label-angelic" htmlFor="cta-player-name">
            Your name
          </label>
          <input
            id="cta-player-name"
            type="text"
            name="player-name"
            autoComplete="username"
            spellCheck={false}
            placeholder={namePlaceholder}
            value={playerNameDraft}
            aria-invalid={nameInvalid}
            aria-describedby={nameInvalid ? 'cta-name-error' : undefined}
            className={cn(
              'cta-name-input-angelic',
              nameInvalid && 'cta-name-input-invalid',
            )}
            onChange={(e) => {
              setPlayerNameDraft(e.target.value)
              if (nameInvalid && e.target.value.trim()) setNameInvalid(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitThreshold()
              }
            }}
          />
          {nameInvalid ? (
            <p id="cta-name-error" className="cta-inline-error-angelic" role="alert">
              Enter your name to proceed.
            </p>
          ) : null}
        </div>

        <p className="cta-mode-label-angelic mb-1 text-center">Choose your path</p>
        <div
          className="cta-mode-row-angelic !mb-3 sm:!mb-4"
          role="group"
          aria-label="Play against AI or another player"
        >
          <button
            type="button"
            className={cn(
              'cta-mode-card-angelic',
              opponentMode === 'ai' && 'cta-mode-card-selected-ai',
            )}
            aria-pressed={opponentMode === 'ai'}
            onClick={() => setOpponentMode('ai')}
          >
            <span className="cta-mode-card-title-angelic">Battle the AI</span>
            <span className="cta-mode-card-desc-angelic">
              Adaptive intelligence — learns your openings and escalates every loss.
            </span>
          </button>
          <button
            type="button"
            className={cn(
              'cta-mode-card-angelic',
              opponentMode === 'player' && 'cta-mode-card-selected-player',
            )}
            aria-pressed={opponentMode === 'player'}
            onClick={() => setOpponentMode('player')}
          >
            <span className="cta-mode-card-title-angelic">Mortal accord</span>
            <span className="cta-mode-card-desc-angelic">
              Face another player across the void — lobby matchmaking.
            </span>
          </button>
        </div>
          </div>
        </div>

        <div className="relative z-[5] flex w-full shrink-0 flex-col items-center gap-2 border-t border-[rgba(200,169,110,0.12)] bg-[linear-gradient(180deg,rgba(5,6,11,0.92)_0%,rgba(5,6,11,0.98)_100%)] px-4 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(0,0,0,0.35)] sm:flex-row sm:justify-center sm:gap-4 sm:py-3">
          <button
            type="button"
            className="btn-angelic-cta w-full max-w-xs sm:w-auto"
            aria-label={ctaPrimaryLabel}
            onClick={submitThreshold}
          >
            {ctaPrimaryLabel}
          </button>

          <button
            type="button"
            className="btn-angelic-secondary w-full max-w-xs sm:w-auto"
            aria-label={ctaSecondaryLabel}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            {ctaSecondaryLabel}
          </button>
        </div>
      </div>

      <div
        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
        style={{ perspective: '1500px' }}
      >
        <div
          ref={mainCardRef}
          className="main-card-angelic premium-depth-card-angelic relative overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]"
        >
          <div className="card-sheen-angelic" aria-hidden="true" />

          <svg
            className="card-sigil-bg"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <g fill="none" stroke="#C8A96E" strokeWidth="0.4">
              <circle cx="100" cy="100" r="88" opacity="0.5" />
              <circle cx="100" cy="100" r="72" opacity="0.6" />
              <circle cx="100" cy="100" r="56" opacity="0.7" />
              <circle cx="100" cy="100" r="40" opacity="0.8" />
              <circle cx="100" cy="100" r="24" opacity="0.9" />
              <line x1="100" y1="12" x2="100" y2="188" opacity="0.5" />
              <line x1="12" y1="100" x2="188" y2="100" opacity="0.5" />
              <line x1="34" y1="34" x2="166" y2="166" opacity="0.4" />
              <line x1="166" y1="34" x2="34" y2="166" opacity="0.4" />
              <polygon points="100,22 154,154 46,154" opacity="0.4" />
              <polygon points="100,178 46,46 154,46" opacity="0.35" />
            </g>
          </svg>

          <span className="ritual-card-corner ritual-card-corner-tl" aria-hidden="true" />
          <span className="ritual-card-corner ritual-card-corner-tr" aria-hidden="true" />
          <span className="ritual-card-corner ritual-card-corner-bl" aria-hidden="true" />
          <span className="ritual-card-corner ritual-card-corner-br" aria-hidden="true" />

          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-3 items-center lg:gap-8 z-10 py-6 lg:py-0">
            <div className="card-right-text-angelic gsap-reveal order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
              <h2
                className="text-card-silver-angelic"
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 'clamp(4rem, 10vw, 8rem)',
                  fontWeight: 900,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                {brandName}
              </h2>
            </div>

            <div
              className="mockup-scroll-wrapper-angelic order-2 lg:order-2 relative w-full h-[380px] lg:h-[600px] flex items-center justify-center z-10"
              style={{ perspective: '1000px' }}
            >
              <div className="relative w-full h-full flex items-center justify-center scale-[0.65] md:scale-[0.85] lg:scale-100">
                <div
                  ref={mockupRef}
                  className="board-mockup-bezel relative flex flex-col items-center justify-center will-change-transform"
                  style={{
                    width: '280px',
                    height: '380px',
                    borderRadius: '2rem',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <div
                    className="absolute flex flex-col items-center justify-center overflow-hidden"
                    style={{
                      inset: '8px',
                      background: '#05060B',
                      borderRadius: '1.6rem',
                      boxShadow: 'inset 0 0 20px rgba(0,0,0,1)',
                    }}
                  >
                    <div
                      className="absolute inset-0 screen-glare-angelic z-40 pointer-events-none"
                      aria-hidden="true"
                    />

                    <div className="board-widget absolute top-0 left-0 right-0 flex justify-between items-center px-5 pt-5 pb-2">
                      <div className="flex flex-col">
                        <span
                          style={{
                            fontSize: '0.6rem',
                            color: 'rgba(200,169,110,0.6)',
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            fontFamily: "'Cinzel',serif",
                          }}
                        >
                          Level I
                        </span>
                        <span
                          style={{
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            color: '#F2F0FF',
                            fontFamily: "'Cinzel',serif",
                          }}
                        >
                          Angelic
                        </span>
                      </div>
                      <div
                        style={{
                          width: '2.2rem',
                          height: '2.2rem',
                          borderRadius: '50%',
                          background: 'rgba(200,169,110,0.08)',
                          border: '1px solid rgba(200,169,110,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: "'Cinzel',serif",
                          fontSize: '0.55rem',
                          color: '#C8A96E',
                          letterSpacing: '0.05em',
                        }}
                      >
                        AI
                      </div>
                    </div>

                    <div
                      className="board-widget relative flex items-center justify-center my-3"
                      style={{ width: '140px', height: '140px' }}
                    >
                      <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                        <circle
                          cx="70"
                          cy="70"
                          r="56"
                          fill="none"
                          stroke="rgba(200,169,110,0.06)"
                          strokeWidth="10"
                        />
                        <circle
                          className="progress-ring-angelic"
                          cx="70"
                          cy="70"
                          r="56"
                          fill="none"
                          stroke="#C8A96E"
                          strokeWidth="10"
                        />
                      </svg>
                      <div className="text-center z-10 flex flex-col items-center">
                        <span
                          className="counter-val-angelic"
                          style={{
                            fontSize: '2.5rem',
                            fontWeight: 800,
                            fontFamily: "'Cinzel',serif",
                            color: '#C8A96E',
                          }}
                        >
                          0
                        </span>
                        <span
                          style={{
                            fontSize: '0.5rem',
                            color: 'rgba(200,169,110,0.45)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            fontFamily: "'Cinzel',serif",
                          }}
                        >
                          {metricLabel}
                        </span>
                      </div>
                    </div>

                    <div
                      className="board-widget"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3,1fr)',
                        gap: '6px',
                        padding: '0 1.25rem',
                        width: '100%',
                      }}
                    >
                      {[
                        { mark: 'X' },
                        { mark: '' },
                        { mark: 'O' },
                        { mark: '' },
                        { mark: 'X' },
                        { mark: '' },
                        { mark: 'O' },
                        { mark: '' },
                        { mark: 'X' },
                      ].map((cell, i) => (
                        <div
                          key={i}
                          className="cell-preview"
                          style={{ height: '46px', fontSize: '1.2rem' }}
                        >
                          <span
                            style={{
                              color:
                                cell.mark === 'X' ? '#C8A96E' : '#86A8C7',
                            }}
                          >
                            {cell.mark}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '80px',
                        height: '3px',
                        background: 'rgba(200,169,110,0.2)',
                        borderRadius: '999px',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="floating-badge-angelic absolute floating-ui-badge-angelic flex items-center gap-3 z-30"
                  style={{
                    top: '1.5rem',
                    left: '-1rem',
                    borderRadius: '14px',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <div
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      background: 'rgba(200,169,110,0.1)',
                      border: '1px solid rgba(200,169,110,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                    }}
                  >
                    🧠
                  </div>
                  <div>
                    <p
                      style={{
                        color: '#F2F0FF',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        fontFamily: "'Cinzel',serif",
                        letterSpacing: '0.05em',
                      }}
                    >
                      Adaptive AI
                    </p>
                    <p style={{ color: 'rgba(200,169,110,0.5)', fontSize: '0.65rem' }}>
                      Learns your patterns
                    </p>
                  </div>
                </div>

                <div
                  className="floating-badge-angelic absolute floating-ui-badge-angelic flex items-center gap-3 z-30"
                  style={{
                    bottom: '3rem',
                    right: '-1rem',
                    borderRadius: '14px',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <div
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      background: 'rgba(134,168,199,0.1)',
                      border: '1px solid rgba(134,168,199,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                    }}
                  >
                    ⚡
                  </div>
                  <div>
                    <p
                      style={{
                        color: '#F2F0FF',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        fontFamily: "'Cinzel',serif",
                        letterSpacing: '0.05em',
                      }}
                    >
                      Power-ups
                    </p>
                    <p style={{ color: 'rgba(134,168,199,0.5)', fontSize: '0.65rem' }}>
                      Hint · Shake · Last Stand
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-left-text-angelic gsap-reveal order-3 lg:order-1 flex flex-col justify-center text-center lg:text-left z-20 w-full lg:max-w-none px-4 lg:px-0">
              <h3
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 'clamp(1.25rem, 3vw, 2rem)',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: '#F2F0FF',
                  marginBottom: '0.75rem',
                }}
              >
                {cardHeading}
              </h3>

              <p
                className="hidden md:block"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: 'italic',
                  fontSize: 'clamp(0.95rem, 1.8vw, 1.15rem)',
                  color: 'rgba(242,240,255,0.7)',
                  lineHeight: 1.65,
                  maxWidth: '28rem',
                }}
              >
                {cardDescription}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
