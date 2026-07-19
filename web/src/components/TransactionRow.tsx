import { categoryIcon } from '@/lib/categories'
import { formatCurrency } from '@/lib/money'
import { formatDatePretty } from '@/lib/fiscal'
import { isReimbursed, signedAmount, TYPE_LABELS, type Transaction } from '@/lib/types'
import { cn } from '@/lib/utils'

export function TransactionRow({
  t,
  onClick,
}: {
  t: Transaction
  onClick?: () => void
}) {
  const Icon = categoryIcon(t.category)
  const signed = signedAmount(t)
  const pos = signed >= 0
  const reimbursed = t.hsa && isReimbursed(t)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
            <Icon className="size-3.5" />
            {t.category}
          </span>
          {t.hsa && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                reimbursed
                  ? 'bg-pos/15 text-pos'
                  : 'bg-amber-500/15 text-amber-500',
              )}
            >
              {reimbursed ? 'HSA · reimbursed' : 'HSA'}
            </span>
          )}
        </div>
        {t.description && (
          <div className="line-clamp-2 text-sm text-foreground/90">
            {t.description}
          </div>
        )}
        {t.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {t.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-[11px] text-muted-foreground">
          {TYPE_LABELS[t.type]}
        </span>
        <span
          className={cn(
            'tabular text-[15px] font-semibold',
            pos ? 'text-pos' : 'text-neg',
          )}
        >
          {formatCurrency(signed, { signed: true })}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatDatePretty(t.date)}
        </span>
      </div>
    </button>
  )
}
