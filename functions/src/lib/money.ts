export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((acc, v) => acc + v, 0))
}
