import { useRef, useState } from "react";
import {
  PITY_STEP,
  baseCategoryProbs,
  GlobalSettings,
  PityAlloc,
  Targets,
  cumulativeSuccess,
} from "@/lib/prob";

export type SimPoint = { n: number; R: number };
export type SimEvent = { n: number; y: number; kind: "A" | "E" | "T"; source: "draw" | "pity" };

export function useSingleRunSim({
  total,
  maxN,
  targets,
  settings,
  pityAlloc,
}: {
  total: number;
  maxN: number;
  targets: Targets;
  settings: GlobalSettings;
  pityAlloc: PityAlloc;
}) {
  const [running, setRunning] = useState(false);
  const [simData, setSimData] = useState<SimPoint[]>([]);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const rafRef = useRef<number | null>(null);

  function computeDrawParams() {
    const hasAnnouncer = targets.A.pickup > 0;
    const egoAvailable = targets.E.pickup > 0 || !settings.ownAllExistingPoolEgo;
    const egoHalf = targets.E.pickup > 0 && settings.ownAllExistingPoolEgo ? 1 : 0.5;
    const base = baseCategoryProbs(hasAnnouncer, egoAvailable);
    const pA_pick = base.pA * 0.5;
    const pE_pick = base.pE * egoHalf;
    const pT_pick = base.p3 * 0.5;
    const ratioA =
      targets.A.pickup > 0 ? Math.min(1, Math.max(0, targets.A.desired / targets.A.pickup)) : 0;
    const ratioT =
      targets.T.pickup > 0 ? Math.min(1, Math.max(0, targets.T.desired / targets.T.pickup)) : 0;
    return { pA_pick, pE_pick, pT_pick, ratioA, ratioT };
  }

  // Deterministic forward chance (no future pity): analytic probability
  function calcLuck(nNow: number, mA: number, mE: number, mT: number) {
    const N = Math.min(total, maxN);
    const drawsLeft = N - nNow;
    if (drawsLeft <= 0) return 0;
    const remTargets = {
      A: { pickup: targets.A.pickup, desired: Math.max(0, mA) },
      E: { pickup: targets.E.pickup, desired: Math.max(0, mE) },
      T: { pickup: targets.T.pickup, desired: Math.max(0, mT) },
    } as const;
    return cumulativeSuccess(drawsLeft, settings, remTargets as any, []);
  }

  function start() {
    if (running) return;
    const N = Math.min(total, maxN);
    const emitStep = Math.max(1, Math.floor(N / 400));
    setSimData([]);
    setEvents([]);
    setRunning(true);
    const { pA_pick, pE_pick, pT_pick, ratioA, ratioT } = computeDrawParams();
    let mA = Math.max(0, targets.A.desired);
    let mE = Math.max(0, targets.E.desired);
    let mT = Math.max(0, targets.T.desired);
    let remPickupE = Math.max(0, targets.E.pickup);
    let remDesiredE = Math.max(0, targets.E.desired);
    let achieved = mA === 0 && mE === 0 && mT === 0;
    let nNow = 0;

    const tick = () => {
      if (nNow >= N) {
        setRunning(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        return;
      }
      const willBe = nNow + 1;
      const picks: SimEvent[] = [];
      if (!achieved) {
        const u = Math.random();
        if (u < pA_pick) {
          if (mA > 0 && Math.random() < ratioA) {
            mA--;
            picks.push({ n: willBe, y: 0, kind: "A", source: "draw" });
          }
        } else if (u < pA_pick + pE_pick) {
          if (remPickupE > 0) {
            const pWantE = remPickupE > 0 ? remDesiredE / remPickupE : 0;
            if (mE > 0 && Math.random() < pWantE) {
              mE--;
              picks.push({ n: willBe, y: 0, kind: "E", source: "draw" });
              if (remDesiredE > 0) remDesiredE--;
            }
            if (remPickupE > 0) remPickupE--;
          }
        } else if (u < pA_pick + pE_pick + pT_pick) {
          if (mT > 0 && Math.random() < ratioT) {
            mT--;
            picks.push({ n: willBe, y: 0, kind: "T", source: "draw" });
          }
        }
      }
      if (willBe % PITY_STEP === 0) {
        const idx = willBe / PITY_STEP - 1;
        const planned = pityAlloc[idx];
        const prio = (
          settings.exchangePriority && settings.exchangePriority.length === 3
            ? settings.exchangePriority
            : (["E", "T", "A"] as ("A" | "E" | "T")[])
        ) as ("A" | "E" | "T")[];
        const tryApply = (cat: "A" | "E" | "T") => {
          if (cat === "A" && mA > 0) {
            mA--;
            picks.push({ n: willBe, y: 0, kind: "A", source: "pity" });
            return true;
          } else if (cat === "E" && mE > 0) {
            mE--;
            picks.push({ n: willBe, y: 0, kind: "E", source: "pity" });
            if (remDesiredE > 0) remDesiredE--;
            return true;
          } else if (cat === "T" && mT > 0) {
            mT--;
            picks.push({ n: willBe, y: 0, kind: "T", source: "pity" });
            return true;
          }
          return false;
        };
        if (!tryApply(planned)) for (const c of prio) if (tryApply(c)) break;
      }
      achieved = mA === 0 && mE === 0 && mT === 0;
      nNow = willBe;
      let pLuck = achieved ? 1 : calcLuck(nNow, mA, mE, mT);
      if (!achieved) pLuck = Math.min(pLuck, 0.999);
      if (picks.length) setEvents((prev) => [...prev, ...picks.map((e) => ({ ...e, y: pLuck }))]);
      const shouldEmit = nNow % emitStep === 0 || willBe % PITY_STEP === 0 || nNow === N;
      if (shouldEmit) setSimData((prev) => [...prev, { n: nNow, R: pLuck }]);
      if (achieved) {
        if (!shouldEmit) setSimData((prev) => [...prev, { n: nNow, R: pLuck }]);
        setRunning(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stop() {
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function clear() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRunning(false);
    setSimData([]);
    setEvents([]);
  }

  return { running, simData, events, start, stop, clear } as const;
}
