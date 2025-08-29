import { PITY_STEP } from "@/lib/prob";

// Compute X ticks with dynamic spacing; always include pity boundaries and endpoints.
export function computeXTicks(maxN: number, chartWidth: number): number[] {
  const width = chartWidth || 800;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const sample = String(maxN);
  const font = getComputedStyle(document.documentElement).font || "12px sans-serif";
  if (ctx) ctx.font = font;

  const textW = Math.ceil((ctx ? ctx.measureText(sample).width : 18) + 8);
  const minPx = Math.max(18, textW);

  const targetCount = Math.max(6, Math.min(60, Math.floor(width / minPx)));
  const threshold = Math.max(10, Math.ceil(maxN / targetCount));

  // Pick "nice" numeric steps
  const bases = [1, 2, 2.5, 5];
  const steps: number[] = [];
  for (let scale = 10; scale <= Math.max(10, maxN * 2 + 10); scale *= 10) {
    for (const b of bases) steps.push(Math.round(b * scale));
  }
  steps.sort((a, b) => a - b);
  const step = steps.find((s) => s >= threshold) || 10;

  // Regular steps + pity boundaries + endpoints
  const set = new Set<number>();
  for (let n = 0; n <= maxN; n += step) set.add(n);
  for (let n = 0; n <= maxN; n += PITY_STEP) set.add(n);
  set.add(0);
  set.add(maxN);

  return Array.from(set).sort((a, b) => a - b);
}
