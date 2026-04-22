import { Outlet } from 'react-router-dom'
import { BetSidebar } from '../components/BetSidebar'
import { Navbar } from '../components/Navbar'

export function ShellLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
      <BetSidebar />
    </>
  )
}
