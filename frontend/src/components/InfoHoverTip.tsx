import type { ReactNode } from 'react'
import './InfoHoverTip.css'

/** Strip invisible / zero-width chars so tooltips are not “empty” while still passing trim(). */
export function visibleTooltipText(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '').trim()
}

type Props = {
  text: string
  children: ReactNode
  /** Visually hidden label for the trigger control */
  ariaLabel?: string
  className?: string
}

export function InfoHoverTip({ text, children, ariaLabel = 'Więcej informacji', className }: Props) {
  const t = visibleTooltipText(text)
  if (!t) return <>{children}</>

  return (
    <span className={['info-hover-tip', className].filter(Boolean).join(' ')}>
      <button type="button" className="info-hover-tip__trigger" aria-label={ariaLabel}>
        {children}
      </button>
      <span className="info-hover-tip__bubble" role="tooltip">
        {t}
      </span>
    </span>
  )
}
