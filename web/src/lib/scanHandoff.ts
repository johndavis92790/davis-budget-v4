/**
 * Tiny in-memory hand-off for a file chosen on one screen (e.g. the Home "Scan"
 * button opens the picker immediately) and consumed on the Scan page. A File
 * can't ride in router state, so we stash it here and take it once on mount.
 */
let pending: File | null = null

export function setPendingScanFile(f: File | null) {
  pending = f
}

/** Returns the pending file (if any) and clears it. */
export function takePendingScanFile(): File | null {
  const f = pending
  pending = null
  return f
}
