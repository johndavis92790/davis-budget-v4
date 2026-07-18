import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { useData } from '@/lib/data'
import { availableFunds } from '@/lib/compute'
import { setWeeklyGoal, adjustAvailableFunds } from '@/lib/db'
import { parseCurrency } from '@/lib/money'
import { getFiscal, todayIso } from '@/lib/fiscal'

function CurrencyField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="tabular pl-7"
      />
    </div>
  )
}

function GoalsForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const { transactions, ledgerAnchor, weeklyGoals } = useData()
  const week = getFiscal(todayIso())
  const currentWeekly = weeklyGoals[week.weekKey]?.target ?? 0
  const available = availableFunds(transactions, ledgerAnchor)

  const [weekly, setWeekly] = useState(currentWeekly ? String(currentWeekly) : '')
  const [avail, setAvail] = useState(String(available))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await setWeeklyGoal(
        week.weekKey,
        parseCurrency(weekly),
        user?.email ?? undefined,
      )
      await adjustAvailableFunds(
        available,
        parseCurrency(avail),
        user?.email ?? undefined,
      )
      toast.success('Goals updated')
      onDone()
    } catch {
      toast.error('Could not update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Weekly spending goal</Label>
        <CurrencyField value={weekly} onChange={setWeekly} />
        <p className="text-xs text-muted-foreground">
          Your target for this fiscal week. Set a fresh one each week.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Available funds</Label>
        <CurrencyField value={avail} onChange={setAvail} />
        <p className="text-xs text-muted-foreground">
          Computed automatically and rolls over month to month. Editing records
          a one-off adjustment.
        </p>
      </div>
      <Button onClick={save} disabled={saving} className="h-11 w-full text-base">
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        Save goals
      </Button>
    </div>
  )
}

export function GoalsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit goals</DialogTitle>
        </DialogHeader>
        {open && <GoalsForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
