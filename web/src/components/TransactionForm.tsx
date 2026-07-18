import { useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { addTransaction, updateTransaction } from '@/lib/db'
import { parseCurrency } from '@/lib/money'
import { todayIso } from '@/lib/fiscal'
import { TYPE_LABELS, type Transaction, type TransactionType } from '@/lib/types'
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
  const [saving, setSaving] = useState(false)

  const finalType: TransactionType = lockedType ?? kind
  const isExpense = finalType === 'expense' || finalType === 'recurring-expense'

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
      }
      let newId: string | undefined
      if (mode === 'add') {
        newId = await addTransaction(payload, user?.email ?? undefined)
        toast.success('Added')
      } else if (initial?.id) {
        await updateTransaction(initial.id, payload)
        toast.success('Saved')
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

      <Button onClick={handleSave} disabled={saving} className="h-11 w-full text-base">
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        {mode === 'add' ? 'Add' : 'Save'}
      </Button>
    </div>
  )
}
