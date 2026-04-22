import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { triggerHaptic } from '../../lib/haptics'
import './ImageUpload.css'

type Props = {
  label: string
  value?: string
  onChange: (url: string) => void
  aspect?: 'banner' | 'square'
}

export function ImageUpload({ label, value, onChange, aspect = 'square' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [showUrl, setShowUrl] = useState(false)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => onChange(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const applyUrl = () => {
    if (urlInput.trim()) {
      triggerHaptic('selection')
      onChange(urlInput.trim())
      setUrlInput('')
      setShowUrl(false)
    }
  }

  return (
    <div className={`img-upload img-upload--${aspect}`}>
      <p className="img-upload__label">{label}</p>

      <div
        className={[
          'img-upload__zone',
          dragging ? 'img-upload__zone--drag' : '',
          value ? 'img-upload__zone--filled' : '',
        ].join(' ').trim()}
        onClick={() => {
          triggerHaptic('selection')
          inputRef.current?.click()
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {value ? (
          <>
            <img src={value} alt="" className="img-upload__preview" />
            <div className="img-upload__overlay">
              <span>Change</span>
            </div>
          </>
        ) : (
          <div className="img-upload__empty">
            <span className="img-upload__empty-icon">↑</span>
            <span className="img-upload__empty-text">
              {aspect === 'banner' ? 'Drop banner (natural ratio)' : 'Drop image'}
            </span>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="img-upload__input" onChange={onFileInput} />

      <div className="img-upload__actions">
        <button
          type="button"
          className="img-upload__url-btn"
          onClick={() => {
            triggerHaptic('selection')
            setShowUrl(v => !v)
          }}
        >
          {showUrl ? 'Cancel' : 'Paste URL'}
        </button>
        {value && (
          <button
            type="button"
            className="img-upload__clear-btn"
            onClick={() => {
              triggerHaptic('light')
              onChange('')
            }}
          >
            Remove
          </button>
        )}
      </div>

      {showUrl && (
        <div className="img-upload__url-row">
          <input
            type="text"
            className="img-upload__url-input"
            placeholder="https://..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyUrl()}
          />
          <button type="button" className="img-upload__url-apply" onClick={applyUrl}>
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
