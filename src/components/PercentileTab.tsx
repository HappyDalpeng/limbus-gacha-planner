import { useMemo, useRef, useState } from "react";
import NumberField from "./NumberField";
import { useTranslation } from "react-i18next";
import { Targets, GlobalSettings, PityAlloc, cumulativeSuccess, Resources } from "@/lib/prob";
import { formatPercentValue } from "@/lib/format";

export default function PercentileTab({
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
  const [n, setN] = useState(200);
  const cardRef = useRef<HTMLDivElement>(null);

  const F = useMemo(
    () => cumulativeSuccess(n, settings, targets, pityAlloc),
    [n, settings, targets, pityAlloc],
  );
  const top = F * 100;

  const savePng = async () => {
    const { toPng } = await import("html-to-image");
    if (!cardRef.current) return;
    const dataUrl = await toPng(cardRef.current);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "luck-card.png";
    a.click();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow p-4">
        <label className="text-sm grid gap-1 max-w-xs">
          <span>{t("enterActualPulls")}</span>
          <NumberField
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
            value={n}
            onChange={setN}
            min={0}
          />
        </label>
      </div>

      <div ref={cardRef} className="rounded-2xl bg-white dark:bg-zinc-900 shadow p-6 text-center">
        <div className="text-lg font-semibold mb-2">🎯 {t("title")}</div>
        <div className="text-sm opacity-80 mb-1">
          {t("enterActualPulls")}: <b>{n}</b>
        </div>
        <div className="text-4xl font-extrabold mb-1">
          {t("yourPercentile", {
            top: (() => {
              const digits = top < 1 ? 4 : 2;
              return formatPercentValue(F, digits);
            })(),
          })}
        </div>
        <div className="text-xs opacity-70">F(n)=Pr[goal achieved by n]</div>
      </div>

      <div className="flex">
        <button
          onClick={savePng}
          className="ml-auto px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
        >
          {t("saveImage")}
        </button>
      </div>
    </div>
  );
}
