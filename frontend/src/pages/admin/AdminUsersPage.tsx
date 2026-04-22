import { useCallback, useEffect, useMemo, useState } from 'react'
import { admin } from '../../api/client'
import { formatPln } from '../../lib/formatPln'
import { triggerHaptic } from '../../lib/haptics'
import './AdminUsersPage.css'

type User = {
  _id: string
  telegramId?: string
  username?: string
  firstName?: string
  balance?: number
  passkeyShown?: boolean
  createdAt?: string
  totalBets?: number
  wonBets?: number
  totalWagered?: number
  totalDeposited?: number
  totalWithdrawn?: number
}

function num(v: number | undefined | null): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function fmtMoney(v: number | undefined | null): string {
  return formatPln(num(v))
}

function initial(u: User): string {
  const src = u.firstName || u.username || u.telegramId || '?'
  return src.charAt(0).toUpperCase() || '?'
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const data = await admin.getUsers()
      setUsers(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      console.error('Failed to load users:', err)
      setError('Cannot reach API — make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.telegramId || '').includes(q)
    )
  }, [users, query])

  const totalBalance = useMemo(
    () => users.reduce((s, u) => s + num(u.balance), 0),
    [users]
  )

  const handleDelete = async (u: User) => {
    const label = u.firstName || u.username || u.telegramId || 'this user'
    if (
      !window.confirm(
        `Permanently delete ${label}? Their balance, bets, and payment records will be removed. This cannot be undone.`
      )
    ) {
      return
    }
    triggerHaptic('medium')
    setDeletingId(u._id)
    setError(null)
    try {
      await admin.deleteUser(u._id)
      setUsers(prev => prev.filter(x => x._id !== u._id))
    } catch (err) {
      console.error('Delete user failed:', err)
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="admin-page admin-users">
      <header className="admin-page__header">
        <div className="admin-page__header-left">
          <h1 className="admin-page__title">Users</h1>
          <span className="admin-page__badge admin-page__badge--muted">{users.length}</span>
          {totalBalance > 0 && (
            <span className="admin-page__badge">{fmtMoney(totalBalance)} held</span>
          )}
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => { triggerHaptic('light'); void fetchUsers() }}
        >
          {'\u21bb'} Refresh
        </button>
      </header>

      <div className="admin-page__toolbar">
        <input
          type="search"
          className="admin-search"
          placeholder="Search by name, @username or Telegram ID…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {error && <div className="admin-users__error">{error}</div>}

      {loading ? (
        <div className="admin-page__empty">
          <p>Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-page__empty">
          <span className="admin-page__empty-icon">{'\u25cc'}</span>
          <p>
            {users.length === 0
              ? 'No registered users yet. Users register via the Telegram bot.'
              : 'No users match your search.'}
          </p>
        </div>
      ) : (
        <div className="admin-page__body admin-users__body">
          <div className="admin-data-table-shell">
            <table className="admin-table admin-users__table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Handle</th>
                  <th scope="col" className="admin-table__cell--num">Balance</th>
                  <th scope="col">Joined</th>
                  <th scope="col" className="admin-table__cell--num">Bets</th>
                  <th scope="col" className="admin-table__cell--num">Won</th>
                  <th scope="col" className="admin-table__cell--num">Win %</th>
                  <th scope="col" className="admin-table__cell--num">Wagered</th>
                  <th scope="col" className="admin-table__cell--num">Deposited</th>
                  <th scope="col" className="admin-table__cell--num">Withdrawn</th>
                  <th scope="col">Telegram ID</th>
                  <th scope="col" className="admin-users__actions-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const totalBets = num(u.totalBets)
                  const wonBets = num(u.wonBets)
                  const winRate = totalBets ? (wonBets / totalBets) * 100 : null
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="admin-users__cell-user">
                          <span className="admin-avatar admin-users__table-avatar">{initial(u)}</span>
                          <span className="admin-users__table-name">{u.firstName || '—'}</span>
                        </div>
                      </td>
                      <td className="admin-table__muted">
                        {u.username ? `@${u.username}` : '—'}
                      </td>
                      <td className="admin-table__cell--num admin-table__strong">{fmtMoney(u.balance)}</td>
                      <td className="admin-table__muted admin-table__nowrap">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="admin-table__cell--num">{totalBets}</td>
                      <td className="admin-table__cell--num">{wonBets}</td>
                      <td className="admin-table__cell--num">
                        {winRate !== null ? `${winRate.toFixed(0)}%` : '—'}
                      </td>
                      <td className="admin-table__cell--num">{fmtMoney(u.totalWagered)}</td>
                      <td className="admin-table__cell--num">{fmtMoney(u.totalDeposited)}</td>
                      <td className="admin-table__cell--num">{fmtMoney(u.totalWithdrawn)}</td>
                      <td>
                        <code className="admin-users__tg-code">{u.telegramId ?? '—'}</code>
                      </td>
                      <td className="admin-users__actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger admin-users__delete"
                          disabled={deletingId === u._id}
                          onClick={() => void handleDelete(u)}
                        >
                          {deletingId === u._id ? '…' : 'Delete'}
                        </button>
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
  )
}
