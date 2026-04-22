import { useEffect, useRef, useState } from 'react'
import { useBets } from '../context/BetsContext'
import { triggerHaptic } from '../lib/haptics'
import { BetModal } from './BetModal'
import './BetSidebar.css'

function BoostOddsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.1576 2.87872C11.742 2.04384 12.9147 1.74205 13.8306 2.37181C14.7823 3.02616 16.428 4.29085 17.8444 6.06625C19.2602 7.84076 20.5 10.1941 20.5 12.9999C20.5 17.9973 16.7478 21.9999 12 21.9999C7.25223 21.9999 3.5 17.9973 3.5 12.9999C3.5 10.9645 4.37408 8.36394 6.07753 6.2877C6.82386 5.37804 8.11166 5.4323 8.86407 6.15513L11.1576 2.87872ZM12 19.9999C13.4497 19.9999 14.625 18.6584 14.625 17.0035C14.625 15.2278 13.2438 13.9216 12.4852 13.3381C12.1956 13.1153 11.8044 13.1153 11.5148 13.3381C10.7562 13.9216 9.375 15.2278 9.375 17.0035C9.375 18.6584 10.5503 19.9999 12 19.9999Z"
        fill="currentColor"
      />
    </svg>
  )
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return !!el.closest('[contenteditable="true"]')
}

export function BetSidebar() {
  const { bets, stake, setStake, removeBet } = useBets()
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const prevCountRef = useRef(bets.length)

  // Re-open whenever a new bet is added
  useEffect(() => {
    if (bets.length > prevCountRef.current) {
      setDismissed(false)
    }
    prevCountRef.current = bets.length
  }, [bets.length])

  const isOpen = bets.length > 0 && !dismissed

  useEffect(() => {
    if (!isOpen || showModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      triggerHaptic('medium')
      setShowModal(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, showModal])

  const combinedMultiplier = bets.reduce((acc, bet) => {
    const val = parseFloat(bet.option.multiplier.replace(',', '.').replace('x', ''))
    return acc * (isNaN(val) ? 1 : val)
  }, 1)

  const stakeNum = parseFloat(stake) || 0
  const potentialWin = stakeNum * combinedMultiplier

  const fmtMultiplier = (val: number) =>
    val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x'

  const fmtMoney = (val: number) =>
    val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <>
      <aside className={`bet-sidebar${isOpen ? ' bet-sidebar--open' : ''}`}>
        <div className="bet-sidebar__header">
          <h2 className="bet-sidebar__title">Twoje bety</h2>
          <span className="bet-sidebar__count">{bets.length}</span>
          <button
            type="button"
            className="bet-sidebar__close"
            aria-label="Zamknij"
            onClick={() => {
              triggerHaptic('light')
              setDismissed(true)
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="bet-sidebar__list">
          {bets.map((bet) => (
            <div key={bet.betId} className="bet-sidebar__item">
              <div className="bet-sidebar__item-row">
                <div className="bet-sidebar__item-avatar">
                  {bet.image && <img src={bet.image} alt="" />}
                </div>
                <p className="bet-sidebar__item-title">{bet.title}</p>
                <button
                  type="button"
                  className="bet-sidebar__item-remove"
                  onClick={() => {
                    triggerHaptic('selection')
                    removeBet(bet.betId)
                  }}
                  aria-label="Usuń"
                >
                  ×
                </button>
              </div>
              <div className="bet-sidebar__item-footer">
                <span className="bet-sidebar__item-option">{bet.option.label}</span>
                <div className="bet-sidebar__item-odds">
                  {bet.option.oldMultiplier && (
                    <span className="bet-sidebar__item-old-mult">{bet.option.oldMultiplier}</span>
                  )}
                  <span className="bet-sidebar__item-mult">{bet.option.multiplier}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bet-sidebar__footer">
          <div className="bet-sidebar__tip" role="status">
            <BoostOddsIcon className="bet-sidebar__tip-icon" />
            <p className="bet-sidebar__tip-text">Dodaj więcej wydarzeń, aby podbić kurs.</p>
          </div>

          <div className="bet-sidebar__stake-row">
            <div className="bet-sidebar__stake-field">
              <input
                className="bet-sidebar__stake-input"
                type="number"
                min="0"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder="Stawka"
                aria-label="Stawka w złotych"
              />
              <span className="bet-sidebar__stake-suffix" aria-hidden>
                zł
              </span>
            </div>
            <div className="bet-sidebar__combined-odds">
              <span className="bet-sidebar__combined-new">{fmtMultiplier(combinedMultiplier)}</span>
            </div>
          </div>

          <div className="bet-sidebar__win-row">
            <span className="bet-sidebar__win-label">Potencjalna wygrana:</span>
            <span className="bet-sidebar__win-amount">
              {fmtMoney(potentialWin)}{' '}
              <span className="bet-sidebar__win-currency">zł</span>
            </span>
          </div>

          <button
            type="button"
            className="bet-sidebar__cta"
            onClick={() => {
              triggerHaptic('medium')
              setShowModal(true)
            }}
          >
            Jak postawić
          </button>
        </div>
      </aside>

      {showModal && <BetModal onClose={() => setShowModal(false)} />}
    </>
  )
}
