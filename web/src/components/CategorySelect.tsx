import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATEGORIES } from '@/lib/categories'

export function CategorySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Category" />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((c) => {
          const Icon = c.icon
          return (
            <SelectItem key={c.name} value={c.name}>
              <span className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                {c.name}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
