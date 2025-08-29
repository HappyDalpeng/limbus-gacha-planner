import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { ReactNode } from "react";
import NumberField from "./NumberField";
import { Targets, GlobalSettings, Resources } from "@/lib/prob";

export default function SettingsPanel({
  settings,
  setSettings,
  targets,
  setTargets,
  resources,
  setResources,
}: {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  targets: Targets;
  setTargets: (t: Targets) => void;
  resources: Resources;
  setResources: (r: Resources) => void;
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
        <h3 className="font-semibold">{t("resources")}</h3>
        <div className="grid grid-cols-3 gap-2">
          <Num
            label={t("lunacy")}
            value={resources.lunacy}
            onChange={(v) => setResources({ ...resources, lunacy: v })}
          />
          <Num
            label={t("ticket1")}
            value={resources.ticket1}
            onChange={(v) => setResources({ ...resources, ticket1: v })}
          />
          <Num
            label={t("ticket10")}
            value={resources.ticket10}
            onChange={(v) => setResources({ ...resources, ticket10: v })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.autoRecommend}
              onChange={(e) => setSettings({ ...settings, autoRecommend: e.target.checked })}
            />
            <span>{t("autoRecommend")}</span>
          </label>
        </div>
      </section>
    </div>
  );
}

function TargetInputs({
  label,
  value,
  onChange,
  sync = false,
  headerRight,
}: {
  label: string;
  value: { pickup: number; desired: number };
  onChange: (v: { pickup: number; desired: number }) => void;
  sync?: boolean;
  headerRight?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{label}</div>
        {headerRight && <div>{headerRight}</div>}
      </div>
      <div className="flex items-end gap-3">
        <label className="flex-1 text-sm grid gap-1">
          <span className="text-xs opacity-70">{t("desiredCount")}</span>
          <NumberField
            className={
              "w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 " +
              (sync ? " opacity-60 cursor-not-allowed" : "")
            }
            value={value.desired}
            onChange={(v) =>
              onChange({ ...value, desired: Math.max(0, Math.min(v, value.pickup)) })
            }
            min={0}
            max={value.pickup}
            disabled={sync}
            aria-label={t("desiredCount")}
          />
        </label>
        <div className="pb-2 opacity-60">/</div>
        <label className="flex-1 text-sm grid gap-1">
          <span className="text-xs opacity-70">{t("pickupCount")}</span>
          <NumberField
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
            value={value.pickup}
            onChange={(v) =>
              onChange({
                pickup: Math.max(0, v),
                desired: (() => {
                  const newPickup = Math.max(0, v);
                  if (sync) return newPickup;
                  return Math.max(0, Math.min(value.desired, newPickup));
                })(),
              })
            }
            min={0}
            aria-label={t("pickupCount")}
          />
        </label>
      </div>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-sm grid gap-1">
      <span>{label}</span>
      <NumberField
        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
        value={value}
        onChange={(v) => onChange(Math.max(0, v))}
        min={0}
      />
    </label>
  );
}
