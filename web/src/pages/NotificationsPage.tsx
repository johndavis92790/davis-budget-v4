import { useState } from 'react'
import { Bell, BellOff, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { sendTestNotificationFn } from '@/lib/functions'
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
  const [testing, setTesting] = useState(false)
  const configured = notificationsConfigured()

  async function sendTest() {
    setTesting(true)
    try {
      const r = await sendTestNotificationFn()
      if (r.data.sent > 0) toast.success('Test sent — check your notifications')
      else toast.error('No registered device found on your account yet')
    } catch {
      toast.error('Could not send test')
    } finally {
      setTesting(false)
    }
  }

  async function enable() {
    setBusy(true)
    const r = await enableNotifications(user?.email ?? '')
    setStatus(notificationStatus())
    setBusy(false)
    if (r.ok) toast.success('Notifications enabled on this device')
    else if (r.reason === 'denied') toast.error('Blocked in your browser settings')
    else if (r.reason === 'default') toast.error('Prompt dismissed — tap Enable again')
    else if (r.reason === 'not-configured') toast.error('Not activated yet')
    else if (r.reason === 'unsupported')
      toast.error('This browser doesn’t support push')
    else toast.error('Could not enable notifications')
  }

  async function disable() {
    setBusy(true)
    await disableNotifications()
    setBusy(false)
    toast.success('Notifications disabled on this device')
  }

  const enabled = status === 'granted'
  const blocked = status === 'denied'

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
            <div className="flex flex-wrap gap-2">
              <Button onClick={sendTest} disabled={testing} className="gap-2">
                {testing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send test
              </Button>
              <Button
                variant="outline"
                onClick={disable}
                disabled={busy}
                className="gap-2"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BellOff className="size-4" />
                )}
                Turn off on this device
              </Button>
            </div>
          ) : (
            <Button onClick={enable} disabled={busy || !configured} className="gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
              Enable notifications
            </Button>
          )}
        </div>
      </div>

      {blocked && (
        <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500">
          <div className="font-medium">Notifications are blocked for this site</div>
          <p className="text-amber-500/90">
            Your browser is blocking the permission prompt. To turn them on:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-amber-500/90">
            <li>Tap the tune/settings icon just left of the address bar</li>
            <li>Open Permissions → Notifications</li>
            <li>Switch it to Allow, then tap Enable again</li>
          </ol>
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
