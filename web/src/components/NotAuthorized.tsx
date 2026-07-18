import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

export function NotAuthorized() {
  const { user, signOutUser } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldAlert className="size-8" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Not authorized
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          <span className="text-foreground">{user?.email}</span> isn&apos;t on
          the household allowlist for this app.
        </p>
      </div>
      <Button variant="outline" onClick={signOutUser}>
        Sign out
      </Button>
    </div>
  )
}
