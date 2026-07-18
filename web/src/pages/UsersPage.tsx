import { useEffect, useState, type FormEvent } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { UserPlus, Trash2, ShieldCheck, User as UserIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/lib/auth'
import {
  addAllowedUser,
  removeAllowedUser,
  isValidEmail,
  usersCollection,
  type AllowedUser,
} from '@/lib/users'

export function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AllowedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [toRemove, setToRemove] = useState<AllowedUser | null>(null)

  useEffect(() => {
    return onSnapshot(
      usersCollection,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as AllowedUser)
        list.sort((a, b) => {
          if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
          return a.email.localeCompare(b.email)
        })
        setUsers(list)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!isValidEmail(value)) {
      toast.error('Enter a valid email address')
      return
    }
    if (users.some((u) => u.email === value)) {
      toast.error('That person already has access')
      return
    }
    setAdding(true)
    try {
      await addAllowedUser(value, user?.email ?? 'unknown')
      toast.success(`Added ${value}`)
      setEmail('')
    } catch {
      toast.error('Could not add user')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove() {
    if (!toRemove) return
    try {
      await removeAllowedUser(toRemove.email)
      toast.success(`Removed ${toRemove.email}`)
    } catch {
      toast.error('Could not remove user')
    }
    setToRemove(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who can access Davis Budget. Only you can add or remove people.
        </p>
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex gap-2">
          <Input
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="name@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={adding} className="gap-2">
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          They sign in with this Google account. Access takes effect the next
          time they open the app.
        </p>
      </form>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          users.map((u) => {
            const isOwner = u.role === 'owner'
            const isSelf = u.email === user?.email?.toLowerCase()
            return (
              <div
                key={u.email}
                className="flex items-center gap-3 rounded-xl bg-card px-4 py-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {isOwner ? (
                    <ShieldCheck className="size-[18px]" />
                  ) : (
                    <UserIcon className="size-[18px]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{u.email}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant={isOwner ? 'default' : 'secondary'}>
                      {isOwner ? 'Owner' : 'Member'}
                    </Badge>
                    {isSelf && (
                      <span className="text-xs text-muted-foreground">You</span>
                    )}
                  </div>
                </div>
                {!isOwner && (
                  <button
                    type="button"
                    onClick={() => setToRemove(u)}
                    aria-label={`Remove ${u.email}`}
                    className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-[18px]" />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      <AlertDialog
        open={!!toRemove}
        onOpenChange={(open) => !open && setToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove access?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.email} will lose access to Davis Budget. You can add
              them back anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
