import { useState } from 'react'
import { adminLogin } from '../../api/client'
import { triggerHaptic } from '../../lib/haptics'
import './AdminLoginPage.css'

type Props = { onLogin: () => void }

export function AdminLoginPage({ onLogin }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    triggerHaptic('medium')
    setError('')
    setLoading(true)
    try {
      await adminLogin(password)
      onLogin()
    } catch {
      setError('Invalid password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__form" onSubmit={handleSubmit}>
        <div className="admin-login__logo">
          <span className="admin-login__logo-mark">czutka</span>
          <span className="admin-login__logo-tag">admin</span>
        </div>
        <input
          className="admin-login__input"
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="admin-login__error">{error}</p>}
        <button className="admin-login__btn" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
