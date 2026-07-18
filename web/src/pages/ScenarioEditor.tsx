import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CategorySelect } from '@/components/CategorySelect'
import { categoryIcon } from '@/lib/categories'
import { useData } from '@/lib/data'
import { updateScenario, deleteScenario } from '@/lib/db'
import { roundMoney, sumMoney, formatCurrency, parseCurrency } from '@/lib/money'
import type { ScenarioItem } from '@/lib/types'
import { cn } from '@/lib/utils'

const BLANK: ScenarioItem = {
  type: 'expense',
  category: '',
  tags: [],
  value: 0,
  description: '',
}

export function ScenarioEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const { scenarios, recurring } = useData()
  const scenario = scenarios.find((s) => s.id === id)

  const [ready, setReady] = useState(false)
  const [name, setName] = useState('')
  const [items, setItems] = useState<ScenarioItem[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const [itemOpen, setItemOpen] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<ScenarioItem>(BLANK)
  const [draftValue, setDraftValue] = useState('')

  useEffect(() => {
    if (scenario && !ready) {
      setName(scenario.name)
      setItems(scenario.items ?? [])
      setReady(true)
    }
  }, [scenario, ready])

  const baselineNet = useMemo(() => {
    const inc = sumMoney(
      recurring.filter((r) => r.type === 'income' && r.active).map((r) => r.value),
    )
    const exp = sumMoney(
      recurring.filter((r) => r.type === 'expense' && r.active).map((r) => r.value),
    )
    return roundMoney(inc - exp)
  }, [recurring])

  const income = sumMoney(items.filter((i) => i.type === 'income').map((i) => i.value))
  const expense = sumMoney(items.filter((i) => i.type === 'expense').map((i) => i.value))
  const net = roundMoney(income - expense)
  const fiscalNet = roundMoney((net * 12) / 13)
  const delta = roundMoney(net - baselineNet)

  const incomeItems = items
    .map((it, i) => ({ it, i }))
    .filter((x) => x.it.type === 'income')
    .sort((a, b) => b.it.value - a.it.value)
  const expenseItems = items
    .map((it, i) => ({ it, i }))
    .filter((x) => x.it.type === 'expense')
    .sort((a, b) => b.it.value - a.it.value)

  if (!scenario) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Scenario not found.
      </div>
    )
  }

  function openAdd(type: 'income' | 'expense') {
    setEditIndex(null)
    setDraft({ ...BLANK, type })
    setDraftValue('')
    setItemOpen(true)
  }
  function openEdit(index: number) {
    const it = items[index]
    setEditIndex(index)
    setDraft(it)
    setDraftValue(String(it.value))
    setItemOpen(true)
  }
  function saveItem() {
    if (!draft.category) {
      toast.error('Pick a category')
      return
    }
    const next = { ...draft, value: parseCurrency(draftValue) }
    setItems((prev) => {
      if (editIndex === null) return [...prev, next]
      const copy = [...prev]
      copy[editIndex] = next
      return copy
    })
    setItemOpen(false)
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
    setItemOpen(false)
  }

  async function save() {
    setSaving(true)
    try {
      await updateScenario(scenario!.id, { name: name.trim() || 'Untitled', items })
      toast.success('Saved')
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    await deleteScenario(scenario!.id)
    toast.success('Deleted')
    nav('/scenarios')
  }

  return (
    <div className="space-y-5 pb-6">
      <button
        type="button"
        onClick={() => nav('/scenarios')}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Scenarios
      </button>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 text-lg font-semibold"
        placeholder="Scenario name"
      />

      <div className="grid grid-cols-2 gap-2">
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
          <div className="text-[11px] text-muted-foreground">
            {formatCurrency(fiscalNet)} / fiscal period
          </div>
        </div>
        <div className="rounded-xl bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            vs your budget
          </div>
          <div
            className={cn(
              'tabular mt-1 text-lg font-semibold',
              delta < 0 ? 'text-neg' : delta > 0 ? 'text-pos' : '',
            )}
          >
            {formatCurrency(delta, { signed: true })}
          </div>
          <div className="text-[11px] text-muted-foreground">
            baseline {formatCurrency(baselineNet)}
          </div>
        </div>
      </div>

      {(['income', 'expense'] as const).map((type) => {
        const list = type === 'income' ? incomeItems : expenseItems
        return (
          <section key={type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold capitalize">{type}</h2>
              <Button size="sm" variant="outline" onClick={() => openAdd(type)}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            {list.map(({ it, i }) => {
              const Icon = categoryIcon(it.category)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => openEdit(i)}
                  className="flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                      <Icon className="size-3.5" />
                      {it.category}
                    </span>
                    {it.description && (
                      <div className="mt-1 truncate text-sm">{it.description}</div>
                    )}
                  </div>
                  <span
                    className={cn(
                      'tabular shrink-0 font-semibold',
                      type === 'income' ? 'text-pos' : 'text-neg',
                    )}
                  >
                    {formatCurrency(type === 'income' ? it.value : -it.value, {
                      signed: true,
                    })}
                  </span>
                </button>
              )
            })}
          </section>
        )
      })}

      <Button onClick={save} disabled={saving} className="h-11 w-full text-base">
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        Save scenario
      </Button>
      <Button
        variant="ghost"
        onClick={() => setConfirmDel(true)}
        className="w-full text-neg hover:bg-neg/10 hover:text-neg"
      >
        Delete scenario
      </Button>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editIndex === null ? 'Add' : 'Edit'} {draft.type}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['income', 'expense'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, type: k }))}
                  className={cn(
                    'rounded-md border py-2 text-sm font-medium capitalize',
                    draft.type === k
                      ? k === 'income'
                        ? 'border-pos/40 bg-pos/10 text-pos'
                        : 'border-neg/40 bg-neg/10 text-neg'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <CategorySelect
                  value={draft.category}
                  onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Monthly</Label>
                <div className="relative w-28">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    inputMode="decimal"
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    className="tabular pl-7 text-right"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveItem} className="flex-1">
                {editIndex === null ? 'Add' : 'Save'}
              </Button>
              {editIndex !== null && (
                <Button
                  variant="ghost"
                  onClick={() => removeItem(editIndex)}
                  className="text-neg hover:bg-neg/10 hover:text-neg"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scenario?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={del}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
