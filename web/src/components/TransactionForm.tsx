import { useRef, useState } from 'react'
import { Loader2, Paperclip, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CategorySelect } from './CategorySelect'
import { TagInput } from './TagInput'
import { useAuth } from '@/lib/auth'
import { useData } from '@/lib/data'
import { addTransaction, updateTransaction, reimburseHsaExpenses } from '@/lib/db'
import { uploadReceipt } from '@/lib/receipts'
import { formatCurrency, parseCurrency } from '@/lib/money'
import { todayIso } from '@/lib/fiscal'
import {
  isReimbursed,
  TYPE_LABELS,
  type Transaction,
  type TransactionType,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type Props = {
  mode: 'add' | 'edit'
  initial?: Partial<Transaction>
  onSaved: (id?: string) => void
}

export function TransactionForm({ mode, initial, onSaved }: Props) {
  const { user } = useAuth()
  const { tags: allTags } = useData()

  const lockedType =
    initial?.type && !['expense', 'income'].includes(initial.type)
      ? (initial.type as TransactionType)
      : null

  const [kind, setKind] = useState<'expense' | 'income'>(
    initial?.type === 'income' ? 'income' : 'expense',
  )
  const [category, setCategory] = useState(initial?.category ?? '')
  const [amount, setAmount] = useState(
    initial?.amount != null ? String(initial.amount) : '',
  )
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [hsa, setHsa] = useState(initial?.hsa ?? false)
  const [hsaNotes, setHsaNotes] = useState(initial?.hsaNotes ?? '')
  const [reimbAmount, setReimbAmount] = useState(
    initial?.hsaReimbursedAmount != null ? String(initial.hsaReimbursedAmount) : '',
  )
  const [reimbDate, setReimbDate] = useState(initial?.hsaReimbursedDate ?? todayIso())
  const [saving, setSaving] = useState(false)
  const [receipts, setReceipts] = useState<File[]>([])
  const receiptRef = useRef<HTMLInputElement>(null)

  const finalType: TransactionType = lockedType ?? kind
  const isExpense = finalType === 'expense' || finalType === 'recurring-expense'
  // Already reimbursed (via the real "Reimburse from HSA" flow or migrated
  // data) — editing that amount safely lives on the Edit page instead, so
  // this form only offers the "reimburse now" fields for a fresh HSA item.
  const alreadyReimbursed = isReimbursed(initial ?? {})
  const showReimburseFields = isExpense && hsa && !alreadyReimbursed

  async function handleSave() {
    if (!category) {
      toast.error('Pick a category')
      return
    }
    const amt = parseCurrency(amount)
    if (amt <= 0) {
      toast.error('Enter an amount')
      return
    }
    const reimbAmt = parseCurrency(reimbAmount)
    if (showReimburseFields && reimbAmt > amt) {
      toast.error("Reimbursed amount can't be more than the expense amount")
      return
    }
    setSaving(true)
    try {
      const payload = {
        date,
        type: finalType,
        category,
        tags,
        amount: amt,
        description: description.trim(),
        hsa: isExpense ? hsa : false,
        ...(isExpense && hsa ? { hsaNotes: hsaNotes.trim() || null } : {}),
      }
      let newId: string | undefined
      if (mode === 'add') {
        newId = await addTransaction(payload, user?.email ?? undefined)
        if (newId && receipts.length) {
          await Promise.all(
            receipts.map((f) =>
              uploadReceipt(newId as string, f).catch((err) =>
                console.error('receipt upload failed', err),
              ),
            ),
          )
        }
      } else if (initial?.id) {
        await updateTransaction(initial.id, payload)
      }
      const savedId = mode === 'add' ? newId : initial?.id

      // Reimburse now, if an amount was entered — creates the linked
      // reimbursement income transaction so Available Funds updates too.
      if (showReimburseFields && reimbAmt > 0 && savedId) {
        await reimburseHsaExpenses(
          [{ expense: { id: savedId } as Transaction, amount: reimbAmt }],
          reimbDate || todayIso(),
          user?.email ?? undefined,
        )
        toast.success(
          `${mode === 'add' ? 'Added' : 'Saved'} and reimbursed ${formatCurrency(reimbAmt)}`,
        )
      } else {
        toast.success(mode === 'add' ? 'Added' : 'Saved')
      }
      onSaved(newId)
    } catch (e) {
      console.error(e)
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {lockedType ? (
        <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {TYPE_LABELS[lockedType]}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'rounded-md border py-2 text-sm font-medium capitalize transition-colors',
                kind === k
                  ? k === 'expense'
                    ? 'border-neg/40 bg-neg/10 text-neg'
                    : 'border-pos/40 bg-pos/10 text-pos'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategorySelect value={category} onChange={setCategory} />
        </div>
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <div className="relative w-32">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="tabular pl-7 text-right"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="tabular"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional note"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tags</Label>
        <TagInput value={tags} onChange={setTags} suggestions={allTags} />
      </div>

      {isExpense && (
        <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
          <div>
            <div className="font-medium">HSA expense</div>
            <div className="text-xs text-muted-foreground">
              Track for reimbursement
            </div>
          </div>
          <Switch checked={hsa} onCheckedChange={setHsa} />
        </div>
      )}

      {isExpense && hsa && (
        <div className="space-y-1.5">
          <Label>HSA notes</Label>
          <Input
            value={hsaNotes}
            onChange={(e) => setHsaNotes(e.target.value)}
            placeholder="What's HSA-eligible, e.g. “Children's Tylenol”"
          />
        </div>
      )}

      {showReimburseFields && (
        <div className="space-y-3 rounded-xl bg-card px-4 py-3">
          <div>
            <div className="font-medium">Reimburse now</div>
            <div className="text-xs text-muted-foreground">
              Optional — leave blank to reimburse later from the HSA page.
              If only part of this was HSA-eligible, enter that amount.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reimbursed amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  inputMode="decimal"
                  value={reimbAmount}
                  onChange={(e) => setReimbAmount(e.target.value)}
                  placeholder="0.00"
                  className="tabular pl-7"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reimbursed date</Label>
              <Input
                type="date"
                value={reimbDate}
                onChange={(e) => setReimbDate(e.target.value)}
                className="tabular"
              />
            </div>
          </div>
          {(() => {
            const r = parseCurrency(reimbAmount)
            const full = parseCurrency(amount)
            if (r > 0 && full > 0 && r < full) {
              return (
                <p className="text-xs text-amber-500">
                  {formatCurrency(full - r)} of this {formatCurrency(full)}{' '}
                  total stays non-HSA — won&apos;t count as eligible.
                </p>
              )
            }
            return null
          })()}
        </div>
      )}

      {mode === 'add' && (
        <div className="space-y-1.5">
          <Label>Receipts</Label>
          <input
            ref={receiptRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? [])
              if (fs.length) setReceipts((r) => [...r, ...fs])
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {receipts.map((f, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="max-w-[9rem] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setReceipts((r) => r.filter((_, j) => j !== i))}
                  aria-label="Remove receipt"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => receiptRef.current?.click()}
              className="gap-1"
            >
              <Paperclip className="size-4" />
              Attach
            </Button>
          </div>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="h-11 w-full text-base">
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        {mode === 'add' ? 'Add' : 'Save'}
      </Button>
    </div>
  )
}
