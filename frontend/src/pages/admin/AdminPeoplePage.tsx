import { useState } from 'react'
import { ImageUpload } from '../../components/admin/ImageUpload'
import { triggerHaptic } from '../../lib/haptics'
import { useAdmin, type Person } from '../../context/AdminContext'
import './AdminPeoplePage.css'

export function AdminPeoplePage() {
  const { persons, addPerson, updatePerson, deletePerson, getBetsForPerson } = useAdmin()
  const [selected, setSelected] = useState<Person | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPfp, setNewPfp] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return
    triggerHaptic('medium')
    const p = await addPerson({ name: newName.trim(), pfp: newPfp || undefined })
    setNewName('')
    setNewPfp('')
    setCreating(false)
    setSelected(p)
  }

  const handleDelete = async (p: Person) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return
    triggerHaptic('medium')
    await deletePerson(p.id)
    if (selected?.id === p.id) setSelected(null)
  }

  const detail = selected ? getBetsForPerson(selected.id) : []
  const showCategory = detail.length >= 2

  return (
    <div className="admin-split admin-people">
      {/* Left: list */}
      <div className="admin-split__list">
        <div className="admin-page__header">
          <div className="admin-page__header-left">
            <h1 className="admin-page__title">People</h1>
            <span className="admin-page__badge admin-page__badge--muted">{persons.length}</span>
          </div>
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => {
              triggerHaptic('medium')
              setCreating(true)
              setSelected(null)
            }}
          >
            + New
          </button>
        </div>

        {persons.length > 0 ? (
          <div className="admin-people__table-outer">
            <div className="admin-data-table-shell">
              <table className="admin-table admin-people__table">
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col" className="admin-table__cell--num">
                      Bets
                    </th>
                    <th scope="col">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {persons.map(p => {
                    const count = getBetsForPerson(p.id).length
                    const isCategory = count >= 2
                    const isActive = selected?.id === p.id
                    const open = () => {
                      triggerHaptic('selection')
                      setSelected(p)
                      setCreating(false)
                    }
                    return (
                      <tr
                        key={p.id}
                        className={isActive ? 'admin-people__row--active' : undefined}
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
                          <div className="admin-people__name-cell">
                            <span className="admin-avatar admin-people__avatar-sm">
                              {p.pfp ? <img src={p.pfp} alt="" /> : <span>{p.name[0]}</span>}
                            </span>
                            <span className="admin-people__name-txt">{p.name}</span>
                          </div>
                        </td>
                        <td className="admin-table__cell--num admin-people__bet-count">{count}</td>
                        <td>
                          {isCategory ? (
                            <span className="admin-people__type-pill">Category</span>
                          ) : (
                            <span className="admin-table__muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="admin-people__empty">No people yet</div>
        )}
      </div>

      {/* Right: detail */}
      <div className="admin-split__main admin-people__detail">
        {creating && (
          <div className="admin-people__panel">
            <div className="admin-page__header">
              <div className="admin-page__header-left">
                <h2 className="admin-page__title">New Person</h2>
              </div>
              <button
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  triggerHaptic('light')
                  setCreating(false)
                }}
              >
                Cancel
              </button>
            </div>

            <div className="admin-people__body">
              <section className="admin-people__card">
                <div className="admin-section__head">
                  <h3 className="admin-section__title">Identity</h3>
                </div>
                <div className="admin-people__edit-row">
                  <ImageUpload label="Profile picture" aspect="square" value={newPfp} onChange={setNewPfp} />
                  <div className="admin-field">
                    <label className="admin-label">Name</label>
                    <input
                      className="admin-input"
                      type="text"
                      placeholder="Full name…"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      autoFocus
                    />
                  </div>
                </div>
                <button className="admin-btn admin-btn--primary admin-people__save" onClick={handleCreate}>
                  Create person
                </button>
              </section>
            </div>
          </div>
        )}

        {selected && !creating && (
          <div className="admin-people__panel">
            <div className="admin-page__header">
              <div className="admin-page__header-left">
                <div className="admin-avatar admin-avatar--lg">
                  {selected.pfp ? <img src={selected.pfp} alt="" /> : <span>{selected.name[0]}</span>}
                </div>
                <h2 className="admin-page__title">{selected.name}</h2>
              </div>
              <button className="admin-btn admin-btn--danger" onClick={() => void handleDelete(selected)}>
                Delete
              </button>
            </div>

            <div className="admin-people__body">
              <section className="admin-people__card">
                <div className="admin-section__head">
                  <h3 className="admin-section__title">Identity</h3>
                </div>
                <div className="admin-people__edit-row">
                  <ImageUpload
                    label="Profile picture"
                    aspect="square"
                    value={selected.pfp}
                    onChange={v => updatePerson(selected.id, { pfp: v || undefined })}
                  />
                  <div className="admin-field">
                    <label className="admin-label">Name</label>
                    <input
                      className="admin-input"
                      type="text"
                      value={selected.name}
                      onChange={e => {
                        updatePerson(selected.id, { name: e.target.value })
                        setSelected(prev => prev ? { ...prev, name: e.target.value } : prev)
                      }}
                    />
                  </div>
                </div>
              </section>

              <section className="admin-people__card">
                <div className="admin-section__head">
                  <h3 className="admin-section__title">
                    {showCategory ? `Category · ${selected.name}` : 'Category'}
                  </h3>
                  <span className="admin-section__hint admin-people__hint">
                    {showCategory
                      ? `${detail.length} bets linked`
                      : 'Assign to 2+ bets to auto-create'}
                  </span>
                </div>

                {showCategory && (
                  <ul className="admin-people__cat-bets">
                    {detail.map(({ bet, options }) => {
                      const thumb = bet.banner ?? bet.pfp
                      return (
                        <li key={bet.id} className="admin-people__cat-bet">
                          <div className="admin-thumb">
                            {thumb
                              ? <img src={thumb} alt="" />
                              : <span>{bet.title[0]}</span>
                            }
                            {bet.banner && bet.pfp && (
                              <img className="admin-thumb__overlay-pfp" src={bet.pfp} alt="" />
                            )}
                          </div>
                          <div className="admin-people__cat-bet-info">
                            <span className="admin-people__cat-bet-title">{bet.title}</span>
                            <div className="admin-people__cat-bet-opts">
                              {options.length > 0
                                ? options.map(o => (
                                    <span key={o.id} className="admin-people__cat-opt">
                                      {o.label} <strong>{o.multiplier}x</strong>
                                    </span>
                                  ))
                                : <span className="admin-people__cat-opt admin-people__cat-opt--global">global assignment</span>
                              }
                            </div>
                          </div>
                          <span className={`admin-status admin-status--${bet.status}`}>
                            {bet.status}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {!showCategory && (
                  <div className="admin-people__cat-progress">
                    <div className="admin-people__cat-progress-bar">
                      <div
                        className="admin-people__cat-progress-fill"
                        style={{ width: `${(detail.length / 2) * 100}%` }}
                      />
                    </div>
                    <span className="admin-people__cat-progress-label">
                      {detail.length} / 2 bets — {detail.length === 0 ? 'assign to a bet to start' : 'add one more to activate'}
                    </span>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {!selected && !creating && (
          <div className="admin-idle">
            <span className="admin-idle__icon">◉</span>
            <p>Select a person or create a new one</p>
          </div>
        )}
      </div>
    </div>
  )
}
