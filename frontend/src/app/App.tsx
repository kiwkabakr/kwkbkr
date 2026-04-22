import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BetsProvider } from '../context/BetsContext'
import { LoadingOverlayProvider } from '../context/LoadingOverlayContext'
import { FullPageLoader } from '../components/FullPageLoader'
import { ShellLayout } from '../layouts/ShellLayout'
import { MainPage } from '../pages/MainPage'

// Everything except the main page is route-split. Admin code alone is a large slice
// of the bundle that 99% of visitors never load; non-main public routes are also
// lazy so the first paint ships only what the landing page needs.
const BetPage = lazy(() => import('../pages/BetPage').then(m => ({ default: m.BetPage })))
const DarmoweNagrodyPage = lazy(() =>
  import('../pages/DarmoweNagrodyPage').then(m => ({ default: m.DarmoweNagrodyPage })),
)
const DepositPage = lazy(() => import('../pages/DepositPage').then(m => ({ default: m.DepositPage })))
const LoginPage = lazy(() => import('../pages/LoginPage').then(m => ({ default: m.LoginPage })))
const PayoutPage = lazy(() => import('../pages/PayoutPage').then(m => ({ default: m.PayoutPage })))
const PolitykaPrywatnosciPage = lazy(() =>
  import('../pages/PolitykaPrywatnosciPage').then(m => ({ default: m.PolitykaPrywatnosciPage })),
)
const PrawnePage = lazy(() => import('../pages/PrawnePage').then(m => ({ default: m.PrawnePage })))
const ProfilePage = lazy(() => import('../pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const RegulaminPage = lazy(() => import('../pages/RegulaminPage').then(m => ({ default: m.RegulaminPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ToSPage = lazy(() => import('../pages/ToSPage').then(m => ({ default: m.ToSPage })))
const TransactionsHistoryPage = lazy(() =>
  import('../pages/TransactionsHistoryPage').then(m => ({ default: m.TransactionsHistoryPage })),
)
const YourBetsPage = lazy(() => import('../pages/YourBetsPage').then(m => ({ default: m.YourBetsPage })))

const AdminLayout = lazy(() => import('../pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })))
const AdminBetsPage = lazy(() => import('../pages/admin/AdminBetsPage').then(m => ({ default: m.AdminBetsPage })))
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })))
const AdminPeoplePage = lazy(() =>
  import('../pages/admin/AdminPeoplePage').then(m => ({ default: m.AdminPeoplePage })),
)
const AdminResolutionPage = lazy(() =>
  import('../pages/admin/AdminResolutionPage').then(m => ({ default: m.AdminResolutionPage })),
)
const AdminPaymentsPage = lazy(() =>
  import('../pages/admin/AdminPaymentsPage').then(m => ({ default: m.AdminPaymentsPage })),
)
const AdminPromoCodesPage = lazy(() =>
  import('../pages/admin/AdminPromoCodesPage').then(m => ({ default: m.AdminPromoCodesPage })),
)
const AdminTapesPage = lazy(() =>
  import('../pages/admin/AdminTapesPage').then(m => ({ default: m.AdminTapesPage })),
)

export default function App() {
  return (
    <LoadingOverlayProvider>
      <BetsProvider>
        <BrowserRouter>
          {/* Suspense fallback covers the brief lazy-chunk download window so
              users see the same loader continuously from route click → data ready. */}
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/bets" replace />} />
                <Route path="bets" element={<AdminBetsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="people" element={<AdminPeoplePage />} />
                <Route path="resolution" element={<AdminResolutionPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="codes" element={<AdminPromoCodesPage />} />
                <Route path="tapes" element={<AdminTapesPage />} />
              </Route>
              <Route element={<ShellLayout />}>
                <Route path="/" element={<MainPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/darmowe-nagrody" element={<DarmoweNagrodyPage />} />
                <Route path="/bet/:id" element={<BetPage />} />
                <Route path="/your-bets" element={<YourBetsPage />} />
                <Route path="/payout" element={<PayoutPage />} />
                <Route path="/deposit" element={<DepositPage />} />
                <Route path="/transactions" element={<TransactionsHistoryPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/prawne" element={<PrawnePage />} />
                <Route path="/prawne/tos" element={<ToSPage />} />
                <Route path="/prawne/regulamin" element={<RegulaminPage />} />
                <Route path="/prawne/polityka-prywatnosci" element={<PolitykaPrywatnosciPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </BetsProvider>
    </LoadingOverlayProvider>
  )
}
