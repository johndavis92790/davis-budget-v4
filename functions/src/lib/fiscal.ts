// Fiscal calendar — mirror of web/src/lib/fiscal.ts (keep in sync).
// 4-week / 13-period year anchored at 2021-01-10; every year is 364 days.

const EPOCH_UTC = Date.UTC(2021, 0, 10)
const DAY = 86_400_000
const WEEK = 7 * DAY

export interface FiscalInfo {
  yearTitle: number
  monthNum: number
  weekNum: number
  yearKey: string
  monthKey: string
  weekKey: string
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
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`
}
const p2 = (n: number) => String(n).padStart(2, '0')

export function getFiscal(iso: string): FiscalInfo {
  const ms = isoToUTC(iso)
  const weekIndex = Math.floor((ms - EPOCH_UTC) / WEEK)
  const yearIndex = Math.floor(weekIndex / 52)
  const weekInYear = weekIndex - yearIndex * 52
  const monthNum = Math.floor(weekInYear / 4) + 1
  const weekNum = (weekInYear % 4) + 1
  const yearTitle = 2021 + yearIndex

  const yearStartMs = EPOCH_UTC + yearIndex * 52 * WEEK
  const monthStartMs = yearStartMs + (monthNum - 1) * 4 * WEEK
  const weekStartMs = EPOCH_UTC + weekIndex * WEEK

  return {
    yearTitle,
    monthNum,
    weekNum,
    yearKey: `FY${yearTitle}`,
    monthKey: `FY${yearTitle}-P${p2(monthNum)}`,
    weekKey: `FY${yearTitle}-P${p2(monthNum)}-W${weekNum}`,
    yearStart: utcToIso(yearStartMs),
    yearEnd: utcToIso(yearStartMs + 52 * WEEK - DAY),
    monthStart: utcToIso(monthStartMs),
    monthEnd: utcToIso(monthStartMs + 4 * WEEK - DAY),
    weekStart: utcToIso(weekStartMs),
    weekEnd: utcToIso(weekStartMs + WEEK - DAY),
  }
}

/** Today's date (America/Denver) as YYYY-MM-DD. */
export function denverToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function midnightMs(iso: string): number {
  return isoToUTC(iso)
}
