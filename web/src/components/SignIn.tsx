import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { GoogleIcon } from './GoogleIcon'
import { DLogo } from './DLogo'

export function SignIn() {
  const { signIn } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <DLogo className="size-16 rounded-2xl shadow-lg shadow-primary/20" />
        <h1 className="text-2xl font-semibold tracking-tight">Davis Budget</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Private family budget tracker for John &amp; Hillary.
        </p>
      </div>

      <Button size="lg" onClick={signIn} className="h-12 gap-3 px-6 text-base">
        <GoogleIcon className="size-5" />
        Sign in with Google
      </Button>
    </div>
  )
}
