import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { TransactionForm } from '@/components/TransactionForm'
import { SplitEditor, type ParsedSplit } from '@/components/SplitEditor'
import { useAuth } from '@/lib/auth'
import { addTransaction } from '@/lib/db'
import { todayIso } from '@/lib/fiscal'
import { cn } from '@/lib/utils'

export function AddTransactionPage() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [mode, setMode] = useState<'single' | 'split'>('single')
  const [date, setDate] = useState(todayIso())
  const [saving, setSaving] = useState(false)

  async function saveSplit(rows: ParsedSplit[]) {
    setSaving(true)
    try {
      let n = 0
      for (const r of rows) {
        await addTransaction(
          {
            date,
            type: 'expense',
            category: r.category,
            tags: r.tags,
            amount: r.amount,
            description: r.description,
            hsa: r.hsa,
          },
          user?.email ?? undefined,
        )
        n++
      }
      toast.success(`Saved ${n} transaction${n === 1 ? '' : 's'}`)
      nav('/')
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => nav(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>
      <h1 className="text-xl font-semibold tracking-tight">Add transaction</h1>

      <div className="grid grid-cols-2 gap-2">
        {(['single', 'split'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded-md border py-2 text-sm font-medium capitalize transition-colors',
              mode === m
                ? 'border-primary/50 bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {m === 'single' ? 'Single' : 'Split by category'}
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <TransactionForm mode="add" onSaved={() => nav('/')} />
      ) : (
        <SplitEditor
          initialRows={[]}
          date={date}
          onDate={setDate}
          onSubmit={saveSplit}
          saving={saving}
        />
      )}
    </div>
  )
}
