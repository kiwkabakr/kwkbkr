import { triggerHaptic } from '../lib/haptics'
import { InfoHoverTip, visibleTooltipText } from './InfoHoverTip'
import './BetListCard.css'

export type BetListItem = {
  image?: string
  question: string
  answer: string
  oldMultiplier: string
  multiplier: string
}

/** Figma “market” row: label + connector + pill odds (bet detail — Więcej opcji) */
export type BetListSpreadItem = {
  optionId: string
  label: string
  rowImage?: string
  oldMultiplier?: string
  multiplier: string
  pillVariant: 'primary' | 'secondary'
}

function TitleInfoIcon() {
  return (
    <span className="bet-list-card__title-info" aria-hidden>
      <svg className="bet-list-card__title-info-svg" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none">
        <g opacity="0.6">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM10 11C10 10.4477 10.4477 10 11 10H12C12.5523 10 13 10.4477 13 11V16C13 16.5523 12.5523 17 12 17C11.4477 17 11 16.5523 11 16V12C10.4477 12 10 11.5523 10 11ZM12 7C11.4477 7 11 7.44772 11 8C11 8.55228 11.4477 9 12 9C12.5523 9 13 8.55228 13 8C13 7.44772 12.5523 7 12 7Z"
            fill="white"
          />
        </g>
      </svg>
    </span>
  )
}

export type BetListCardProps = {
  title: string
  /** Image left of the category title (podkategoria). */
  titleLeadingImage?: string
  /** Hover text for the info icon (from admin); icon hidden if empty */
  titleTooltip?: string
  /** Optional row under title (e.g. person for the whole block). */
  blockSubtitle?: { image?: string; name: string }
  /** When set (including `[]`), renders Figma-style market block (label — line — pill). */
  spreadItems?: BetListSpreadItem[]
  spreadOnClick?: (item: BetListSpreadItem) => void
  spreadIsSelected?: (item: BetListSpreadItem) => boolean
  spreadIsLoading?: (item: BetListSpreadItem) => boolean
  spreadIsConfirming?: (item: BetListSpreadItem) => boolean
  spreadDisabled?: boolean
  /** Legacy stacked layout + footer */
  items?: BetListItem[]
  combinedOldMultiplier?: string
  combinedMultiplier?: string
  onAdd?: () => void
}

export function BetListCard({
  title,
  titleLeadingImage,
  titleTooltip,
  blockSubtitle,
  spreadItems,
  spreadOnClick,
  spreadIsSelected,
  spreadIsLoading,
  spreadIsConfirming,
  spreadDisabled,
  items,
  combinedOldMultiplier,
  combinedMultiplier,
  onAdd,
}: BetListCardProps) {
  if (spreadItems !== undefined) {
    const anyLoading = spreadItems.some(i => spreadIsLoading?.(i) ?? false)
    const tip = titleTooltip != null ? visibleTooltipText(titleTooltip) : ''
    return (
      <div className="bet-list-card bet-list-card--spread">
        <div className="bet-list-card__title-row">
          {titleLeadingImage ? (
            <div className="bet-list-card__title-thumb">
              <img src={titleLeadingImage} alt="" />
            </div>
          ) : null}
          <p className="bet-list-card__title">{title}</p>
          {tip ? (
            <InfoHoverTip text={tip} ariaLabel={`Informacja: ${title}`}>
              <TitleInfoIcon />
            </InfoHoverTip>
          ) : null}
        </div>
        {blockSubtitle ? (
          <div className="bet-list-card__block-subtitle">
            {blockSubtitle.image ? (
              <div className="bet-list-card__block-subtitle-avatar">
                <img src={blockSubtitle.image} alt="" />
              </div>
            ) : null}
            <span className="bet-list-card__block-subtitle-name">{blockSubtitle.name}</span>
          </div>
        ) : null}
        <div className="bet-list-card__spread-rows">
          {spreadItems.length === 0 ? (
            <p className="bet-list-card__spread-empty">Brak opcji w tej kategorii.</p>
          ) : null}
          {spreadItems.map(item => {
            const selected = spreadIsSelected?.(item) ?? false
            const loading = spreadIsLoading?.(item) ?? false
            const confirming = spreadIsConfirming?.(item) ?? false
            return (
              <div key={item.optionId} className="bet-list-card__spread-row">
                <div className="bet-list-card__spread-left">
                  {item.rowImage ? (
                    <div className="bet-list-card__spread-avatar">
                      <img src={item.rowImage} alt="" />
                    </div>
                  ) : null}
                  <span className="bet-list-card__spread-label">{item.label}</span>
                </div>
                <div className="bet-list-card__spread-line" aria-hidden />
                <button
                  type="button"
                  className={[
                    'bet-list-card__spread-pill',
                    item.pillVariant === 'primary' ? 'bet-list-card__spread-pill--primary' : 'bet-list-card__spread-pill--secondary',
                    selected ? 'bet-list-card__spread-pill--selected' : '',
                    loading ? 'bet-list-card__spread-pill--loading' : '',
                    confirming ? 'bet-list-card__spread-pill--confirming' : '',
                  ].join(' ').trim()}
                  disabled={!!spreadDisabled || (anyLoading && !loading)}
                  aria-pressed={selected}
                  aria-busy={loading}
                  onClick={() => spreadOnClick?.(item)}
                >
                  <span className="bet-list-card__spread-pill-inner">
                    {item.oldMultiplier ? (
                      <span className="bet-list-card__spread-strike">
                        <span className="bet-list-card__spread-strike-text">{item.oldMultiplier}</span>
                        <span className="bet-list-card__spread-strike-line" aria-hidden />
                      </span>
                    ) : null}
                    <span className="bet-list-card__spread-pill-mult">{item.multiplier}</span>
                  </span>
                  <svg className="bet-list-card__spread-pill-morph" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opt-morph-circle" cx="12" cy="12" r="9" />
                    <path className="opt-morph-check" d="M8 13L11 16L16 8" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (!items?.length) {
    return null
  }

  return (
    <div className="bet-list-card">
      <p className="bet-list-card__title">{title}</p>

      <div className="bet-list-card__rows">
        {items.map((item, i) => (
          <div key={i} className="bet-list-card__row">
            <div className="bet-list-card__row-header">
              <div className="bet-list-card__avatar">
                {item.image
                  ? <img src={item.image} alt="" className="bet-list-card__avatar-img" />
                  : <span className="bet-list-card__avatar-placeholder" aria-hidden />
                }
              </div>
              <p className="bet-list-card__question">{item.question}</p>
            </div>
            <div className="bet-list-card__row-odds">
              <p className="bet-list-card__answer">{item.answer}</p>
              <div className="bet-list-card__odds">
                <span className="bet-list-card__strikethrough">
                  <span className="bet-list-card__strikethrough-text">{item.oldMultiplier}</span>
                  <span className="bet-list-card__strikethrough-line" aria-hidden />
                </span>
                <span className="bet-list-card__mult">{item.multiplier}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bet-list-card__footer">
        <button
          type="button"
          className="bet-list-card__btn bet-list-card__btn--primary"
          onClick={() => {
            triggerHaptic('medium')
            onAdd?.()
          }}
        >
          Dodaj
        </button>
        <div className="bet-list-card__btn bet-list-card__btn--secondary">
          <span className="bet-list-card__strikethrough">
            <span className="bet-list-card__strikethrough-text">{combinedOldMultiplier}</span>
            <span className="bet-list-card__strikethrough-line" aria-hidden />
          </span>
          <span className="bet-list-card__mult">{combinedMultiplier}</span>
        </div>
      </div>
    </div>
  )
}
