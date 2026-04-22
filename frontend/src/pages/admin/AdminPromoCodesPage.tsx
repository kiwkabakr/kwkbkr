import { useCallback, useEffect, useState } from 'react'
import { admin, type ApiPromoCode } from '../../api/client'
import { formatPln } from '../../lib/formatPln'
import { triggerHaptic } from '../../lib/haptics'
import './AdminPromoCodesPage.css'

type FormState = {
  code: string
  amountPln: string
  usesLimit: string
  minDepositPln: string
  minWageredPln: string
  expiresAt: string
}

const EMPTY_FORM: FormState = {
  code: '',
  amountPln: '',
  usesLimit: '',
  minDepositPln: '',
  minWageredPln: '',
  expiresAt: '',
}

function fmtDate(v?: string): string {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return v
  }
}

export function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<ApiPromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchCodes = useCallback(async () => {
    try {
      const data = await admin.getPromoCodes()
      setCodes(Array.isArray(data) ? data : [])
      setError(null)
    } catch {
      setError('Cannot reach API — make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchCodes() }, [fetchCodes])

  const handleCreate = async () => {
    const amount = Number(form.amountPln)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount (PLN) must be a positive number.')
      return
    }
    triggerHaptic('medium')
    setCreating(true)
    setError(null)
    try {
      await admin.createPromoCode({
        code: form.code.trim() || undefined,
        amountPln: amount,
        usesLimit: form.usesLimit.trim() ? Math.max(0, Math.floor(Number(form.usesLimit))) : 0,
        minDepositPln: form.minDepositPln.trim() ? Math.max(0, Number(form.minDepositPln)) : 0,
        minWageredPln: form.minWageredPln.trim() ? Math.max(0, Number(form.minWageredPln)) : 0,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      })
      setForm(EMPTY_FORM)
      await fetchCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create code')
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (c: ApiPromoCode) => {
    triggerHaptic('light')
    setBusyId(c._id)
    try {
      await admin.updatePromoCode(c._id, { enabled: !c.enabled })
      await fetchCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (c: ApiPromoCode) => {
    if (!window.confirm(`Delete code "${c.code}"? This cannot be undone.`)) return
    triggerHaptic('medium')
    setBusyId(c._id)
    try {
      await admin.deletePromoCode(c._id)
      setCodes(prev => prev.filter(x => x._id !== c._id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-page admin-codes">
      <header className="admin-page__header">
        <div className="admin-page__header-left">
          <h1 className="admin-page__title">Promo Codes</h1>
          <span className="admin-page__badge admin-page__badge--muted">{codes.length}</span>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => { triggerHaptic('light'); void fetchCodes() }}
        >
          {'\u21bb'} Refresh
        </button>
      </header>

      <div className="admin-codes__form">
        <div className="admin-field">
          <label className="admin-label">Code (optional)</label>
          <input
            className="admin-input"
            type="text"
            placeholder="Auto-generated if blank"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Amount (PLN)</label>
          <input
            className="admin-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="10.00"
            value={form.amountPln}
            onChange={e => setForm(f => ({ ...f, amountPln: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Uses limit</label>
          <input
            className="admin-input"
            type="number"
            min="0"
            step="1"
            placeholder="0 = unlimited"
            value={form.usesLimit}
            onChange={e => setForm(f => ({ ...f, usesLimit: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Min deposit (PLN)</label>
          <input
            className="admin-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.minDepositPln}
            onChange={e => setForm(f => ({ ...f, minDepositPln: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Min wagered (PLN)</label>
          <input
            className="admin-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.minWageredPln}
            onChange={e => setForm(f => ({ ...f, minWageredPln: e.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Expires at</label>
          <input
            className="admin-input"
            type="datetime-local"
            value={form.expiresAt}
            onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
          />
        </div>
        <p className="admin-codes__hint">
          Every code requires the redeemer to have made at least one confirmed deposit.
          Set additional min-deposit or min-wagered thresholds to gate bigger bonuses.
        </p>
        <div className="admin-codes__form-actions">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={creating || !form.amountPln}
            onClick={() => void handleCreate()}
          >
            {creating ? 'Creating…' : '+ Create code'}
          </button>
        </div>
      </div>

      {error && <div className="admin-codes__error">{error}</div>}

      {loading ? (
        <div className="admin-page__empty"><p>Loading…</p></div>
      ) : codes.length === 0 ? (
        <div className="admin-page__empty">
          <span className="admin-page__empty-icon">{'\u25cc'}</span>
          <p>No codes yet — create one above.</p>
        </div>
      ) : (
        <div className="admin-page__body admin-codes__body">
          <div className="admin-data-table-shell">
            <table className="admin-table admin-codes__table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col" className="admin-table__cell--num">Amount</th>
                  <th scope="col" className="admin-table__cell--num">Uses</th>
                  <th scope="col" className="admin-table__cell--num">Min deposit</th>
                  <th scope="col" className="admin-table__cell--num">Min wagered</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="admin-codes__actions-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c._id}>
                    <td><span className="admin-codes__code">{c.code}</span></td>
                    <td className="admin-table__cell--num admin-table__strong">{formatPln(c.amountPln)}</td>
                    <td className="admin-table__cell--num admin-codes__uses">
                      {c.usesCount}{c.usesLimit > 0 ? ` / ${c.usesLimit}` : ''}
                    </td>
                    <td className="admin-table__cell--num">
                      {c.minDepositPln > 0 ? formatPln(c.minDepositPln) : '—'}
                    </td>
                    <td className="admin-table__cell--num">
                      {c.minWageredPln > 0 ? formatPln(c.minWageredPln) : '—'}
                    </td>
                    <td className="admin-table__muted admin-table__nowrap">{fmtDate(c.expiresAt)}</td>
                    <td><span className="admin-codes__source">{c.source}</span></td>
                    <td>
                      <span className={`admin-status admin-status--${c.enabled ? 'open' : 'cancelled'}`}>
                        {c.enabled ? 'active' : 'disabled'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-codes__actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-codes__toggle"
                          disabled={busyId === c._id}
                          onClick={() => void handleToggle(c)}
                        >
                          {c.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger admin-codes__toggle"
                          disabled={busyId === c._id}
                          onClick={() => void handleDelete(c)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
