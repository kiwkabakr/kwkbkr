import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { CreateAccountModal } from './CreateAccountModal'
import { triggerHaptic } from '../lib/haptics'
import './Navbar.css'

function NavbarGiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4.66667C6 3.19391 7.19391 2 8.66667 2C10.007 2 11.2051 2.60849 12 3.56429C12.7949 2.60849 13.993 2 15.3333 2C16.8061 2 18 3.19391 18 4.66667C18 5.52576 17.75 6.32647 17.3188 7H19C20.1046 7 21 7.89543 21 9C21 10.1046 20.1046 11 19 11H13V7H13.6667C14.9553 7 16 5.95533 16 4.66667C16 4.29848 15.7015 4 15.3333 4C14.0447 4 13 5.04467 13 6.33333V7H11V6.33333C11 5.04467 9.95533 4 8.66667 4C8.29848 4 8 4.29848 8 4.66667C8 5.95533 9.04467 7 10.3333 7H11V11H5C3.89543 11 3 10.1046 3 9C3 7.89543 3.89543 7 5 7H6.68121C6.25 6.32647 6 5.52576 6 4.66667Z"
        fill="currentColor"
      />
      <path d="M13 13H20V17C20 19.2091 18.2091 21 16 21H13V13Z" fill="currentColor" />
      <path d="M11 13H4V17C4 19.2091 5.79086 21 8 21H11V13Z" fill="currentColor" />
    </svg>
  )
}

function NavbarChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.79289 5.29289C9.18342 4.90237 9.81643 4.90237 10.207 5.29289L16.207 11.2929C16.5975 11.6834 16.5975 12.3164 16.207 12.707L10.207 18.707C9.81643 19.0975 9.18342 19.0975 8.79289 18.707C8.40237 18.3164 8.40237 17.6834 8.79289 17.2929L14.0859 11.9999L8.79289 6.70696C8.40237 6.31643 8.40237 5.68342 8.79289 5.29289Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function Navbar() {
  const [accountModalOpen, setAccountModalOpen] = useState(false)

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__logo" onClick={() => triggerHaptic('light')}>
          czutka<span className="navbar__logo-dotgg">.gg</span>
        </Link>

        <nav className="navbar__nav" aria-label="Główna nawigacja">
          <NavLink
            to="/darmowe-nagrody"
            className="navbar__link"
            end
            aria-label="Darmowe nagrody"
            onClick={() => triggerHaptic('selection')}
          >
            <span className="navbar__link-content">
              <NavbarGiftIcon className="navbar__link-icon" />
              <span className="navbar__link-text navbar__link-text--full">Darmowe nagrody</span>
              <span className="navbar__link-text navbar__link-text--short" aria-hidden>
                Nagrody
              </span>
            </span>
            <span className="navbar__badge">4</span>
          </NavLink>
        </nav>

        <button
          type="button"
          className="navbar__cta"
          onClick={() => {
            triggerHaptic('medium')
            setAccountModalOpen(true)
          }}
        >
          <span className="navbar__cta-label">Stwórz konto</span>
          <NavbarChevronIcon className="navbar__cta-icon" />
        </button>
      </div>
      {accountModalOpen && <CreateAccountModal onClose={() => setAccountModalOpen(false)} />}
    </header>
  )
}
