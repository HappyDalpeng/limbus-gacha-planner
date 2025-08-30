import { useEffect, useMemo, useState } from "react";
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
} from "@/lib/prob";
import { useElementWidth } from "@/lib/hooks";
import { computeXTicks } from "@/lib/chart";
import { formatPercentValue } from "@/lib/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

// Centralize colors/styles for clarity
const COLOR = {
  resources: "#ef4444", // red-500
  quantile: "#10b981", // emerald-500
  pity: "#a1a1aa", // zinc-400
  grid: "#e5e7eb", // zinc-200
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
        </div>

        <div className="h-80" ref={containerRef}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ right: 24, bottom: 12, top: 24 }}>
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
              <Tooltip content={<TooltipContent />} />
              <Line type="monotone" dataKey="F" dot={false} strokeWidth={2} />
              {showMC && mcData.length > 0 && (
                <Line
                  type="monotone"
                  data={mcData as any}
                  dataKey="MC"
                  name="MC"
                  stroke="#7c3aed" /* violet-600 */
                  strokeDasharray="4 2"
                  dot={false}
                />
              )}
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
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div
          className={
            "text-right text-xs mt-1 transition-opacity " +
            (showMC && mcData.length > 0 ? "opacity-70" : "opacity-0 pointer-events-none select-none")
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
