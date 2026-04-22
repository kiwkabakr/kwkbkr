import { useState, useEffect } from 'react'
import '../components/BetModal.css'
import { pub } from '../api/client'
import { triggerHaptic } from '../lib/haptics'
import bgImgFloating from '../assets/darmowe-nagrody/bg-img-floating.png'
import discordBgArt from '../assets/darmowe-nagrody/discord.png'
import telegramBgArt from '../assets/darmowe-nagrody/telegram.png'
import './DarmoweNagrodyPage.css'

const REWARD_CODES_STORAGE_KEY = 'czutka.rewardsIssuedCodes'
const DISCORD_INVITE = 'https://discord.gg/czutkagg'
const TELEGRAM_LINK = 'https://t.me/czutkagg'
const TELEGRAM_QR_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(TELEGRAM_LINK)}`
const X_PROFILE_LINK = 'https://x.com/czutkagg'
const COOLDOWN_MS = 24 * 60 * 60 * 1000
const COOLDOWN_STORAGE_KEY = 'czutka.rewardsCooldown'
const X_STEP1_STORAGE_KEY = 'czutka.rewardsXStep1'

type CooldownKey = 'x' | 'steam'

const COOLDOWN_KEYS: CooldownKey[] = ['x', 'steam']

function getCooldownEnds(): Partial<Record<CooldownKey, number>> {
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY)
    const o = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    const now = Date.now()
    const out: Partial<Record<CooldownKey, number>> = {}
    for (const key of COOLDOWN_KEYS) {
      const v = o[key]
      if (typeof v === 'number' && v > now) out[key] = v
    }
    return out
  } catch {
    return {}
  }
}

function persistCooldownEnds(ends: Partial<Record<CooldownKey, number>>) {
  const toSave: Record<string, number> = {}
  for (const key of COOLDOWN_KEYS) {
    if (ends[key] !== undefined) toSave[key] = ends[key]!
  }
  if (Object.keys(toSave).length === 0) localStorage.removeItem(COOLDOWN_STORAGE_KEY)
  else localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(toSave))
}

function formatCooldownHms(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

/** Figma-style remaining time as `h:mm` (e.g. 23:39) for header row */
function formatRemainingHoursMinutes(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M1.317 8.899C6.463 6.665 9.894 5.192 11.609 4.48c5.903-2.032 6.921-2.385 7.586-2.397.146-.002.471.034.684.206.176.144.226.339.25.476.023.137.053.449.028.693-.265 2.782-1.415 9.532-2 12.648-.247 1.319-.735 1.761-1.207 1.804-1.026.094-1.803-.675-2.796-1.323-1.553-1.015-2.43-1.647-3.938-2.638-1.743-1.145-.613-1.774.38-2.802.26-.27 4.777-4.365 4.862-4.737.011-.046.022-.22-.083-.31-.102-.092-.254-.06-.364-.036-.156.035-2.635 1.671-7.445 4.905-.704.482-1.342.717-1.915.705-.629-.014-1.842-.355-2.743-.647-1.104-.358-1.98-.548-1.903-1.157.039-.317.477-.641 1.313-.972z"
        fill="currentColor"
      />
    </svg>
  )
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CooldownHourglassIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.834 1.6665C16.2942 1.6665 16.6673 2.0396 16.6673 2.49984C16.6673 2.96007 16.2942 3.33317 15.834 3.33317V4.99984C15.834 7.76126 13.5954 9.99984 10.834 9.99984L11.0912 10.0063C13.7331 10.1402 15.834 12.3247 15.834 14.9998V16.6665C16.2942 16.6665 16.6673 17.0396 16.6673 17.4998C16.6673 17.9601 16.2942 18.3332 15.834 18.3332H4.16732C3.70708 18.3332 3.33398 17.9601 3.33398 17.4998C3.33398 17.0396 3.70708 16.6665 4.16732 16.6665V14.9998C4.16732 12.3247 6.26824 10.1402 8.91015 10.0063L9.16732 9.99984C6.40589 9.99984 4.16732 7.76126 4.16732 4.99984V3.33317C3.70708 3.33317 3.33398 2.96007 3.33398 2.49984C3.33398 2.0396 3.70708 1.6665 4.16732 1.6665H15.834ZM7.80664 14.0648C7.12639 14.2917 6.66748 14.9281 6.66732 15.6452V15.8332H13.334V15.6452C13.3338 14.9281 12.8749 14.2917 12.1947 14.0648L10.0007 13.3332L7.80664 14.0648Z"
        fill="currentColor"
      />
    </svg>
  )
}

function RewardClaimTutorial({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const command = `/code ${code}`

  const handleCopy = () => {
    triggerHaptic('selection')
    navigator.clipboard.writeText(command).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="reward-card__tutorial-steps">
      <p className="bet-modal__step-label reward-card__tutorial-step-label">Dołącz na Telegram czutka.gg</p>
      <div className="reward-card__tutorial-step-with-qr">
        <div className="reward-card__tutorial-step-main">
          <div className="bet-modal__row bet-modal__row--telegram">
            <div className="bet-modal__row-left">
              <TelegramIcon className="reward-card__tutorial-telegram-icon" />
              <span className="bet-modal__row-text">t.me/czutkagg</span>
            </div>
            <a
              href={TELEGRAM_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="bet-modal__row-action"
              onClick={() => triggerHaptic('medium')}
            >
              Dołącz
            </a>
          </div>
        </div>
        <div className="reward-card__tutorial-qr">
          <img
            src={TELEGRAM_QR_SRC}
            width={112}
            height={112}
            alt="Kod QR — Telegram czutka.gg"
            className="reward-card__qr reward-card__qr--tutorial"
          />
        </div>
      </div>

      <p className="bet-modal__step-label">Wklej tę komendę na Telegramie</p>
      <div className="reward-card__tutorial-step-with-qr">
        <div className="reward-card__tutorial-step-main">
          <div className="bet-modal__row bet-modal__row--command">
            <div className="bet-modal__row-left">
              <LinkIcon className="reward-card__tutorial-link-icon" />
              <span className="bet-modal__row-text bet-modal__row-text--accent">{command}</span>
            </div>
            <button type="button" className="bet-modal__row-action bet-modal__row-action--dark" onClick={handleCopy}>
              {copied ? 'Skopiowano!' : 'Kopiuj'}
            </button>
          </div>
        </div>
      </div>

      <p className="bet-modal__desc reward-card__tutorial-desc">
        Użyj tej komendy na naszym Telegramie, aby odebrać darmowe saldo.
      </p>
    </div>
  )
}

function readXStep1FromSession(): boolean {
  try {
    return sessionStorage.getItem(X_STEP1_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

type IssuedCodes = Partial<Record<'x' | 'steam', string>>

function readIssuedCodes(): IssuedCodes {
  try {
    const raw = localStorage.getItem(REWARD_CODES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const out: IssuedCodes = {}
    if (typeof parsed?.x === 'string') out.x = parsed.x
    if (typeof parsed?.steam === 'string') out.steam = parsed.steam
    return out
  } catch {
    return {}
  }
}

function persistIssuedCodes(codes: IssuedCodes) {
  if (!codes.x && !codes.steam) {
    localStorage.removeItem(REWARD_CODES_STORAGE_KEY)
    return
  }
  localStorage.setItem(REWARD_CODES_STORAGE_KEY, JSON.stringify(codes))
}

export function DarmoweNagrodyPage() {
  const [xLink, setXLink] = useState('')
  const [xStep1Done, setXStep1Done] = useState(() => readXStep1FromSession())
  const [steamLink, setSteamLink] = useState('')
  const [loading, setLoading] = useState<'x' | 'steam' | null>(null)
  const [issuedCodes, setIssuedCodes] = useState<IssuedCodes>(() => readIssuedCodes())
  const [cooldownEnd, setCooldownEnd] = useState<Partial<Record<CooldownKey, number>>>(() => {
    const ends = getCooldownEnds()
    persistCooldownEnds(ends)
    return ends
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setCooldownEnd(prev => {
      const now = Date.now()
      let changed = false
      const next: Partial<Record<CooldownKey, number>> = { ...prev }
      for (const key of COOLDOWN_KEYS) {
        if (next[key] !== undefined && next[key]! <= now) {
          delete next[key]
          changed = true
        }
      }
      if (!changed) return prev
      persistCooldownEnds(next)
      return next
    })
  }, [tick])

  function remainingMs(platform: CooldownKey): number {
    const end = cooldownEnd[platform]
    if (!end) return 0
    return Math.max(0, end - Date.now())
  }

  const xCooldownActive = remainingMs('x') > 0
  const xStep2Unlocked = xStep1Done || xCooldownActive

  const handleOpenXProfile = () => {
    triggerHaptic('medium')
    setXStep1Done(true)
    try {
      sessionStorage.setItem(X_STEP1_STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const startCooldown = (platform: CooldownKey) => {
    const until = Date.now() + COOLDOWN_MS
    setCooldownEnd(prev => {
      const next = { ...prev, [platform]: until }
      persistCooldownEnds(next)
      return next
    })
  }

  const handleVerify = async (platform: 'x' | 'steam') => {
    triggerHaptic('medium')
    setLoading(platform)
    try {
      const res = await pub.claimReward(platform)
      setIssuedCodes(prev => {
        const next = { ...prev, [platform]: res.code }
        persistIssuedCodes(next)
        return next
      })
      startCooldown(platform)
    } catch (err) {
      console.error('[rewards] claim failed:', err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rewards">
      {/* Figma 227:5 — headline outside card; float art behind first card */}
      <div className="rewards__group">
        <h2 id="rewards-x-title" className="rewards__section-title">
          Odbieraj <span className="rewards__accent">10,00zł</span> teraz
        </h2>
        <section
          className="rewards__section rewards__section--lead rewards__section--after-outside-title"
          aria-labelledby="rewards-x-title"
        >
          <div className="rewards__float" aria-hidden>
            <img src={bgImgFloating} alt="" className="rewards__float-img" />
          </div>
          {/* X / Twitter */}
          <div className="reward-card">
            <div className="reward-card__task-list">
              <div className="reward-card__task-row">
                <span className="reward-card__task-num" aria-hidden>
                  1
                </span>
                <p className="reward-card__task-txt">Zaobserwuj nasze konto X</p>
              </div>
              <div className="reward-card__task-row">
                <span className="reward-card__task-num" aria-hidden>
                  2
                </span>
                <p className="reward-card__task-txt">Polajkuj i zrepostuj ostatnie 3 posty</p>
              </div>
            </div>

            <div className="reward-card__figma-row">
              <div className="reward-card__field reward-card__field--static">
                <LinkIcon className="reward-card__field-icon" />
                <span className="reward-card__field-prefix">x.com/czutkagg</span>
              </div>
              <a
                href={X_PROFILE_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="reward-card__btn-pink"
                onClick={handleOpenXProfile}
              >
                Idź do profilu
              </a>
            </div>

            <div
              className={`reward-card__verify-block${xStep2Unlocked ? '' : ' reward-card__verify-block--locked'}`}
            >
              {!xStep2Unlocked && (
                <p className="reward-card__verify-hint" role="status">
                  Najpierw otwórz nasz profil przyciskiem powyżej.
                </p>
              )}
              <div className="reward-card__figma-row">
                <label className="reward-card__field reward-card__field--input">
                  <span className="visually-hidden">Link do Twojego profilu na X</span>
                  <LinkIcon className="reward-card__field-icon" />
                  <input
                    type="url"
                    className="reward-card__field-control"
                    placeholder="Link do twojego profilu"
                    value={xLink}
                    onChange={e => setXLink(e.target.value)}
                    disabled={xCooldownActive || !xStep2Unlocked}
                    autoComplete="url"
                  />
                </label>
                <button
                  type="button"
                  className="reward-card__btn-pink"
                  disabled={!xLink.trim() || loading === 'x' || xCooldownActive || !xStep2Unlocked}
                  onClick={() => void handleVerify('x')}
                >
                  {loading === 'x' ? (
                    <span className="reward-spinner reward-spinner--on-dark" />
                  ) : xCooldownActive ? (
                    <span className="reward-card__btn-pink-label">{formatCooldownHms(remainingMs('x'))}</span>
                  ) : (
                    <span className="reward-card__btn-pink-label">Sprawdź</span>
                  )}
                </button>
              </div>
            </div>
            {remainingMs('x') > 0 && issuedCodes.x && (
              <>
                <p className="reward-card__received">
                  Dziękujemy — otrzymaliśmy Twoje zgłoszenie. Poniżej instrukcja odbioru nagrody na Telegramie.
                </p>
                <div className="reward-card__tutorial">
                  <h3 className="reward-card__tutorial-title">Odbierz nagrodę</h3>
                  <RewardClaimTutorial code={issuedCodes.x} />
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="rewards__group">
        <h2 id="rewards-steam-title" className="rewards__section-title rewards__section-title--daily">
          <span>Odbieraj </span>
          <span className="rewards__accent">2,50zł</span>
          <span> codziennie za darmo</span>
        </h2>
        <section className="rewards__section rewards__section--after-outside-title" aria-labelledby="rewards-steam-title">
          {/* Steam */}
          <div className="reward-card">
          <div className="reward-card__figma-header">
            <p className="reward-card__steam-title">
              Dodaj &quot;czutka.gg&quot; do swojego nicku na Steam
            </p>
            <div className="reward-card__cooldown-pill" title="Pozostały czas odnowienia">
              <CooldownHourglassIcon className="reward-card__cooldown-icon" />
              <span className="reward-card__cooldown-text">
                {remainingMs('steam') > 0 ? formatRemainingHoursMinutes(remainingMs('steam')) : '—:—'}
              </span>
            </div>
          </div>
          <div className="reward-card__figma-row">
            <label className="reward-card__field reward-card__field--input">
              <span className="visually-hidden">Link do profilu Steam</span>
              <LinkIcon className="reward-card__field-icon" />
              <input
                type="url"
                className="reward-card__field-control"
                placeholder="Link do twojego profilu"
                value={steamLink}
                onChange={e => setSteamLink(e.target.value)}
                disabled={remainingMs('steam') > 0}
              />
            </label>
            <button
              type="button"
              className="reward-card__btn-pink"
              disabled={!steamLink.trim() || loading === 'steam' || remainingMs('steam') > 0}
              onClick={() => void handleVerify('steam')}
            >
              {loading === 'steam' ? (
                <span className="reward-spinner reward-spinner--on-dark" />
              ) : remainingMs('steam') > 0 ? (
                <span className="reward-card__btn-pink-label">{formatCooldownHms(remainingMs('steam'))}</span>
              ) : (
                <span className="reward-card__btn-pink-label">Sprawdź profil</span>
              )}
            </button>
          </div>
          {remainingMs('steam') > 0 && issuedCodes.steam && (
            <>
              <p className="reward-card__received">
                Dziękujemy — otrzymaliśmy Twoje zgłoszenie. Poniżej instrukcja odbioru nagrody na Telegramie.
              </p>
              <div className="reward-card__tutorial">
                <h3 className="reward-card__tutorial-title">Odbierz nagrodę</h3>
                <RewardClaimTutorial code={issuedCodes.steam} />
              </div>
            </>
          )}
        </div>
        </section>
      </div>

      <div className="rewards__group">
        <h2 id="rewards-discord-title" className="rewards__section-title">
          Dołącz do naszego <span className="rewards__accent">Discorda</span>
        </h2>
        <section className="rewards__section rewards__section--after-outside-title" aria-labelledby="rewards-discord-title">
          {/* Discord */}
          <div className="reward-card reward-card--with-float reward-card--float-discord">
            <div className="reward-card__bg-float" aria-hidden>
              <img src={discordBgArt} alt="" className="reward-card__bg-float-img" />
            </div>
            <div className="reward-card__body">
              <p className="reward-card__desc reward-card__desc--tight">
                Dołącz do naszego Discorda i dodaj &quot;czutka.gg&quot; do nicku
              </p>
              <div className="reward-card__figma-row">
                <div className="reward-card__field reward-card__field--static">
                  <LinkIcon className="reward-card__field-icon" />
                  <span className="reward-card__field-prefix">discord.gg/czutkagg</span>
                </div>
                <a
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reward-card__btn-pink"
                  onClick={() => triggerHaptic('medium')}
                >
                  Dołącz do Discorda
                </a>
              </div>
              <div className="reward-card__telegram-cta">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(DISCORD_INVITE)}`}
                  width={120}
                  height={120}
                  alt="QR kod do Discorda czutka.gg"
                  className="reward-card__qr"
                />
              </div>
              <p className="reward-card__note">Aby otrzymać nagrodę, stwórz ticket na naszym Discordzie.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="rewards__group">
        <h2 id="rewards-telegram-title" className="rewards__section-title">
          Dołącz do naszego <span className="rewards__accent">Telegrama</span>
        </h2>
        <section className="rewards__section rewards__section--after-outside-title" aria-labelledby="rewards-telegram-title">
          {/* Telegram */}
          <div className="reward-card reward-card--with-float reward-card--float-telegram">
            <div className="reward-card__bg-float" aria-hidden>
              <img src={telegramBgArt} alt="" className="reward-card__bg-float-img" />
            </div>
            <div className="reward-card__body">
              <p className="reward-card__desc reward-card__desc--tight">Dołącz do naszego kanału na Telegramie</p>
              <div className="reward-card__figma-row">
                <div className="reward-card__field reward-card__field--static">
                  <TelegramIcon className="reward-card__field-icon" />
                  <span className="reward-card__field-prefix">t.me/czutkagg</span>
                </div>
                <a
                  href={TELEGRAM_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reward-card__btn-pink"
                  onClick={() => triggerHaptic('medium')}
                >
                  Dołącz do Telegrama
                </a>
              </div>
              <div className="reward-card__telegram-cta">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(TELEGRAM_LINK)}`}
                  width={120}
                  height={120}
                  alt="QR kod do Telegrama"
                  className="reward-card__qr"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
