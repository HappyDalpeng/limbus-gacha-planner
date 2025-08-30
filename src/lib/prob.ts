export type Targets = {
  A: { pickup: number; desired: number };
  E: { pickup: number; desired: number };
  T: { pickup: number; desired: number };
};

export type GlobalSettings = {
  autoRecommend: boolean;
  ownAllExistingPoolEgo: boolean; // whether user owns all existing-pool (non-pickup) E.G.O
  exchangePriority?: ("A" | "E" | "T")[]; // manual exchange priority when autoRecommend is off
  exchangePlan?: ("A" | "E" | "T")[]; // user-edited pity allocation (drag-and-drop)
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

  // Base per-draw probabilities for categories
  const base = baseCategoryProbs(hasAnnouncer, egoAvailable);
  const half = 0.5;
  const pA = base.pA * half * ratio(targets.A.desired, targets.A.pickup);
  const pT = base.p3 * half * ratio(targets.T.desired, targets.T.pickup);

  // Binomial tails for A and T remain as before
  const tailA = 1 - binomCDF(mA - 1, n, pA);
  const tailT = 1 - binomCDF(mT - 1, n, pT);

  // E.G.O: without-replacement style approximation via 2D DP over (desired obtained, total pickup obtained)
  const tailE = (() => {
    if (mE <= 0) return 1; // nothing needed
    const pickupTotal = Math.max(0, targets.E.pickup);
    if (pickupTotal <= 0) return 0; // impossible
    const pEbase = base.pE * egoHalf; // mass going to E.G.O per draw
    if (pEbase <= 0) return 0;

    const desiredTotal = Math.max(0, targets.E.desired);
    // Fallback to binomial approx for unusually large pickup counts to keep UI responsive
    const DP_PICKUP_LIMIT = 12;
    if (pickupTotal > DP_PICKUP_LIMIT) {
      const pApprox = pEbase * ratio(desiredTotal, pickupTotal);
      return 1 - binomCDF(mE - 1, n, pApprox);
    }
    // dp[s][t] = Pr[have s desired and t total pickup] after current draw step
    const dp: number[][] = Array.from({ length: mE + 1 }, () =>
      new Array<number>(pickupTotal + 1).fill(0),
    );
    dp[0][0] = 1;

    for (let draw = 0; draw < n; draw++) {
      const next: number[][] = Array.from({ length: mE + 1 }, () =>
        new Array<number>(pickupTotal + 1).fill(0),
      );
      const tMaxPrev = Math.min(pickupTotal, draw);
      const tMaxNext = Math.min(pickupTotal, draw + 1);
      for (let tGot = 0; tGot <= tMaxPrev; tGot++) {
        const sMax = Math.min(mE, tGot);
        for (let s = 0; s <= sMax; s++) {
          const prob = dp[s][tGot];
          if (prob <= 0) continue;
          if (s >= mE) {
            next[mE][tGot] += prob; // absorb
            continue;
          }
          const pickupRem = pickupTotal - tGot;
          if (pickupRem <= 0) {
            next[s][tGot] += prob; // no pickup left; only other categories
            continue;
          }
          const desiredRem = Math.max(0, desiredTotal - s);
          const pDesired = desiredRem > 0 ? pEbase * (desiredRem / pickupRem) : 0;
          const pUndesired = pEbase * Math.max(0, (pickupRem - desiredRem) / pickupRem);
          const pOther = 1 - pEbase;

          const sNext = Math.min(mE, s + 1);
          const tNext = Math.min(pickupTotal, tGot + 1);
          next[sNext][tNext] += prob * pDesired;
          next[s][tNext] += prob * pUndesired;
          next[s][tGot] += prob * pOther;
        }
      }
      // swap (only within reachable bounds)
      for (let tGot = 0; tGot <= tMaxNext; tGot++) {
        const sMax = Math.min(mE, tGot);
        for (let s = 0; s <= sMax; s++) dp[s][tGot] = next[s][tGot];
      }
      // Early exit if mass mostly absorbed
      const succ = dp[mE].reduce((a, b) => a + b, 0);
      if (succ >= 1 - 1e-12) break;
    }
    return dp[mE].reduce((a, b) => a + b, 0);
  })();

  return tailA * tailE * tailT;
}

