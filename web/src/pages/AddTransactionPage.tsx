import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { TransactionForm } from '@/components/TransactionForm'

export function AddTransactionPage() {
  const nav = useNavigate()
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
      <TransactionForm mode="add" onSaved={() => nav('/')} />
    </div>
  )
}
