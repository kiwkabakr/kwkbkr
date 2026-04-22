import { useCallback, useEffect, useState } from 'react'
import { admin, type SiteTapeLineRef, type SiteTapesConfigPayload } from '../../api/client'
import { useAdmin, type AdminBet } from '../../context/AdminContext'
import { filterMainOptions } from '../../lib/betTiers'
import { triggerHaptic } from '../../lib/haptics'
import { TapeFlameIcon } from '../../components/TapeFlameIcon'
import './AdminTapesPage.css'

const emptyPayload = (): SiteTapesConfigPayload => ({
  day: { title: 'Taśma dnia', lines: [] },
  week: { title: 'Taśma tygodnia', lines: [] },
})

function firstMainOptionId(b: AdminBet | undefined): string {
  if (!b) return ''
  const m = filterMainOptions(b.options)
  return m[0]?.id ?? ''
}

export function AdminTapesPage() {
  const { bets } = useAdmin()
  const openBets = bets.filter(b => b.status === 'open')
  const [form, setForm] = useState<SiteTapesConfigPayload>(emptyPayload)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    setOk(false)
    try {
      const data = await admin.getTapesConfig()
      setForm({
        day: {
          title: data.day?.title ?? 'Taśma dnia',
          lines: (data.day?.lines ?? []).map(l => ({ betShortId: l.betShortId, optionId: l.optionId })),
        },
        week: {
          title: data.week?.title ?? 'Taśma tygodnia',
          lines: (data.week?.lines ?? []).map(l => ({ betShortId: l.betShortId, optionId: l.optionId })),
        },
      })
    } catch {
      setError('Cannot load tapes config.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const betByShort = (shortId: string) => openBets.find(b => b.shortId === shortId)

  const updateLine = (
    block: 'day' | 'week',
    index: number,
    patch: Partial<SiteTapeLineRef> | ((prev: SiteTapeLineRef) => SiteTapeLineRef)
  ) => {
    setForm(prev => {
      const next = { ...prev, [block]: { ...prev[block], lines: [...prev[block].lines] } }
      const line = next[block].lines[index]
      if (!line) return prev
      next[block].lines[index] = typeof patch === 'function' ? patch(line) : { ...line, ...patch }
      return next
    })
  }

  const setBlockTitle = (block: 'day' | 'week', title: string) => {
    setForm(prev => ({ ...prev, [block]: { ...prev[block], title } }))
  }

  const addLine = (block: 'day' | 'week') => {
    const b = openBets[0]
    const defShort = b?.shortId ?? ''
    const defOpt = firstMainOptionId(b)
    setForm(prev => ({
      ...prev,
      [block]: { ...prev[block], lines: [...prev[block].lines, { betShortId: defShort, optionId: defOpt }] },
    }))
  }

  const removeLine = (block: 'day' | 'week', index: number) => {
    setForm(prev => ({
      ...prev,
      [block]: { ...prev[block], lines: prev[block].lines.filter((_, i) => i !== index) },
    }))
  }

  const save = async () => {
    triggerHaptic('medium')
    setSaving(true)
    setError(null)
    setOk(false)
    try {
      for (const block of [form.day, form.week] as const) {
        for (const l of block.lines) {
          const b = betByShort(l.betShortId)
          if (!b) {
            setError(`Nieznany bet: ${l.betShortId}. Wybierz zakład z listy.`)
            setSaving(false)
            return
          }
          const hasOpt = b.options.some(o => o.id === l.optionId)
          if (!hasOpt) {
            setError('Każda linia musi mieć prawidłową opcję.')
            setSaving(false)
            return
          }
        }
      }
      await admin.putTapesConfig(form)
      setOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const renderBlock = (key: 'day' | 'week', label: string) => {
    const block = form[key]
    return (
      <section className="admin-section admin-tapes__block" key={key}>
        <div className="admin-section__head">
          <h3 className="admin-section__title">
            <TapeFlameIcon className="admin-tapes__title-icon" />
            {label}
          </h3>
          <span className="admin-page__badge admin-page__badge--muted">
            {block.lines.length} {block.lines.length === 1 ? 'linia' : 'linii'}
          </span>
        </div>

        <div className="admin-field">
          <label className="admin-label">Tytuł</label>
          <input
            className="admin-input"
            value={block.title}
            onChange={e => setBlockTitle(key, e.target.value)}
            placeholder="Taśma dnia"
          />
        </div>

        <div className="admin-tapes__lines">
          {block.lines.map((line, i) => {
            const b = betByShort(line.betShortId)
            const opts = b ? filterMainOptions(b.options) : []
            return (
              <div className="admin-tapes__line" key={`${key}-${i}`}>
                <select
                  className="admin-select"
                  value={line.betShortId}
                  onChange={e => {
                    const shortId = e.target.value
                    const nb = betByShort(shortId)
                    updateLine(key, i, {
                      betShortId: shortId,
                      optionId: firstMainOptionId(nb) || line.optionId,
                    })
                  }}
                >
                  <option value="">— wybierz bet —</option>
                  {openBets.map(bet => (
                    <option key={bet.id} value={bet.shortId}>
                      {bet.title} ({bet.shortId})
                    </option>
                  ))}
                </select>
                <select
                  className="admin-select"
                  value={line.optionId}
                  onChange={e => updateLine(key, i, { optionId: e.target.value })}
                  disabled={!b}
                >
                  {opts.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.label} — {o.multiplier}x
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="admin-btn admin-btn--danger"
                  onClick={() => {
                    triggerHaptic('light')
                    removeLine(key, i)
                  }}
                >
                  Usuń
                </button>
              </div>
            )
          })}

          {block.lines.length === 0 && (
            <p className="admin-section__hint admin-tapes__empty">Brak linii — dodaj pierwszą poniżej.</p>
          )}
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-tapes__add"
          onClick={() => {
            triggerHaptic('light')
            addLine(key)
          }}
        >
          + Linia
        </button>
      </section>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div className="admin-page__header-left">
          <h1 className="admin-page__title">Taśmy (główna)</h1>
          {ok && <span className="admin-page__badge">Zapisano</span>}
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={saving || loading}
          onClick={() => void save()}
        >
          {saving ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </header>

      {loading ? (
        <div className="admin-page__empty"><p>Ładowanie…</p></div>
      ) : (
        <div className="admin-page__body admin-tapes__body">
          <p className="admin-section__hint admin-tapes__intro">
            Taśmy pojawiają się na stronie głównej po pierwszych dwóch rzędach kafelków. Wyświetlane są kursy z bazy
            (w tym przekreślone, jeśli opcja ma bonus).
          </p>

          {error && <div className="admin-tapes__err">{error}</div>}
          {openBets.length === 0 && (
            <div className="admin-tapes__err">Brak otwartych betów — dodaj kursy, żeby móc ustawić taśmy.</div>
          )}

          <div className="admin-tapes__blocks">
            {renderBlock('day', 'Taśma dnia')}
            {renderBlock('week', 'Taśma tygodnia')}
          </div>
        </div>
      )}
    </div>
  )
}
