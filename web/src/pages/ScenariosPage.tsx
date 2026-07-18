import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, Loader2, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useData } from '@/lib/data'
import { addScenario } from '@/lib/db'
import { roundMoney, sumMoney, formatCurrency } from '@/lib/money'
import type { Scenario, ScenarioItem } from '@/lib/types'
import { cn } from '@/lib/utils'

function netOf(items: ScenarioItem[]) {
  const inc = sumMoney(items.filter((i) => i.type === 'income').map((i) => i.value))
  const exp = sumMoney(items.filter((i) => i.type === 'expense').map((i) => i.value))
  return roundMoney(inc - exp)
}

export function ScenariosPage() {
  const { scenarios, recurring } = useData()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [clone, setClone] = useState(true)
  const [creating, setCreating] = useState(false)

  const baselineNet = useMemo(() => {
    const inc = sumMoney(
      recurring.filter((r) => r.type === 'income' && r.active).map((r) => r.value),
    )
    const exp = sumMoney(
      recurring.filter((r) => r.type === 'expense' && r.active).map((r) => r.value),
    )
    return roundMoney(inc - exp)
  }, [recurring])

  async function create() {
    if (!name.trim()) {
      toast.error('Give it a name')
      return
    }
    setCreating(true)
    try {
      const items: ScenarioItem[] = clone
        ? recurring
            .filter((r) => r.active)
            .map((r) => ({
              type: r.type,
              category: r.category,
              tags: r.tags ?? [],
              value: r.value,
              description: r.description ?? '',
            }))
        : []
      const id = await addScenario({ name: name.trim(), items })
      setOpen(false)
      setName('')
      nav(`/scenarios/${id}`)
    } catch {
      toast.error('Could not create')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Scenarios</h1>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="size-4" />
          New
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Model what-ifs — a new mortgage, a raise, daycare — as their own set of
        recurring items and compare the monthly net to your real budget.
      </p>

      <div className="rounded-xl border border-border p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Your budget (baseline)
        </div>
        <div
          className={cn(
            'tabular mt-1 text-xl font-semibold',
            baselineNet < 0 ? 'text-neg' : 'text-pos',
          )}
        >
          {formatCurrency(baselineNet)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            net / mo
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {scenarios.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
            <Lightbulb className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No scenarios yet.</p>
          </div>
        )}
        {scenarios.map((s: Scenario) => {
          const net = netOf(s.items ?? [])
          const delta = roundMoney(net - baselineNet)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => nav(`/scenarios/${s.id}`)}
              className="flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.name}</div>
                <div className="tabular text-sm text-muted-foreground">
                  {formatCurrency(net)} net / mo
                  <span
                    className={cn(
                      'ml-2',
                      delta < 0 ? 'text-neg' : delta > 0 ? 'text-pos' : '',
                    )}
                  >
                    {delta === 0
                      ? ''
                      : `(${formatCurrency(delta, { signed: true })} vs budget)`}
                  </span>
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </button>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New scenario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 550k house"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
              <div>
                <div className="font-medium">Start from current budget</div>
                <div className="text-xs text-muted-foreground">
                  Copy your active recurring items to tweak
                </div>
              </div>
              <Switch checked={clone} onCheckedChange={setClone} />
            </div>
            <Button
              onClick={create}
              disabled={creating}
              className="h-11 w-full text-base"
            >
              {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
