import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BetCard } from '../components/BetCard'
import { BetTapeCard } from '../components/BetTapeCard'
import { CommunityJoinBanner, useRandomCommunityVariant } from '../components/CommunityJoinBanner'
import { FeaturedBetCarousel } from '../components/FeaturedBetCarousel'
import { SearchBar } from '../components/SearchBar'
import { TagSelector } from '../components/TagSelector'
import { FullPageLoader } from '../components/FullPageLoader'
import { pub, type ApiBet, type ApiBetOption, type ApiBetSubGroup, type ApiTapesPublic } from '../api/client'
import { filterMainOptions } from '../lib/betTiers'
import './MainPage.css'

const ALL_CATEGORY = 'Wszystko'

const MAIN_PAGE_CATEGORY_TAGS = [ALL_CATEGORY, 'Polityka', 'Sport', 'Trending'] as const

/** Must match MainPage.css @media for .main-page__bets-grid (1 column). */
const BETS_GRID_1COL_MAX_PX = 768
const MAIN_BET_ROWS_BEFORE_COMMUNITY_CTA = 4

function useMainBetHeadCount(): number {
  const wideMq = `(min-width: ${BETS_GRID_1COL_MAX_PX + 1}px)`
  const [n, setN] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(wideMq).matches
      ? MAIN_BET_ROWS_BEFORE_COMMUNITY_CTA * 2
      : MAIN_BET_ROWS_BEFORE_COMMUNITY_CTA
  )
  useLayoutEffect(() => {
    const mq = window.matchMedia(wideMq)
    const sync = () =>
      setN(
        mq.matches
          ? MAIN_BET_ROWS_BEFORE_COMMUNITY_CTA * 2
          : MAIN_BET_ROWS_BEFORE_COMMUNITY_CTA
      )
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [wideMq])
  return n
}

// Singleton formatter — `new Intl.DateTimeFormat` is ~1000x faster reused
// than calling `toLocaleDateString` per card on every render.
const DATE_FMT = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const fmtDate = (iso: string) => DATE_FMT.format(new Date(iso))

type PromotedCard = { bet: ApiBet; option: ApiBetOption; image?: string }

type PromotedCategoryCard = { bet: ApiBet; subGroup: ApiBetSubGroup; image?: string; options: ApiBetOption[] }

/** pfp fallback: option's own → its subGroup image → bet's main pfp → banner */
function promotedImage(bet: ApiBet, option: ApiBetOption): string | undefined {
  const sg = option.subGroupId ? bet.subGroups?.find(g => g.groupKey === option.subGroupId) : undefined
  return option.personMeta?.pfp ?? sg?.image ?? sg?.personMeta?.pfp ?? bet.pfp ?? bet.banner
}

/** Promoted card title: podkategoria (subGroup) name when option is in one; else bet title. */
function promotedTitle(bet: ApiBet, option: ApiBetOption): string {
  const sg = option.subGroupId ? bet.subGroups?.find(g => g.groupKey === option.subGroupId) : undefined
  const cat = sg?.title?.trim()
  return cat || bet.title
}

function collectPromoted(bets: ApiBet[]): PromotedCard[] {
  const out: PromotedCard[] = []
  for (const bet of bets) {
    for (const option of bet.options) {
      if (option.promoted) out.push({ bet, option, image: promotedImage(bet, option) })
    }
  }
  return out
}

function subGroupOptionsOrdered(bet: ApiBet, groupKey: string): ApiBetOption[] {
  return bet.options.filter(o => (o.tier ?? 'main') === 'sub' && o.subGroupId === groupKey)
}

/** Category block image → person pfp → bet pfp → banner */
function promotedCategoryImage(bet: ApiBet, sg: ApiBetSubGroup): string | undefined {
  const img = sg.image?.trim()
  if (img) return img
  return sg.personMeta?.pfp ?? bet.pfp ?? bet.banner
}

function collectPromotedCategories(bets: ApiBet[]): PromotedCategoryCard[] {
  const out: PromotedCategoryCard[] = []
  for (const bet of bets) {
    for (const sg of bet.subGroups ?? []) {
      if (!sg.promoted) continue
      const opts = subGroupOptionsOrdered(bet, sg.groupKey).slice(0, 3)
      if (opts.length === 0) continue
      out.push({ bet, subGroup: sg, image: promotedCategoryImage(bet, sg), options: opts })
    }
  }
  return out
}

function mainBetOptions(bet: ApiBet) {
  return filterMainOptions(bet.options).slice(0, 2).map((o, i) => ({
    label: o.label,
    multiplier: `${o.multiplier}x`,
    oldMultiplier: o.oldMultiplier ? `${o.oldMultiplier}x` : undefined,
    variant: (i === 0 ? 'primary' : 'secondary') as 'primary' | 'secondary',
  }))
}

function MainBetCard({ bet }: { bet: ApiBet }) {
  return (
    <BetCard
      betId={bet.shortId}
      image={bet.pfp ?? bet.banner}
      title={bet.title}
      date={fmtDate(bet.date)}
      options={mainBetOptions(bet)}
    />
  )
}

