import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBets } from '../context/BetsContext'
import { triggerHaptic } from '../lib/haptics'
import type { ApiBet } from '../api/client'
import { filterMainOptions } from '../lib/betTiers'
import './FeaturedBetCarousel.css'

const RESET_COUNTDOWN_INITIAL_SEC = 7 * 60 + 32
const ODD_LOAD_MS = 1000
const ODD_CONFIRM_MS = 380

type OddId = string

type BetSlideState = {
  selected: OddId | null
  loading: OddId | null
  confirming: OddId | null
}

function oddVariantByIndex(index: number, total: number): 'primary' | 'accent' | 'ghost' {
  if (total === 2) return index === 0 ? 'primary' : 'ghost'
  if (index === 0) return 'primary'
  if (index === 1) return 'accent'
  return 'ghost'
}

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ResetDotsIcon() {
  return (
    <svg className="featured-bet__dots" xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden>
      <g className="featured-bet__dots-blend">
        <path className="featured-bet__dots-path featured-bet__dots-path--1" fillRule="evenodd" clipRule="evenodd" d="M1.6665 10.0002C1.6665 9.07966 2.4127 8.3335 3.33317 8.3335C4.25365 8.3335 4.99984 9.07966 4.99984 10.0002C4.99984 10.9207 4.25365 11.6668 3.33317 11.6668C2.4127 11.6668 1.6665 10.9207 1.6665 10.0002Z" fill="white" />
        <path className="featured-bet__dots-path featured-bet__dots-path--2" d="M16.6667 8.3335C15.7462 8.3335 15 9.07966 15 10.0002C15 10.9207 15.7462 11.6668 16.6667 11.6668C17.5872 11.6668 18.3333 10.9207 18.3333 10.0002C18.3333 9.07966 17.5872 8.3335 16.6667 8.3335Z" fill="white" />
        <path className="featured-bet__dots-path featured-bet__dots-path--3" d="M9.99967 8.3335C9.07917 8.3335 8.33301 9.07966 8.33301 10.0002C8.33301 10.9207 9.07917 11.6668 9.99967 11.6668C10.9202 11.6668 11.6663 10.9207 11.6663 10.0002C11.6663 9.07966 10.9202 8.3335 9.99967 8.3335Z" fill="white" />
      </g>
    </svg>
  )
}

