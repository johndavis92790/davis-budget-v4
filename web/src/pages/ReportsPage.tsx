import { useMemo, useState } from 'react'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { MultiSelect } from '@/components/MultiSelect'
import { useAuth } from '@/lib/auth'
import { generateInsightsFn, syncBigQueryNowFn } from '@/lib/functions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useData } from '@/lib/data'
import { CATEGORY_NAMES } from '@/lib/categories'
import { roundMoney, sumMoney, formatCurrency } from '@/lib/money'
import { getFiscal, todayIso } from '@/lib/fiscal'
import { usePersistedFilters } from '@/lib/usePersistedFilters'
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
const eligibleOf = (t: Transaction) => t.hsaReimbursedAmount ?? t.amount

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'refund', label: 'Refund' },
  { value: 'income', label: 'Income' },
  { value: 'recurring-expense', label: 'Recurring expense' },
  { value: 'recurring-income', label: 'Recurring income' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'adjustment', label: 'Adjustment' },
]

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

function BreakdownList({
  rows,
  total,
  emptyText,
}: {
  rows: { label: string; value: number }[]
  total: number
  emptyText: string
}) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = total ? (r.value / total) * 100 : 0
        return (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            <span className="w-20 shrink-0 truncate text-muted-foreground">
              {r.label}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-chart-1"
                style={{ width: `${Math.max(pct, 1)}%` }}
              />
            </div>
            <span className="tabular w-16 shrink-0 text-right text-xs">
              {formatCurrency(r.value)}
            </span>
          </div>
        )
      })}
      {rows.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </div>
  )
}

type ReportFilters = {
  year: string
  categories: string[]
  tags: string[]
  types: string[]
  hsaOnly: boolean
}

