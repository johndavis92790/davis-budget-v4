import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ScanLine, ChevronRight, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransactionRow } from '@/components/TransactionRow'
import { GoalsDialog } from '@/components/GoalsDialog'
import { useData } from '@/lib/data'
import { availableFunds, weekNetSpend } from '@/lib/compute'
import { roundMoney, formatCurrency } from '@/lib/money'
import { getFiscal, todayIso } from '@/lib/fiscal'
import { cn } from '@/lib/utils'

export function HomePage() {
  const nav = useNavigate()
  const { transactions, ledgerAnchor, weeklyGoals, loading } = useData()
  const [goalsOpen, setGoalsOpen] = useState(false)

  const week = getFiscal(todayIso())
  const available = availableFunds(transactions, ledgerAnchor)
  const target = weeklyGoals[week.weekKey]?.target ?? 0
  const spent = weekNetSpend(transactions, week.weekKey)
  const weeklyRemaining = roundMoney(target - spent)
  const recent = transactions.slice(0, 8)

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setGoalsOpen(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3" />
            Edit goals
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setGoalsOpen(true)}
            className="rounded-xl bg-card p-4 text-left"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Weekly remaining
            </div>
            <div
              className={cn(
                'tabular mt-1.5 text-2xl font-semibold',
                weeklyRemaining < 0 ? 'text-neg' : 'text-foreground',
              )}
            >
              {formatCurrency(weeklyRemaining)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              of {formatCurrency(target)} goal
            </div>
          </button>
          <button
            type="button"
            onClick={() => setGoalsOpen(true)}
            className="rounded-xl bg-card p-4 text-left"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Available funds
            </div>
            <div
              className={cn(
                'tabular mt-1.5 text-2xl font-semibold',
                available < 0 ? 'text-neg' : 'text-pos',
              )}
            >
              {formatCurrency(available)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              this fiscal month
            </div>
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => nav('/add')}
          className="h-11 flex-1 gap-2 text-base"
        >
          <Plus className="size-5" />
          Add expense
        </Button>
        <Button
          variant="secondary"
          onClick={() => nav('/scan')}
          className="h-11 gap-2 text-base"
        >
          <ScanLine className="size-5" />
          Scan
        </Button>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent</h2>
          <button
            type="button"
            onClick={() => nav('/history')}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            View all
            <ChevronRight className="size-4" />
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((t) => (
              <TransactionRow
                key={t.id}
                t={t}
                onClick={() => nav(`/edit/${t.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <GoalsDialog open={goalsOpen} onOpenChange={setGoalsOpen} />
    </div>
  )
}
