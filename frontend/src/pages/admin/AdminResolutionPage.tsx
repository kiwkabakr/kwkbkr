import { useState } from 'react'
import { useAdmin, type AdminBet, type AdminBetOption } from '../../context/AdminContext'
import { triggerHaptic } from '../../lib/haptics'
import './AdminResolutionPage.css'

type Tab = 'live' | 'pending' | 'resolved'
type LocalResults = Record<string, Record<string, 'won' | 'lost' | undefined>>

const TABS: { key: Tab; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
]

export function AdminResolutionPage() {
  const { bets, resolveBet } = useAdmin()
  const [tab, setTab] = useState<Tab>('pending')
  const [localResults, setLocalResults] = useState<LocalResults>({})
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [resolving, setResolving] = useState<string | null>(null)

  const visibleBets = bets.filter(b => {
    if (tab === 'resolved') return b.status === 'resolved'
    if (tab === 'pending') return b.status === 'pending'
    return b.status === 'open'
  })

  const counts: Record<Tab, number> = {
    live: bets.filter(b => b.status === 'open').length,
    pending: bets.filter(b => b.status === 'pending').length,
    resolved: bets.filter(b => b.status === 'resolved').length,
  }

  const toggleResult = (betId: string, optId: string, result: 'won' | 'lost') => {
    triggerHaptic('selection')
    setLocalResults(prev => {
      const betMap = { ...(prev[betId] ?? {}) }
      betMap[optId] = betMap[optId] === result ? undefined : result
      return { ...prev, [betId]: betMap }
    })
  }

  const getResult = (betId: string, optId: string) =>
    localResults[betId]?.[optId]

  const canConfirm = (bet: AdminBet) => {
    const map = localResults[bet.id] ?? {}
    const hasWon = bet.options.some(o => map[o.id] === 'won')
    const allSet = bet.options.every(o => map[o.id] !== undefined)
    return hasWon && allSet
  }

  const progressFor = (bet: AdminBet) => {
    const map = localResults[bet.id] ?? {}
    const set = bet.options.filter(o => map[o.id] !== undefined).length
    return { set, total: bet.options.length }
  }

  const handleConfirm = async (bet: AdminBet) => {
    triggerHaptic('medium')
    const map = localResults[bet.id] ?? {}
    const results: Record<string, 'won' | 'lost'> = {}
    bet.options.forEach(o => { results[o.id] = map[o.id] ?? 'lost' })
    setResolving(bet.id)
    try {
      await resolveBet(bet.id, results)
      setConfirmed(prev => new Set(prev).add(bet.id))
    } catch (err) {
      console.error('Resolution failed:', err)
    } finally {
      setResolving(null)
    }
  }

  const getOptionResult = (bet: AdminBet, opt: AdminBetOption) =>
    tab === 'resolved' ? opt.result : getResult(bet.id, opt.id)

  const showActions = tab !== 'resolved'

  return (
    <div className="admin-page admin-resolution">
      <header className="admin-page__header">
        <div className="admin-page__header-left">
          <h1 className="admin-page__title">Resolution</h1>
          <span className="admin-page__badge admin-page__badge--muted">{visibleBets.length}</span>
        </div>
        <div className="admin-resolution__tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={['admin-chip', tab === t.key ? 'admin-chip--active' : ''].join(' ').trim()}
              onClick={() => {
                triggerHaptic('selection')
                setTab(t.key)
              }}
            >
              {t.label}
              <span className="admin-chip__count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="admin-page__body admin-resolution__body">
        {visibleBets.length === 0 ? (
          <div className="admin-resolution__empty-wrap">
            <div className="admin-page__empty">
              <span className="admin-page__empty-icon">
                {tab === 'live' ? '\u25CB' : tab === 'pending' ? '\u25C6' : '\u2713'}
              </span>
              <p>
                {tab === 'live' && 'No live bets — all open markets are still accepting wagers.'}
                {tab === 'pending' && 'No bets waiting for resolution — deadlines may not have passed yet.'}
                {tab === 'resolved' && 'No resolved bets yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="admin-data-table-shell admin-resolution__shell">
            <div className="admin-resolution__list">
              {visibleBets.map(bet => {
                const isConfirmed = confirmed.has(bet.id)
                const isResolving = resolving === bet.id
                const thumb = bet.banner ?? bet.pfp
                const { set, total } = progressFor(bet)
                const ready = canConfirm(bet)

                return (
                  <article
                    key={bet.id}
                    className={[
                      'admin-resolution__card',
                      isConfirmed ? 'admin-resolution__card--confirmed' : '',
                    ].join(' ').trim()}
                  >
                    <header className="admin-resolution__card-header">
                      <div className="admin-thumb">
                        {thumb
                          ? <img src={thumb} alt="" />
                          : <span>{bet.title[0]}</span>
                        }
                        {bet.banner && bet.pfp && (
                          <img className="admin-thumb__overlay-pfp" src={bet.pfp} alt="" />
                        )}
                      </div>
                      <div className="admin-resolution__card-meta">
                        <p className="admin-resolution__card-title">{bet.title}</p>
                        <div className="admin-resolution__card-sub">
                          {bet.category && (
                            <span className="admin-resolution__card-cat">{bet.category}</span>
                          )}
                          <code className="admin-resolution__card-id">{bet.shortId}</code>
                          <span className={`admin-status admin-status--${bet.status}`}>{bet.status}</span>
                        </div>
                      </div>
                    </header>

                    {bet.settlementRules && (
                      <div className="admin-resolution__rules">
                        <span className="admin-resolution__rules-label">Rules</span>
                        <p>{bet.settlementRules}</p>
                      </div>
                    )}

                    <div className="admin-resolution__options">
                      {bet.options.map(opt => {
                        const result = getOptionResult(bet, opt)
                        return (
                          <div
                            key={opt.id}
                            className={[
                              'admin-resolution__option',
                              result === 'won' ? 'admin-resolution__option--won' : '',
                              result === 'lost' ? 'admin-resolution__option--lost' : '',
                            ].join(' ').trim()}
                          >
                            <div className="admin-resolution__option-left">
                              <span className="admin-resolution__option-label">{opt.label}</span>
                              <span className="admin-resolution__option-mult">{opt.multiplier}x</span>
                            </div>

                            {showActions && !isConfirmed ? (
                              <div className="admin-resolution__option-toggles">
                                <button
                                  type="button"
                                  className={[
                                    'admin-resolution__toggle',
                                    'admin-resolution__toggle--won',
                                    result === 'won' ? 'admin-resolution__toggle--active' : '',
                                  ].join(' ').trim()}
                                  onClick={() => toggleResult(bet.id, opt.id, 'won')}
                                >
                                  Won
                                </button>
                                <button
                                  type="button"
                                  className={[
                                    'admin-resolution__toggle',
                                    'admin-resolution__toggle--lost',
                                    result === 'lost' ? 'admin-resolution__toggle--active' : '',
                                  ].join(' ').trim()}
                                  onClick={() => toggleResult(bet.id, opt.id, 'lost')}
                                >
                                  Lost
                                </button>
                              </div>
                            ) : (
                              <span
                                className={[
                                  'admin-resolution__result-badge',
                                  result === 'won' ? 'admin-resolution__result-badge--won' : '',
                                  result === 'lost' ? 'admin-resolution__result-badge--lost' : '',
                                ].join(' ').trim()}
                              >
                                {result ?? '—'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {showActions && (
                      <footer className="admin-resolution__card-footer">
                        <span className={[
                          'admin-resolution__status',
                          isConfirmed ? 'admin-resolution__status--success' : '',
                          ready && !isConfirmed ? 'admin-resolution__status--ready' : '',
                        ].join(' ').trim()}>
                          {isConfirmed
                            ? 'Resolved — balances settled'
                            : ready
                            ? 'Ready to confirm'
                            : `${set} of ${total} options set`}
                        </span>
                        <button
                          type="button"
                          className={[
                            'admin-btn',
                            ready && !isConfirmed ? 'admin-btn--primary' : 'admin-btn--ghost',
                            'admin-resolution__confirm-btn',
                          ].join(' ').trim()}
                          onClick={() => !isConfirmed && handleConfirm(bet)}
                          disabled={!ready || isConfirmed || isResolving}
                        >
                          {isResolving ? 'Resolving\u2026' : isConfirmed ? '\u2713 Resolved' : 'Confirm resolution'}
                        </button>
                      </footer>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
