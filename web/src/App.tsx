import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { DataProvider } from '@/lib/data'
import { SignIn } from '@/components/SignIn'
import { NotAuthorized } from '@/components/NotAuthorized'
import { AppShell } from '@/components/AppShell'
import { NotificationListener } from '@/components/NotificationListener'
import { HomePage } from '@/pages/HomePage'
import { AddTransactionPage } from '@/pages/AddTransactionPage'
import { EditTransactionPage } from '@/pages/EditTransactionPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { RecurringPage } from '@/pages/RecurringPage'
import { HSAPage } from '@/pages/HSAPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { ScenariosPage } from '@/pages/ScenariosPage'
import { ScenarioEditor } from '@/pages/ScenarioEditor'
import { ScanPage } from '@/pages/ScanPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
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
    <DataProvider>
      <NotificationListener />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/add" element={<AddTransactionPage />} />
            <Route path="/edit/:id" element={<EditTransactionPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
            <Route path="/hsa" element={<HSAPage />} />
            <Route path="/scenarios" element={<ScenariosPage />} />
            <Route path="/scenarios/:id" element={<ScenarioEditor />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
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
    </DataProvider>
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
