import { useTranslation } from "react-i18next";
import { useState } from "react";
import type React from "react";
import { Targets, GlobalSettings, Resources } from "@/lib/prob";
import TargetInputs from "./TargetInputs";
import ResourcesPanel from "./ResourcesPanel";

function Chip({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 select-none whitespace-nowrap">
      {children}
    </span>
  );
}

function PlanEditor({
  plan,
  onReorder,
  label,
  onAutoArrange,
}: {
  plan: ("A" | "E" | "T")[];
  onReorder: (p: ("A" | "E" | "T")[]) => void;
  label: (c: "A" | "E" | "T") => string;
  onAutoArrange: () => void;
}) {
  const { t } = useTranslation();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const onDragStart = (e: React.DragEvent<HTMLSpanElement>, index: number) => {
    e.dataTransfer.setData("text/plain", String(index));
    setDragFrom(index);
  };
  const onDrop = (e: React.DragEvent<HTMLElement>, index: number) => {
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(from)) return;
    const arr = plan.slice();
    const [item] = arr.splice(from, 1);
    arr.splice(index, 0, item);
    onReorder(arr);
    setDragFrom(null);
    setDragOver(null);
  };
  const onDragEnter = (_e: React.DragEvent<HTMLElement>, index: number) => {
    setDragOver(index);
  };
  const onDragEnd = () => {
    setDragFrom(null);
    setDragOver(null);
  };
  const onChipDragOver = (e: React.DragEvent<HTMLSpanElement>, index: number) => {
    // Allow drop and compute if pointer is near left/right edge of the chip
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const edge = 10; // px threshold near chip edges
    if (x <= edge) {
      setDragOver(index);
    } else if (rect.width - x <= edge) {
      setDragOver(index + 1);
    } else {
      // Not near a valid boundary; hide highlight
      setDragOver(null);
    }
  };
  const commitReorder = (toIndex: number | null) => {
    if (dragFrom === null || toIndex === null) return;
    const arr = plan.slice();
    const [item] = arr.splice(dragFrom, 1);
    const clamped = Math.max(0, Math.min(arr.length, toIndex));
    arr.splice(clamped, 0, item);
    onReorder(arr);
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <div
      className="text-sm space-y-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        commitReorder(dragOver);
      }}
    >
      <div className="flex items-center gap-2">
        <div className="opacity-70">{t("exchangePlan")}</div>
        <button
          className="ml-auto px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800"
          onClick={onAutoArrange}
        >
          {t("autoArrange")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-0">
        {plan.map((c, i) => (
          <span key={`item-${i}`} className="flex items-center gap-0">
            {/* drop zone before item (always rendered to keep spacing constant) */}
            <span
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => onDragEnter(e, i)}
              onDrop={(e) => onDrop(e, i)}
              className={
                "h-6 w-[3px] mx-1 rounded-full transition-colors self-center " +
                (dragOver === i ? "bg-sky-400" : "bg-transparent")
              }
            />
            <span
              draggable
              onDragStart={(e) => onDragStart(e, i)}
              onDragOver={(e) => onChipDragOver(e, i)}
              onDragEnd={onDragEnd}
              onDrop={(e) => onDrop(e, i)}
              title={t("dragToReorder")}
              className={
                "cursor-move transition-transform " +
                (dragFrom === i ? "opacity-60 scale-95" : "") +
                (dragOver === i ? " ring-2 ring-sky-400 rounded" : "")
              }
              aria-grabbed={dragFrom === i}
            >
              <Chip>{label(c)}</Chip>
            </span>
          </span>
        ))}
        {/* drop zone at end (always rendered) */}
        <span
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => onDragEnter(e, plan.length)}
          onDrop={(e) => onDrop(e, plan.length)}
          className={
            "h-6 w-[3px] mx-1 rounded-full transition-colors self-center " +
            (dragOver === plan.length ? "bg-sky-400" : "bg-transparent")
          }
        />
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
        <PlanEditor
          plan={pityAlloc}
          onReorder={(p) => setSettings({ ...settings, exchangePlan: p })}
          label={(c) => (c === "A" ? t("announcer") : c === "E" ? t("ego") : t("threeStar"))}
          onAutoArrange={() => setSettings({ ...settings, exchangePlan: undefined })}
        />
      </section>
    </div>
  );
}
