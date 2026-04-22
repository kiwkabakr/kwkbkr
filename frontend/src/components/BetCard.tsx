import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBets } from '../context/BetsContext'
import { triggerHaptic } from '../lib/haptics'
import './BetCard.css'

export type BetOption = {
  label: string
  multiplier: string
  oldMultiplier?: string
  variant: 'primary' | 'secondary' | 'ghost'
}

export type BetCardProps = {
  betId?: string
  image?: string
  title: string
  date: string
  /** Main options only; typically up to two for the grid card */
  options: BetOption[]
}

const LOAD_MS = 700
const CONFIRM_MS = 380

function MorphSvg() {
  return (
    <svg className="bet-card__option-morph" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle className="opt-morph-circle" cx="12" cy="12" r="9" />
      <path className="opt-morph-check" d="M8 13L11 16L16 8" />
    </svg>
  )
}

export function BetCard({ betId, image, title, date, options }: BetCardProps) {
  const { toggleBet, isSelected } = useBets()
  const navigate = useNavigate()
  const id = betId ?? title

  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [confirmingLabel, setConfirmingLabel] = useState<string | null>(null)

  const handleClick = (opt: BetOption) => {
    if (loadingLabel) return
    triggerHaptic('selection')
    if (isSelected(id, opt.label)) {
      toggleBet({ betId: id, title, image, option: opt })
      return
    }
    setLoadingLabel(opt.label)
    window.setTimeout(() => {
      setLoadingLabel(null)
      setConfirmingLabel(opt.label)
      toggleBet({ betId: id, title, image, option: opt })
      window.setTimeout(() => setConfirmingLabel(null), CONFIRM_MS)
    }, LOAD_MS)
  }

  const triple = options.length >= 3

  return (
    <div
      className={['bet-card', triple ? 'bet-card--triple' : ''].join(' ').trim()}
      onClick={() => {
        triggerHaptic('medium')
        navigate(`/bet/${id}`)
      }}
    >
      <div className="bet-card__header">
        <div className="bet-card__avatar">
          {image
            ? <img src={image} alt="" className="bet-card__avatar-img" />
            : <span className="bet-card__avatar-placeholder" aria-hidden />
          }
        </div>
        <p className="bet-card__title">{title}</p>
      </div>

      <p className="bet-card__date">{date}</p>

      <div className="bet-card__options">
        {options.map((opt, i) => {
          const selected = isSelected(id, opt.label)
          const loading = loadingLabel === opt.label
          const confirming = confirmingLabel === opt.label
          return (
            <button
              key={`${opt.label}-${i}`}
              type="button"
              disabled={!!loadingLabel && !loading}
              aria-busy={loading}
              aria-pressed={selected}
              className={[
                'bet-card__option',
                `bet-card__option--${opt.variant}`,
                selected ? 'bet-card__option--selected' : '',
                loading ? 'bet-card__option--loading' : '',
                confirming ? 'bet-card__option--confirming' : '',
              ].join(' ').trim()}
              onClick={e => { e.stopPropagation(); handleClick(opt) }}
            >
              <span className="bet-card__option-inner">
                <span className="bet-card__option-label">{opt.label}</span>
                <span className="bet-card__option-mult">{opt.multiplier}</span>
              </span>
              <MorphSvg />
            </button>
          )
        })}
      </div>
    </div>
  )
}
