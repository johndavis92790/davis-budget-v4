import { useEffect } from 'react'
import { toast } from 'sonner'
import { listenForeground } from '@/lib/notifications'

/** Surfaces incoming push notifications while the app is in the foreground. */
export function NotificationListener() {
  useEffect(() => {
    let active = true
    let unsub = () => {}
    listenForeground((title, body) => toast(title, { description: body })).then(
      (u) => {
        if (active) unsub = u
        else u()
      },
    )
    return () => {
      active = false
      unsub()
    }
  }, [])
  return null
}
