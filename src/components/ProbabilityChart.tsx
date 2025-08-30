import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import TooltipContent from "./TooltipContent";
import { useTranslation } from "react-i18next";

type Datum = { n: number; F: number };

export default function ProbabilityChart({
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
}) {
  const { t } = useTranslation();

  function EventDot(props: any) {
    const { cx, cy, payload, index } = props;
    const kind: "A" | "E" | "T" | undefined = payload?.kind;
    const source: "draw" | "pity" | undefined = payload?.source;
    if (typeof cx !== "number" || typeof cy !== "number" || !kind) return null;
    const color = colors[kind];
    const isLatest = index === eventData.length - 1;
    const name = kind === "A" ? t("announcer") : kind === "E" ? t("ego") : t("threeStar");
    const label = source === "pity" ? `${name} · ${t("pity")}` : name;
    const w = 16 + String(label).length * 6;
    const h = 16;
    return (
      <g pointerEvents="none">
        <circle cx={cx} cy={cy} r={5} fill={color} stroke="#111827" strokeWidth={1.5} />
        {isLatest && (
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

  return (
    <ResponsiveContainer debounce={100}>
      <ComposedChart data={data as any} margin={{ right: 24, bottom: 12, top: 24 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="2 2" />
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
        <Tooltip content={<TooltipContent showMC={showMC} mcData={mcData} />} />
        <Line
          type="monotone"
          dataKey="F"
          dot={false}
          strokeWidth={2}
          stroke={colors.curve}
          isAnimationActive={false}
          connectNulls
        />
        {showMC && mcData.length > 0 && (
          <Line
            type="monotone"
            data={mcData as any}
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
        <ReferenceLine
          key={`res-${clampedTotal}`}
          x={clampedTotal}
          stroke={colors.resources}
          strokeDasharray="6 4"
          label={
            isRefLabelClose
              ? { value: `${total}`, position: "insideTop", fill: colors.resources, dy: 6 }
              : { value: `${total}`, position: "top", fill: colors.resources, dy: 0 }
          }
        />
        <ReferenceLine
          key={`qn-${qN}`}
          x={qN}
          stroke={colors.quantile}
          strokeDasharray="6 4"
          label={{
            value: `${Math.round(q * 100)}%`,
            position: "top",
            fill: colors.quantile,
            dy: 0,
          }}
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
      </ComposedChart>
    </ResponsiveContainer>
  );
}
