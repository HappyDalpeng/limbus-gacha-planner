import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import NumberField from "./NumberField";

export type TargetValue = { pickup: number; desired: number };

export default function TargetInputs({
  label,
  value,
  onChange,
  sync = false,
  headerRight,
}: {
  label: string;
  value: TargetValue;
  onChange: (v: TargetValue) => void;
  sync?: boolean;
  headerRight?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{label}</div>
        {headerRight && <div>{headerRight}</div>}
      </div>
      <div className="flex items-end gap-3">
        <label className="flex-1 text-sm grid gap-1">
          <span className="text-xs opacity-70">{t("desiredCount")}</span>
          <NumberField
            className={"input input-bordered w-full" + (sync ? " opacity-60 cursor-not-allowed" : "")}
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
            className="input input-bordered w-full"
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
