import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { triggerHaptic } from '../lib/haptics'
import './BetModal.css'

const TELEGRAM_URL = 'https://t.me/czutkagg'
/** Matches Darmowe Nagrody — Telegram QR (160×160 module in white tile) */
const TELEGRAM_QR_SIZE = 160
const START_COMMAND = '/start'

function TelegramIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M1.31748 8.89917C6.46345 6.66488 9.89408 5.19178 11.6093 4.48011C16.5127 2.44789 17.5303 2.09494 18.1948 2.08312C18.341 2.08065 18.6664 2.11666 18.8787 2.28791C19.0553 2.43222 19.1049 2.62739 19.1298 2.76428C19.1518 2.90117 19.1822 3.21317 19.1574 3.45672C18.8927 6.23854 17.7427 12.9891 17.158 16.1049C16.9126 17.4233 16.4244 17.8653 15.9528 17.9085C14.9269 18.0025 14.1493 17.2333 13.1564 16.5848C11.6038 15.5698 10.7269 14.938 9.21842 13.9477C7.47553 12.803 8.60617 12.1738 9.599 11.1458C9.85817 10.8767 14.3753 6.78226 14.4608 6.41089C14.4719 6.36443 14.483 6.19126 14.3782 6.1C14.2762 6.00846 14.1243 6.0398 14.0141 6.06453C13.8568 6.09972 11.3777 7.73472 6.56813 10.9693C5.8649 11.4514 5.22788 11.6864 4.65426 11.6741C4.02549 11.6606 2.81216 11.3189 1.91037 11.027C0.807272 10.6688 -0.0724949 10.4794 0.0047222 9.87109C0.0433308 9.55442 0.481883 9.23034 1.31748 8.89917Z" fill="white"/>
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="#fcdc3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="#fcdc3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

export function CreateAccountModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleCopy = () => {
    triggerHaptic('selection')
    navigator.clipboard.writeText(START_COMMAND).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const close = () => {
    triggerHaptic('light')
    onClose()
  }

  return createPortal(
    <div className="bet-modal-overlay" onClick={close}>
      <div
        className="bet-modal"
        role="dialog"
        aria-modal
        aria-label="Jak założyć konto?"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="bet-modal__close" onClick={close} aria-label="Zamknij">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="bet-modal__title">Jak założyć konto?</h2>

        <p className="bet-modal__step-label">Otwórz czat na Telegramie</p>
        <div className="bet-modal__telegram-with-qr">
          <div className="bet-modal__row bet-modal__row--telegram">
            <div className="bet-modal__row-left">
              <TelegramIcon />
              <span className="bet-modal__row-text">t.me/czutkagg</span>
            </div>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bet-modal__row-action"
              onClick={() => triggerHaptic('medium')}
            >
              Dołącz
            </a>
          </div>
          <div className="bet-modal__qr-below">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bet-modal__qr bet-modal__qr--telegram"
              onClick={() => triggerHaptic('light')}
              aria-label="Kod QR — otwórz Telegram"
            >
              <QRCodeSVG
                value={TELEGRAM_URL}
                size={TELEGRAM_QR_SIZE}
                level="M"
                bgColor="#ffffff"
                fgColor="#050512"
              />
            </a>
          </div>
        </div>

        <p className="bet-modal__step-label">Wpisz w czacie komendę</p>
        <div className="bet-modal__row bet-modal__row--command">
          <div className="bet-modal__row-left">
            <LinkIcon />
            <span className="bet-modal__row-text bet-modal__row-text--accent">{START_COMMAND}</span>
          </div>
          <button type="button" className="bet-modal__row-action bet-modal__row-action--dark" onClick={handleCopy}>
            {copied ? 'Skopiowano!' : 'Kopiuj'}
          </button>
        </div>

        <p className="bet-modal__desc">
          Konto zakładasz przez bota na Telegramie. Po wejściu w czat wyślij <strong>/start</strong>, żeby
          rozpocząć rejestrację.
        </p>
      </div>
    </div>,
    document.body,
  )
}
