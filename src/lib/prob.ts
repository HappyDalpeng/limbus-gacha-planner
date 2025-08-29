export type Targets = {
  A: { pickup: number; desired: number };
  E: { pickup: number; desired: number };
  T: { pickup: number; desired: number };
};

export type GlobalSettings = {
  autoRecommend: boolean;
  ownAllExistingPoolEgo: boolean; // whether user owns all existing-pool (non-pickup) E.G.O
};
export type Resources = { lunacy: number; ticket1: number; ticket10: number };
export type PityAlloc = ("A" | "E" | "T")[];

export const PITY_STEP = 200;
export const LUNACY_PER_10 = 1300;
export const LUNACY_PER_1 = 130;

export function autoMaxDraws(targets: Targets) {
  const desiredTotal =
    Math.max(0, targets.A.desired) +
    Math.max(0, targets.E.desired) +
    Math.max(0, targets.T.desired);
  return desiredTotal * PITY_STEP;
}

export function baseCategoryProbs(hasAnnouncer: boolean, egoAvailable: boolean) {
  const pct = (x: number) => x / 100;
  let pA = hasAnnouncer ? pct(1.3) : 0;
  let pE = egoAvailable ? pct(1.3) : 0;
  let p3: number;
  let p2: number;
  let p1: number;

  if (egoAvailable) {
    p3 = pct(2.9);
    p2 = pct(12.8);
    p1 = hasAnnouncer ? pct(81.7) : pct(83.0);
  } else {
    p3 = pct(3.0);
    p2 = pct(13.0);
    p1 = hasAnnouncer ? 1 - (pA + p3 + p2) : pct(84.0);
  }

  return { pA, pE, p3, p2, p1 };
}

export function applyTenthDrawBoost(p: {
  pA: number;
  pE: number;
  p3: number;
  p2: number;
  p1: number;
}) {
  return { ...p, p2: p.p2 + p.p1, p1: 0 };
}

export function wantProbPerCategory(
  hasAnnouncer: boolean,
  egoAvailable: boolean,
  targets: Targets,
  opts?: { egoHalf?: number },
) {
  const base = baseCategoryProbs(hasAnnouncer, egoAvailable);
  const halfA = 0.5;
  const halfT = 0.5;
  const halfE = opts?.egoHalf ?? 0.5;
  const clamp = (x: number) => Math.max(0, Math.min(1, x));

  const pA = base.pA * halfA * ratio(targets.A.desired, targets.A.pickup);
  const pE = base.pE * halfE * ratio(targets.E.desired, targets.E.pickup);
  const pT = base.p3 * halfT * ratio(targets.T.desired, targets.T.pickup);

  return { pA: clamp(pA), pE: clamp(pE), pT: clamp(pT) };
}

function ratio(a: number, b: number) {
  if (b <= 0) return 0;
  return Math.max(0, Math.min(1, a / b));
}

export function resourcesToDraws(r: Resources) {
  const tenFromLunacy = Math.floor(r.lunacy / LUNACY_PER_10);
  const remainder = r.lunacy % LUNACY_PER_10;
  const oneFromLunacy = Math.floor(remainder / LUNACY_PER_1);
  const n10 = r.ticket10 + tenFromLunacy;
  const n1 = r.ticket1 + oneFromLunacy;
  const total = n10 * 10 + n1;

  return { n10, n1, total };
}

// Stirling approximation with correction terms for numerical stability
function logFactorial(n: number) {
  if (n < 2) return 0;
  const x = n + 1;
  return (
    (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) + 1 / (12 * x) - 1 / (360 * x ** 3)
  );
}
function logChoose(n: number, k: number) {
  if (k < 0 || k > n) return -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

export function binomPMF(k: number, n: number, p: number) {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  const logp = logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
  return Math.exp(logp);
}
export function binomCDF(k: number, n: number, p: number) {
  // Handle edge cases explicitly
  if (p <= 0) return k >= 0 ? 1 : 0;
  if (p >= 1) return k >= n ? 1 : 0;
  if (k < 0) return 0;
  if (k >= n) return 1;

  // Numerically stable cumulative sum via recurrence
  // P(X=0) = (1-p)^n
  // P(X=i) = P(X=i-1) * ((n - i + 1)/i) * (p/(1-p))
  const q = 1 - p;
  let pmf = Math.exp(n * Math.log(Math.max(1e-16, q))); // guard tiny negatives
  let sum = pmf;
  for (let i = 1; i <= k; i++) {
    pmf = pmf * ((n - i + 1) / i) * (p / q);
    sum += pmf;
    // Early break if additional mass is negligible
    if (!Number.isFinite(pmf) || pmf < 1e-18) break;
  }
  // Clamp for safety
  return Math.min(1, Math.max(0, sum));
}
function normalCDF(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let prob =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) prob = 1 - prob;
  return prob;
}

