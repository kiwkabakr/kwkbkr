import { useEffect, useRef, useState } from 'react'
import { triggerHaptic } from '../lib/haptics'
import './TagSelector.css'

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 6C3 5.44772 3.44772 5 4 5H18C18.5523 5 19 5.44772 19 6C19 6.55228 18.5523 7 18 7H4C3.44772 7 3 6.55228 3 6ZM18 10C18.5523 10 19 10.4477 19 11V16.5858L20.2929 15.2929C20.6834 14.9024 21.3166 14.9024 21.7071 15.2929C22.0976 15.6834 22.0976 16.3166 21.7071 16.7071L18.7071 19.7071C18.3166 20.0976 17.6834 20.0976 17.2929 19.7071L14.2929 16.7071C13.9024 16.3166 13.9024 15.6834 14.2929 15.2929C14.6834 14.9024 15.3166 14.9024 15.7071 15.2929L17 16.5858V11C17 10.4477 17.4477 10 18 10ZM3 12C3 11.4477 3.44772 11 4 11H11C11.5523 11 12 11.4477 12 12C12 12.5523 11.5523 13 11 13H4C3.44772 13 3 12.5523 3 12ZM3 18C3 17.4477 3.44772 17 4 17H9C9.55228 17 10 17.4477 10 18C10 18.5523 9.55228 19 9 19H4C3.44772 19 3 18.5523 3 18Z"
        fill="currentColor"
      />
    </svg>
  )
}

export interface TagSelectorProps {
  tags: string[]
  activeTag: string
  onTagChange: (tag: string) => void
}

export function TagSelector({ tags, activeTag, onTagChange }: TagSelectorProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  function pick(tag: string) {
    triggerHaptic('selection')
    onTagChange(tag)
    setMenuOpen(false)
  }

  return (
    <div className="tag-selector">
      <div className="tag-selector__tags">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`tag-selector__tag${activeTag === tag ? ' tag-selector__tag--active' : ''}`}
            onClick={() => pick(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="tag-selector__filter-wrap" ref={wrapRef}>
        <button
          className="tag-selector__filter"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          onClick={() => {
            triggerHaptic('selection')
            setMenuOpen((o) => !o)
          }}
        >
          <FilterIcon className="tag-selector__filter-icon" />
          Filtruj
        </button>
        {menuOpen ? (
          <div className="tag-selector__dropdown" role="listbox" aria-label="Kategorie">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                role="option"
                aria-selected={activeTag === tag}
                className={`tag-selector__dropdown-item${activeTag === tag ? ' tag-selector__dropdown-item--active' : ''}`}
                onClick={() => pick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
