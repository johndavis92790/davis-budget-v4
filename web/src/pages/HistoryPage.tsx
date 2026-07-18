import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TransactionRow } from '@/components/TransactionRow'
import { useData } from '@/lib/data'
import { CATEGORY_NAMES } from '@/lib/categories'

const TYPE_FILTERS = [
  { v: 'all', l: 'All types' },
  { v: 'expense', l: 'Expenses' },
  { v: 'refund', l: 'Refunds' },
  { v: 'income', l: 'Income' },
  { v: 'reimbursement', l: 'Reimbursements' },
  { v: 'recurring', l: 'Recurring' },
]

export function HistoryPage() {
  const { transactions, loading } = useData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [cat, setCat] = useState('all')
  const [limit, setLimit] = useState(40)

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return transactions.filter((t) => {
      if (cat !== 'all' && t.category !== cat) return false
      if (type !== 'all') {
        if (type === 'recurring') {
          if (!t.type.startsWith('recurring')) return false
        } else if (t.type !== type) return false
      }
      if (ql) {
        const hay = `${t.description} ${t.category} ${t.tags.join(' ')}`.toLowerCase()
        if (!hay.includes(ql)) return false
      }
      return true
    })
  }, [transactions, q, type, cat])

  const shown = filtered.slice(0, limit)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">History</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setLimit(40)
          }}
          placeholder="Search description, category, tags…"
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v)
            setLimit(40)
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTERS.map((f) => (
              <SelectItem key={f.v} value={f.v}>
                {f.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={cat}
          onValueChange={(v) => {
            setCat(v)
            setLimit(40)
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_NAMES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString()} transaction
            {filtered.length === 1 ? '' : 's'}
          </div>
          <div className="space-y-2">
            {shown.map((t) => (
              <TransactionRow
                key={t.id}
                t={t}
                onClick={() => nav(`/edit/${t.id}`)}
              />
            ))}
          </div>
          {limit < filtered.length && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLimit((l) => l + 40)}
            >
              Load more
            </Button>
          )}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No matching transactions.
            </div>
          )}
        </>
      )}
    </div>
  )
}
