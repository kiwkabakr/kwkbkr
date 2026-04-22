import { createPortal } from 'react-dom'
import './FullPageLoader.css'

export function FullPageLoader() {
  return createPortal(
    <div
      className="full-page-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={'\u0141adowanie'}
    >
      <div className="full-page-loader__spinner" aria-hidden />
    </div>,
    document.body
  )
}
