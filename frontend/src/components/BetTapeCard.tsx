import type { ApiTape } from '../api/client'
import { useBets } from '../context/BetsContext'
import { triggerHaptic } from '../lib/haptics'
import { TapeFlameIcon } from './TapeFlameIcon'
import './BetTapeCard.css'

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 6C12.5523 6 13 6.44772 13 7V11H17C17.5523 11 18 11.4477 18 12C18 12.5523 17.5523 13 17 13H13V17C13 17.5523 12.5523 18 12 18C11.4477 18 11 17.5523 11 17V13H7C6.44772 13 6 12.5523 6 12C6 11.4477 6.44772 11 7 11H11V7C11 6.44772 11.4477 6 12 6Z"
        fill="currentColor"
      />
    </svg>
  )
}

type Props = { tape: NonNullable<ApiTape> }

export function BetTapeCard({ tape }: Props) {
  const { toggleBet } = useBets()

  const handleAddAll = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    triggerHaptic('medium')
    for (const line of tape.lines) {
      toggleBet({
        betId: line.betShortId,
        title: line.question,
        image: line.image,
        option: {
          label: line.selection,
          multiplier: line.newMultiplier,
          oldMultiplier: line.hasOld ? line.oldMultiplier : undefined,
          variant: 'primary',
        },
      })
    }
  }

  return (
    <div className="bet-tape">
      <h3 className="bet-tape__title">
        <TapeFlameIcon className="bet-tape__title-icon" />
        {tape.title}
      </h3>

      <div className="bet-tape__rows">
        {tape.lines.map((line) => (
          <div key={`${line.betShortId}:${line.optionId}`} className="bet-tape__row">
            <div className="bet-tape__row-top">
              <div className="bet-tape__avatar">
                {line.image ? (
                  <img className="bet-tape__avatar-img" src={line.image} alt="" />
                ) : (
                  <span className="bet-tape__avatar-placeholder" />
                )}
              </div>
              <p className="bet-tape__question">{line.question}</p>
            </div>
            <div className="bet-tape__row-bottom">
              <span className="bet-tape__pick">{line.selection}</span>
              <div className="bet-tape__odds">
                {line.hasOld && (
                  <span className="bet-tape__old-wrap">
                    <span className="bet-tape__old">{line.oldMultiplier}</span>
                    <span className="bet-tape__old-line" aria-hidden />
                  </span>
                )}
                <span className="bet-tape__new">{line.newMultiplier}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bet-tape__footer">
        <button type="button" className="bet-tape__add" onClick={handleAddAll}>
          <PlusIcon className="bet-tape__add-icon" />
          Dodaj
        </button>
        <div className="bet-tape__totals" aria-label="Łączny kurs">
          {tape.hasAnyOld ? (
            <>
              <span className="bet-tape__total-old-wrap">
                <span className="bet-tape__total-old">{tape.totalOld}</span>
                <span className="bet-tape__total-old-line" aria-hidden />
              </span>
              <span className="bet-tape__total-new">{tape.totalNew}</span>
            </>
          ) : (
            <span className="bet-tape__total-new bet-tape__total-new--solo">{tape.totalNew}</span>
          )}
        </div>
      </div>
    </div>
  )
}
