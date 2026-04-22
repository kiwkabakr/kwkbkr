import { useEffect, useState } from 'react'
import { useAdmin, type AdminBet, type AdminBetOption, type AdminSubGroup } from '../../context/AdminContext'
import { edgeForCategory, remapMultipliersForEdgeChange } from '../../lib/adminOdds'
import { triggerHaptic } from '../../lib/haptics'
import { ImageUpload } from './ImageUpload'
import { OptionEditor } from './OptionEditor'
import { PersonPicker } from './PersonPicker'
import './BetFormPanel.css'

type Mode = 'idle' | 'create' | 'edit'

type Props = {
  mode: Mode
  editBet?: AdminBet
  onSaved: (bet: AdminBet) => void
  onDeleted?: (id: string) => void
  onCancel: () => void
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function emptyOption(): AdminBetOption {
  return { id: uid(), label: '', multiplier: '', tier: 'main' }
}

type FormState = Omit<AdminBet, 'id' | 'shortId' | 'createdAt' | 'status'>

function initialForm(mode: Mode, editBet?: AdminBet): FormState {
  if (mode === 'edit' && editBet) {
    return {
      title: editBet.title,
      banner: editBet.banner,
      pfp: editBet.pfp,
      date: editBet.date,
      options: editBet.options.map(o => ({ ...o })),
      subGroups: (editBet.subGroups ?? []).map(g => ({ ...g })),
      settlementRules: editBet.settlementRules,
      mainMarketTooltip: editBet.mainMarketTooltip,
      category: editBet.category,
      personId: editBet.personId,
      featuredOrder: editBet.featuredOrder,
    }
  }
  return {
    title: '',
    banner: undefined,
    pfp: undefined,
    date: '',
    options: [
      { id: uid(), label: '', multiplier: '', tier: 'main' },
      { id: uid(), label: '', multiplier: '', tier: 'main' },
    ],
    subGroups: [],
    settlementRules: '',
    mainMarketTooltip: '',
    category: '',
    personId: undefined,
    featuredOrder: 0,
  }
}

export function BetFormPanel({ mode, editBet, onSaved, onDeleted, onCancel }: Props) {
  const { addBet, updateBet, deleteBet, categories, addCategory, persons } = useAdmin()
  const [form, setForm] = useState<FormState>(() => initialForm(mode, editBet))
  const [saveFlash, setSaveFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCatInput, setNewCatInput] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const applyCategory = (newCategory: string) => {
    setForm(f => {
      const oldE = edgeForCategory(f.category)
      const newE = edgeForCategory(newCategory)
      const options = remapMultipliersForEdgeChange(f.options, oldE, newE)
      return { ...f, category: newCategory, options }
    })
  }

  const setOption = (idx: number, updated: AdminBetOption) => {
    setForm(f => {
      const options = [...f.options]
      options[idx] = updated
      return { ...f, options }
    })
  }

  const addOption = () => setForm(f => ({ ...f, options: [...f.options, emptyOption()] }))

  const removeOption = (idx: number) =>
    setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }))

  const moveOption = (from: number, to: number) => {
    setForm(f => {
      const options = [...f.options]
      const [item] = options.splice(from, 1)
      options.splice(to, 0, item)
      return { ...f, options }
    })
  }

  const addSubGroup = () =>
    setForm(f => ({
      ...f,
      subGroups: [
        ...(f.subGroups ?? []),
        { groupKey: uid(), title: '', image: undefined, personId: undefined, infoTooltip: undefined },
      ],
    }))

  const setSubGroup = (idx: number, patch: Partial<AdminSubGroup>) => {
    setForm(f => {
      const subGroups = [...(f.subGroups ?? [])]
      const cur = subGroups[idx]
      if (!cur) return f
      subGroups[idx] = { ...cur, ...patch }
      return { ...f, subGroups }
    })
  }

  const removeSubGroup = (idx: number) => {
    setForm(f => {
      const subGroups = [...(f.subGroups ?? [])]
      const removed = subGroups[idx]
      if (!removed) return f
      subGroups.splice(idx, 1)
      const options = f.options.map(o =>
        o.subGroupId === removed.groupKey ? { ...o, subGroupId: undefined } : o,
      )
      return { ...f, subGroups, options }
    })
  }

  const handlePersonChange = (pid: string | undefined) => {
    const person = pid ? persons.find(p => p.id === pid) : undefined
    setForm(f => ({
      ...f,
      personId: pid,
      pfp: person?.pfp ?? f.pfp,
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim() || saving) return
    triggerHaptic('medium')
    setSaving(true)
    setError('')
    try {
      let saved: AdminBet
      if (mode === 'edit' && editBet) {
        await updateBet(editBet.id, form)
        saved = { ...editBet, ...form }
      } else {
        saved = await addBet(form)
      }
      setSaveFlash(true)
      setTimeout(() => setSaveFlash(false), 1800)
      onSaved(saved)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editBet) return
    if (!window.confirm('Delete this bet?')) return
    triggerHaptic('medium')
    await deleteBet(editBet.id)
    onDeleted?.(editBet.id)
  }

  const handleAddCategory = async () => {
    if (!newCatInput.trim()) return
    triggerHaptic('selection')
    await addCategory(newCatInput.trim())
    applyCategory(newCatInput.trim())
    setNewCatInput('')
    setShowNewCat(false)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (mode === 'idle') {
    return (
      <div className="bet-form-panel bet-form-panel--idle">
        <div className="admin-idle">
          <span className="admin-idle__icon">◆</span>
          <p>Select a bet to edit or create a new one</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bet-form-panel">
      <div className="bet-form-panel__header">
        <h2 className="bet-form-panel__title">
          {mode === 'create' ? 'New Bet' : 'Edit Bet'}
          {editBet && <code className="bet-form-panel__short-id">{editBet.shortId}</code>}
        </h2>
        <div className="bet-form-panel__header-actions">
          {saveFlash && <span className="bet-form-panel__saved-flash">Saved ✓</span>}
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => {
              triggerHaptic('light')
              onCancel()
            }}
          >
            Cancel
          </button>
          {mode === 'edit' && (
            <button type="button" className="admin-btn admin-btn--danger" onClick={() => void handleDelete()}>
              Delete
            </button>
          )}
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'} <kbd>⌘S</kbd>
          </button>
        </div>
      </div>

      {error && (
        <div className="bet-form-panel__error">{error}</div>
      )}

      <div className="bet-form-panel__body">
        {/* Images */}
        <section className="admin-section">
          <div className="admin-section__head">
            <h3 className="admin-section__title">Images</h3>
            <span className="admin-section__hint">Natural ratios — no cropping</span>
          </div>
          <div className="bet-form-panel__images-row">
            <div className="bet-form-panel__image-col bet-form-panel__image-col--banner">
              <ImageUpload
                label="Banner"
                aspect="banner"
                value={form.banner}
                onChange={v => set('banner', v || undefined)}
              />
            </div>
            <div className="bet-form-panel__image-col bet-form-panel__image-col--pfp">
              <ImageUpload
                label="PFP"
                aspect="square"
                value={form.pfp}
                onChange={v => set('pfp', v || undefined)}
              />
            </div>
          </div>
        </section>

        {/* Basic info */}
        <section className="admin-section">
          <h3 className="admin-section__title">Details</h3>

          <div className="bet-form-panel__field">
            <label className="bet-form-panel__label">Title</label>
            <input
              className="bet-form-panel__input"
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="What is the bet about?"
            />
          </div>

          <div className="bet-form-panel__row">
            <div className="bet-form-panel__field">
              <label className="bet-form-panel__label">Date &amp; Time</label>
              <input
                className="bet-form-panel__input"
                type="datetime-local"
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
            </div>

            <div className="bet-form-panel__field">
              <label className="bet-form-panel__label">Category</label>
              <div className="bet-form-panel__cat-row">
                <select
                  className="bet-form-panel__select"
                  value={form.category}
                  onChange={e => applyCategory(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="bet-form-panel__add-cat-btn"
                  onClick={() => {
                    triggerHaptic('selection')
                    setShowNewCat(v => !v)
                  }}
                  title="Add new category"
                >
                  +
                </button>
              </div>
              {showNewCat && (
                <div className="bet-form-panel__new-cat-row">
                  <input
                    className="bet-form-panel__input bet-form-panel__input--sm"
                    type="text"
                    placeholder="Category name…"
                    value={newCatInput}
                    onChange={e => setNewCatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                    autoFocus
                  />
                  <button type="button" className="admin-btn admin-btn--primary" onClick={() => void handleAddCategory()}>
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bet-form-panel__field">
            <label className="bet-form-panel__label">Featured position</label>
            <select
              className="bet-form-panel__select"
              value={form.featuredOrder}
              onChange={e => set('featuredOrder', Number(e.target.value))}
            >
              <option value={0}>Not featured</option>
              <option value={1}>Featured #1</option>
              <option value={2}>Featured #2</option>
              <option value={3}>Featured #3</option>
            </select>
          </div>
        </section>

        {/* Global person */}
        <section className="admin-section">
          <div className="admin-section__head">
            <h3 className="admin-section__title">Person (global)</h3>
            <span className="admin-section__hint">Auto-fills PFP when assigned</span>
          </div>

          <div className="bet-form-panel__person-global-row">
            <div className="bet-form-panel__person-global-picker">
              <PersonPicker
                value={form.personId}
                onChange={handlePersonChange}
                placeholder="Assign person globally…"
              />
            </div>

            {form.personId && (() => {
              const p = persons.find(x => x.id === form.personId)
              return p ? (
                <div className="bet-form-panel__person-info">
                  {p.pfp
                    ? <img src={p.pfp} alt="" className="bet-form-panel__person-pfp" />
                    : <span className="bet-form-panel__person-avatar">{p.name[0]}</span>
                  }
                  <span className="bet-form-panel__person-name">{p.name}</span>
                </div>
              ) : null
            })()}
          </div>
        </section>

        {/* Sub-markets (Więcej opcji on bet page) */}
        <section className="admin-section">
          <div className="admin-section__head">
            <h3 className="admin-section__title">Podkategorie (Więcej opcji)</h3>
            <button
              type="button"
              className="bet-form-panel__add-opt-btn"
              onClick={() => {
                triggerHaptic('selection')
                addSubGroup()
              }}
            >
              + Podkategoria
            </button>
          </div>
          <p className="admin-section__hint">
            Tytuł bloku na stronie zakładu (np. kto strzeli pierwszego gola). Zdjęcie kategorii — po lewej obok tytułu na stronie zakładu.
            Opcje „Podopcja” przypisz w polu Podkategoria. Osoba przy podkategorii: drugi wiersz pod tytułem. Blok widać także bez opcji (pusty).
          </p>
          <div className="bet-form-panel__subgroups">
            {(form.subGroups ?? []).map((sg, idx) => (
              <div key={sg.groupKey} className="bet-form-panel__subgroup-card">
                <div className="bet-form-panel__subgroup-fields">
                  <div className="bet-form-panel__subgroup-image">
                    <ImageUpload
                      label="Zdjęcie"
                      aspect="square"
                      value={sg.image}
                      onChange={v => setSubGroup(idx, { image: v || undefined })}
                    />
                  </div>
                  <div className="bet-form-panel__field">
                    <label className="bet-form-panel__label">Tytuł kategorii</label>
                    <input
                      className="bet-form-panel__input"
                      type="text"
                      value={sg.title}
                      onChange={e => setSubGroup(idx, { title: e.target.value })}
                      placeholder="np. Kto strzeli 1 bramkę"
                    />
                  </div>
                  <div className="bet-form-panel__field bet-form-panel__field--grow">
                    <label className="bet-form-panel__label">Osoba (nagłówek bloku, opcjonalnie)</label>
                    <PersonPicker
                      value={sg.personId}
                      onChange={pid => setSubGroup(idx, { personId: pid })}
                      placeholder="Przypisz osobę do bloku…"
                    />
                  </div>
                  <label className="bet-form-panel__promote-cat">
                    <input
                      type="checkbox"
                      checked={!!sg.promoted}
                      onChange={e => setSubGroup(idx, { promoted: e.target.checked || undefined })}
                    />
                    <span>Promuj kategorię jako osobny post (strona główna, do 3 opcji)</span>
                  </label>
                  <div className="bet-form-panel__field bet-form-panel__field--block">
                    <label className="bet-form-panel__label">
                      Podpowiedź przy ikonie informacji (tytuł kategorii na stronie zakładu)
                    </label>
                    <textarea
                      className="bet-form-panel__textarea bet-form-panel__textarea--compact"
                      value={sg.infoTooltip ?? ''}
                      onChange={e =>
                        setSubGroup(idx, {
                          infoTooltip: e.target.value === '' ? undefined : e.target.value,
                        })
                      }
                      placeholder="Krótki tekst po najechaniu na ikonę informacji obok tytułu bloku…"
                      rows={2}
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => {
                      triggerHaptic('selection')
                      removeSubGroup(idx)
                    }}
                  >
                    Usuń
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Options */}
        <section className="admin-section">
          <div className="admin-section__head">
            <h3 className="admin-section__title">Options</h3>
            <button
              type="button"
              className="bet-form-panel__add-opt-btn"
              onClick={() => {
                triggerHaptic('selection')
                addOption()
              }}
            >
              + Add option
            </button>
          </div>
          <p className="admin-section__hint">
            Dla każdej opcji podaj <strong>szansę w %</strong> (prawdopodobieństwo). Kurs liczymy automatycznie: marża{' '}
            <strong>10%</strong> dla kategorii Sport/Sports, <strong>20%</strong> dla pozostałych (także gdy kategoria nie jest wybrana).
            Minimalny kurs <strong>1.01</strong>.
          </p>

          <div className="bet-form-panel__options">
            {form.options.map((opt, idx) => (
              <OptionEditor
                key={opt.id}
                option={opt}
                index={idx}
                total={form.options.length}
                category={form.category}
                subGroups={form.subGroups ?? []}
                onChange={updated => setOption(idx, updated)}
                onRemove={() => removeOption(idx)}
                onMoveUp={() => moveOption(idx, idx - 1)}
                onMoveDown={() => moveOption(idx, idx + 1)}
              />
            ))}
          </div>
        </section>

        {/* Settlement rules */}
        <section className="admin-section">
          <h3 className="admin-section__title">Zasady rozliczenia</h3>
          <div className="bet-form-panel__field bet-form-panel__field--block">
            <label className="bet-form-panel__label">
              Podpowiedź przy ikonie informacji (sekcja Główne na stronie zakładu)
            </label>
            <textarea
              className="bet-form-panel__textarea bet-form-panel__textarea--compact"
              value={form.mainMarketTooltip ?? ''}
              onChange={e => set('mainMarketTooltip', e.target.value)}
              placeholder="Tekst po najechaniu na ikonę przy bloku Główne (więcej niż 3 opcje główne)…"
              rows={2}
            />
          </div>
          <textarea
            className="bet-form-panel__textarea"
            value={form.settlementRules}
            onChange={e => set('settlementRules', e.target.value)}
            placeholder="Describe how this bet will be settled…"
            rows={4}
          />
        </section>
      </div>
    </div>
  )
}