export function ReportsPage() {
  const { transactions, tags: allTags } = useData()
  const { isSuperAdmin } = useAuth()
  const currentYear = getFiscal(todayIso()).yearKey
  const [syncing, setSyncing] = useState(false)
  const [insights, setInsights] = useState<string[] | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  const [filters, setFilters] = usePersistedFilters<ReportFilters>(
    'filters:reports',
    { year: currentYear, categories: [], tags: [], types: [], hsaOnly: false },
  )
  const { year, categories, tags, types, hsaOnly } = filters

  const years = useMemo(() => {
    const set = new Set(transactions.map((t) => t.fiscalYearKey))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [transactions])

  const matchesNonYearFilters = (t: Transaction) => {
    if (categories.length && !categories.includes(t.category)) return false
    if (tags.length && !t.tags.some((tg) => tags.includes(tg))) return false
    if (types.length && !types.includes(t.type)) return false
    if (hsaOnly && !t.hsa) return false
    return true
  }

  const filtered = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (year === 'all' || t.fiscalYearKey === year) &&
          matchesNonYearFilters(t),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, year, categories, tags, types, hsaOnly],
  )

  const totalSpent = sumMoney(filtered.map(spendOf))
  const totalIncome = sumMoney(filtered.map(incomeOf))
  const net = roundMoney(totalIncome - totalSpent)

  // Prior fiscal year's spend, same non-year filters — for insight context.
  const priorYearSpent = useMemo(() => {
    if (year === 'all') return undefined
    const n = Number(year.replace('FY', '')) - 1
    const priorKey = `FY${n}`
    const rows = transactions.filter(
      (t) => t.fiscalYearKey === priorKey && matchesNonYearFilters(t),
    )
    return rows.length ? roundMoney(sumMoney(rows.map(spendOf))) : undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, year, categories, tags, types, hsaOnly])

  // Trend: by fiscal period within a single year, or by fiscal year across all time.
  const trend = useMemo(() => {
    if (year === 'all') {
      const m = new Map<string, { spend: number; income: number }>()
      for (const t of filtered) {
        const k = t.fiscalYearKey.replace('FY', '')
        const cur = m.get(k) ?? { spend: 0, income: 0 }
        cur.spend += spendOf(t)
        cur.income += incomeOf(t)
        m.set(k, cur)
      }
      return [...m.entries()]
        .map(([label, v]) => ({
          label,
          spend: roundMoney(v.spend),
          income: roundMoney(v.income),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    }
    const m = new Map<number, { spend: number; income: number }>()
    for (const t of filtered) {
      const p = Number(t.fiscalMonthKey.split('-P')[1])
      const cur = m.get(p) ?? { spend: 0, income: 0 }
      cur.spend += spendOf(t)
      cur.income += incomeOf(t)
      m.set(p, cur)
    }
    return Array.from({ length: 13 }, (_, i) => {
      const v = m.get(i + 1) ?? { spend: 0, income: 0 }
      return { label: String(i + 1), spend: roundMoney(v.spend), income: roundMoney(v.income) }
    })
  }, [filtered, year])

  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of filtered) {
      const s = spendOf(t)
      if (s) m.set(t.category, (m.get(t.category) ?? 0) + s)
    }
    return [...m.entries()]
      .map(([label, value]) => ({ label, value: roundMoney(value) }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const byTag = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of filtered) {
      const s = spendOf(t)
      if (!s) continue
      for (const tg of t.tags) m.set(tg, (m.get(tg) ?? 0) + s)
    }
    return [...m.entries()]
      .map(([label, value]) => ({ label, value: roundMoney(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [filtered])

  const topExpenses = useMemo(
    () =>
      filtered
        .filter((t) => spendOf(t) > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [filtered],
  )

  const hsaStats = useMemo(() => {
    const hsaTx = filtered.filter((t) => t.hsa)
    const reimbursed = hsaTx.filter((t) => t.hsaReimbursedAmount || t.hsaReimbursedDate)
    const unreimbursed = hsaTx.filter((t) => !(t.hsaReimbursedAmount || t.hsaReimbursedDate))
    const reimbursedTotal = sumMoney(reimbursed.map(eligibleOf))
    const outstanding = sumMoney(unreimbursed.map((t) => t.amount))
    return { total: roundMoney(reimbursedTotal + outstanding), reimbursed: reimbursedTotal, outstanding }
  }, [filtered])

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

  async function runInsights() {
    setInsightsLoading(true)
    try {
      const r = await generateInsightsFn({
        label: year === 'all' ? 'all time' : year.replace('FY', 'FY '),
        totalSpent: roundMoney(totalSpent),
        totalIncome: roundMoney(totalIncome),
        net,
        byCategory: byCategory
          .slice(0, 10)
          .map((c) => ({ category: c.label, amount: c.value })),
        byTag: byTag.map((t) => ({ tag: t.label, amount: t.value })),
        topExpenses: topExpenses.map((t) => ({
          description: t.description || t.category,
          category: t.category,
          amount: t.amount,
          date: t.date,
        })),
        priorPeriodSpent: priorYearSpent,
        hsa: filtered.some((t) => t.hsa) ? hsaStats : undefined,
      })
      setInsights(r.data.insights)
    } catch {
      toast.error('Could not generate insights')
    } finally {
      setInsightsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Reports</h1>

      <div className="grid grid-cols-2 gap-2">
        <Select value={year} onValueChange={(v) => setFilters({ year: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y.replace('FY', 'FY ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MultiSelect
          label="Categories"
          options={CATEGORY_NAMES}
          selected={categories}
          onChange={(v) => setFilters({ categories: v })}
        />
        <MultiSelect
          label="Tags"
          options={allTags}
          selected={tags}
          onChange={(v) => setFilters({ tags: v })}
        />
        <MultiSelect
          label="Types"
          options={TYPE_OPTIONS}
          selected={types}
          onChange={(v) => setFilters({ types: v })}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-card px-4 py-2.5">
        <span className="text-sm font-medium">HSA only</span>
        <Switch
          checked={hsaOnly}
          onCheckedChange={(v) => setFilters({ hsaOnly: v })}
        />
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

      <ChartCard
        title={
          year === 'all' ? 'Income vs. expense by fiscal year' : `Income vs. expense — ${year.replace('FY', 'FY ')} by period`
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trend} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
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
              formatter={(v, name) => [formatCurrency(Number(v) || 0), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="spend" name="Spent" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="income" name="Income" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="By category">
        <BreakdownList rows={byCategory} total={totalSpent} emptyText="No spending." />
      </ChartCard>

      <ChartCard title="By tag">
        <BreakdownList rows={byTag} total={totalSpent} emptyText="No tagged spending." />
      </ChartCard>

      {hsaStats.total > 0 && (
        <ChartCard title="HSA">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Total
              </div>
              <div className="tabular text-sm font-semibold">
                {formatCurrency(hsaStats.total)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Reimbursed
              </div>
              <div className="tabular text-sm font-semibold text-pos">
                {formatCurrency(hsaStats.reimbursed)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Outstanding
              </div>
              <div className="tabular text-sm font-semibold text-amber-500">
                {formatCurrency(hsaStats.outstanding)}
              </div>
            </div>
          </div>
        </ChartCard>
      )}

      <div className="space-y-3 rounded-xl bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-medium">AI insights</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runInsights}
            disabled={insightsLoading || filtered.length === 0}
            className="gap-2"
          >
            {insightsLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {insights ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
        {insights ? (
          <ul className="space-y-1.5 text-sm">
            {insights.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                <span className="text-foreground/90">{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Summarizes what&apos;s currently filtered — a few short, specific
            observations, not generic advice. One quick AI call per click.
          </p>
        )}
      </div>

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
