import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import TooltipContent from "./TooltipContent";
import { useTranslation } from "react-i18next";
import { memo, useEffect, useMemo, useState, type ReactElement } from "react";

type Datum = { n: number; F: number };

// Measure text width using a shared canvas for better accuracy than char-count heuristics
let __measureCanvas: HTMLCanvasElement | null = null;
let __measureCtx: CanvasRenderingContext2D | null = null;
function measureTextWidth(text: string, fontSize = 10) {
  if (typeof document === "undefined") return 6 * String(text).length; // SSR fallback
  if (!__measureCanvas) __measureCanvas = document.createElement("canvas");
  if (!__measureCtx) __measureCtx = __measureCanvas.getContext("2d");
  const ctx = __measureCtx;
  if (!ctx) return 6 * String(text).length;
  const root = getComputedStyle(document.documentElement);
  const family = root.fontFamily || "sans-serif";
  ctx.font = `${fontSize}px ${family}`;
  return Math.ceil(ctx.measureText(String(text)).width);
}

function ProbabilityChart({
  data,
  mcData,
  simData,
  eventData,
  xTicks,
  maxN,
  clampedTotal,
  total,
  qN,
  q,
  pityBoundaries,
  isRefLabelClose,
  colors,
  showMC,
  resY,
  resLabel,
  qY,
  qLabel,
  freezeXAxis,
}: {
  data: Datum[];
  mcData: { n: number; MC: number }[];
  simData: { n: number; R: number }[];
  eventData: { n: number; y: number; kind: "A" | "E" | "T"; source: "draw" | "pity" }[];
  xTicks: number[];
  maxN: number;
  clampedTotal: number;
  total: number;
  qN: number;
  q: number;
  pityBoundaries: number[];
  isRefLabelClose: boolean;
  colors: Record<string, string>;
  showMC: boolean;
  resY: number;
  resLabel: string;
  qY: number;
  qLabel: string;
  freezeXAxis?: boolean;
}) {
  const { t } = useTranslation();

  function EventDot(props: any) {
    const { cx, cy, payload, index } = props;
    const [hovered, setHovered] = useState(false);
    const kind: "A" | "E" | "T" | undefined = payload?.kind;
    const source: "draw" | "pity" | undefined = payload?.source;
    if (typeof cx !== "number" || typeof cy !== "number" || !kind) return null;
    const color = colors[kind];
    const isLatest = index === eventData.length - 1;
    const name = kind === "A" ? t("announcer") : kind === "E" ? t("ego") : t("threeStar");
    const label = source === "pity" ? `${name} · ${t("pity")}` : name;
    const textW = measureTextWidth(label, 10);
    const w = 16 + textW; // 8px left + 8px right padding
    const h = 16;
    return (
      <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <circle cx={cx} cy={cy} r={5} fill={color} stroke="#111827" strokeWidth={1.5} />
        {(isLatest || hovered) && (
          <g transform={`translate(${cx + 8}, ${cy - h - 4})`}>
            <rect width={w} height={h} rx={4} ry={4} fill="rgba(17,24,39,0.85)" />
            <text x={8} y={12} fontSize={10} fill="#fff">
              {label}
            </text>
          </g>
        )}
      </g>
    );
  }

  function BubbleDot({
    cx,
    cy,
    color,
    label,
    align = "center",
  }: {
    cx?: number;
    cy?: number;
    color: string;
    label: string;
    align?: "center" | "left" | "right";
  }) {
    if (typeof cx !== "number" || typeof cy !== "number") return null;
    const padX = 6;
    const padY = 3;
    const textW = measureTextWidth(label, 10);
    const w = padX * 2 + textW;
    const h = 16;
    let tx = cx - w / 2;
    if (align === "left") tx = cx - w - 8;
    if (align === "right") tx = cx + 8;
    return (
      <g pointerEvents="none">
        <circle cx={cx} cy={cy} r={4} fill={color} />
        <g transform={`translate(${tx}, ${cy - h - 8})`}>
          <rect width={w} height={h} rx={4} ry={4} fill="rgba(17,24,39,0.85)" />
          <text x={padX} y={12} fontSize={10} fill="#fff">
            {label}
          </text>
        </g>
      </g>
    );
  }

  function BubbleLabel({ viewBox, text, align = "center" }: any) {
    const cx = typeof viewBox?.cx === "number" ? viewBox.cx : viewBox?.x || 0;
    const cy = typeof viewBox?.cy === "number" ? viewBox.cy : viewBox?.y || 0;
    const padX = 6;
    const textW = measureTextWidth(text, 10);
    const w = padX * 2 + textW;
    const h = 16;
    let tx = cx - w / 2;
    if (align === "left") tx = cx - w - 8;
    if (align === "right") tx = cx + 8;
    return (
      <g pointerEvents="none" transform={`translate(${tx}, ${cy - h - 8})`}>
        <rect width={w} height={h} rx={4} ry={4} fill="rgba(17,24,39,0.85)" />
        <text x={padX} y={12} fontSize={10} fill="#fff">
          {text}
        </text>
      </g>
    );
  }
  const mcDenseData = useMemo(() => {
    if (!showMC || !Array.isArray(mcData) || mcData.length === 0) return mcData;
    const arr: { n: number; MC: number }[] = [];
    // ensure sorted
    const src = [...mcData].sort((a, b) => a.n - b.n);
    let j = 0;
    for (let n = 0; n <= maxN; n++) {
      while (j + 1 < src.length && src[j + 1].n <= n) j++;
      const a = src[j];
      const b = src[Math.min(j + 1, src.length - 1)];
      let y = a.MC;
      if (b.n !== a.n) {
        const t = Math.max(0, Math.min(1, (n - a.n) / (b.n - a.n)));
        y = a.MC + (b.MC - a.MC) * t;
      }
      if (arr.length && y < arr[arr.length - 1].MC) y = arr[arr.length - 1].MC;
      arr.push({ n, MC: y });
    }
    return arr;
  }, [showMC, mcData, maxN]);

  // Memoize Tooltip content element to avoid new instance per render
  const tooltipContent = useMemo(
    () => <TooltipContent showMC={showMC} mcData={mcData} />,
    [showMC, mcData],
  );

  // Build XAxis element and freeze it during simulation to avoid re-rendering
  const xAxisBuilt = useMemo(
    () => (
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
    ),
    [xTicks, maxN],
  );
  const [xAxisFrozen, setXAxisFrozen] = useState<ReactElement | null>(null);
  useEffect(() => {
    if (!freezeXAxis) setXAxisFrozen(xAxisBuilt);
  }, [freezeXAxis, xAxisBuilt]);

  return (
    <ResponsiveContainer debounce={100}>
      <ComposedChart data={data as any} margin={{ right: 24, bottom: 12, top: 24 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="2 2" />
        {(xAxisFrozen ?? xAxisBuilt)}
        <YAxis
          tickFormatter={(v) => (v * 100).toFixed(0) + "%"}
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
        />
        <Tooltip content={tooltipContent} />
        {showMC && mcData.length > 0 && (
          <Line
            type="monotone"
            data={mcDenseData as any}
            dataKey="MC"
            name="MC"
            stroke={colors.mc}
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
            stroke={colors.sim}
            dot={false}
            isAnimationActive={false}
          />
        )}
        {eventData.length > 0 && (
          <Line
            type="linear"
            data={eventData as any}
            dataKey="y"
            name="Event"
            stroke="none"
            dot={<EventDot />}
            isAnimationActive={false}
          />
        )}
        <Line
          type="monotone"
          dataKey="F"
          dot={false}
          strokeWidth={2}
          stroke={colors.curve}
          isAnimationActive={false}
          connectNulls
        />
        <ReferenceLine
          key={`res-${clampedTotal}`}
          x={clampedTotal}
          stroke={colors.resources}
          strokeDasharray="6 4"
          label={(() => {
            const toRight = clampedTotal < qN; // resource line is left of q line
            return {
              value: `${total}`,
              position: "top",
              fill: colors.resources,
              dy: 0,
              dx: isRefLabelClose ? (toRight ? -10 : 10) : 0,
              fontSize: 11,
            } as any;
          })()}
        />
        <ReferenceLine
          key={`qn-${qN}`}
          x={qN}
          stroke={colors.quantile}
          strokeDasharray="6 4"
          label={(() => {
            const toRight = clampedTotal < qN; // resource line is left of q line
            return {
              value: `${qN}`,
              position: "top",
              fill: colors.quantile,
              dy: 0,
              dx: isRefLabelClose ? (toRight ? 10 : -10) : 0,
              fontSize: 11,
            } as any;
          })()}
        />
        {pityBoundaries.map((n) => (
          <ReferenceLine
            key={n}
            x={n}
            stroke={colors.pity}
            strokeWidth={1}
            strokeOpacity={0.75}
            strokeDasharray="2 4"
          />
        ))}

        {/* Intersection dots with tooltip-like labels (ReferenceDot avoids tooltip interference) */}
        <ReferenceDot
          x={clampedTotal}
          y={resY}
          r={4}
          fill={colors.resources}
          label={<BubbleLabel text={resLabel} align={isRefLabelClose ? "left" : "center"} />}
        />
        <ReferenceDot
          x={qN}
          y={qY}
          r={4}
          fill={colors.quantile}
          label={<BubbleLabel text={qLabel} align={isRefLabelClose ? "right" : "center"} />}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default memo(ProbabilityChart);
