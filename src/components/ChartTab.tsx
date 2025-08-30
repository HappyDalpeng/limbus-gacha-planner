import { useEffect, useMemo, useRef, useState } from "react";
import NumberField from "./NumberField";
import { useTranslation } from "react-i18next";
import {
  Targets,
  GlobalSettings,
  PityAlloc,
  cumulativeSuccess,
  resourcesToDraws,
  findNforQuantile,
  beforeAfterTable,
  autoMaxDraws,
  PITY_STEP,
  Resources,
  monteCarloSuccess,
  baseCategoryProbs,
} from "@/lib/prob";
import { useElementWidth } from "@/lib/hooks";
import { computeXTicks } from "@/lib/chart";
import { formatPercentValue } from "@/lib/format";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Area,
  Bar,
  Customized,
} from "recharts";

// Centralize colors/styles for clarity
const COLOR = {
  resources: "#ef4444", // red-500
  quantile: "#10b981", // emerald-500
  pity: "#a1a1aa", // zinc-400
  grid: "#e5e7eb", // zinc-200
  curve: "#2563eb", // blue-600 (analytic curve)
  sim: "#f59e0b", // amber-500 (single-run)
  mc: "#7c3aed", // violet-600 (MC estimate)
  A: "#ef4444", // red-500 for Announcer
  E: "#10b981", // emerald-500 for EGO
  T: "#f59e0b", // amber-500 for 3*
  rise: "#ef4444", // red-500 (up)
  fall: "#3b82f6", // blue-500 (down)
} as const;

type Datum = { n: number; F: number };

