import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Menu,
  X,
  Home,
  ReceiptText,
  CalendarDays,
  Repeat,
  HeartPulse,
  Lightbulb,
  BarChart3,
  Bell,
  Users,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { DLogo } from './DLogo'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/history', label: 'History', icon: ReceiptText, end: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
  { to: '/recurring', label: 'Recurring', icon: Repeat, end: false },
  { to: '/hsa', label: 'HSA', icon: HeartPulse, end: false },
  { to: '/scenarios', label: 'Scenarios', icon: Lightbulb, end: false },
  { to: '/reports', label: 'Reports', icon: BarChart3, end: false },
  { to: '/notifications', label: 'Notifications', icon: Bell, end: false },
]

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { user, signOutUser, isSuperAdmin } = useAuth()
  const location = useLocation()

  const items = isSuperAdmin
    ? [...NAV, { to: '/users', label: 'Users', icon: Users, end: false }]
    : NAV

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <DLogo className="size-6" />
          <span className="font-semibold tracking-tight">Davis Budget</span>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 animate-in fade-in"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-border bg-card animate-in slide-in-from-left">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <DLogo className="size-6" />
                <span className="font-semibold">Davis Budget</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="size-[18px]" />
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="border-t border-border p-3">
              <div className="truncate px-2 pb-2 text-xs text-muted-foreground">
                {user?.email}
              </div>
              <button
                type="button"
                onClick={signOutUser}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <LogOut className="size-[18px]" />
                Sign out
              </button>
            </div>
          </nav>
        </div>
      )}

      <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
        <Outlet />
      </main>
    </div>
  )
}
