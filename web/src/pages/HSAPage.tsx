import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getDownloadURL, ref } from 'firebase/storage'
import { FileArchive } from 'lucide-react'
import { categoryIcon } from '@/lib/categories'
import { useAuth } from '@/lib/auth'
import { useData } from '@/lib/data'
import { reimburseHsaExpenses } from '@/lib/db'
import { storage } from '@/lib/firebase'
import { exportAuditZipFn } from '@/lib/functions'
import { formatCurrency, parseCurrency, roundMoney, sumMoney } from '@/lib/money'
import { formatDatePretty, todayIso } from '@/lib/fiscal'
import { downloadCsv } from '@/lib/export'
import { isReimbursed, type Transaction } from '@/lib/types'
import { cn } from '@/lib/utils'

function eligibleOf(t: Transaction) {
  return t.hsaReimbursedAmount ?? t.amount
}

export function HSAPage() {
  const { user } = useAuth()
  const { transactions, loading } = useData()
  const nav = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [date, setDate] = useState(todayIso())
  const [saving, setSaving] = useState(false)
  const [zipping, setZipping] = useState(false)

  const { hsa, unreimbursed, reimbursed, stats } = useMemo(() => {
    const hsa = transactions.filter((t) => t.hsa)
    const unreimbursed = hsa.filter((t) => !isReimbursed(t))
    const reimbursed = hsa.filter((t) => isReimbursed(t))
    const stats = {
      total: sumMoney(hsa.map((t) => t.amount)),
      count: hsa.length,
      reimbursedTotal: sumMoney(reimbursed.map(eligibleOf)),
      reimbursedCount: reimbursed.length,
      outstanding: sumMoney(unreimbursed.map((t) => t.amount)),
      outstandingCount: unreimbursed.length,
    }
    return { hsa, unreimbursed, reimbursed, stats }
  }, [transactions])

  const selectedList = unreimbursed.filter((t) => selected.has(t.id))
  const selectedTotal = sumMoney(selectedList.map((t) => t.amount))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openReimburse() {
    const init: Record<string, string> = {}
    selectedList.forEach((t) => (init[t.id] = String(eligibleOf(t))))
    setAmounts(init)
    setDate(todayIso())
    setDialogOpen(true)
  }

  async function confirmReimburse() {
    setSaving(true)
    try {
      const items = selectedList.map((expense) => ({
        expense,
        amount: parseCurrency(amounts[expense.id] ?? String(expense.amount)),
      }))
      await reimburseHsaExpenses(items, date, user?.email ?? undefined)
      toast.success(`Reimbursed ${items.length} item${items.length > 1 ? 's' : ''}`)
      setSelected(new Set())
      setDialogOpen(false)
    } catch {
      toast.error('Could not reimburse')
    } finally {
      setSaving(false)
    }
  }

  function exportCsv() {
    const rows = [
      ['Date', 'Category', 'Description', 'Tags', 'Amount', 'HSA amount', 'Reimbursed date', 'Reimbursed'],
      ...hsa.map((t) => [
        t.date,
        t.category,
        t.description,
        t.tags.join('; '),
        t.amount.toFixed(2),
        eligibleOf(t).toFixed(2),
        t.hsaReimbursedDate ?? '',
        t.hsaReimbursedDate ? 'Yes' : 'No',
      ]),
    ]
    downloadCsv(`hsa-expenses-${todayIso()}.csv`, rows)
  }

  async function exportZip() {
    setZipping(true)
    try {
      const r = await exportAuditZipFn({ scope: 'hsa' })
      const url = await getDownloadURL(ref(storage, r.data.path))
      window.open(url, '_blank')
      toast.success(
        `Packaged ${r.data.files} receipts for ${r.data.transactions} HSA items`,
      )
    } catch {
      toast.error('Could not build the audit package')
    } finally {
      setZipping(false)
    }
  }

  const dialogTotal = sumMoney(
    selectedList.map((t) => parseCurrency(amounts[t.id] ?? String(t.amount))),
  )

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">HSA expenses</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
          <Download className="size-4" />
          Export
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="HSA total" value={formatCurrency(stats.total)} sub={`${stats.count} items`} />
        <Stat
          label="Reimbursed"
          value={formatCurrency(stats.reimbursedTotal)}
          sub={`${stats.reimbursedCount} items`}
          tone="pos"
        />
        <Stat
          label="Outstanding"
          value={formatCurrency(stats.outstanding)}
          sub={`${stats.outstandingCount} items`}
          tone="amber"
        />
      </div>

      <Button
        variant="outline"
        onClick={exportZip}
        disabled={zipping}
        className="w-full gap-2"
      >
        {zipping ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileArchive className="size-4" />
        )}
        Download audit package (receipts + manifest)
      </Button>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">
              Unreimbursed{' '}
              <span className="text-sm font-normal text-muted-foreground">
                — tap to select
              </span>
            </h2>
            {unreimbursed.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing outstanding. 🎉
              </p>
            )}
            {unreimbursed.map((t) => {
              const isSel = selected.has(t.id)
              const Icon = categoryIcon(t.category)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    isSel
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-transparent bg-card hover:bg-accent/50',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded border',
                      isSel
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40',
                    )}
                  >
                    {isSel && <Check className="size-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                      <Icon className="size-3.5" />
                      {t.category}
                    </span>
                    {t.description && (
                      <div className="mt-1 truncate text-sm">{t.description}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {formatDatePretty(t.date)}
                    </div>
                  </div>
                  <span className="tabular shrink-0 font-semibold text-neg">
                    {formatCurrency(t.amount)}
                  </span>
                </button>
              )
            })}
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">Reimbursed</h2>
            {reimbursed.map((t) => {
              const Icon = categoryIcon(t.category)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => nav(`/edit/${t.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left opacity-80 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                      <Icon className="size-3.5" />
                      {t.category}
                    </span>
                    {t.description && (
                      <div className="mt-1 truncate text-sm">{t.description}</div>
                    )}
                    <div className="text-xs text-pos">
                      Reimbursed {formatCurrency(eligibleOf(t))}
                      {t.hsaReimbursedDate
                        ? ` · ${formatDatePretty(t.hsaReimbursedDate)}`
                        : ''}
                    </div>
                  </div>
                  <span className="tabular shrink-0 text-sm text-muted-foreground">
                    {formatCurrency(t.amount)}
                  </span>
                </button>
              )
            })}
          </section>
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex-1 text-sm">
              <span className="font-semibold">{selected.size} selected</span>
              <span className="tabular ml-2 text-muted-foreground">
                {formatCurrency(selectedTotal)}
              </span>
            </div>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button onClick={openReimburse}>Reimburse</Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reimburse from HSA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Creates one income entry for the total and marks these expenses
              reimbursed. Adjust amounts if only part was eligible.
            </p>
            <div className="space-y-2">
              {selectedList.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg bg-card px-3 py-2"
                >
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate">{t.description || t.category}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDatePretty(t.date)} · full {formatCurrency(t.amount)}
                    </div>
                  </div>
                  <div className="relative w-24">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      inputMode="decimal"
                      value={amounts[t.id] ?? ''}
                      onChange={(e) =>
                        setAmounts((a) => ({ ...a, [t.id]: e.target.value }))
                      }
                      className="tabular h-9 pl-6 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Reimbursement date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="tabular"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
              <span className="text-sm font-medium">Total</span>
              <span className="tabular font-semibold text-pos">
                {formatCurrency(roundMoney(dialogTotal))}
              </span>
            </div>
            <Button
              onClick={confirmReimburse}
              disabled={saving}
              className="h-11 w-full text-base"
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Reimburse {formatCurrency(roundMoney(dialogTotal))}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone?: 'pos' | 'amber'
}) {
  return (
    <div className="rounded-xl bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'tabular mt-1 text-base font-semibold',
          tone === 'pos' && 'text-pos',
          tone === 'amber' && 'text-amber-500',
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}
