import { useState } from 'react'
import { BetFormPanel } from '../../components/admin/BetFormPanel'
import { triggerHaptic } from '../../lib/haptics'
import { useAdmin, type AdminBet } from '../../context/AdminContext'
import './AdminBetsPage.css'

type Filter = 'all' | 'open' | 'pending' | 'resolved'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
]

export function AdminBetsPage() {
  const { bets } = useAdmin()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<AdminBet | null>(null)
  const [mode, setMode] = useState<'idle' | 'create' | 'edit'>('idle')

  const filtered = bets.filter(b => {
    const matchesFilter = filter === 'all' || b.status === filter
    const matchesQuery = b.title.toLowerCase().includes(query.toLowerCase())
    return matchesFilter && matchesQuery
  })

  const counts: Record<Filter, number> = {
    all: bets.length,
    open: bets.filter(b => b.status === 'open').length,
    pending: bets.filter(b => b.status === 'pending').length,
    resolved: bets.filter(b => b.status === 'resolved').length,
  }

  const handleSelect = (bet: AdminBet) => {
    triggerHaptic('selection')
    setSelected(bet)
    setMode('edit')
  }

  const handleNew = () => {
    triggerHaptic('medium')
    setSelected(null)
    setMode('create')
  }

  const handleSaved = (bet: AdminBet) => {
    setSelected(bet)
    setMode('edit')
  }

  const handleDeleted = () => {
    setSelected(null)
    setMode('idle')
  }

  const handleCancel = () => {
    setMode('idle')
    setSelected(null)
  }

  return (
    <div className="admin-split admin-bets">
      {/* Left: bet list */}
      <div className="admin-split__list">
        <div className="admin-page__header">
          <div className="admin-page__header-left">
            <h1 className="admin-page__title">Bets</h1>
            <span className="admin-page__badge admin-page__badge--muted">{bets.length}</span>
          </div>
          <button className="admin-btn admin-btn--primary" onClick={handleNew}>
            + New
          </button>
        </div>

        <div className="admin-bets__search">
          <input
            className="admin-search"
            type="text"
            placeholder="Search bets…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="admin-bets__filters">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              className={['admin-chip', filter === f.key ? 'admin-chip--active' : ''].join(' ').trim()}
              onClick={() => {
                triggerHaptic('selection')
                setFilter(f.key)
              }}
            >
              {f.label}
              <span className="admin-chip__count">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <div className="admin-bets__table-outer">
            <div className="admin-data-table-shell">
              <table className="admin-table admin-bets__table">
                <thead>
                  <tr>
                    <th scope="col">Bet</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(bet => {
                    const thumb = bet.banner ?? bet.pfp
                    const isActive = selected?.id === bet.id
                    const open = () => handleSelect(bet)
                    return (
                      <tr
                        key={bet.id}
                        className={isActive ? 'admin-bets__row--active' : undefined}
                        tabIndex={0}
                        role="button"
                        onClick={open}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            open()
                          }
                        }}
                      >
                        <td>
                          <div className="admin-bets__name-cell">
                            <div className="admin-thumb admin-bets__thumb-sm">
                              {thumb
                                ? <img src={thumb} alt="" />
                                : <span>{bet.title[0]}</span>
                              }
                              {bet.banner && bet.pfp && (
                                <img className="admin-thumb__overlay-pfp" src={bet.pfp} alt="" />
                              )}
                            </div>
                            <span className="admin-bets__title-txt">{bet.title}</span>
                          </div>
                        </td>
                        <td className="admin-table__muted admin-bets__cat-cell">
                          {bet.category || '—'}
                        </td>
                        <td>
                          <span className={`admin-status admin-status--${bet.status}`}>
                            {bet.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="admin-bets__empty">
            {bets.length === 0 ? 'No bets yet — create your first one.' : 'No bets match.'}
          </div>
        )}
      </div>

      {/* Right: form panel */}
      <div className="admin-split__main">
        <BetFormPanel
          key={mode === 'idle' ? 'idle' : mode === 'create' ? '__new__' : selected?.id}
          mode={mode}
          editBet={selected ?? undefined}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
