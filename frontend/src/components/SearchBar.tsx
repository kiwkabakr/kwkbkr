import { useEffect, useRef } from 'react'
import './SearchBar.css'

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return !!el.closest('[contenteditable="true"]')
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={22}
      height={22}
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden
      className="search-bar__icon"
    >
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="15.5" y1="15.5" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

interface SearchBarProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value = '', onChange, placeholder = 'Szukaj' }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <label className="search-bar">
      <span className="search-bar__left">
        <SearchIcon />
        {!value && <span className="search-bar__placeholder">{placeholder}</span>}
      </span>
      <input
        ref={inputRef}
        type="text"
        className="search-bar__input"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={placeholder}
      />
      <span className="search-bar__kbd" aria-hidden>/</span>
    </label>
  )
}
