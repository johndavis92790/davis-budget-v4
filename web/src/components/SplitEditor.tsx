import { useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CategorySelect } from './CategorySelect'
import { TagInput } from './TagInput'
import { useData } from '@/lib/data'
import { parseCurrency, formatCurrency, sumMoney, roundMoney } from '@/lib/money'

export type SplitRow = {
  description: string
  amount: string
  category: string
  hsa: boolean
  tags: string[]
}
export type ParsedSplit = {
  category: string
  amount: number
  description: string
  hsa: boolean
  tags: string[]
}

const blank = (): SplitRow => ({
  description: '',
  amount: '',
  category: '',
  hsa: false,
  tags: [],
})

export function SplitEditor({
  initialRows,
  date,
  onDate,
  onSubmit,
  submitLabel,
  saving = false,
  compareTotal,
}: {
  initialRows: SplitRow[]
  date: string
  onDate: (d: string) => void
  onSubmit: (rows: ParsedSplit[]) => void
  submitLabel?: string
  saving?: boolean
  compareTotal?: number
}) {
  const { tags: allTags } = useData()
  const [rows, setRows] = useState<SplitRow[]>(
    initialRows.length ? initialRows : [blank()],
  )

  const total = sumMoney(rows.map((r) => parseCurrency(r.amount)))
  const diff = compareTotal != null ? roundMoney(compareTotal - total) : null
  const validCount = rows.filter(
    (r) => parseCurrency(r.amount) > 0 && r.category,
  ).length

  const update = (i: number, patch: Partial<SplitRow>) =>
    setRows((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  function submit() {
    const parsed: ParsedSplit[] = rows
      .map((r) => ({
        category: r.category,
        amount: parseCurrency(r.amount),
        description: r.description.trim(),
        hsa: r.hsa,
        tags: r.tags,
      }))
      .filter((r) => r.amount > 0 && r.category)
    if (!parsed.length) {
      toast.error('Add at least one category with an amount')
      return
    }
    onSubmit(parsed)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
          className="tabular"
        />
      </div>

      {rows.map((it, i) => (
        <div key={i} className="space-y-2 rounded-xl bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <CategorySelect
                value={it.category}
                onChange={(v) => update(i, { category: v })}
              />
            </div>
            <div className="relative w-24">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                inputMode="decimal"
                value={it.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
                className="tabular h-9 pl-6 text-right"
              />
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((s) => s.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-neg"
                aria-label="Remove"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
          <Input
            value={it.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Description"
            className="h-9"
          />
          <TagInput
            value={it.tags}
            onChange={(tags) => update(i, { tags })}
            suggestions={allTags}
          />
          <label className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">HSA eligible</span>
            <Switch
              checked={it.hsa}
              onCheckedChange={(v) => update(i, { hsa: v })}
            />
          </label>
        </div>
      ))}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => setRows((s) => [...s, blank()])}
      >
        <Plus className="size-4" />
        Add category
      </Button>

      <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
        <span className="text-sm font-medium">Total</span>
        <span className="tabular font-semibold">{formatCurrency(total)}</span>
      </div>
      {diff != null && Math.abs(diff) >= 0.01 && (
        <p className="text-xs text-amber-500">
          {diff > 0
            ? `${formatCurrency(diff)} of the ${formatCurrency(compareTotal!)} total isn't assigned yet`
            : `Split is ${formatCurrency(-diff)} over the ${formatCurrency(compareTotal!)} total`}
        </p>
      )}

      <Button onClick={submit} disabled={saving} className="h-11 w-full text-base">
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        {submitLabel ?? `Save ${validCount} transaction${validCount === 1 ? '' : 's'}`}
      </Button>
    </div>
  )
}
