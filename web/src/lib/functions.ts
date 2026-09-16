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

export interface InsightsSummary {
  label: string
  totalSpent: number
  totalIncome: number
  net: number
  byCategory: { category: string; amount: number }[]
  byTag: { tag: string; amount: number }[]
  topExpenses: { description: string; category: string; amount: number; date: string }[]
  priorPeriodSpent?: number
  hsa?: { total: number; reimbursed: number; outstanding: number }
}

export const generateInsightsFn = httpsCallable<
  InsightsSummary,
  { insights: string[] }
>(fns, 'generateInsights')
