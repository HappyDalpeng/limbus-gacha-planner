import { PITY_STEP, resourcesToDraws } from "@/lib/prob";
import { useAppStore } from "@/store/appStore";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import NumberField from "./NumberField";

export default function ResourcesPanel() {
  const { t } = useTranslation();
  const resources = useAppStore((s) => s.resources);
  const setResources = useAppStore((s) => s.setResources);
  const { total } = useMemo(() => resourcesToDraws(resources), [resources]);
  const pityFromResources = Math.floor(total / PITY_STEP);

  return (
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
      <div className="mt-2 px-1 py-2 text-sm md:text-base font-medium">
        {t("resourcesSummary", { total, pity: pityFromResources })}
      </div>
    </section>
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
        className="input input-bordered w-full"
        value={value}
        onChange={(v) => onChange(Math.max(0, v))}
        min={0}
      />
    </label>
  );
}
