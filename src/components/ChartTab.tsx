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
  estimatePityNeeded,
  autoMaxDraws,
} from "@/lib/prob";
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

export default function ChartTab({
  targets,
  settings,
  resources,
  pityAlloc,
}: {
  targets: Targets;
  settings: GlobalSettings;
  resources: { lunacy: number; ticket1: number; ticket10: number };
  pityAlloc: PityAlloc;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState(0.9);

  const { total } = useMemo(() => resourcesToDraws(resources), [resources]);
  const maxN = useMemo(() => autoMaxDraws(targets), [targets]);
  const clampedTotal = Math.min(total, maxN);

  // Measure chart width to pick readable tick spacing
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(800);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setChartWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const maxN = autoMaxDraws(targets);
    const arr: { n: number; F: number }[] = [];
    for (let n = 0; n <= maxN; n += 5) {
      arr.push({ n, F: cumulativeSuccess(n, settings, targets, pityAlloc) });
    }
    for (let r = 1; r <= Math.floor(maxN / 200); r++) {
      const a = r * 200 - 1,
        b = r * 200;
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
  }, [targets, settings, pityAlloc]);

  const xTicks = useMemo(() => {
    const width = chartWidth || 800;
    // Estimate label width using canvas measurement for worst-case label
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const sample = String(maxN);
    const font = getComputedStyle(document.documentElement).font || "12px sans-serif";
    if (ctx) ctx.font = font;
    const textW = Math.ceil((ctx ? ctx.measureText(sample).width : 18) + 8);
    const minPx = Math.max(18, textW); // ensure margin
    const targetCount = Math.max(6, Math.min(60, Math.floor(width / minPx)));
    const threshold = Math.max(10, Math.ceil(maxN / targetCount));
    // Build "nice" step candidates: 10 × {1, 2, 2.5, 5} × 10^k
    const bases = [1, 2, 2.5, 5];
    const steps: number[] = [];
    for (let scale = 10; scale <= Math.max(10, maxN * 2 + 10); scale *= 10) {
      for (const b of bases) steps.push(Math.round(b * scale));
    }
    steps.sort((a, b) => a - b);
    const step = steps.find((s) => s >= threshold) || 10;
    const set = new Set<number>();
    for (let n = 0; n <= maxN; n += step) set.add(n);
    // Always include 200 multiples (pity boundaries) and end caps
    for (let n = 0; n <= maxN; n += 200) set.add(n);
    set.add(0);
    set.add(maxN);
    return Array.from(set).sort((a, b) => a - b);
  }, [maxN, chartWidth]);

  const qN = useMemo(() => {
    return findNforQuantile(q, settings, targets, pityAlloc, maxN);
  }, [q, settings, targets, pityAlloc, maxN]);
  const probAtResources = useMemo(
    () => cumulativeSuccess(total, settings, targets, pityAlloc),
    [total, settings, targets, pityAlloc]
  );
  const rows = useMemo(() => {
    return beforeAfterTable(settings, targets, pityAlloc, maxN);
  }, [settings, targets, pityAlloc, maxN]);
  const pityNeeded = useMemo(() => {
    return estimatePityNeeded(settings, targets, pityAlloc, maxN);
  }, [settings, targets, pityAlloc, maxN]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
          <div>
            {t("probAtResources", { n: total })}:{" "}
            <b>{(probAtResources * 100).toFixed(2)}%</b>
          </div>
          <div>· {t("n90Line", { q: Math.round(q * 100), n: qN })}</div>
          <div>· {t("pityNeeded", { r: pityNeeded })}</div>
          <label className="ml-auto flex items-center gap-2">
            <span>%</span>
            <NumberField
              className="w-16 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1"
              value={Math.round(q * 100)}
              onChange={(num) =>
                setQ(Math.min(0.99, Math.max(0.01, (num || 0) / 100)))
              }
              min={1}
              max={99}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs opacity-80 mb-2">
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-4 border-t-2 border-dashed"
              style={{ borderColor: "#ef4444" }}
            />
            {t("legend.resources")}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-4 border-t-2 border-dashed"
              style={{ borderColor: "#10b981" }}
            />
            {t("legend.quantile", { q: Math.round(q * 100) })}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-4 border-t-2 border-dotted"
              style={{ borderColor: "#a1a1aa" }}
            />
            {t("legend.pity")}
          </span>
        </div>

        <div className="h-80" ref={containerRef}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="2 2" />
              <XAxis
                dataKey="n"
                type="number"
                domain={[0, maxN]}
                ticks={xTicks}
                interval={0}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                tickFormatter={(v) => (v * 100).toFixed(0) + "%"}
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
              />
              <Tooltip
                formatter={(value) => [
                  (Number(value) * 100).toFixed(2) + "%",
                  "F(n)",
                ]}
              />
              <Line type="monotone" dataKey="F" dot={false} strokeWidth={2} />
              <ReferenceLine
                key={`res-${clampedTotal}`}
                x={clampedTotal}
                stroke="#ef4444"
                strokeDasharray="6 4"
                label={{ value: `${total}`, position: "top" }}
              />
              <ReferenceLine
                key={`qn-${qN}`}
                x={qN}
                stroke="#10b981"
                strokeDasharray="6 4"
                label={{ value: `${Math.round(q * 100)}%`, position: "top" }}
              />
              {Array.from(
                { length: Math.floor(autoMaxDraws(targets) / 200) },
                (_, i) => (i + 1) * 200
              ).map((n) => (
                <ReferenceLine
                  key={n}
                  x={n}
                  stroke="#71717a"
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  strokeDasharray="3 4"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <details className="rounded-2xl bg-white dark:bg-zinc-900 shadow p-4">
        <summary className="cursor-pointer">{t("beforeAfter")}</summary>
        <div className="overflow-x-auto mt-3">
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
                <tr
                  key={r.pity}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-2 py-1">{r.pity}</td>
                  <td className="px-2 py-1">{(r.before * 100).toFixed(2)}%</td>
                  <td className="px-2 py-1">{(r.after * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
