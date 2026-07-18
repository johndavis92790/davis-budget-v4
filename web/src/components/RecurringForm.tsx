import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
import { CategorySelect } from './CategorySelect'
import { TagInput } from './TagInput'
import { useData } from '@/lib/data'
import { addRecurring, updateRecurring, deleteRecurring } from '@/lib/db'
import { parseCurrency } from '@/lib/money'
import type { RecurringTemplate } from '@/lib/types'
import { cn } from '@/lib/utils'

export function RecurringForm({
  initial,
  defaultType = 'expense',
  onDone,
}: {
  initial?: RecurringTemplate | null
  defaultType?: 'income' | 'expense'
  onDone: () => void
}) {
  const { tags: allTags } = useData()
  const editing = !!initial?.id

  const [type, setType] = useState<'income' | 'expense'>(
    initial?.type ?? defaultType,
  )
  const [category, setCategory] = useState(initial?.category ?? '')
  const [value, setValue] = useState(initial ? String(initial.value) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [active, setActive] = useState(initial?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  async function save() {
    if (!category) {
      toast.error('Pick a category')
      return
    }
    const v = parseCurrency(value)
    setSaving(true)
    try {
      const payload = { type, category, tags, value: v, description: description.trim(), active }
      if (editing) await updateRecurring(initial!.id, payload)
      else await addRecurring(payload)
      toast.success(editing ? 'Saved' : 'Added')
      onDone()
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    await deleteRecurring(initial!.id)
    toast.success('Deleted')
    onDone()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(['income', 'expense'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            className={cn(
              'rounded-md border py-2 text-sm font-medium capitalize transition-colors',
              type === k
                ? k === 'income'
                  ? 'border-pos/40 bg-pos/10 text-pos'
                  : 'border-neg/40 bg-neg/10 text-neg'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategorySelect value={category} onChange={setCategory} />
        </div>
        <div className="space-y-1.5">
          <Label>Monthly</Label>
          <div className="relative w-32">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
              className="tabular pl-7 text-right"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Mortgage"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tags</Label>
        <TagInput value={tags} onChange={setTags} suggestions={allTags} />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
        <div>
          <div className="font-medium">Active</div>
          <div className="text-xs text-muted-foreground">
            Inactive items are excluded from totals and materialization
          </div>
        </div>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>

      <Button onClick={save} disabled={saving} className="h-11 w-full text-base">
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        {editing ? 'Save' : 'Add'}
      </Button>

      {editing && (
        <Button
          variant="ghost"
          onClick={() => setConfirmDel(true)}
          className="w-full text-neg hover:bg-neg/10 hover:text-neg"
        >
          Delete
        </Button>
      )}

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recurring item?</AlertDialogTitle>
            <AlertDialogDescription>
              Past history entries it already created are kept.
            </AlertDialogDescription>
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
