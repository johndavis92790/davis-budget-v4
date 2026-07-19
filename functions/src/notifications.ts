import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onCall } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { assertAllowed } from './lib/auth'

const REGION = 'us-central1'

async function pruneStale(
  tokens: string[],
  responses: { success: boolean; error?: { code?: string } }[],
) {
  const db = getFirestore()
  const stale = tokens.filter((_, i) => {
    const code = responses[i]?.error?.code
    return (
      !responses[i]?.success &&
      (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token')
    )
  })
  await Promise.all(
    stale.map((tk) => db.collection('fcmTokens').doc(tk).delete().catch(() => undefined)),
  )
}

// Sends a test push to the caller's own registered devices.
export const sendTestNotification = onCall({ region: REGION }, async (req) => {
  const email = await assertAllowed(req)
  const db = getFirestore()
  const snap = await db.collection('fcmTokens').get()
  const tokens = snap.docs
    .map((d) => d.data() as { token?: string; userEmail?: string })
    .filter((t) => (t.userEmail ?? '').toLowerCase() === email.toLowerCase())
    .map((t) => t.token)
    .filter((t): t is string => !!t)
  if (!tokens.length) return { sent: 0 }

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: 'Davis Budget',
      body: "Test notification — you're all set! 🎉",
    },
    webpush: { fcmOptions: { link: '/' } },
  })
  await pruneStale(tokens, res.responses)
  return { sent: res.successCount }
})

// Notify the *other* household members when someone changes a transaction.
export const onTransactionWrite = onDocumentWritten(
  { document: 'transactions/{id}', region: REGION },
  async (event) => {
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()
    const docData = after ?? before
    if (!docData) return

    const actor = (after?.createdBy ?? before?.createdBy) as string | undefined
    // Skip machine-generated writes (recurring materialization, migration).
    if (!actor || actor === 'system' || actor === 'migration') return

    let action = 'updated'
    if (!before && after) action = 'added'
    else if (before && !after) action = 'deleted'

    const db = getFirestore()
    const tokensSnap = await db.collection('fcmTokens').get()
    const tokens = tokensSnap.docs
      .map((d) => d.data() as { token?: string; userEmail?: string })
      .filter((t) => (t.userEmail ?? '').toLowerCase() !== actor.toLowerCase())
      .map((t) => t.token)
      .filter((t): t is string => !!t)
    if (!tokens.length) return

    const name = actor.split('@')[0]
    const amount = typeof docData.amount === 'number' ? docData.amount : 0
    const type = String(docData.type ?? 'transaction').replace('-', ' ')
    const title = `${name} ${action} a ${type}`
    const body = `${docData.category} · $${amount.toFixed(2)}${
      docData.description ? ` — ${docData.description}` : ''
    }`

    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: { fcmOptions: { link: '/' } },
    })

    // Clean up tokens that are no longer valid.
    const stale: string[] = []
    res.responses.forEach((r, i) => {
      const code = r.error?.code
      if (
        !r.success &&
        (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token')
      ) {
        stale.push(tokens[i])
      }
    })
    await Promise.all(
      stale.map((tk) =>
        db.collection('fcmTokens').doc(tk).delete().catch(() => undefined),
      ),
    )
  },
)
