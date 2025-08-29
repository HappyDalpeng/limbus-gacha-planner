// Returns a numeric percentage value with rounding and edge protection.
// - p<=0 -> 0
// - p>=1 -> 100
// - otherwise rounds to `digits` and clamps away from 0/100 by the minimal step
export function formatPercentValue(p: number, digits = 2): string {
  if (!Number.isFinite(p)) return (0).toFixed(digits);
  if (p <= 0) return (0).toFixed(digits);
  if (p >= 1) return (100).toFixed(digits);

  const mult = Math.pow(10, digits);
  const minStep = 1 / mult; // percent units (e.g., 0.01 for digits=2)

  let val = Number((p * 100).toFixed(digits));
  if (val <= 0) val = minStep; // avoid rendering as 0 unless truly 0
  if (val >= 100) val = 100 - minStep; // avoid rendering as 100 unless truly 1
  return val.toFixed(digits);
}
