import { onCall } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import JSZip from 'jszip'
import { assertAllowed } from './lib/auth'

const REGION = 'us-central1'
const BUCKET = 'davis-budget-v4-receipts'

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Build a ZIP of receipts + a manifest for an audit (default: HSA, a tax year).
 * Uploads to Storage and returns the path; the authenticated client fetches a
 * download URL for it.
 */
export const exportAuditZip = onCall(
  { region: REGION, memory: '1GiB', timeoutSeconds: 300 },
  async (req) => {
    await assertAllowed(req)
    const { scope = 'hsa', year } = (req.data ?? {}) as {
      scope?: 'hsa' | 'all'
      year?: number
    }

    const db = getFirestore()
    const snap =
      scope === 'hsa'
        ? await db.collection('transactions').where('hsa', '==', true).get()
        : await db.collection('transactions').get()

    let docs: Record<string, any>[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, any>),
    }))
    if (year) docs = docs.filter((t) => String(t.date ?? '').startsWith(String(year)))
    docs.sort((a, b) => String(a.date).localeCompare(String(b.date)))

    const zip = new JSZip()
    const bucket = getStorage().bucket(BUCKET)
    const manifest: unknown[][] = [
      [
        'Date',
        'Category',
        'Description',
        'Tags',
        'Amount',
        'HSA',
        'HSA amount',
        'Reimbursed date',
        'Receipt files',
      ],
    ]

    let fileCount = 0
    for (const t of docs) {
      const [files] = await bucket.getFiles({ prefix: `receipts/${t.id}/` })
      const names: string[] = []
      for (const f of files) {
        const [buf] = await f.download()
        const base = f.name.split('/').pop() ?? 'receipt'
        const safe = `${t.date}_${String(t.category ?? '').replace(/\W+/g, '')}_${String(
          t.id,
        ).slice(0, 6)}_${base}`
        zip.file(`receipts/${safe}`, buf)
        names.push(safe)
        fileCount++
      }
      manifest.push([
        t.date,
        t.category,
        t.description,
        Array.isArray(t.tags) ? t.tags.join('; ') : '',
        typeof t.amount === 'number' ? t.amount.toFixed(2) : '',
        t.hsa ? 'Yes' : 'No',
        typeof t.hsaReimbursedAmount === 'number'
          ? t.hsaReimbursedAmount.toFixed(2)
          : '',
        t.hsaReimbursedDate ?? '',
        names.join('; '),
      ])
    }

    const csv = manifest.map((r) => r.map(csvCell).join(',')).join('\r\n')
    zip.file('manifest.csv', csv)

    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    const label = `${scope}${year ? `-${year}` : ''}`
    const path = `exports/audit-${label}-${Date.now()}.zip`
    await bucket.file(path).save(buf, { contentType: 'application/zip' })

    return { path, transactions: docs.length, files: fileCount }
  },
)
