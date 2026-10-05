'use client'

import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

const BOOT_LINES = [
  '> booting stefanos.dev',
  '> loading profile: Stefanos Georgiou',
  '> role: Backend Engineer (Java / Spring Boot)',
  '> mounting <PortfolioScene />... done',
  '> engine: ready_',
]

const CHAR_DELAY_MS = 20
const LINE_PAUSE_MS = 200
const FADE_OUT_MS = 400

// Placeholders — swap in the real profile URLs.
const GITHUB_URL = 'https://github.com/Ogstef'
const LINKEDIN_URL = 'https://www.linkedin.com/in/stefanos-georgiou13'

type Props = {
  engineStarted: boolean
  onStart: () => void
}

export default function BootSequence({ engineStarted, onStart }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [typedLines, setTypedLines] = useState<string[]>([])
  const [typingComplete, setTypingComplete] = useState(false)
  const [visible, setVisible] = useState(true)
  const skipRef = useRef<(() => void) | null>(null)

  // Reduced-motion visitors skip the typewriter entirely — the effect below
  // only drives the async animation, so it's a no-op when this is true.
  const typingDone = prefersReducedMotion || typingComplete
  const lines = prefersReducedMotion ? BOOT_LINES : typedLines

  // Start downloading environment models behind the intro. Dynamic import
  // keeps drei/three out of the first-load bundle.
  useEffect(() => {
    import('@/lib/envAssets').then((m) => m.preloadEnvAssets())
  }, [])

  useEffect(() => {
    if (prefersReducedMotion || typingComplete) return

    let cancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const finishInstantly = () => {
      if (cancelled) return
      cancelled = true
      timeouts.forEach(clearTimeout)
      setTypedLines(BOOT_LINES)
      setTypingComplete(true)
    }
    skipRef.current = finishInstantly

    async function type() {
      for (let lineIndex = 0; lineIndex < BOOT_LINES.length; lineIndex++) {
        const fullLine = BOOT_LINES[lineIndex]
        for (let charIndex = 1; charIndex <= fullLine.length; charIndex++) {
          if (cancelled) return
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, CHAR_DELAY_MS)
            timeouts.push(t)
          })
          if (cancelled) return
          setTypedLines((prev) => {
            const next = [...prev]
            next[lineIndex] = fullLine.slice(0, charIndex)
            return next
          })
        }
        if (cancelled) return
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, LINE_PAUSE_MS)
          timeouts.push(t)
        })
      }
      if (!cancelled) {
        cancelled = true
        setTypingComplete(true)
      }
    }

    void type()

    return () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
    }
  }, [prefersReducedMotion, typingComplete])

  useEffect(() => {
    if (!engineStarted) return
    const t = setTimeout(() => setVisible(false), FADE_OUT_MS)
    return () => clearTimeout(t)
  }, [engineStarted])

  useEffect(() => {
    if (typingDone) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') skipRef.current?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [typingDone])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-[#0d0d1a] font-mono text-white transition-opacity duration-[400ms] ${
        engineStarted ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={() => skipRef.current?.()}
    >
      <div className="w-full max-w-xl px-6">
        {!typingDone ? (
          <pre className="whitespace-pre-wrap text-sm text-emerald-400/90 sm:text-base">
            {lines.join('\n')}
            <span className="animate-pulse">▍</span>
          </pre>
        ) : (
          <div className="flex flex-col items-center gap-6 text-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Stefanos Georgiou</h1>
              <p className="mt-2 text-sm text-white/60 sm:text-base">
                Backend Java/Spring Boot engineer — 3D driveable project showcase
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onStart()
              }}
              className="rounded-md bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              Start Engine →
            </button>
            <div className="flex items-center gap-4">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                onClick={(e) => e.stopPropagation()}
                className="text-white/60 transition-colors hover:text-white"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.775.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                onClick={(e) => e.stopPropagation()}
                className="text-white/60 transition-colors hover:text-white"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
