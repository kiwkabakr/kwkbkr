import { useEffect, useState } from 'react'
import { useAdmin, type AdminBetOption } from '../../context/AdminContext'
import {
  edgeForCategory,
  formatMultiplier,
  multiplierFromPercentInput,
  multiplierToPercent,
  percentToMultiplier,
} from '../../lib/adminOdds'
import { triggerHaptic } from '../../lib/haptics'
import { PersonPicker } from './PersonPicker'
import './OptionEditor.css'

type Props = {
  option: AdminBetOption
  index: number
  total: number
  category: string
  subGroups: { groupKey: string; title: string }[]
  onChange: (updated: AdminBetOption) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function OptionEditor({
  option,
  index,
  total,
  category,
  subGroups,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: Props) {
  const { persons } = useAdmin()
  const assignedPerson = persons.find(p => p.id === option.personId)
  const edge = edgeForCategory(category)

  const [percentDraft, setPercentDraft] = useState(() => multiplierToPercent(option.multiplier, edge))

  useEffect(() => {
    setPercentDraft(multiplierToPercent(option.multiplier, edge))
  }, [option.multiplier, option.id, edge])

  const set = <K extends keyof AdminBetOption>(key: K, val: AdminBetOption[K]) =>
    onChange({ ...option, [key]: val })

  const commitPercent = () => {
    const nextMult = multiplierFromPercentInput(percentDraft, edge)
    if (percentDraft.trim() === '') {
      onChange({ ...option, multiplier: '' })
      return
    }
    if (nextMult) onChange({ ...option, multiplier: nextMult })
    else setPercentDraft(multiplierToPercent(option.multiplier, edge))
  }

  const displayKurs = (() => {
    const p = Number(percentDraft.replace(',', '.').trim())
    if (Number.isFinite(p) && p > 0) {
      const m = percentToMultiplier(p, edge)
      if (m !== undefined) return formatMultiplier(m)
    }
    return option.multiplier || '—'
  })()

  return (
    <div className="opt-editor">
      <div className="opt-editor__drag">
        <button
          type="button"
          className="opt-editor__move"
          onClick={() => {
            triggerHaptic('selection')
            onMoveUp()
          }}
          disabled={index === 0}
          title="Move up"
        >↑</button>
        <span className="opt-editor__index">{index + 1}</span>
        <button
          type="button"
          className="opt-editor__move"
          onClick={() => {
            triggerHaptic('selection')
            onMoveDown()
          }}
          disabled={index === total - 1}
          title="Move down"
        >↓</button>
      </div>

      <div className="opt-editor__fields">
        <div className="opt-editor__row opt-editor__row--main">
          <div className="opt-editor__field opt-editor__field--label">
            <label className="opt-editor__field-label">Label</label>
            <input
              className="opt-editor__input"
              type="text"
              value={option.label}
              onChange={e => set('label', e.target.value)}
              placeholder="e.g. Tak"
            />
          </div>

          <div className="opt-editor__field opt-editor__field--mult">
            <label className="opt-editor__field-label">Szansa %</label>
            <input
              className="opt-editor__input"
              type="text"
              inputMode="decimal"
              value={percentDraft}
              onChange={e => setPercentDraft(e.target.value)}
              onBlur={() => commitPercent()}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              placeholder="np. 50"
            />
            <span className="opt-editor__kurs-hint" title="Kurs po marży kategorii (Sport10%, inne 20%)">
              → kurs {displayKurs}
            </span>
          </div>

          <div className="opt-editor__field opt-editor__field--mult">
            <label className="opt-editor__field-label">Old mult.</label>
            <input
              className="opt-editor__input"
              type="text"
              value={option.oldMultiplier ?? ''}
              onChange={e => set('oldMultiplier', e.target.value || undefined)}
              placeholder="—"
            />
          </div>

          <div className="opt-editor__field opt-editor__field--tier">
            <label className="opt-editor__field-label">Gdzie widać</label>
            <select
              className="opt-editor__select"
              value={option.tier ?? 'main'}
              onChange={e => {
                const t = e.target.value as 'main' | 'sub'
                if (t === 'main') onChange({ ...option, tier: 'main', subGroupId: undefined })
                else onChange({ ...option, tier: 'sub' })
              }}
            >
              <option value="main">Główna (strona główna, karuzela)</option>
              <option value="sub">Podopcja (tylko strona zakładu)</option>
            </select>
          </div>
        </div>

        <div className="opt-editor__row opt-editor__row--promoted">
          <label className="opt-editor__promoted">
            <input
              type="checkbox"
              checked={!!option.promoted}
              onChange={e => set('promoted', e.target.checked || undefined)}
            />
            <span>Promuj jako osobny bet na stronie głównej</span>
          </label>
        </div>

        {(option.tier ?? 'main') === 'sub' && (
          <div className="opt-editor__row opt-editor__row--subgroup">
            <div className="opt-editor__field opt-editor__field--subgroup">
              <label className="opt-editor__field-label">Podkategoria</label>
              <select
                className="opt-editor__select"
                value={option.subGroupId ?? ''}
                onChange={e => set('subGroupId', e.target.value || undefined)}
                disabled={subGroups.length === 0}
              >
                <option value="">{subGroups.length === 0 ? 'Najpierw dodaj podkategorię poniżej' : '— Wybierz —'}</option>
                {subGroups.map(sg => (
                  <option key={sg.groupKey} value={sg.groupKey}>{sg.title.trim() || '(bez tytułu)'}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="opt-editor__row opt-editor__row--person">
          <div className="opt-editor__field opt-editor__field--person">
            <label className="opt-editor__field-label">Person (option level)</label>
            <PersonPicker
              value={option.personId}
              onChange={pid => set('personId', pid)}
              placeholder="Assign person to this option…"
            />
          </div>

          {assignedPerson && (
            <div className="opt-editor__person-badge">
              {assignedPerson.pfp ? (
                <img src={assignedPerson.pfp} alt="" className="opt-editor__person-pfp" />
              ) : (
                <span className="opt-editor__person-avatar">{assignedPerson.name[0]}</span>
              )}
              <span className="opt-editor__person-name">{assignedPerson.name}</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className="opt-editor__remove"
        onClick={() => {
          triggerHaptic('selection')
          onRemove()
        }}
        title="Remove option"
      >
        ×
      </button>
    </div>
  )
}
