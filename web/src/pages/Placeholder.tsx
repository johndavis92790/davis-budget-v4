import { Construction } from 'lucide-react'

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Construction className="size-6" />
      </div>
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Coming soon — we&apos;re building this out.
      </p>
    </div>
  )
}
