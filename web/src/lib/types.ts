import type { Timestamp } from 'firebase/firestore'

export type TransactionType =
  | 'expense'
  | 'refund'
  | 'income'
  | 'recurring-expense'
  | 'recurring-income'
  | 'reimbursement' // HSA reimbursement (money back into the budget)
  | 'adjustment' // manual nudge to the available-funds ledger

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD (calendar date)
  sortTime: number // input-order tiebreak within a day (ms since epoch)
  type: TransactionType
  category: string
  tags: string[]
  amount: number // dollars, positive magnitude (adjustments store signed)
  description: string

  // HSA
  hsa?: boolean
  hsaReimbursedAmount?: number | null
  hsaReimbursedDate?: string | null
  hsaNotes?: string | null
  reimbursementId?: string | null // reimbursement txn that covered this HSA expense

  // Links
  refundedFromId?: string | null // for a refund: the expense it refunds
  linkedExpenseIds?: string[] // for a reimbursement: the HSA expenses it covers
  recurringTemplateId?: string | null // for a materialized recurring txn

  // Attachments (stored at receipts/{id}/...)
  receiptCount?: number

  // Denormalized fiscal keys (computed from date)
  fiscalYearKey: string
  fiscalMonthKey: string
  fiscalWeekKey: string

  createdBy?: string
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}

export type TransactionInput = Omit<
  Transaction,
  | 'id'
  | 'sortTime'
  | 'fiscalYearKey'
  | 'fiscalMonthKey'
  | 'fiscalWeekKey'
  | 'createdAt'
  | 'updatedAt'
>

export interface RecurringTemplate {
  id: string
  type: 'income' | 'expense'
  category: string
  tags: string[]
  value: number // calendar-monthly dollars
  description: string
  active: boolean
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}

export interface ScenarioItem {
  type: 'income' | 'expense'
  category: string
  tags: string[]
  value: number
  description: string
}

export interface Scenario {
  id: string
  name: string
  items: ScenarioItem[]
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}

export interface WeeklyGoal {
  fiscalWeekKey: string
  target: number
  updatedBy?: string
  updatedAt?: Timestamp | null
}

export interface Tag {
  name: string
}

/** Anchors the rolling monthly "available funds" ledger (meta/ledger). */
export interface LedgerAnchor {
  anchorDate: string // YYYY-MM-DD; sums transactions on/after this date
  openingBalance: number
}

/** Signed dollar impact of a transaction on the budget balance. */
export function signedAmount(t: Pick<Transaction, 'type' | 'amount'>): number {
  switch (t.type) {
    case 'expense':
    case 'recurring-expense':
      return -t.amount
    case 'refund':
    case 'income':
    case 'recurring-income':
    case 'reimbursement':
      return t.amount
    case 'adjustment':
      return t.amount // stored signed
    default:
      return 0
  }
}

export function isExpenseType(type: TransactionType): boolean {
  return type === 'expense' || type === 'recurring-expense'
}

export function isRecurringType(type: TransactionType): boolean {
  return type === 'recurring-expense' || type === 'recurring-income'
}

/** An HSA expense counts as reimbursed if it has a reimbursed amount or date. */
export function isReimbursed(
  t: Pick<Transaction, 'hsaReimbursedAmount' | 'hsaReimbursedDate'>,
): boolean {
  return (t.hsaReimbursedAmount ?? 0) > 0 || !!t.hsaReimbursedDate
}

export const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Expense',
  refund: 'Refund',
  income: 'Income',
  'recurring-expense': 'Recurring expense',
  'recurring-income': 'Recurring income',
  reimbursement: 'HSA reimbursement',
  adjustment: 'Adjustment',
}
