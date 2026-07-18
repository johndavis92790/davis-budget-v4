import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall } from 'firebase-functions/v2/https'
import { getFiscal, denverToday, midnightMs } from './lib/fiscal'
import { roundMoney } from './lib/money'
import { assertAllowed } from './lib/auth'

const REGION = 'us-central1'

interface Template {
  id?: string
  type: 'income' | 'expense'
  category: string
  tags?: string[]
  value: number
  description?: string
  active?: boolean
}

/**
 * Materialize active recurring templates into history for a fiscal month.
 * Idempotent via meta/materializations. Values are adjusted ×12/13 (13 fiscal
 * periods/year). Ordered income-first then expense, each largest-value first,
 * so sortTime places them largest-first on the month's start day.
 */
export async function materializeMonth(monthKey: string, monthStart: string) {
  const db = getFirestore()
  const markerRef = db.doc('meta/materializations')
  const marker = await markerRef.get()
  const done: string[] =
    (marker.exists && (marker.data()?.months as string[])) || []
  if (done.includes(monthKey)) {
    return { created: 0, skipped: true, monthKey }
  }

  const recSnap = await db
    .collection('recurringTemplates')
    .where('active', '==', true)
    .get()
  const templates = recSnap.docs.map((d) => d.data() as Template)
  const incomes = templates
    .filter((t) => t.type === 'income')
    .sort((a, b) => b.value - a.value)
  const expenses = templates
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.value - a.value)
  const ordered = [...incomes, ...expenses]

  const f = getFiscal(monthStart)
  const midnight = midnightMs(monthStart)
  const batch = db.batch()
  ordered.forEach((t, i) => {
    const ref = db.collection('transactions').doc()
    batch.set(ref, {
      id: ref.id,
      date: monthStart,
      sortTime: midnight + i,
      type: t.type === 'income' ? 'recurring-income' : 'recurring-expense',
      category: t.category,
      tags: t.tags || [],
      amount: roundMoney((t.value * 12) / 13),
      description: t.description || '',
      hsa: false,
      recurringTemplateId: t.id || null,
      fiscalYearKey: f.yearKey,
      fiscalMonthKey: f.monthKey,
      fiscalWeekKey: f.weekKey,
      createdBy: 'system',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
  batch.set(
    markerRef,
    { months: FieldValue.arrayUnion(monthKey), lastRun: FieldValue.serverTimestamp() },
    { merge: true },
  )
  await batch.commit()
  return { created: ordered.length, skipped: false, monthKey }
}

// Runs every morning; materializes the current fiscal month once (idempotent).
export const dailyRecurring = onSchedule(
  { schedule: '0 6 * * *', timeZone: 'America/Denver', region: REGION },
  async () => {
    const f = getFiscal(denverToday())
    const res = await materializeMonth(f.monthKey, f.monthStart)
    console.log('dailyRecurring', f.monthKey, res)
  },
)

// Manual trigger (for testing / catch-up). Optional { date } picks the month.
export const materializeRecurringNow = onCall({ region: REGION }, async (req) => {
  await assertAllowed(req)
  const date = ((req.data as { date?: string })?.date) || denverToday()
  const f = getFiscal(date)
  return materializeMonth(f.monthKey, f.monthStart)
})
