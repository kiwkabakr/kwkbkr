import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { triggerHaptic } from '../lib/haptics'
import './CommunityJoinBanner.css'

export type CommunityVariant = 'discord' | 'telegram'

const DISCORD_URL = import.meta.env.VITE_DISCORD_INVITE_URL ?? 'https://discord.com/'
const TELEGRAM_URL = import.meta.env.VITE_TELEGRAM_URL ?? 'https://t.me/'

const HEADLINE = 'Dołącz do 5,325 innych osób'
const SUB = 'i wspólnie betujcie, oglądajcie zakłady'

function IconDiscord() {
  return (
    <svg
      className="community-join__icon community-join__icon--discord"
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
    >
      <path
        d="M22.7421 5.63775C21.0558 4.86163 19.2756 4.31103 17.4469 4C17.1966 4.4497 16.9703 4.91238 16.7686 5.3861C14.8207 5.09103 12.8398 5.09103 10.8919 5.3861C10.6902 4.91243 10.4638 4.44975 10.2136 4C8.3838 4.31366 6.60239 4.86557 4.91438 5.64181C1.56322 10.6261 0.654774 15.4866 1.10899 20.278C3.07151 21.7356 5.26814 22.8443 7.60337 23.5555C8.1292 22.8447 8.59449 22.0904 8.99431 21.3008C8.23491 21.0158 7.50196 20.6639 6.80394 20.2496C6.98765 20.1157 7.16732 19.9777 7.34093 19.8438C9.37201 20.8039 11.5888 21.3017 13.8333 21.3017C16.0778 21.3017 18.2946 20.8039 20.3256 19.8438C20.5013 19.9878 20.681 20.1259 20.8626 20.2496C20.1633 20.6646 19.429 21.0171 18.6682 21.3029C19.0676 22.092 19.5329 22.8456 20.0591 23.5555C22.3964 22.8471 24.5947 21.739 26.5576 20.2801C27.0905 14.7235 25.6471 9.90766 22.7421 5.63775ZM9.56965 17.3313C8.30388 17.3313 7.25817 16.1766 7.25817 14.7559C7.25817 13.3354 8.26754 12.1705 9.56561 12.1705C10.8637 12.1705 11.9013 13.3354 11.8792 14.7559C11.8569 16.1766 10.8596 17.3313 9.56965 17.3313ZM18.0969 17.3313C16.8291 17.3313 15.7875 16.1766 15.7875 14.7559C15.7875 13.3354 16.7968 12.1705 18.0969 12.1705C19.3971 12.1705 20.4266 13.3354 20.4044 14.7559C20.3822 16.1766 19.3869 17.3313 18.0969 17.3313Z"
        fill="white"
      />
    </svg>
  )
}

function IconTelegram() {
  return (
    <svg className="community-join__icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#fff"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.08-.08.1-.2.02-.3-.06-.1-.19-.12-.3-.1-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
      />
    </svg>
  )
}

type Props = { variant: CommunityVariant }

const QR_SIZE = 64

export function CommunityJoinBanner({ variant: v }: Props) {
  const href = v === 'discord' ? DISCORD_URL : TELEGRAM_URL
  const label = v === 'discord' ? 'Dołącz na Discord' : 'Dołącz na Telegram'

  const onClick = () => {
    triggerHaptic('medium')
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={['community-join', v === 'telegram' ? 'community-join--telegram' : ''].filter(Boolean).join(' ')}>
      <div className="community-join__left" aria-hidden>
        {v === 'discord' ? <IconDiscord /> : <IconTelegram />}
      </div>
      <div className="community-join__body">
        <p className="community-join__line">{HEADLINE}</p>
        <p className="community-join__line community-join__line--muted">{SUB}</p>
      </div>
      <div className="community-join__actions">
        <button type="button" className="community-join__btn" onClick={onClick}>
          Dołącz
        </button>
        <a
          className="community-join__qr"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => triggerHaptic('light')}
          aria-label={label}
        >
          <QRCodeSVG
            className="community-join__qr-code"
            value={href}
            size={QR_SIZE}
            level="M"
            bgColor="transparent"
            fgColor="#ffffff"
          />
        </a>
      </div>
    </div>
  )
}

export function useRandomCommunityVariant(): CommunityVariant {
  const [v] = useState<CommunityVariant>(() => (Math.random() < 0.5 ? 'discord' : 'telegram'))
  return v
}
