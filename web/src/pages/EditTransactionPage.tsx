import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Undo2, SplitSquareVertical } from 'lucide-react'
import { toast } from 'sonner'
import { TransactionForm } from '@/components/TransactionForm'
import { TransactionRow } from '@/components/TransactionRow'
import { ReceiptsSection } from '@/components/ReceiptsSection'
import { SplitEditor, type ParsedSplit } from '@/components/SplitEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/lib/auth'
import { useData } from '@/lib/data'
import {
  addTransaction,
  addRefundForExpense,
  deleteTransaction,
  undoReimbursement,
  clearHsaReimbursement,
} from '@/lib/db'
import { copyReceipts } from '@/lib/receipts'
import { parseCurrency, formatCurrency } from '@/lib/money'
import { todayIso, formatDatePretty } from '@/lib/fiscal'
import { isReimbursed, TYPE_LABELS } from '@/lib/types'

export function EditTransactionPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const { transactions } = useData()
  const t = transactions.find((x) => x.id === id)

  const [confirmDel, setConfirmDel] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmt, setRefundAmt] = useState('')
  const [refundDate, setRefundDate] = useState(todayIso())
  const [splitting, setSplitting] = useState(false)
  const [splitSaving, setSplitSaving] = useState(false)
  const [splitDate, setSplitDate] = useState(todayIso())

  if (!t) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Transaction not found.
      </div>
    )
  }

  const refunds = transactions.filter((x) => x.refundedFromId === t.id)
  const reimbursement = t.reimbursementId
    ? transactions.find((x) => x.id === t.reimbursementId)
    : null

  async function del() {
    await deleteTransaction(t!.id)
    toast.success('Deleted')
    nav(-1)
  }

  async function submitRefund() {
    const amt = parseCurrency(refundAmt)
    if (amt <= 0) {
      toast.error('Enter an amount')
      return
    }
    await addRefundForExpense(
      t!,
      { amount: amt, date: refundDate },
      user?.email ?? undefined,
    )
    toast.success('Refund added')
    setRefundOpen(false)
    setRefundAmt('')
  }

  async function undoReimb() {
    if (!reimbursement) return
    const linked = transactions.filter((x) =>
      reimbursement.linkedExpenseIds?.includes(x.id),
    )
    await undoReimbursement(reimbursement, linked)
    toast.success('Reimbursement undone')
  }

  async function markNotReimbursed() {
    await clearHsaReimbursement(t!.id)
    toast.success('Marked as not reimbursed')
  }

  function openSplit() {
    setSplitDate(t!.date)
    setSplitting(true)
  }

  async function doSplit(rows: ParsedSplit[]) {
    setSplitSaving(true)
    try {
      const ids: string[] = []
      for (const r of rows) {
        const id = await addTransaction(
          {
            date: splitDate,
            type: 'expense',
            category: r.category,
            tags: t!.tags ?? [],
            amount: r.amount,
            description: r.description,
            hsa: r.hsa,
          },
          user?.email ?? undefined,
        )
        ids.push(id)
      }
      // Carry the original's receipts onto each new part, then remove the original.
      for (const id of ids) await copyReceipts(t!.id, id)
      await deleteTransaction(t!.id)
      toast.success(`Split into ${ids.length} transactions`)
      nav('/history')
    } catch {
      toast.error('Could not split')
    } finally {
      setSplitSaving(false)
    }
  }

  if (splitting) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSplitting(false)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Cancel split
        </button>
        <h1 className="text-lg font-semibold">Split this expense</h1>
        <p className="text-sm text-muted-foreground">
          Break {formatCurrency(t.amount)} into separate category transactions.
          Receipts are copied to each; the original is removed.
        </p>
        <SplitEditor
          initialRows={[
            {
              category: t.category,
              amount: String(t.amount),
              description: t.description,
              hsa: !!t.hsa,
            },
          ]}
          date={splitDate}
          onDate={setSplitDate}
          onSubmit={doSplit}
          saving={splitSaving}
          compareTotal={t.amount}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => nav(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>
      <h1 className="text-xl font-semibold tracking-tight">
        Edit {TYPE_LABELS[t.type].toLowerCase()}
      </h1>

      <TransactionForm mode="edit" initial={t} onSaved={() => nav(-1)} />

      <ReceiptsSection transactionId={t.id} />

      {t.hsa && isReimbursed(t) && (
        <div className="rounded-xl bg-pos/10 px-4 py-3 text-sm">
          <div className="font-medium text-pos">
            Reimbursed {formatCurrency(t.hsaReimbursedAmount ?? t.amount)}
          </div>
          <div className="text-xs text-muted-foreground">
            {t.hsaReimbursedDate
              ? `on ${formatDatePretty(t.hsaReimbursedDate)}`
              : 'date not recorded'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={reimbursement ? undoReimb : markNotReimbursed}
            className="mt-1 h-7 gap-1 px-2 text-xs text-muted-foreground"
          >
            <Undo2 className="size-3" />
            {reimbursement ? 'Undo reimbursement' : 'Mark as not reimbursed'}
          </Button>
        </div>
      )}

      {t.type === 'expense' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setRefundAmt(String(t.amount))
                setRefundOpen(true)
              }}
            >
              Add refund
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={openSplit}
            >
              <SplitSquareVertical className="size-4" />
              Split
            </Button>
          </div>
          {refunds.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Refunds
              </div>
              {refunds.map((r) => (
                <TransactionRow
                  key={r.id}
                  t={r}
                  onClick={() => nav(`/edit/${r.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        onClick={() => setConfirmDel(true)}
        className="w-full gap-2 text-neg hover:bg-neg/10 hover:text-neg"
      >
        <Trash2 className="size-4" />
        Delete
      </Button>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={del}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                inputMode="decimal"
                value={refundAmt}
                onChange={(e) => setRefundAmt(e.target.value)}
                className="tabular"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={refundDate}
                onChange={(e) => setRefundDate(e.target.value)}
                className="tabular"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitRefund}>Add refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
