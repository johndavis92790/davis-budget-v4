import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RecurringForm } from '@/components/RecurringForm'
import { categoryIcon } from '@/lib/categories'
import { useData } from '@/lib/data'
import { roundMoney, sumMoney, formatCurrency } from '@/lib/money'
import type { RecurringTemplate } from '@/lib/types'
import { cn } from '@/lib/utils'

function Row({
  r,
  onClick,
}: {
  r: RecurringTemplate
  onClick: () => void
}) {
  const Icon = categoryIcon(r.category)
  const income = r.type === 'income'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50',
        !r.active && 'opacity-50',
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
          <Icon className="size-3.5" />
          {r.category}
        </span>
        {r.description && (
          <div className="mt-1.5 truncate text-sm text-foreground/90">
            {r.description}
          </div>
        )}
        {r.tags?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {r.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <span
        className={cn(
          'tabular shrink-0 text-[15px] font-semibold',
          income ? 'text-pos' : 'text-neg',
        )}
      >
        {formatCurrency(income ? r.value : -r.value, { signed: true })}
      </span>
    </button>
  )
}

export function RecurringPage() {
  const { recurring } = useData()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTemplate | null>(null)
  const [addType, setAddType] = useState<'income' | 'expense'>('expense')

  const { income, expenses, incomeTotal, expenseTotal, net } = useMemo(() => {
    const income = recurring
      .filter((r) => r.type === 'income')
      .sort((a, b) => b.value - a.value)
    const expenses = recurring
      .filter((r) => r.type === 'expense')
      .sort((a, b) => b.value - a.value)
    const incomeTotal = sumMoney(income.filter((r) => r.active).map((r) => r.value))
    const expenseTotal = sumMoney(
      expenses.filter((r) => r.active).map((r) => r.value),
    )
    return {
      income,
      expenses,
      incomeTotal,
      expenseTotal,
      net: roundMoney(incomeTotal - expenseTotal),
    }
  }, [recurring])

  function openAdd(type: 'income' | 'expense') {
    setEditing(null)
    setAddType(type)
    setOpen(true)
  }
  function openEdit(r: RecurringTemplate) {
    setEditing(r)
    setOpen(true)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Recurring budget</h1>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Income
          </div>
          <div className="tabular mt-1 text-lg font-semibold text-pos">
            {formatCurrency(incomeTotal)}
          </div>
        </div>
        <div className="rounded-xl bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Expenses
          </div>
          <div className="tabular mt-1 text-lg font-semibold text-neg">
            {formatCurrency(expenseTotal)}
          </div>
        </div>
        <div className="rounded-xl bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Net / mo
          </div>
          <div
            className={cn(
              'tabular mt-1 text-lg font-semibold',
              net < 0 ? 'text-neg' : 'text-pos',
            )}
          >
            {formatCurrency(net)}
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Income</h2>
          <Button size="sm" variant="outline" onClick={() => openAdd('income')}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        {income.map((r) => (
          <Row key={r.id} r={r} onClick={() => openEdit(r)} />
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Expenses</h2>
          <Button size="sm" variant="outline" onClick={() => openAdd('expense')}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        {expenses.map((r) => (
          <Row key={r.id} r={r} onClick={() => openEdit(r)} />
        ))}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit recurring item' : 'Add recurring item'}
            </DialogTitle>
          </DialogHeader>
          <RecurringForm
            initial={editing}
            defaultType={addType}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
