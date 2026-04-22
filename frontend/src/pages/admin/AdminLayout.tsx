import { useEffect, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { checkAdminSession, adminLogout } from '../../api/client'
import { triggerHaptic } from '../../lib/haptics'
import { AdminProvider } from '../../context/AdminContext'
import { AdminLoginPage } from './AdminLoginPage'
import { BetsIcon, ResolutionIcon, PersonIcon, PeopleIcon, PaymentsIcon, PromoCodeIcon, TapeIcon, LogoutIcon } from './adminIcons'
import './_shared.css'
import './AdminLayout.css'

type IconComponent = ComponentType<{ className?: string }>
type NavItem = { to: string; label: string; Icon: IconComponent }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Events',
    items: [
      { to: '/admin/bets', label: 'Bets', Icon: BetsIcon },
      { to: '/admin/tapes', label: 'Taśmy', Icon: TapeIcon },
      { to: '/admin/resolution', label: 'Resolution', Icon: ResolutionIcon },
    ],
  },
  {
    title: 'Accounts',
    items: [
      { to: '/admin/people', label: 'People', Icon: PersonIcon },
      { to: '/admin/users', label: 'Users', Icon: PeopleIcon },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/admin/payments', label: 'Payments', Icon: PaymentsIcon },
      { to: '/admin/codes', label: 'Codes', Icon: PromoCodeIcon },
    ],
  },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    checkAdminSession().then(ok => { if (alive) setAuthed(ok) })
    return () => { alive = false }
  }, [])

  if (authed === null) {
    return <div className="admin-shell" />
  }

  if (!authed) {
    return <AdminLoginPage onLogin={() => setAuthed(true)} />
  }

  const handleLogout = async () => {
    triggerHaptic('medium')
    await adminLogout()
    setAuthed(false)
  }

  return (
    <AdminProvider>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <button
            className="admin-sidebar__logo"
            onClick={() => {
              triggerHaptic('light')
              navigate('/')
            }}
            title="Back to site"
          >
            <span className="admin-sidebar__logo-mark">czutka</span>
            <span className="admin-sidebar__logo-tag">admin</span>
          </button>

          <nav className="admin-sidebar__nav">
            {NAV_GROUPS.map(group => (
              <div key={group.title} className="admin-sidebar__group">
                <span className="admin-sidebar__group-title">{group.title}</span>
                {group.items.map(({ to, label, Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      ['admin-sidebar__link', isActive ? 'admin-sidebar__link--active' : ''].join(' ').trim()
                    }
                    onClick={() => triggerHaptic('selection')}
                  >
                    <Icon className="admin-sidebar__link-icon" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="admin-sidebar__footer">
            <button
              type="button"
              className="admin-sidebar__logout"
              onClick={handleLogout}
            >
              <LogoutIcon className="admin-sidebar__logout-icon" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </AdminProvider>
  )
}
