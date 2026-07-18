import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { SignIn } from '@/components/SignIn'
import { NotAuthorized } from '@/components/NotAuthorized'
import { AppShell } from '@/components/AppShell'
import { HomePage } from '@/pages/HomePage'
import { Placeholder } from '@/pages/Placeholder'
import { UsersPage } from '@/pages/UsersPage'
import { Toaster } from '@/components/ui/sonner'

function AdminRoute({ children }: { children: ReactNode }) {
  const { isSuperAdmin } = useAuth()
  return isSuperAdmin ? <>{children}</> : <Navigate to="/" replace />
}

function Gate() {
  const { user, loading, authorized } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return <SignIn />
  if (!authorized) return <NotAuthorized />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/history" element={<Placeholder title="History" />} />
          <Route
            path="/recurring"
            element={<Placeholder title="Recurring budget" />}
          />
          <Route path="/hsa" element={<Placeholder title="HSA expenses" />} />
          <Route path="/scenarios" element={<Placeholder title="Scenarios" />} />
          <Route path="/reports" element={<Placeholder title="Reports" />} />
          <Route
            path="/notifications"
            element={<Placeholder title="Notifications" />}
          />
          <Route
            path="/users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
      <Toaster position="top-center" />
    </AuthProvider>
  )
}
