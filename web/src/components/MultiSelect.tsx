import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type Option = string | { value: string; label: string }

function optValue(o: Option) {
  return typeof o === 'string' ? o : o.value
}
function optLabel(o: Option) {
  return typeof o === 'string' ? o : o.label
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  function toggle(opt: string) {
    onChange(
      selected.includes(opt)
        ? selected.filter((o) => o !== opt)
        : [...selected, opt],
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between gap-2 font-normal"
        >
          <span className="truncate">
            {label}
            {selected.length > 0 ? ` (${selected.length})` : ''}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {options.map((opt) => {
            const value = optValue(opt)
            return (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selected.includes(value)}
                  onCheckedChange={() => toggle(value)}
                />
                <span className="truncate">{optLabel(opt)}</span>
              </label>
            )
          })}
          {options.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No options.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