function useLoopingCountdown(initialSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft(s => (s === 0 ? initialSeconds : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [initialSeconds])
  return secondsLeft
}

function StrikethroughOdds({ value, tone }: { value: string; tone: 'on-accent' | 'accent' | 'muted' }) {
  return (
    <span className={`featured-bet__strikethrough featured-bet__strikethrough--${tone}`}>
      <span className="featured-bet__strikethrough-text">{value}</span>
      <span className="featured-bet__strikethrough-line" aria-hidden />
    </span>
  )
}

type Props = { bets: ApiBet[] }

export function FeaturedBetCarousel({ bets }: Props) {
  const navigate = useNavigate()
  const { toggleBet, removeBet } = useBets()
  const secondsLeft = useLoopingCountdown(RESET_COUNTDOWN_INITIAL_SEC)
  const countdownLabel = formatCountdown(secondsLeft)
  const slideCount = bets.length || 1

  const [activeSlide, setActiveSlide] = useState(0)
  const [trackInstant, setTrackInstant] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)

  const [betBySlide, setBetBySlide] = useState<BetSlideState[]>(() =>
    Array.from({ length: Math.max(slideCount, 1) }, () => ({ selected: null, loading: null, confirming: null })),
  )

  useEffect(() => {
    setBetBySlide(Array.from({ length: Math.max(bets.length, 1) }, () => ({ selected: null, loading: null, confirming: null })))
  }, [bets.length])

  const advanceSlide = useCallback(() => {
    setActiveSlide(i => {
      if (i === slideCount - 1) {
        setTrackInstant(true)
        window.requestAnimationFrame(() => {
          setActiveSlide(0)
          window.requestAnimationFrame(() => setTrackInstant(false))
        })
        return i
      }
      return i + 1
    })
  }, [slideCount])

  useEffect(() => {
    const el = progressRef.current
    if (!el) return
    const onIter = () => advanceSlide()
    el.addEventListener('animationiteration', onIter)
    return () => el.removeEventListener('animationiteration', onIter)
  }, [advanceSlide, activeSlide])

  const goToSlide = (index: number) => {
    triggerHaptic('selection')
    setTrackInstant(false)
    setActiveSlide(Math.max(0, Math.min(slideCount - 1, index)))
  }

  const handleCardNavigate = (shortId: string) => {
    triggerHaptic('medium')
    navigate(`/bet/${shortId}`)
  }

  const handleCardKeyDown = (e: KeyboardEvent<HTMLElement>, shortId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      triggerHaptic('medium')
      navigate(`/bet/${shortId}`)
    }
  }

  const handleOddClickForSlide = (slideIndex: number, optionId: string) => {
    const slide = bets[slideIndex]
    if (!slide) return
    const currentBet = betBySlide[slideIndex]
    if (!currentBet) return

    triggerHaptic('selection')

    if (currentBet.selected === optionId) {
      setBetBySlide(prev => {
        const next = [...prev]
        next[slideIndex] = { selected: null, loading: null, confirming: null }
        return next
      })
      removeBet(`featured-${slideIndex}`)
      return
    }

    setBetBySlide(prev => {
      if (prev[slideIndex]?.loading !== null) return prev
      const next = [...prev]
      next[slideIndex] = { ...prev[slideIndex]!, loading: optionId }
      return next
    })

    window.setTimeout(() => {
      setBetBySlide(prev => {
        if (prev[slideIndex]?.loading !== optionId) return prev
        const next = [...prev]
        next[slideIndex] = { selected: optionId, loading: null, confirming: optionId }
        return next
      })
      const opt = slide.options.find(o => o.id === optionId)
      if (opt) {
        toggleBet({
          betId: `featured-${slideIndex}`,
          title: slide.title,
          image: slide.pfp ?? slide.banner,
          option: {
            label: opt.label,
            multiplier: `${opt.multiplier}x`,
            oldMultiplier: opt.oldMultiplier ? `${opt.oldMultiplier}x` : undefined,
            variant: 'primary',
          },
        })
      }
      window.setTimeout(() => {
        setBetBySlide(prev => {
          const next = [...prev]
          if (next[slideIndex]?.confirming === optionId) {
            next[slideIndex] = { ...next[slideIndex]!, confirming: null }
          }
          return next
        })
      }, ODD_CONFIRM_MS)
    }, ODD_LOAD_MS)
  }

  if (bets.length === 0) {
    return (
      <section className="featured-bet" aria-labelledby="featured-bet-heading">
        <div className="featured-bet__inner">
          <header className="featured-bet__header">
            <h2 id="featured-bet-heading" className="featured-bet__heading">Bety z najlepszym kursem</h2>
          </header>
        </div>
      </section>
    )
  }

  return (
    <section className="featured-bet" aria-labelledby="featured-bet-heading">
      <div className="featured-bet__inner">
        <header className="featured-bet__header">
          <h2 id="featured-bet-heading" className="featured-bet__heading">Bety z najlepszym kursem</h2>
          <div className="featured-bet__countdown-wrap">
            <ResetDotsIcon />
            <p className="featured-bet__countdown">
              <span className="featured-bet__countdown-label">Reset mnożników za </span>
              <span className="featured-bet__countdown-time">{countdownLabel}</span>
            </p>
          </div>
        </header>

        <article
          className="featured-bet__card"
          role="link"
          tabIndex={0}
          aria-label="Przejdź do strony zakładu"
          onClick={() => bets[activeSlide] && handleCardNavigate(bets[activeSlide].shortId)}
          onKeyDown={e => bets[activeSlide] && handleCardKeyDown(e, bets[activeSlide].shortId)}
        >
          <div className="featured-bet__slides-viewport">
            <div
              className={`featured-bet__slides-track${trackInstant ? ' featured-bet__slides-track--instant' : ''}`}
              style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            >
              {bets.map((slide, slideIndex) => {
                const bet = betBySlide[slideIndex] ?? { selected: null, loading: null, confirming: null }
                const carouselOptions = filterMainOptions(slide.options).slice(0, 3)
                const heroSrc = slide.banner
                return (
                  <div key={slide._id} className="featured-bet__slide" aria-hidden={slideIndex !== activeSlide}>
                    <div className="featured-bet__media">
                      <div className="featured-bet__media-layers" aria-hidden>
                        {heroSrc && <img className="featured-bet__img featured-bet__img--base" src={heroSrc} alt="" />}
                      </div>
                      <div className="featured-bet__media-shade" aria-hidden />
                      <div className="featured-bet__date-badge">
                        {new Date(slide.date).toLocaleDateString('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>

                    <h3 className="featured-bet__title" title={slide.title}>{slide.title}</h3>

                    <div className="featured-bet__odds">
                      {carouselOptions.map((opt, oddIndex) => {
                        const v = oddVariantByIndex(oddIndex, carouselOptions.length)
                        const isLoading = bet.loading === opt.id
                        const isSelected = bet.selected === opt.id
                        const isConfirming = bet.confirming === opt.id

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={[
                              'featured-bet__odd',
                              `featured-bet__odd--${v}`,
                              isSelected ? 'featured-bet__odd--selected' : '',
                              isLoading ? 'featured-bet__odd--loading' : '',
                              isConfirming ? 'featured-bet__odd--confirming' : '',
                            ].join(' ').trim()}
                            onClick={e => { e.stopPropagation(); handleOddClickForSlide(slideIndex, opt.id) }}
                            disabled={bet.loading !== null || bet.confirming !== null}
                            aria-busy={isLoading}
                            aria-pressed={isSelected}
                          >
                            <span className="featured-bet__odd-body">
                              <span className={`featured-bet__odd-name featured-bet__odd-name--${v === 'primary' ? 'dark' : v === 'accent' ? 'lime' : 'white'}`}>
                                {opt.label}
                              </span>
                              <span className={`featured-bet__odd-inner${v === 'accent' ? ' featured-bet__odd-inner--tint' : ''}`}>
                                {opt.oldMultiplier && (
                                  <StrikethroughOdds
                                    value={`${opt.oldMultiplier}x`}
                                    tone={v === 'primary' ? 'on-accent' : v === 'accent' ? 'accent' : 'muted'}
                                  />
                                )}
                                <span className={`featured-bet__odd-mult featured-bet__odd-mult--${v === 'primary' ? 'dark' : v === 'accent' ? 'lime' : 'white'}`}>
                                  {opt.multiplier}x
                                </span>
                              </span>
                            </span>
                            <span className="featured-bet__odd-loader">
                              <svg className="featured-bet__odd-morph" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                                <circle className="opt-morph-circle" cx="12" cy="12" r="9" />
                                <path className="opt-morph-check" d="M8 13L11 16L16 8" />
                              </svg>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </article>

        <div className="featured-bet__pager" role="tablist" aria-label="Slajdy karuzeli">
          {Array.from({ length: slideCount }, (_, i) =>
            i === activeSlide ? (
              <div
                key={`pill-${i}`}
                className="featured-bet__pager-active"
                role="tab"
                aria-selected
                tabIndex={0}
                aria-label={`Slajd ${i + 1} z ${slideCount}`}
              >
                <div ref={progressRef} className="featured-bet__pager-progress" aria-hidden />
              </div>
            ) : (
              <button
                key={`dot-${i}`}
                type="button"
                className="featured-bet__pager-dot"
                role="tab"
                aria-selected={false}
                tabIndex={-1}
                aria-label={`Slajd ${i + 1} z ${slideCount}`}
                onClick={() => goToSlide(i)}
              />
            ),
          )}
        </div>
      </div>
    </section>
  )
}
