import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TransactionRow } from '@/components/TransactionRow'
import { useData } from '@/lib/data'
import { weekNetSpend } from '@/lib/compute'
import { formatCurrency, roundMoney } from '@/lib/money'
import {
  addDaysIso,
  getFiscal,
  todayIso,
  formatRange,
  monthLabel,
} from '@/lib/fiscal'
import { signedAmount } from '@/lib/types'
import { cn } from '@/lib/utils'

export function CalendarPage() {
  const { transactions } = useData()
  const nav = useNavigate()
  const [offset, setOffset] = useState(0) // fiscal months from current
  const [week, setWeek] = useState<string | null>(null) // weekKey filter

  const baseMonthStart = getFiscal(todayIso()).monthStart
  const shown = getFiscal(addDaysIso(baseMonthStart, offset * 28))

  const { monthTx, weeks, spent, income } = useMemo(() => {
    const monthTx = transactions.filter((t) => t.fiscalMonthKey === shown.monthKey)
    const weeks = [0, 1, 2, 3].map((w) => {
      const wf = getFiscal(addDaysIso(shown.monthStart, w * 7))
      return {
        key: wf.weekKey,
        num: w + 1,
        start: wf.weekStart,
        end: wf.weekEnd,
        spend: weekNetSpend(transactions, wf.weekKey),
      }
    })
    let spent = 0
    let income = 0
    for (const t of monthTx) {
      const s = signedAmount(t)
      if (s < 0) spent += -s
      else income += s
    }
    return { monthTx, weeks, spent: roundMoney(spent), income: roundMoney(income) }
  }, [transactions, shown.monthKey, shown.monthStart])

  const scope = week ? monthTx.filter((t) => t.fiscalWeekKey === week) : monthTx

  function changeMonth(delta: number) {
    setOffset((o) => o + delta)
    setWeek(null)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>

      <div className="flex items-center justify-between rounded-xl bg-card px-2 py-2">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Previous period"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-center">
          <div className="font-medium">{monthLabel(shown)}</div>
          <div className="text-xs text-muted-foreground">
            {formatRange(shown.monthStart, shown.monthEnd)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Next period"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Spent
          </div>
          <div className="tabular mt-1 text-lg font-semibold text-neg">
            {formatCurrency(spent)}
          </div>
        </div>
        <div className="rounded-xl bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            In
          </div>
          <div className="tabular mt-1 text-lg font-semibold text-pos">
            {formatCurrency(income)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {weeks.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => setWeek((cur) => (cur === w.key ? null : w.key))}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm transition-colors',
              week === w.key
                ? 'border-primary/50 bg-primary/5'
                : 'border-transparent bg-card hover:bg-accent/50',
            )}
          >
            <div>
              <span className="font-medium">Week {w.num}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {formatRange(w.start, w.end)}
              </span>
            </div>
            <span className="tabular text-muted-foreground">
              {formatCurrency(w.spend)}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          {week ? 'Selected week' : 'Whole period'} · {scope.length} transaction
          {scope.length === 1 ? '' : 's'}
        </div>
        {scope.map((t) => (
          <TransactionRow key={t.id} t={t} onClick={() => nav(`/edit/${t.id}`)} />
        ))}
        {scope.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No transactions in this period.
          </div>
        )}
      </div>
    </div>
  )
}
