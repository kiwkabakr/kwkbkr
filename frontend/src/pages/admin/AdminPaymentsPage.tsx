import { useCallback, useEffect, useMemo, useState } from 'react'
import { admin } from '../../api/client'
import { formatCryptoAmount } from '../../lib/formatCrypto'
import { formatPln } from '../../lib/formatPln'
import { triggerHaptic } from '../../lib/haptics'
import './AdminPaymentsPage.css'

type Payment = {
  _id: string
  telegramId: string
  type: 'deposit' | 'payout'
  currency: string
  amount: number
  /** PLN credited (deposits) or debited (payouts); missing on legacy deposit rows. */
  amountPln?: number
  depositAddress?: string
  userWalletAddress?: string
  status: 'pending' | 'confirmed' | 'completed' | 'failed'
  createdAt: string
}

function PaymentAmount({ p }: { p: Payment }) {
  if (!(p.amount > 0)) return <span className="admin-table__muted">—</span>

  const sign = p.type === 'deposit' ? '+' : '−'
  const plnValue = p.type === 'deposit' ? p.amountPln : p.amount
  const hasPln = plnValue != null && plnValue > 0
  const nativeLine = `${sign}${formatCryptoAmount(p.amount, p.currency)} ${p.currency}`

  return (
    <div className="admin-payments__amount">
      <span className="admin-payments__amount-pln">
        {hasPln ? `${sign}${formatPln(plnValue)}` : nativeLine}
      </span>
      {hasPln && p.type === 'deposit' && (
        <span className="admin-payments__amount-native">{nativeLine}</span>
      )}
      {!hasPln && p.type === 'deposit' && (
        <span className="admin-payments__amount-native admin-payments__amount-native--warn">
          legacy · PLN pending
        </span>
      )}
    </div>
  )
}

type Filter = 'all' | 'pending' | 'confirmed' | 'completed'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
]

export function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    try {
      const data = await admin.getPayments()
      setPayments(Array.isArray(data) ? data : [])
      setError(null)
    } catch {
      setError('Cannot reach API — make sure the backend is running.')
    }
  }, [])

  const handleBackfill = async () => {
    setBackfilling(true)
    setBackfillMsg(null)
    try {
      const r = await admin.backfillPln()
      setBackfillMsg(
        r.fixed === 0
          ? 'All deposits already have PLN values.'
          : `Fixed ${r.fixed} deposit(s). Reload page to see updated balances.`
      )
      void fetchPayments()
    } catch (err) {
      setBackfillMsg(err instanceof Error ? err.message : 'Backfill failed')
    } finally {
      setBackfilling(false)
    }
  }

  useEffect(() => {
    void fetchPayments()
    const id = setInterval(fetchPayments, 10_000)
    return () => clearInterval(id)
  }, [fetchPayments])

  const visible = useMemo(
    () => payments.filter(p => filter === 'all' || p.status === filter),
    [payments, filter]
  )

  const counts = useMemo(() => ({
    all: payments.length,
    pending: payments.filter(p => p.status === 'pending').length,
    confirmed: payments.filter(p => p.status === 'confirmed').length,
    completed: payments.filter(p => p.status === 'completed').length,
  }), [payments])

  const stats = useMemo(() => {
    let depositsPln = 0
    let payoutsPln = 0
    let pending = 0
    for (const p of payments) {
      if (p.status === 'pending') pending++
      if (p.type === 'deposit' && p.amountPln) depositsPln += p.amountPln
      if (p.type === 'payout' && p.amount) payoutsPln += p.amount
    }
    return { depositsPln, payoutsPln, pending, net: depositsPln - payoutsPln }
  }, [payments])

  return (
    <div className="admin-page admin-payments">
      <header className="admin-page__header">
        <div className="admin-page__header-left">
          <h1 className="admin-page__title">Payments</h1>
          <span className="admin-page__badge admin-page__badge--muted">{payments.length}</span>
          {counts.pending > 0 && (
            <span className="admin-page__badge">{counts.pending} pending</span>
          )}
        </div>
        <div className="admin-payments__header-actions">
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-payments__backfill-btn"
            disabled={backfilling}
            title="Recalculate PLN for legacy deposits that were saved before PLN conversion"
            onClick={() => { triggerHaptic('medium'); void handleBackfill() }}
          >
            {backfilling ? '…' : '⟳ Fix legacy PLN'}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => { triggerHaptic('light'); void fetchPayments() }}
          >
            {'\u21bb'} Refresh
          </button>
        </div>
      </header>

      <div className="admin-page__body admin-payments__body">
        <div className="admin-payments__stats">
          <div className="admin-payments__stat">
            <span className="admin-payments__stat-label">Deposits</span>
            <span className="admin-payments__stat-value admin-payments__stat-value--in">
              {formatPln(stats.depositsPln)}
            </span>
          </div>
          <div className="admin-payments__stat">
            <span className="admin-payments__stat-label">Payouts</span>
            <span className="admin-payments__stat-value admin-payments__stat-value--out">
              {formatPln(stats.payoutsPln)}
            </span>
          </div>
          <div className="admin-payments__stat">
            <span className="admin-payments__stat-label">Net</span>
            <span className="admin-payments__stat-value">{formatPln(stats.net)}</span>
          </div>
          <div className="admin-payments__stat">
            <span className="admin-payments__stat-label">Pending</span>
            <span className="admin-payments__stat-value">{stats.pending}</span>
          </div>
        </div>

        <div className="admin-payments__filters">
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

        {backfillMsg && (
          <div className="admin-payments__backfill-msg">{backfillMsg}</div>
        )}
        {error && <div className="admin-payments__error">{error}</div>}

        {visible.length === 0 ? (
          <div className="admin-payments__empty-wrap">
            <div className="admin-page__empty">
              <span className="admin-page__empty-icon">{'\u20bf'}</span>
              <p>No payments found</p>
            </div>
          </div>
        ) : (
          <div className="admin-payments__table-outer">
            <div className="admin-data-table-shell">
              <table className="admin-table admin-payments__table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Currency</th>
                    <th scope="col">Telegram</th>
                    <th scope="col" className="admin-table__cell--num">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Date</th>
                    <th scope="col">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(p => {
                    const addr = p.depositAddress || p.userWalletAddress || '—'
                    const addrLabel = p.depositAddress ? 'Deposit' : p.userWalletAddress ? 'Payout' : ''
                    return (
                      <tr
                        key={p._id}
                        className={p.status === 'pending' ? 'admin-payments__tr--pending' : undefined}
                      >
                        <td>
                          <span
                            className={[
                              'admin-payments__type',
                              p.type === 'deposit' ? 'admin-payments__type--in' : 'admin-payments__type--out',
                            ].join(' ').trim()}
                          >
                            {p.type === 'deposit' ? 'Deposit' : 'Payout'}
                          </span>
                        </td>
                        <td className="admin-table__mono">{p.currency}</td>
                        <td className="admin-table__mono">{p.telegramId}</td>
                        <td className="admin-table__cell--num admin-table__strong admin-payments__amount-cell">
                          <PaymentAmount p={p} />
                        </td>
                        <td>
                          <span className={`admin-status admin-status--${p.status}`}>{p.status}</span>
                        </td>
                        <td className="admin-table__muted admin-table__nowrap">
                          {new Date(p.createdAt).toLocaleString()}
                        </td>
                        <td className="admin-payments__addr-cell">
                          {addr !== '—' && (
                            <span className="admin-payments__addr-label">{addrLabel}</span>
                          )}
                          <code className="admin-payments__addr-code">{addr}</code>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
