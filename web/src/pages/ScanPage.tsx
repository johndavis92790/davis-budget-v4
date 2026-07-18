import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  Loader2,
  Sparkles,
  Trash2,
  Plus,
  SplitSquareVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { TransactionForm } from '@/components/TransactionForm'
import { CategorySelect } from '@/components/CategorySelect'
import { useAuth } from '@/lib/auth'
import { scanReceiptFn, type ScanResult } from '@/lib/functions'
import { uploadReceipt, fileToBase64 } from '@/lib/receipts'
import { addTransaction } from '@/lib/db'
import { parseCurrency, formatCurrency, sumMoney } from '@/lib/money'
import { todayIso } from '@/lib/fiscal'
import type { Transaction } from '@/lib/types'

type Step = 'capture' | 'scanning' | 'review' | 'split'
type SplitItem = {
  description: string
  amount: string
  category: string
  hsa: boolean
}

export function ScanPage() {
  const nav = useNavigate()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('capture')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [splitItems, setSplitItems] = useState<SplitItem[]>([])

  async function onFile(f: File) {
    setFile(f)
    setStep('scanning')
    try {
      const imageBase64 = await fileToBase64(f)
      const res = await scanReceiptFn({ imageBase64, mimeType: f.type })
      setResult(res.data)
      setStep('review')
    } catch (e) {
      console.error(e)
      toast.error('Could not scan. Try again or add it manually.')
      setStep('capture')
    }
  }

  async function afterSingleSave(id?: string) {
    if (id && file) {
      try {
        await uploadReceipt(id, file)
      } catch (e) {
        console.error('receipt upload failed', e)
      }
    }
    nav('/')
  }

  function startSplit() {
    const items: SplitItem[] = (result?.lineItems ?? []).map((li) => ({
      description: li.description,
      amount: String(li.amount),
      category: li.category,
      hsa: !!li.hsa,
    }))
    setSplitItems(
      items.length
        ? items
        : [{ description: '', amount: '', category: result?.category ?? '', hsa: false }],
    )
    setStep('split')
  }

  async function saveSplit() {
    setSaving(true)
    try {
      const date = result?.date || todayIso()
      const ids: string[] = []
      for (const it of splitItems) {
        const amt = parseCurrency(it.amount)
        if (amt <= 0 || !it.category) continue
        const id = await addTransaction(
          {
            date,
            type: 'expense',
            category: it.category,
            tags: result?.tags ?? [],
            amount: amt,
            description: it.description.trim(),
            hsa: it.hsa,
          },
          user?.email ?? undefined,
        )
        ids.push(id)
      }
      if (!ids.length) {
        toast.error('Add at least one valid item')
        setSaving(false)
        return
      }
      if (file) {
        for (const id of ids) {
          try {
            await uploadReceipt(id, file)
          } catch (e) {
            console.error(e)
          }
        }
      }
      toast.success(`Saved ${ids.length} transaction${ids.length > 1 ? 's' : ''}`)
      nav('/')
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  const initial: Partial<Transaction> | undefined = result
    ? {
        type: result.type,
        category: result.category,
        amount: result.amount,
        date: result.date || todayIso(),
        description: result.description || result.merchant || '',
        tags: result.tags || [],
        hsa: !!result.hsa,
      }
    : undefined

  const splitTotal = sumMoney(splitItems.map((i) => parseCurrency(i.amount)))

  return (
    <div className="space-y-5 pb-6">
      <button
        type="button"
        onClick={() => (step === 'capture' ? nav(-1) : setStep('capture'))}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {step === 'capture' ? 'Back' : 'Start over'}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />

      {step === 'capture' && (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold tracking-tight">Scan a receipt</h1>
          <p className="text-sm text-muted-foreground">
            Take a photo or upload a receipt, screenshot, or PDF. AI fills in the
            details — you just review and save.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 transition-colors hover:bg-accent/40"
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Camera className="size-7" />
            </div>
            <span className="font-medium">Take photo or upload</span>
            <span className="text-xs text-muted-foreground">
              Image or PDF
            </span>
          </button>
        </div>
      )}

      {step === 'scanning' && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="relative">
            <Sparkles className="size-8 text-primary" />
            <Loader2 className="absolute -right-3 -top-3 size-5 animate-spin text-muted-foreground" />
          </div>
          <div className="font-medium">Reading your receipt…</div>
          <div className="text-sm text-muted-foreground">
            Extracting amount, date, and category
          </div>
        </div>
      )}

      {step === 'review' && initial && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span>Review the details AI pulled from your receipt, then save.</span>
          </div>

          {result?.lineItems && result.lineItems.length >= 2 && (
            <button
              type="button"
              onClick={startSplit}
              className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-accent/40"
            >
              <SplitSquareVertical className="size-5 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  This receipt has {result.lineItems.length} items
                </div>
                <div className="text-xs text-muted-foreground">
                  Split into separate transactions (e.g. isolate an HSA item)
                </div>
              </div>
            </button>
          )}

          <TransactionForm mode="add" initial={initial} onSaved={afterSingleSave} />
        </div>
      )}

      {step === 'split' && (
        <div className="space-y-4">
          <h1 className="text-lg font-semibold">Split receipt</h1>
          <div className="space-y-3">
            {splitItems.map((it, i) => (
              <div key={i} className="space-y-2 rounded-xl bg-card p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <CategorySelect
                      value={it.category}
                      onChange={(v) =>
                        setSplitItems((s) =>
                          s.map((x, j) => (j === i ? { ...x, category: v } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="relative w-24">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      inputMode="decimal"
                      value={it.amount}
                      onChange={(e) =>
                        setSplitItems((s) =>
                          s.map((x, j) =>
                            j === i ? { ...x, amount: e.target.value } : x,
                          ),
                        )
                      }
                      className="tabular h-9 pl-6 text-right"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSplitItems((s) => s.filter((_, j) => j !== i))
                    }
                    className="text-muted-foreground hover:text-neg"
                    aria-label="Remove item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <Input
                  value={it.description}
                  onChange={(e) =>
                    setSplitItems((s) =>
                      s.map((x, j) =>
                        j === i ? { ...x, description: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="Description"
                  className="h-9"
                />
                <label className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">HSA eligible</span>
                  <Switch
                    checked={it.hsa}
                    onCheckedChange={(v) =>
                      setSplitItems((s) =>
                        s.map((x, j) => (j === i ? { ...x, hsa: v } : x)),
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              setSplitItems((s) => [
                ...s,
                { description: '', amount: '', category: '', hsa: false },
              ])
            }
          >
            <Plus className="size-4" />
            Add item
          </Button>
          <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
            <span className="text-sm font-medium">Total</span>
            <span className="tabular font-semibold">
              {formatCurrency(splitTotal)}
            </span>
          </div>
          <Button
            onClick={saveSplit}
            disabled={saving}
            className="h-11 w-full text-base"
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save {splitItems.length} transaction{splitItems.length > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  )
}
