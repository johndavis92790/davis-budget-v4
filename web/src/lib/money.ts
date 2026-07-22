// Money is stored as dollars (number), always rounded to 2 decimals on write.
// Sums are rounded to cents to avoid float drift.

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((acc, v) => acc + v, 0))
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** "$1,234.56". With `signed`, prefixes +/- based on sign. */
export function formatCurrency(n: number, opts?: { signed?: boolean }): string {
  const s = USD.format(Math.abs(n))
  if (opts?.signed) return `${n < 0 ? '−' : '+'}${s}`
  return `${n < 0 ? '−' : ''}${s}`
}

/** Parse a user-typed currency string into a rounded number. */
export function parseCurrency(input: string): number {
  const cleaned = input.replace(/[^0-9.-]/g, '')
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? 0 : roundMoney(n)
}
