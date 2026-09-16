import { useState } from 'react'

const TTL_MS = 60 * 60 * 1000 // 60 minutes, sliding (resets on every change)

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const { value, ts } = JSON.parse(raw) as { value: T; ts: number }
    if (Date.now() - ts > TTL_MS) {
      localStorage.removeItem(key)
      return fallback
    }
    return value
  } catch {
    return fallback
  }
}

/**
 * A filter-state object that survives navigating away and back (e.g. into a
 * transaction and back to a list page) for 60 minutes of inactivity, so the
 * user doesn't have to keep retyping search/filter state. Backed by
 * localStorage; each page should pass its own unique storageKey.
 */
export function usePersistedFilters<T extends object>(
  storageKey: string,
  initial: T,
) {
  const [filters, setFiltersState] = useState<T>(() =>
    readStored(storageKey, initial),
  )

  function setFilters(update: Partial<T> | ((prev: T) => T)) {
    setFiltersState((prev) => {
      const next =
        typeof update === 'function'
          ? (update as (p: T) => T)(prev)
          : { ...prev, ...update }
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ value: next, ts: Date.now() }),
        )
      } catch {
        /* storage full/unavailable — filter just won't persist */
      }
      return next
    })
  }

  return [filters, setFilters] as const
}