export function MainPage() {
  const [bets, setBets] = useState<ApiBet[]>([])
  const [featured, setFeatured] = useState<ApiBet[]>([])
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY)
  const [searchQuery, setSearchQuery] = useState('')
  const [featuredReady, setFeaturedReady] = useState(false)
  const [betsInitialReady, setBetsInitialReady] = useState(false)
  const [betsGridLoading, setBetsGridLoading] = useState(false)
  const [tapes, setTapes] = useState<ApiTapesPublic | null>(null)
  const isFirstBetsFetchRef = useRef(true)
  const communityVariant = useRandomCommunityVariant()
  const mainBetHeadCount = useMainBetHeadCount()

  const categoryParam = activeCategory === ALL_CATEGORY ? undefined : activeCategory

  useEffect(() => {
    let cancelled = false
    pub.getFeatured()
      .then(f => { if (!cancelled) setFeatured(f) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setFeaturedReady(true) })
    pub.getTapes()
      .then(t => { if (!cancelled) setTapes(t) })
      .catch(err => {
        console.error(err)
        if (!cancelled) setTapes({ day: null, week: null })
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!isFirstBetsFetchRef.current) setBetsGridLoading(true)
    pub.getBets(categoryParam)
      .then(b => { if (!cancelled) setBets(b) })
      .catch(console.error)
      .finally(() => {
        if (cancelled) return
        isFirstBetsFetchRef.current = false
        setBetsGridLoading(false)
        setBetsInitialReady(true)
      })
    return () => { cancelled = true }
  }, [categoryParam])

  const visibleBets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return bets
    return bets.filter(b => b.title.toLowerCase().includes(q))
  }, [bets, searchQuery])

  const promoted = useMemo(() => collectPromoted(visibleBets), [visibleBets])
  const promotedCategories = useMemo(() => collectPromotedCategories(visibleBets), [visibleBets])

  const showEmpty = useMemo(
    () =>
      visibleBets.length === 0 && promoted.length === 0 && promotedCategories.length === 0,
    [visibleBets, promoted, promotedCategories]
  )

  // Hold the render until every piece of data for the page is in hand.
  // We render the FullPageLoader ourselves (rather than returning null) to
  // guarantee there's no 1-frame gap between mount and the provider flipping
  // its overlay on — the loader is up immediately on the very first paint.
  if (!featuredReady || !betsInitialReady || !tapes) return <FullPageLoader />

  const showTapesBlock =
    (tapes.day && tapes.day.lines.length > 0) || (tapes.week && tapes.week.lines.length > 0)

  const nMainBets = visibleBets.length
  const firstBets = visibleBets.slice(0, mainBetHeadCount)
  const restBets = visibleBets.slice(mainBetHeadCount)
  const showCommunityCtaAfterMain = !showEmpty && nMainBets > 0
  const showCommunityCtaAtEnd = !showEmpty && nMainBets === 0
  const showHeadGrid = firstBets.length > 0
  const hasTailGrid =
    showTapesBlock ||
    restBets.length > 0 ||
    promoted.length > 0 ||
    promotedCategories.length > 0 ||
    showCommunityCtaAtEnd

  return (
    <div className="main-page">
      <FeaturedBetCarousel bets={featured} />
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <TagSelector tags={[...MAIN_PAGE_CATEGORY_TAGS]} activeTag={activeCategory} onTagChange={setActiveCategory} />

      <h2 className="main-page__bets-heading">Wszystkie bety</h2>

      <div className="main-page__bets-grid-wrap">
        {betsGridLoading ? (
          <div
            className="main-page__bets-grid-loader"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Ładowanie betów"
          >
            <div className="main-page__bets-grid-spinner" aria-hidden />
          </div>
        ) : null}
        {showEmpty ? (
          <p className="main-page__empty">Brak dostępnych betów</p>
        ) : (
          <div className="main-page__bets-stack">
            {showHeadGrid ? (
              <div className="main-page__bets-grid">
                {firstBets.map(bet => <MainBetCard key={bet._id} bet={bet} />)}
              </div>
            ) : null}
            {showCommunityCtaAfterMain ? (
              <div className="main-page__community-cta">
                <CommunityJoinBanner variant={communityVariant} />
              </div>
            ) : null}
            {hasTailGrid ? (
              <div className="main-page__bets-grid">
                {showTapesBlock ? (
                  <div className="main-page__tapes-slot">
                    {tapes.day && tapes.day.lines.length > 0 ? <BetTapeCard tape={tapes.day} /> : null}
                    {tapes.week && tapes.week.lines.length > 0 ? <BetTapeCard tape={tapes.week} /> : null}
                  </div>
                ) : null}
                {restBets.map(bet => <MainBetCard key={bet._id} bet={bet} />)}
                {promoted.map(({ bet, option, image }) => (
                  <BetCard
                    key={`${bet._id}:${option.id}`}
                    betId={bet.shortId}
                    image={image}
                    title={promotedTitle(bet, option)}
                    date={fmtDate(bet.date)}
                    options={[{
                      label: option.label,
                      multiplier: `${option.multiplier}x`,
                      oldMultiplier: option.oldMultiplier ? `${option.oldMultiplier}x` : undefined,
                      variant: 'primary',
                    }]}
                  />
                ))}
                {promotedCategories.map(({ bet, subGroup, image, options: catOpts }) => (
                  <BetCard
                    key={`${bet._id}:cat:${subGroup.groupKey}`}
                    betId={bet.shortId}
                    image={image}
                    title={subGroup.title?.trim() || bet.title}
                    date={fmtDate(bet.date)}
                    options={catOpts.map((o, i) => ({
                      label: o.label,
                      multiplier: `${o.multiplier}x`,
                      oldMultiplier: o.oldMultiplier ? `${o.oldMultiplier}x` : undefined,
                      variant: i % 2 === 0 ? 'primary' : 'secondary',
                    }))}
                  />
                ))}
                {showCommunityCtaAtEnd ? (
                  <div className="main-page__community-cta">
                    <CommunityJoinBanner variant={communityVariant} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
