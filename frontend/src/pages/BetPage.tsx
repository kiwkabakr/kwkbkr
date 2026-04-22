import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBets } from '../context/BetsContext'
import { pub, type ApiBet, type ApiBetOption, type ApiBetSubGroup } from '../api/client'
import { triggerHaptic } from '../lib/haptics'
import { filterMainOptions, filterSubOptions } from '../lib/betTiers'
import type { BetOption } from '../components/BetCard'
import { BetListCard, type BetListSpreadItem } from '../components/BetListCard'
import { FullPageLoader } from '../components/FullPageLoader'
import { InfoHoverTip } from '../components/InfoHoverTip'
import { QRCodeSVG } from 'qrcode.react'
import './BetPage.css'

const TELEGRAM_LINK = 'https://t.me/czutkagg'
const DISCORD_INVITE = 'https://discord.gg/czutkagg'

const COMMUNITY_QR_SIZE = 96

/** Hardcoded — not editable in admin (settlement section info icon) */
const BET_SETTLEMENT_SECTION_TOOLTIP =
  'Poniżej znajdziesz zasady rozliczenia tego zakładu: jak ustalany jest wynik i co jest dla Ciebie ważne przed postawieniem. To skrót — pełny opis jest w treści sekcji ustawianej przez organizatora.'

const LOAD_MS = 700
const CONFIRM_MS = 380

function OptMorphSvg() {
  return (
    <svg className="bet-page__opt-morph" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle className="opt-morph-circle" cx="12" cy="12" r="9" />
      <path className="opt-morph-check" d="M8 13L11 16L16 8" />
    </svg>
  )
}

function StrikeOdds({ value, tone }: { value: string; tone: 'dark' | 'light' | 'muted' }) {
  return (
    <span className={`bet-page__strike bet-page__strike--${tone}`}>
      <span className="bet-page__strike-text">{value}</span>
      <span className="bet-page__strike-line" aria-hidden />
    </span>
  )
}

function BetCommunityTelegramIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M1.317 8.899C6.463 6.665 9.894 5.192 11.609 4.48c5.903-2.032 6.921-2.385 7.586-2.397.146-.002.471.034.684.206.176.144.226.339.25.476.023.137.053.449.028.693-.265 2.782-1.415 9.532-2 12.648-.247 1.319-.735 1.761-1.207 1.804-1.026.094-1.803-.675-2.796-1.323-1.553-1.015-2.43-1.647-3.938-2.638-1.743-1.145-.613-1.774.38-2.802.26-.27 4.777-4.365 4.862-4.737.011-.046.022-.22-.083-.31-.102-.092-.254-.06-.364-.036-.156.035-2.635 1.671-7.445 4.905-.704.482-1.342.717-1.915.705-.629-.014-1.842-.355-2.743-.647-1.104-.358-1.98-.548-1.903-1.157.039-.317.477-.641 1.313-.972z"
        fill="currentColor"
      />
    </svg>
  )
}

