import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall } from 'firebase-functions/v2/https'
import { BigQuery } from '@google-cloud/bigquery'
import { Readable } from 'stream'
import { assertAllowed } from './lib/auth'

const REGION = 'us-central1'
const DATASET = 'budget'
const TABLE = 'transactions'
const BQ_LOCATION = 'US'

const SCHEMA = {
  fields: [
    { name: 'id', type: 'STRING' },
    { name: 'date', type: 'DATE' },
    { name: 'type', type: 'STRING' },
    { name: 'category', type: 'STRING' },
    { name: 'tags', type: 'STRING' },
    { name: 'amount', type: 'FLOAT' },
    { name: 'signedAmount', type: 'FLOAT' },
    { name: 'description', type: 'STRING' },
    { name: 'hsa', type: 'BOOLEAN' },
    { name: 'hsaReimbursedAmount', type: 'FLOAT' },
    { name: 'hsaReimbursedDate', type: 'DATE' },
    { name: 'fiscalYear', type: 'STRING' },
    { name: 'fiscalMonth', type: 'STRING' },
    { name: 'fiscalWeek', type: 'STRING' },
    { name: 'sortTime', type: 'INTEGER' },
  ],
}

function signed(type: string, amount: number): number {
  if (type === 'expense' || type === 'recurring-expense') return -amount
  return amount // income / refund / recurring-income / reimbursement / adjustment(signed)
}

/** Full refresh of the BigQuery transactions table from Firestore. */
export async function syncTransactionsToBigQuery(): Promise<number> {
  const db = getFirestore()
  const bq = new BigQuery({ location: BQ_LOCATION })
  const dataset = bq.dataset(DATASET)
  const [dsExists] = await dataset.exists()
  if (!dsExists) await dataset.create({ location: BQ_LOCATION })
  const table = dataset.table(TABLE)

  const snap = await db.collection('transactions').get()
  const rows = snap.docs.map((d) => {
    const t = d.data()
    const amount = typeof t.amount === 'number' ? t.amount : 0
    return {
      id: t.id ?? d.id,
      date: t.date ?? null,
      type: t.type ?? null,
      category: t.category ?? null,
      tags: Array.isArray(t.tags) ? t.tags.join(', ') : '',
      amount,
      signedAmount: signed(t.type, amount),
      description: t.description ?? '',
      hsa: !!t.hsa,
      hsaReimbursedAmount:
        typeof t.hsaReimbursedAmount === 'number' ? t.hsaReimbursedAmount : null,
      hsaReimbursedDate: t.hsaReimbursedDate ?? null,
      fiscalYear: t.fiscalYearKey ?? null,
      fiscalMonth: t.fiscalMonthKey ?? null,
      fiscalWeek: t.fiscalWeekKey ?? null,
      sortTime: typeof t.sortTime === 'number' ? t.sortTime : null,
    }
  })

  const ndjson = rows.map((r) => JSON.stringify(r)).join('\n')

  await new Promise<void>((resolve, reject) => {
    const ws = table.createWriteStream({
      sourceFormat: 'NEWLINE_DELIMITED_JSON',
      schema: SCHEMA,
      writeDisposition: 'WRITE_TRUNCATE',
      location: BQ_LOCATION,
    })
    ws.on('error', reject)
    ws.on('complete', () => resolve())
    Readable.from([ndjson]).pipe(ws)
  })

  return rows.length
}

export const dailyBigQuerySync = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'America/Denver',
    region: REGION,
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const n = await syncTransactionsToBigQuery()
    console.log('BigQuery sync complete:', n, 'rows')
  },
)

export const syncBigQueryNow = onCall(
  { region: REGION, memory: '512MiB', timeoutSeconds: 300 },
  async (req) => {
    await assertAllowed(req)
    const rows = await syncTransactionsToBigQuery()
    return { rows }
  },
)
