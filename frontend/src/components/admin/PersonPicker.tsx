import { useEffect, useRef, useState } from 'react'
import { useAdmin, type Person } from '../../context/AdminContext'
import { triggerHaptic } from '../../lib/haptics'
import './PersonPicker.css'

type Props = {
  value?: string
  onChange: (personId: string | undefined) => void
  placeholder?: string
}

export function PersonPicker({ value, onChange, placeholder = 'Assign person…' }: Props) {
  const { persons, addPerson } = useAdmin()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = persons.find(p => p.id === value)

  const filtered = persons.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    triggerHaptic('medium')
    const person = await addPerson({ name: newName.trim() })
    onChange(person.id)
    setNewName('')
    setCreating(false)
    setOpen(false)
    setQuery('')
  }

  const handleSelect = (p: Person) => {
    triggerHaptic('selection')
    onChange(p.id)
    setOpen(false)
    setQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    triggerHaptic('light')
    onChange(undefined)
  }

  return (
    <div className="person-picker" ref={ref}>
      <button
        type="button"
        className={['person-picker__trigger', open ? 'person-picker__trigger--open' : ''].join(' ').trim()}
        onClick={() => {
          triggerHaptic('selection')
          setOpen(v => !v)
        }}
      >
        {selected ? (
          <span className="person-picker__selected">
            {selected.pfp && (
              <img src={selected.pfp} alt="" className="person-picker__pfp" />
            )}
            <span>{selected.name}</span>
          </span>
        ) : (
          <span className="person-picker__placeholder">{placeholder}</span>
        )}
        <span className="person-picker__chevron" aria-hidden>▾</span>
        {selected && (
          <span className="person-picker__clear" onClick={handleClear} title="Remove">×</span>
        )}
      </button>

      {open && (
        <div className="person-picker__dropdown">
          <input
            className="person-picker__search"
            type="text"
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />

          <ul className="person-picker__list">
            {filtered.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  className={['person-picker__option', p.id === value ? 'person-picker__option--active' : ''].join(' ').trim()}
                  onClick={() => handleSelect(p)}
                >
                  {p.pfp && <img src={p.pfp} alt="" className="person-picker__pfp" />}
                  <span>{p.name}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && !creating && (
              <li className="person-picker__empty">No results</li>
            )}
          </ul>

          {!creating ? (
            <button
              type="button"
              className="person-picker__create-btn"
              onClick={() => {
                triggerHaptic('selection')
                setCreating(true)
              }}
            >
              + Create new person
            </button>
          ) : (
            <div className="person-picker__create-row">
              <input
                type="text"
                className="person-picker__create-input"
                placeholder="Full name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <button type="button" className="person-picker__create-confirm" onClick={() => void handleCreate()}>
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
