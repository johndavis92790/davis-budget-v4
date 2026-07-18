import { useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { syncBigQueryNowFn } from '@/lib/functions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useData } from '@/lib/data'
import { roundMoney, sumMoney, formatCurrency } from '@/lib/money'
import { getFiscal, todayIso } from '@/lib/fiscal'
import type { Transaction } from '@/lib/types'
import { cn } from '@/lib/utils'

const spendOf = (t: Transaction) =>
  t.type === 'expense' || t.type === 'recurring-expense' ? t.amount : 0
const incomeOf = (t: Transaction) =>
  t.type === 'income' ||
  t.type === 'recurring-income' ||
  t.type === 'refund' ||
  t.type === 'reimbursement'
    ? t.amount
    : 0

const compact = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
}

function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2 rounded-xl bg-card p-4">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </div>
  )
}

export function ReportsPage() {
  const { transactions } = useData()
  const { isSuperAdmin } = useAuth()
  const currentYear = getFiscal(todayIso()).yearKey
  const [year, setYear] = useState(currentYear)
  const [syncing, setSyncing] = useState(false)

  async function syncNow() {
    setSyncing(true)
    try {
      const r = await syncBigQueryNowFn()
      toast.success(`Synced ${r.data.rows} rows to BigQuery`)
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const years = useMemo(() => {
    const set = new Set(transactions.map((t) => t.fiscalYearKey))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [transactions])

  const byYear = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactions)
      m.set(t.fiscalYearKey, (m.get(t.fiscalYearKey) ?? 0) + spendOf(t))
    return [...m.entries()]
      .map(([k, v]) => ({ label: k.replace('FY', ''), value: roundMoney(v) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [transactions])

  const yearTx = useMemo(
    () => transactions.filter((t) => t.fiscalYearKey === year),
    [transactions, year],
  )

  const byPeriod = useMemo(() => {
    const m = new Map<number, number>()
    for (const t of yearTx) {
      const p = Number(t.fiscalMonthKey.split('-P')[1])
      m.set(p, (m.get(p) ?? 0) + spendOf(t))
    }
    return Array.from({ length: 13 }, (_, i) => ({
      label: String(i + 1),
      value: roundMoney(m.get(i + 1) ?? 0),
    }))
  }, [yearTx])

  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of yearTx) {
      const s = spendOf(t)
      if (s) m.set(t.category, (m.get(t.category) ?? 0) + s)
    }
    return [...m.entries()]
      .map(([label, value]) => ({ label, value: roundMoney(value) }))
      .sort((a, b) => b.value - a.value)
  }, [yearTx])

  const totalSpent = sumMoney(yearTx.map(spendOf))
  const totalIncome = sumMoney(yearTx.map(incomeOf))
  const net = roundMoney(totalIncome - totalSpent)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y.replace('FY', 'FY ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Spent
          </div>
          <div className="tabular mt-1 text-base font-semibold text-neg">
            {formatCurrency(totalSpent)}
          </div>
        </div>
        <div className="rounded-xl bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            In
          </div>
          <div className="tabular mt-1 text-base font-semibold text-pos">
            {formatCurrency(totalIncome)}
          </div>
        </div>
        <div className="rounded-xl bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Net
          </div>
          <div
            className={cn(
              'tabular mt-1 text-base font-semibold',
              net < 0 ? 'text-neg' : 'text-pos',
            )}
          >
            {formatCurrency(net)}
          </div>
        </div>
      </div>

      <ChartCard title="Spending by fiscal year">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byYear} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={compact}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: 'var(--accent)', opacity: 0.3 }}
              formatter={(v) => [formatCurrency(Number(v) || 0), 'Spent']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {byYear.map((d) => (
                <Cell
                  key={d.label}
                  fill={
                    d.label === currentYear.replace('FY', '')
                      ? 'var(--chart-1)'
                      : 'var(--chart-3)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={`${year.replace('FY', 'FY ')} by fiscal period`}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byPeriod} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={compact}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: 'var(--accent)', opacity: 0.3 }}
              formatter={(v) => [formatCurrency(Number(v) || 0), 'Spent']}
              labelFormatter={(l) => `Period ${l}`}
            />
            <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={`${year.replace('FY', 'FY ')} by category`}>
        <div className="space-y-1.5">
          {byCategory.map((c) => {
            const pct = totalSpent ? (c.value / totalSpent) * 100 : 0
            return (
              <div key={c.label} className="flex items-center gap-2 text-sm">
                <span className="w-20 shrink-0 text-muted-foreground">
                  {c.label}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-chart-1"
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <span className="tabular w-16 shrink-0 text-right text-xs">
                  {formatCurrency(c.value)}
                </span>
              </div>
            )
          })}
          {byCategory.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No spending this year.
            </p>
          )}
        </div>
      </ChartCard>

      {isSuperAdmin && (
        <div className="space-y-2 rounded-xl border border-border p-4">
          <h2 className="text-sm font-medium">Reporting pipeline</h2>
          <p className="text-xs text-muted-foreground">
            Looker Studio connects to the BigQuery table{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              davis-budget-v4.budget.transactions
            </code>
            , refreshed automatically each night.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={syncNow}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sync now
          </Button>
        </div>
      )}
    </div>
  )
}
