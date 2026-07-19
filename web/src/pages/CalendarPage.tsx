import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TransactionRow } from '@/components/TransactionRow'
import { useData } from '@/lib/data'
import { weekNetSpend } from '@/lib/compute'
import { formatCurrency } from '@/lib/money'
import { getFiscal, todayIso, formatRange } from '@/lib/fiscal'
import { cn } from '@/lib/utils'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function CalendarPage() {
  const { transactions } = useData()
  const nav = useNavigate()

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const currentWeekKey = getFiscal(todayIso()).weekKey
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekKey)

  const weeks = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const gridStart = new Date(viewYear, viewMonth, 1 - first.getDay())
    const lastDay = new Date(viewYear, viewMonth + 1, 0)
    const rows = Math.ceil((first.getDay() + lastDay.getDate()) / 7)
    const today = todayIso()

    return Array.from({ length: rows }, (_, w) => {
      const weekStart = new Date(gridStart)
      weekStart.setDate(gridStart.getDate() + w * 7)
      const f = getFiscal(toIso(weekStart))
      const days = Array.from({ length: 7 }, (_, d) => {
        const date = new Date(weekStart)
        date.setDate(weekStart.getDate() + d)
        const iso = toIso(date)
        return {
          num: date.getDate(),
          inMonth: date.getMonth() === viewMonth,
          isToday: iso === today,
          isWeekend: d === 0 || d === 6,
        }
      })
      return {
        key: f.weekKey,
        num: f.weekNum,
        start: f.weekStart,
        end: f.weekEnd,
        spend: weekNetSpend(transactions, f.weekKey),
        days,
      }
    })
  }, [viewYear, viewMonth, transactions])

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const selectedTx = transactions.filter((t) => t.fiscalWeekKey === selectedWeek)
  const selectedInfo = weeks.find((w) => w.key === selectedWeek)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>

      <div className="flex items-center justify-between rounded-xl bg-card px-2 py-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="font-medium">{monthLabel}</div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Next month"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div>
        <div className="mb-1 grid grid-cols-7 gap-0.5 px-1.5 text-center text-[11px] font-medium text-muted-foreground">
          {DOW.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="space-y-1.5">
          {weeks.map((week) => {
            const isCurrent = week.key === currentWeekKey
            const isSelected = week.key === selectedWeek
            return (
              <button
                key={week.key}
                type="button"
                onClick={() => setSelectedWeek(week.key)}
                className={cn(
                  'w-full rounded-lg border p-1.5 text-left transition-colors',
                  isSelected
                    ? 'border-primary/60 bg-primary/5'
                    : isCurrent
                      ? 'border-pos/40 bg-pos/5'
                      : 'border-border/60 hover:bg-accent/40',
                )}
              >
                <div className="grid grid-cols-7 gap-0.5">
                  {week.days.map((day, i) => (
                    <div
                      key={i}
                      className={cn(
                        'tabular flex h-8 items-center justify-center rounded text-sm',
                        day.isToday && 'bg-primary font-semibold text-primary-foreground',
                        !day.isToday &&
                          !day.inMonth &&
                          'text-muted-foreground/30',
                        !day.isToday &&
                          day.inMonth &&
                          day.isWeekend &&
                          'text-neg/80',
                      )}
                    >
                      {day.num}
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex items-center justify-between px-1">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isCurrent ? 'text-pos' : 'text-muted-foreground',
                    )}
                  >
                    Week {week.num}
                    {isCurrent && ' · this week'}
                  </span>
                  <span className="tabular text-xs text-muted-foreground">
                    {formatCurrency(week.spend)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            {selectedInfo
              ? formatRange(selectedInfo.start, selectedInfo.end)
              : 'Selected week'}
          </h2>
          <span className="text-xs text-muted-foreground">
            {selectedTx.length} transaction{selectedTx.length === 1 ? '' : 's'}
          </span>
        </div>
        {selectedTx.map((t) => (
          <TransactionRow key={t.id} t={t} onClick={() => nav(`/edit/${t.id}`)} />
        ))}
        {selectedTx.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No transactions this week.
          </div>
        )}
      </div>
    </div>
  )
}
