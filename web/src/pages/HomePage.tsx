import { Plus, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HomePage() {
  return (
    <div className="space-y-5">
      {/* Goals banner */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Weekly goal
          </div>
          <div className="tabular mt-1.5 text-2xl font-semibold">$0.00</div>
        </div>
        <div className="rounded-xl bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Available funds
          </div>
          <div className="tabular mt-1.5 text-2xl font-semibold text-pos">
            $0.00
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button className="h-11 flex-1 gap-2 text-base">
          <Plus className="size-5" />
          Add expense
        </Button>
        <Button variant="secondary" className="h-11 gap-2 text-base">
          <ScanLine className="size-5" />
          Scan
        </Button>
      </div>

      {/* Recent */}
      <div>
        <h2 className="mb-2 text-base font-semibold">Recent</h2>
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No transactions yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your history will appear here once data is migrated.
          </p>
        </div>
      </div>
    </div>
  )
}