export default function ChartTab({
  targets,
  settings,
  resources,
  pityAlloc,
}: {
  targets: Targets;
  settings: GlobalSettings;
  resources: Resources;
  pityAlloc: PityAlloc;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState(0.9);

  const { total } = useMemo(() => resourcesToDraws(resources), [resources]);
  const maxN = useMemo(() => autoMaxDraws(targets), [targets]);
  const clampedTotal = Math.min(total, maxN);

  // Measure chart width to pick readable tick spacing
  const [containerRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const [showMC, setShowMC] = useState(false);
  const [mcData, setMcData] = useState<{ n: number; MC: number }[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const [simData, setSimData] = useState<{ n: number; R: number }[]>([]);
  const [eventData, setEventData] = useState<
    { n: number; yP: number; kind: "A" | "E" | "T"; source: "draw" | "pity" }[]
  >([]);
  const [devData, setDevData] = useState<{ n: number; pos: number; neg: number }[]>([]);
  // Sticky expanding domain for deviation overlay (won't shrink), like stock charts breakout
  const [devDomainAbs, setDevDomainAbs] = useState<number>(0.1); // start narrow (±10%)

  // Build stock-like colored segments from simData
  const coloredSim = useMemo(() => {
    const pts = [...simData].sort((a, b) => a.n - b.n);
    const up: Array<{ n: number; y: number | null }> = [];
    const down: Array<{ n: number; y: number | null }> = [];
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      if (cur.R > prev.R) {
        up.push({ n: prev.n, y: prev.R });
        up.push({ n: cur.n, y: cur.R });
        up.push({ n: cur.n, y: null }); // break segment
      } else if (cur.R < prev.R) {
        down.push({ n: prev.n, y: prev.R });
        down.push({ n: cur.n, y: cur.R });
        down.push({ n: cur.n, y: null });
      } else {
        // flat segment: ignore for color overlay
      }
    }
    return { up, down };
  }, [simData]);
  const simTimerRef = useRef<number | null>(null);

  // Ensure RAF loop is cancelled on unmount to avoid ghost updates / flicker
  useEffect(() => {
    return () => {
      if (simTimerRef.current != null) {
        cancelAnimationFrame(simTimerRef.current as any);
        (simTimerRef as any).current = null;
      }
    };
  }, []);

  const data = useMemo(() => {
    const arr: Datum[] = [];
    for (let n = 0; n <= maxN; n += 5) {
      arr.push({ n, F: cumulativeSuccess(n, settings, targets, pityAlloc) });
    }
    for (let r = 1; r <= Math.floor(maxN / PITY_STEP); r++) {
      const a = r * PITY_STEP - 1,
        b = r * PITY_STEP;
      [a, b].forEach((n) => {
        if (!arr.find((d) => d.n === n))
          arr.push({
            n,
            F: cumulativeSuccess(n, settings, targets, pityAlloc),
          });
      });
    }
    arr.sort((a, b) => a.n - b.n);
    return arr;
  }, [maxN, targets, settings, pityAlloc]);

  // Monte Carlo auxiliary generation (run on demand)
  const runMonteCarlo = () => {
    const S = 200; // samples per point
    const indices = new Set<number>();
    indices.add(0);
    indices.add(maxN);
    computeXTicks(maxN, chartWidth).forEach((x) => {
      if (x >= 0 && x <= maxN) indices.add(x);
    });
    const R = Math.floor(maxN / PITY_STEP);
    for (let r = 1; r <= R; r++) {
      const before = r * PITY_STEP - 1;
      const after = r * PITY_STEP;
      if (before >= 0 && before <= maxN) indices.add(before);
      if (after >= 0 && after <= maxN) indices.add(after);
    }
    const pts = Array.from(indices).sort((a, b) => a - b);
    const arr = pts.map((n) => ({ n, MC: monteCarloSuccess(n, settings, targets, pityAlloc, S) }));
    for (let i = 1; i < arr.length; i++) if (arr[i].MC < arr[i - 1].MC) arr[i].MC = arr[i - 1].MC;
    setMcData(arr);
  };

  // First toggle ON → run once; OFF preserves last results
  useEffect(() => {
    if (showMC && mcData.length === 0) runMonteCarlo();
  }, [showMC]);

  const xTicks = useMemo(() => computeXTicks(maxN, chartWidth), [maxN, chartWidth]);

  const qN = useMemo(() => {
    return findNforQuantile(q, settings, targets, pityAlloc, maxN);
  }, [q, settings, targets, pityAlloc, maxN]);
  const probAtResources = useMemo(
    () => cumulativeSuccess(total, settings, targets, pityAlloc),
    [total, settings, targets, pityAlloc],
  );
  const rows = useMemo(() => {
    return beforeAfterTable(settings, targets, pityAlloc, maxN);
  }, [settings, targets, pityAlloc, maxN]);

  // Small helper to derive per-draw parameters consistently
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

  // Prevent reference labels from overlapping when very close
  const isRefLabelClose = useMemo(() => {
    if (!chartWidth) return false;
    const pxPerDraw = chartWidth / Math.max(1, maxN);
    const distPx = Math.abs(qN - clampedTotal) * pxPerDraw;
    return distPx < 28; // if closer than ~28px, treat as overlapping
  }, [qN, clampedTotal, chartWidth, maxN]);

  const pityBoundaries = useMemo(
    () => Array.from({ length: Math.floor(maxN / PITY_STEP) }, (_, i) => (i + 1) * PITY_STEP),
    [maxN],
  );

  function TooltipContent({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: any[];
    label?: any;
  }) {
    if (!active || !payload || !payload.length) return null;
    const toNum = (x: any) => (typeof x === "number" ? x : Number(x));
    const nVal = toNum(label);
    const itemF = payload.find((p) => p && (p.dataKey === "F" || p.name === "F"));
    const Fv = typeof itemF?.value === "number" ? itemF.value : undefined;
    const itemMC = payload.find((p) => p && (p.dataKey === "MC" || p.name === "MC"));
    let MCv: number | undefined = undefined;
    if (showMC) {
      if (typeof itemMC?.value === "number") MCv = itemMC.value as number;
      else if (mcData.length >= 2) {
        // linear interpolation between nearest MC samples
        let i = 0;
        while (i < mcData.length && mcData[i].n < nVal) i++;
        if (i === 0) MCv = mcData[0].MC;
        else if (i >= mcData.length) MCv = mcData[mcData.length - 1].MC;
        else {
          const a = mcData[i - 1];
          const b = mcData[i];
          const t = b.n === a.n ? 0 : (nVal - a.n) / (b.n - a.n);
          MCv = a.MC + (b.MC - a.MC) * t;
        }
      }
    }
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs">
        <div className="opacity-70 mb-1">
          {t("tooltip.pulls")}: <b>{label}</b>
        </div>
        {typeof Fv === "number" && (
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: "currentColor" }}
            />
            <span>{t("tooltip.success")}: </span>
            <b>{formatPercentValue(Fv, 2)}%</b>
          </div>
        )}
        {showMC && typeof MCv === "number" && (
          <div className="flex items-center gap-2 mt-1 opacity-90">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "#7c3aed" }} />
            <span>{t("tooltip.simulation")}: </span>
            <b>{formatPercentValue(MCv, 2)}%</b>
          </div>
        )}
      </div>
    );
  }

  // Merge baseline curve data with deviation columns so Bar series can read from the main dataset
  const chartRows = useMemo(() => {
    if (devData.length === 0) return data as any[];
    const devMap = new Map(devData.map((d) => [d.n, d] as const));
    return (data as any[]).map((r) => {
      const dv = devMap.get(r.n);
      return { ...r, pos: dv?.pos ?? 0, neg: dv?.neg ?? 0 };
    });
  }, [data, devData]);

  // Build stacked-bar friendly rows for true candlestick bodies
  const candleRows = useMemo(() => [], []);

  // Custom renderer for event dots and inline popup for the latest event
  function EventDot(props: any) {
    const { cx, cy, payload, index } = props;
    const kind: "A" | "E" | "T" | undefined = payload?.kind;
    const source: "draw" | "pity" | undefined = payload?.source;
    if (typeof cx !== "number" || typeof cy !== "number" || !kind) return null;
    const color = COLOR[kind];
    const isLatest = index === eventData.length - 1;
    const name = kind === "A" ? t("announcer") : kind === "E" ? t("ego") : t("threeStar");
    const label = source === "pity" ? `${name} · ${t("pity")}` : name;
    const w = 16 + String(label).length * 6; // naive width estimate
    const h = 16;
    const tx = 8; // padding
    const ty = 12;
    return (
      <g pointerEvents="none">
        <circle cx={cx} cy={cy} r={5} fill={color} stroke="#111827" strokeWidth={1.5} />
        {isLatest && (
          <g transform={`translate(${cx + 8}, ${cy - h - 4})`}>
            <rect width={w} height={h} rx={4} ry={4} fill="rgba(17,24,39,0.85)" />
            <text x={tx} y={ty} fontSize={10} fill="#fff">
              {label}
            </text>
          </g>
        )}
      </g>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
          <div>
            {t("probAtResources", { n: total })}: <b>{formatPercentValue(probAtResources, 2)}%</b>
          </div>
          <div>· {t("n90Line", { q: Math.round(q * 100), n: qN })}</div>
          <label className="ml-auto flex items-center gap-2">
            <span>%</span>
            <NumberField
              className="w-16 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1"
              value={Math.round(q * 100)}
              onChange={(num) => setQ(Math.min(0.99, Math.max(0.01, (num || 0) / 100)))}
              min={1}
              max={99}
            />
          </label>
        </div>

        <LegendInline
          resourcesLabel={t("legend.resources")}
          quantileLabel={t("legend.quantile", { q: Math.round(q * 100) })}
        />

        <div className="flex items-center justify-end mb-2 gap-2 text-xs">
          <div className="flex items-center gap-1 opacity-80">
            {t("sim.forward", "남은 성공확률")}
          </div>
          <label className="flex items-center gap-1 opacity-80">
            <input type="checkbox" checked={showMC} onChange={(e) => setShowMC(e.target.checked)} />
            <span>{t("showMC")}</span>
          </label>
          <button
            className={
              "px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 transition-opacity " +
              (showMC ? "opacity-100" : "opacity-0 pointer-events-none")
            }
            onClick={runMonteCarlo}
            title={t("rerunMC")}
            aria-hidden={!showMC}
          >
            ↻
          </button>
          <button
            className={
              "px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 " +
              (simRunning ? "opacity-60 cursor-not-allowed" : "")
            }
            onClick={() => {
              if (simRunning) return;
              const N = Math.min(total, maxN);
              const emitStep = Math.max(1, Math.floor(N / 400));
              setSimData([]);
              setEventData([]);
              setDevData([]);
              setSimRunning(true);
              const { pA_pick, pE_pick, pT_pick, ratioA, ratioT } = computeDrawParams();
              let mA = Math.max(0, targets.A.desired);
              let mE = Math.max(0, targets.E.desired);
              let mT = Math.max(0, targets.T.desired);
              let remPickupE = Math.max(0, targets.E.pickup);
              let remDesiredE = Math.max(0, targets.E.desired);
              let achieved = mA === 0 && mE === 0 && mT === 0;
              let nNow = 0;
              // Track pity uses so far per category (used only for event labeling)
              let pityUsed = { A: 0, E: 0, T: 0 } as Record<"A" | "E" | "T", number>;
              // Helper for Luck calculation
              const calcLuck = () => {
                const drawsLeft = N - nNow;
                if (achieved) return 1;
                if (drawsLeft <= 0) return 0;
                const remTargetsLuck = {
                  A: { pickup: targets.A.pickup, desired: Math.max(0, mA) },
                  E: { pickup: targets.E.pickup, desired: Math.max(0, mE) },
                  T: { pickup: targets.T.pickup, desired: Math.max(0, mT) },
                } as const;
                return cumulativeSuccess(drawsLeft, settings, remTargetsLuck as any, []);
              };
              // Normalized cumulative probability progress: F(n)/F(N) ∈ [0,1], monotone ↑
              // Progress line: monotone CDF from 0→1 with pity jumps; only snap to 1 on actual success
              const tick = () => {
                if (nNow >= N) {
                  setSimRunning(false);
                  if (simTimerRef.current) cancelAnimationFrame(simTimerRef.current as any);
                  (simTimerRef as any).current = null;
                  return;
                }
                const willBe = nNow + 1;
                // Track what got picked in this step
                let pickedThisStep: { kind: "A" | "E" | "T"; source: "draw" | "pity" }[] = [];
                if (!achieved) {
                  const u = Math.random();
                  if (u < pA_pick) {
                    if (mA > 0 && Math.random() < ratioA) {
                      mA--;
                      pickedThisStep.push({ kind: "A", source: "draw" });
                    }
                  } else if (u < pA_pick + pE_pick) {
                    if (remPickupE > 0) {
                      const pWantE = remPickupE > 0 ? remDesiredE / remPickupE : 0;
                      if (mE > 0 && Math.random() < pWantE) {
                        mE--;
                        pickedThisStep.push({ kind: "E", source: "draw" });
                        if (remDesiredE > 0) remDesiredE--;
                      }
                      if (remPickupE > 0) remPickupE--;
                    }
                  } else if (u < pA_pick + pE_pick + pT_pick) {
                    if (mT > 0 && Math.random() < ratioT) {
                      mT--;
                      pickedThisStep.push({ kind: "T", source: "draw" });
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
                      pityUsed.A++;
                      pickedThisStep.push({ kind: "A", source: "pity" });
                      return true;
                    } else if (cat === "E" && mE > 0) {
                      mE--;
                      pityUsed.E++;
                      pickedThisStep.push({ kind: "E", source: "pity" });
                      if (remDesiredE > 0) remDesiredE--;
                      return true;
                    } else if (cat === "T" && mT > 0) {
                      mT--;
                      pityUsed.T++;
                      pickedThisStep.push({ kind: "T", source: "pity" });
                      return true;
                    }
                    return false;
                  };
                  // Use planned category if still needed; otherwise fallback to first needed by priority
                  if (!tryApply(planned)) {
                    for (const c2 of prio) {
                      if (tryApply(c2)) break;
                    }
                  }
                }
                achieved = mA === 0 && mE === 0 && mT === 0;
                nNow = willBe;
                // Luck line (stock-like): current forward success probability WITHOUT anticipating future pity
                let pLuck = calcLuck();
                if (!achieved) pLuck = Math.min(pLuck, 0.999); // snap to 100 only on actual success

                // Deviation vs baseline CDF at the same n: Luck (forward) minus F_base
                const F_base = cumulativeSuccess(nNow, settings, targets, pityAlloc);
                const delta = pLuck - F_base;

                // Record all pick events immediately so no event is skipped between emissions
                if (pickedThisStep.length > 0) {
                  const nForEvent = nNow; // x at this step
                  setEventData((prev) => [
                    ...prev,
                    ...pickedThisStep.map((e) => ({
                      n: nForEvent,
                      yP: pLuck,
                      kind: e.kind,
                      source: e.source,
                    })),
                  ]);
                }

                const shouldEmit = nNow % emitStep === 0 || willBe % PITY_STEP === 0 || nNow === N;
                if (shouldEmit) {
                  setSimData((prev) => [...prev, { n: nNow, R: pLuck }]);
                  setDevData((prev) => [
                    ...prev,
                    { n: nNow, pos: delta > 0 ? delta : 0, neg: delta < 0 ? delta : 0 },
                  ]);
                  // Expand deviation domain only upward; never shrink
                  const absd = Math.abs(delta);
                  if (absd > devDomainAbs * 0.98) {
                    const pad = absd * 1.15 + 0.01; // pad a bit beyond
                    const candidates = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
                    let chosen = devDomainAbs;
                    for (const c of candidates) {
                      if (pad <= c && c > chosen) {
                        chosen = c;
                        break;
                      }
                    }
                    if (chosen < pad) chosen = 0.5;
                    if (chosen > devDomainAbs) setDevDomainAbs(chosen);
                  }
                }
                // Stop immediately when completed
                if (achieved) {
                  // Ensure final point is emitted
                  if (!shouldEmit) {
                    setSimData((prev) => [...prev, { n: nNow, R: pLuck }]);
                    setDevData((prev) => [
                      ...prev,
                      { n: nNow, pos: delta > 0 ? delta : 0, neg: delta < 0 ? delta : 0 },
                    ]);
                  }
                  setSimRunning(false);
                  if (simTimerRef.current) cancelAnimationFrame(simTimerRef.current as any);
                  (simTimerRef as any).current = null;
                  return;
                }
                (simTimerRef as any).current = window.requestAnimationFrame(tick);
              };
              (simTimerRef as any).current = window.requestAnimationFrame(tick);
            }}
            disabled={simRunning}
          >
            {t("runSingleSim")}
          </button>
        </div>

        <div className="h-80" ref={containerRef}>
          <ResponsiveContainer debounce={100}>
            <ComposedChart data={chartRows as any} margin={{ right: 24, bottom: 12, top: 24 }}>
              <CartesianGrid stroke={COLOR.grid} strokeDasharray="2 2" />
              <XAxis
                dataKey="n"
                type="number"
                domain={[0, maxN]}
                ticks={xTicks}
                interval={0}
                tickLine={false}
                tickMargin={8}
                allowDecimals={false}
              />
              <YAxis
                tickFormatter={(v) => (v * 100).toFixed(0) + "%"}
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
              />
              {/* Secondary hidden Y axis for deviation overlay */}
              {devData.length > 0 && (
                <YAxis yAxisId="dev" hide domain={[-devDomainAbs, devDomainAbs]} />
              )}
              <Tooltip content={<TooltipContent />} />
              <Line
                type="monotone"
                dataKey="F"
                dot={false}
                strokeWidth={2}
                stroke={COLOR.curve}
                isAnimationActive={false}
                connectNulls
              />
              {showMC && mcData.length > 0 && (
                <Line
                  type="monotone"
                  data={mcData as any}
                  dataKey="MC"
                  name="MC"
                  stroke={COLOR.mc}
                  strokeDasharray="4 2"
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {simData.length > 0 && (
                <Line
                  type="stepAfter"
                  data={simData as any}
                  dataKey="R"
                  name="Progress"
                  stroke={COLOR.sim}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {eventData.length > 0 && (
                <Line
                  type="linear"
                  data={eventData as any}
                  dataKey="yP"
                  name="Event"
                  stroke="none"
                  dot={<EventDot />}
                  isAnimationActive={false}
                />
              )}
              {/* Reference lines */}
              <ReferenceLine
                key={`res-${clampedTotal}`}
                x={clampedTotal}
                stroke={COLOR.resources}
                strokeDasharray="6 4"
                label={
                  isRefLabelClose
                    ? { value: `${total}`, position: "insideTop", fill: COLOR.resources, dy: 6 }
                    : { value: `${total}`, position: "top", fill: COLOR.resources, dy: 0 }
                }
              />
              <ReferenceLine
                key={`qn-${qN}`}
                x={qN}
                stroke={COLOR.quantile}
                strokeDasharray="6 4"
                label={{
                  value: `${Math.round(q * 100)}%`,
                  position: "top",
                  fill: COLOR.quantile,
                  dy: 0,
                }}
              />
              {pityBoundaries.map((n) => (
                <ReferenceLine
                  key={n}
                  x={n}
                  stroke={COLOR.pity}
                  strokeWidth={1}
                  strokeOpacity={0.75}
                  strokeDasharray="2 4"
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* Deviation overlay is now merged into the main chart above */}
        <div
          className={
            "text-right text-xs mt-1 transition-opacity " +
            (showMC && mcData.length > 0
              ? "opacity-70"
              : "opacity-0 pointer-events-none select-none")
          }
          aria-hidden={!(showMC && mcData.length > 0)}
        >
          {t("mcMeta", { s: 200, k: mcData.length })}
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 mt-3 pt-3">
          <details>
            <summary className="cursor-pointer text-sm">{t("beforeAfter")}</summary>
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-2 py-1">{t("pity")}</th>
                    <th className="px-2 py-1">{t("before")}</th>
                    <th className="px-2 py-1">{t("after")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pity} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-2 py-1">{r.pity}</td>
                      <td className="px-2 py-1">{`${formatPercentValue(r.before, 2)}%`}</td>
                      <td className="px-2 py-1">{`${formatPercentValue(r.after, 2)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function LegendInline({
  resourcesLabel,
  quantileLabel,
}: {
  resourcesLabel: string;
  quantileLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs opacity-80 mb-2">
      <span className="flex items-center gap-2">
        <span
          className="inline-block w-4 border-t-2 border-dashed"
          style={{ borderColor: COLOR.resources }}
        />
        {resourcesLabel}
      </span>
      <span className="flex items-center gap-2">
        <span
          className="inline-block w-4 border-t-2 border-dashed"
          style={{ borderColor: COLOR.quantile }}
        />
        {quantileLabel}
      </span>
    </div>
  );
}
