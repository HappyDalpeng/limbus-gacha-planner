import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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
} from "@/lib/prob";
import { useElementWidth } from "@/lib/hooks";
import { computeXTicks } from "@/lib/chart";
import { formatPercentValue } from "@/lib/format";
import { useThemeColors } from "@/lib/colors";
import ProbabilityChart from "./ProbabilityChart";
import NumberField from "./NumberField";
import LegendInline from "./LegendInline";
import { useSingleRunSim } from "@/hooks/useSingleRunSim";

// Centralize colors/styles for clarity
const COLOR_FALLBACK = {
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
  const themeColors = useThemeColors(COLOR_FALLBACK as any);
  const chartColors = useMemo(() => ({ ...COLOR_FALLBACK, ...themeColors }) as any, [themeColors]);

  const { total } = useMemo(() => resourcesToDraws(resources), [resources]);
  const maxN = useMemo(() => autoMaxDraws(targets), [targets]);
  const clampedTotal = Math.min(total, maxN);

  // Measure chart width to pick readable tick spacing
  const [containerRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const [showMC, setShowMC] = useState(false);
  const [mcData, setMcData] = useState<{ n: number; MC: number }[]>([]);
  const {
    running: simRunning,
    simData,
    events: eventData,
    start: startSim,
    stop: stopSim,
    clear: clearSim,
  } = useSingleRunSim({
    total,
    maxN,
    targets,
    settings,
    pityAlloc,
  });

  const data = useMemo(() => {
    const arr: Datum[] = [];
    // Use step=1 for smoother tooltip/cursor tracking along the curve
    for (let n = 0; n <= maxN; n += 1) {
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

  // When core inputs change, clear any existing single-run simulation (Luck Line)
  useEffect(() => {
    if (simData.length > 0 || eventData.length > 0) clearSim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, settings, pityAlloc, total, maxN]);

  // When core inputs change, recompute MC if visible; otherwise clear stale MC data
  useEffect(() => {
    if (showMC) runMonteCarlo();
    else if (mcData.length) setMcData([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMC, targets, settings, pityAlloc, maxN]);

  const xTicks = useMemo(() => computeXTicks(maxN, chartWidth), [maxN, chartWidth]);

  const qN = useMemo(() => {
    return findNforQuantile(q, settings, targets, pityAlloc, maxN);
  }, [q, settings, targets, pityAlloc, maxN]);
  const probAtResources = useMemo(
    () => cumulativeSuccess(total, settings, targets, pityAlloc),
    [total, settings, targets, pityAlloc],
  );
  const probAtClampedTotal = useMemo(
    () => cumulativeSuccess(clampedTotal, settings, targets, pityAlloc),
    [clampedTotal, settings, targets, pityAlloc],
  );
  const rows = useMemo(() => {
    return beforeAfterTable(settings, targets, pityAlloc, maxN);
  }, [settings, targets, pityAlloc, maxN]);

  // Simulation parameters moved to hook

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

  // Tooltip moved to dedicated component

  // Merge baseline curve data with deviation columns so Bar series can read from the main dataset
  const chartRows = useMemo(() => data as any[], [data]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
          <div>
            {t("probAtResources", { n: total })}: <b>{formatPercentValue(probAtResources, 2)}%</b>
          </div>
          <div className="flex items-center">
            <span className="mr-2" aria-hidden>
              ·
            </span>
            <Trans i18nKey="nQLineWithInput" values={{ n: qN }}>
              <NumberField
                min={1}
                max={99}
                className="mx-1 w-16 bg-transparent text-center border-0 border-b-2 border-zinc-300 dark:border-zinc-600 py-0.5 leading-none focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                value={Math.round(q * 100)}
                onChange={(v) => {
                  const pct = Math.max(1, Math.min(99, Math.round(v)));
                  setQ(pct / 100);
                }}
                inputMode="numeric"
              />
            </Trans>
          </div>
        </div>

        <LegendInline
          resourcesLabel={t("legend.resources")}
          quantileLabel={t("legend.quantile", { q: Math.round(q * 100) })}
          resourceColor={(themeColors as any).resources || COLOR_FALLBACK.resources}
          quantileColor={(themeColors as any).quantile || COLOR_FALLBACK.quantile}
        />

        <div className="flex items-center justify-end mb-2 gap-2 text-xs">
          {/* 1회 시뮬레이션: 라벨 + 플레이 아이콘 버튼 */}
          <div className="flex items-center gap-2">
            <span>{t("runWithCurrentResources")}</span>
            {!simRunning && (simData.length > 0 || eventData.length > 0) ? (
              <button
                className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800"
                onClick={() => clearSim()}
                title={t("clearSingleSim")}
                aria-label={t("clearSingleSim")}
              >
                🗑
              </button>
            ) : (
              <button
                className={
                  "px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 " +
                  (simRunning ? "opacity-60 cursor-not-allowed" : "")
                }
                onClick={() => {
                  if (simRunning) return;
                  startSim();
                }}
                disabled={simRunning}
                title={t("runSingleSim")}
                aria-label={t("runSingleSim")}
              >
                ▶
              </button>
            )}
          </div>

          {/* Divider */}
          <span className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" aria-hidden />

          {/* 시뮬레이션 보조선 토글 + 재실행 */}
          <label className="flex items-center gap-1 opacity-80">
            <input type="checkbox" checked={showMC} onChange={(e) => setShowMC(e.target.checked)} />
            <span>{t("showMCAlt")}</span>
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
        </div>

        <div className="h-80" ref={containerRef}>
          <ProbabilityChart
            data={chartRows as any}
            mcData={mcData}
            simData={simData}
            eventData={eventData}
            xTicks={xTicks}
            maxN={maxN}
            clampedTotal={clampedTotal}
            total={total}
            qN={qN}
            q={q}
            pityBoundaries={pityBoundaries}
            isRefLabelClose={isRefLabelClose}
            colors={chartColors as any}
            showMC={showMC}
            resLabel={`${formatPercentValue(probAtClampedTotal, 2)}%`}
            resY={probAtClampedTotal}
            qLabel={`${formatPercentValue(q, 2)}%`}
            qY={q}
            freezeXAxis={simRunning}
          />
        </div>
        {/* MC meta */}
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
