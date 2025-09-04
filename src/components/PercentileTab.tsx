import { formatPercentValue } from "@/lib/format";
import { cumulativeSuccess } from "@/lib/prob";
import { useAppStore, usePityAlloc } from "@/store/appStore";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import NumberField from "./NumberField";

export default function PercentileTab() {
  const { t } = useTranslation();
  const [n, setN] = useState(200);
  const cardRef = useRef<HTMLDivElement>(null);
  const [showCard, setShowCard] = useState(false);
  const targets = useAppStore((s) => s.targets);
  const settings = useAppStore((s) => s.settings);
  const pityAlloc = usePityAlloc();

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
      {!showCard ? (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow p-4">
          <div className="flex items-end gap-3 max-w-xl">
            <label className="text-sm grid gap-1 flex-1">
              <span>{t("enterActualPulls")}</span>
              <NumberField
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
                value={n}
                onChange={setN}
                min={0}
              />
            </label>
            <button
              onClick={() => setShowCard(true)}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
            >
              {t("showCard")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mx-auto w-full max-w-3xl">
            <div
              ref={cardRef}
              className="rounded-2xl bg-white dark:bg-zinc-900 shadow p-6 text-center aspect-[16/9] flex flex-col justify-center"
            >
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
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCard(false)}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
            >
              {t("editAgain")}
            </button>
            <button
              onClick={savePng}
              className="ml-auto px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
            >
              {t("saveImage")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
