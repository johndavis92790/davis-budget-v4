// Davis Budget fiscal calendar.
//
// A 4-week / 13-period accounting year, anchored at 2021-01-10 (a Sunday).
// Every fiscal year is exactly 52 weeks = 364 days = 13 periods × 4 weeks × 7
// days. There are no 53-week years (verified against the v3 data: each year's
// start is exactly +364 days from the prior). All math is done in UTC on pure
// calendar dates (YYYY-MM-DD) so period mapping is timezone-independent.

const EPOCH_UTC = Date.UTC(2021, 0, 10) // 2021-01-10, week 0 / period 1 / FY2021
const DAY = 86_400_000
const WEEK = 7 * DAY

export interface FiscalInfo {
  yearTitle: number // e.g. 2026
  monthNum: number // fiscal period 1..13
  weekNum: number // week within period 1..4
  yearKey: string // "FY2026"
  monthKey: string // "FY2026-P07"
  weekKey: string // "FY2026-P07-W4"
  yearStart: string
  yearEnd: string
  monthStart: string
  monthEnd: string
  weekStart: string
  weekEnd: string
}

function isoToUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function utcToIso(ms: number): string {
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const p2 = (n: number) => String(n).padStart(2, '0')

export function getFiscal(iso: string): FiscalInfo {
  const ms = isoToUTC(iso)
  const weekIndex = Math.floor((ms - EPOCH_UTC) / WEEK)
  const yearIndex = Math.floor(weekIndex / 52)
  const weekInYear = weekIndex - yearIndex * 52 // 0..51
  const monthNum = Math.floor(weekInYear / 4) + 1 // 1..13
  const weekNum = (weekInYear % 4) + 1 // 1..4
  const yearTitle = 2021 + yearIndex

  const yearStartMs = EPOCH_UTC + yearIndex * 52 * WEEK
  const yearEndMs = yearStartMs + 52 * WEEK - DAY
  const monthStartMs = yearStartMs + (monthNum - 1) * 4 * WEEK
  const monthEndMs = monthStartMs + 4 * WEEK - DAY
  const weekStartMs = EPOCH_UTC + weekIndex * WEEK
  const weekEndMs = weekStartMs + WEEK - DAY

  return {
    yearTitle,
    monthNum,
    weekNum,
    yearKey: `FY${yearTitle}`,
    monthKey: `FY${yearTitle}-P${p2(monthNum)}`,
    weekKey: `FY${yearTitle}-P${p2(monthNum)}-W${weekNum}`,
    yearStart: utcToIso(yearStartMs),
    yearEnd: utcToIso(yearEndMs),
    monthStart: utcToIso(monthStartMs),
    monthEnd: utcToIso(monthEndMs),
    weekStart: utcToIso(weekStartMs),
    weekEnd: utcToIso(weekEndMs),
  }
}

/** Today's date as a local calendar YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

/** Shift an ISO date by whole days (UTC-safe). */
export function addDaysIso(iso: string, days: number): string {
  return utcToIso(isoToUTC(iso) + days * DAY)
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Sat, Jul 18 '26" */
export function formatDatePretty(iso: string): string {
  const ms = isoToUTC(iso)
  const dt = new Date(ms)
  const dow = DOW[dt.getUTCDay()]
  const mon = MONTHS[dt.getUTCMonth()]
  const day = dt.getUTCDate()
  const yy = String(dt.getUTCFullYear()).slice(2)
  return `${dow}, ${mon} ${day} '${yy}`
}

/** "Jul 18" (no year) */
export function formatDateShort(iso: string): string {
  const dt = new Date(isoToUTC(iso))
  return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`
}

/** "Jun 21 – Jul 18" for a period range. */
export function formatRange(startIso: string, endIso: string): string {
  return `${formatDateShort(startIso)} – ${formatDateShort(endIso)}`
}

/** Human label for a fiscal period, e.g. "Period 7 · 2026". */
export function monthLabel(info: Pick<FiscalInfo, 'monthNum' | 'yearTitle'>): string {
  return `Period ${info.monthNum} · ${info.yearTitle}`
}