// Monte Carlo estimate of F(n) without changing the analytic model.
export function monteCarloSuccess(
  n: number,
  settings: GlobalSettings,
  targets: Targets,
  pityAlloc: PityAlloc,
  samples = 200,
  seed = 0,
) {
  if (n <= 0)
    return targets.A.desired <= 0 && targets.E.desired <= 0 && targets.T.desired <= 0 ? 1 : 0;

  const r = Math.floor(n / PITY_STEP);
  const pityCounts = { A: 0, E: 0, T: 0 } as Record<"A" | "E" | "T", number>;
  for (let i = 0; i < r && i < pityAlloc.length; i++) pityCounts[pityAlloc[i]]++;

  const hasAnnouncer = targets.A.pickup > 0;
  const egoAvailable = targets.E.pickup > 0 || !settings.ownAllExistingPoolEgo;
  const egoHalf = targets.E.pickup > 0 && settings.ownAllExistingPoolEgo ? 1 : 0.5;
  const base = baseCategoryProbs(hasAnnouncer, egoAvailable);

  const pA_pick = base.pA * 0.5;
  const pE_pick = base.pE * egoHalf;
  const pT_pick = base.p3 * 0.5;

  const ratioA = ratio(targets.A.desired, targets.A.pickup);
  const ratioT = ratio(targets.T.desired, targets.T.pickup);

  // simple LCG for deterministic PRNG
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };

  let successCount = 0;
  for (let s = 0; s < samples; s++) {
    let mA = Math.max(0, targets.A.desired - pityCounts.A);
    let mE = Math.max(0, targets.E.desired - pityCounts.E);
    let mT = Math.max(0, targets.T.desired - pityCounts.T);

    // E.G.O remaining unique counts for DP-like behavior
    let remPickupE = Math.max(0, targets.E.pickup);
    let remDesiredE = Math.max(0, targets.E.desired);

    if (mA === 0 && mE === 0 && mT === 0) {
      successCount++;
      continue;
    }

    for (let draw = 0; draw < n; draw++) {
      const u = rnd();
      if (u < pA_pick) {
        if (mA > 0 && rnd() < ratioA) mA--;
      } else if (u < pA_pick + pE_pick) {
        if (remPickupE > 0) {
          const pWantE = remPickupE > 0 ? remDesiredE / remPickupE : 0;
          if (mE > 0 && rnd() < pWantE) {
            mE--;
            if (remDesiredE > 0) remDesiredE--;
          }
          if (remPickupE > 0) remPickupE--;
        }
      } else if (u < pA_pick + pE_pick + pT_pick) {
        if (mT > 0 && rnd() < ratioT) mT--;
      } else {
        // other outcome (non-target categories)
      }

      if (mA === 0 && mE === 0 && mT === 0) {
        successCount++;
        break;
      }
    }
  }
  return successCount / Math.max(1, samples);
}

export function computeGreedyPityAlloc(
  Nmax: number,
  settings: GlobalSettings,
  targets: Targets,
  initialAlloc: PityAlloc = [],
) {
  const R = Math.floor(Nmax / PITY_STEP);
  const alloc: PityAlloc = [...initialAlloc];

  const remaining: Record<"A" | "E" | "T", number> = {
    A: Math.max(0, targets.A.desired),
    E: Math.max(0, targets.E.desired),
    T: Math.max(0, targets.T.desired),
  };

  // Apply initial allocation to remaining counts
  for (let i = 0; i < initialAlloc.length; i++) {
    const c = initialAlloc[i];
    remaining[c] = Math.max(0, remaining[c] - 1);
  }

  for (let r = alloc.length + 1; r <= R; r++) {
    const nBefore = r * PITY_STEP - 1;
    const nAfter = r * PITY_STEP;

    // Baseline before placing this pity
    const Fbefore = cumulativeSuccess(nBefore, settings, targets, alloc);

    const candidates: ("A" | "E" | "T")[] = (["A", "E", "T"] as const).filter(
      (c): c is "A" | "E" | "T" => remaining[c] > 0,
    );
    if (!candidates.length) {
      alloc.push("E");
      continue;
    }

    let best: { cat: "A" | "E" | "T"; gain: number } | null = null;
    for (const c of candidates) {
      const trial = alloc.concat(c);
      const Fafter = cumulativeSuccess(nAfter, settings, targets, trial);
      const gain = Fafter - Fbefore;
      if (!best || gain > best.gain) best = { cat: c, gain };
    }

    const chosen = (best ? best.cat : candidates[0]) as "A" | "E" | "T";
    alloc.push(chosen);
    remaining[chosen] = Math.max(0, remaining[chosen] - 1);
  }

  return alloc;
}

// Deterministic pity allocation by fixed priority order.
// At each pity boundary, pick the first category in `priority` that still needs items.
// If none need items, default to "E" to match previous fallback.
export function computePriorityPityAlloc(
  Nmax: number,
  targets: Targets,
  priority: ("A" | "E" | "T")[],
) {
  const R = Math.floor(Nmax / PITY_STEP),
    alloc: PityAlloc = [];

  const remaining = {
    A: targets.A.desired,
    E: targets.E.desired,
    T: targets.T.desired,
  } as Record<"A" | "E" | "T", number>;

  const prio =
    priority && priority.length === 3 ? priority : (["E", "T", "A"] as ("A" | "E" | "T")[]);

  for (let r = 1; r <= R; r++) {
    const c = prio.find((k) => remaining[k] > 0) as "A" | "E" | "T" | undefined;
    if (c) {
      alloc.push(c);
      remaining[c] = Math.max(0, remaining[c] - 1);
    } else {
      alloc.push("E");
    }
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
