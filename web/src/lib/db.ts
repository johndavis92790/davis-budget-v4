import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { getFiscal, todayIso } from './fiscal'
import { roundMoney, sumMoney } from './money'
import type {
  RecurringTemplate,
  Scenario,
  Transaction,
  TransactionInput,
} from './types'

export const transactionsCol = collection(db, 'transactions')
export const recurringCol = collection(db, 'recurringTemplates')
export const tagsCol = collection(db, 'tags')
export const weeklyGoalsCol = collection(db, 'weeklyGoals')
export const scenariosCol = collection(db, 'scenarios')
export const metaCol = collection(db, 'meta')

function fiscalKeys(date: string) {
  const f = getFiscal(date)
  return {
    fiscalYearKey: f.yearKey,
    fiscalMonthKey: f.monthKey,
    fiscalWeekKey: f.weekKey,
  }
}

// Strip undefined so Firestore doesn't choke.
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v
  return out as T
}

// ---------- Transactions ----------

export async function addTransaction(
  input: TransactionInput,
  createdBy?: string,
  sortTime?: number,
): Promise<string> {
  const ref = doc(transactionsCol)
  await setDoc(
    ref,
    clean({
      ...input,
      amount: roundMoney(input.amount),
      id: ref.id,
      sortTime: sortTime ?? Date.now(),
      ...fiscalKeys(input.date),
      createdBy: createdBy ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
  if (input.tags?.length) await ensureTags(input.tags)
  return ref.id
}

export async function updateTransaction(
  id: string,
  patch: Partial<TransactionInput>,
) {
  const update: Record<string, unknown> = {
    ...patch,
    updatedAt: serverTimestamp(),
  }
  if (patch.amount != null) update.amount = roundMoney(patch.amount)
  if (patch.date) Object.assign(update, fiscalKeys(patch.date))
  await updateDoc(doc(transactionsCol, id), clean(update))
  if (patch.tags?.length) await ensureTags(patch.tags)
}

export async function deleteTransaction(id: string) {
  await deleteDoc(doc(transactionsCol, id))
}

/** Create a refund tied to an expense (defaults to the expense's amount). */
export async function addRefundForExpense(
  expense: Transaction,
  opts: { amount: number; date: string; description?: string },
  createdBy?: string,
): Promise<string> {
  return addTransaction(
    {
      date: opts.date,
      type: 'refund',
      category: expense.category,
      tags: expense.tags ?? [],
      amount: opts.amount,
      description: opts.description ?? `Refund: ${expense.description || expense.category}`,
      refundedFromId: expense.id,
    },
    createdBy,
  )
}

/** Reimburse one or more HSA expenses: one linked income txn + mark them paid. */
export async function reimburseHsaExpenses(
  items: { expense: Transaction; amount: number }[],
  reimbursedDate: string,
  createdBy?: string,
): Promise<string> {
  const total = sumMoney(items.map((i) => i.amount))
  const ref = doc(transactionsCol)
  const batch = writeBatch(db)
  batch.set(
    ref,
    clean({
      id: ref.id,
      date: reimbursedDate,
      sortTime: Date.now(),
      type: 'reimbursement',
      category: 'Health',
      tags: ['HSA', 'Reimbursement'],
      amount: total,
      description: `HSA reimbursement · ${items.length} item${items.length > 1 ? 's' : ''}`,
      linkedExpenseIds: items.map((i) => i.expense.id),
      ...fiscalKeys(reimbursedDate),
      createdBy: createdBy ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
  items.forEach((it) => {
    batch.update(doc(transactionsCol, it.expense.id), {
      reimbursementId: ref.id,
      hsaReimbursedDate: reimbursedDate,
      hsaReimbursedAmount: roundMoney(it.amount),
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
  return ref.id
}

/** Undo a reimbursement: delete the income txn and clear links on its expenses. */
export async function undoReimbursement(
  reimbursement: Transaction,
  linkedExpenses: Transaction[],
) {
  const batch = writeBatch(db)
  batch.delete(doc(transactionsCol, reimbursement.id))
  for (const e of linkedExpenses) {
    batch.update(doc(transactionsCol, e.id), {
      reimbursementId: null,
      hsaReimbursedDate: null,
      hsaReimbursedAmount: null,
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

/** Clear reimbursed status on a single HSA expense (e.g. a migrated one). */
export async function clearHsaReimbursement(id: string) {
  await updateDoc(doc(transactionsCol, id), {
    reimbursementId: null,
    hsaReimbursedDate: null,
    hsaReimbursedAmount: null,
    updatedAt: serverTimestamp(),
  })
}

// ---------- Tags ----------

export async function ensureTags(tags: string[]) {
  const batch = writeBatch(db)
  let count = 0
  for (const t of tags) {
    const name = t.trim()
    if (!name) continue
    batch.set(doc(tagsCol, name.toLowerCase()), { name }, { merge: true })
    count++
  }
  if (count) await batch.commit()
}

// ---------- Recurring templates ----------

export async function addRecurring(
  input: Omit<RecurringTemplate, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = doc(recurringCol)
  await setDoc(
    ref,
    clean({
      ...input,
      value: roundMoney(input.value),
      id: ref.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
  if (input.tags?.length) await ensureTags(input.tags)
  return ref.id
}

export async function updateRecurring(
  id: string,
  patch: Partial<Omit<RecurringTemplate, 'id'>>,
) {
  const update: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() }
  if (patch.value != null) update.value = roundMoney(patch.value)
  await updateDoc(doc(recurringCol, id), clean(update))
  if (patch.tags?.length) await ensureTags(patch.tags)
}

export async function deleteRecurring(id: string) {
  await deleteDoc(doc(recurringCol, id))
}

// ---------- Weekly goal ----------

export async function setWeeklyGoal(
  weekKey: string,
  target: number,
  updatedBy?: string,
) {
  await setDoc(
    doc(weeklyGoalsCol, weekKey),
    clean({
      fiscalWeekKey: weekKey,
      target: roundMoney(target),
      updatedBy: updatedBy ?? null,
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  )
}

// ---------- Ledger anchor (rolling available funds) ----------

export async function setLedgerAnchor(anchorDate: string, openingBalance: number) {
  await setDoc(doc(metaCol, 'ledger'), {
    anchorDate,
    openingBalance: roundMoney(openingBalance),
    updatedAt: serverTimestamp(),
  })
}

/** Override available funds by writing a signed adjustment entry for the delta. */
export async function adjustAvailableFunds(
  current: number,
  desired: number,
  by?: string,
): Promise<string | undefined> {
  const diff = roundMoney(desired - current)
  if (diff === 0) return undefined
  return addTransaction(
    {
      date: todayIso(),
      type: 'adjustment',
      category: 'Other',
      tags: ['Adjustment'],
      amount: diff,
      description: 'Available funds adjustment',
    },
    by,
  )
}

// ---------- Scenarios ----------

export async function addScenario(
  input: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = doc(scenariosCol)
  await setDoc(ref, {
    ...input,
    id: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateScenario(
  id: string,
  patch: Partial<Omit<Scenario, 'id'>>,
) {
  await updateDoc(doc(scenariosCol, id), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteScenario(id: string) {
  await deleteDoc(doc(scenariosCol, id))
}
