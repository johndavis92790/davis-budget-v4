import { useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import {
  enableNotifications,
  disableNotifications,
  notificationStatus,
  notificationsConfigured,
} from '@/lib/notifications'

export function NotificationsPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState(notificationStatus())
  const [busy, setBusy] = useState(false)
  const configured = notificationsConfigured()

  async function enable() {
    setBusy(true)
    const r = await enableNotifications(user?.email ?? '')
    setStatus(notificationStatus())
    setBusy(false)
    if (r.ok) toast.success('Notifications enabled on this device')
    else if (r.reason === 'denied') toast.error('Permission was blocked')
    else if (r.reason === 'not-configured') toast.error('Not activated yet')
    else toast.error('Could not enable notifications')
  }

  async function disable() {
    setBusy(true)
    await disableNotifications()
    setBusy(false)
    toast.success('Notifications disabled on this device')
  }

  const enabled = status === 'granted'

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>

      <div className="rounded-xl bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {enabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}
          </div>
          <div className="flex-1">
            <div className="font-medium">Household activity</div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Get a push notification on this device when someone in your
              household adds, edits, or deletes a transaction.
            </p>
          </div>
        </div>

        <div className="mt-4">
          {enabled ? (
            <Button variant="outline" onClick={disable} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <BellOff className="size-4" />}
              Turn off on this device
            </Button>
          ) : (
            <Button onClick={enable} disabled={busy || !configured} className="gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
              Enable notifications
            </Button>
          )}
        </div>
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500">
          Notifications aren't activated yet — a Web Push key needs to be added
          in the Firebase console (Cloud Messaging → Web Push certificates).
          Everything else is wired up and ready.
        </div>
      )}

      <ul className="space-y-1 text-sm text-muted-foreground">
        <li>• New expenses added by the other person</li>
        <li>• Edits and deletions</li>
        <li>• Enable it separately on each device you use</li>
      </ul>
    </div>
  )
}
