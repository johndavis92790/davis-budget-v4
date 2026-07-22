import { getToken, onMessage } from 'firebase/messaging'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { getMessagingIfSupported, db } from './firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

/** Stable per-browser id so re-registrations replace this device's old token. */
function getDeviceId(): string {
  let id = localStorage.getItem('davis-device-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('davis-device-id', id)
  }
  return id
}

export function notificationsConfigured(): boolean {
  return !!VAPID_KEY
}

export function notificationStatus(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

type Result = { ok: boolean; reason?: string }

/** Get the FCM token for this device and store it. Idempotent. */
async function registerToken(userEmail: string): Promise<Result> {
  if (!VAPID_KEY) return { ok: false, reason: 'not-configured' }
  const messaging = await getMessagingIfSupported()
  if (!messaging) return { ok: false, reason: 'unsupported' }
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    await navigator.serviceWorker.ready
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    })
    if (!token) return { ok: false, reason: 'no-token' }
    const deviceId = getDeviceId()
    await setDoc(doc(db, 'fcmTokens', token), {
      token,
      userEmail,
      deviceId,
      platform: navigator.userAgent,
      createdAt: serverTimestamp(),
    })
    // Drop any older token for this same device+user so it isn't notified twice.
    try {
      const snap = await getDocs(
        query(collection(db, 'fcmTokens'), where('userEmail', '==', userEmail)),
      )
      await Promise.all(
        snap.docs
          .filter((d) => d.id !== token && d.data().deviceId === deviceId)
          .map((d) => deleteDoc(d.ref)),
      )
    } catch (e) {
      console.warn('token dedupe skipped', e)
    }
    return { ok: true }
  } catch (e) {
    console.error('FCM token registration failed:', e)
    return { ok: false, reason: 'error' }
  }
}

/** Ask for permission (if needed) and register the device token. */
export async function enableNotifications(userEmail: string): Promise<Result> {
  if (!VAPID_KEY) return { ok: false, reason: 'not-configured' }
  const messaging = await getMessagingIfSupported()
  if (!messaging) return { ok: false, reason: 'unsupported' }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: permission }
  return registerToken(userEmail)
}

/** If permission is already granted, make sure this device's token is stored. */
export async function ensureRegistered(userEmail: string): Promise<Result> {
  if (notificationStatus() !== 'granted') return { ok: false, reason: 'not-granted' }
  return registerToken(userEmail)
}

/** Show foreground messages once (FCM doesn't auto-display when the app is open). */
export async function listenForeground(): Promise<() => void> {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return () => {}
  return onMessage(messaging, (payload) => {
    const d = (payload.data ?? {}) as { title?: string; body?: string }
    const title = d.title ?? 'Davis Budget'
    const body = d.body ?? ''
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.showNotification(title, { body, icon: '/pwa-192.png' })
      })
    }
  })
}

export async function disableNotifications(): Promise<void> {
  if (!VAPID_KEY) return
  const messaging = await getMessagingIfSupported()
  if (!messaging) return
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (token) await deleteDoc(doc(db, 'fcmTokens', token))
  } catch {
    /* ignore */
  }
}
