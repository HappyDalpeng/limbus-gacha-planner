import { formatPercentValue } from "@/lib/format";
import { useTranslation } from "react-i18next";

export default function TooltipContent({ active, payload, label, showMC, mcData }: any) {
  const { t } = useTranslation();
  if (!active || !payload || !payload.length) return null;
  const toNum = (x: any) => (typeof x === "number" ? x : Number(x));
  const nVal = toNum(label);
  const itemF = payload.find((p: any) => p && (p.dataKey === "F" || p.name === "F"));
  const Fv = typeof itemF?.value === "number" ? itemF.value : undefined;
  const itemMC = payload.find((p: any) => p && (p.dataKey === "MC" || p.name === "MC"));
  let MCv: number | undefined = undefined;
  if (showMC) {
    if (typeof itemMC?.value === "number") MCv = itemMC.value as number;
    else if (Array.isArray(mcData) && mcData.length >= 2) {
      let i = 0;
      while (i < mcData.length && mcData[i].n < nVal) i++;
      if (i === 0) MCv = mcData[0].MC;
      else if (i >= mcData.length) MCv = mcData[mcData.length - 1].MC;
      else {
        const a = mcData[i - 1];
        const b = mcData[i];
        const tlin = b.n === a.n ? 0 : (nVal - a.n) / (b.n - a.n);
        MCv = a.MC + (b.MC - a.MC) * tlin;
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
