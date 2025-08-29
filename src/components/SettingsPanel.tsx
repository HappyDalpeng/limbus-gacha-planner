import { useTranslation } from "react-i18next";
import { useState } from "react";
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
              checked={settings.hasAnnouncer}
              onChange={(e) => setSettings({ ...settings, hasAnnouncer: e.target.checked })}
            />
            <span>{t("hasAnnouncer")}</span>
          </label>
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
}: {
  label: string;
  value: { pickup: number; desired: number };
  onChange: (v: { pickup: number; desired: number }) => void;
  sync?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="flex items-end gap-3">
        <label className="flex-1 text-sm grid gap-1">
          <span className="text-xs opacity-70">{t("desiredCount")}</span>
          <NumberField
            className={
              "w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 " +
              (sync ? " opacity-60 cursor-not-allowed" : "")
            }
            value={value.desired}
            onChange={(v) => onChange({ ...value, desired: Math.max(0, v) })}
            min={0}
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
                desired: sync ? Math.max(0, v) : value.desired,
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
