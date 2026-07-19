import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  Loader2,
  Sparkles,
  SplitSquareVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import { TransactionForm } from '@/components/TransactionForm'
import {
  SplitEditor,
  type SplitRow,
  type ParsedSplit,
} from '@/components/SplitEditor'
import { useAuth } from '@/lib/auth'
import { scanReceiptFn, type ScanResult, type ScanLineItem } from '@/lib/functions'
import { uploadReceipt, fileToBase64 } from '@/lib/receipts'
import { addTransaction } from '@/lib/db'
import { roundMoney } from '@/lib/money'
import { todayIso } from '@/lib/fiscal'
import type { Transaction } from '@/lib/types'

type Step = 'capture' | 'scanning' | 'review' | 'split'

/** Collapse AI line items into one row per category (+ HSA group), summing amounts. */
function groupLineItems(items: ScanLineItem[]): SplitRow[] {
  const map = new Map<
    string,
    { category: string; hsa: boolean; amount: number; descs: string[] }
  >()
  for (const li of items) {
    const key = `${li.category}|${li.hsa ? 'h' : 'n'}`
    const g = map.get(key) ?? {
      category: li.category,
      hsa: !!li.hsa,
      amount: 0,
      descs: [],
    }
    g.amount += typeof li.amount === 'number' ? li.amount : 0
    if (li.description) g.descs.push(li.description)
    map.set(key, g)
  }
  return [...map.values()].map((g) => ({
    category: g.category,
    hsa: g.hsa,
    amount: roundMoney(g.amount).toFixed(2),
    description:
      g.descs.slice(0, 4).join(', ') +
      (g.descs.length > 4 ? `, +${g.descs.length - 4} more` : ''),
  }))
}

export function ScanPage() {
  const nav = useNavigate()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('capture')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [splitRows, setSplitRows] = useState<SplitRow[]>([])
  const [splitDate, setSplitDate] = useState(todayIso())

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
    setSplitRows(groupLineItems(result?.lineItems ?? []))
    setSplitDate(result?.date || todayIso())
    setStep('split')
  }

  async function saveSplit(rows: ParsedSplit[]) {
    setSaving(true)
    try {
      const ids: string[] = []
      for (const r of rows) {
        const id = await addTransaction(
          {
            date: splitDate,
            type: 'expense',
            category: r.category,
            tags: result?.tags ?? [],
            amount: r.amount,
            description: r.description,
            hsa: r.hsa,
          },
          user?.email ?? undefined,
        )
        ids.push(id)
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

  const lineGroups = groupLineItems(result?.lineItems ?? [])

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
            <span className="text-xs text-muted-foreground">Image or PDF</span>
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

          {lineGroups.length >= 2 && (
            <button
              type="button"
              onClick={startSplit}
              className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-accent/40"
            >
              <SplitSquareVertical className="size-5 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  This receipt spans {lineGroups.length} categories
                </div>
                <div className="text-xs text-muted-foreground">
                  Split into separate transactions (
                  {lineGroups.map((g) => g.category).join(', ')})
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
          <SplitEditor
            initialRows={splitRows}
            date={splitDate}
            onDate={setSplitDate}
            onSubmit={saveSplit}
            saving={saving}
            compareTotal={result?.amount}
          />
        </div>
      )}
    </div>
  )
}
