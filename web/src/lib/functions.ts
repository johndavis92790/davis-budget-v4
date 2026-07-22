import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from './firebase'

export const fns = getFunctions(app, 'us-central1')

export interface ScanLineItem {
  description: string
  amount: number
  category: string
  hsa?: boolean
}

export interface ScanResult {
  type: 'expense' | 'income' | 'refund'
  amount: number
  date?: string
  category: string
  description: string
  merchant?: string
  tags?: string[]
  hsa?: boolean
  lineItems?: ScanLineItem[]
}

export const scanReceiptFn = httpsCallable<
  { imageBase64: string; mimeType: string },
  ScanResult
>(fns, 'scanReceipt')

export const materializeRecurringNowFn = httpsCallable<
  { date?: string },
  { created: number; skipped: boolean; monthKey: string }
>(fns, 'materializeRecurringNow')

export const syncBigQueryNowFn = httpsCallable<void, { rows: number }>(
  fns,
  'syncBigQueryNow',
)

export const exportAuditZipFn = httpsCallable<
  { scope?: 'hsa' | 'all'; year?: number },
  { path: string; transactions: number; files: number }
>(fns, 'exportAuditZip')

export const sendTestNotificationFn = httpsCallable<void, { sent: number }>(
  fns,
  'sendTestNotification',
)
