import { useEffect, useRef, useState } from 'react'
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  listReceipts,
  uploadReceipt,
  deleteReceipt,
  type ReceiptFile,
} from '@/lib/receipts'

const isImage = (name: string) => /\.(png|jpe?g|webp|gif|heic|avif)$/i.test(name)

export function ReceiptsSection({ transactionId }: { transactionId: string }) {
  const [files, setFiles] = useState<ReceiptFile[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function reload() {
    setLoading(true)
    try {
      setFiles(await listReceipts(transactionId))
    } catch {
      /* empty */
    }
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId])

  async function onAdd(f: File) {
    setBusy(true)
    try {
      await uploadReceipt(transactionId, f)
      await reload()
    } catch {
      toast.error('Upload failed')
    }
    setBusy(false)
  }

  async function onDelete(path: string) {
    try {
      await deleteReceipt(path)
      await reload()
    } catch {
      toast.error('Could not delete')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Receipts</Label>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onAdd(e.target.files[0])}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground">No receipts attached.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f) => (
            <div
              key={f.path}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-card"
            >
              <a href={f.url} target="_blank" rel="noreferrer" className="block size-full">
                {isImage(f.name) ? (
                  <img
                    src={f.url}
                    alt="receipt"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                    <FileText className="size-6" />
                    <span className="text-[10px]">PDF</span>
                  </div>
                )}
              </a>
              <button
                type="button"
                onClick={() => onDelete(f.path)}
                aria-label="Delete receipt"
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
