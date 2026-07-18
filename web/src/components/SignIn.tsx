import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { GoogleIcon } from './GoogleIcon'

export function SignIn() {
  const { signIn } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wallet className="size-8" />
        </div>
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
