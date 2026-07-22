import { roundMoney } from './money'
import { signedAmount, type LedgerAnchor, type Transaction } from './types'

/** Rolling available funds = opening balance + signed sum of txns on/after the anchor date. */
export function availableFunds(
  transactions: Transaction[],
  anchor: LedgerAnchor | null,
): number {
  const since = anchor?.anchorDate ?? '0000-01-01'
  let sum = anchor?.openingBalance ?? 0
  for (const t of transactions) {
    if (t.date >= since) sum += signedAmount(t)
  }
  return roundMoney(sum)
}

/** Net discretionary spend in a fiscal week: non-recurring expenses − refunds. */
export function weekNetSpend(
  transactions: Transaction[],
  weekKey: string,
): number {
  let sum = 0
  for (const t of transactions) {
    if (t.fiscalWeekKey !== weekKey) continue
    if (t.type === 'expense') sum += t.amount
    else if (t.type === 'refund') sum -= t.amount
  }
  return roundMoney(sum)
}

/** Sum of signed amounts within a fiscal month (all types). */
export function monthNet(transactions: Transaction[], monthKey: string): number {
  let sum = 0
  for (const t of transactions) {
    if (t.fiscalMonthKey === monthKey) sum += signedAmount(t)
  }
  return roundMoney(sum)
}