export function cumulativeSuccess(
  n: number,
  settings: GlobalSettings,
  targets: Targets,
  pityAlloc: PityAlloc,
) {
  const r = Math.floor(n / PITY_STEP);
  const pityCounts = { A: 0, E: 0, T: 0 } as Record<"A" | "E" | "T", number>;
  for (let i = 0; i < r && i < pityAlloc.length; i++) pityCounts[pityAlloc[i]]++;

  const mA = Math.max(0, targets.A.desired - pityCounts.A);
  const mE = Math.max(0, targets.E.desired - pityCounts.E);
  const mT = Math.max(0, targets.T.desired - pityCounts.T);

  const hasAnnouncer = targets.A.pickup > 0;
  const egoAvailable = targets.E.pickup > 0 || !settings.ownAllExistingPoolEgo;
  const egoHalf = targets.E.pickup > 0 && settings.ownAllExistingPoolEgo ? 1 : 0.5;
  const { pA, pE, pT } = wantProbPerCategory(hasAnnouncer, egoAvailable, targets, { egoHalf });

  const tailA = 1 - binomCDF(mA - 1, n, pA),
    tailE = 1 - binomCDF(mE - 1, n, pE),
    tailT = 1 - binomCDF(mT - 1, n, pT);

  return tailA * tailE * tailT;
}

export function computeGreedyPityAlloc(Nmax: number, settings: GlobalSettings, targets: Targets) {
  const R = Math.floor(Nmax / PITY_STEP),
    alloc: PityAlloc = [];

  const remaining = {
    A: targets.A.desired,
    E: targets.E.desired,
    T: targets.T.desired,
  } as Record<"A" | "E" | "T", number>;

  const hasAnnouncer = targets.A.pickup > 0;
  const egoAvailable = targets.E.pickup > 0 || !settings.ownAllExistingPoolEgo;
  const egoHalf = targets.E.pickup > 0 && settings.ownAllExistingPoolEgo ? 1 : 0.5;
  const { pA, pE, pT } = wantProbPerCategory(hasAnnouncer, egoAvailable, targets, { egoHalf });

  // Greedy: at each pity boundary, assign to the category with largest marginal gain
  for (let r = 1; r <= R; r++) {
    const n = r * PITY_STEP - 1;
    const opts: { cat: "A" | "E" | "T"; gain: number }[] = [];

    if (remaining.A > 0) opts.push({ cat: "A", gain: binomPMF(remaining.A - 1, n, pA) });
    if (remaining.E > 0) opts.push({ cat: "E", gain: binomPMF(remaining.E - 1, n, pE) });
    if (remaining.T > 0) opts.push({ cat: "T", gain: binomPMF(remaining.T - 1, n, pT) });

    if (!opts.length) {
      alloc.push("E");
      continue;
    }

    opts.sort((a, b) => b.gain - a.gain);
    const c = opts[0].cat;
    alloc.push(c);
    remaining[c] = Math.max(0, remaining[c] - 1);
  }

  return alloc;
}

export function findNforQuantile(
  q: number,
  settings: GlobalSettings,
  targets: Targets,
  pityAlloc: PityAlloc,
  nMax: number,
) {
  let lo = 0,
    hi = nMax;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const F = cumulativeSuccess(mid, settings, targets, pityAlloc);
    if (F >= q) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function beforeAfterTable(
  settings: GlobalSettings,
  targets: Targets,
  pityAlloc: PityAlloc,
  Nmax: number,
) {
  const rows: { pity: number; before: number; after: number }[] = [];
  const R = Math.floor(Nmax / PITY_STEP);

  for (let r = 1; r <= R; r++) {
    const nBefore = r * PITY_STEP - 1,
      nAfter = r * PITY_STEP;
    rows.push({
      pity: r,
      before: cumulativeSuccess(nBefore, settings, targets, pityAlloc),
      after: cumulativeSuccess(nAfter, settings, targets, pityAlloc),
    });
  }

  return rows;
}

export function estimatePityNeeded(
  settings: GlobalSettings,
  targets: Targets,
  pityAlloc: PityAlloc,
  nMax: number,
) {
  const n90 = findNforQuantile(0.9, settings, targets, pityAlloc, nMax);
  return Math.ceil(n90 / PITY_STEP);
}
