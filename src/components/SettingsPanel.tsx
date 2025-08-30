import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Targets, GlobalSettings, Resources } from "@/lib/prob";
import TargetInputs from "./TargetInputs";
import ResourcesPanel from "./ResourcesPanel";

function Chip({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
      {children}
    </span>
  );
}

function AutoPlanView({ pityAlloc }: { pityAlloc: ("A" | "E" | "T")[] }) {
  const { t } = useTranslation();
  if (!pityAlloc.length) return null;
  const label = (c: "A" | "E" | "T") =>
    c === "A" ? t("announcer") : c === "E" ? t("ego") : t("threeStar");
  return (
    <div className="text-sm space-y-1">
      <div className="opacity-70">{t("exchangePlan")}</div>
      <div className="flex flex-wrap gap-1">
        {pityAlloc.map((c, i) => (
          <Chip key={i}>{label(c)}</Chip>
        ))}
      </div>
    </div>
  );
}

function PriorityEditor({
  order,
  onChange,
}: {
  order: ("A" | "E" | "T")[];
  onChange: (o: ("A" | "E" | "T")[]) => void;
}) {
  const { t } = useTranslation();
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const arr = order.slice();
    const tmp = arr[idx];
    arr[idx] = arr[j];
    arr[j] = tmp;
    onChange(arr);
  };
  const label = (c: "A" | "E" | "T") =>
    c === "A" ? t("announcer") : c === "E" ? t("ego") : t("threeStar");
  return (
    <div className="text-sm space-y-1">
      <div className="opacity-70">{t("exchangeOrder")}</div>
      <div className="flex flex-wrap gap-2">
        {order.map((c, i) => (
          <div key={c} className="flex items-center gap-1">
            <Chip>{label(c)}</Chip>
            <div className="flex flex-col">
              <button
                className="px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-800"
                onClick={() => move(i, -1)}
                aria-label="left"
                title="left"
              >
                ←
              </button>
              <button
                className="px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-800"
                onClick={() => move(i, 1)}
                aria-label="right"
                title="right"
              >
                →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPanel({
  settings,
  setSettings,
  targets,
  setTargets,
  resources,
  setResources,
  pityAlloc,
}: {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  targets: Targets;
  setTargets: (t: Targets) => void;
  resources: Resources;
  setResources: (r: Resources) => void;
  pityAlloc: ("A" | "E" | "T")[];
}) {
  const { t } = useTranslation();
  const [syncDesired, setSyncDesired] = useState(false);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t("targets")}</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={syncDesired}
              onChange={(e) => {
                const checked = e.target.checked;
                setSyncDesired(checked);
                if (checked) {
                  // When enabling sync, align desired to pickup for all
                  setTargets({
                    A: { ...targets.A, desired: targets.A.pickup },
                    E: { ...targets.E, desired: targets.E.pickup },
                    T: { ...targets.T, desired: targets.T.pickup },
                  });
                }
              }}
              aria-label={t("syncDesired")}
              title={t("syncDesired")}
            />
            <span className="whitespace-nowrap">{t("syncDesired")}</span>
          </label>
        </div>
        <TargetInputs
          label={t("announcer")}
          value={targets.A}
          sync={syncDesired}
          onChange={(v) => setTargets({ ...targets, A: v })}
        />
        <TargetInputs
          label={t("ego")}
          value={targets.E}
          sync={syncDesired}
          onChange={(v) => setTargets({ ...targets, E: v })}
          headerRight={
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.ownAllExistingPoolEgo}
                  onChange={(e) =>
                    setSettings({ ...settings, ownAllExistingPoolEgo: e.target.checked })
                  }
                />
                <span>{t("ownAllExistingPoolEgo")}</span>
              </label>
              <div className="relative group">
                <span
                  aria-label={t("ownAllExistingPoolEgoHint")}
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-zinc-400 text-[10px] leading-none select-none cursor-help"
                  title={t("ownAllExistingPoolEgoHint")}
                >
                  i
                </span>
                <div className="hidden group-hover:block absolute z-10 right-0 mt-1 w-64 text-xs p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow">
                  {t("ownAllExistingPoolEgoHint")}
                </div>
              </div>
            </div>
          }
        />
        <TargetInputs
          label={t("threeStar")}
          value={targets.T}
          sync={syncDesired}
          onChange={(v) => setTargets({ ...targets, T: v })}
        />
      </section>

      <section className="space-y-2">
        <ResourcesPanel resources={resources} setResources={setResources} />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.autoRecommend}
              onChange={(e) => setSettings({ ...settings, autoRecommend: e.target.checked })}
            />
            <span>{t("autoRecommend")}</span>
          </label>
        </div>
        {settings.autoRecommend ? (
          <AutoPlanView pityAlloc={pityAlloc} />
        ) : (
          <PriorityEditor
            order={(settings.exchangePriority as ("A" | "E" | "T")[]) || ["E", "T", "A"]}
            onChange={(order) => setSettings({ ...settings, exchangePriority: order })}
          />
        )}
      </section>
    </div>
  );
}