function BetCommunityDiscordIcon() {
  return (
    <svg width="17" height="13" viewBox="0 0 71 55" fill="currentColor" aria-hidden>
      <path d="M60.105 4.898A58.55 58.55 0 0 0 45.653.415a.22.22 0 0 0-.233.11 40.784 40.784 0 0 0-1.8 3.697c-5.456-.817-10.886-.817-16.23 0-.485-1.164-1.201-2.587-1.828-3.697a.228.228 0 0 0-.233-.11 58.386 58.386 0 0 0-14.451 4.483.207.207 0 0 0-.095.082C1.578 18.73-.944 32.144.293 45.39a.244.244 0 0 0 .093.166c6.073 4.46 11.955 7.167 17.729 8.962a.23.23 0 0 0 .249-.082 42.08 42.08 0 0 0 3.627-5.9.225.225 0 0 0-.123-.312 38.772 38.772 0 0 1-5.539-2.64.228.228 0 0 1-.022-.378c.372-.279.744-.569 1.1-.862a.22.22 0 0 1 .23-.031c11.619 5.304 24.198 5.304 35.68 0a.219.219 0 0 1 .233.028c.356.293.728.586 1.103.865a.228.228 0 0 1-.02.378 36.384 36.384 0 0 1-5.54 2.637.227.227 0 0 0-.121.315 47.249 47.249 0 0 0 3.624 5.897.225.225 0 0 0 .249.084c5.801-1.794 11.684-4.502 17.757-8.961a.228.228 0 0 0 .092-.164c1.48-15.315-2.48-28.618-10.497-40.412a.18.18 0 0 0-.093-.084zM23.725 37.19c-3.498 0-6.38-3.212-6.38-7.156s2.826-7.156 6.38-7.156c3.583 0 6.437 3.24 6.38 7.156 0 3.944-2.826 7.156-6.38 7.156zm23.593 0c-3.498 0-6.38-3.212-6.38-7.156s2.826-7.156 6.38-7.156c3.583 0 6.437 3.24 6.38 7.156 0 3.944-2.797 7.156-6.38 7.156z" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" className="bet-page__info-svg">
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

function OptionButton({
  opt,
  selected,
  loading,
  confirming,
  disabled,
  onClick,
  size = 'large',
}: {
  opt: BetOption
  selected: boolean
  loading: boolean
  confirming: boolean
  disabled: boolean
  onClick: () => void
  size?: 'large' | 'small'
}) {
  const tone: 'dark' | 'light' | 'muted' =
    opt.variant === 'primary' ? 'dark' : opt.variant === 'ghost' ? 'muted' : 'light'
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-busy={loading}
      className={[
        'bet-page__opt',
        `bet-page__opt--${opt.variant}`,
        `bet-page__opt--${size}`,
        selected ? 'bet-page__opt--selected' : '',
        loading ? 'bet-page__opt--loading' : '',
        confirming ? 'bet-page__opt--confirming' : '',
      ].join(' ').trim()}
      onClick={onClick}
    >
      <span className="bet-page__opt-body">
        {size === 'large' && <span className="bet-page__opt-label">{opt.label}</span>}
        <span className="bet-page__opt-odds">
          {opt.oldMultiplier && <StrikeOdds value={opt.oldMultiplier} tone={tone} />}
          <span className={`bet-page__opt-mult bet-page__opt-mult--${opt.variant}`}>{opt.multiplier}</span>
        </span>
      </span>
      <OptMorphSvg />
    </button>
  )
}

function buildSpreadItems(options: ApiBetOption[], categoryHasImage: boolean): BetListSpreadItem[] {
  const hideRowImages = categoryHasImage
  return options.map((o, i) => ({
    optionId: o.id,
    label: o.label,
    rowImage: hideRowImages ? undefined : o.personMeta?.pfp,
    oldMultiplier: o.oldMultiplier ? `${o.oldMultiplier}x` : undefined,
    multiplier: `${o.multiplier}x`,
    pillVariant: i % 2 === 0 ? 'primary' : 'secondary',
  }))
}

type SubSection = { title: string; group?: ApiBetSubGroup; options: ApiBetOption[] }

function subGroupKey(g: ApiBetSubGroup): string {
  return String(g.groupKey ?? '').trim()
}

function buildSubSections(bet: ApiBet): SubSection[] {
  const subs = filterSubOptions(bet.options)
  const groups = bet.subGroups ?? []

  if (groups.length === 0 && subs.length === 0) return []

  const known = new Set(groups.map(subGroupKey))
  const byId = new Map<string, ApiBetOption[]>()
  for (const g of groups) byId.set(subGroupKey(g), [])
  const ungrouped: ApiBetOption[] = []

  for (const o of subs) {
    const sid = o.subGroupId != null ? String(o.subGroupId).trim() : ''
    if (sid && known.has(sid)) {
      byId.get(sid)!.push(o)
    } else {
      ungrouped.push(o)
    }
  }

  const out: SubSection[] = []
  for (const g of groups) {
    out.push({ group: g, title: g.title, options: byId.get(subGroupKey(g)) ?? [] })
  }
  if (ungrouped.length) {
    out.push({ title: 'Więcej opcji', options: ungrouped })
  }
  return out
}

export function BetPage() {
  const { id } = useParams<{ id: string }>()
  const { toggleBet, isSelected, removeBet } = useBets()
  const [bet, setBet] = useState<ApiBet | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingOptionId, setLoadingOptionId] = useState<string | null>(null)
  const [confirmingOptionId, setConfirmingOptionId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setBet(null)
    setLoading(true)
    pub.getBet(id)
      .then(b => { if (!cancelled) setBet(b) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!bet) return
    if (bet.status !== 'open') {
      removeBet(bet.shortId)
    }
  }, [bet, removeBet])

  const subSections = useMemo(() => (bet ? buildSubSections(bet) : []), [bet])

  if (loading) {
    return <FullPageLoader />
  }

  if (!bet) {
    return <div className="bet-page"><p style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Bet nie znaleziony</p></div>
  }

  const betId = bet.shortId
  const thumb = bet.pfp ?? bet.banner
  const canBet = bet.status === 'open'

  const handleOptClick = (opt: BetOption, optionId: string) => {
    if (!canBet || loadingOptionId) return
    triggerHaptic('selection')
    if (isSelected(betId, opt.label)) {
      toggleBet({ betId, title: bet.title, image: thumb, option: opt })
      return
    }
    setLoadingOptionId(optionId)
    window.setTimeout(() => {
      setLoadingOptionId(null)
      setConfirmingOptionId(optionId)
      toggleBet({ betId, title: bet.title, image: thumb, option: opt })
      window.setTimeout(() => setConfirmingOptionId(null), CONFIRM_MS)
    }, LOAD_MS)
  }

  const mainRaw = filterMainOptions(bet.options)
  const topRaw = mainRaw.slice(0, 3)
  const hasMainOverflow = mainRaw.length > 3
  const mainOptions: BetOption[] = topRaw.map((o, i) => ({
    label: o.label,
    multiplier: `${o.multiplier}x`,
    oldMultiplier: o.oldMultiplier ? `${o.oldMultiplier}x` : undefined,
    variant: i === 0 ? 'primary' : i === 1 ? 'secondary' : 'ghost',
  }))

  const statusBanner =
    bet.status === 'pending'
      ? 'Zakłady zamknięte — oczekujemy na rozstrzygnięcie.'
      : bet.status === 'resolved'
        ? 'Ten zakład został rozliczony.'
        : bet.status === 'cancelled'
          ? 'Ten zakład został anulowany.'
          : null

  return (
    <div className="bet-page">
      <div className="bet-page__hero">
        {thumb && <img className="bet-page__hero-img" src={thumb} alt="" />}
        <div className="bet-page__hero-info">
          <p className="bet-page__hero-meta">
            {bet.category} · {new Date(bet.date).toLocaleDateString('pl-PL')}
            <code className="bet-page__hero-id">{bet.shortId}</code>
          </p>
          <h1 className="bet-page__hero-title">{bet.title}</h1>
        </div>
      </div>

      {statusBanner && (
        <p className="bet-page__status-banner" role="status">
          {statusBanner}
        </p>
      )}

      <div className="bet-page__main-options">
        {mainOptions.map((opt, i) => (
          <OptionButton
            key={topRaw[i]!.id}
            opt={opt}
            selected={isSelected(betId, opt.label)}
            loading={loadingOptionId === topRaw[i]!.id}
            confirming={confirmingOptionId === topRaw[i]!.id}
            disabled={!canBet || (!!loadingOptionId && loadingOptionId !== topRaw[i]!.id)}
            onClick={() => handleOptClick(opt, topRaw[i]!.id)}
            size="large"
          />
        ))}
      </div>

      {(hasMainOverflow || subSections.length > 0) && (
        <div className="bet-page__more-markets">
          {hasMainOverflow && (
            <BetListCard
              title="Główne"
              titleTooltip={bet.mainMarketTooltip?.trim() || undefined}
              spreadDisabled={!canBet}
              spreadItems={buildSpreadItems(mainRaw, false)}
              spreadOnClick={item => {
                const o = mainRaw.find(x => x.id === item.optionId)
                if (!o) return
                const opt: BetOption = {
                  label: o.label,
                  multiplier: `${o.multiplier}x`,
                  oldMultiplier: o.oldMultiplier ? `${o.oldMultiplier}x` : undefined,
                  variant: item.pillVariant,
                }
                handleOptClick(opt, o.id)
              }}
              spreadIsSelected={item => {
                const o = mainRaw.find(x => x.id === item.optionId)
                return o ? isSelected(betId, o.label) : false
              }}
              spreadIsLoading={item => loadingOptionId === item.optionId}
              spreadIsConfirming={item => confirmingOptionId === item.optionId}
            />
          )}
          {subSections.map((sec, idx) => (
            <BetListCard
              key={`${sec.title}-${idx}`}
              title={sec.title}
              titleLeadingImage={sec.group?.image}
              titleTooltip={sec.group?.infoTooltip?.trim() || undefined}
              spreadDisabled={!canBet}
              blockSubtitle={
                sec.group?.personMeta
                  ? { image: sec.group.personMeta.pfp, name: sec.group.personMeta.name }
                  : undefined
              }
              spreadItems={buildSpreadItems(sec.options, Boolean(sec.group?.image?.trim()))}
              spreadOnClick={item => {
                const o = sec.options.find(x => x.id === item.optionId)
                if (!o) return
                const opt: BetOption = {
                  label: o.label,
                  multiplier: `${o.multiplier}x`,
                  oldMultiplier: o.oldMultiplier ? `${o.oldMultiplier}x` : undefined,
                  variant: item.pillVariant,
                }
                handleOptClick(opt, o.id)
              }}
              spreadIsSelected={item => {
                const o = sec.options.find(x => x.id === item.optionId)
                return o ? isSelected(betId, o.label) : false
              }}
              spreadIsLoading={item => loadingOptionId === item.optionId}
              spreadIsConfirming={item => confirmingOptionId === item.optionId}
            />
          ))}
        </div>
      )}

      {bet.settlementRules && (
        <div className="bet-page__rules">
          <h2 className="bet-page__rules-title">
            <span className="bet-page__rules-title-text">Zasady, sposób rozliczania</span>
            <InfoHoverTip
              className="bet-page__rules-info-wrap"
              text={BET_SETTLEMENT_SECTION_TOOLTIP}
              ariaLabel="Wyjaśnienie sekcji zasad rozliczania"
            >
              <InfoIcon className="bet-page__rules-info" />
            </InfoHoverTip>
          </h2>
          <p className="bet-page__rules-body">{bet.settlementRules}</p>
        </div>
      )}

      <div className="bet-page__community" aria-label="Społeczność czutka.gg">
        <div className="bet-page__community-stack">
          <div className="bet-page__community-banner bet-page__community-banner--telegram">
            <span className="bet-page__community-banner-icon" aria-hidden>
              <BetCommunityTelegramIcon />
            </span>
            <p className="bet-page__community-banner-text">
              <span className="bet-page__community-banner-text-dim">Dołącz na nasz Telegram i zgarniaj </span>
              <span className="bet-page__community-banner-text-em">darmowe bonusy co 15 minut</span>
            </p>
            <a
              href={TELEGRAM_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="bet-page__community-banner-btn"
              onClick={() => triggerHaptic('medium')}
            >
              Dołącz
            </a>
            <a
              href={TELEGRAM_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="bet-page__community-banner-qr"
              onClick={() => triggerHaptic('light')}
              aria-label="Kod QR — Telegram czutka.gg"
            >
              <QRCodeSVG
                value={TELEGRAM_LINK}
                size={COMMUNITY_QR_SIZE}
                level="M"
                bgColor="transparent"
                fgColor="#ffffff"
              />
            </a>
          </div>

          <div className="bet-page__community-banner bet-page__community-banner--discord">
            <span className="bet-page__community-banner-icon" aria-hidden>
              <BetCommunityDiscordIcon />
            </span>
            <div className="bet-page__community-banner-text bet-page__community-banner-text--multiline">
              <span className="bet-page__community-banner-line bet-page__community-banner-line--strong">
                Dołącz do 5&nbsp;325 innych osób
              </span>
              <span className="bet-page__community-banner-line bet-page__community-banner-line--dim">
                i wspólnie betujcie, oglądajcie zakłady
              </span>
            </div>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="bet-page__community-banner-btn"
              onClick={() => triggerHaptic('medium')}
            >
              Dołącz
            </a>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="bet-page__community-banner-qr"
              onClick={() => triggerHaptic('light')}
              aria-label="Kod QR — Discord czutka.gg"
            >
              <QRCodeSVG
                value={DISCORD_INVITE}
                size={COMMUNITY_QR_SIZE}
                level="M"
                bgColor="transparent"
                fgColor="#ffffff"
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
