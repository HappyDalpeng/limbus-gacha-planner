import { useTranslation } from "react-i18next";
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

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <section className="space-y-2">
        <h3 className="font-semibold">{t("targets")}</h3>
        <TargetInputs
          label={t("announcer")}
          value={targets.A}
          onChange={(v) => setTargets({ ...targets, A: v })}
        />
        <TargetInputs
          label={t("ego")}
          value={targets.E}
          onChange={(v) => setTargets({ ...targets, E: v })}
        />
        <TargetInputs
          label={t("threeStar")}
          value={targets.T}
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
}: {
  label: string;
  value: { featured: number; desired: number };
  onChange: (v: { featured: number; desired: number }) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900">
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <Num
          label={t("featuredCount")}
          value={value.featured}
          onChange={(v) => onChange({ ...value, featured: v })}
        />
        <Num
          label={t("desiredCount")}
          value={value.desired}
          onChange={(v) => onChange({ ...value, desired: v })}
        />
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
